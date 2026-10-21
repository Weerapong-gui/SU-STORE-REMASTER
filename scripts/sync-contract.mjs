import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACT_COPY = resolve(ROOT, "src/contract");
const CONTRACT_FILES = ["store-contract.json", "receipt_template_v2.svg", "openapi.json"];
const GENERATED_TYPES = "api.d.ts";
const check = process.argv.includes("--check");
// raw.githubusercontent.com can stall; fail the check instead of hanging CI.
const FETCH_TIMEOUT_MS = 15_000;

async function fetchContract(directory) {
  const files = new Map();
  for (const file of CONTRACT_FILES) {
    try {
      let content;
      if (directory) {
        content = readFileSync(resolve(directory, file));
      } else {
        const ref = process.env.CONTRACT_REF || "main";
        const url = `https://raw.githubusercontent.com/Weerapong-gui/SU-STORE-SERVER/${ref}/contract/${file}`;
        const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        content = Buffer.from(await response.arrayBuffer());
      }
      files.set(file, content);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.error(`ดึง contract จาก backend ไม่ได้: ${file} (${reason})`);
      process.exit(2);
    }
  }
  return files;
}

function generateTypes(openapiPath, outFile) {
  execFileSync("npx", ["openapi-typescript", openapiPath, "-o", outFile], {
    cwd: ROOT,
    stdio: check ? "ignore" : "inherit",
  });
}

function sameFile(a, b) {
  return existsSync(a) && existsSync(b) && readFileSync(a).equals(readFileSync(b));
}

const sourceFiles = await fetchContract(process.env.CONTRACT_DIR);
const scratch = mkdtempSync(join(tmpdir(), "su-contract-"));
try {
  const openapiPath = join(scratch, "openapi.json");
  const generatedTypes = join(scratch, GENERATED_TYPES);
  for (const [file, contents] of sourceFiles) {
    const filePath = join(scratch, file);
    writeFileSync(filePath, contents);
  }
  generateTypes(openapiPath, generatedTypes);

  if (check) {
    const copyFiles = existsSync(CONTRACT_COPY)
      ? readdirSync(CONTRACT_COPY).filter((file) => file !== GENERATED_TYPES).sort()
      : [];
    const filesMatch = copyFiles.join() === [...CONTRACT_FILES].sort().join()
      && [...sourceFiles].every(([file, contents]) => (
        existsSync(resolve(CONTRACT_COPY, file))
        && readFileSync(resolve(CONTRACT_COPY, file)).equals(contents)
      ));
    const typesFresh = sameFile(generatedTypes, resolve(CONTRACT_COPY, GENERATED_TYPES));
    if (!filesMatch || !typesFresh) {
      console.error("contract ไม่ตรงกับ backend: รัน npm run contract:sync");
      process.exitCode = 1;
    }
  } else {
    mkdirSync(CONTRACT_COPY, { recursive: true });
    for (const file of readdirSync(CONTRACT_COPY)) {
      if (file !== GENERATED_TYPES && !CONTRACT_FILES.includes(file)) {
        rmSync(resolve(CONTRACT_COPY, file), { force: true });
      }
    }
    for (const [file] of sourceFiles) copyFileSync(join(scratch, file), resolve(CONTRACT_COPY, file));
    copyFileSync(generatedTypes, resolve(CONTRACT_COPY, GENERATED_TYPES));
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

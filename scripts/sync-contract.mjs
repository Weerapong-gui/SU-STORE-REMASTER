import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const CONTRACT_SOURCE = resolve(ROOT, "server/contract");
const CONTRACT_COPY = resolve(ROOT, "src/contract");
// Generated from openapi.json here, so it never exists in the backend contract.
const GENERATED_TYPES = "api.d.ts";
const check = process.argv.includes("--check");

const generateTypes = (outFile) => execFileSync(
  "npx", ["openapi-typescript", resolve(CONTRACT_SOURCE, "openapi.json"), "-o", outFile],
  { cwd: ROOT, stdio: check ? "ignore" : "inherit" },
);
const sameFile = (a, b) => existsSync(a) && existsSync(b) && readFileSync(a).equals(readFileSync(b));

const sourceFiles = readdirSync(CONTRACT_SOURCE).sort();
const copyFiles = existsSync(CONTRACT_COPY) ? readdirSync(CONTRACT_COPY).filter((file) => file !== GENERATED_TYPES).sort() : [];

if (check) {
  const scratch = mkdtempSync(join(tmpdir(), "su-contract-"));
  generateTypes(join(scratch, GENERATED_TYPES));
  const typesFresh = sameFile(join(scratch, GENERATED_TYPES), resolve(CONTRACT_COPY, GENERATED_TYPES));
  rmSync(scratch, { recursive: true, force: true });
  const filesMatch = sourceFiles.join() === copyFiles.join()
    && sourceFiles.every((file) => sameFile(resolve(CONTRACT_SOURCE, file), resolve(CONTRACT_COPY, file)));
  if (!filesMatch || !typesFresh) {
    console.error("contract ไม่ตรงกับ backend: รัน npm run contract:sync");
    process.exit(1);
  }
} else {
  mkdirSync(CONTRACT_COPY, { recursive: true });
  for (const file of copyFiles) {
    if (!sourceFiles.includes(file)) rmSync(resolve(CONTRACT_COPY, file));
  }
  for (const file of sourceFiles) copyFileSync(resolve(CONTRACT_SOURCE, file), resolve(CONTRACT_COPY, file));
  generateTypes(resolve(CONTRACT_COPY, GENERATED_TYPES));
}

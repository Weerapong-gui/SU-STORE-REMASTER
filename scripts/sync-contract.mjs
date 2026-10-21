import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const CONTRACT_SOURCE = resolve(ROOT, "server/contract");
const CONTRACT_COPY = resolve(ROOT, "src/contract");
const check = process.argv.includes("--check");

const sourceFiles = readdirSync(CONTRACT_SOURCE).sort();
const copyFiles = existsSync(CONTRACT_COPY) ? readdirSync(CONTRACT_COPY).sort() : [];
const mismatches = sourceFiles.length !== copyFiles.length || sourceFiles.some((file, index) => file !== copyFiles[index]
  || !readFileSync(resolve(CONTRACT_SOURCE, file)).equals(readFileSync(resolve(CONTRACT_COPY, file))));

if (check) {
  if (mismatches) {
    console.error("contract ไม่ตรงกับ backend: รัน npm run contract:sync");
    process.exit(1);
  }
} else {
  mkdirSync(CONTRACT_COPY, { recursive: true });
  for (const file of copyFiles) {
    if (!sourceFiles.includes(file)) rmSync(resolve(CONTRACT_COPY, file));
  }
  for (const file of sourceFiles) copyFileSync(resolve(CONTRACT_SOURCE, file), resolve(CONTRACT_COPY, file));
}

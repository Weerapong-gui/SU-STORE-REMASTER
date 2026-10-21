import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const root = process.cwd();
const contractFiles = ["store-contract.json", "receipt_template_v2.svg", "openapi.json"];

function makeContractDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "su-contract-test-"));
  const source = join(root, "src/contract");
  for (const file of contractFiles) {
    writeFileSync(join(directory, file), readFileSync(join(source, file)));
  }
  return directory;
}

function checkContract(contractDir: string) {
  return spawnSync("node", ["scripts/sync-contract.mjs", "--check"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, CONTRACT_DIR: contractDir },
  });
}

describe("contract sync", () => {
  let contractDir: string;

  beforeEach(() => {
    contractDir = makeContractDirectory();
  });

  afterEach(() => rmSync(contractDir, { recursive: true, force: true }));

  it("passes when the backend contract matches the storefront copy", () => {
    const result = checkContract(contractDir);
    expect(result.status).toBe(0);
  });

  it("exits 1 with a sync hint when a contract file differs", () => {
    writeFileSync(join(contractDir, "store-contract.json"), "{}");

    const result = checkContract(contractDir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("contract ไม่ตรงกับ backend");
  });

  it("exits 2 and explains when a backend contract file is missing", () => {
    rmSync(join(contractDir, "openapi.json"));

    const result = checkContract(contractDir);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("ดึง contract จาก backend ไม่ได้");
  });
});

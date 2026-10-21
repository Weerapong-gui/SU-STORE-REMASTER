import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import YAML from "yaml";

const workflowsDirectory = join(process.cwd(), ".github/workflows");
const workflows = readdirSync(workflowsDirectory)
  .filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"))
  .map((file) => ({ file, workflow: YAML.parse(readFileSync(join(workflowsDirectory, file), "utf8")) }));

function hasSelfHostedRunner(runsOn: unknown): boolean {
  return Array.isArray(runsOn)
    ? runsOn.some((runner) => String(runner).includes("self-hosted"))
    : String(runsOn).includes("self-hosted");
}

describe("GitHub Actions workflow guard", () => {
  it("never uses pull_request_target", () => {
    for (const { file, workflow } of workflows) {
      expect(workflow.on?.pull_request_target, file).toBeUndefined();
    }
  });

  it("limits self-hosted jobs to main pushes or manual dispatch", () => {
    const allowedTriggers = new Set(["push", "workflow_dispatch"]);

    for (const { file, workflow } of workflows) {
      const jobs = Object.entries(workflow.jobs ?? {}) as [string, { "runs-on"?: unknown }][];
      const selfHostedJobs = jobs.filter(([, job]) => hasSelfHostedRunner(job["runs-on"]));
      if (selfHostedJobs.length === 0) continue;

      const triggers = Object.keys(workflow.on ?? {});
      expect(triggers.every((trigger) => allowedTriggers.has(trigger)), file).toBe(true);
      if (workflow.on?.push) expect(workflow.on.push.branches, file).toEqual(["main"]);
    }
  });

  it("gates each self-hosted job behind production deployment approval", () => {
    for (const { file, workflow } of workflows) {
      for (const [name, job] of Object.entries(workflow.jobs ?? {}) as [string, {
        "runs-on"?: unknown;
        environment?: unknown;
        if?: unknown;
      }][]) {
        if (!hasSelfHostedRunner(job["runs-on"])) continue;
        expect(job.environment, `${file}:${name}`).toBe("production");
        expect(String(job.if), `${file}:${name}`).toContain("vars.DEPLOY_ENABLED == 'true'");
      }
    }
  });
});

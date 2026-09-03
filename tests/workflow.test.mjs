// tests/workflow.test.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowUrl = new URL("../.github/workflows/pacman.yml", import.meta.url);

test("workflow has narrow triggers, concurrency, and permissions", async () => {
  const yaml = await readFile(workflowUrl, "utf8");
  assert.match(yaml, /cron: "17 3 \* \* \*"/);
  assert.match(yaml, /workflow_dispatch:/);
  assert.match(yaml, /cancel-in-progress: true/);
  assert.match(yaml, /contents: write/);
  assert.doesNotMatch(yaml, /pull_request:|pull_request_target:/);
  assert.doesNotMatch(yaml, /PAT|PERSONAL_ACCESS_TOKEN/);
});

test("workflow pins its only action and publishes only expected SVGs", async () => {
  const yaml = await readFile(workflowUrl, "utf8");
  const uses = yaml.split("\n").filter((line) => line.trim().startsWith("uses:"));
  assert.deepEqual(uses.map((line) => line.trim()), [
    "uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2"
  ]);
  assert.match(yaml, /pacman-contribution-graph\.svg/);
  assert.match(yaml, /pacman-contribution-graph-dark\.svg/);
  assert.match(yaml, /HEAD:output/);
  assert.doesNotMatch(yaml, /abozanona|crazy-max|@main|@master/);
});

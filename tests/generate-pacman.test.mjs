// tests/generate-pacman.test.mjs
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { run } from "../scripts/generate-pacman.mjs";

const fixturePath = new URL("./fixtures/contributions.json", import.meta.url);

test("fixture mode writes deterministic light and dark files", async (context) => {
  const outputDir = await mkdtemp(join(tmpdir(), "spicywonda-pacman-"));
  context.after(() => rm(outputDir, { recursive: true, force: true }));
  const files = await run({
    argv: ["--fixture", fixturePath.pathname, "--output-dir", outputDir],
    env: { GITHUB_USERNAME: "Spicywonda" }
  });
  assert.deepEqual(files.map((file) => file.split("/").at(-1)), [
    "pacman-contribution-graph.svg",
    "pacman-contribution-graph-dark.svg"
  ]);
  for (const file of files) assert.match(await readFile(file, "utf8"), /<animateMotion\b/);
});

test("fixture mode renders a calendar with zero activity", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "spicywonda-pacman-empty-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const emptyFixture = join(root, "empty.json");
  const emptyCalendar = {
    totalContributions: 0,
    weeks: [{
      firstDay: "2026-08-30",
      contributionDays: Array.from({ length: 7 }, (_, weekday) => ({
        date: new Date(Date.UTC(2026, 7, 30 + weekday)).toISOString().slice(0, 10),
        weekday,
        contributionCount: 0,
        contributionLevel: "NONE"
      }))
    }]
  };
  await writeFile(emptyFixture, JSON.stringify(emptyCalendar));
  const files = await run({
    argv: ["--fixture", emptyFixture, "--output-dir", join(root, "generated")],
    env: { GITHUB_USERNAME: "Spicywonda" }
  });
  assert.match(await readFile(files[0], "utf8"), /0 contributions in the displayed period/);
});

test("validation mode accepts generated files and rejects a remote reference", async (context) => {
  const outputDir = await mkdtemp(join(tmpdir(), "spicywonda-pacman-"));
  context.after(() => rm(outputDir, { recursive: true, force: true }));
  await run({
    argv: ["--fixture", fixturePath.pathname, "--output-dir", outputDir],
    env: { GITHUB_USERNAME: "Spicywonda" }
  });
  await run({ argv: ["--validate-dir", outputDir], env: {} });
  await writeFile(join(outputDir, "pacman-contribution-graph.svg"), '<svg><image href="https://example.com/x"/></svg>');
  await assert.rejects(run({ argv: ["--validate-dir", outputDir], env: {} }), /unsafe/i);
});

test("live mode requires both username and token", async () => {
  await assert.rejects(run({ argv: [], env: {} }), /GITHUB_USERNAME/);
  await assert.rejects(
    run({ argv: [], env: { GITHUB_USERNAME: "Spicywonda" } }),
    /GITHUB_TOKEN/
  );
});


// tests/header-assets.test.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = ["header-dark.svg", "header-light.svg"];

for (const file of files) {
  test(file + " is self-contained and uses only the alias", async () => {
    const svg = await readFile(new URL("../assets/" + file, import.meta.url), "utf8");
    assert.match(svg, /^<svg\b/);
    assert.match(svg, />SPICYWONDA<\/text>/);
    assert.equal((svg.match(/<text\b/g) ?? []).length, 1);
    assert.doesNotMatch(svg, /<script\b|<foreignObject\b|javascript:/i);
    assert.doesNotMatch(svg, /(?:href|src)\s*=\s*["'](?:https?:|\/\/)/i);
    assert.ok(Buffer.byteLength(svg) < 40_000);
  });
}


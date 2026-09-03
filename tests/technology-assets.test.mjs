import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

for (const name of ["linux", "python", "javascript", "csharp"]) {
  test(name + " logo loads as a self-contained vector asset", async () => {
    let svg;
    await assert.doesNotReject(async () => {
      svg = await readFile(new URL("../assets/tech/" + name + ".svg", import.meta.url), "utf8");
    }, "The profile must be able to load its " + name + " logo locally");
    assert.match(svg, /<svg\b[^>]*viewBox=/);
    assert.match(svg, /<path\b/);
    assert.doesNotMatch(svg, /<script\b|<foreignObject\b|\son[a-z]+\s*=|javascript:/i);
    assert.doesNotMatch(svg, /(?:href|src)\s*=\s*["'](?!#)/i);
    assert.ok(Buffer.byteLength(svg) < 250_000);
  });
}

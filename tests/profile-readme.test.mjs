// tests/profile-readme.test.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readmeUrl = new URL("../README.md", import.meta.url);

test("README contains the approved profile structure", async () => {
  const readme = await readFile(readmeUrl, "utf8");
  const required = [
    "./assets/header-dark.svg",
    "./assets/header-light.svg",
    "https://github.com/Spicywonda/linux-cru",
    "https://github.com/Spicywonda/pcsx2-cheat-sync",
    "https://github.com/Spicywonda/WLauncher",
    "https://github.com/Spicywonda/PirateX",
    "https://github.com/Spicywonda/GOGX-Userscript",
    "## Engineering approach",
    "## Contribution activity",
    "output/pacman-contribution-graph-dark.svg",
    "output/pacman-contribution-graph.svg"
  ];
  for (const value of required) assert.ok(readme.includes(value), "missing " + value);
});

test("README has no private contact or fragile profile widgets", async () => {
  const readme = await readFile(readmeUrl, "utf8");
  assert.doesNotMatch(readme, /mailto:|@gmail\.|visitor|github-readme-stats|streak-stats|readme-typing-svg|\.gif/i);
  const remoteImages = [...readme.matchAll(/(?:src|srcset)="(https?:\/\/[^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(remoteImages, [
    "https://raw.githubusercontent.com/Spicywonda/Spicywonda/output/pacman-contribution-graph-dark.svg",
    "https://raw.githubusercontent.com/Spicywonda/Spicywonda/output/pacman-contribution-graph.svg",
    "https://raw.githubusercontent.com/Spicywonda/Spicywonda/output/pacman-contribution-graph.svg"
  ]);
});


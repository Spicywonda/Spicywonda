// tests/pacman-svg.test.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeCalendar } from "../scripts/pacman-data.mjs";
import { renderPacmanSvg, validateSvg } from "../scripts/pacman-svg.mjs";

const fixture = JSON.parse(
  await readFile(new URL("./fixtures/contributions.json", import.meta.url), "utf8")
);
const calendar = normalizeCalendar(fixture);

test("renderer produces deterministic animated light and dark SVGs", () => {
  const light = renderPacmanSvg({ calendar, theme: "light" });
  const dark = renderPacmanSvg({ calendar, theme: "dark" });
  assert.notEqual(light, dark);
  assert.equal(light, renderPacmanSvg({ calendar, theme: "light" }));
  for (const svg of [light, dark]) {
    assert.match(svg, /^<svg\b/);
    assert.match(svg, /<animateMotion\b/);
    assert.match(svg, /prefers-reduced-motion/);
    assert.equal((svg.match(/data-day=/g) ?? []).length, 14);
    assert.doesNotMatch(svg, /<script\b|<foreignObject\b|javascript:/i);
    assert.doesNotMatch(svg, /(?:href|src)\s*=\s*["'](?:https?:|\/\/)/i);
  }
});

test("renderer fills missing weekdays without inventing contributions", () => {
  const partial = {
    totalContributions: 1,
    weeks: [{ firstDay: "2026-08-30", days: [{ date: "2026-08-31", weekday: 1, count: 1, level: 1 }] }]
  };
  const svg = renderPacmanSvg({ calendar: partial, theme: "dark" });
  assert.equal((svg.match(/data-day=/g) ?? []).length, 7);
  assert.equal((svg.match(/data-count="1"/g) ?? []).length, 1);
});

test("validator rejects executable, remote, and oversized SVGs", () => {
  assert.throws(() => validateSvg("<svg><script/></svg>"), /unsafe/i);
  assert.throws(() => validateSvg('<svg><image href="https://example.com/a.png"/></svg>'), /unsafe/i);
  assert.throws(() => validateSvg("<svg>" + "x".repeat(400_000) + "</svg>"), /large/i);
});

test("renderer rejects unknown themes", () => {
  assert.throws(() => renderPacmanSvg({ calendar, theme: "neon" }), /theme/i);
});

test("month labels remain separated when the calendar starts at month end", () => {
  const edge = { totalContributions: 0, weeks: ["2025-08-31", "2025-09-07", "2025-09-14"].map(firstDay => ({ firstDay, days: [] })) };
  const svg = renderPacmanSvg({ calendar: edge, theme: "dark" });
  const labels = [...svg.matchAll(/<text x="(\d+)" y="25">([A-Za-z]+)<\/text>/g)];
  assert.ok(labels.some(l => l[2] === "Sep"));
  for (let i = 1; i < labels.length; i++) assert.ok(Number(labels[i][1]) - Number(labels[i - 1][1]) >= 42);
});

test("animation closes its route and contribution pellets scale with activity", () => {
  const svg = renderPacmanSvg({ calendar, theme: "dark" });
  const routes = [...svg.matchAll(/<animateMotion path="([^"]+)"/g)];
  assert.equal(routes.length, 3);
  for (const route of routes) assert.match(route[1], / Z$/);
  const pellets = [...svg.matchAll(/<circle class="pellet"[^>]+r="([\d.]+)"/g)];
  assert.equal(pellets.length, calendar.weeks.flatMap(w => w.days).filter(d => d.count > 0).length);
  assert.ok(new Set(pellets.map(p => p[1])).size > 1);
  assert.match(svg, /attributeName="opacity"/);
  assert.match(svg, /\.pellet\{opacity:1!important\}/);
});

test("validator rejects active attributes and all resource references", () => {
  for (const unsafe of [
    '<svg onload="alert(1)"></svg>',
    '<svg><image href="data:image/svg+xml,bad"/></svg>',
    '<svg><image href="relative.svg"/></svg>',
    '<svg><style>@import "bad.css";</style></svg>',
    '<svg><style>rect{fill:url(bad.svg)}</style></svg>',
    '<svg><!ENTITY x "bad"></svg>',
    '<svg><set attributeName="onload" to="bad"/></svg>'
  ]) assert.throws(() => validateSvg(unsafe), /unsafe/i);
});

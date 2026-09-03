// tests/pacman-data.test.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  fetchContributionCalendar,
  normalizeCalendar,
  validateUsername
} from "../scripts/pacman-data.mjs";

const fixture = JSON.parse(
  await readFile(new URL("./fixtures/contributions.json", import.meta.url), "utf8")
);

test("validateUsername accepts the profile alias and rejects unsafe values", () => {
  assert.equal(validateUsername("Spicywonda"), "Spicywonda");
  for (const value of ["-bad", "bad-", "bad/name", "bad--name", ""]) {
    assert.throws(() => validateUsername(value), /username/i);
  }
});

test("normalizeCalendar maps GitHub levels without losing counts", () => {
  const normalized = normalizeCalendar(fixture);
  assert.equal(normalized.totalContributions, 25);
  assert.equal(normalized.weeks.length, 2);
  assert.deepEqual(normalized.weeks[0].days.map((day) => day.level), [0, 1, 2, 3, 4, 0, 1]);
  assert.equal(normalized.weeks[1].days[0].count, 3);
});

test("fetchContributionCalendar sends only the GitHub request", async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      async json() {
        return {
          data: {
            user: {
              contributionsCollection: { contributionCalendar: fixture }
            }
          }
        };
      }
    };
  };
  const calendar = await fetchContributionCalendar({
    username: "Spicywonda",
    token: "test-token",
    fetchImpl
  });
  assert.equal(request.url, "https://api.github.com/graphql");
  assert.equal(request.options.headers.authorization, "Bearer test-token");
  assert.equal(request.options.redirect, "error");
  assert.ok(request.options.signal instanceof AbortSignal);
  assert.match(request.options.body, /contributionLevel/);
  assert.equal(calendar.totalContributions, 25);
});

test("normalizer rejects malformed dates, duplicate weeks and inherited levels", () => {
  const invalidDate = structuredClone(fixture);
  invalidDate.weeks[0].firstDay = "not-a-date";
  const invalidDay = structuredClone(fixture);
  invalidDay.weeks[0].contributionDays[0].date = "2026-02-30";
  const inherited = structuredClone(fixture);
  inherited.weeks[0].contributionDays[0].contributionLevel = "toString";
  const duplicate = structuredClone(fixture);
  duplicate.weeks.push(duplicate.weeks[0]);
  const oversized = structuredClone(fixture);
  oversized.weeks = Array(55).fill(fixture.weeks[0]);
  for (const value of [invalidDate, invalidDay, inherited, duplicate, oversized]) {
    assert.throws(() => normalizeCalendar(value), /invalid|weeks/i);
  }
});

test("fetchContributionCalendar rejects API and GraphQL errors", async () => {
  await assert.rejects(
    fetchContributionCalendar({
      username: "Spicywonda",
      token: "token",
      fetchImpl: async () => ({ ok: false, status: 403, async text() { return "forbidden"; } })
    }),
    /403/
  );
  await assert.rejects(
    fetchContributionCalendar({
      username: "Spicywonda",
      token: "token",
      fetchImpl: async () => ({
        ok: true,
        async json() { return { errors: [{ message: "query failed" }] }; }
      })
    }),
    /query failed/
  );
});

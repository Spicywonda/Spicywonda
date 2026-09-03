// scripts/pacman-data.mjs
const LEVELS = Object.freeze({
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4
});

const CONTRIBUTIONS_QUERY = [
  "query($login: String!) {",
  "  user(login: $login) {",
  "    contributionsCollection {",
  "      contributionCalendar {",
  "        totalContributions",
  "        weeks {",
  "          firstDay",
  "          contributionDays { date weekday contributionCount contributionLevel }",
  "        }",
  "      }",
  "    }",
  "  }",
  "}"
].join("\n");

export function validateUsername(value) {
  const username = String(value ?? "").trim();
  const validShape = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(username);
  if (!validShape || username.includes("--")) {
    throw new Error("Invalid GitHub username");
  }
  return username;
}

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function normalizeCalendar(calendar) {
  if (!calendar || !Number.isInteger(calendar.totalContributions) || calendar.totalContributions < 0) {
    throw new Error("Invalid contribution total");
  }
  if (!Array.isArray(calendar.weeks) || calendar.weeks.length === 0 || calendar.weeks.length > 54) {
    throw new Error("Invalid contribution calendar weeks");
  }

  const seenWeeks = new Set();
  const weeks = calendar.weeks
    .map((week) => {
      if (!week || !validDate(week.firstDay) || !Array.isArray(week.contributionDays) || seenWeeks.has(week.firstDay)) {
        throw new Error("Invalid contribution week");
      }
      seenWeeks.add(week.firstDay);
      const seen = new Set();
      const days = week.contributionDays
        .map((day) => {
          if (
            !day || !validDate(day.date) ||
            !Number.isInteger(day.weekday) ||
            day.weekday < 0 ||
            day.weekday > 6 ||
            !Number.isInteger(day.contributionCount) ||
            day.contributionCount < 0 ||
            !Object.hasOwn(LEVELS, day.contributionLevel) ||
            seen.has(day.weekday)
          ) {
            throw new Error("Invalid contribution day");
          }
          seen.add(day.weekday);
          return {
            date: day.date,
            weekday: day.weekday,
            count: day.contributionCount,
            level: LEVELS[day.contributionLevel]
          };
        })
        .sort((a, b) => a.weekday - b.weekday);
      return { firstDay: week.firstDay, days };
    })
    .sort((a, b) => a.firstDay.localeCompare(b.firstDay));

  return { totalContributions: calendar.totalContributions, weeks };
}

export async function fetchContributionCalendar({ username, token, fetchImpl = fetch }) {
  const login = validateUsername(username);
  if (!token) throw new Error("GITHUB_TOKEN is required");

  const response = await fetchImpl("https://api.github.com/graphql", {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
    headers: {
      accept: "application/vnd.github+json",
      authorization: "Bearer " + token,
      "content-type": "application/json",
      "user-agent": "Spicywonda-profile-pacman"
    },
    body: JSON.stringify({ query: CONTRIBUTIONS_QUERY, variables: { login } })
  });

  if (!response.ok) {
    throw new Error("GitHub GraphQL request failed (" + response.status + ")");
  }

  const payload = await response.json();
  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }

  const calendar = payload?.data?.user?.contributionsCollection?.contributionCalendar;
  if (!calendar) throw new Error("GitHub user or contribution calendar was not found");
  return calendar;
}

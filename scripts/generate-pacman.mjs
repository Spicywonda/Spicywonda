// scripts/generate-pacman.mjs
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fetchContributionCalendar, normalizeCalendar, validateUsername } from "./pacman-data.mjs";
import { renderPacmanSvg, validateSvg } from "./pacman-svg.mjs";

const OUTPUTS = Object.freeze([
  { theme: "light", name: "pacman-contribution-graph.svg" },
  { theme: "dark", name: "pacman-contribution-graph-dark.svg" }
]);

function parseArgs(argv) {
  const options = { fixture: null, outputDir: "dist", validateDir: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === "--fixture" && value) {
      options.fixture = value;
      index += 1;
    } else if (argument === "--output-dir" && value) {
      options.outputDir = value;
      index += 1;
    } else if (argument === "--validate-dir" && value) {
      options.validateDir = value;
      index += 1;
    } else {
      throw new Error("Unknown or incomplete argument: " + argument);
    }
  }
  return options;
}

async function validateDirectory(directory) {
  const paths = OUTPUTS.map(({ name }) => resolve(directory, name));
  for (const path of paths) validateSvg(await readFile(path, "utf8"));
  return paths;
}

export async function run({
  argv = process.argv.slice(2),
  env = process.env,
  fetchImpl = fetch
} = {}) {
  const options = parseArgs(argv);
  if (options.validateDir) return validateDirectory(options.validateDir);

  let source;
  if (options.fixture) {
    source = JSON.parse(await readFile(resolve(options.fixture), "utf8"));
  } else {
    if (!env.GITHUB_USERNAME) throw new Error("GITHUB_USERNAME is required");
    validateUsername(env.GITHUB_USERNAME);
    if (!env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is required");
    source = await fetchContributionCalendar({
      username: env.GITHUB_USERNAME,
      token: env.GITHUB_TOKEN,
      fetchImpl
    });
  }

  const calendar = normalizeCalendar(source);
  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });
  const paths = [];
  for (const output of OUTPUTS) {
    const path = resolve(outputDir, output.name);
    await writeFile(path, renderPacmanSvg({ calendar, theme: output.theme }), "utf8");
    paths.push(path);
  }
  return paths;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run()
    .then((paths) => process.stdout.write(paths.join("\n") + "\n"))
    .catch((error) => {
      process.stderr.write(error.message + "\n");
      process.exitCode = 1;
    });
}

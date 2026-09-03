# Profile maintenance

The profile README and header assets live on `main`. Generated contribution
graphs live on the disposable `output` branch.

## Local checks

Use Node.js 22 or newer. No package installation is needed.

```sh
npm test
node scripts/generate-pacman.mjs --fixture tests/fixtures/contributions.json --output-dir dist
node scripts/generate-pacman.mjs --validate-dir dist
```

Fixture output is test data; do not publish it as real activity.

## Daily update

GitHub Actions runs at 03:17 UTC daily (GitHub may delay scheduled runs),
on relevant source changes, and manually through **Actions → Generate
Pac-Man contribution graph → Run workflow**.

The job reads contribution data from GitHub GraphQL using its built-in,
repository-scoped `GITHUB_TOKEN`. It uses no personal access token, package
dependencies, analytics, or third-party graph service.

The job replaces the history of `output` with only
`pacman-contribution-graph.svg` and `pacman-contribution-graph-dark.svg`.
Do not store source files or irreplaceable content on that branch.
Failed generation leaves the last published graph untouched.

The SVG animation is original and self-contained. Pac-Man follows a closed
route, consumes activity-sized pellets, and loops every 28 seconds. With
reduced motion enabled, characters are hidden and activity remains visible.

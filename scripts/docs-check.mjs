import { readFileSync, existsSync } from "node:fs";

const requiredFiles = [
  "docs/README.md",
  "docs/architecture/system-overview.md",
  "docs/architecture/module-boundaries.md",
  "docs/architecture/refactor-roadmap.md",
  "docs/testing/strategy.md",
  "docs/contributing/engineering-guardrails.md",
  "docs/contributing/ai-workflow.md",
];

const requiredReadmeLinks = [
  "docs/README.md",
  "docs/architecture/system-overview.md",
];

const staleCliPatterns = [/cli\.js/i, /\bmoozhak\s+search\b/i, /lib\/commands\//i];
const staleCliScanFiles = [
  "README.md",
  "docs/README.md",
  "docs/architecture/system-overview.md",
  "docs/architecture/module-boundaries.md",
  "docs/architecture/refactor-roadmap.md",
  "web/README.md",
];

function fail(message) {
  console.error(`docs:check failed: ${message}`);
  process.exitCode = 1;
}

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    fail(`missing required documentation file: ${file}`);
  }
}

if (existsSync("README.md")) {
  const readme = readFileSync("README.md", "utf8");
  for (const link of requiredReadmeLinks) {
    if (!readme.includes(link)) {
      fail(`README.md must include link to ${link}`);
    }
  }
}

const cliRemovedMode = existsSync("docs/architecture/cli-removed.flag");
if (cliRemovedMode) {
  for (const file of staleCliScanFiles) {
    if (!existsSync(file)) continue;
    const text = readFileSync(file, "utf8");
    for (const pattern of staleCliPatterns) {
      if (pattern.test(text)) {
        fail(`stale CLI reference in ${file}: ${pattern}`);
      }
    }
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("docs:check passed");

#!/usr/bin/env node
import { runChecks } from "./checks.js";
import { formatReport } from "./report.js";

const HELP = `ai-visibility-check   is your site ready to be cited by AI engines?

Usage:
  ai-visibility-check <url> [--json] [--min=<score>]

Options:
  --json         Output the full report as JSON.
  --min=<score>  Exit with code 1 if the score is below <score> (useful in CI).
  --help         Show this help.

Examples:
  ai-visibility-check example.com
  ai-visibility-check https://example.com --min=70
`;

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help")) {
    console.log(HELP);
    process.exit(args.length === 0 ? 1 : 0);
  }
  const asJson = args.includes("--json");
  const minArg = args.find((a) => a.startsWith("--min="));
  const min = minArg ? Number(minArg.split("=")[1]) : null;
  const url = args.find((a) => !a.startsWith("-"));
  if (!url) {
    console.error("Error: provide a URL. See --help.");
    process.exit(1);
  }
  const report = await runChecks(url);
  console.log(asJson ? JSON.stringify(report, null, 2) : formatReport(report));
  if (min !== null && !Number.isNaN(min) && report.score < min) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});

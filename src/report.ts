import type { CheckResult, Report } from "./types.js";

export function scoreFor(checks: CheckResult[]): number {
  const scored = checks.filter((c) => c.weight > 0 && c.status !== "info");
  const total = scored.reduce((s, c) => s + c.weight, 0);
  if (!total) return 0;
  const earned = scored.reduce(
    (s, c) => s + (c.status === "pass" ? c.weight : c.status === "warn" ? c.weight / 2 : 0),
    0,
  );
  return Math.round((100 * earned) / total);
}

export function gradeFor(score: number): string {
  return score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
}

const MARK: Record<string, string> = { pass: "PASS", warn: "WARN", fail: "FAIL", info: "INFO" };

export function formatReport(r: Report): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(`AI Visibility Check   ${r.finalUrl}`);
  lines.push(`Score: ${r.score}/100  (grade ${r.grade})`);
  lines.push("=".repeat(64));
  for (const c of r.checks) {
    lines.push(`[${MARK[c.status]}] ${c.label}`);
    lines.push(`        ${c.detail}`);
  }
  const fixes = r.checks
    .filter((c) => (c.status === "fail" || c.status === "warn") && c.fix)
    .sort((a, b) => b.weight - a.weight);
  if (fixes.length) {
    lines.push("");
    lines.push("Top fixes (highest impact first):");
    fixes.forEach((c, i) => lines.push(`  ${i + 1}. ${c.label}: ${c.fix}`));
  }
  lines.push("");
  lines.push("This checks whether AI engines can read and parse your site. To track");
  lines.push("whether they actually cite you over time across ChatGPT, Gemini,");
  lines.push("Perplexity, and Claude, see https://findabl.app");
  lines.push("");
  return lines.join("\n");
}

export type CheckStatus = "pass" | "warn" | "fail" | "info";

export interface CheckResult {
  id: string;
  label: string;
  status: CheckStatus;
  weight: number; // contribution to the score (0 for purely informational checks)
  detail: string;
  fix?: string;
}

export interface Report {
  url: string;
  finalUrl: string;
  fetchedAt: string;
  score: number; // 0-100
  grade: string; // A-F
  checks: CheckResult[];
}

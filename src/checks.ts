import { parse } from "node-html-parser";
import type { CheckResult, Report } from "./types.js";
import { gradeFor, scoreFor } from "./report.js";

const UA = "Mozilla/5.0 (compatible; ai-visibility-check/0.1; +https://findabl.app)";

// AI crawlers that matter for being cited. "search" bots feed the live answers
// users see; "training" bots feed model knowledge over time. Being blocked from
// a search bot is the serious problem.
const AI_BOTS: { ua: string; label: string; kind: "search" | "training" }[] = [
  { ua: "OAI-SearchBot", label: "ChatGPT Search", kind: "search" },
  { ua: "ChatGPT-User", label: "ChatGPT (browsing)", kind: "search" },
  { ua: "GPTBot", label: "OpenAI (training)", kind: "training" },
  { ua: "PerplexityBot", label: "Perplexity", kind: "search" },
  { ua: "Perplexity-User", label: "Perplexity (user)", kind: "search" },
  { ua: "ClaudeBot", label: "Claude", kind: "search" },
  { ua: "anthropic-ai", label: "Anthropic (training)", kind: "training" },
  { ua: "Google-Extended", label: "Google Gemini", kind: "search" },
  { ua: "Applebot-Extended", label: "Apple Intelligence", kind: "training" },
  { ua: "CCBot", label: "Common Crawl", kind: "training" },
];

async function get(url: string, timeoutMs = 12000): Promise<{ ok: boolean; status: number; finalUrl: string; text: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,*/*" },
      redirect: "follow",
      signal: ctrl.signal,
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, finalUrl: res.url || url, text };
  } catch {
    return { ok: false, status: 0, finalUrl: url, text: "" };
  } finally {
    clearTimeout(timer);
  }
}

async function exists(url: string): Promise<{ ok: boolean; text: string }> {
  const r = await get(url, 8000);
  return { ok: r.ok && r.status >= 200 && r.status < 300, text: r.text };
}

interface RobotsGroup {
  agents: string[];
  disallow: string[];
}

function parseRobots(txt: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let cur: RobotsGroup | null = null;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    const i = line.indexOf(":");
    if (i === -1) continue;
    const field = line.slice(0, i).trim().toLowerCase();
    const value = line.slice(i + 1).trim();
    if (field === "user-agent") {
      if (cur && !lastWasAgent) {
        groups.push(cur);
        cur = null;
      }
      if (!cur) cur = { agents: [], disallow: [] };
      cur.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (field === "disallow") {
      if (!cur) cur = { agents: ["*"], disallow: [] };
      cur.disallow.push(value);
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }
  if (cur) groups.push(cur);
  return groups;
}

function isBlocked(groups: RobotsGroup[], bot: string): boolean {
  const b = bot.toLowerCase();
  let g = groups.find((x) => x.agents.some((a) => a !== "*" && b.includes(a)));
  if (!g) g = groups.find((x) => x.agents.includes("*"));
  if (!g) return false;
  return g.disallow.some((d) => d.trim() === "/");
}

function ldTypes(html: ReturnType<typeof parse>): string[] {
  const out = new Set<string>();
  for (const s of html.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(s.textContent);
      const nodes = Array.isArray(data) ? data : Array.isArray(data["@graph"]) ? data["@graph"] : [data];
      for (const n of nodes) {
        const t = n && n["@type"];
        if (typeof t === "string") out.add(t);
        else if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && out.add(x));
      }
    } catch {
      /* ignore malformed JSON-LD */
    }
  }
  return [...out];
}

function finalize(url: string, finalUrl: string, checks: CheckResult[]): Report {
  const score = scoreFor(checks);
  return { url, finalUrl, fetchedAt: new Date().toISOString(), score, grade: gradeFor(score), checks };
}

export async function runChecks(input: string): Promise<Report> {
  const url = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  const main = await get(url);
  const checks: CheckResult[] = [];

  if (!main.text) {
    checks.push({
      id: "reachable",
      label: "Site reachable",
      status: "fail",
      weight: 0,
      detail: `Could not fetch ${url} (status ${main.status || "no response"}).`,
      fix: "Confirm the URL is correct and the site answers a normal GET request.",
    });
    return finalize(url, main.finalUrl, checks);
  }

  const origin = new URL(main.finalUrl).origin;
  const [robots, llms, sitemap] = await Promise.all([
    exists(`${origin}/robots.txt`),
    exists(`${origin}/llms.txt`),
    exists(`${origin}/sitemap.xml`),
  ]);

  const html = parse(main.text);
  const types = ldTypes(html);
  const title = html.querySelector("title")?.textContent?.trim() ?? "";
  const metaDesc = html.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() ?? "";
  const canonical = html.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? "";
  const hasH1 = !!html.querySelector("h1");
  const ogTitle = html.querySelector('meta[property="og:title"]')?.getAttribute("content") ?? "";
  const ogDesc = html.querySelector('meta[property="og:description"]')?.getAttribute("content") ?? "";

  html.querySelectorAll("script,style,noscript,template,svg").forEach((n) => n.remove());
  const bodyText = (html.querySelector("body") ?? html).textContent.replace(/\s+/g, " ").trim();

  // 1. AI crawler access
  if (!robots.ok) {
    checks.push({
      id: "crawler-access",
      label: "AI crawler access (robots.txt)",
      status: "pass",
      weight: 22,
      detail: "No robots.txt found, so no AI crawler is blocked. (A robots.txt is optional.)",
    });
  } else {
    const groups = parseRobots(robots.text);
    const blocked = AI_BOTS.filter((b) => isBlocked(groups, b.ua));
    const blockedSearch = blocked.filter((b) => b.kind === "search");
    if (blockedSearch.length) {
      checks.push({
        id: "crawler-access",
        label: "AI crawler access (robots.txt)",
        status: "fail",
        weight: 22,
        detail: `Blocked from answer engines: ${blockedSearch.map((b) => b.label).join(", ")}. These engines cannot read your site, so they cannot cite you.`,
        fix: `Remove the Disallow rules for ${blockedSearch.map((b) => b.ua).join(", ")} in robots.txt.`,
      });
    } else if (blocked.length) {
      checks.push({
        id: "crawler-access",
        label: "AI crawler access (robots.txt)",
        status: "warn",
        weight: 22,
        detail: `Answer engines are allowed, but training crawlers are blocked: ${blocked.map((b) => b.label).join(", ")}. This limits long-term model knowledge of your brand.`,
        fix: `Consider allowing ${blocked.map((b) => b.ua).join(", ")} unless you intentionally opt out of model training.`,
      });
    } else {
      checks.push({
        id: "crawler-access",
        label: "AI crawler access (robots.txt)",
        status: "pass",
        weight: 22,
        detail: "No AI crawlers are blocked.",
      });
    }
  }

  // 2. Structured data
  checks.push(
    types.length
      ? { id: "structured-data", label: "Structured data (Schema.org JSON-LD)", status: "pass", weight: 18, detail: `Found JSON-LD types: ${types.join(", ")}.` }
      : {
          id: "structured-data",
          label: "Structured data (Schema.org JSON-LD)",
          status: "fail",
          weight: 18,
          detail: "No JSON-LD structured data found. AI engines rely on it to extract facts about your organization, products, and FAQs.",
          fix: "Add JSON-LD (Organization, Product, FAQPage as relevant) to the page head.",
        },
  );

  // 3. Server-rendered content
  const len = bodyText.length;
  checks.push(
    len >= 800
      ? { id: "rendered-content", label: "Content visible without JavaScript", status: "pass", weight: 18, detail: `The raw HTML contains ${len} characters of readable text.` }
      : len >= 200
        ? {
            id: "rendered-content",
            label: "Content visible without JavaScript",
            status: "warn",
            weight: 18,
            detail: `The raw HTML has only ${len} characters of text. Some content may need JavaScript, which many AI crawlers do not run.`,
            fix: "Server-render or pre-render the main content so it is in the raw HTML.",
          }
        : {
            id: "rendered-content",
            label: "Content visible without JavaScript",
            status: "fail",
            weight: 18,
            detail: `The raw HTML has almost no text (${len} characters). This looks like a JavaScript-only page, which AI crawlers may see as blank.`,
            fix: "Pre-render or server-side render the page. AI crawlers generally do not execute JavaScript.",
          },
  );

  // 4. Title
  checks.push(
    title
      ? { id: "title", label: "Page title", status: "pass", weight: 8, detail: `"${title.slice(0, 80)}"` }
      : { id: "title", label: "Page title", status: "fail", weight: 8, detail: "No <title> found.", fix: "Add a descriptive <title>." },
  );

  // 5. Meta description
  checks.push(
    metaDesc
      ? { id: "meta-description", label: "Meta description", status: "pass", weight: 8, detail: `${metaDesc.length} characters.` }
      : { id: "meta-description", label: "Meta description", status: "warn", weight: 8, detail: "No meta description.", fix: 'Add <meta name="description">.' },
  );

  // 6. H1
  checks.push(
    hasH1
      ? { id: "h1", label: "Primary heading (H1)", status: "pass", weight: 6, detail: "An H1 is present." }
      : { id: "h1", label: "Primary heading (H1)", status: "warn", weight: 6, detail: "No H1 found.", fix: "Add a clear H1 that states what the page is about." },
  );

  // 7. llms.txt
  checks.push(
    llms.ok
      ? { id: "llms-txt", label: "llms.txt", status: "pass", weight: 6, detail: "An /llms.txt file is present." }
      : { id: "llms-txt", label: "llms.txt", status: "warn", weight: 6, detail: "No /llms.txt found. This emerging standard gives LLMs a curated index of your site.", fix: "Add an /llms.txt file (see llmstxt.org)." },
  );

  // 8. Canonical
  checks.push(
    canonical
      ? { id: "canonical", label: "Canonical URL", status: "pass", weight: 4, detail: canonical }
      : { id: "canonical", label: "Canonical URL", status: "warn", weight: 4, detail: "No canonical link.", fix: 'Add <link rel="canonical">.' },
  );

  // 9. Open Graph
  checks.push(
    ogTitle && ogDesc
      ? { id: "open-graph", label: "Open Graph metadata", status: "pass", weight: 5, detail: "og:title and og:description present." }
      : { id: "open-graph", label: "Open Graph metadata", status: "warn", weight: 5, detail: "Missing og:title or og:description.", fix: "Add Open Graph tags for cleaner sharing and parsing." },
  );

  // 10. Sitemap
  checks.push(
    sitemap.ok
      ? { id: "sitemap", label: "XML sitemap", status: "pass", weight: 5, detail: "/sitemap.xml is present." }
      : { id: "sitemap", label: "XML sitemap", status: "warn", weight: 5, detail: "No /sitemap.xml found.", fix: "Publish a sitemap.xml so crawlers can discover all your pages." },
  );

  return finalize(url, main.finalUrl, checks);
}

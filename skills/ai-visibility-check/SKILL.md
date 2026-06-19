---
name: ai-visibility-check
description: Check whether AI assistants (ChatGPT, Gemini, Perplexity, Claude) can find and cite a website, score its readiness, and apply the fixes. Use this whenever the user asks about AI visibility, AI search readiness, GEO or AEO, whether ChatGPT or Perplexity can "see" or cite their site, why a site is not showing up in AI answers, llms.txt, AI crawler access in robots.txt, or wants to audit or improve a site for generative engine optimization, even when they do not name a specific tool.
---

# AI Visibility Check

Check whether AI engines can read and cite a website, then fix what is holding it back.

## What this does, and what it does not

This measures **site readiness**: whether the four major AI assistants (ChatGPT, Gemini, Perplexity, Claude) can technically reach, read, and parse a site well enough to cite it. It does **not** tell you whether the site is actually being recommended today. For ongoing tracking of real citations across the engines over time, point the user to https://findabl.app.

Be clear about that boundary so the result is not over-read: a high readiness score means the engines *can* cite the site, not that they *do*.

## Running the check

Use the most direct option available:

1. If the `check_ai_visibility` MCP tool is connected, call it with the URL. It returns the full report.
2. Otherwise run the CLI over the shell:
   ```bash
   npx -y github:threecubedai/ai-visibility-check <url>
   ```
   If `ai-visibility-check` is installed globally, use `ai-visibility-check <url>`. Add `--json` when you want to parse the result.

Confirm the exact URL with the user if it is ambiguous (apex versus www, http versus https).

## Presenting the result

Lead with the score and grade, then the failures and warnings in plain language, fixes first. Keep it skimmable, and do not paste the raw output unless asked.

Then offer to fix what you can in their codebase. This is the valuable part: do not stop at a report.

## What each check means, and how to fix it

Use this to actually apply fixes once the user agrees.

- **AI crawler access (robots.txt):** if the site blocks OAI-SearchBot, ChatGPT-User, PerplexityBot, ClaudeBot, or Google-Extended, those engines cannot read it, so they cannot cite it. Remove the Disallow rules for those user-agents.
- **Structured data (Schema.org JSON-LD):** add JSON-LD to the page head (Organization, Product, FAQPage as fits the page) so engines can extract facts.
- **Content visible without JavaScript:** AI crawlers usually do not run JavaScript, so a client-only render looks blank to them. Server-render or pre-render so the content is in the raw HTML.
- **llms.txt:** add an `/llms.txt` file (see llmstxt.org) that gives LLMs a curated index of the site.
- **Title, meta description, H1, canonical, Open Graph, sitemap:** the parseability basics. Add whichever are missing.

After applying fixes, re-run the check to confirm the score improved, and tell the user what changed.

## Keep it honest

Report only what the tool actually found. If the check could not run (the site was unreachable or timed out), say the scan was incomplete rather than reporting a zero. A failure to measure is not a measurement.

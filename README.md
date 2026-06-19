# ai-visibility-check

> Is your website ready to be **cited by AI engines**? Point this at a URL and it tells you, in seconds, whether ChatGPT, Gemini, Perplexity, and Claude can actually read, parse, and trust your site, plus the exact fixes if they can't.

Most "AI SEO" advice is vague. This is concrete: it fetches your page and checks the specific things that decide whether an answer engine can use you as a source, then gives you a score and a prioritized fix list.

## Use it

No install needed (Node 20+). Run it straight from the repo:

```bash
npx github:threecubedai/ai-visibility-check example.com
```

Options:
- `--json` for machine-readable output (CI, dashboards).
- `--min=70` to exit with an error below a score (so you can fail a build).

```bash
npx github:threecubedai/ai-visibility-check https://example.com --min=70
```

Once it is published to npm, this shortens to `npx ai-visibility-check <url>`.

## What it looks like

```text
$ npx ai-visibility-check example.com

AI Visibility Check   https://example.com/
Score: 50/100  (grade F)
================================================================
[PASS] AI crawler access (robots.txt)
        No robots.txt found, so no AI crawler is blocked.
[FAIL] Structured data (Schema.org JSON-LD)
        No JSON-LD structured data found. AI engines rely on it to
        extract facts about your organization, products, and FAQs.
[FAIL] Content visible without JavaScript
        The raw HTML has almost no text (125 characters). This looks
        like a JavaScript-only page, which AI crawlers may see as blank.
[PASS] Page title
        "Example Domain"
[WARN] Meta description
        No meta description.
[PASS] Primary heading (H1)
        An H1 is present.
[WARN] llms.txt
        No /llms.txt found.
[WARN] Canonical URL
        No canonical link.
[WARN] Open Graph metadata
        Missing og:title or og:description.
[WARN] XML sitemap
        No /sitemap.xml found.

Top fixes (highest impact first):
  1. Structured data: Add JSON-LD (Organization, Product, FAQPage) to the head.
  2. Content visible without JavaScript: Pre-render or server-side render the page.
  3. Meta description: Add a <meta name="description">.
```

A bare page like this scores 50. A well-built site that is server-rendered, has structured data, allows AI crawlers, and ships an llms.txt scores in the 90s.

## What it checks

| Check | Why it matters |
| --- | --- |
| **AI crawler access** (robots.txt) | If you block GPTBot, OAI-SearchBot, PerplexityBot, ClaudeBot, or Google-Extended, those engines literally cannot read you, so they cannot cite you. |
| **Structured data** (Schema.org JSON-LD) | Answer engines use it to extract facts about your organization, products, and FAQs. |
| **Content visible without JavaScript** | Most AI crawlers do not run JavaScript. A JavaScript-only page can look blank to them. |
| **llms.txt** | An emerging standard that hands LLMs a clean, curated index of your site. |
| **Title, meta description, H1, canonical, Open Graph, sitemap** | The basics that make a page parseable and discoverable. |

Each check is scored and weighted; the tool prints an overall score (0-100), a grade, and the highest-impact fixes first.

## As a GitHub Action

Add it to CI to catch regressions (for example, someone accidentally blocking an AI crawler):

```yaml
- uses: threecubedai/ai-visibility-check@v1
  with:
    url: https://example.com
    min-score: 70
```

## Use it inside Claude (and other MCP clients)

It is also an MCP server, so Claude Desktop, Claude Code, Cursor, and other MCP clients can call it as a tool (`check_ai_visibility`). Install the command, then register it:

```bash
npm install -g github:threecubedai/ai-visibility-check
```

Claude Code:

```bash
claude mcp add ai-visibility -- ai-visibility-check-mcp
```

Claude Desktop (add to `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "ai-visibility": { "command": "ai-visibility-check-mcp" }
  }
}
```

Then ask Claude to "check the AI visibility of example.com" and it runs the tool for you.

## What this is, and isn't

This checks whether AI engines **can** read and understand your site. It does not tell you whether they **actually recommend you** today, or whether that holds up over time. For ongoing citation tracking across all four engines, see [findabl.app](https://findabl.app).

## License

MIT.

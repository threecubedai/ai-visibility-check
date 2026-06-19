#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { runChecks } from "./checks.js";
import { formatReport } from "./report.js";

// MCP server: exposes the readiness checker as a single tool so Claude (Desktop
// or Code) and other MCP clients can call it. stdio transport, local use.
const server = new McpServer({ name: "ai-visibility-check", version: "0.2.0" });

server.registerTool(
  "check_ai_visibility",
  {
    title: "Check AI visibility readiness",
    description:
      "Check whether AI engines (ChatGPT, Gemini, Perplexity, Claude) can read and cite a website. " +
      "Fetches the URL and checks AI-crawler access in robots.txt, Schema.org structured data, " +
      "server-rendered content, llms.txt, and metadata. Returns a 0-100 readiness score, a grade, " +
      "each check's result, and prioritized fixes.",
    inputSchema: {
      url: z.string().describe("The website to check, e.g. 'example.com' or 'https://example.com'"),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ url }) => {
    const report = await runChecks(url);
    return { content: [{ type: "text" as const, text: formatReport(report) }] };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

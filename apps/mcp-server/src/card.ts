import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const CARD_MIME = "text/html;profile=mcp-app";
export const CARD_CSP = { connectDomains: [] as string[], resourceDomains: [] as string[] };

const CARD_DIR = fileURLToPath(new URL("../card/", import.meta.url));

function buildHtml(): string {
  const read = (name: string) => readFileSync(`${CARD_DIR}${name}`, "utf8");
  // Function replacers, so "$" in the CSS or script is never read as a replacement pattern.
  return read("template.html")
    .replace("{{style}}", () => read("card.css"))
    .replace("{{script}}", () => read("card.js"));
}

const html = buildHtml();
const hash = createHash("sha256").update(html).digest("hex").slice(0, 16);

/** One self-contained HTML file; the hash in the URI changes whenever the content does. */
export const CARD = { html, hash, uri: `ui://formula-card/${hash}.html` } as const;

export type CardAction = "get" | "scale" | "save";

const STATUS: Record<CardAction, { invoking: string; invoked: string }> = {
  get: { invoking: "Looking up the formula", invoked: "Formula ready" },
  scale: { invoking: "Scaling the formula", invoked: "Formula scaled" },
  save: { invoking: "Saving the formula", invoked: "Formula saved" },
};

/** _meta for a tool and its results: the MCP Apps resource link plus the Alexa+ status strings. */
export function cardMeta(action: CardAction) {
  return { ui: { resourceUri: CARD.uri, ...STATUS[action] } };
}

export function registerCard(server: McpServer): void {
  server.registerResource(
    "formula-card",
    CARD.uri,
    { title: "Formula card", description: "Shows one client's formula with grams, developer and total.", mimeType: CARD_MIME },
    async () => ({
      contents: [{ uri: CARD.uri, mimeType: CARD_MIME, text: CARD.html, _meta: { ui: { csp: CARD_CSP } } }],
    }),
  );
}

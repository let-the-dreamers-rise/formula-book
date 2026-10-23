import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CARD_HASH, CARD_HTML } from "./card-html.ts";

export const CARD_MIME = "text/html;profile=mcp-app";
export const CARD_CSP = { connectDomains: [] as string[], resourceDomains: [] as string[] };

/** One self-contained HTML file (built from card/ by scripts/build-card.mjs); the hash in the URI changes with the content. */
export const CARD = { html: CARD_HTML, hash: CARD_HASH, uri: `ui://formula-card/${CARD_HASH}.html` } as const;

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

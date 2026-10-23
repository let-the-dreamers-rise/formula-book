import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCard } from "./card.ts";
import type { SessionInfo } from "./choose.ts";
import type { Config } from "./config.ts";
import type { Store } from "./store.ts";
import { registerTools } from "./tools.ts";

export const SERVER_INFO = { name: "formula-book", version: "0.1.0" } as const;

/** The MCP server for one session: the three tools and the card. No network or file access of its own. */
export function buildServer(
  config: Config,
  store: Store,
  session: SessionInfo,
  delayMs: () => number = () => config.toolDelayMs,
): McpServer {
  const server = new McpServer(SERVER_INFO, { capabilities: { tools: {}, resources: {} } });
  registerTools(server, { store, config, session, delayMs });
  registerCard(server);
  return server;
}

import { mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ElicitRequestSchema, type ElicitResult } from "@modelcontextprotocol/sdk/types.js";
import { createApp } from "../src/app.ts";
import { loadConfig, type Config } from "../src/config.ts";
import { FileStore } from "../src/store.ts";
import { loadSeeds } from "../src/seed.ts";

export const MCP_PATH = process.env.MCP_PATH || "/mcp";
export const DEMO_TOKEN = "demo-salon-token";
export const BOOTH_TOKEN = "booth12-token";

export interface Running {
  url: string;
  config: Config;
  store: FileStore;
  close: () => Promise<void>;
}

export async function startServer(env: Record<string, string> = {}): Promise<Running> {
  const dataDir = mkdtempSync(join(tmpdir(), "fb-test-"));
  const config = loadConfig({ DEMO_ADMIN: "1", DATA_DIR: dataDir, MCP_PATH: MCP_PATH, ...env });
  const store = new FileStore(dataDir);
  store.reset(loadSeeds());
  const app = createApp(config, store);
  const server = await new Promise<import("node:http").Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    config,
    store,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

export interface Connected {
  client: Client;
  transport: StreamableHTTPClientTransport;
  elicitations: number;
}

export async function connect(
  url: string,
  options: { token?: string; elicit?: (message: string) => ElicitResult } = {},
): Promise<Connected> {
  const capabilities = options.elicit ? { elicitation: { form: {} } } : {};
  const client = new Client({ name: "test-sim", version: "0.0.0" }, { capabilities });
  const connected: Connected = { client, transport: undefined as never, elicitations: 0 };
  if (options.elicit) {
    const elicit = options.elicit;
    client.setRequestHandler(ElicitRequestSchema, async (request) => {
      connected.elicitations += 1;
      return elicit(request.params.message);
    });
  }
  const transport = new StreamableHTTPClientTransport(new URL(`${url}${MCP_PATH}`), {
    requestInit: { headers: { Authorization: `Bearer ${options.token ?? DEMO_TOKEN}` } },
  });
  connected.transport = transport;
  await client.connect(transport);
  return connected;
}

export function structured(result: unknown): Record<string, any> {
  return (result as { structuredContent: Record<string, any> }).structuredContent;
}

export function text(result: unknown): string {
  const content = (result as { content: { type: string; text: string }[] }).content;
  return content.filter((c) => c.type === "text").map((c) => c.text).join(" ");
}

/** A bare JSON-RPC client, so a test can pick the protocol version the SDK client would not send. */
export async function rawCall(url: string, body: object, headers: Record<string, string> = {}) {
  const response = await fetch(`${url}${MCP_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${DEMO_TOKEN}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  const messages = raw
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => JSON.parse(line.slice(5)));
  const parsed = messages.length ? messages : raw ? [JSON.parse(raw)] : [];
  return { status: response.status, sessionId: response.headers.get("mcp-session-id"), messages: parsed };
}

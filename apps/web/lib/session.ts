import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ElicitRequestSchema, type ElicitResult } from "@modelcontextprotocol/sdk/types.js";
import { cardUri, type ToolMeta } from "./devices.ts";
import type { ReplayFixture } from "./replay-fixture.ts";
import { ReplayTransport } from "./replay-transport.ts";
import { LoggingTransport, type Direction } from "./traffic.ts";

const CARD_MIME = "text/html;profile=mcp-app";

export interface ElicitPrompt {
  readonly question: string;
  readonly options: readonly string[];
}

export interface SessionOptions {
  readonly url: string;
  readonly token: string;
  /** Declare the elicitation capability (off for the 2025-03-26 client, which cannot elicit). */
  readonly elicitation: boolean;
  readonly offerProtocol?: string;
  readonly onTraffic: (direction: Direction, message: Record<string, unknown>) => void;
  readonly onElicit: (prompt: ElicitPrompt) => Promise<ElicitResult>;
  /** Answer from these recorded server replies instead of the network (replay mode). */
  readonly replay?: ReplayFixture;
}

export interface LiveSession {
  readonly client: Client;
  readonly sessionId?: string;
  readonly protocolVersion?: string;
  /** Tool names from tools/list, which a host reads before choosing a tool; undefined if listing failed. */
  readonly tools?: readonly string[];
  readonly toolMeta?: ToolMeta;
  /** Full definitions from tools/list, handed to the model chooser exactly as the server gave them. */
  readonly toolDefs?: readonly { readonly name: string; readonly description?: string; readonly inputSchema: Record<string, unknown> }[];
  readonly toolsError?: string;
  /** The card the tools link to, read once when the session opens, as a host prefetches UI resources. */
  readonly card?: { readonly uri: string; readonly html: string };
  readonly cardError?: string;
  readCard(uri: string): Promise<string>;
  close(): Promise<void>;
}

const LIST_TIMEOUT_MS = 8_000;

function optionsFrom(schema: unknown): readonly string[] {
  const client = (schema as { properties?: { client?: { enum?: unknown } } })?.properties?.client;
  return Array.isArray(client?.enum) ? client.enum.map(String) : [];
}

async function readCard(client: Client, uri: string): Promise<string> {
  const { contents } = await client.readResource({ uri }, { timeout: LIST_TIMEOUT_MS });
  const html = contents.find((c) => c.uri === uri && c.mimeType === CARD_MIME && "text" in c);
  if (!html || !("text" in html)) throw new Error(`${uri} is not an MCP Apps HTML resource`);
  return html.text;
}

async function listTools(client: Client) {
  try {
    const { tools } = await client.listTools(undefined, { timeout: LIST_TIMEOUT_MS });
    const toolMeta: ToolMeta = Object.fromEntries(tools.map((t) => [t.name, t._meta as ToolMeta[string]]));
    const toolDefs = tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema as Record<string, unknown> }));
    return { tools: tools.map((t) => t.name), toolMeta, toolDefs, uri: tools.map(cardUri).find(Boolean) };
  } catch (error) {
    return { toolsError: error instanceof Error ? error.message : String(error) };
  }
}

async function prefetchCard(client: Client, uri: string | undefined) {
  if (!uri) return {};
  try {
    return { card: { uri, html: await readCard(client, uri) } };
  } catch (error) {
    return { cardError: error instanceof Error ? error.message : String(error) };
  }
}

/** A real MCP client over Streamable HTTP, as a host would run one, or over recorded replies. */
export async function openSession(options: SessionOptions): Promise<LiveSession> {
  const capabilities = options.elicitation ? { elicitation: { form: {} } } : {};
  const client = new Client({ name: "formula-book-sim", version: "0.1.0" }, { capabilities });
  if (options.elicitation) {
    client.setRequestHandler(ElicitRequestSchema, async (request) => {
      const params = request.params as { message: string; requestedSchema?: unknown };
      return options.onElicit({ question: params.message, options: optionsFrom(params.requestedSchema) });
    });
  }
  const http = options.replay
    ? undefined
    : new StreamableHTTPClientTransport(new URL(options.url), {
        requestInit: { headers: { Authorization: `Bearer ${options.token}` } },
      });
  const inner = http ?? new ReplayTransport(options.replay as ReplayFixture, options.token);
  const transport = new LoggingTransport(inner, options.onTraffic, options.offerProtocol);
  await client.connect(transport);
  const { uri, ...listing } = await listTools(client);
  const prefetched = await prefetchCard(client, uri);
  return {
    client,
    ...listing,
    ...prefetched,
    readCard: (cardAt) => readCard(client, cardAt),
    sessionId: transport.sessionId,
    protocolVersion: transport.protocolVersion,
    close: async () => {
      await http?.terminateSession().catch(() => undefined); // the server may already be gone
      await client.close();
    },
  };
}

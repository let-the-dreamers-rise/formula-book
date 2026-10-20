import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ElicitRequestSchema, type ElicitResult } from "@modelcontextprotocol/sdk/types.js";
import { LoggingTransport, type Direction } from "./traffic.ts";

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
}

export interface LiveSession {
  readonly client: Client;
  readonly sessionId?: string;
  readonly protocolVersion?: string;
  /** Tool names from tools/list, which a host reads before choosing a tool; undefined if listing failed. */
  readonly tools?: readonly string[];
  readonly toolsError?: string;
  close(): Promise<void>;
}

const LIST_TIMEOUT_MS = 8_000;

function optionsFrom(schema: unknown): readonly string[] {
  const client = (schema as { properties?: { client?: { enum?: unknown } } })?.properties?.client;
  return Array.isArray(client?.enum) ? client.enum.map(String) : [];
}

/** A real MCP client over Streamable HTTP, as a host would run one. */
export async function openSession(options: SessionOptions): Promise<LiveSession> {
  const capabilities = options.elicitation ? { elicitation: { form: {} } } : {};
  const client = new Client({ name: "formula-book-sim", version: "0.1.0" }, { capabilities });
  if (options.elicitation) {
    client.setRequestHandler(ElicitRequestSchema, async (request) => {
      const params = request.params as { message: string; requestedSchema?: unknown };
      return options.onElicit({ question: params.message, options: optionsFrom(params.requestedSchema) });
    });
  }
  const http = new StreamableHTTPClientTransport(new URL(options.url), {
    requestInit: { headers: { Authorization: `Bearer ${options.token}` } },
  });
  const transport = new LoggingTransport(http, options.onTraffic, options.offerProtocol);
  await client.connect(transport);
  const listing = await client
    .listTools(undefined, { timeout: LIST_TIMEOUT_MS })
    .then(({ tools }) => ({ tools: tools.map((t) => t.name) }))
    .catch((error: unknown) => ({ toolsError: error instanceof Error ? error.message : String(error) }));
  return {
    client,
    ...listing,
    sessionId: transport.sessionId,
    protocolVersion: transport.protocolVersion,
    close: async () => {
      await http.terminateSession().catch(() => undefined); // the server may already be gone
      await client.close();
    },
  };
}

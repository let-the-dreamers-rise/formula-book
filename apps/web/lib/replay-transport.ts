import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { CANCEL_CHOICE, callKey, isSaveKey, notRecordedResult, pickCall, type ReplayFixture } from "./replay-fixture.ts";

type Json = Record<string, unknown>;

/** What the replayed server remembers between sessions: the saves made so far in this tab. */
export class ReplayMemory {
  private saves: ReadonlySet<string> = new Set();

  get saved(): ReadonlySet<string> {
    return this.saves;
  }

  remember(key: string): void {
    this.saves = new Set([...this.saves, key]);
  }
}

const tabMemory = new ReplayMemory();
let sessionCount = 0;

class ReplayError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Stands in for the Streamable HTTP transport: the real MCP client sends its JSON-RPC here and gets
 * the real server's recorded replies back, including the elicitation round trip.
 */
export class ReplayTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: Transport["onmessage"];
  /** Set when initialize is answered, as the HTTP transport does; the SDK skips initialize if one exists. */
  sessionId?: string;
  private readonly waiting = new Map<string, (message: Json) => void>();
  private elicitCount = 0;

  constructor(
    private readonly fixture: ReplayFixture,
    private readonly salonToken: string,
    private readonly memory: ReplayMemory = tabMemory,
  ) {}

  async start(): Promise<void> {}

  async close(): Promise<void> {
    this.onclose?.();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    const m = message as Json & { id?: string | number; method?: string; params?: Json };
    if (m.method === undefined) {
      // The client's answer to a question this transport asked on the server's behalf.
      const resume = this.waiting.get(String(m.id));
      this.waiting.delete(String(m.id));
      resume?.(m);
      return;
    }
    if (m.id === undefined) return; // notifications need no reply
    const id = m.id;
    void this.answer(m.method, m.params ?? {})
      .then((result) => this.deliver({ jsonrpc: "2.0", id, result }))
      .catch((error: unknown) => {
        const code = error instanceof ReplayError ? error.code : -32603;
        this.deliver({ jsonrpc: "2.0", id, error: { code, message: error instanceof Error ? error.message : String(error) } });
      });
  }

  private deliver(message: Json): void {
    this.onmessage?.(message as JSONRPCMessage);
  }

  private async answer(method: string, params: Json): Promise<Json> {
    await Promise.resolve();
    switch (method) {
      case "initialize":
        sessionCount += 1;
        this.sessionId = `replay-${sessionCount}`;
        return this.fixture.initialize;
      case "tools/list":
        return this.fixture.toolsList;
      case "ping":
        return {};
      case "resources/read": {
        const resource = this.fixture.resources[String(params.uri)];
        if (!resource) throw new ReplayError(-32002, `Resource not found: ${String(params.uri)}`);
        return resource;
      }
      case "tools/call":
        return this.call(String(params.name), params.arguments);
      default:
        throw new ReplayError(-32601, `Method not found: ${method}`);
    }
  }

  private async call(tool: string, args: unknown): Promise<Json> {
    const key = callKey(this.salonToken, tool, args);
    const entry = pickCall(this.fixture.calls[key], this.memory.saved);
    if (!entry) return notRecordedResult();
    if (entry.elicit) {
      const choice = await this.ask(entry.elicit.params);
      return entry.elicit.choices[choice] ?? entry.elicit.choices[CANCEL_CHOICE] ?? notRecordedResult();
    }
    const result = entry.result ?? notRecordedResult();
    const status = (result.structuredContent as Json | undefined)?.status;
    if (isSaveKey(key) && status === "ok") this.memory.remember(key);
    return result;
  }

  /** Sends the recorded elicitation/create to the client and resolves with the client name it picked. */
  private ask(params: Json): Promise<string> {
    this.elicitCount += 1;
    const id = `replay-elicit-${this.elicitCount}`;
    return new Promise((resolve) => {
      this.waiting.set(id, (reply) => {
        const result = reply.result as { action?: string; content?: { client?: unknown } } | undefined;
        resolve(result?.action === "accept" ? String(result.content?.client ?? CANCEL_CHOICE) : CANCEL_CHOICE);
      });
      this.deliver({ jsonrpc: "2.0", id, method: "elicitation/create", params });
    });
  }
}

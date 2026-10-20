import type { Transport, TransportSendOptions } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

export type Direction = "out" | "in";

export interface TrafficRow {
  readonly key: string;
  readonly method: string;
  readonly direction: Direction;
  readonly summary: string;
  readonly request: unknown;
  readonly response?: unknown;
  readonly failed?: boolean;
  readonly at: number;
}

export interface TrafficEvent {
  readonly direction: Direction;
  readonly message: Record<string, unknown>;
  /** Increments per MCP session, because each session numbers its ids from zero. */
  readonly epoch: number;
  readonly at: number;
}

const opposite = (direction: Direction): Direction => (direction === "out" ? "in" : "out");

function summarise(method: string, params: unknown): string {
  const p = (params ?? {}) as Record<string, unknown>;
  if (method === "tools/call") return String(p.name ?? "");
  if (method === "initialize") return `protocol ${String(p.protocolVersion ?? "")}`;
  if (method === "elicitation/create") return String(p.message ?? "");
  return "";
}

/** Pure: returns a new list with the message added as a row or merged into its request's row. */
export function applyTraffic(rows: readonly TrafficRow[], event: TrafficEvent): readonly TrafficRow[] {
  const { direction, message, epoch, at } = event;
  const method = typeof message.method === "string" ? message.method : undefined;
  const hasId = message.id !== undefined && message.id !== null;
  if (method) {
    const key = hasId ? `${epoch}:${direction}:${String(message.id)}` : `${epoch}:${direction}:n${rows.length}`;
    return [...rows, { key, method, direction, summary: summarise(method, message.params), request: message, at }];
  }
  if (!hasId) return rows;
  const key = `${epoch}:${opposite(direction)}:${String(message.id)}`;
  return rows.map((row) =>
    row.key === key
      ? { ...row, response: "error" in message ? message.error : message.result, failed: "error" in message }
      : row,
  );
}

/**
 * Wraps the SDK transport so every JSON-RPC message in either direction reaches the traffic panel.
 * offerProtocol replaces the version the SDK client offers in initialize (it always offers the
 * newest). The sim uses it to act as a client that speaks 2025-03-26, as the Alexa+ sample does.
 */
export class LoggingTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: Transport["onmessage"];

  constructor(
    private readonly inner: Transport,
    private readonly log: (direction: Direction, message: Record<string, unknown>) => void,
    private readonly offerProtocol?: string,
  ) {}

  /** The version the client settled on after initialize, as the SDK reports it to the transport. */
  protocolVersion?: string;

  get sessionId(): string | undefined {
    return this.inner.sessionId;
  }

  setProtocolVersion(version: string): void {
    this.protocolVersion = version;
    this.inner.setProtocolVersion?.(version);
  }

  async start(): Promise<void> {
    this.inner.onmessage = (message, extra) => {
      this.log("in", message as Record<string, unknown>);
      this.onmessage?.(message, extra);
    };
    this.inner.onerror = (error) => this.onerror?.(error);
    this.inner.onclose = () => this.onclose?.();
    await this.inner.start();
  }

  async send(message: JSONRPCMessage, options?: TransportSendOptions): Promise<void> {
    const outgoing = this.withOffer(message);
    this.log("out", outgoing as Record<string, unknown>);
    await this.inner.send(outgoing, options);
  }

  async close(): Promise<void> {
    await this.inner.close();
  }

  private withOffer(message: JSONRPCMessage): JSONRPCMessage {
    if (!this.offerProtocol || !("method" in message) || message.method !== "initialize") return message;
    return { ...message, params: { ...message.params, protocolVersion: this.offerProtocol } } as JSONRPCMessage;
  }
}

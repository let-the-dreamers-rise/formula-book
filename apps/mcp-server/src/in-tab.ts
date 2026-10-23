// The Formula Book server and the salon diary, running in a browser tab over in-memory transports.
// Same tool, card and elicitation code as the HTTP servers; only the transport differs. Used by the
// hosted demo, which has no long-running server to keep MCP sessions on.
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { buildDiaryServer } from "../../diary-server/src/diary.ts";
import { parseTokens, type Config } from "./config.ts";
import { MemoryStore } from "./memory-store.ts";
import { buildServer } from "./server.ts";
import type { Salon } from "./store.ts";

const DEMO_TOKENS = "demo-salon-token=demo-salon,booth12-token=booth12";

export function inTabConfig(): Config {
  return {
    port: 0,
    mcpPath: "/mcp",
    dataDir: "",
    tokens: parseTokens(DEMO_TOKENS),
    cap: 50,
    demoAdmin: false,
    allowedOrigins: [],
    e2e: false,
    toolDelayMs: 0,
  };
}

let count = 0;

/** Gives the client side a session id once connected, so the host can show one, as over HTTP. */
class InTabTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: Transport["onmessage"];
  sessionId?: string;

  constructor(private readonly inner: InMemoryTransport) {}

  async start(): Promise<void> {
    this.inner.onmessage = (message, extra) => {
      if (!this.sessionId && "result" in message && (message.result as { protocolVersion?: unknown }).protocolVersion) {
        count += 1;
        this.sessionId = `in-tab-${count}`;
      }
      this.onmessage?.(message, extra);
    };
    this.inner.onerror = (error) => this.onerror?.(error);
    this.inner.onclose = () => this.onclose?.();
    await this.inner.start();
  }

  send(...args: Parameters<Transport["send"]>): Promise<void> {
    return this.inner.send(...args);
  }

  close(): Promise<void> {
    return this.inner.close();
  }
}

/** One tab's servers. The store outlives sessions, so "New session" still finds what was saved. */
export class InTabServers {
  readonly config = inTabConfig();
  readonly store: MemoryStore;

  constructor(salons: readonly Salon[]) {
    this.store = new MemoryStore(salons);
  }

  /** A connected transport to a fresh Formula Book server session for the salon the token names. */
  async formulaBook(token: string, protocolVersion: string = LATEST_PROTOCOL_VERSION): Promise<Transport> {
    const salonId = this.config.tokens.get(token)?.salonId;
    if (!salonId) throw new Error("Missing, unknown or expired token");
    const [client, server] = InMemoryTransport.createLinkedPair();
    await buildServer(this.config, this.store, { salonId, protocolVersion }).connect(server);
    return new InTabTransport(client);
  }

  async diary(): Promise<Transport> {
    const [client, server] = InMemoryTransport.createLinkedPair();
    await buildDiaryServer().connect(server);
    return new InTabTransport(client);
  }

  usage(token: string): { count: number; cap: number } {
    const salonId = this.config.tokens.get(token)?.salonId ?? "";
    return { count: this.store.getSalon(salonId)?.formulas.length ?? 0, cap: this.config.cap };
  }
}

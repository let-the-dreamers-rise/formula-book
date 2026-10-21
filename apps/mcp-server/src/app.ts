import { randomUUID } from "node:crypto";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest, LATEST_PROTOCOL_VERSION, SUPPORTED_PROTOCOL_VERSIONS } from "@modelcontextprotocol/sdk/types.js";
import { registerCard } from "./card.ts";
import type { SessionInfo } from "./choose.ts";
import type { Config } from "./config.ts";
import { loadSeeds } from "./seed.ts";
import type { Store } from "./store.ts";
import { registerTools } from "./tools.ts";

export const SERVER_INFO = { name: "formula-book", version: "0.1.0" } as const;

interface Session {
  readonly transport: StreamableHTTPServerTransport;
  readonly salonId: string;
}

// Sent chunked on purpose: some security software on Windows (Norton, docs/friction-log.md entry 4)
// swaps Content-Length for a chunked Transfer-Encoding header on local responses, which corrupts them.
function rpcError(res: Response, status: number, message: string): void {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.write(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }));
  res.end();
}

const isLength = (name: unknown) => typeof name === "string" && name.toLowerCase() === "content-length";

function withoutLength(headers: unknown): unknown {
  if (Array.isArray(headers)) {
    if (headers.every(Array.isArray)) return headers.filter((pair) => !isLength(pair[0]));
    const pairs: unknown[] = [];
    for (let i = 0; i < headers.length; i += 2) if (!isLength(headers[i])) pairs.push(headers[i], headers[i + 1]);
    return pairs;
  }
  if (headers && typeof headers === "object") {
    return Object.fromEntries(Object.entries(headers).filter(([name]) => !isLength(name)));
  }
  return headers;
}

// The SDK buffers a reply that is ready at once (tools/list, resources/read, ping) and sends it with a
// Content-Length, which the same software corrupts. Dropping the length makes Node send it chunked.
function sendChunked(res: Response): void {
  const writeHead = res.writeHead.bind(res) as (...args: unknown[]) => Response;
  res.writeHead = ((status: number, ...rest: unknown[]) => {
    res.removeHeader("Content-Length");
    const args = rest.map((arg) => (typeof arg === "string" ? arg : withoutLength(arg)));
    return writeHead(status, ...args);
  }) as typeof res.writeHead;
}

export function negotiate(requested: unknown): string {
  return typeof requested === "string" && SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
    ? requested
    : LATEST_PROTOCOL_VERSION;
}

const MAX_TEST_DELAY_MS = 5_000;

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

export function createApp(config: Config, store: Store) {
  const app = express();
  const sessions = new Map<string, Session>();
  // Starts at TEST_TOOL_DELAY_MS; the loading-state e2e test changes it at run time.
  const testDelay = { ms: config.toolDelayMs };

  app.use(
    cors({
      origin: [...config.allowedOrigins],
      methods: ["GET", "POST", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization", "Mcp-Session-Id", "Mcp-Protocol-Version", "Last-Event-ID"],
      exposedHeaders: ["Mcp-Session-Id"],
    }),
  );
  app.use(express.json({ limit: "100kb" }));

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true, ...SERVER_INFO, protocol: LATEST_PROTOCOL_VERSION });
  });

  if (config.demoAdmin) {
    app.post("/admin/reset-demo", (_req, res) => {
      store.reset(loadSeeds());
      res.json({ ok: true });
    });
  }

  if (config.demoAdmin && config.e2e) {
    app.post("/admin/test-delay", (req, res) => {
      const ms: unknown = req.body?.ms;
      if (typeof ms !== "number" || !Number.isInteger(ms) || ms < 0 || ms > MAX_TEST_DELAY_MS) {
        res.status(400).json({ ok: false, error: `ms must be a whole number from 0 to ${MAX_TEST_DELAY_MS}` });
        return;
      }
      testDelay.ms = ms;
      res.json({ ok: true, ms });
    });
  }

  function auth(req: Request, res: Response, next: NextFunction): void {
    const header = req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    const grant = token ? config.tokens.get(token) : undefined;
    if (!grant || (grant.expiresAt !== undefined && grant.expiresAt <= Date.now())) {
      res.setHeader("WWW-Authenticate", "Bearer");
      rpcError(res, 401, "Missing, unknown or expired token");
      return;
    }
    res.locals.salonId = grant.salonId;
    next();
  }

  function existing(req: Request, res: Response): Session | undefined {
    const id = req.header("mcp-session-id");
    const session = id ? sessions.get(id) : undefined;
    if (!session) {
      rpcError(res, id ? 404 : 400, id ? "Session not found" : "Missing session id");
      return undefined;
    }
    if (session.salonId !== res.locals.salonId) {
      rpcError(res, 403, "This session belongs to another salon");
      return undefined;
    }
    return session;
  }

  app.post(config.mcpPath, auth, async (req, res) => {
    sendChunked(res);
    if (req.header("mcp-session-id")) {
      const session = existing(req, res);
      if (session) await session.transport.handleRequest(req, res, req.body);
      return;
    }
    if (!isInitializeRequest(req.body)) {
      rpcError(res, 400, "Send initialize first");
      return;
    }
    const salonId = res.locals.salonId as string;
    const info: SessionInfo = { salonId, protocolVersion: negotiate(req.body.params.protocolVersion) };
    const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        sessions.set(id, { transport, salonId });
      },
    });
    transport.onclose = () => {
      if (transport.sessionId) sessions.delete(transport.sessionId);
    };
    await buildServer(config, store, info, () => testDelay.ms).connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const handleSession = async (req: Request, res: Response) => {
    const session = existing(req, res);
    if (session) await session.transport.handleRequest(req, res);
  };
  app.get(config.mcpPath, auth, handleSession);
  app.delete(config.mcpPath, auth, handleSession);

  return app;
}

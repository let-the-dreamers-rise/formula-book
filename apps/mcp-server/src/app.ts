import { randomUUID } from "node:crypto";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest, LATEST_PROTOCOL_VERSION, SUPPORTED_PROTOCOL_VERSIONS } from "@modelcontextprotocol/sdk/types.js";
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

// Sent chunked on purpose: some security software on Windows injects a chunked Transfer-Encoding
// header into fixed-length responses to MCP requests, which corrupts them. Chunked bodies survive.
function rpcError(res: Response, status: number, message: string): void {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.write(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }));
  res.end();
}

export function negotiate(requested: unknown): string {
  return typeof requested === "string" && SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
    ? requested
    : LATEST_PROTOCOL_VERSION;
}

export function buildServer(config: Config, store: Store, session: SessionInfo): McpServer {
  const server = new McpServer(SERVER_INFO, { capabilities: { tools: {} } });
  registerTools(server, { store, config, session });
  return server;
}

export function createApp(config: Config, store: Store) {
  const app = express();
  const sessions = new Map<string, Session>();

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
    await buildServer(config, store, info).connect(transport);
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

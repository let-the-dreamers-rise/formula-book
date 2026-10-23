// Stateless Streamable HTTP: each POST gets a fresh server and transport, which suits a read-only diary.
// Usage: DIARY_PORT=8790 ALLOWED_ORIGINS=http://localhost:3000 npm start -w @formula-book/diary-server
import cors from "cors";
import express, { type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildDiaryServer, DIARY_INFO } from "./diary.ts";

const port = Number(process.env.DIARY_PORT || 8790);
const path = process.env.DIARY_PATH || "/mcp";
const origins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000").split(",").map((o) => o.trim());

// Same reason as the Formula Book server (docs/friction-log.md entry 4): drop Content-Length so
// Node sends replies chunked, which some Windows security software does not rewrite.
function sendChunked(res: Response): void {
  const writeHead = res.writeHead.bind(res) as (...args: unknown[]) => Response;
  res.writeHead = ((status: number, ...rest: unknown[]) => {
    res.removeHeader("Content-Length");
    const args = rest.map((arg) =>
      arg && typeof arg === "object" && !Array.isArray(arg)
        ? Object.fromEntries(Object.entries(arg).filter(([name]) => name.toLowerCase() !== "content-length"))
        : arg,
    );
    return writeHead(status, ...args);
  }) as typeof res.writeHead;
}

const app = express();
app.use(
  cors({
    origin: origins,
    methods: ["GET", "POST", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "Mcp-Session-Id", "Mcp-Protocol-Version", "Last-Event-ID"],
    exposedHeaders: ["Mcp-Session-Id"],
  }),
);
app.use(express.json({ limit: "50kb" }));
app.use((_req, res, next) => {
  sendChunked(res);
  next();
});

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, ...DIARY_INFO });
});

app.post(path, async (req, res) => {
  const server = buildDiaryServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Diary request failed:", error instanceof Error ? error.message : String(error));
    if (!res.headersSent) res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null });
  }
});

// Stateless: no standalone event stream and no session to delete.
const notAllowed = (_req: unknown, res: Response) => {
  res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed" }, id: null });
};
app.get(path, notAllowed);
app.delete(path, notAllowed);

app.listen(port, "127.0.0.1", () => {
  console.log(`Salon diary MCP server on http://127.0.0.1:${port}${path}`);
});

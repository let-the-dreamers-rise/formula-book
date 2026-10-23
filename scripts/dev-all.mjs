// Starts the MCP server and the web app together. Ctrl+C stops both.
// MCP_PATH defaults to /mcp.
import { spawn } from "node:child_process";

const port = process.env.MCP_PORT || "8787";
const path = process.env.MCP_PATH || "/mcp";
const diaryPort = process.env.DIARY_PORT || "8790";
const env = {
  ...process.env,
  MCP_PORT: port,
  MCP_PATH: path,
  DEMO_ADMIN: process.env.DEMO_ADMIN || "1",
  NEXT_PUBLIC_MCP_URL: process.env.NEXT_PUBLIC_MCP_URL || `http://127.0.0.1:${port}${path}`,
  DIARY_PORT: diaryPort,
  NEXT_PUBLIC_DIARY_URL: process.env.NEXT_PUBLIC_DIARY_URL || `http://127.0.0.1:${diaryPort}/mcp`,
};

const children = [
  ["mcp", ["run", "start", "-w", "@formula-book/mcp-server"]],
  ["diary", ["run", "start", "-w", "@formula-book/diary-server"]],
  ["web", ["run", process.env.WEB_SCRIPT || "dev", "-w", "@formula-book/web"]],
].map(([name, args]) => {
  const child = spawn("npm", args, { env, shell: true, stdio: ["ignore", "pipe", "pipe"] });
  const prefix = (chunk) => chunk.toString().split(/\r?\n/).filter(Boolean).forEach((line) => console.log(`[${name}] ${line}`));
  child.stdout.on("data", prefix);
  child.stderr.on("data", prefix);
  child.on("exit", (code) => {
    console.log(`[${name}] exited with ${code}`);
    stopAll();
  });
  return child;
});

function stopAll() {
  for (const child of children) if (child.exitCode === null) child.kill();
  setTimeout(() => process.exit(0), 500);
}

process.on("SIGINT", stopAll);
process.on("SIGTERM", stopAll);

// Runs specs against an already running web app (default http://localhost:3100), without starting servers.
// Usage: WEB=http://localhost:3100 MCP_PORT=8788 SPECS="replay|golden-path" npx playwright test -c e2e/replay.local.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: new RegExp(`(${process.env.SPECS || "replay"})\\.spec\\.ts$`),
  reporter: [["list"]],
  use: { baseURL: process.env.WEB || "http://localhost:3100", channel: process.env.PW_CHANNEL || "chrome" },
});

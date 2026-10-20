import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";

export const MCP_PATH = process.env.MCP_PATH || "/mcp";
export const MCP_ORIGIN = `http://127.0.0.1:${process.env.MCP_PORT || "8787"}`;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    // The installed Chrome, so no browser download is needed. Set PW_CHANNEL=chromium to use Playwright's own.
    channel: process.env.PW_CHANNEL || "chrome",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/dev-all.mjs",
    url: "http://localhost:3000/sim",
    reuseExistingServer: true,
    timeout: 180_000,
    env: {
      E2E: "1",
      DEMO_ADMIN: "1",
      WAITLIST_STORE: "file",
      MCP_PATH,
      DATA_DIR: mkdtempSync(join(tmpdir(), "fb-e2e-")),
    },
  },
});

import { afterEach, describe, expect, it } from "vitest";
import { BOOTH_TOKEN, connect, rawCall, startServer, structured, text, type Running } from "./helpers.ts";
import { REFUSALS } from "../src/results.ts";

let server: Running | undefined;
afterEach(async () => {
  await server?.close();
  server = undefined;
});

const initialize = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "raw", version: "0" } },
};

describe("auth", () => {
  it("returns 401 with no token", async () => {
    server = await startServer();
    const res = await rawCall(server.url, initialize, { Authorization: "" });
    expect(res.status).toBe(401);
  });

  it("returns 401 for an expired token", async () => {
    server = await startServer({ SALON_TOKENS: "old-token=demo-salon@2020-01-01T00:00:00Z" });
    const res = await rawCall(server.url, initialize, { Authorization: "Bearer old-token" });
    expect(res.status).toBe(401);
  });

  it("keeps salons apart: Booth 12 cannot read Demo Salon's clients", async () => {
    server = await startServer();
    const { client } = await connect(server.url, { token: BOOTH_TOKEN });
    const result = await client.callTool({ name: "get_last_formula", arguments: { client_name: "Lena Okafor" } });
    expect(structured(result).status).toBe("refused");
  });

  it("refuses a session used with another salon's token", async () => {
    server = await startServer();
    const init = await rawCall(server.url, initialize);
    const res = await rawCall(
      server.url,
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
      { Authorization: `Bearer ${BOOTH_TOKEN}`, "mcp-session-id": init.sessionId ?? "" },
    );
    expect(res.status).toBe(403);
  });
});

describe("plan cap", () => {
  it("Booth 12 is full at 50 of 50 and the 51st save is refused", async () => {
    server = await startServer();
    const { client } = await connect(server.url, { token: BOOTH_TOKEN });
    const result = await client.callTool({
      name: "save_formula",
      arguments: { client_name: "Ines", components: [{ shade: "6N", grams: 30 }], developer_volume: 20 },
    });
    expect(text(result)).toContain("free plan holds 50 formulas");
    expect(structured(result).usage).toEqual({ count: 50, cap: 50 });
    expect(server.store.getSalon("booth12")?.formulas.length).toBe(50);
  });

  it("honours a low FREE_FORMULA_CAP", async () => {
    server = await startServer({ FREE_FORMULA_CAP: "3" });
    const { client } = await connect(server.url);
    const result = await client.callTool({
      name: "save_formula",
      arguments: { client_name: "Marta", components: [{ shade: "6N", grams: 30 }], developer_volume: 20 },
    });
    expect(structured(result).status).toBe("refused");
    expect(text(result)).toContain("waitlist");
  });
});

describe("refusal wording", () => {
  it("carries no codes or ids", () => {
    for (const message of Object.values(REFUSALS)) {
      const sample = typeof message === "function" ? message("Rohan") : message;
      expect(sample).not.toMatch(/[A-Z]{2,}_|\berror\b|\bcode\b|\d{3,}/i);
    }
  });
});

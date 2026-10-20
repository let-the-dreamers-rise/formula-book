import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect, rawCall, startServer, structured, type Running } from "./helpers.ts";

let server: Running;
beforeAll(async () => {
  server = await startServer();
});
afterAll(async () => server.close());

async function rawSession(protocolVersion: string, capabilities: object) {
  const init = await rawCall(server.url, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion, capabilities, clientInfo: { name: "raw", version: "0" } },
  });
  expect(init.status).toBe(200);
  const headers = { "mcp-session-id": init.sessionId ?? "", "mcp-protocol-version": protocolVersion };
  await rawCall(server.url, { jsonrpc: "2.0", method: "notifications/initialized" }, headers);
  return headers;
}

describe("ambiguous client", () => {
  it("2025-03-26 with the elicitation capability returns needs_choice and sends no elicitation", async () => {
    const headers = await rawSession("2025-03-26", { elicitation: {} });
    const call = await rawCall(
      server.url,
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "get_last_formula", arguments: { client_name: "Priya" } } },
      headers,
    );
    expect(call.messages.some((m) => m.method === "elicitation/create")).toBe(false);
    const result = call.messages.find((m) => m.id === 2).result;
    expect(result.structuredContent.status).toBe("needs_choice");
    expect(result.structuredContent.needs_choice.options).toEqual(["Priya Shah", "Priya Kapoor"]);
    expect(result.content[0].text).toContain("Which one?");
  });

  it("2025-11-25 without the capability returns needs_choice", async () => {
    const { client } = await connect(server.url);
    const result = await client.callTool({ name: "get_last_formula", arguments: { client_name: "Priya" } });
    expect(structured(result).status).toBe("needs_choice");
    expect(structured(result).needs_choice.options).toEqual(["Priya Shah", "Priya Kapoor"]);
  });

  it("2025-11-25 with the capability sends exactly one elicitation and uses the answer", async () => {
    const sim = await connect(server.url, {
      elicit: () => ({ action: "accept", content: { client: "Priya Shah" } }),
    });
    const result = await sim.client.callTool({ name: "get_last_formula", arguments: { client_name: "Priya" } });
    expect(sim.elicitations).toBe(1);
    expect(structured(result).status).toBe("ok");
    expect(structured(result).client).toBe("Priya Shah");
    expect(structured(result).totals.total_grams).toBe(125);
  });

  it("a cancelled elicitation changes nothing and says so", async () => {
    const sim = await connect(server.url, { elicit: () => ({ action: "cancel" }) });
    const result = await sim.client.callTool({ name: "get_last_formula", arguments: { client_name: "Priya" } });
    expect(structured(result).status).toBe("cancelled");
  });
});

describe("protocol negotiation", () => {
  for (const version of ["2025-11-25", "2025-03-26"]) {
    it(`initialize at ${version} returns 200, a session id and the same version`, async () => {
      const init = await rawCall(server.url, {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: version, capabilities: {}, clientInfo: { name: "raw", version: "0" } },
      });
      expect(init.status).toBe(200);
      expect(init.sessionId).toBeTruthy();
      expect(init.messages[0].result.protocolVersion).toBe(version);
    });
  }
});

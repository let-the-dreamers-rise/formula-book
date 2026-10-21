import { createHash } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildServer } from "../src/app.ts";
import { CARD, CARD_MIME } from "../src/card.ts";
import { connect, startServer, type Running } from "./helpers.ts";

let server: Running;
let client: Client;
beforeAll(async () => {
  server = await startServer();
  const mcp = buildServer(server.config, server.store, { salonId: "demo-salon", protocolVersion: "2025-11-25" });
  const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "0" });
  await Promise.all([mcp.connect(serverSide), client.connect(clientSide)]);
});
afterAll(async () => server.close());

describe("formula card resource", () => {
  it("has a content-hashed ui:// URI that matches its HTML", () => {
    const hash = createHash("sha256").update(CARD.html).digest("hex").slice(0, 16);
    expect(CARD.uri).toBe(`ui://formula-card/${hash}.html`);
  });

  it("is served as text/html;profile=mcp-app with empty CSP domain lists", async () => {
    const { contents } = await client.readResource({ uri: CARD.uri });
    expect(contents).toHaveLength(1);
    expect(contents[0]?.mimeType).toBe(CARD_MIME);
    expect(CARD_MIME).toBe("text/html;profile=mcp-app");
    expect((contents[0] as { text: string }).text).toBe(CARD.html);
    expect(contents[0]?._meta).toEqual({ ui: { csp: { connectDomains: [], resourceDomains: [] } } });
  });

  it("is one self-contained file that loads nothing external", () => {
    expect(CARD.html).not.toMatch(/<script[^>]+src=|<link[^>]+href=|https?:\/\//i);
    expect(CARD.html).toContain("default-src 'none'");
  });

  it("is linked from every tool and from every formula result", async () => {
    const { tools } = await client.listTools();
    for (const tool of tools) {
      expect(tool._meta?.ui).toMatchObject({ resourceUri: CARD.uri });
      expect(typeof (tool._meta?.ui as { invoking?: string }).invoking).toBe("string");
    }
    const result = await client.callTool({ name: "get_last_formula", arguments: { client_name: "Lena" } });
    expect(result._meta?.ui).toMatchObject({ resourceUri: CARD.uri, invoking: expect.any(String), invoked: expect.any(String) });
  });

  it("lists tools and reads the card over real HTTP, as the sim does", async () => {
    // Regression: these replies are ready at once, and security software corrupted them while they
    // carried a Content-Length (docs/friction-log.md entry 4). They must arrive chunked.
    const http = await connect(server.url);
    const { tools } = await http.client.listTools();
    expect(tools.map((t) => t.name)).toContain("get_last_formula");
    const { contents } = await http.client.readResource({ uri: CARD.uri });
    expect((contents[0] as { text: string }).text).toBe(CARD.html);
    const raw = await fetch(`${server.url}/healthz`);
    expect(raw.ok).toBe(true);
    await http.client.close();
  });

  it("does not link the card from a refusal", async () => {
    const result = await client.callTool({ name: "get_last_formula", arguments: { client_name: "Rohan" } });
    expect(result._meta).toBeUndefined();
  });
});

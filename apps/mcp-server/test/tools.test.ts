import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../src/app.ts";
import { connect, startServer, structured, text, type Running } from "./helpers.ts";

let server: Running;
beforeAll(async () => {
  server = await startServer();
});
afterAll(async () => server.close());

describe("tools", () => {
  // In memory, not over HTTP: Norton on the build machine corrupts tools/list responses on loopback
  // (docs/friction-log.md entry 4). This still tests the server's own listing.
  it("lists exactly the three tools", async () => {
    const mcp = buildServer(server.config, server.store, { salonId: "demo-salon", protocolVersion: "2025-11-25" });
    const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "0" });
    await Promise.all([mcp.connect(serverSide), client.connect(clientSide)]);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["get_last_formula", "save_formula", "scale_formula"]);
    for (const tool of tools) expect(tool.description?.length).toBeGreaterThan(40);
  });

  it("gets Lena's last formula with totals and a speakable sentence", async () => {
    const { client } = await connect(server.url);
    const result = await client.callTool({ name: "get_last_formula", arguments: { client_name: "Lena" } });
    const data = structured(result);
    expect(data.status).toBe("ok");
    expect(data.client).toBe("Lena Okafor");
    expect(data.totals).toEqual({ colour_grams: 50, developer_grams: 50, total_grams: 100 });
    expect(data.demo).toBe(true);
    expect(text(result)).toContain("40 grams 5N");
  });

  it("scales Lena by 1.5 to 150 g without changing the saved record", async () => {
    const { client } = await connect(server.url);
    const scaled = await client.callTool({ name: "scale_formula", arguments: { client_name: "Lena", factor: 1.5 } });
    expect(structured(scaled).totals.total_grams).toBe(150);
    expect(structured(scaled).scale_factor).toBe(1.5);
    expect(text(scaled)).toContain("150 grams");
    const again = await client.callTool({ name: "get_last_formula", arguments: { client_name: "Lena" } });
    expect(structured(again).totals.total_grams).toBe(100);
  });

  it("scales to a target total", async () => {
    const { client } = await connect(server.url);
    const result = await client.callTool({
      name: "scale_formula",
      arguments: { client_name: "Priya Shah", target_total_grams: 100 },
    });
    expect(structured(result).scale_factor).toBe(0.8);
  });

  it("asks which when both or neither scale argument is given", async () => {
    const { client } = await connect(server.url);
    for (const args of [{ client_name: "Lena" }, { client_name: "Lena", factor: 2, target_total_grams: 90 }]) {
      const result = await client.callTool({ name: "scale_formula", arguments: args });
      expect(structured(result).status).toBe("refused");
      expect(text(result)).toMatch(/times|total/);
    }
  });

  it("saves a new client and keeps it across sessions, with every optional field", async () => {
    const first = await connect(server.url);
    const saved = await first.client.callTool({
      name: "save_formula",
      arguments: {
        client_name: "Marta",
        components: [{ shade: "6N", grams: 30 }, { shade: "7.1", grams: 20 }],
        developer_volume: 20,
        developer_ratio: 1.5,
        processing_minutes: 30,
        note: "cool tone",
      },
    });
    expect(structured(saved).saved).toBe(true);
    expect(structured(saved).totals).toEqual({ colour_grams: 50, developer_grams: 75, total_grams: 125 });
    const second = await connect(server.url);
    const got = await second.client.callTool({ name: "get_last_formula", arguments: { client_name: "marta" } });
    expect(structured(got).formula.processing_minutes).toBe(30);
    expect(structured(got).formula.note).toBe("cool tone");
    expect(structured(got).totals.total_grams).toBe(125);
  });

  it("refuses an unknown client with the next step", async () => {
    const { client } = await connect(server.url);
    const result = await client.callTool({ name: "get_last_formula", arguments: { client_name: "Rohan" } });
    expect(structured(result).status).toBe("refused");
    expect(text(result)).toContain("I have no formula for Rohan");
    expect(result.isError).not.toBe(true);
  });

  it("refuses an unknown developer strength and saves nothing", async () => {
    const { client } = await connect(server.url);
    const result = await client.callTool({
      name: "save_formula",
      arguments: { client_name: "Omar", components: [{ shade: "6N", grams: 30 }], developer_volume: 25 },
    });
    expect(text(result)).toContain("10, 20, 30 and 40 volume");
    const check = await client.callTool({ name: "get_last_formula", arguments: { client_name: "Omar" } });
    expect(structured(check).status).toBe("refused");
  });
});

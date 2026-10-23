import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { ElicitRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { InTabServers } from "../src/in-tab.ts";
import type { Salon } from "../src/store.ts";

const seed = (name: string) => JSON.parse(readFileSync(new URL(`../../../seed/${name}.json`, import.meta.url), "utf8")) as Salon;
const servers = () => new InTabServers([seed("demo-salon"), seed("booth12")]);

type Result = { content?: { text?: string }[]; structuredContent?: { status?: string; client?: string; totals?: { total_grams?: number } } };

async function client(transport: Parameters<Client["connect"]>[0], pick = "") {
  const c = new Client({ name: "in-tab-test", version: "0" }, { capabilities: { elicitation: { form: {} } } });
  c.setRequestHandler(ElicitRequestSchema, async () => (pick ? { action: "accept", content: { client: pick } } : { action: "cancel" }));
  await c.connect(transport);
  return c;
}

describe("servers running in a tab", () => {
  it("serve the same tools and card as over HTTP, and give each session an id", async () => {
    const transport = await servers().formulaBook("demo-salon-token");
    const c = await client(transport);
    expect(transport.sessionId).toMatch(/^in-tab-/);
    const { tools } = await c.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["get_last_formula", "save_formula", "scale_formula"]);
    const recall = (await c.callTool({ name: "get_last_formula", arguments: { client_name: "Lena" } })) as Result;
    expect(recall.structuredContent?.totals?.total_grams).toBe(100);
  });

  it("elicit which Priya, and keep saves across sessions in the same tab", async () => {
    const tab = servers();
    const first = await client(await tab.formulaBook("demo-salon-token"), "Priya Kapoor");
    const priya = (await first.callTool({ name: "get_last_formula", arguments: { client_name: "Priya" } })) as Result;
    expect(priya.structuredContent?.client).toBe("Priya Kapoor");
    const marta = { client_name: "Marta", components: [{ shade: "6N", grams: 30 }], developer_volume: 20, developer_ratio: 1 };
    expect(((await first.callTool({ name: "save_formula", arguments: marta })) as Result).structuredContent?.status).toBe("ok");
    const second = await client(await tab.formulaBook("demo-salon-token"));
    const again = (await second.callTool({ name: "get_last_formula", arguments: { client_name: "Marta" } })) as Result;
    expect(again.structuredContent?.client).toBe("Marta");
    expect(tab.usage("demo-salon-token").count).toBe(4);
  });

  it("refuse an unknown token, and keep the capped salon capped", async () => {
    const tab = servers();
    await expect(tab.formulaBook("nope")).rejects.toThrow("token");
    const capped = await client(await tab.formulaBook("booth12-token"));
    const ines = { client_name: "Ines", components: [{ shade: "6N", grams: 30 }], developer_volume: 20, developer_ratio: 1 };
    const result = (await capped.callTool({ name: "save_formula", arguments: ines })) as Result;
    expect(result.content?.[0]?.text).toContain("free plan holds 50 formulas");
  });

  it("serve the salon diary too", async () => {
    const c = await client(await servers().diary());
    const result = (await c.callTool({ name: "list_appointments", arguments: {} })) as Result;
    expect(result.content?.[0]?.text).toContain("14:00 Lena Okafor");
  });
});

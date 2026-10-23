import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { ElicitRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { NOT_RECORDED, callKey, pickCall, type ReplayFixture } from "../lib/replay-fixture.ts";
import { ReplayMemory, ReplayTransport } from "../lib/replay-transport.ts";
import { REPLAY_STORE_LABEL, replayJoin, replayUsage, replayWaitlist } from "../lib/plan-replay.ts";

const fixture = JSON.parse(readFileSync(new URL("../lib/replay-fixture.json", import.meta.url), "utf8")) as ReplayFixture;
const DEMO = "demo-salon-token";

type Result = { structuredContent?: { status?: string; client?: string; totals?: { total_grams?: number } }; content?: { text?: string }[] };

async function connect(memory: ReplayMemory, token = DEMO, pick = "") {
  const client = new Client({ name: "replay-test", version: "0" }, { capabilities: { elicitation: { form: {} } } });
  const asked: string[] = [];
  client.setRequestHandler(ElicitRequestSchema, async (request) => {
    asked.push(String(request.params.message));
    return pick ? { action: "accept", content: { client: pick } } : { action: "cancel" };
  });
  await client.connect(new ReplayTransport(fixture, token, memory));
  const call = async (name: string, args: Record<string, unknown>) => (await client.callTool({ name, arguments: args })) as Result;
  return { client, asked, call };
}

const MARTA = {
  client_name: "Marta",
  components: [
    { shade: "6N", grams: 30 },
    { shade: "7.1", grams: 20 },
  ],
  developer_volume: 20,
  developer_ratio: 1.5,
};

describe("replay transport", () => {
  it("initialises at 2025-11-25 and serves the recorded tools and card", async () => {
    const { client } = await connect(new ReplayMemory());
    expect(client.getServerVersion()?.name).toBe("formula-book");
    expect(client.getServerCapabilities()?.tools).toBeTruthy();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["get_last_formula", "save_formula", "scale_formula"]);
    const uri = (tools[0]?._meta as { ui?: { resourceUri?: string } }).ui?.resourceUri as string;
    const { contents } = await client.readResource({ uri });
    expect(contents[0]?.mimeType).toBe("text/html;profile=mcp-app");
    expect(fixture.initialize.protocolVersion).toBe("2025-11-25");
  });

  it("answers recall and scale with the server's recorded numbers", async () => {
    const { call } = await connect(new ReplayMemory());
    expect((await call("get_last_formula", { client_name: "Lena" })).structuredContent?.totals?.total_grams).toBe(100);
    expect((await call("scale_formula", { factor: 1.5, client_name: "Lena Okafor" })).structuredContent?.totals?.total_grams).toBe(150);
  });

  it("remembers a save across sessions, and not before it happens", async () => {
    const memory = new ReplayMemory();
    const first = await connect(memory);
    expect((await first.call("get_last_formula", { client_name: "Marta" })).structuredContent?.status).toBe("refused");
    expect((await first.call("save_formula", MARTA)).structuredContent?.status).toBe("ok");
    const second = await connect(memory);
    const marta = await second.call("get_last_formula", { client_name: "Marta" });
    expect(marta.structuredContent?.totals?.total_grams).toBe(125);
  });

  it("asks which Priya through elicitation and answers for the one picked", async () => {
    const { call, asked } = await connect(new ReplayMemory(), DEMO, "Priya Kapoor");
    const result = await call("get_last_formula", { client_name: "Priya" });
    expect(asked[0]).toContain("two Priyas");
    expect(result.structuredContent?.client).toBe("Priya Kapoor");
  });

  it("refuses a call it never recorded instead of guessing", async () => {
    const { call } = await connect(new ReplayMemory());
    const result = await call("get_last_formula", { client_name: "Zed" });
    expect(result.structuredContent?.status).toBe("refused");
    expect(result.content?.[0]?.text).toBe(NOT_RECORDED);
  });

  it("keeps the capped salon refusing the 51st formula", async () => {
    const { call } = await connect(new ReplayMemory(), "booth12-token");
    const ines = { client_name: "Ines", components: [{ shade: "6N", grams: 30 }], developer_volume: 20, developer_ratio: 1 };
    expect((await call("save_formula", ines)).content?.[0]?.text).toContain("free plan holds 50 formulas");
  });
});

describe("replay fixture rules", () => {
  it("keys arguments independent of their order", () => {
    expect(callKey("t", "x", { a: 1, b: { d: 2, c: 3 } })).toBe(callKey("t", "x", { b: { c: 3, d: 2 }, a: 1 }));
  });

  it("picks the reply recorded after the most saves that have happened", () => {
    const entries = [
      { after: [], result: { n: 0 } },
      { after: ["s"], result: { n: 1 } },
    ];
    expect(pickCall(entries, new Set())?.result).toEqual({ n: 0 });
    expect(pickCall(entries, new Set(["s"]))?.result).toEqual({ n: 1 });
    expect(pickCall(undefined, new Set())).toBeUndefined();
  });
});

describe("replay plan panel source", () => {
  it("reports recorded usage and keeps the waitlist in the tab", () => {
    expect(replayUsage(fixture, "booth12-token")).toMatchObject({ count: 50, cap: 50 });
    expect(replayUsage(fixture, "unknown")).toMatchObject({ count: 0, cap: 50 });
    expect(() => replayJoin("not an email")).toThrow("name@salon.com");
    const before = replayWaitlist().count;
    replayJoin("Owner@Salon.example");
    replayJoin("owner@salon.example");
    expect(replayWaitlist()).toEqual({ count: before + 1, store: REPLAY_STORE_LABEL });
  });
});

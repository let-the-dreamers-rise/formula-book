import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildDiaryServer, DIARY, diaryText } from "../src/diary.ts";

async function connect() {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await buildDiaryServer().connect(serverSide);
  const client = new Client({ name: "diary-test", version: "0" });
  await client.connect(clientSide);
  return client;
}

type Result = { content?: { text?: string }[]; structuredContent?: { status?: string; day?: string; appointments?: unknown[]; demo?: boolean } };

describe("salon diary server", () => {
  it("offers one read-only tool", async () => {
    const { tools } = await (await connect()).listTools();
    expect(tools.map((t) => t.name)).toEqual(["list_appointments"]);
    expect(tools[0]?.annotations?.readOnlyHint).toBe(true);
  });

  it("lists today's bookings by default, labelled as demo data", async () => {
    const result = (await (await connect()).callTool({ name: "list_appointments", arguments: {} })) as Result;
    expect(result.structuredContent).toMatchObject({ status: "info", day: "today", demo: true });
    expect(result.structuredContent?.appointments).toHaveLength(DIARY.today.length);
    expect(result.content?.[0]?.text).toContain("14:00 Lena Okafor");
  });

  it("lists tomorrow when asked", async () => {
    const result = (await (await connect()).callTool({ name: "list_appointments", arguments: { day: "tomorrow" } })) as Result;
    expect(result.content?.[0]?.text).toContain("Priya Kapoor");
  });

  it("says so when nobody is booked", () => {
    expect(diaryText("today", [])).toBe("Nobody is booked today.");
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startServer, MCP_PATH, type Running } from "../../mcp-server/test/helpers.ts";
import { openSession, type LiveSession } from "../lib/session.ts";

let server: Running;
let session: LiveSession;
const traffic: string[] = [];

beforeAll(async () => {
  server = await startServer();
  session = await openSession({
    url: `${server.url}${MCP_PATH}`,
    token: "demo-salon-token",
    elicitation: true,
    onTraffic: (direction, message) => traffic.push(`${direction} ${String(message.method ?? "result")}`),
    onElicit: async () => ({ action: "accept", content: { client: "Priya Shah" } }),
  });
});
afterAll(async () => {
  await session.close();
  await server.close();
});

describe("the sim's MCP session against the real server", () => {
  it("lists the three tools with their loading text", () => {
    expect(session.toolsError).toBeUndefined();
    expect(session.tools).toEqual(["get_last_formula", "scale_formula", "save_formula"]);
    expect(session.toolMeta?.scale_formula?.ui?.invoking).toBe("Scaling the formula");
  });

  it("prefetches the card the tools link to, as a host does", () => {
    expect(session.cardError).toBeUndefined();
    expect(session.card?.uri).toMatch(/^ui:\/\/formula-card\/[0-9a-f]{16}\.html$/);
    expect(session.card?.html).toContain("default-src 'none'");
    expect(traffic).toContain("out resources/read");
  });

  it("reports a resource that is not an MCP Apps card", async () => {
    await expect(session.readCard("ui://formula-card/missing.html")).rejects.toThrow();
  });

  it("answers the server's elicitation through the given handler", async () => {
    const result = await session.client.callTool({ name: "get_last_formula", arguments: { client_name: "Priya" } });
    expect((result.structuredContent as { client: string }).client).toBe("Priya Shah");
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { connect, startServer, type Running } from "./helpers.ts";

let server: Running | undefined;
afterEach(async () => {
  await server?.close();
  server = undefined;
});

const setDelay = (url: string, body: unknown) =>
  fetch(`${url}/admin/test-delay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

describe("test-only tool delay", () => {
  it("is absent unless both E2E and DEMO_ADMIN are on", async () => {
    server = await startServer({ E2E: "0" });
    expect((await setDelay(server.url, { ms: 800 })).status).toBe(404);
  });

  it("slows every tool call by the set amount, and 0 turns it off", async () => {
    server = await startServer({ E2E: "1" });
    const response = await setDelay(server.url, { ms: 400 });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, ms: 400 });

    const { client } = await connect(server.url);
    const started = Date.now();
    await client.callTool({ name: "get_last_formula", arguments: { client_name: "Lena" } });
    expect(Date.now() - started).toBeGreaterThanOrEqual(380);

    await setDelay(server.url, { ms: 0 });
    const again = Date.now();
    await client.callTool({ name: "get_last_formula", arguments: { client_name: "Lena" } });
    expect(Date.now() - again).toBeLessThan(380);
    await client.close();
  });

  it("refuses a delay that is not a whole number from 0 to 5000", async () => {
    server = await startServer({ E2E: "1" });
    for (const ms of [-1, 1.5, 9000, "800"]) {
      expect((await setDelay(server.url, { ms })).status).toBe(400);
    }
  });
});

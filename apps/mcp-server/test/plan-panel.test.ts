import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BOOTH_TOKEN, DEMO_TOKEN, startServer, type Running } from "./helpers.ts";

let server: Running;
beforeEach(async () => {
  server = await startServer();
});
afterEach(async () => server.close());

const usage = (token?: string) =>
  fetch(`${server.url}/plan/usage`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
const join = (body: unknown) =>
  fetch(`${server.url}/plan/waitlist`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const count = async () => (await (await fetch(`${server.url}/plan/waitlist`)).json()) as { count: number; store: string };

describe("plan usage", () => {
  it("reports the salon's formula count against the free cap", async () => {
    expect(await (await usage(BOOTH_TOKEN)).json()).toEqual({ count: 50, cap: 50, price: "Hypothesis, payments not live" });
    expect(((await (await usage(DEMO_TOKEN)).json()) as { count: number }).count).toBe(3);
  });

  it("needs the salon's token", async () => {
    expect((await usage()).status).toBe(401);
    expect((await usage("wrong")).status).toBe(401);
  });
});

describe("local waitlist", () => {
  it("starts empty, counts a signup, and labels the store honestly", async () => {
    expect(await count()).toEqual({ count: 0, store: "Local demo store" });
    const response = await join({ email: "test@example.invalid" });
    expect(response.status).toBe(200);
    expect(await count()).toEqual({ count: 1, store: "Local demo store" });
  });

  it("refuses an address that is not an email, in plain words", async () => {
    for (const email of ["", "no-at-sign", "a@b", 42, "x".repeat(250) + "@example.invalid"]) {
      const response = await join({ email });
      expect(response.status).toBe(400);
      expect(((await response.json()) as { error: string }).error).toMatch(/email/i);
    }
    expect((await count()).count).toBe(0);
  });

  it("does not count the same address twice", async () => {
    await join({ email: "Test@Example.invalid" });
    await join({ email: "test@example.invalid" });
    expect((await count()).count).toBe(1);
  });
});

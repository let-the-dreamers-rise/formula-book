import { describe, expect, it } from "vitest";
import { applyTraffic, type TrafficRow } from "../lib/traffic.ts";

const call = { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_last_formula", arguments: {} } } as const;

describe("applyTraffic", () => {
  it("adds a row per request, named by the tool for tools/call", () => {
    const rows = applyTraffic([], { direction: "out", message: call, epoch: 1, at: 10 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ method: "tools/call", summary: "get_last_formula", direction: "out" });
  });

  it("fills the matching row when the response arrives, without changing the old array", () => {
    const before = applyTraffic([], { direction: "out", message: call, epoch: 1, at: 10 });
    const after = applyTraffic(before, {
      direction: "in",
      message: { jsonrpc: "2.0", id: 3, result: { content: [] } },
      epoch: 1,
      at: 20,
    });
    expect(after).toHaveLength(1);
    expect(after[0]?.response).toEqual({ content: [] });
    expect(before[0]?.response).toBeUndefined();
  });

  it("marks an error response as failed", () => {
    const before = applyTraffic([], { direction: "out", message: call, epoch: 1, at: 10 });
    const after = applyTraffic(before, {
      direction: "in",
      message: { jsonrpc: "2.0", id: 3, error: { code: -1, message: "x" } },
      epoch: 1,
      at: 20,
    });
    expect(after[0]?.failed).toBe(true);
  });

  it("logs a server request such as elicitation/create and its answer", () => {
    const asked = applyTraffic([], {
      direction: "in",
      message: { jsonrpc: "2.0", id: 0, method: "elicitation/create", params: { message: "Which one?" } },
      epoch: 1,
      at: 10,
    });
    const answered = applyTraffic(asked, {
      direction: "out",
      message: { jsonrpc: "2.0", id: 0, result: { action: "accept" } },
      epoch: 1,
      at: 20,
    });
    expect(answered[0]).toMatchObject({ method: "elicitation/create", direction: "in", response: { action: "accept" } });
  });

  it("keeps ids from different sessions apart", () => {
    let rows: readonly TrafficRow[] = applyTraffic([], { direction: "out", message: call, epoch: 1, at: 1 });
    rows = applyTraffic(rows, { direction: "out", message: call, epoch: 2, at: 2 });
    rows = applyTraffic(rows, { direction: "in", message: { jsonrpc: "2.0", id: 3, result: {} }, epoch: 2, at: 3 });
    expect(rows).toHaveLength(2);
    expect(rows[0]?.response).toBeUndefined();
    expect(rows[1]?.response).toEqual({});
  });

  it("logs notifications as their own rows", () => {
    const rows = applyTraffic([], {
      direction: "out",
      message: { jsonrpc: "2.0", method: "notifications/initialized" },
      epoch: 1,
      at: 1,
    });
    expect(rows[0]?.method).toBe("notifications/initialized");
  });
});

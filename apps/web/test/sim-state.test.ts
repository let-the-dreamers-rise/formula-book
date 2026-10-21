import { describe, expect, it } from "vitest";
import type { FormulaView } from "../lib/interpret.ts";
import { initialState, reduce } from "../lib/sim-state.ts";

const view = { client: "Lena Okafor", total: "100 g" } as FormulaView;
const toolResult = { content: [], structuredContent: { status: "ok" }, _meta: { ui: { resourceUri: "ui://formula-card/a.html" } } };

describe("sim state for the card host", () => {
  it("starts on the screen frame with no card", () => {
    const state = initialState("demo-salon");
    expect(state.device).toBe("echo-show-8");
    expect(state.card).toBeUndefined();
    expect(state.debug).toBe(false);
  });

  it("keeps the full tool result so the card gets exactly what the server sent", () => {
    const state = reduce(initialState("demo-salon"), { type: "result", view, raw: {}, toolResult });
    expect(state.result?.toolResult).toBe(toolResult);
  });

  it("switching device keeps the last result and the loaded card", () => {
    let state = reduce(initialState("demo-salon"), { type: "result", view, raw: {}, toolResult });
    state = reduce(state, { type: "card", card: { uri: "ui://formula-card/a.html", html: "<html></html>" } });
    state = reduce(state, { type: "device", device: "mobile" });
    expect(state.device).toBe("mobile");
    expect(state.result?.toolResult).toBe(toolResult);
    expect(state.card?.uri).toBe("ui://formula-card/a.html");
  });

  it("records what the skeleton says while a tool runs, and clears it after", () => {
    let state = reduce(initialState("demo-salon"), { type: "busy", busy: true, invoking: "Scaling the formula" });
    expect(state.invoking).toBe("Scaling the formula");
    state = reduce(state, { type: "busy", busy: false });
    expect(state.invoking).toBeUndefined();
  });

  it("tracks the connection from connecting to connected or unreachable", () => {
    let state = reduce(initialState("demo-salon"), { type: "connected", sessionId: "s1", protocolVersion: "2025-11-25" });
    expect(state).toMatchObject({ status: "connected", sessionId: "s1", protocolVersion: "2025-11-25" });
    state = reduce(state, { type: "connecting" });
    expect(state).toMatchObject({ status: "connecting", sessionId: undefined });
    state = reduce(state, { type: "unreachable", error: "connect refused" });
    expect(state).toMatchObject({ status: "unreachable", error: "connect refused" });
  });

  it("records turns, the spoken line, usage and a failure, which the next utterance clears", () => {
    let state = reduce(initialState("demo-salon"), { type: "user", text: "Lena's last formula" });
    state = reduce(state, { type: "reply", text: "Lena Okafor: 40 grams 5N", usage: { count: 3, cap: 50 } });
    expect(state.turns.map((t) => t.role)).toEqual(["user", "assistant"]);
    expect(state.spoken).toBe("Lena Okafor: 40 grams 5N");
    expect(state.usage).toEqual({ count: 3, cap: 50 });
    state = reduce(state, { type: "failed", error: "timed out" });
    expect(state.error).toBe("timed out");
    state = reduce(state, { type: "user", text: "again" });
    expect(state.error).toBeUndefined();
  });

  it("opens and closes the choice dialog, and holds notices and warnings", () => {
    const dialog = { question: "Which Priya?", options: ["Priya Shah", "Priya Kapoor"], source: "elicitation" as const };
    let state = reduce(initialState("demo-salon"), { type: "dialog", dialog });
    expect(state.dialog).toBe(dialog);
    state = reduce(state, { type: "dialog", dialog: undefined });
    expect(state.dialog).toBeUndefined();
    state = reduce(state, { type: "notice", notice: "Replay is not available" });
    state = reduce(state, { type: "toolsWarning", warning: "No tool list" });
    expect(state).toMatchObject({ notice: "Replay is not available", toolsWarning: "No tool list" });
  });

  it("keeps the last card when a later card read fails, and shows why", () => {
    let state = reduce(initialState("demo-salon"), { type: "card", card: { uri: "ui://formula-card/a.html", html: "x" } });
    state = reduce(state, { type: "card", error: "timed out" });
    expect(state.card?.uri).toBe("ui://formula-card/a.html");
    expect(state.cardError).toBe("timed out");
  });

  it("adds traffic rows", () => {
    const message = { jsonrpc: "2.0", id: 1, method: "initialize" };
    const state = reduce(initialState("demo-salon"), { type: "traffic", event: { direction: "out", message, epoch: 1, at: 2 } });
    expect(state.traffic).toHaveLength(1);
  });

  it("changing salon keeps the device and the debug view", () => {
    let state = reduce(initialState("demo-salon"), { type: "device", device: "voice" });
    state = reduce(state, { type: "debug", debug: true });
    state = reduce(state, { type: "salon", salonId: "booth12" });
    expect(state.device).toBe("voice");
    expect(state.debug).toBe(true);
    expect(state.result).toBeUndefined();
  });
});

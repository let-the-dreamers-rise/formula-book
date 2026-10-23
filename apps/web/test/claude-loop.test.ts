import { describe, expect, it } from "vitest";
import type { ChooserRound, PlannedCall } from "../lib/chooser.ts";
import { resultForModel, runClaudeLoop } from "../lib/claude-loop.ts";

const diaryResult = { content: [{ type: "text", text: "Booked today: 14:00 Lena Okafor; 15:00 Priya Shah." }], structuredContent: { status: "info" } };
const formula = (client: string) => ({ content: [{ type: "text", text: `${client}: total 100 grams.` }], structuredContent: { status: "ok", client } });

function scripted(plans: readonly (readonly PlannedCall[])[]) {
  const seen: (readonly ChooserRound[])[] = [];
  const calls: string[] = [];
  const said: string[] = [];
  let turn = 0;
  const deps = {
    choose: async (history: readonly ChooserRound[]) => {
      seen.push(history);
      return plans[turn++] ?? [];
    },
    call: async (tool: string, args: Record<string, unknown>) => {
      calls.push(`${tool}(${String(args.client_name ?? args.day ?? "")})`);
      return tool === "list_appointments" ? diaryResult : formula(String(args.client_name));
    },
    say: (text: string) => void said.push(text),
  };
  return { deps, seen, calls, said };
}

describe("Claude's agent loop", () => {
  it("reads the diary, acts on each client, then speaks Claude's closing sentence", async () => {
    const { deps, seen, calls, said } = scripted([
      [{ tool: "list_appointments" as never, arguments: { day: "today" }, id: "a" }],
      [
        { tool: "get_last_formula", arguments: { client_name: "Lena Okafor" }, id: "b" },
        { tool: "get_last_formula", arguments: { client_name: "Priya Shah" }, id: "c" },
      ],
      [{ tool: null, reason: "Both bowls are ready." }],
    ]);
    expect(await runClaudeLoop(deps)).toBe(2);
    expect(calls).toEqual(["list_appointments(today)", "get_last_formula(Lena Okafor)", "get_last_formula(Priya Shah)"]);
    expect(said).toEqual(["Both bowls are ready."]);
    expect(seen[1]?.[0]?.results[0]?.id).toBe("a");
    expect(seen[1]?.[0]?.results[0]?.content).toContain("14:00 Lena Okafor");
    expect(seen[2]).toHaveLength(2);
  });

  it("stops after three rounds even if Claude keeps calling", async () => {
    const again: PlannedCall[] = [{ tool: "get_last_formula", arguments: { client_name: "Lena" }, id: "x" }];
    const { deps, calls } = scripted([again, again, again, again]);
    expect(await runClaudeLoop(deps)).toBe(3);
    expect(calls).toHaveLength(3);
  });

  it("stops when a call fails", async () => {
    const { deps } = scripted([[{ tool: "get_last_formula", arguments: { client_name: "Lena" }, id: "x" }]]);
    const failing = { ...deps, call: async () => undefined };
    expect(await runClaudeLoop(failing)).toBe(1);
  });

  it("says Claude's words when it calls nothing", async () => {
    const { deps, said, calls } = scripted([[{ tool: null, reason: "I can only look up, scale or save formulas." }]]);
    expect(await runClaudeLoop(deps)).toBe(0);
    expect(calls).toEqual([]);
    expect(said).toEqual(["I can only look up, scale or save formulas."]);
  });

  it("does not start a next round for calls without ids", async () => {
    const { deps, seen } = scripted([[{ tool: "get_last_formula", arguments: { client_name: "Lena" } }], [{ tool: null, reason: "never" }]]);
    expect(await runClaudeLoop(deps)).toBe(1);
    expect(seen).toHaveLength(1);
  });

  it("gives Claude the server's sentence and data, trimmed", () => {
    const text = resultForModel({ content: [{ type: "text", text: "x".repeat(5000) }], structuredContent: { status: "ok" } });
    expect(text.length).toBeLessThanOrEqual(3500);
    expect(resultForModel(diaryResult)).toContain('"status":"info"');
  });
});

// The agent loop for the Claude chooser: Claude plans calls, the host runs them over MCP (on
// whichever server offers each tool), and the results go back to Claude for the next round.
import { MAX_ROUNDS, type ChooserRound, type PlannedCall } from "./chooser.ts";

export interface LoopDeps {
  /** Asks Claude for the next calls, given the rounds so far; [] when it could not answer. */
  readonly choose: (history: readonly ChooserRound[]) => Promise<readonly PlannedCall[]>;
  /** Runs one call over MCP; undefined when it failed (the host has already shown why). */
  readonly call: (tool: string, args: Record<string, unknown>) => Promise<unknown>;
  /** Speaks Claude's own words, for example its closing sentence. */
  readonly say: (text: string) => void;
}

const MAX_RESULT_CHARS = 3_500;

/** What Claude reads back for one call: the server's sentence and its structured data, trimmed. */
export function resultForModel(result: unknown): string {
  const r = result as { content?: { type?: string; text?: string }[]; structuredContent?: unknown } | undefined;
  const text = (r?.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join(" ");
  return JSON.stringify({ text, data: r?.structuredContent ?? null }).slice(0, MAX_RESULT_CHARS);
}

type Call = Extract<PlannedCall, { tool: string }>;

/** Runs up to MAX_ROUNDS rounds and returns how many rounds made calls. */
export async function runClaudeLoop(deps: LoopDeps): Promise<number> {
  let history: readonly ChooserRound[] = [];
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const plan = await deps.choose(history);
    const calls = plan.filter((c): c is Call => c.tool !== null);
    if (calls.length === 0) {
      const words = plan.find((c) => c.tool === null);
      if (words && words.tool === null) deps.say(words.reason);
      return round;
    }
    const results: { id: string; content: string }[] = [];
    for (const c of calls) {
      const result = await deps.call(c.tool, { ...c.arguments });
      if (result === undefined) return round + 1;
      results.push({ id: c.id ?? "", content: resultForModel(result) });
    }
    // Without ids the results cannot be matched to the calls, so there is no next round.
    if (calls.some((c) => !c.id)) return round + 1;
    const done: ChooserRound = { calls: calls.map((c) => ({ id: c.id as string, name: c.tool, input: { ...c.arguments } })), results };
    history = [...history, done];
  }
  return MAX_ROUNDS;
}

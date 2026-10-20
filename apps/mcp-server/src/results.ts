import { computeTotals, speakFormula, type Formula } from "@formula-book/core";

export interface ToolResult {
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  structuredContent: Record<string, unknown>;
}

export interface Usage {
  readonly count: number;
  readonly cap: number;
}

// Every refusal is a normal result: plain words, a next step, no codes or ids.
export const REFUSALS = {
  notFound: (name: string) =>
    `I have no formula for ${name}. Say the formula, for example 'colour ${name}, 30 grams 6N, 20 volume, one to one', and I will save it.`,
  noFormulaYet: (name: string) => `${name} has no saved formula yet. Say the formula and I will save it.`,
  planFull: (cap: number | string) =>
    `Your free plan holds ${cap} formulas and this salon has ${cap}. Nothing was saved. Join the waitlist for the paid plan; no payment is set up yet.`,
  scaleWhich: "Do you want it scaled by an amount, like one and a half times, or to a total weight in grams?",
  cancelled: "No problem. Nothing was changed.",
} as const;

function result(text: string, structuredContent: Record<string, unknown>): ToolResult {
  return { content: [{ type: "text", text }], structuredContent };
}

function formulaJson(formula: Formula & { savedAt?: string }) {
  return {
    components: formula.components.map((c) => ({ shade: c.shade, grams: c.grams })),
    developer_volume: formula.developerVolume,
    developer_ratio: formula.developerRatio,
    ...(formula.processingMinutes !== undefined && { processing_minutes: formula.processingMinutes }),
    ...(formula.note !== undefined && { note: formula.note }),
    ...(formula.savedAt !== undefined && { saved_at: formula.savedAt }),
  };
}

export function formulaResult(input: {
  action: "get" | "scale" | "save";
  client: string;
  formula: Formula & { savedAt?: string };
  demo: boolean;
  usage: Usage;
  factor?: number;
}): ToolResult {
  const totals = computeTotals(input.formula);
  const sentence = speakFormula(input.client, input.formula, input.factor);
  return result(input.action === "save" ? `Saved. ${sentence}` : sentence, {
    status: "ok",
    action: input.action,
    client: input.client,
    demo: input.demo,
    formula: formulaJson(input.formula),
    totals: { colour_grams: totals.colourGrams, developer_grams: totals.developerGrams, total_grams: totals.totalGrams },
    ...(input.factor !== undefined && { scale_factor: input.factor }),
    ...(input.action === "save" && { saved: true }),
    usage: input.usage,
  });
}

export function refusal(reason: string, message: string, extra: Record<string, unknown> = {}): ToolResult {
  return result(message, { status: "refused", reason, message, ...extra });
}

export function needsChoice(question: string, options: readonly string[], tool: string): ToolResult {
  return result(question, { status: "needs_choice", needs_choice: { question, options: [...options] }, tool });
}

export function cancelled(): ToolResult {
  return result(REFUSALS.cancelled, { status: "cancelled", message: REFUSALS.cancelled });
}

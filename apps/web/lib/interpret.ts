import { formatGrams, formatNumber } from "@formula-book/core";

export interface CardRow {
  readonly shade: string;
  readonly grams: string;
}

export interface FormulaView {
  readonly client: string;
  readonly rows: readonly CardRow[];
  readonly colour: string;
  readonly developer: string;
  readonly developerVolume: number;
  readonly ratio: string;
  readonly total: string;
  readonly minutes?: number;
  readonly note?: string;
  readonly scaleFactor?: string;
  readonly saved: boolean;
  readonly demo: boolean;
}

export interface Usage {
  readonly count: number;
  readonly cap: number;
}

export type Interpreted =
  | { readonly kind: "formula"; readonly text: string; readonly view: FormulaView; readonly usage?: Usage; readonly raw: unknown }
  | { readonly kind: "choice"; readonly text: string; readonly question: string; readonly options: readonly string[]; readonly tool: string }
  | { readonly kind: "refusal"; readonly text: string; readonly usage?: Usage }
  | { readonly kind: "cancelled"; readonly text: string }
  | { readonly kind: "error"; readonly text: string };

interface RawResult {
  readonly structuredContent?: Record<string, any>;
  readonly content?: readonly { readonly type: string; readonly text?: string }[];
  readonly isError?: boolean;
}

function spoken(result: RawResult): string {
  return (result.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join(" ");
}

function toView(data: Record<string, any>): FormulaView {
  const formula = data.formula ?? {};
  const totals = data.totals ?? {};
  return {
    client: String(data.client),
    rows: (formula.components ?? []).map((c: { shade: string; grams: number }) => ({ shade: c.shade, grams: formatGrams(c.grams) })),
    colour: formatGrams(totals.colour_grams),
    developer: formatGrams(totals.developer_grams),
    developerVolume: formula.developer_volume,
    ratio: `1 to ${formatNumber(formula.developer_ratio)}`,
    total: formatGrams(totals.total_grams),
    ...(formula.processing_minutes !== undefined && { minutes: formula.processing_minutes }),
    ...(formula.note !== undefined && { note: formula.note }),
    ...(data.scale_factor !== undefined && { scaleFactor: `x${formatNumber(data.scale_factor)}` }),
    saved: data.saved === true,
    demo: data.demo === true,
  };
}

/** Reads a tools/call result the way the host does: by structuredContent.status. */
export function interpretResult(result: RawResult): Interpreted {
  const data = result.structuredContent;
  const text = spoken(result);
  if (!data || result.isError) return { kind: "error", text: text || "The server returned an error." };
  switch (data.status) {
    case "ok":
      return { kind: "formula", text, view: toView(data), usage: data.usage, raw: data };
    case "needs_choice":
      return {
        kind: "choice",
        text,
        question: data.needs_choice.question,
        options: data.needs_choice.options,
        tool: data.tool,
      };
    case "refused":
      return { kind: "refusal", text, usage: data.usage };
    case "cancelled":
      return { kind: "cancelled", text };
    default:
      return { kind: "error", text: text || "The server returned a result the simulator does not know." };
  }
}

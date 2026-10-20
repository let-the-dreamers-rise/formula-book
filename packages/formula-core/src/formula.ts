export interface Component {
  readonly shade: string;
  readonly grams: number;
}

export interface Formula {
  readonly components: readonly Component[];
  readonly developerVolume: number;
  /** Developer grams per gram of colour: "one to one and a half" is 1.5. */
  readonly developerRatio: number;
  readonly processingMinutes?: number;
  readonly note?: string;
}

export interface Totals {
  readonly colourGrams: number;
  readonly developerGrams: number;
  readonly totalGrams: number;
}

export type Checked<T> = ({ readonly ok: true } & T) | { readonly ok: false; readonly reason: string };

export type ScaleBy = { readonly factor: number } | { readonly targetTotalGrams: number };

export const DEVELOPER_VOLUMES: readonly number[] = [10, 20, 30, 40];

export function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

export function formatNumber(value: number): string {
  return String(roundTenth(value));
}

export function formatGrams(value: number): string {
  return `${formatNumber(value)} g`;
}

export function computeTotals(formula: Formula): Totals {
  const colourGrams = roundTenth(formula.components.reduce((sum, c) => sum + c.grams, 0));
  const developerGrams = roundTenth(colourGrams * formula.developerRatio);
  return { colourGrams, developerGrams, totalGrams: roundTenth(colourGrams + developerGrams) };
}

export function validateDeveloper(volume: number): Checked<{ volume: number }> {
  if (DEVELOPER_VOLUMES.includes(volume)) return { ok: true, volume };
  return { ok: false, reason: "I only know 10, 20, 30 and 40 volume. Which strength did you use?" };
}

export function scaleFormula(
  formula: Formula,
  by: ScaleBy,
): Checked<{ formula: Formula; totals: Totals; factor: number }> {
  const current = computeTotals(formula).totalGrams;
  const raw = "factor" in by ? by.factor : by.targetTotalGrams / current;
  if (!Number.isFinite(raw) || raw <= 0) {
    return { ok: false, reason: "I can only scale by an amount above zero, for example one and a half times." };
  }
  const components = formula.components.map((c) => ({ shade: c.shade, grams: roundTenth(c.grams * raw) }));
  const scaled: Formula = { ...formula, components };
  return { ok: true, formula: scaled, totals: computeTotals(scaled), factor: Math.round(raw * 100) / 100 };
}

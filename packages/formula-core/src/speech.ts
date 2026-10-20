import { computeTotals, formatNumber, type Formula } from "./formula.ts";

const UNITS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const NUMBER_WORD = `(?:${[...UNITS, ...TENS.filter(Boolean), "hundred"].join("|")})`;
const NUMBER_RUN = new RegExp(`\\b${NUMBER_WORD}(?:[\\s-]+${NUMBER_WORD})*\\b`, "g");
const NUM = String.raw`(\d+(?:\.\d+)?)`;

function wordsToNumber(run: string): number {
  return run.split(/[\s-]+/).reduce((total, word) => {
    if (word === "hundred") return (total || 1) * 100;
    const unit = UNITS.indexOf(word);
    return total + (unit >= 0 ? unit : TENS.indexOf(word) * 10);
  }, 0);
}

function ratioText(colour: string, developer: string, half: string | undefined): string {
  const ratio = (Number(developer) + (half ? 0.5 : 0)) / Number(colour);
  return `ratio ${Math.round(ratio * 100) / 100}`;
}

/** Turns what a colourist says into a compact form the rule parser reads: "30 g 6N, 20 vol, ratio 1.5". */
export function normaliseSpeech(text: string): string {
  return text
    .toLowerCase()
    .replace(NUMBER_RUN, (run) => String(wordsToNumber(run)))
    .replace(/(\d+) point (\d+)/g, "$1.$2")
    .replace(new RegExp(`${NUM}\\s*(?:to|:)\\s*${NUM}( and a half)?`, "g"), (_m, a, b, half) => ratioText(a, b, half))
    .replace(/(\d+) and a half/g, (_m, whole) => `${Number(whole) + 0.5}`)
    .replace(new RegExp(`${NUM}\\s*(?:grams?|g)\\b`, "g"), "$1 g")
    .replace(/(\d+)\s*(?:volume|vol)\b/g, "$1 vol")
    .replace(/\b(\d{1,2})\s*n\b/g, "$1N")
    .replace(/\s+/g, " ")
    .trim();
}

/** One sentence that holds every number, for a voice-only surface. */
export function speakFormula(clientName: string, formula: Formula, factor?: number): string {
  const totals = computeTotals(formula);
  const colours = formula.components.map((c) => `${formatNumber(c.grams)} grams ${c.shade}`).join(", ");
  const minutes = formula.processingMinutes ? `, ${formula.processingMinutes} minutes` : "";
  const scaled = factor && factor !== 1 ? `, times ${formatNumber(factor)}` : "";
  return (
    `${clientName}: ${colours}, with ${formatNumber(totals.developerGrams)} grams of ` +
    `${formula.developerVolume} volume developer, ratio 1 to ${formatNumber(formula.developerRatio)}${minutes}. ` +
    `Total ${formatNumber(totals.totalGrams)} grams${scaled}.`
  );
}

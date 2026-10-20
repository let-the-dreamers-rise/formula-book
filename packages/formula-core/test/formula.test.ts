import { describe, expect, it } from "vitest";
import { computeTotals, formatGrams, scaleFormula, validateDeveloper, type Formula } from "../src/index.ts";

const lena: Formula = {
  components: [{ shade: "5N", grams: 40 }, { shade: "6.3", grams: 10 }],
  developerVolume: 20,
  developerRatio: 1,
  processingMinutes: 35,
};
const marta: Formula = {
  components: [{ shade: "6N", grams: 30 }, { shade: "7.1", grams: 20 }],
  developerVolume: 20,
  developerRatio: 1.5,
};

describe("computeTotals", () => {
  it("adds colour, then developer at the ratio", () => {
    expect(computeTotals(lena)).toEqual({ colourGrams: 50, developerGrams: 50, totalGrams: 100 });
    expect(computeTotals(marta)).toEqual({ colourGrams: 50, developerGrams: 75, totalGrams: 125 });
  });

  it("handles one shade and three shades", () => {
    const one: Formula = { components: [{ shade: "4N", grams: 50 }], developerVolume: 20, developerRatio: 1 };
    const three: Formula = {
      components: [{ shade: "4N", grams: 10 }, { shade: "5N", grams: 15 }, { shade: "6.3", grams: 5 }],
      developerVolume: 30,
      developerRatio: 2,
    };
    expect(computeTotals(one).totalGrams).toBe(100);
    expect(computeTotals(three)).toEqual({ colourGrams: 30, developerGrams: 60, totalGrams: 90 });
  });
});

describe("scaleFormula", () => {
  it("scales Lena by 1.5 to 60, 15, developer 75, total 150", () => {
    const result = scaleFormula(lena, { factor: 1.5 });
    if (!result.ok) throw new Error(result.reason);
    expect(result.formula.components.map((c) => c.grams)).toEqual([60, 15]);
    expect(result.totals).toEqual({ colourGrams: 75, developerGrams: 75, totalGrams: 150 });
    expect(result.factor).toBe(1.5);
  });

  it("scales Marta by 1.5 to 45, 30, developer 112.5, total 187.5", () => {
    const result = scaleFormula(marta, { factor: 1.5 });
    if (!result.ok) throw new Error(result.reason);
    expect(result.formula.components.map((c) => c.grams)).toEqual([45, 30]);
    expect(result.totals).toEqual({ colourGrams: 75, developerGrams: 112.5, totalGrams: 187.5 });
  });

  it("scales to a target total: 100 g from 125 g is factor 0.8", () => {
    const result = scaleFormula(marta, { targetTotalGrams: 100 });
    if (!result.ok) throw new Error(result.reason);
    expect(result.factor).toBe(0.8);
    expect(result.totals.totalGrams).toBe(100);
  });

  it("rounds grams to 0.1", () => {
    const result = scaleFormula(lena, { factor: 1.333 });
    if (!result.ok) throw new Error(result.reason);
    expect(result.formula.components.map((c) => c.grams)).toEqual([53.3, 13.3]);
  });

  it("refuses a zero or negative factor", () => {
    expect(scaleFormula(lena, { factor: 0 }).ok).toBe(false);
    expect(scaleFormula(lena, { factor: -2 }).ok).toBe(false);
  });

  it("does not change the original formula", () => {
    scaleFormula(lena, { factor: 2 });
    expect(lena.components[0]?.grams).toBe(40);
  });
});

describe("validateDeveloper", () => {
  it("accepts 10, 20, 30 and 40 volume", () => {
    for (const volume of [10, 20, 30, 40]) expect(validateDeveloper(volume).ok).toBe(true);
  });

  it("refuses 25 with the next step in plain words", () => {
    const result = validateDeveloper(25);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("10, 20, 30 and 40 volume");
  });
});

describe("formatGrams", () => {
  it("drops trailing zeros", () => {
    expect(formatGrams(150)).toBe("150 g");
    expect(formatGrams(112.5)).toBe("112.5 g");
  });
});

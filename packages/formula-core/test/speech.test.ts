import { describe, expect, it } from "vitest";
import { normaliseSpeech, speakFormula } from "../src/index.ts";

describe("normaliseSpeech", () => {
  const cases: [string, string][] = [
    ["six N", "6N"],
    ["6 n", "6N"],
    ["seven point one", "7.1"],
    ["thirty grams", "30 g"],
    ["30 grams", "30 g"],
    ["one to one and a half", "ratio 1.5"],
    ["one to one", "ratio 1"],
    ["1:1.5", "ratio 1.5"],
    ["twenty volume", "20 vol"],
    ["20 vol", "20 vol"],
    ["forty grams five N", "40 g 5N"],
    ["ten grams six point three", "10 g 6.3"],
    ["twenty five grams 6N", "25 g 6N"],
    ["one to two", "ratio 2"],
    ["make it one and a half times", "make it 1.5 times"],
    ["one hundred grams", "100 g"],
  ];
  for (const [input, expected] of cases) {
    it(`"${input}" -> "${expected}"`, () => {
      expect(normaliseSpeech(input)).toBe(expected);
    });
  }

  it("normalises a whole save utterance", () => {
    expect(normaliseSpeech("Colour Marta: 30 grams 6N and 20 grams 7.1, 20 volume, one to one and a half")).toBe(
      "colour marta: 30 g 6N and 20 g 7.1, 20 vol, ratio 1.5",
    );
  });
});

describe("speakFormula", () => {
  it("says every number in one sentence", () => {
    const text = speakFormula("Lena Okafor", {
      components: [{ shade: "5N", grams: 40 }, { shade: "6.3", grams: 10 }],
      developerVolume: 20,
      developerRatio: 1,
      processingMinutes: 35,
    });
    expect(text).toContain("40 grams 5N");
    expect(text).toContain("10 grams 6.3");
    expect(text).toContain("20 volume");
    expect(text).toContain("35 minutes");
    expect(text).toContain("100 grams");
  });

  it("names the scale factor when scaled", () => {
    const text = speakFormula(
      "Lena Okafor",
      { components: [{ shade: "5N", grams: 60 }, { shade: "6.3", grams: 15 }], developerVolume: 20, developerRatio: 1 },
      1.5,
    );
    expect(text).toContain("times 1.5");
    expect(text).toContain("150 grams");
  });
});

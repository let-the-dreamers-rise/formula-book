import { describe, expect, it } from "vitest";
import { normaliseSpeech } from "../src/speech.ts";

// What a speech recogniser hands back at the backbar, and the compact form the rule parser reads.
const CASES: readonly (readonly [string, string])[] = [
  ["thirty grams six N", "30 g 6N"],
  ["forty grams 5N", "40 g 5N"],
  ["30 grams 6 N", "30 g 6N"],
  ["twenty grams seven point one", "20 g 7.1"],
  ["twenty volume", "20 vol"],
  ["20 vol", "20 vol"],
  ["one to one", "ratio 1"],
  ["one to one and a half", "ratio 1.5"],
  ["one to two", "ratio 2"],
  ["1:1.5", "ratio 1.5"],
  ["make it one and a half times", "make it 1.5 times"],
  ["make it a hundred and fifty grams", "make it a 150 g"],
  ["twenty five grams", "25 g"],
  ["Lena's  last   formula", "lena's last formula"],
  [
    "Colour Marta thirty grams six N and twenty grams seven point one twenty volume one to one and a half",
    "colour marta 30 g 6N and 20 g 7.1 20 vol ratio 1.5",
  ],
];

describe("normaliseSpeech", () => {
  it.each(CASES)("%s -> %s", (spoken, expected) => {
    expect(normaliseSpeech(spoken)).toBe(expected);
  });
});

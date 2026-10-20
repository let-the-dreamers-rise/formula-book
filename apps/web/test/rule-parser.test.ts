import { describe, expect, it } from "vitest";
import { parseUtterance } from "../lib/rule-parser.ts";

describe("parseUtterance", () => {
  it("maps a recall to get_last_formula", () => {
    expect(parseUtterance("Lena's last formula", {})).toEqual({
      tool: "get_last_formula",
      arguments: { client_name: "Lena" },
    });
  });

  it("accepts curly apostrophes and other recall phrasings", () => {
    expect(parseUtterance("Priya’s last formula", {})).toMatchObject({ arguments: { client_name: "Priya" } });
    expect(parseUtterance("What was Marta's previous formula?", {})).toMatchObject({ tool: "get_last_formula" });
    expect(parseUtterance("last formula for Priya Shah", {})).toEqual({
      tool: "get_last_formula",
      arguments: { client_name: "Priya Shah" },
    });
  });

  it("scales by a factor using the last client from history", () => {
    expect(parseUtterance("Make it one and a half times", { lastClient: "Lena Okafor" })).toEqual({
      tool: "scale_formula",
      arguments: { client_name: "Lena Okafor", factor: 1.5 },
    });
  });

  it("scales to a total in grams", () => {
    expect(parseUtterance("make it 150 grams in total", { lastClient: "Marta" })).toEqual({
      tool: "scale_formula",
      arguments: { client_name: "Marta", target_total_grams: 150 },
    });
  });

  it("scales a named client", () => {
    expect(parseUtterance("make Lena's two times", {})).toEqual({
      tool: "scale_formula",
      arguments: { client_name: "Lena", factor: 2 },
    });
  });

  it("asks for a client when scaling with no history", () => {
    expect(parseUtterance("make it one and a half times", {}).tool).toBeNull();
  });

  it("maps a spoken formula to save_formula", () => {
    expect(
      parseUtterance("Colour Marta: 30 grams 6N and 20 grams 7.1, 20 volume, one to one and a half", {}),
    ).toEqual({
      tool: "save_formula",
      arguments: {
        client_name: "Marta",
        components: [{ shade: "6N", grams: 30 }, { shade: "7.1", grams: 20 }],
        developer_volume: 20,
        developer_ratio: 1.5,
      },
    });
  });

  it("reads spelled-out numbers, minutes and the US spelling", () => {
    expect(parseUtterance("color Ines, thirty grams six N, twenty volume, one to one, 35 minutes", {})).toEqual({
      tool: "save_formula",
      arguments: {
        client_name: "Ines",
        components: [{ shade: "6N", grams: 30 }],
        developer_volume: 20,
        developer_ratio: 1,
        processing_minutes: 35,
      },
    });
  });

  it("refuses a formula with no developer strength", () => {
    expect(parseUtterance("colour Omar: 30 grams 6N", {}).tool).toBeNull();
  });

  it("returns no tool for phrasing it has no rule for", () => {
    expect(parseUtterance("Lena has thick hair today, go for twice the amount", { lastClient: "Lena Okafor" }).tool).toBeNull();
    expect(parseUtterance("what's the weather", {}).tool).toBeNull();
  });
});

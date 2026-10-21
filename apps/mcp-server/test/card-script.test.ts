import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

// The card's script runs in the iframe; here it runs in an empty context to test its pure functions.
const source = readFileSync(fileURLToPath(new URL("../card/card.js", import.meta.url)), "utf8");
const warn = vi.fn();
const context: Record<string, any> = { console: { warn } };
runInNewContext(source, context);
const { resolveSurface, cardModel } = context.FormulaCard;

describe("resolveSurface", () => {
  it("lets deviceClass win", () => {
    expect(resolveSurface({ deviceClass: "mobile", maxWidth: 1280 })).toBe("mobile");
    expect(resolveSurface({ deviceClass: "echo-show-8" })).toBe("screen");
    expect(resolveSurface({ deviceClass: "voice" })).toBe("voice");
  });

  it("falls back to maxWidth with a warning for an unknown deviceClass", () => {
    warn.mockClear();
    expect(resolveSurface({ deviceClass: "echo-hub-x", maxWidth: 375 })).toBe("mobile");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(resolveSurface({ containerDimensions: { maxWidth: 1280 } })).toBe("screen");
  });

  it("defaults to screen when nothing is known", () => {
    expect(resolveSurface({})).toBe("screen");
  });
});

describe("cardModel", () => {
  it("turns structuredContent into display strings", () => {
    const model = cardModel({
      status: "ok",
      client: "Lena Okafor",
      demo: true,
      formula: { components: [{ shade: "5N", grams: 60 }, { shade: "6.3", grams: 15 }], developer_volume: 20, developer_ratio: 1, processing_minutes: 35 },
      totals: { colour_grams: 75, developer_grams: 75, total_grams: 150 },
      scale_factor: 1.5,
    });
    expect(model).toMatchObject({
      client: "Lena Okafor",
      total: "150 g",
      developer: "75 g",
      developerLine: "20 vol, 1 to 1",
      scale: "x1.5",
      minutes: "35 min",
      saved: false,
      demo: true,
    });
    expect(model.rows).toEqual([
      { shade: "5N", grams: "60 g" },
      { shade: "6.3", grams: "15 g" },
    ]);
  });

  it("returns null for anything that is not a formula", () => {
    expect(cardModel({ status: "refused" })).toBeNull();
    expect(cardModel(undefined)).toBeNull();
  });
});

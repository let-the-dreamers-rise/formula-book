import { describe, expect, it } from "vitest";
import { interpretResult } from "../lib/interpret.ts";

const lena = {
  status: "ok",
  action: "scale",
  client: "Lena Okafor",
  demo: true,
  formula: { components: [{ shade: "5N", grams: 60 }, { shade: "6.3", grams: 15 }], developer_volume: 20, developer_ratio: 1 },
  totals: { colour_grams: 75, developer_grams: 75, total_grams: 150 },
  scale_factor: 1.5,
  usage: { count: 3, cap: 50 },
};

const wrap = (structuredContent: object, text = "spoken") => ({ structuredContent, content: [{ type: "text", text }] });

describe("interpretResult", () => {
  it("turns a formula result into card values", () => {
    const out = interpretResult(wrap(lena));
    expect(out.kind).toBe("formula");
    if (out.kind !== "formula") return;
    expect(out.view).toMatchObject({
      client: "Lena Okafor",
      total: "150 g",
      developer: "75 g",
      scaleFactor: "x1.5",
      saved: false,
      demo: true,
    });
    expect(out.view.rows).toEqual([{ shade: "5N", grams: "60 g" }, { shade: "6.3", grams: "15 g" }]);
    expect(out.text).toBe("spoken");
  });

  it("reads needs_choice", () => {
    const out = interpretResult(
      wrap({ status: "needs_choice", needs_choice: { question: "Which one?", options: ["Priya Shah", "Priya Kapoor"] }, tool: "get_last_formula" }),
    );
    expect(out).toMatchObject({ kind: "choice", options: ["Priya Shah", "Priya Kapoor"], tool: "get_last_formula" });
  });

  it("reads a refusal and a cancel as normal spoken replies", () => {
    expect(interpretResult(wrap({ status: "refused", reason: "not_found" }, "I have no formula for Rohan."))).toEqual({
      kind: "refusal",
      text: "I have no formula for Rohan.",
      usage: undefined,
    });
    expect(interpretResult(wrap({ status: "cancelled" }, "No problem.")).kind).toBe("cancelled");
  });

  it("treats a result without structured content as an error", () => {
    expect(interpretResult({ content: [{ type: "text", text: "boom" }], isError: true }).kind).toBe("error");
  });
});

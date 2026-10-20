import { describe, expect, it } from "vitest";
import { resolveClient } from "../src/index.ts";

const names = ["Lena Okafor", "Priya Shah", "Priya Kapoor", "Renée Dubois"];

describe("resolveClient", () => {
  it("matches an exact full name", () => {
    expect(resolveClient("Priya Shah", names)).toEqual({ kind: "found", name: "Priya Shah" });
  });

  it("matches a unique first name", () => {
    expect(resolveClient("Lena", names)).toEqual({ kind: "found", name: "Lena Okafor" });
  });

  it("returns both options when a first name is shared", () => {
    expect(resolveClient("Priya", names)).toEqual({ kind: "ambiguous", options: ["Priya Shah", "Priya Kapoor"] });
  });

  it("returns not found for an unknown name", () => {
    expect(resolveClient("Rohan", names)).toEqual({ kind: "not_found" });
  });

  it("folds case and accents", () => {
    expect(resolveClient("renee dubois", names)).toEqual({ kind: "found", name: "Renée Dubois" });
    expect(resolveClient("LENA", names)).toEqual({ kind: "found", name: "Lena Okafor" });
  });

  it("matches a surname picked from the options", () => {
    expect(resolveClient("Shah", names)).toEqual({ kind: "found", name: "Priya Shah" });
  });
});

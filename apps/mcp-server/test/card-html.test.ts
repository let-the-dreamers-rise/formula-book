import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CARD } from "../src/card.ts";

// src/card-html.ts is generated from card/ by scripts/build-card.mjs; this fails when it is stale.
describe("generated card module", () => {
  it("matches the files in card/", () => {
    const read = (name: string) => readFileSync(new URL(`../card/${name}`, import.meta.url), "utf8");
    const html = read("template.html")
      .replace("{{style}}", () => read("card.css"))
      .replace("{{script}}", () => read("card.js"));
    expect(CARD.html).toBe(html);
    expect(CARD.hash).toBe(createHash("sha256").update(html).digest("hex").slice(0, 16));
  });
});

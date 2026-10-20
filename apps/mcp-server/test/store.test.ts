import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadSeeds } from "../src/seed.ts";
import { FileStore } from "../src/store.ts";

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "fb-store-"));
  dirs.push(dir);
  return dir;
}

describe("FileStore", () => {
  it("survives a restart", () => {
    const dir = tempDir();
    const first = new FileStore(dir);
    first.reset(loadSeeds());
    first.saveFormula("demo-salon", {
      client: "Marta",
      components: [{ shade: "6N", grams: 30 }],
      developerVolume: 20,
      developerRatio: 1,
    });
    const reopened = new FileStore(dir);
    const salon = reopened.getSalon("demo-salon");
    expect(salon?.clients).toContain("Marta");
    expect(salon?.formulas.at(-1)?.client).toBe("Marta");
  });

  it("seeds Demo Salon with three clients and Booth 12 with 50 formulas", () => {
    const store = new FileStore(tempDir());
    store.reset(loadSeeds());
    expect(store.getSalon("demo-salon")?.clients).toEqual(["Lena Okafor", "Priya Shah", "Priya Kapoor"]);
    expect(store.getSalon("booth12")?.formulas.length).toBe(50);
    expect(store.getSalon("booth12")?.name).toBe("Booth 12 (capped)");
  });

  it("returns new salon objects instead of changing old ones", () => {
    const store = new FileStore(tempDir());
    store.reset(loadSeeds());
    const before = store.getSalon("demo-salon");
    store.saveFormula("demo-salon", {
      client: "Lena Okafor",
      components: [{ shade: "5N", grams: 10 }],
      developerVolume: 10,
      developerRatio: 1,
    });
    expect(before?.formulas.length).toBe(3);
  });
});

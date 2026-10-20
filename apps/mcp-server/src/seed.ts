import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Salon } from "./store.ts";

const SEED_DIR = fileURLToPath(new URL("../../../seed/", import.meta.url));

export function loadSeeds(dir: string = SEED_DIR): readonly Salon[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => JSON.parse(readFileSync(`${dir}/${file}`, "utf8")) as Salon);
}

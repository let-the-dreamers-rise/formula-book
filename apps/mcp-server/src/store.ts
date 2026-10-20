import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Formula } from "@formula-book/core";

export interface FormulaRecord extends Formula {
  readonly id: string;
  readonly client: string;
  readonly savedAt: string;
}

export interface Salon {
  readonly id: string;
  readonly name: string;
  readonly demo: boolean;
  readonly clients: readonly string[];
  readonly formulas: readonly FormulaRecord[];
}

export type NewFormula = Omit<FormulaRecord, "id" | "savedAt">;

export interface Store {
  getSalon(id: string): Salon | undefined;
  saveFormula(salonId: string, formula: NewFormula): Salon;
  reset(salons: readonly Salon[]): void;
}

const SALON_ID = /^[a-z0-9-]+$/;

/** One JSON file per salon, written atomically. A single-node demo store, not a production database. */
export class FileStore implements Store {
  constructor(private readonly dir: string) {
    mkdirSync(dir, { recursive: true });
  }

  private path(id: string): string {
    if (!SALON_ID.test(id)) throw new Error(`Invalid salon id "${id}"`);
    return join(this.dir, `salon-${id}.json`);
  }

  private write(salon: Salon): void {
    const target = this.path(salon.id);
    const temp = `${target}.tmp`;
    writeFileSync(temp, JSON.stringify(salon, null, 2), "utf8");
    renameSync(temp, target);
  }

  getSalon(id: string): Salon | undefined {
    const path = this.path(id);
    if (!existsSync(path)) return undefined;
    return JSON.parse(readFileSync(path, "utf8")) as Salon;
  }

  saveFormula(salonId: string, formula: NewFormula): Salon {
    const salon = this.getSalon(salonId);
    if (!salon) throw new Error(`Salon "${salonId}" not found`);
    const record: FormulaRecord = {
      ...formula,
      id: `${salonId}-${salon.formulas.length + 1}-${Date.now()}`,
      savedAt: new Date().toISOString(),
    };
    const clients = salon.clients.includes(formula.client) ? salon.clients : [...salon.clients, formula.client];
    const next: Salon = { ...salon, clients, formulas: [...salon.formulas, record] };
    this.write(next);
    return next;
  }

  reset(salons: readonly Salon[]): void {
    for (const file of readdirSync(this.dir)) {
      if (file.startsWith("salon-") || file === "waitlist.json") rmSync(join(this.dir, file), { force: true });
    }
    salons.forEach((salon) => this.write(salon));
  }
}

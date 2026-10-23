import type { FormulaRecord, NewFormula, Salon, Store } from "./store.ts";

/** Keeps salons in memory, for the server running in a browser tab: state lasts until the tab reloads. */
export class MemoryStore implements Store {
  private salons: ReadonlyMap<string, Salon> = new Map();

  constructor(salons: readonly Salon[] = []) {
    this.reset(salons);
  }

  getSalon(id: string): Salon | undefined {
    return this.salons.get(id);
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
    this.salons = new Map([...this.salons, [salonId, next]]);
    return next;
  }

  reset(salons: readonly Salon[]): void {
    this.salons = new Map(salons.map((s) => [s.id, s]));
  }
}

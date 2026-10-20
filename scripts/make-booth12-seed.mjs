// Writes seed/booth12.json: five demo clients, ten formulas each, no random values.
// Run once with `node scripts/make-booth12-seed.mjs`; the output is committed.
import { writeFileSync } from "node:fs";

const clients = ["A", "B", "C", "D", "E"].map((letter) => `Demo Client ${letter}`);
const shades = ["4N", "5N", "6N", "7N", "6.3", "7.1", "8.1"];
const volumes = [10, 20, 30];

const formulas = Array.from({ length: 50 }, (_, i) => {
  const day = String(1 + (i % 28)).padStart(2, "0");
  const month = i < 28 ? "08" : "09";
  return {
    id: `booth12-${i + 1}`,
    client: clients[i % clients.length],
    savedAt: `2026-${month}-${day}T09:00:00Z`,
    components: [
      { shade: shades[i % shades.length], grams: 20 + (i % 4) * 5 },
      { shade: shades[(i + 3) % shades.length], grams: 10 + (i % 3) * 5 },
    ],
    developerVolume: volumes[i % volumes.length],
    developerRatio: i % 2 === 0 ? 1 : 1.5,
    processingMinutes: 30 + (i % 3) * 5,
  };
});

const salon = { id: "booth12", name: "Booth 12 (capped)", demo: true, clients, formulas };
writeFileSync(new URL("../seed/booth12.json", import.meta.url), JSON.stringify(salon, null, 2) + "\n");

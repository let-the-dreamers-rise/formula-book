import { resolveClient, scaleFormula, validateDeveloper } from "@formula-book/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { cardMeta } from "./card.ts";
import { chooseClient, type SessionInfo } from "./choose.ts";
import type { Config } from "./config.ts";
import { formulaResult, refusal, REFUSALS, type ToolResult } from "./results.ts";
import type { FormulaRecord, Salon, Store } from "./store.ts";

interface Deps {
  readonly store: Store;
  readonly config: Config;
  readonly session: SessionInfo;
  /** Test-only pause before each tool runs, so the loading state can be seen; 0 outside E2E. */
  readonly delayMs: () => number;
}

type Extra = { requestId: string | number };
type Resolved = { readonly name: string } | { readonly result: ToolResult };

const DESCRIPTIONS = {
  get_last_formula:
    "Call when the colourist asks for a client's last or previous formula, for example 'Lena's last formula'. " +
    "Returns that client's most recent saved formula: shades and grams, developer strength, ratio, processing time " +
    "and totals in grams. If two clients share the name it asks which one; if the client is unknown it says so and how to save one.",
  scale_formula:
    "Call when the colourist wants a client's last formula made bigger or smaller for today's bowl, for example " +
    "'make it one and a half times' or 'make it 150 grams in total'. Give exactly one of factor or target_total_grams. " +
    "Returns the scaled grams and totals. It does not change the saved formula.",
  save_formula:
    "Call when the colourist says a new formula for a client, for example 'colour Marta: 30 grams 6N and 20 grams 7.1, " +
    "20 volume, one to one and a half'. Saves it as that client's latest formula and returns it with totals in grams. " +
    "Refuses developer strengths other than 10, 20, 30 or 40 volume, and refuses when the salon's free plan is full.",
} as const;

const clientName = z.string().min(1).describe("The client's name as the colourist said it, for example 'Lena'.");

function titleCase(name: string): string {
  return name.trim().replace(/\s+/g, " ").replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

function latest(salon: Salon, client: string): FormulaRecord | undefined {
  return salon.formulas.filter((f) => f.client === client).at(-1);
}

export function registerTools(server: McpServer, deps: Deps): void {
  const { store, config, session } = deps;
  const salon = (): Salon => {
    const found = store.getSalon(session.salonId);
    if (!found) throw new Error(`Salon "${session.salonId}" has no data. Reset the demo or check SALON_TOKENS.`);
    return found;
  };
  const usage = (s: Salon) => ({ count: s.formulas.length, cap: config.cap });
  const pause = () => {
    const ms = config.e2e ? deps.delayMs() : 0;
    return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();
  };

  async function resolveExisting(s: Salon, spoken: string, tool: string, extra: Extra): Promise<Resolved> {
    const match = resolveClient(spoken, s.clients);
    if (match.kind === "found") return { name: match.name };
    if (match.kind === "not_found") return { result: refusal("not_found", REFUSALS.notFound(titleCase(spoken))) };
    const choice = await chooseClient(server, session, match.options, tool, extra.requestId);
    return choice.kind === "chosen" ? { name: choice.name } : { result: choice.result };
  }

  server.registerTool(
    "get_last_formula",
    {
      title: "Get a client's last formula",
      description: DESCRIPTIONS.get_last_formula,
      inputSchema: { client_name: clientName },
      annotations: { readOnlyHint: true },
      _meta: cardMeta("get"),
    },
    async ({ client_name }, extra) => {
      await pause();
      const s = salon();
      const resolved = await resolveExisting(s, client_name, "get_last_formula", extra);
      if ("result" in resolved) return resolved.result;
      const record = latest(s, resolved.name);
      if (!record) return refusal("no_formula", REFUSALS.noFormulaYet(resolved.name));
      return formulaResult({ action: "get", client: resolved.name, formula: record, demo: s.demo, usage: usage(s) });
    },
  );

  server.registerTool(
    "scale_formula",
    {
      title: "Scale a client's last formula",
      description: DESCRIPTIONS.scale_formula,
      inputSchema: {
        client_name: clientName,
        factor: z.number().optional().describe("Multiply every amount by this, for example 1.5."),
        target_total_grams: z.number().optional().describe("Scale so colour plus developer weighs this many grams."),
      },
      annotations: { readOnlyHint: true },
      _meta: cardMeta("scale"),
    },
    async ({ client_name, factor, target_total_grams }, extra) => {
      await pause();
      if ((factor === undefined) === (target_total_grams === undefined)) {
        return refusal("scale_which", REFUSALS.scaleWhich);
      }
      const s = salon();
      const resolved = await resolveExisting(s, client_name, "scale_formula", extra);
      if ("result" in resolved) return resolved.result;
      const record = latest(s, resolved.name);
      if (!record) return refusal("no_formula", REFUSALS.noFormulaYet(resolved.name));
      const by = factor !== undefined ? { factor } : { targetTotalGrams: target_total_grams as number };
      const scaled = scaleFormula(record, by);
      if (!scaled.ok) return refusal("bad_factor", scaled.reason);
      return formulaResult({
        action: "scale",
        client: resolved.name,
        formula: scaled.formula,
        factor: scaled.factor,
        demo: s.demo,
        usage: usage(s),
      });
    },
  );

  server.registerTool(
    "save_formula",
    {
      title: "Save a formula for a client",
      description: DESCRIPTIONS.save_formula,
      inputSchema: {
        client_name: clientName,
        components: z
          .array(z.object({ shade: z.string().min(1), grams: z.number().positive() }))
          .min(1)
          .describe("Each colour in the bowl: shade code and grams, for example 6N and 30."),
        developer_volume: z.number().describe("Developer strength in volume: 10, 20, 30 or 40."),
        developer_ratio: z.number().positive().optional().describe("Developer grams per gram of colour. 'One to one and a half' is 1.5. Default 1."),
        processing_minutes: z.number().int().positive().optional().describe("Processing time in minutes."),
        note: z.string().max(200).optional().describe("A short note, for example 'root touch-up'."),
      },
      _meta: cardMeta("save"),
    },
    async (args, extra) => {
      await pause();
      const s = salon();
      if (s.formulas.length >= config.cap) {
        return refusal("plan_full", REFUSALS.planFull(config.cap), { usage: usage(s) });
      }
      const developer = validateDeveloper(args.developer_volume);
      if (!developer.ok) return refusal("developer", developer.reason);
      const match = resolveClient(args.client_name, s.clients);
      let client = titleCase(args.client_name);
      if (match.kind === "found") client = match.name;
      if (match.kind === "ambiguous") {
        const choice = await chooseClient(server, session, match.options, "save_formula", extra.requestId);
        if (choice.kind === "result") return choice.result;
        client = choice.name;
      }
      const updated = store.saveFormula(s.id, {
        client,
        components: args.components,
        developerVolume: args.developer_volume,
        developerRatio: args.developer_ratio ?? 1,
        ...(args.processing_minutes !== undefined && { processingMinutes: args.processing_minutes }),
        ...(args.note !== undefined && { note: args.note }),
      });
      const record = updated.formulas.at(-1) as FormulaRecord;
      return formulaResult({ action: "save", client, formula: record, demo: updated.demo, usage: usage(updated) });
    },
  );
}

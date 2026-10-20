import { normaliseSpeech } from "@formula-book/core";

export type ToolName = "get_last_formula" | "scale_formula" | "save_formula";

export type ToolChoice =
  | { readonly tool: ToolName; readonly arguments: Readonly<Record<string, unknown>> }
  | { readonly tool: null; readonly reason: string };

export interface History {
  readonly lastClient?: string;
}

const SAVE = /^(?:colou?r|save)\s+(.+?)\s*[:,]\s*(.+)$/;
const RECALL_POSSESSIVE = /^(?:what(?:'s| is| was)\s+)?(.+?)'s\s+(?:last|previous)\s+formula\b/;
const RECALL_FOR = /\b(?:last|previous)\s+formula\s+for\s+(.+?)[?.!]*$/;
const SCALE_FACTOR = /^make\s+(it|.+?'s)\s+(\d+(?:\.\d+)?)\s+times\b/;
const SCALE_TOTAL = /^make\s+(it|.+?'s)\s+(\d+(?:\.\d+)?)\s*g\b/;
const COMPONENT = /(\d+(?:\.\d+)?) g (\d{1,2}(?:N|\.\d{1,2}))/g;

const NO_RULE = "I did not catch that. Try 'Lena's last formula' or 'colour Marta: 30 grams 6N, 20 volume, one to one'.";

function titleCase(name: string): string {
  return name.trim().replace(/\s+/g, " ").replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

function clientFrom(target: string, history: History): string | undefined {
  return target === "it" ? history.lastClient : titleCase(target.replace(/'s$/, ""));
}

function parseSave(name: string, rest: string): ToolChoice {
  const components = [...rest.matchAll(COMPONENT)].map((m) => ({ shade: m[2] as string, grams: Number(m[1]) }));
  const volume = rest.match(/(\d+) vol\b/);
  if (components.length === 0 || !volume) {
    return { tool: null, reason: "I heard a formula but not the grams of each shade and the developer volume. Please say it again." };
  }
  const ratio = rest.match(/ratio (\d+(?:\.\d+)?)/);
  const minutes = rest.match(/(\d+) min(?:ute)?s?\b/);
  return {
    tool: "save_formula",
    arguments: {
      client_name: titleCase(name),
      components,
      developer_volume: Number(volume[1]),
      developer_ratio: ratio ? Number(ratio[1]) : 1,
      ...(minutes && { processing_minutes: Number(minutes[1]) }),
    },
  };
}

/** The default chooser: fixed patterns over normalised speech. Anything else returns no tool. */
export function parseUtterance(utterance: string, history: History): ToolChoice {
  const text = normaliseSpeech(utterance.replace(/[‘’]/g, "'"));

  const save = text.match(SAVE);
  if (save) return parseSave(save[1] as string, save[2] as string);

  const recall = text.match(RECALL_POSSESSIVE) ?? text.match(RECALL_FOR);
  if (recall) return { tool: "get_last_formula", arguments: { client_name: titleCase(recall[1] as string) } };

  const byFactor = text.match(SCALE_FACTOR);
  const byTotal = byFactor ? null : text.match(SCALE_TOTAL);
  const scale = byFactor ?? byTotal;
  if (scale) {
    const client = clientFrom(scale[1] as string, history);
    if (!client) return { tool: null, reason: "Whose formula? Say a name first, for example 'Lena's last formula'." };
    const amount = Number(scale[2]);
    return {
      tool: "scale_formula",
      arguments: byFactor ? { client_name: client, factor: amount } : { client_name: client, target_total_grams: amount },
    };
  }

  return { tool: null, reason: NO_RULE };
}

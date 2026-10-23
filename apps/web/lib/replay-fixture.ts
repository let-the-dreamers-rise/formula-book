// Replay mode answers from replies recorded off the real Formula Book MCP server
// (scripts/record-replay.ts writes them). These are the pure rules for picking a recorded reply;
// nothing here makes one up.

type Json = Record<string, unknown>;

export interface RecordedCall {
  /** Saves made earlier in the recording: the reply is reused only once those saves happened here too. */
  readonly after: readonly string[];
  readonly result?: Json;
  /** A call where the server asked a question first, with the reply for each answer ("" is cancel). */
  readonly elicit?: { readonly params: Json; readonly choices: Readonly<Record<string, Json>> };
}

export interface RecordedUsage {
  readonly count: number;
  readonly cap: number;
  readonly price: string;
}

export interface ReplayFixture {
  readonly recordedAt: string;
  readonly initialize: Json;
  readonly toolsList: Json;
  readonly resources: Readonly<Record<string, Json>>;
  readonly usage: Readonly<Record<string, RecordedUsage>>;
  readonly calls: Readonly<Record<string, readonly RecordedCall[]>>;
}

export const CANCEL_CHOICE = "";

export const NOT_RECORDED =
  "Replay mode only has the server's recorded answers for the demo sentences, so it cannot answer that. Try a suggestion, or run the live server from the README.";

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Json;
    return `{${Object.keys(record)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(record[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/** One key per salon, tool and arguments, independent of argument order. */
export function callKey(salonToken: string, tool: string, args: unknown): string {
  return `${salonToken}|${tool}|${stable(args ?? {})}`;
}

export const isSaveKey = (key: string): boolean => key.split("|")[1] === "save_formula";

/** The recorded reply whose earlier saves have all happened in this replay; the most specific wins. */
export function pickCall(entries: readonly RecordedCall[] | undefined, saved: ReadonlySet<string>): RecordedCall | undefined {
  return (entries ?? [])
    .filter((entry) => entry.after.every((key) => saved.has(key)))
    .reduce<RecordedCall | undefined>((best, entry) => (!best || entry.after.length > best.after.length ? entry : best), undefined);
}

/** The reply for a call that was never recorded: a plain refusal, never a guessed formula. */
export function notRecordedResult(): Json {
  return { content: [{ type: "text", text: NOT_RECORDED }], structuredContent: { status: "refused", reason: "not_recorded" } };
}

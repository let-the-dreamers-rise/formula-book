// The optional model chooser: Claude picks one of the MCP server's tools from tools/list, as an
// Alexa+ host's model would. Pure request/response shaping; the API call lives in app/api/choose.
import type { ToolChoice, ToolName } from "./rule-parser";

export const CHOOSER_MODEL = "claude-haiku-5-5";
export const CHOOSER_LABEL = "Claude Haiku 5.5";
const MAX_TOKENS = 600;
/** Most tool calls one sentence may turn into, for example three bowls to prepare at once. */
export const MAX_STEPS = 3;
/** Most rounds of calls per sentence: for example, read the diary, then act on each client in it. */
export const MAX_ROUNDS = 3;

/** A call the model asked for, with the id its result must answer to. */
export type PlannedCall = ToolChoice & { readonly id?: string };

/** One finished round: the calls the model made and what the servers returned for each. */
export interface ChooserRound {
  readonly calls: readonly { readonly id: string; readonly name: string; readonly input: Record<string, unknown> }[];
  readonly results: readonly { readonly id: string; readonly content: string }[];
}

export interface ToolDef {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema: Record<string, unknown>;
}

export interface ChooserInput {
  readonly utterance: string;
  readonly lastClient?: string;
  readonly tools: readonly ToolDef[];
  readonly history?: readonly ChooserRound[];
}

function roundMessages(round: ChooserRound) {
  return [
    { role: "assistant" as const, content: round.calls.map((c) => ({ type: "tool_use" as const, id: c.id, name: c.name, input: c.input })) },
    { role: "user" as const, content: round.results.map((r) => ({ type: "tool_result" as const, tool_use_id: r.id, content: r.content })) },
  ];
}

export function buildChooserRequest(input: ChooserInput) {
  const about = input.lastClient
    ? `The conversation is about ${input.lastClient}; "it", "her", "him" or "them" mean that client.`
    : "No client has been discussed yet.";
  return {
    model: CHOOSER_MODEL,
    max_tokens: MAX_TOKENS,
    system:
      "You are the tool chooser in a simulated voice assistant at a hair salon's colour bar. " +
      "Pick the tool calls needed for what the colourist just said, with arguments that follow each tool's schema. " +
      `Usually that is one call. When they ask about several clients at once, make one call per client, at most ${MAX_STEPS}. ` +
      "The tools may come from more than one service. If you need to know who is booked first, ask the diary, " +
      "then act on each client it lists in the next round. When the work is done, reply with one short sentence and no tool calls. " +
      "Use client names as spoken. Put numbers as numbers: 'twice' is 2, 'one and a half times' is 1.5. " +
      "Never invent a formula the colourist did not say. If no tool fits, reply in one short sentence saying what you can do. " +
      about,
    tools: input.tools.map((t) => ({ name: t.name, description: t.description ?? "", input_schema: t.inputSchema })),
    tool_choice: { type: "auto" as const },
    messages: [{ role: "user" as const, content: input.utterance }, ...(input.history ?? []).flatMap(roundMessages)],
  };
}

interface ReplyBlock {
  readonly type: string;
  readonly id?: string;
  readonly name?: string;
  readonly input?: unknown;
  readonly text?: string;
}

export interface ChooserReply {
  readonly stop_reason: string | null;
  readonly content: readonly ReplyBlock[];
}

const NO_CHOICE = "I did not understand that. Try a client's name, or ask to scale or save a formula.";
const TOO_MANY = `That is more than ${MAX_STEPS} things at once. Ask for up to ${MAX_STEPS} clients.`;

function validCall(block: ReplyBlock, toolNames: readonly string[]): PlannedCall | undefined {
  const args = block.input;
  const ok = block.name !== undefined && toolNames.includes(block.name) && typeof args === "object" && args !== null && !Array.isArray(args);
  return ok ? { tool: block.name as ToolName, arguments: args as Record<string, unknown>, ...(block.id && { id: block.id }) } : undefined;
}

/**
 * The calls to make, in the model's order. All or nothing: one call the server does not offer, or
 * more than MAX_STEPS, and nothing runs. A finished reply with no call passes on the model's words.
 */
export function parseChooserPlan(reply: ChooserReply, toolNames: readonly string[]): readonly PlannedCall[] {
  if (reply.stop_reason === "max_tokens" || reply.stop_reason === "refusal") return [{ tool: null, reason: NO_CHOICE }];
  const uses = reply.content.filter((b) => b.type === "tool_use");
  if (uses.length > MAX_STEPS) return [{ tool: null, reason: TOO_MANY }];
  if (uses.length > 0) {
    const calls = uses.map((b) => validCall(b, toolNames));
    return calls.every((c): c is PlannedCall => c !== undefined) ? calls : [{ tool: null, reason: NO_CHOICE }];
  }
  const text = reply.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join(" ").trim();
  return [{ tool: null, reason: text || NO_CHOICE }];
}

/** The first step of the plan, for callers that take one tool. */
export function parseChooserReply(reply: ChooserReply, toolNames: readonly string[]): ToolChoice {
  return parseChooserPlan(reply, toolNames)[0] ?? { tool: null, reason: NO_CHOICE };
}

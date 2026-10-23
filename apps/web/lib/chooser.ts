// The optional model chooser: Claude picks one of the MCP server's tools from tools/list, as an
// Alexa+ host's model would. Pure request/response shaping; the API call lives in app/api/choose.
import type { ToolChoice, ToolName } from "./rule-parser";

export const CHOOSER_MODEL = "claude-haiku-5-5";
export const CHOOSER_LABEL = "Claude Haiku 5.5";
const MAX_TOKENS = 400;

export interface ToolDef {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema: Record<string, unknown>;
}

export interface ChooserInput {
  readonly utterance: string;
  readonly lastClient?: string;
  readonly tools: readonly ToolDef[];
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
      "Pick at most one of the given tools for what the colourist just said, with arguments that follow its schema. " +
      "Use client names as spoken. Put numbers as numbers: 'twice' is 2, 'one and a half times' is 1.5. " +
      "Never invent a formula the colourist did not say. If no tool fits, reply in one short sentence saying what you can do. " +
      about,
    tools: input.tools.map((t) => ({ name: t.name, description: t.description ?? "", input_schema: t.inputSchema })),
    tool_choice: { type: "auto" as const },
    messages: [{ role: "user" as const, content: input.utterance }],
  };
}

interface ReplyBlock {
  readonly type: string;
  readonly name?: string;
  readonly input?: unknown;
  readonly text?: string;
}

export interface ChooserReply {
  readonly stop_reason: string | null;
  readonly content: readonly ReplyBlock[];
}

const NO_CHOICE = "I did not understand that. Try a client's name, or ask to scale or save a formula.";

/** Accepts only a finished reply that names a tool the server offers, with object arguments. */
export function parseChooserReply(reply: ChooserReply, toolNames: readonly string[]): ToolChoice {
  if (reply.stop_reason === "max_tokens" || reply.stop_reason === "refusal") return { tool: null, reason: NO_CHOICE };
  const use = reply.content.find((b) => b.type === "tool_use");
  if (use) {
    const args = use.input;
    const valid = use.name !== undefined && toolNames.includes(use.name) && typeof args === "object" && args !== null && !Array.isArray(args);
    return valid ? { tool: use.name as ToolName, arguments: args as Record<string, unknown> } : { tool: null, reason: NO_CHOICE };
  }
  const text = reply.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join(" ").trim();
  return { tool: null, reason: text || NO_CHOICE };
}

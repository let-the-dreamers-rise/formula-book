import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ElicitResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { cancelled, needsChoice, type ToolResult } from "./results.ts";

export interface SessionInfo {
  readonly salonId: string;
  readonly protocolVersion: string;
}

export type Choice = { readonly kind: "chosen"; readonly name: string } | { readonly kind: "result"; readonly result: ToolResult };

const ELICITATION_SINCE = "2025-06-18";
const COUNT_WORDS = ["no", "one", "two", "three", "four", "five"];

export function choiceQuestion(options: readonly string[]): string {
  const first = options[0]?.split(" ")[0] ?? "clients";
  const count = COUNT_WORDS[options.length] ?? String(options.length);
  return `I have ${count} ${first}s: ${options.join(" and ")}. Which one?`;
}

/** Version strings are dates, so they compare as text. */
export function canElicit(server: McpServer, session: SessionInfo): boolean {
  return session.protocolVersion >= ELICITATION_SINCE && Boolean(server.server.getClientCapabilities()?.elicitation);
}

/**
 * Ask which client is meant. Elicitation goes out on the tool call's own POST stream
 * (relatedRequestId); a client that cannot elicit gets a needs_choice result instead.
 */
export async function chooseClient(
  server: McpServer,
  session: SessionInfo,
  options: readonly string[],
  tool: string,
  requestId: string | number,
): Promise<Choice> {
  const question = choiceQuestion(options);
  if (!canElicit(server, session)) return { kind: "result", result: needsChoice(question, options, tool) };
  const answer = await server.server.request(
    {
      method: "elicitation/create",
      params: {
        mode: "form",
        message: question,
        requestedSchema: {
          type: "object",
          properties: { client: { type: "string", title: "Client", enum: [...options] } },
          required: ["client"],
        },
      },
    },
    ElicitResultSchema,
    { relatedRequestId: requestId },
  );
  const picked = answer.action === "accept" ? answer.content?.client : undefined;
  if (typeof picked === "string" && options.includes(picked)) return { kind: "chosen", name: picked };
  return { kind: "result", result: cancelled() };
}

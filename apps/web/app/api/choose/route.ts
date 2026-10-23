import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { buildChooserRequest, CHOOSER_LABEL, parseChooserReply, type ChooserReply, type ToolDef } from "@/lib/chooser";

// Server only: the key comes from ANTHROPIC_API_KEY and never reaches the browser.
// CHOOSER=off hides the model chooser even when a key is set.
const MAX_UTTERANCE = 500;
const MAX_TOOLS = 10;
const LIMIT_PER_MINUTE = 30;
const calls: number[] = [];

function available(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) && process.env.CHOOSER !== "off";
}

function overLimit(now: number): boolean {
  while (calls.length && (calls[0] as number) < now - 60_000) calls.shift();
  if (calls.length >= LIMIT_PER_MINUTE) return true;
  calls.push(now);
  return false;
}

function parseBody(body: unknown): { utterance: string; lastClient?: string; tools: ToolDef[] } | undefined {
  const b = body as { utterance?: unknown; lastClient?: unknown; tools?: unknown };
  if (typeof b?.utterance !== "string" || !b.utterance.trim() || b.utterance.length > MAX_UTTERANCE) return undefined;
  if (!Array.isArray(b.tools) || b.tools.length === 0 || b.tools.length > MAX_TOOLS) return undefined;
  const tools = b.tools.filter(
    (t): t is ToolDef => typeof t?.name === "string" && typeof t?.inputSchema === "object" && t.inputSchema !== null,
  );
  if (tools.length !== b.tools.length) return undefined;
  return { utterance: b.utterance.trim(), lastClient: typeof b.lastClient === "string" ? b.lastClient : undefined, tools };
}

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

export function GET() {
  return NextResponse.json({ available: available(), label: CHOOSER_LABEL });
}

export async function POST(request: Request) {
  if (!available()) return fail(404, "The Claude chooser is not set up on this server.");
  const input = parseBody(await request.json().catch(() => undefined));
  if (!input) return fail(400, "Send an utterance and the server's tool list.");
  if (overLimit(Date.now())) return fail(429, "Too many requests to the Claude chooser. Wait a minute.");
  try {
    const client = new Anthropic();
    // Tool schemas come from the MCP server's tools/list (JSON Schema objects), so the cast is to the SDK's type for them.
    const params = buildChooserRequest(input) as unknown as Anthropic.MessageCreateParamsNonStreaming;
    const reply = await client.messages.create(params);
    const choice = parseChooserReply(reply as unknown as ChooserReply, input.tools.map((t) => t.name));
    return NextResponse.json({ ok: true, choice, label: CHOOSER_LABEL, usage: reply.usage });
  } catch (error) {
    const status = error instanceof Anthropic.APIError ? (error.status ?? 502) : 502;
    console.error("Claude chooser failed:", status, error instanceof Error ? error.message : String(error));
    return fail(502, `The Claude chooser did not answer (status ${status}). Switch to the rule parser.`);
  }
}

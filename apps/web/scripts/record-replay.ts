// Records the real MCP server's replies for replay mode into lib/replay-fixture.json.
// Needs a running server started with DEMO_ADMIN=1 (it resets the demo data before and after).
// Usage: MCP_URL=http://127.0.0.1:8787/mcp npx tsx apps/web/scripts/record-replay.ts
import { writeFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { ElicitRequestSchema, type JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { SALONS } from "../lib/config.ts";
import { CANCEL_CHOICE, callKey, type RecordedCall, type RecordedUsage } from "../lib/replay-fixture.ts";
import { parseUtterance } from "../lib/rule-parser.ts";

type Json = Record<string, unknown>;
const MCP_URL = process.env.MCP_URL || "http://127.0.0.1:8787/mcp";
const ORIGIN = new URL(MCP_URL).origin;
const OUT = new URL("../lib/replay-fixture.json", import.meta.url);

/** Passes messages through and keeps the raw result of the latest reply to each method. */
class RecordingTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: Transport["onmessage"];
  readonly last = new Map<string, Json>();
  private readonly methods = new Map<string, string>();

  constructor(private readonly inner: Transport) {}

  get sessionId(): string | undefined {
    return this.inner.sessionId;
  }

  setProtocolVersion(version: string): void {
    this.inner.setProtocolVersion?.(version);
  }

  async start(): Promise<void> {
    this.inner.onmessage = (message, extra) => {
      const m = message as Json & { id?: string | number; result?: Json };
      const method = this.methods.get(String(m.id));
      if (method && m.result) this.last.set(method, m.result);
      this.onmessage?.(message, extra);
    };
    this.inner.onerror = (error) => this.onerror?.(error);
    this.inner.onclose = () => this.onclose?.();
    await this.inner.start();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    const m = message as Json & { id?: string | number; method?: string };
    if (m.method && m.id !== undefined) this.methods.set(String(m.id), m.method);
    await this.inner.send(message);
  }

  async close(): Promise<void> {
    await this.inner.close();
  }
}

interface Recorder {
  readonly client: Client;
  readonly wire: RecordingTransport;
  readonly token: string;
  pick: string;
  asked?: Json;
}

async function open(token: string): Promise<Recorder> {
  const client = new Client({ name: "formula-book-recorder", version: "0.1.0" }, { capabilities: { elicitation: { form: {} } } });
  const wire = new RecordingTransport(
    new StreamableHTTPClientTransport(new URL(MCP_URL), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }),
  );
  const recorder: Recorder = { client, wire, token, pick: CANCEL_CHOICE };
  client.setRequestHandler(ElicitRequestSchema, async (request) => {
    recorder.asked = request.params as Json;
    return recorder.pick ? { action: "accept", content: { client: recorder.pick } } : { action: "cancel" };
  });
  await client.connect(wire);
  return recorder;
}

const calls = new Map<string, readonly RecordedCall[]>();
let saved: readonly string[] = [];

function add(key: string, entry: RecordedCall): void {
  calls.set(key, [...(calls.get(key) ?? []), entry]);
}

async function callOnce(r: Recorder, tool: string, args: Json, pick: string): Promise<Json> {
  r.pick = pick;
  r.asked = undefined;
  await r.client.callTool({ name: tool, arguments: args });
  const result = r.wire.last.get("tools/call");
  if (!result) throw new Error(`No result recorded for ${tool}`);
  return result;
}

/** Records one call; when the server asks which client, records the reply to each answer. */
async function record(r: Recorder, tool: string, args: Json, picks: readonly string[] = []): Promise<Json> {
  const key = callKey(r.token, tool, args);
  const after = saved.filter((saveKey) => saveKey.startsWith(`${r.token}|`));
  const first = await callOnce(r, tool, args, picks[0] ?? CANCEL_CHOICE);
  if (!r.asked) {
    add(key, { after, result: first });
    const status = (first.structuredContent as Json | undefined)?.status;
    if (tool === "save_formula" && status === "ok") saved = [...saved, key];
    return first;
  }
  const params = r.asked;
  const choices: Record<string, Json> = { [picks[0] ?? CANCEL_CHOICE]: first };
  for (const pick of picks.slice(1)) choices[pick] = await callOnce(r, tool, args, pick);
  add(key, { after, elicit: { params, choices } });
  return first;
}

function lastClientOf(result: Json, fallback?: string): string | undefined {
  const data = result.structuredContent as Json | undefined;
  return data?.status === "ok" && typeof data.client === "string" ? data.client : fallback;
}

/** Says the sentences through the same rule parser the sim uses, so the recorded arguments match. */
async function say(r: Recorder, sentences: readonly string[], picks: Readonly<Record<string, readonly string[]>> = {}): Promise<void> {
  let lastClient: string | undefined;
  for (const sentence of sentences) {
    const choice = parseUtterance(sentence, { lastClient });
    if (choice.tool === null) throw new Error(`The rule parser has no tool for "${sentence}"`);
    const result = await record(r, choice.tool, { ...choice.arguments }, picks[sentence]);
    lastClient = lastClientOf(result, lastClient);
  }
}

async function reset(): Promise<void> {
  const response = await fetch(`${ORIGIN}/admin/reset-demo`, { method: "POST" });
  if (!response.ok) throw new Error(`reset-demo answered ${response.status}; start the server with DEMO_ADMIN=1`);
}

async function usageOf(token: string): Promise<RecordedUsage> {
  const response = await fetch(`${ORIGIN}/plan/usage`, { headers: { Authorization: `Bearer ${token}` } });
  return (await response.json()) as RecordedUsage;
}

const [demo, booth] = SALONS;
if (!demo || !booth) throw new Error("Expected the two demo salons in lib/config.ts");

await reset();
const usage = { [demo.token]: await usageOf(demo.token), [booth.token]: await usageOf(booth.token) };
const main = await open(demo.token);
const toolsList = main.wire.last.get("tools/list") ?? (await main.client.listTools(), main.wire.last.get("tools/list"));
const initialize = main.wire.last.get("initialize");
const uris = [...new Set(((toolsList?.tools ?? []) as Json[]).map((t) => (t._meta as { ui?: { resourceUri?: string } })?.ui?.resourceUri).filter(Boolean))] as string[];
const resources: Record<string, Json> = {};
for (const uri of uris) {
  await main.client.readResource({ uri });
  resources[uri] = main.wire.last.get("resources/read") as Json;
}

const priya = { "Priya's last formula": ["Priya Shah", "Priya Kapoor", CANCEL_CHOICE] };
await say(main, ["Lena's last formula", "Make it one and a half times", "Make it 2 times", "Make it 150 grams", "Make it 200 grams"]);
await say(main, ["Marta's last formula", "Rohan's last formula", "Priya's last formula"], priya);
await say(main, ["Colour Marta: 30 grams 6N and 20 grams 7.1, 20 volume, one to one and a half", "Make it one and a half times", "Make it 2 times"]);
await say(main, ["Marta's last formula", "Lena's last formula", "Priya's last formula", "Rohan's last formula"], priya);
await say(main, ["Priya Shah's last formula", "Make it one and a half times", "Priya Kapoor's last formula", "Make it one and a half times"]);
await main.client.close();

const capped = await open(booth.token);
await say(capped, ["Colour Ines: 30 grams 6N, 20 volume, one to one", "Lena's last formula"]);
await capped.client.close();
await reset();

const fixture = { recordedAt: new Date().toISOString(), initialize, toolsList, resources, usage, calls: Object.fromEntries(calls) };
writeFileSync(OUT, JSON.stringify(fixture, null, 1) + "\n");
console.log(`Recorded ${calls.size} calls and ${uris.length} card resource(s) to ${OUT.pathname}`);

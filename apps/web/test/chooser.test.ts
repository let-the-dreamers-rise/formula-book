import { describe, expect, it } from "vitest";
import { buildChooserRequest, CHOOSER_MODEL, parseChooserReply, type ToolDef } from "../lib/chooser.ts";

const tools: ToolDef[] = [
  { name: "get_last_formula", description: "Get a client's last formula.", inputSchema: { type: "object", properties: { client_name: { type: "string" } } } },
  { name: "scale_formula", description: "Scale it.", inputSchema: { type: "object", properties: { client_name: { type: "string" }, factor: { type: "number" } } } },
];

describe("building the chooser request", () => {
  const request = buildChooserRequest({ utterance: "Lena has thick hair today, go for twice the amount", lastClient: "Lena Okafor", tools });

  it("offers exactly the server's tools, with their schemas as given", () => {
    expect(request.tools.map((t) => t.name)).toEqual(["get_last_formula", "scale_formula"]);
    expect(request.tools[1]?.input_schema).toEqual(tools[1]?.inputSchema);
    expect(request.tool_choice).toEqual({ type: "auto" });
    expect(request.model).toBe(CHOOSER_MODEL);
  });

  it("tells the model who the conversation is about", () => {
    expect(request.system).toContain("Lena Okafor");
    expect(request.messages).toEqual([{ role: "user", content: "Lena has thick hair today, go for twice the amount" }]);
  });

  it("says when no client has been discussed", () => {
    expect(buildChooserRequest({ utterance: "hi", tools }).system).toContain("No client has been discussed yet");
  });
});

describe("reading the model's reply", () => {
  const names = tools.map((t) => t.name);

  it("returns the tool and arguments the model picked", () => {
    const reply = { stop_reason: "tool_use", content: [{ type: "tool_use", name: "scale_formula", input: { client_name: "Lena Okafor", factor: 2 } }] };
    expect(parseChooserReply(reply, names)).toEqual({ tool: "scale_formula", arguments: { client_name: "Lena Okafor", factor: 2 } });
  });

  it("passes on the model's words when it picks no tool", () => {
    const reply = { stop_reason: "end_turn", content: [{ type: "text", text: "I can only look up, scale or save formulas." }] };
    expect(parseChooserReply(reply, names)).toEqual({ tool: null, reason: "I can only look up, scale or save formulas." });
  });

  it("refuses a tool the server does not offer", () => {
    const reply = { stop_reason: "tool_use", content: [{ type: "tool_use", name: "delete_everything", input: {} }] };
    expect(parseChooserReply(reply, names)).toMatchObject({ tool: null });
  });

  it("refuses arguments that are not an object", () => {
    const reply = { stop_reason: "tool_use", content: [{ type: "tool_use", name: "scale_formula", input: "twice" }] };
    expect(parseChooserReply(reply, names)).toMatchObject({ tool: null });
  });

  it("treats a cut-off reply as no choice", () => {
    const reply = { stop_reason: "max_tokens", content: [{ type: "tool_use", name: "scale_formula", input: { factor: 2 } }] };
    expect(parseChooserReply(reply, names)).toMatchObject({ tool: null });
  });
});

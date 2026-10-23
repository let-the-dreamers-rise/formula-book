import type { ToolDef } from "./chooser";
import type { ToolChoice } from "./rule-parser";

export interface ChooserStatus {
  readonly available: boolean;
  readonly label: string;
}

export async function chooserStatus(): Promise<ChooserStatus> {
  const response = await fetch("/api/choose");
  return response.ok ? ((await response.json()) as ChooserStatus) : { available: false, label: "" };
}

/** Asks the server-side Claude chooser; throws with a plain message if it cannot answer. */
export async function chooseWithClaude(utterance: string, lastClient: string | undefined, tools: readonly ToolDef[]): Promise<ToolChoice> {
  const response = await fetch("/api/choose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ utterance, lastClient, tools }),
  });
  const body = (await response.json().catch(() => ({}))) as { choice?: ToolChoice; error?: string };
  if (!response.ok || !body.choice) throw new Error(body.error ?? "The Claude chooser did not answer. Switch to the rule parser.");
  return body.choice;
}

import { MCP_URL } from "./config";

export interface PlanUsage {
  readonly count: number;
  readonly cap: number;
  readonly price: string;
}

export interface WaitlistState {
  readonly count: number;
  readonly store: string;
}

const base = () => new URL(MCP_URL).origin;

async function json<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `The server answered ${response.status}.`);
  return body;
}

export async function fetchUsage(token: string): Promise<PlanUsage> {
  return json(await fetch(`${base()}/plan/usage`, { headers: { Authorization: `Bearer ${token}` } }));
}

export async function fetchWaitlist(): Promise<WaitlistState> {
  return json(await fetch(`${base()}/plan/waitlist`));
}

export async function joinWaitlist(email: string): Promise<WaitlistState> {
  return json(
    await fetch(`${base()}/plan/waitlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }),
  );
}

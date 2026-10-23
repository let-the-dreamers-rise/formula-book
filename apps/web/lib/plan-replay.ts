import type { PlanUsage, WaitlistState } from "./plan.ts";
import type { ReplayFixture } from "./replay-fixture.ts";

export const REPLAY_STORE_LABEL = "Replay, kept in this tab only";
const PRICE = "Hypothesis, payments not live";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let emails: readonly string[] = [];

/** The salon's usage as the server reported it when the replies were recorded. */
export function replayUsage(fixture: ReplayFixture, token: string): PlanUsage {
  return fixture.usage[token] ?? { count: 0, cap: 50, price: PRICE };
}

export const IN_TAB_STORE_LABEL = "Kept in this tab only";

export function replayWaitlist(store: string = REPLAY_STORE_LABEL): WaitlistState {
  return { count: emails.length, store };
}

/** Same rules as the server's waitlist, but nothing leaves the tab. */
export function replayJoin(email: string, store: string = REPLAY_STORE_LABEL): WaitlistState {
  const clean = email.trim().toLowerCase();
  if (clean.length > 254 || !EMAIL.test(clean)) throw new Error("Enter an email address, for example name@salon.com.");
  if (!emails.includes(clean)) emails = [...emails, clean];
  return replayWaitlist(store);
}

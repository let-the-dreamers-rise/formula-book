"use client";

import { useEffect, useState } from "react";
import { fetchUsage, fetchWaitlist, joinWaitlist, type PlanUsage, type WaitlistState } from "@/lib/plan";
import type { Usage } from "@/lib/interpret";

/** Where the panel reads usage and the waitlist: the server's REST routes, or replay's local copy. */
export interface PlanSource {
  readonly usage: (token: string) => Promise<PlanUsage>;
  readonly waitlist: () => Promise<WaitlistState>;
  readonly join: (email: string) => Promise<WaitlistState>;
}

const LIVE: PlanSource = { usage: fetchUsage, waitlist: fetchWaitlist, join: joinWaitlist };

interface Props {
  readonly token: string;
  /** Changes after every tool call and salon switch, so the meter re-reads the server. */
  readonly refreshKey: string;
  readonly source?: PlanSource;
  /** The usage the last tool result reported, used over the source's figure when present. */
  readonly reported?: Usage;
}

export function PlanPanel({ token, refreshKey, source = LIVE, reported }: Props) {
  const [fetched, setUsage] = useState<PlanUsage | undefined>(undefined);
  const usage = fetched && reported ? { ...fetched, count: reported.count, cap: reported.cap } : fetched;
  const [waitlist, setWaitlist] = useState<WaitlistState | undefined>(undefined);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    source.usage(token).then((u) => alive && setUsage(u)).catch(() => alive && setUsage(undefined));
    source.waitlist().then((w) => alive && setWaitlist(w)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [token, refreshKey, source]);

  const submit = async () => {
    try {
      setWaitlist(await source.join(email));
      setMessage({ kind: "ok", text: "You are on the waitlist. No payment is taken." });
      setEmail("");
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "The waitlist did not answer. Try again." });
    }
  };

  const percent = usage ? Math.min(100, Math.round((usage.count / Math.max(1, usage.cap)) * 100)) : 0;
  return (
    <section data-testid="plan-panel" aria-label="Plan" className="rounded-lg border border-black/10 bg-white p-4">
      <h2 className="font-semibold">Free plan</h2>
      <div className="mt-2 flex items-center gap-3">
        <div data-testid="usage-meter" role="meter" aria-valuemin={0} aria-valuemax={usage?.cap ?? 0} aria-valuenow={usage?.count ?? 0} className="h-3 flex-1 rounded bg-[var(--lcd)]">
          <div className="h-3 rounded bg-[var(--copper)]" style={{ width: `${percent}%` }} />
        </div>
        <span data-testid="usage-count" className="text-sm">
          {usage ? `${usage.count} of ${usage.cap}` : "..."}
        </span>
      </div>
      <p className="mt-1 text-sm text-black/70">formulas saved for this salon</p>
      <p className="mt-3 text-sm">
        Paid plan, unlimited formulas: <span data-testid="plan-price">{usage?.price ?? "Hypothesis, payments not live"}</span>
      </p>
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className="sr-only" htmlFor="waitlist-email">
          Email for the paid plan waitlist
        </label>
        <input
          id="waitlist-email"
          data-testid="waitlist-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@salon.com"
          className="min-h-11 flex-1 rounded border border-black/20 px-3"
        />
        <button data-testid="waitlist-submit" type="submit" className="min-h-11 rounded bg-[var(--ink)] px-4 text-white">
          Join waitlist
        </button>
      </form>
      <p className="mt-2 text-sm text-black/70">
        <span data-testid="waitlist-count">{waitlist?.count ?? 0}</span> on the waitlist,{" "}
        <span data-testid="waitlist-store-label">{waitlist?.store ?? "Local demo store"}</span>
      </p>
      {message?.kind === "ok" && (
        <p data-testid="waitlist-success" role="status" className="mt-1 text-sm text-[var(--developer)]">
          {message.text}
        </p>
      )}
      {message?.kind === "error" && (
        <p data-testid="waitlist-error" role="alert" className="mt-1 text-sm text-[var(--refuse)]">
          {message.text}
        </p>
      )}
    </section>
  );
}

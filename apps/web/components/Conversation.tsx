"use client";

import { useEffect, useRef, useState } from "react";
import { SUGGESTIONS } from "@/lib/config";
import type { SimState } from "@/lib/sim-state";
import { MicButton } from "./MicButton";

export function Conversation(props: { state: SimState; onSend: (text: string) => void; onVoiceError: (message: string) => void }) {
  const { state } = props;
  const [draft, setDraft] = useState("");
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [state.turns.length]);
  const submit = () => {
    props.onSend(draft);
    setDraft("");
  };
  return (
    <div className="rounded-lg border border-black/10 bg-white p-4">
      {state.turns.length === 0 ? (
        <div data-testid="empty-state">
          <p className="text-black/70">Say a client&apos;s name, or try one of these:</p>
          <div className="mt-2 flex flex-col gap-2">
            {SUGGESTIONS.map((text, i) => (
              <button
                key={text}
                data-testid={`suggestion-${i}`}
                className="min-h-11 rounded border border-black/15 px-3 text-left"
                onClick={() => props.onSend(text)}
              >
                {text}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <ol ref={list} className="flex max-h-56 flex-col gap-2 overflow-y-auto">
          {state.turns.map((turn, i) => (
            <li
              key={i}
              data-testid={turn.role === "user" ? "turn-user" : "turn-assistant"}
              className={turn.role === "user" ? "self-end rounded bg-[var(--lcd)] px-3 py-2" : "rounded bg-[var(--paper)] px-3 py-2"}
            >
              {turn.text}
            </li>
          ))}
        </ol>
      )}
      <p className="mt-3 flex min-h-6 items-baseline gap-2 text-sm text-black/70">
        <span className="shrink-0 rounded bg-[var(--lcd)] px-1.5 py-0.5 text-xs uppercase tracking-wide">Spoken</span>
        <span data-testid="spoken-reply" aria-live="polite">
          {state.spoken}
        </span>
      </p>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="sr-only" htmlFor="utterance">
          What the colourist says
        </label>
        <input
          id="utterance"
          data-testid="utterance-input"
          className="min-h-11 flex-1 rounded border border-black/20 px-3"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Lena's last formula"
          autoComplete="off"
        />
        <MicButton disabled={state.busy || state.status !== "connected"} onText={props.onSend} onError={props.onVoiceError} />
        <button
          data-testid="utterance-send"
          type="submit"
          disabled={state.busy || state.status !== "connected"}
          className="min-h-11 rounded bg-[var(--copper)] px-4 text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}

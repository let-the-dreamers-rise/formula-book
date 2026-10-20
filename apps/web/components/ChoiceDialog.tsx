"use client";

import { useEffect, useRef } from "react";
import type { Dialog } from "@/lib/sim-state";

export function ChoiceDialog(props: { dialog: Dialog; onChoose: (name: string | null) => void }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/30 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="choice-question"
        data-testid="elicit-dialog"
        data-source={props.dialog.source}
        className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg"
        onKeyDown={(e) => e.key === "Escape" && props.onChoose(null)}
      >
        <p id="choice-question" className="text-lg">
          {props.dialog.question}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {props.dialog.options.map((name, i) => (
            <button
              key={name}
              ref={i === 0 ? first : undefined}
              data-testid={`elicit-choice-${i}`}
              className="min-h-11 rounded border border-black/20 px-3 text-left"
              onClick={() => props.onChoose(name)}
            >
              {name}
            </button>
          ))}
          <button data-testid="elicit-cancel" className="min-h-11 rounded px-3 text-left text-black/60" onClick={() => props.onChoose(null)}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

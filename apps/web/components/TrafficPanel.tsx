"use client";

import { useEffect, useRef } from "react";
import type { TrafficRow } from "@/lib/traffic";

export function TrafficPanel({ rows }: { rows: readonly TrafficRow[] }) {
  const list = useRef<HTMLOListElement>(null);
  // Keep the newest message in view, as a console does.
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [rows.length]);
  return (
    <section data-testid="traffic-panel" aria-label="MCP traffic" className="rounded-lg bg-[var(--ink)] p-4 text-[var(--paper)] shadow-lg">
      <h2 className="flex items-baseline justify-between gap-2 font-semibold">
        <span>MCP traffic</span>
        <span className="text-xs font-normal text-white/60">JSON-RPC over Streamable HTTP, live</span>
      </h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-white/60">No MCP traffic yet.</p>
      ) : (
        <ol ref={list} className="mt-2 flex max-h-[50vh] flex-col gap-1 overflow-y-auto font-mono">
          {rows.map((row) => (
            <li
              key={row.key}
              data-testid="traffic-row"
              data-method={row.method}
              className={`rounded border px-2 py-1 text-xs ${row.failed ? "border-[#ff8a80] text-[#ff8a80]" : "border-white/10"}`}
            >
              <details>
                <summary className="cursor-pointer">
                  <span aria-label={row.direction === "out" ? "sent" : "received"}>{row.direction === "out" ? "->" : "<-"}</span>{" "}
                  <strong className="text-[#f0a37f]">{row.method}</strong> <span className="text-white/80">{row.summary}</span>
                  {row.response === undefined && "id" in (row.request as object) ? " (waiting)" : null}
                </summary>
                <pre data-testid="traffic-json" className="mt-1 max-h-64 overflow-auto text-[11px] text-white/80">
                  {JSON.stringify({ request: row.request, response: row.response }, null, 2)}
                </pre>
              </details>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

import type { TrafficRow } from "@/lib/traffic";

export function TrafficPanel({ rows }: { rows: readonly TrafficRow[] }) {
  return (
    <section data-testid="traffic-panel" aria-label="MCP traffic" className="rounded-lg border border-black/10 bg-white p-4">
      <h2 className="font-semibold">MCP traffic (JSON-RPC over Streamable HTTP)</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-black/60">No MCP traffic yet.</p>
      ) : (
        <ol className="mt-2 flex max-h-[70vh] flex-col gap-1 overflow-y-auto">
          {rows.map((row) => (
            <li
              key={row.key}
              data-testid="traffic-row"
              data-method={row.method}
              className={`rounded border px-2 py-1 text-sm ${row.failed ? "border-[var(--refuse)] text-[var(--refuse)]" : "border-black/10"}`}
            >
              <details>
                <summary className="cursor-pointer">
                  <span aria-label={row.direction === "out" ? "sent" : "received"}>{row.direction === "out" ? "->" : "<-"}</span>{" "}
                  <strong>{row.method}</strong> {row.summary}
                  {row.response === undefined && "id" in (row.request as object) ? " (waiting)" : null}
                </summary>
                <pre data-testid="traffic-json" className="mt-1 overflow-auto text-xs">
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

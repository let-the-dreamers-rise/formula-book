import type { SimState } from "@/lib/sim-state";

/** M1's plain view of the last tool result; the MCP Apps card replaces it in M2. */
export function ResultJson({ state }: { state: SimState }) {
  const result = state.result;
  if (!result) {
    return <p className="text-sm text-black/60">No formula shown yet.</p>;
  }
  const { view } = result;
  return (
    <div data-testid="result-json" className="rounded-lg border border-black/10 bg-white p-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt>Client</dt>
        <dd data-field="client">{view.client}</dd>
        <dt>Total</dt>
        <dd data-field="total">{view.total}</dd>
        <dt>Developer</dt>
        <dd data-field="developer">{view.developer}</dd>
        {view.scaleFactor && (
          <>
            <dt>Scaled</dt>
            <dd data-field="scale-factor">{view.scaleFactor}</dd>
          </>
        )}
        {view.saved && (
          <>
            <dt>Saved</dt>
            <dd data-field="saved">Saved</dd>
          </>
        )}
      </dl>
      {view.demo && (
        <span data-testid="demo-data-chip" className="mt-2 inline-block rounded bg-[var(--lcd)] px-2 py-1 text-xs text-black/60">
          Demo data
        </span>
      )}
      <pre className="mt-3 max-h-60 overflow-auto rounded bg-[var(--paper)] p-2 text-xs">{JSON.stringify(result.raw, null, 2)}</pre>
    </div>
  );
}

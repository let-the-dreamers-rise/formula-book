import { SALONS } from "@/lib/config";
import type { SimState } from "@/lib/sim-state";

const STATUS_TEXT = { connecting: "Connecting", connected: "Connected", unreachable: "Not reachable" } as const;

interface ChooserControl {
  readonly value: "rules" | "claude";
  /** The chooser that picked the last tool, shown on the badge. */
  readonly ranWith: string;
  /** Present only when the server has a Claude key and CHOOSER is not off. */
  readonly claudeLabel?: string;
  readonly onChange: (value: "rules" | "claude") => void;
}

export function TopBar(props: {
  state: SimState;
  replay: boolean;
  /** True when the second MCP server, the salon diary, is connected too. */
  diary?: boolean;
  onSalon: (id: string) => void;
  onNewSession: () => void;
  chooser: ChooserControl;
}) {
  const { state } = props;
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-black/10 bg-[var(--lcd)] px-4 py-3">
      <p className="font-[Georgia,serif] text-2xl font-semibold tracking-tight">Formula Book</p>
      <p data-testid="sim-banner" className="rounded bg-[var(--ink)] px-2 py-1 text-sm font-semibold text-white">
        {props.replay ? "Simulated Alexa+ surface. Recorded MCP server replies." : "Simulated Alexa+ surface. Real MCP server."}
      </p>
      <span data-testid="mode-badge" className="rounded bg-white px-2 py-1 text-sm">
        {props.replay ? "Replay" : "Live server"}
      </span>
      <span data-testid="chooser-badge" className="rounded bg-[var(--copper)] px-2 py-1 text-sm text-white">
        {props.chooser.ranWith}
      </span>
      {props.chooser.claudeLabel && (
        <label className="flex items-center gap-2 text-sm">
          Chooser
          <select
            data-testid="chooser-select"
            className="min-h-11 rounded border border-black/20 bg-white px-2"
            value={props.chooser.value}
            onChange={(e) => props.chooser.onChange(e.target.value === "claude" ? "claude" : "rules")}
          >
            <option value="rules">Rule parser</option>
            <option value="claude">{props.chooser.claudeLabel}</option>
          </select>
        </label>
      )}
      <span data-testid="server-status" className="rounded bg-white px-2 py-1 text-sm">
        {STATUS_TEXT[state.status]}
      </span>
      {props.diary && (
        <span data-testid="diary-status" className="rounded bg-white px-2 py-1 text-sm">
          + Salon diary server
        </span>
      )}
      <label className="ml-auto flex items-center gap-2 text-sm">
        Salon
        <select
          data-testid="salon-select"
          className="min-h-11 rounded border border-black/20 bg-white px-2"
          value={state.salonId}
          onChange={(e) => props.onSalon(e.target.value)}
        >
          {SALONS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <span data-testid="demo-data-chip" className="rounded bg-[var(--lcd)] px-2 py-1 text-sm text-black/60 ring-1 ring-black/10">
        Demo data
      </span>
      <button data-testid="new-session" className="min-h-11 rounded border border-black/30 bg-white px-3 text-sm" onClick={props.onNewSession}>
        New session
      </button>
      <span className="text-xs text-black/60">
        Session <span data-testid="session-id">{state.sessionId ?? "none"}</span>
        {state.protocolVersion && ` (protocol ${state.protocolVersion})`}
      </span>
    </header>
  );
}

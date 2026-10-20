import type { FormulaView, Usage } from "./interpret.ts";
import { applyTraffic, type TrafficEvent, type TrafficRow } from "./traffic.ts";

export interface Turn {
  readonly role: "user" | "assistant";
  readonly text: string;
}

export interface Dialog {
  readonly question: string;
  readonly options: readonly string[];
  readonly source: "elicitation" | "needs_choice";
}

export interface SimState {
  readonly status: "connecting" | "connected" | "unreachable";
  readonly error?: string;
  readonly salonId: string;
  readonly sessionId?: string;
  readonly protocolVersion?: string;
  readonly traffic: readonly TrafficRow[];
  readonly turns: readonly Turn[];
  readonly spoken: string;
  readonly result?: { readonly view: FormulaView; readonly raw: unknown };
  readonly lastClient?: string;
  readonly usage?: Usage;
  readonly dialog?: Dialog;
  readonly busy: boolean;
  readonly notice?: string;
  readonly toolsWarning?: string;
}

export type SimAction =
  | { readonly type: "connecting" }
  | { readonly type: "connected"; readonly sessionId?: string; readonly protocolVersion?: string }
  | { readonly type: "unreachable"; readonly error: string }
  | { readonly type: "traffic"; readonly event: TrafficEvent }
  | { readonly type: "user"; readonly text: string }
  | { readonly type: "reply"; readonly text: string; readonly usage?: Usage }
  | { readonly type: "result"; readonly view: FormulaView; readonly raw: unknown; readonly usage?: Usage }
  | { readonly type: "dialog"; readonly dialog?: Dialog }
  | { readonly type: "busy"; readonly busy: boolean }
  | { readonly type: "salon"; readonly salonId: string }
  | { readonly type: "failed"; readonly error: string }
  | { readonly type: "notice"; readonly notice?: string }
  | { readonly type: "toolsWarning"; readonly warning?: string };

export const initialState = (salonId: string): SimState => ({
  status: "connecting",
  salonId,
  traffic: [],
  turns: [],
  spoken: "",
  busy: false,
});

const say = (state: SimState, text: string): SimState => ({
  ...state,
  spoken: text,
  turns: [...state.turns, { role: "assistant", text }],
});

export function reduce(state: SimState, action: SimAction): SimState {
  switch (action.type) {
    case "connecting":
      return { ...state, status: "connecting", error: undefined, sessionId: undefined, toolsWarning: undefined };
    case "connected":
      return { ...state, status: "connected", error: undefined, sessionId: action.sessionId, protocolVersion: action.protocolVersion };
    case "unreachable":
      return { ...state, status: "unreachable", error: action.error };
    case "failed":
      return { ...state, error: action.error };
    case "traffic":
      return { ...state, traffic: applyTraffic(state.traffic, action.event) };
    case "user":
      return { ...state, error: undefined, turns: [...state.turns, { role: "user", text: action.text }] };
    case "reply":
      return { ...say(state, action.text), usage: action.usage ?? state.usage };
    case "result":
      return {
        ...state,
        result: { view: action.view, raw: action.raw },
        lastClient: action.view.client,
        usage: action.usage ?? state.usage,
      };
    case "dialog":
      return { ...state, dialog: action.dialog };
    case "busy":
      return { ...state, busy: action.busy };
    case "salon":
      return { ...initialState(action.salonId), traffic: state.traffic };
    case "notice":
      return { ...state, notice: action.notice };
    case "toolsWarning":
      return { ...state, toolsWarning: action.warning };
  }
}

"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { ElicitResult } from "@modelcontextprotocol/sdk/types.js";
import { MCP_URL, SALONS } from "@/lib/config";
import { cardUri, invokingText } from "@/lib/devices";
import { interpretResult, type Interpreted } from "@/lib/interpret";
import { parseUtterance } from "@/lib/rule-parser";
import { openSession, type LiveSession } from "@/lib/session";
import { initialState, reduce } from "@/lib/sim-state";
import { speak } from "@/lib/voice";
import { ChoiceDialog } from "./ChoiceDialog";
import { Conversation } from "./Conversation";
import { DeviceStage } from "./DeviceStage";
import { PlanPanel } from "./PlanPanel";
import { ResultJson } from "./ResultJson";
import { TopBar } from "./TopBar";
import { TrafficPanel } from "./TrafficPanel";

type Pick = (name: string | null) => void;

function offeredProtocol(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return new URLSearchParams(window.location.search).get("protocol") ?? undefined;
}

export function Sim() {
  const [state, dispatch] = useReducer(reduce, SALONS[0]?.id ?? "demo-salon", initialState);
  const [sessionNonce, setSessionNonce] = useState(0);
  const [protocol, setProtocol] = useState<string | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const session = useRef<LiveSession | undefined>(undefined);
  const pick = useRef<Pick | undefined>(undefined);
  const latest = useRef(state);
  latest.current = state;

  useEffect(() => {
    setProtocol(offeredProtocol());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    const epoch = Date.now();
    const token = SALONS.find((s) => s.id === state.salonId)?.token ?? "";
    dispatch({ type: "connecting" });
    openSession({
      url: MCP_URL,
      token,
      // A client offering 2025-03-26 cannot elicit, so it does not declare the capability.
      elicitation: protocol === undefined || protocol >= "2025-06-18",
      offerProtocol: protocol,
      onTraffic: (direction, message) => alive && dispatch({ type: "traffic", event: { direction, message, epoch, at: Date.now() } }),
      onElicit: (prompt) =>
        new Promise<ElicitResult>((resolve) => {
          dispatch({ type: "dialog", dialog: { ...prompt, source: "elicitation" } });
          pick.current = (name) => resolve(name ? { action: "accept", content: { client: name } } : { action: "cancel" });
        }),
    })
      .then((live) => {
        if (!alive) return void live.close();
        session.current = live;
        dispatch({ type: "connected", sessionId: live.sessionId, protocolVersion: live.protocolVersion });
        if (live.card || live.cardError) dispatch({ type: "card", card: live.card, error: live.cardError });
        if (live.toolsError) dispatch({ type: "toolsWarning", warning: `Could not read the server's tool list (${live.toolsError}). The rule parser continues with the three tools it knows.` });
      })
      .catch((error: unknown) => {
        if (alive) dispatch({ type: "unreachable", error: error instanceof Error ? error.message : String(error) });
      });
    return () => {
      alive = false;
      void session.current?.close();
      session.current = undefined;
    };
  }, [ready, state.salonId, sessionNonce, protocol]);

  const handle = useCallback((out: Interpreted, tool: string, args: Record<string, unknown>, toolResult: unknown) => {
    if (out.kind === "formula") {
      dispatch({ type: "result", view: out.view, raw: out.raw, toolResult, usage: out.usage });
      dispatch({ type: "reply", text: out.text });
    } else if (out.kind === "choice") {
      dispatch({ type: "dialog", dialog: { question: out.question, options: out.options, source: "needs_choice" } });
      pick.current = (name) => {
        if (name) void run(tool, { ...args, client_name: name });
        else dispatch({ type: "reply", text: "No problem. Nothing was changed." });
      };
    } else if (out.kind === "error") {
      dispatch({ type: "failed", error: out.text });
    } else {
      dispatch({ type: "reply", text: out.text, usage: out.kind === "refusal" ? out.usage : undefined });
    }
  }, []); // run is reached through the closure; both only touch refs and dispatch

  // The card is normally prefetched when the session opens; this covers a result linking a new one.
  const loadCard = useCallback(async (live: LiveSession, uri: string | undefined) => {
    if (!uri || latest.current.card?.uri === uri) return;
    try {
      dispatch({ type: "card", card: { uri, html: await live.readCard(uri) } });
    } catch (error) {
      dispatch({ type: "card", error: error instanceof Error ? error.message : String(error) });
    }
  }, []);

  const run = useCallback(
    async (tool: string, args: Record<string, unknown>) => {
      const live = session.current;
      if (!live) {
        dispatch({ type: "failed", error: "The Formula Book server is not reachable." });
        return;
      }
      dispatch({ type: "busy", busy: true, invoking: invokingText(live.toolMeta, tool) });
      try {
        const result = await live.client.callTool({ name: tool, arguments: args });
        await loadCard(live, cardUri(result));
        handle(interpretResult(result as Parameters<typeof interpretResult>[0]), tool, args, result);
      } catch (error) {
        dispatch({ type: "failed", error: error instanceof Error ? error.message : String(error) });
      } finally {
        dispatch({ type: "busy", busy: false });
      }
    },
    [handle, loadCard],
  );

  const send = useCallback(
    async (utterance: string) => {
      const text = utterance.trim();
      if (!text || latest.current.busy) return;
      dispatch({ type: "user", text });
      const choice = parseUtterance(text, { lastClient: latest.current.lastClient });
      if (choice.tool === null) dispatch({ type: "reply", text: choice.reason });
      else if (session.current?.tools && !session.current.tools.includes(choice.tool)) {
        dispatch({ type: "failed", error: `The server does not offer the ${choice.tool} tool.` });
      } else await run(choice.tool, { ...choice.arguments });
    },
    [run],
  );

  // Speak each new reply; the turn count changes even when two replies have the same words.
  const [voiceOut, setVoiceOut] = useState(true);
  const replies = state.turns.filter((t) => t.role === "assistant").length;
  useEffect(() => {
    if (voiceOut && replies > 0) speak(latest.current.spoken);
  }, [replies, voiceOut]);

  const choose = (name: string | null) => {
    const resolve = pick.current;
    pick.current = undefined;
    dispatch({ type: "dialog", dialog: undefined });
    resolve?.(name);
  };

  return (
    <div className="min-h-screen">
      <TopBar
        state={state}
        onSalon={(salonId) => dispatch({ type: "salon", salonId })}
        onNewSession={() => setSessionNonce((n) => n + 1)}
      />
      {state.toolsWarning && (
        <p data-testid="tools-warning" role="status" className="mx-4 mt-3 rounded border border-[var(--copper)] bg-white px-4 py-2 text-sm">
          {state.toolsWarning}
        </p>
      )}
      {state.error && (
        <div data-testid="error-banner" role="alert" className="mx-4 mt-3 rounded border border-[var(--refuse)] bg-white px-4 py-3 text-[var(--refuse)]">
          <p>{state.status === "unreachable" ? "The Formula Book server is not reachable." : state.error}</p>
          <button
            data-testid="switch-to-replay"
            className="mt-2 min-h-11 rounded border border-[var(--ink)] px-3 text-[var(--ink)]"
            onClick={() => dispatch({ type: "notice", notice: "Replay is not available in this build yet." })}
          >
            Switch to replay
          </button>
          {state.notice && <p className="mt-2 text-[var(--ink)]">{state.notice}</p>}
        </div>
      )}
      <main className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="flex flex-col gap-4">
          <DeviceStage state={state} onDevice={(device) => dispatch({ type: "device", device })} />
          <Conversation state={state} onSend={send} onVoiceError={(message) => dispatch({ type: "reply", text: message })} />
          <label className="flex items-center gap-2 text-sm">
            <input
              data-testid="speak-toggle"
              type="checkbox"
              className="size-5"
              checked={voiceOut}
              onChange={(e) => setVoiceOut(e.target.checked)}
            />
            Speak replies aloud (browser voice, not Alexa)
          </label>
        </section>
        <section className="flex flex-col gap-4">
          <PlanPanel
            token={SALONS.find((s) => s.id === state.salonId)?.token ?? ""}
            refreshKey={`${state.salonId}:${state.status}:${state.turns.length}`}
          />
          <TrafficPanel rows={state.traffic} />
          <label className="flex items-center gap-2 text-sm">
            <input
              data-testid="debug-toggle"
              type="checkbox"
              className="size-5"
              checked={state.debug}
              onChange={(e) => dispatch({ type: "debug", debug: e.target.checked })}
            />
            Show the raw result (debug)
          </label>
          {state.debug && <ResultJson state={state} />}
        </section>
      </main>
      {state.dialog && <ChoiceDialog dialog={state.dialog} onChoose={choose} />}
    </div>
  );
}

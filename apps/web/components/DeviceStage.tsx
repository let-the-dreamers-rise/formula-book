"use client";

import { DEVICES, deviceById, type DeviceId } from "@/lib/devices";
import type { SimState } from "@/lib/sim-state";
import { CardFrame } from "./CardFrame";

function SkeletonCard({ text, overlay }: { text: string; overlay: boolean }) {
  return (
    <div
      data-testid="skeleton-card"
      role="status"
      className={`${overlay ? "absolute inset-0" : ""} min-h-[260px] rounded-[10px] bg-[var(--paper)] p-5`}
    >
      <p className="text-sm text-black/60">{text}</p>
      <div className="mt-3 h-6 w-3/5 rounded bg-[var(--lcd)]" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="mt-4 h-4 rounded bg-[var(--lcd)] opacity-70" />
      ))}
    </div>
  );
}

function SpeakerView({ state }: { state: SimState }) {
  const line = state.busy ? (state.invoking ?? "Working on it") : state.spoken || "Say a client's name";
  return (
    <div data-testid="speaker-view" className="flex flex-col items-center gap-4 py-8 text-center">
      <div aria-hidden className={`flex h-12 items-end gap-1 ${state.busy ? "waveform-busy" : ""}`}>
        {[14, 28, 40, 24, 34, 18, 30, 12].map((h, i) => (
          <span key={i} className="waveform-bar w-1.5 rounded-full bg-[var(--developer)]" style={{ height: h, animationDelay: `${i * 90}ms` }} />
        ))}
      </div>
      <p className="max-w-md text-[var(--paper)]">{line}</p>
    </div>
  );
}

function CardArea({ state }: { state: SimState }) {
  const device = deviceById(state.device);
  const toolResult = state.result?.toolResult;
  const showCard = Boolean(state.card && toolResult);
  return (
    <div className="relative">
      {showCard && state.card && <CardFrame html={state.card.html} toolResult={toolResult} hostContext={device.hostContext} />}
      {state.busy && <SkeletonCard text={state.invoking ?? "Working on it"} overlay={showCard} />}
      {!showCard && !state.busy && (
        <p data-testid="card-empty" className="min-h-[120px] rounded-[10px] bg-[var(--paper)] p-5 text-black/60">
          {state.cardError ? `The card could not load: ${state.cardError}` : "No formula on screen yet."}
        </p>
      )}
    </div>
  );
}

export function DeviceStage(props: { state: SimState; onDevice: (id: DeviceId) => void }) {
  const { state } = props;
  const device = deviceById(state.device);
  return (
    <section aria-label="Simulated device" className="flex flex-col gap-3">
      <div role="group" aria-label="Device" className="flex gap-2">
        {DEVICES.map((d) => (
          <button
            key={d.id}
            data-testid={d.testId}
            aria-pressed={d.id === state.device}
            className="min-h-11 rounded border border-black/20 px-3 text-sm aria-pressed:bg-[var(--ink)] aria-pressed:text-white"
            onClick={() => props.onDevice(d.id)}
          >
            {d.label}
          </button>
        ))}
      </div>
      <div
        data-testid="device-frame"
        data-class={device.hostContext.deviceClass}
        className="mx-auto w-full rounded-[28px] bg-[var(--ink)] p-3 shadow-lg"
        style={{ maxWidth: device.frameWidth ?? (device.showsCard ? 720 : 480) }}
      >
        <p className="px-2 pb-2 text-xs text-white/60">Simulated {device.label.toLowerCase()}</p>
        {device.showsCard ? <CardArea state={state} /> : <SpeakerView state={state} />}
      </div>
    </section>
  );
}

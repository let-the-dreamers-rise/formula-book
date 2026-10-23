"use client";

import { useEffect, useRef, useState } from "react";
import { canListen, createListener, type Listener } from "@/lib/voice";

export function MicButton(props: { disabled: boolean; onText: (text: string) => void; onError: (message: string) => void }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const listener = useRef<Listener | undefined>(undefined);
  const handlers = useRef(props);
  handlers.current = props;

  useEffect(() => {
    setSupported(canListen());
    return () => listener.current?.stop();
  }, []);

  const toggle = () => {
    if (listening) {
      listener.current?.stop();
      return;
    }
    listener.current = createListener({
      onText: (text) => handlers.current.onText(text),
      onError: (message) => handlers.current.onError(message),
      onEnd: () => setListening(false),
    });
    if (!listener.current) return;
    setListening(true);
    listener.current.start();
  };

  return (
    <button
      type="button"
      data-testid="mic-button"
      aria-pressed={listening}
      disabled={props.disabled || !supported}
      title={supported ? "Speak to the simulated device (Chrome)" : "Voice input needs Chrome"}
      onClick={toggle}
      className="min-h-11 rounded border border-[var(--ink)] px-3 aria-pressed:bg-[var(--refuse)] aria-pressed:text-white disabled:opacity-50"
    >
      {listening ? "Listening" : "Mic"}
    </button>
  );
}

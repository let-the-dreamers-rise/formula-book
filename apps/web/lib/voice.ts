// Browser voice in and out. Chrome's Web Speech recognition may send audio to its vendor's
// service; the README says so. Speech out reads the server's text, not Alexa's voice.

interface RecognitionResultEvent {
  readonly results: ArrayLike<ArrayLike<{ readonly transcript: string }> & { readonly isFinal: boolean }>;
}

interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { readonly error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type RecognitionCtor = new () => Recognition;

export interface Listener {
  start(): void;
  stop(): void;
}

export interface ListenHandlers {
  readonly onText: (text: string) => void;
  readonly onError: (message: string) => void;
  readonly onEnd: () => void;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "The microphone is blocked. Allow it in the browser, or type instead.",
  "no-speech": "I did not hear anything. Try again, or type instead.",
  network: "Speech recognition needs a network connection in this browser. Type instead.",
};

function recognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function canListen(): boolean {
  return recognitionCtor() !== undefined;
}

/** One utterance per start(): the final transcript goes to onText. */
export function createListener(handlers: ListenHandlers): Listener | undefined {
  const Ctor = recognitionCtor();
  if (!Ctor) return undefined;
  const recognition = new Ctor();
  recognition.lang = "en-GB";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = (event) => {
    const result = event.results[event.results.length - 1];
    const text = result?.[0]?.transcript?.trim();
    if (result?.isFinal && text) handlers.onText(text);
  };
  recognition.onerror = (event) => handlers.onError(ERRORS[event.error] ?? `Speech recognition stopped (${event.error}). Type instead.`);
  recognition.onend = handlers.onEnd;
  return { start: () => recognition.start(), stop: () => recognition.stop() };
}

export function speak(text: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-GB";
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

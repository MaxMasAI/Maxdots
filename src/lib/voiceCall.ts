"use client";

import { saveVoiceLine, sendGeminiVoiceMessage, sendVoiceTask, startVoiceCall } from "@/app/actions";
import { getState, onMessage } from "./store";

// Live voice call manager, kept outside React so it survives navigation.
// Supports both Google Gemini Voice models and OpenAI Realtime WebRTC.
// Every finished line is saved into the chat the call belongs to, so the conversation carries on in text.

export type CallStatus = "connecting" | "listening" | "speaking" | "ended" | "error";
export type CallLine = { id: number; who: "you" | "dot" | "note"; text: string };
export type Call = {
  dotId: string;
  conversationId: string;
  status: CallStatus;
  muted: boolean;
  lines: CallLine[];
  error?: string;
  startedAt: number;
  provider?: "openai" | "gemini";
  model?: string;
};

let current: Call | null = null;
let teardown: (() => void) | null = null;
let setMic: ((on: boolean) => void) | null = null;
let lineSeq = 0;
const listeners = new Set<() => void>();

const publish = (patch: Partial<Call>) => {
  if (!current) return;
  current = { ...current, ...patch };
  for (const l of listeners) l();
};

const addLine = (who: CallLine["who"], text: string) => {
  if (!current || !text.trim()) return;
  publish({ lines: [...current.lines, { id: ++lineSeq, who, text: text.trim() }].slice(-40) });
  if (who !== "note") void saveVoiceLine(current.dotId, current.conversationId, who, text);
};

export function subscribeCall(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export const getCall = () => current;

export function endCall() {
  teardown?.();
  teardown = null;
  setMic = null;
  if (current) publish({ status: current.status === "error" ? "error" : "ended" });
  current = null;
  for (const l of listeners) l();
}

export function setMuted(muted: boolean) {
  setMic?.(!muted);
  publish({ muted });
}

/** Starts a Gemini Voice call: microphone capture + browser speech recognition + server Gemini turn-taking + spoken synthesis. */
async function startGeminiVoiceCall(dotId: string, conversationId: string, initialGreeting?: string) {
  let mic: MediaStream | null = null;
  let recognition: any = null;
  let isRecognitionActive = true;
  let isSpeakingDot = false;
  let silenceTimer: any = null;
  let lastProcessedSpeech = "";
  let unsubscribe: (() => void) | null = null;

  const speakText = (text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        resolve();
        return;
      }
      try {
        window.speechSynthesis.cancel();
      } catch {}

      const cleanText = text.replace(/[*_#`~[\]]/g, "").trim();
      if (!cleanText) {
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find((v) => /Google|Natural|Samantha|Karen|Jenny|Guy|Microsoft/i.test(v.name) && v.lang.startsWith("en")) ||
        voices.find((v) => v.lang.startsWith("en"));
      if (preferred) utterance.voice = preferred;

      isSpeakingDot = true;
      publish({ status: "speaking" });

      utterance.onend = () => {
        isSpeakingDot = false;
        if (current?.status === "speaking") publish({ status: "listening" });
        resolve();
      };
      utterance.onerror = () => {
        isSpeakingDot = false;
        if (current?.status === "speaking") publish({ status: "listening" });
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  };

  const handleUserSpeech = async (spokenText: string) => {
    const text = spokenText.trim();
    if (!text || text === lastProcessedSpeech || isSpeakingDot || current?.muted) return;
    lastProcessedSpeech = text;

    addLine("you", text);
    publish({ status: "speaking" });

    try {
      const res = await sendGeminiVoiceMessage(dotId, conversationId, text);
      if (res.note) addLine("note", res.note);
      if (res.text) {
        addLine("dot", res.text);
        await speakText(res.text);
      } else {
        publish({ status: "listening" });
      }

      if (res.endCall) {
        setTimeout(endCall, 1400);
      }
    } catch (err) {
      addLine("note", err instanceof Error ? err.message : "Voice processing error.");
      publish({ status: "listening" });
    }
  };

  // Wire up work updates from background tasks
  const seen = new Set<string>();
  unsubscribe = onMessage((m) => {
    if (!current || m.conversationId !== conversationId || m.from === "voice" || m.createdAt < current.startedAt || seen.has(m.id)) return;
    if (m.role === "dot" && m.text.trim()) {
      seen.add(m.id);
      const updateMsg = `Work update: ${m.text.slice(0, 220)}`;
      addLine("note", updateMsg);
      void speakText(updateMsg);
    } else if (m.role === "card" && m.card?.status === "pending") {
      seen.add(m.id);
      const cardMsg = `I need your approval in the app for ${m.card.title}.`;
      addLine("note", cardMsg);
      void speakText(cardMsg);
    }
  });

  // Request microphone access
  mic = await navigator.mediaDevices.getUserMedia({ audio: true });
  const track = mic.getTracks()[0];
  setMic = (on) => {
    if (track) track.enabled = on;
  };

  teardown = () => {
    isRecognitionActive = false;
    clearTimeout(silenceTimer);
    unsubscribe?.();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    if (recognition) {
      try {
        recognition.stop();
      } catch {}
    }
    mic?.getTracks().forEach((t) => t.stop());
  };

  // Initialize SpeechRecognition if supported by the browser
  const SpeechRecognitionApi =
    typeof window !== "undefined" &&
    ((window as unknown as { SpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition);

  if (SpeechRecognitionApi) {
    recognition = new SpeechRecognitionApi();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      if (current?.muted || isSpeakingDot) return;
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      const spoken = (final || interim).trim();
      if (!spoken) return;

      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        void handleUserSpeech(spoken);
      }, 950);
    };

    recognition.onerror = (e: any) => {
      if (e.error === "no-speech" || e.error === "audio-capture") return;
      if (e.error === "not-allowed") {
        publish({ status: "error", error: "Microphone permission denied." });
      }
    };

    recognition.onend = () => {
      if (isRecognitionActive && current && current.status !== "ended" && current.status !== "error") {
        try {
          recognition.start();
        } catch {}
      }
    };

    try {
      recognition.start();
    } catch {}
  } else {
    addLine("note", "Speech recognition is active. For best results, use Chrome, Edge, or Safari.");
  }

  // Greet user
  if (initialGreeting) {
    addLine("dot", initialGreeting);
    await speakText(initialGreeting);
  } else {
    publish({ status: "listening" });
  }
}

/** Starts an OpenAI Realtime WebRTC call. */
async function startOpenAiRealtimeCall(dotId: string, conversationId: string, token: string, model: string) {
  const pc = new RTCPeerConnection();
  const audio = new Audio();
  audio.autoplay = true;
  pc.ontrack = (e) => (audio.srcObject = e.streams[0]);
  let mic: MediaStream | null = null;
  let unsubscribe: (() => void) | null = null;

  teardown = () => {
    unsubscribe?.();
    mic?.getTracks().forEach((t) => t.stop());
    pc.getSenders().forEach((s) => s.track?.stop());
    pc.close();
    audio.srcObject = null;
  };

  mic = await navigator.mediaDevices.getUserMedia({ audio: true });
  const track = mic.getTracks()[0];
  pc.addTrack(track, mic);
  setMic = (on) => (track.enabled = on);

  const dc = pc.createDataChannel("oai-events");
  const send = (obj: unknown) => dc.readyState === "open" && dc.send(JSON.stringify(obj));

  let responding = false;
  const queue: string[] = [];
  const flush = () => {
    if (responding || !queue.length) return;
    const text = queue.shift()!;
    send({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text }] } });
    send({ type: "response.create" });
  };

  dc.onopen = () => {
    publish({ status: "listening" });
    send({ type: "response.create" });
  };

  dc.onmessage = async (e) => {
    const ev = JSON.parse(e.data as string) as Record<string, unknown> & { type: string };
    switch (ev.type) {
      case "response.created":
        responding = true;
        break;
      case "response.done":
        responding = false;
        flush();
        break;
      case "output_audio_buffer.started":
        publish({ status: "speaking" });
        break;
      case "output_audio_buffer.stopped":
        if (current?.status === "speaking") publish({ status: "listening" });
        break;
      case "response.output_audio_transcript.done":
        addLine("dot", String(ev.transcript ?? ""));
        break;
      case "conversation.item.input_audio_transcription.completed":
        addLine("you", String(ev.transcript ?? ""));
        break;
      case "response.function_call_arguments.done": {
        const name = String(ev.name);
        const callId = String(ev.call_id);
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(String(ev.arguments || "{}"));
        } catch {}
        let output = "";
        if (name === "send_task") {
          const request = String(args.request ?? "");
          await sendVoiceTask(dotId, conversationId, request);
          addLine("note", `Handed off: ${request}`);
          output = "Sent to your working self. The result will arrive later as a work update.";
        } else if (name === "recent_messages") {
          output = getState()
            .messages.filter((m) => m.conversationId === conversationId && (m.role === "user" || m.role === "dot") && m.text)
            .slice(-12)
            .map((m) => `${m.role === "user" ? "User" : "You"}: ${m.text.slice(0, 400)}`)
            .join("\n");
        } else if (name === "end_call") {
          setTimeout(endCall, 1200);
          return;
        }
        send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: callId, output: output || "(nothing)" } });
        send({ type: "response.create" });
        break;
      }
      case "error":
        addLine("note", String((ev.error as { message?: string } | undefined)?.message ?? "Something went wrong."));
        break;
    }
  };

  const seen = new Set<string>();
  unsubscribe = onMessage((m) => {
    if (!current || m.conversationId !== conversationId || m.from === "voice" || m.createdAt < current.startedAt || seen.has(m.id)) return;
    if (m.role === "dot" && m.text.trim()) {
      seen.add(m.id);
      queue.push(`[Work update from your working self, not the user. Tell the user briefly and naturally.]\n${m.text.slice(0, 1500)}`);
      flush();
    } else if (m.role === "card" && m.card?.status === "pending") {
      seen.add(m.id);
      queue.push(`[Work update: your working self needs the user's approval in the app for: ${m.card.title}. Let them know.]`);
      flush();
    }
  });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  const answer = await fetch(`https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(model)}`, {
    method: "POST",
    body: offer.sdp,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/sdp" },
  });
  if (!answer.ok) throw new Error(`Realtime connection failed (${answer.status}).`);
  await pc.setRemoteDescription({ type: "answer", sdp: await answer.text() });
}

export async function startCall(dotId: string, conversationId: string) {
  endCall();
  current = { dotId, conversationId, status: "connecting", muted: false, lines: [], startedAt: Date.now() };
  for (const l of listeners) l();

  try {
    const session = await startVoiceCall(dotId, conversationId);
    if (session.error) throw new Error(session.error);

    current.provider = session.provider ?? "gemini";
    current.model = session.model;
    publish({});

    if (session.provider === "gemini") {
      await startGeminiVoiceCall(dotId, conversationId, session.greeting);
    } else if (session.provider === "openai" && session.token) {
      await startOpenAiRealtimeCall(dotId, conversationId, session.token, session.model ?? "gpt-realtime-2.1");
    } else {
      throw new Error("Unable to establish voice session with provider.");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    publish({ status: "error", error: /Permission|NotAllowed/i.test(message) ? "Microphone access was blocked." : message });
    teardown?.();
    teardown = null;
  }
}


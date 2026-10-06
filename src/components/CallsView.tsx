"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Clock, Phone, PhoneCall, PhoneIncoming, PhoneMissed, PhoneOff, PhoneOutgoing, Plus, Search, Star, Trash2, Users, Video, Volume2, X } from "lucide-react";
import { getVoiceProvider, setVoiceProvider, startVoiceConversation } from "@/app/actions";
import { useStore } from "@/lib/store";
import { startCall } from "@/lib/voiceCall";
import DotOrb from "./DotOrb";
import type { Dot } from "@/lib/types";

export type CallRecord = {
  id: string;
  dotId: string;
  dotName: string;
  timestamp: number;
  duration?: string;
  type: "outgoing" | "incoming" | "missed";
};

export function ContactCardIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <circle cx="8" cy="6" r="2" />
      <path d="M4.5 12c0-1.93 1.57-3.5 3.5-3.5s3.5 1.57 3.5 3.5" />
    </svg>
  );
}

export function CallSectionIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor">
      <path
        d="M19.5 15.38c-1.2 0-2.35-.19-3.43-.54a1 1 0 0 0-1.02.24l-2.12 2.12a14.6 14.6 0 0 1-6.14-6.14l2.12-2.12a1 1 0 0 0 .24-1.02A11.05 11.05 0 0 1 8.61 4.5 1 1 0 0 0 7.61 3.5H4.14A1.14 1.14 0 0 0 3 4.64 16.36 16.36 0 0 0 19.36 21a1.14 1.14 0 0 0 1.14-1.14v-3.48a1 1 0 0 0-1-1z"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="17.2" cy="6.8" r="4.2" strokeWidth="1.5" className="fill-rail" />
      <polyline points="17.2 4.6 17.2 6.8 18.7 7.7" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function CallsView() {
  const dots = useStore((s) => s.dots);
  const conversations = useStore((s) => s.conversations);
  const [tab, setTab] = useState<"history" | "speedDial" | "contacts">("history");
  const [history, setHistory] = useState<CallRecord[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [dialerOpen, setDialerOpen] = useState(false);
  const [dialNumber, setDialNumber] = useState("");
  const [query, setQuery] = useState("");
  const [callingDotId, setCallingDotId] = useState<string | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [voiceEngine, setVoiceEngine] = useState<"auto" | "livekit" | "gemini" | "openai">("auto");

  // Load call history and preferred voice engine
  useEffect(() => {
    getVoiceProvider().then((p) => {
      if (p === "gemini" || p === "openai" || p === "livekit" || p === "auto") setVoiceEngine(p);
    });
  }, []);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("mdots.callHistory");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setHistory(parsed);
      }
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoaded(true);
    }
  }, []);

  const saveHistory = (records: CallRecord[]) => {
    setHistory(records);
    try {
      localStorage.setItem("mdots.callHistory", JSON.stringify(records));
    } catch {
      // storage unavailable
    }
  };

  const handleStartCall = async (dot: Dot) => {
    try {
      setCallingDotId(dot.id);
      setCallError(null);
      const latest = conversations.filter((item) => item.dotId === dot.id).sort((a, b) => b.updatedAt - a.updatedAt)[0];
      const conversationId = latest?.id ?? (await startVoiceConversation(dot.id));
      void startCall(dot.id, conversationId);

      // Append to call history
      const newRecord: CallRecord = {
        id: `call-${Date.now()}`,
        dotId: dot.id,
        dotName: dot.name,
        timestamp: Date.now(),
        type: "outgoing",
        duration: "In progress",
      };
      saveHistory([newRecord, ...history]);
      setContactsOpen(false);
      setDialerOpen(false);
    } catch (err) {
      setCallError(err instanceof Error ? err.message : "Failed to initiate call");
    } finally {
      setCallingDotId(null);
    }
  };

  const clearHistory = () => {
    saveHistory([]);
  };

  const filteredDots = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return dots;
    return dots.filter((d) => d.name.toLowerCase().includes(q));
  }, [dots, query]);

  return (
    <div className="flex h-full flex-1 flex-col bg-[#1b1b1e] text-white">
      {/* Top Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.08] px-6">
        <div className="flex items-center gap-6">
          <h1 className="text-[17px] font-semibold tracking-tight text-white">Calls</h1>
          <nav className="flex items-center gap-1" aria-label="Calls views">
            <button
              type="button"
              id="calls-tab-history"
              onClick={() => setTab("history")}
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                tab === "history" ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/[0.05] hover:text-white"
              }`}
            >
              History
            </button>
            <button
              type="button"
              id="calls-tab-speed-dial"
              onClick={() => setTab("speedDial")}
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                tab === "speedDial" ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/[0.05] hover:text-white"
              }`}
            >
              Speed dial
            </button>
            <button
              type="button"
              id="calls-tab-contacts"
              onClick={() => setTab("contacts")}
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                tab === "contacts" ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/[0.05] hover:text-white"
              }`}
            >
              Contacts
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[12px] text-white/70">
            <span className="text-white/40">Voice:</span>
            <select
              value={voiceEngine}
              onChange={(e) => {
                const val = e.target.value as "auto" | "livekit" | "gemini" | "openai";
                setVoiceEngine(val);
                void setVoiceProvider(val);
              }}
              className="cursor-pointer bg-transparent font-medium text-white focus:outline-none"
              title="Select Voice Model Engine"
            >
              <option value="auto" className="bg-[#242428] text-white">Auto (Gemini / OpenAI)</option>
              <option value="livekit" className="bg-[#242428] text-white">LiveKit Voice</option>
              <option value="gemini" className="bg-[#242428] text-white">Google Gemini Voice</option>
              <option value="openai" className="bg-[#242428] text-white">OpenAI Realtime</option>
            </select>
          </div>
          {history.length > 0 && tab === "history" && (
            <button
              type="button"
              id="clear-call-history-button"
              onClick={clearHistory}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              title="Clear call history"
            >
              <Trash2 className="size-3.5" />
              <span>Clear history</span>
            </button>
          )}
          <button
            type="button"
            id="open-dialer-button"
            onClick={() => setDialerOpen(true)}
            className="flex items-center gap-2 rounded-md bg-[#6264a7] px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-[#525492]"
          >
            <Phone className="size-4" />
            <span>Make a call</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="relative flex flex-1 flex-col overflow-y-auto">
        {callError && (
          <div role="alert" className="mx-6 mt-4 rounded-lg bg-destructive/15 px-4 py-2.5 text-[13px] text-destructive">
            {callError}
          </div>
        )}

        {tab === "history" && history.length === 0 && (
          <section
            aria-label="Empty call history"
            className="flex flex-1 flex-col items-center justify-center p-6 text-center select-none"
          >
            {/* 3D Glass Phone & Clock Illustration */}
            <div className="relative mb-5 flex size-48 items-center justify-center sm:size-52">
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#00d2ff]/10 via-transparent to-[#ff6b4a]/10 blur-xl pointer-events-none" />
              <Image
                src="/calls_empty_illustration.jpg"
                alt="Empty call history"
                width={208}
                height={208}
                className="size-full rounded-full object-contain drop-shadow-[0_12px_36px_rgba(0,0,0,0.65)]"
                unoptimized
                priority
              />
            </div>

            {/* Headline matching user screenshot */}
            <h2 className="text-[17px] font-semibold text-white tracking-tight">
              You don&apos;t have any recent calls
            </h2>

            {/* Subtitle matching user screenshot */}
            <p className="mt-1 text-[13px] text-white/55">
              Your call history will show up here
            </p>

            {/* Action button matching user screenshot */}
            <button
              type="button"
              id="view-teams-contacts-button"
              onClick={() => {
                setContactsOpen(true);
                setTab("contacts");
              }}
              className="mt-6 inline-flex items-center gap-2 text-[13.5px] font-medium text-[#7b83eb] hover:text-[#99a0f5] transition-colors"
            >
              <ContactCardIcon className="size-4" />
              <span>View your Teams contacts</span>
            </button>
          </section>
        )}

        {/* Call History List (when calls exist) */}
        {tab === "history" && history.length > 0 && (
          <div className="mx-auto w-full max-w-4xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-white/80">Recent calls ({history.length})</h2>
              <button
                type="button"
                onClick={clearHistory}
                className="text-[12px] text-white/50 hover:text-white transition-colors"
              >
                Reset to empty state
              </button>
            </div>
            <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-white/[0.02]">
              {history.map((record) => {
                const dot = dots.find((d) => d.id === record.dotId);
                return (
                  <div key={record.id} className="flex items-center justify-between p-4 hover:bg-white/[0.03] transition-colors">
                    <div className="flex items-center gap-3">
                      {dot ? (
                        <DotOrb look={dot.look} status={dot.status} size={36} />
                      ) : (
                        <div className="grid size-9 place-items-center rounded-full bg-white/10 font-medium">
                          {record.dotName.slice(0, 1)}
                        </div>
                      )}
                      <div>
                        <div className="text-[14px] font-medium text-white">{record.dotName}</div>
                        <div className="flex items-center gap-2 text-[12px] text-white/45">
                          {record.type === "outgoing" ? (
                            <PhoneOutgoing className="size-3 text-[#7b83eb]" />
                          ) : (
                            <PhoneIncoming className="size-3 text-emerald-400" />
                          )}
                          <span>{new Date(record.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          <span>·</span>
                          <span>{record.duration ?? "Connected"}</span>
                        </div>
                      </div>
                    </div>
                    {dot && (
                      <button
                        type="button"
                        onClick={() => void handleStartCall(dot)}
                        disabled={callingDotId === dot.id}
                        className="flex size-9 items-center justify-center rounded-lg bg-white/10 text-white/80 hover:bg-[#6264a7] hover:text-white transition-colors"
                        title={`Call ${dot.name}`}
                      >
                        <PhoneCall className="size-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Speed Dial Tab */}
        {tab === "speedDial" && (
          <div className="mx-auto w-full max-w-4xl p-6">
            <h2 className="mb-4 text-[14px] font-semibold text-white/80">Speed dial favorites</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {dots.map((dot) => (
                <div
                  key={dot.id}
                  className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 transition-all hover:border-white/20 hover:bg-white/[0.05]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <DotOrb look={dot.look} status={dot.status} size={40} />
                    <span className="truncate text-[15px] font-medium text-white">{dot.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleStartCall(dot)}
                    disabled={callingDotId === dot.id}
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#6264a7] text-white transition-colors hover:bg-[#525492]"
                    title={`Call ${dot.name}`}
                  >
                    <PhoneCall className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contacts Tab */}
        {tab === "contacts" && (
          <div className="mx-auto w-full max-w-4xl p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-[14px] font-semibold text-white/80">All M-dots &amp; contacts ({dots.length})</h2>
              <div className="relative w-64">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-8 w-full rounded-md border border-white/10 bg-white/[0.05] pl-8 pr-3 text-[12px] text-white placeholder-white/40 focus:border-[#7b83eb] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filteredDots.map((dot) => (
                <div
                  key={dot.id}
                  className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 transition-colors hover:border-white/15"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <DotOrb look={dot.look} status={dot.status} size={42} />
                    <span className="truncate text-[15px] font-medium text-white">{dot.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleStartCall(dot)}
                    disabled={callingDotId === dot.id}
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#6264a7] text-white transition-colors hover:bg-[#525492]"
                    title={`Call ${dot.name}`}
                  >
                    <PhoneCall className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dialer Modal */}
      {dialerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Make a call"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => e.target === e.currentTarget && setDialerOpen(false)}
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#242428] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-white">Make a call</h3>
              <button
                type="button"
                onClick={() => setDialerOpen(false)}
                className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mb-4">
              <label className="text-[12px] text-white/60">Type a name or choose an M-dot</label>
              <input
                type="text"
                autoFocus
                placeholder="Enter M-dot name..."
                value={dialNumber}
                onChange={(e) => setDialNumber(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-[14px] text-white placeholder-white/40 focus:border-[#7b83eb] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto mb-4">
              {dots
                .filter((d) => !dialNumber || d.name.toLowerCase().includes(dialNumber.toLowerCase()))
                .map((dot) => (
                  <button
                    key={dot.id}
                    type="button"
                    onClick={() => void handleStartCall(dot)}
                    className="flex w-full items-center justify-between rounded-lg p-2 text-left hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <DotOrb look={dot.look} status={dot.status} size={28} />
                      <span className="text-[13px] text-white">{dot.name}</span>
                    </div>
                    <Phone className="size-3.5 text-[#7b83eb]" />
                  </button>
                ))}
            </div>

            <button
              type="button"
              disabled={!dots.length}
              onClick={() => {
                const target = dots.find((d) => d.name.toLowerCase().includes(dialNumber.toLowerCase())) ?? dots[0];
                if (target) void handleStartCall(target);
              }}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#6264a7] text-[13px] font-medium text-white transition-colors hover:bg-[#525492]"
            >
              <PhoneCall className="size-4" />
              <span>Call now</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

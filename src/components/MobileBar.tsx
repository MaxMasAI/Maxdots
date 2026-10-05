"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, Command, HelpCircle, Info, Keyboard, Menu, MessageSquare, Monitor, MoreHorizontal, RefreshCw, Search, Settings, Smartphone, Sparkles, SquarePen, X } from "lucide-react";
import { setSidebarOpen } from "@/lib/ui";
import { Wordmark } from "./Sidebar";
import { useStore } from "@/lib/store";
import { endCall, getCall, setMuted } from "@/lib/voiceCall";
import DotOrb from "./DotOrb";

/** Opens the sidebar drawer on small screens. */
export function MenuButton() {
  return (
    <button className="btn-quiet size-9 shrink-0 p-0 md:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
      <Menu className="size-5" strokeWidth={1.75} />
    </button>
  );
}

/** Top bar for small screens on pages without their own header (dot pages have one). */
export default function MobileBar() {
  const pathname = usePathname();
  if (pathname.startsWith("/dots/")) return null;
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-black/[0.06] px-2 md:hidden">
      <MenuButton />
      <Link href="/" className="mr-auto">
        <Wordmark />
      </Link>
      <Link href="/" className="btn-quiet size-9 p-0" aria-label="New chat">
        <SquarePen className="size-4" strokeWidth={1.75} />
      </Link>
    </div>
  );
}

export function HubBar() {
  const pathname = usePathname();
  const router = useRouter();
  const connected = useStore((s) => s.connected);
  const dots = useStore((s) => s.dots);
  const conversations = useStore((s) => s.conversations);
  const [overlay, setOverlay] = useState<"shortcuts" | "commands" | null>(null);
  const [topQuery, setTopQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const topInputRef = useRef<HTMLInputElement>(null);
  const activeDot = pathname.match(/^\/dots\/([^/]+)/)?.[1];

  const matchingDots = useMemo(() => {
    const q = topQuery.trim().toLowerCase();
    if (!q) return [];
    return dots.filter((d) => d.name.toLowerCase().includes(q) || d.purpose.toLowerCase().includes(q)).slice(0, 5);
  }, [dots, topQuery]);

  const matchingConvs = useMemo(() => {
    const q = topQuery.trim().toLowerCase();
    if (!q) return [];
    return conversations.filter((c) => c.title.toLowerCase().includes(q)).slice(0, 5);
  }, [conversations, topQuery]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const primary = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (event.key === "F6" && !primary && !event.altKey) {
        event.preventDefault();
        const sections = [...document.querySelectorAll<HTMLElement>(
          'nav[aria-label="Main navigation"] a, nav[aria-label="M-dots and chats"] button[aria-expanded], button[aria-label="Search M-dots and chats"], textarea[aria-label="Message composer"], main > header a',
        )].filter((element) => element.offsetParent !== null);
        if (sections.length) {
          const current = sections.indexOf(document.activeElement as HTMLElement);
          const direction = event.shiftKey ? -1 : 1;
          sections[(current + direction + sections.length) % sections.length]?.focus();
        }
        return;
      }
      if (event.key === "Escape") {
        if (overlay) {
          event.preventDefault();
          setOverlay(null);
        } else {
          window.dispatchEvent(new Event("mdots:escape"));
        }
        return;
      }
      if (!primary) return;

      if (key === "." && !event.shiftKey) {
        event.preventDefault();
        setOverlay("shortcuts");
      } else if (key === "/") {
        event.preventDefault();
        setOverlay("commands");
      } else if (key === "," && !event.shiftKey) {
        event.preventDefault();
        router.push("/settings");
      } else if ((key === "e" || key === "k") && !event.shiftKey) {
        event.preventDefault();
        topInputRef.current?.focus();
        topInputRef.current?.select();
        window.dispatchEvent(new Event("mdots:open-chat-search"));
      } else if (key === "f") {
        event.preventDefault();
        if (!event.shiftKey && (pathname.startsWith("/dots/") || (/^\/channels\/[^/]+$/.test(pathname) && pathname !== "/channels/new"))) {
          window.dispatchEvent(new Event("mdots:open-current-chat-search"));
        } else {
          window.dispatchEvent(new Event("mdots:open-chat-search"));
        }
      } else if (key === "n") {
        event.preventDefault();
        const target = activeDot ? `/dots/${activeDot}?c=new` : dots[0] ? `/dots/${dots[0].id}?c=new` : "/new";
        if (event.shiftKey) window.open(target, "_blank", "popup,width=1200,height=850");
        else router.push(target);
      } else if (["1", "2", "3", "4", "5", "6"].includes(key) && !event.shiftKey) {
        event.preventDefault();
        if (key === "1" || key === "2") router.push("/");
        if (key === "3") router.push("/channels/new");
        if (key === "4") router.push("/apps?search=Google%20Calendar");
        if (key === "5") {
          if (activeDot) window.dispatchEvent(new Event("mdots:start-voice"));
          else router.push(dots[0] ? `/dots/${dots[0].id}` : "/new");
        }
        if (key === "6" && activeDot) router.push(`/dots/${activeDot}?tab=computer`);
      } else if (event.shiftKey && key === "x") {
        event.preventDefault();
        window.dispatchEvent(new Event("mdots:expand-compose"));
      } else if (key === "o" && !event.shiftKey) {
        event.preventDefault();
        window.dispatchEvent(new Event("mdots:attach-file"));
      } else if (event.shiftKey && key === "c") {
        event.preventDefault();
        window.dispatchEvent(new Event("mdots:start-voice"));
      } else if (event.shiftKey && key === "m") {
        const call = getCall();
        if (call) {
          event.preventDefault();
          setMuted(!call.muted);
        }
      } else if (event.shiftKey && (key === "d" || key === "h")) {
        if (getCall()) {
          event.preventDefault();
          endCall();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeDot, dots, overlay, pathname, router]);
  const title = pathname.startsWith("/dots/")
    ? "Chat"
    : pathname.startsWith("/channels")
      ? "Teams"
      : pathname.startsWith("/apps")
        ? "Apps"
        : pathname.startsWith("/settings")
          ? "Settings"
          : "Chat";

  return (
    <>
    <header className="hidden h-14 shrink-0 items-center gap-4 border-b border-black/[0.08] bg-card px-5 md:flex">
      <span className="min-w-24 text-[15px] font-medium">{title}</span>
      <div className="relative w-full max-w-[540px]">
        <div className="relative flex h-9 w-full items-center">
          <Search className="pointer-events-none absolute left-3 size-4 text-foreground/45" strokeWidth={1.8} />
          <input
            ref={topInputRef}
            id="hubbar-search-input"
            type="text"
            className="field h-9 w-full rounded-md border border-black/[0.09] bg-sidebar pl-9 pr-14 text-[13px] text-foreground placeholder-foreground/50 transition-colors focus:border-black/25 focus:bg-card focus:outline-none"
            placeholder="Search chats and dots"
            value={topQuery}
            onChange={(e) => {
              setTopQuery(e.target.value);
              setDropdownOpen(true);
            }}
            onFocus={() => setDropdownOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setTopQuery("");
                setDropdownOpen(false);
                topInputRef.current?.blur();
              }
            }}
          />
          {topQuery ? (
            <button
              type="button"
              className="absolute right-2.5 text-foreground/40 hover:text-foreground"
              onClick={() => {
                setTopQuery("");
                setDropdownOpen(false);
              }}
              aria-label="Clear search"
            >
              <X className="size-3.5" strokeWidth={1.75} />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-2.5 rounded border border-black/10 bg-white/60 px-1.5 py-0.5 font-mono text-[10px] text-foreground/50">
              Ctrl K
            </kbd>
          )}
        </div>

        {/* Dropdown with instant results */}
        {dropdownOpen && topQuery.trim() && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
            <div className="surface absolute left-0 right-0 top-11 z-50 max-h-80 overflow-y-auto rounded-lg border border-black/[0.08] bg-popover p-2 shadow-elevated">
              {matchingDots.length > 0 && (
                <div className="mb-2">
                  <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-foreground/45">
                    M-dots ({matchingDots.length})
                  </div>
                  {matchingDots.map((dot) => (
                    <button
                      key={dot.id}
                      type="button"
                      onClick={() => {
                        router.push(`/dots/${dot.id}`);
                        setDropdownOpen(false);
                        setTopQuery("");
                      }}
                      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-black/[0.04] transition-colors"
                    >
                      <DotOrb look={dot.look} status={dot.status} size={24} />
                      <span className="text-[13px] font-medium text-foreground">{dot.name}</span>
                      <span className="truncate text-[12px] text-foreground/50">{dot.purpose}</span>
                    </button>
                  ))}
                </div>
              )}

              {matchingConvs.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-foreground/45">
                    Conversations ({matchingConvs.length})
                  </div>
                  {matchingConvs.map((c) => {
                    const dot = dots.find((d) => d.id === c.dotId);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          router.push(`/dots/${c.dotId}?c=${c.id}`);
                          setDropdownOpen(false);
                          setTopQuery("");
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left hover:bg-black/[0.04] transition-colors"
                      >
                        <MessageSquare className="size-3.5 text-foreground/45 shrink-0" />
                        <span className="truncate text-[13px] text-foreground">{c.title}</span>
                        {dot && <span className="ml-auto text-[11px] text-foreground/40 shrink-0">{dot.name}</span>}
                      </button>
                    );
                  })}
                </div>
              )}

              {matchingDots.length === 0 && matchingConvs.length === 0 && (
                <div className="px-3 py-4 text-center text-[13px] text-foreground/45">
                  No matching chats or dots found
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <div className="relative ml-auto flex items-center gap-3">
        <span className="hidden items-center gap-1.5 text-[12px] text-foreground/55 lg:flex">
          <span className={`size-2 rounded-full ${connected ? "bg-success" : "bg-foreground/25"}`} />
          {connected ? "Available" : "Connecting"}
        </span>
        <span className="hidden h-5 w-px bg-black/10 lg:block" />
        
        {/* Teams-grade Settings and more (...) menu matching user screenshot */}
        <div className="relative">
          <button
            type="button"
            id="hubbar-more-menu-btn"
            onClick={() => setMoreMenuOpen(!moreMenuOpen)}
            className="flex size-9 items-center justify-center rounded-md bg-white/[0.05] text-foreground/75 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Settings and more"
            title="Settings and more"
          >
            <MoreHorizontal className="size-5" />
          </button>

          {moreMenuOpen && (
            <>
              <div className="fixed inset-0 z-50" onClick={() => setMoreMenuOpen(false)} />
              <div
                role="menu"
                className="absolute right-0 top-11 z-50 w-64 rounded-xl border border-white/10 bg-[#242428] py-1.5 text-[13px] text-white shadow-2xl backdrop-blur-md"
              >
                <button
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    router.push("/settings");
                  }}
                  className="flex w-full items-center gap-3 px-3.5 py-2 text-left hover:bg-white/10 transition-colors"
                >
                  <Sparkles className="size-4 text-[#7b83eb]" />
                  <span className="flex-1 font-medium">Upgrade</span>
                </button>

                <div className="my-1 border-t border-white/[0.08]" />

                <button
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    router.push("/settings");
                  }}
                  className="flex w-full items-center justify-between px-3.5 py-2 text-left hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Settings className="size-4 text-white/70" />
                    <span>Settings</span>
                  </div>
                  <span className="font-mono text-[10px] text-white/40">Ctrl+Shift+,</span>
                </button>

                <div className="my-1 border-t border-white/[0.08]" />

                <button
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    router.push("/settings#general");
                  }}
                  className="flex w-full items-center justify-between px-3.5 py-2 text-left hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <HelpCircle className="size-4 text-white/70" />
                    <span>Help</span>
                  </div>
                  <ChevronRight className="size-3.5 text-white/40" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    router.push("/settings#agents");
                  }}
                  className="flex w-full items-center justify-between px-3.5 py-2 text-left hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare className="size-4 text-white/70" />
                    <span>Feedback</span>
                  </div>
                  <ChevronRight className="size-3.5 text-white/40" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    setOverlay("shortcuts");
                  }}
                  className="flex w-full items-center justify-between px-3.5 py-2 text-left hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Keyboard className="size-4 text-white/70" />
                    <span>Keyboard shortcuts</span>
                  </div>
                  <span className="font-mono text-[10px] text-white/40">Ctrl+.</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    router.push("/settings#about");
                  }}
                  className="flex w-full items-center gap-3 px-3.5 py-2 text-left hover:bg-white/10 transition-colors"
                >
                  <Monitor className="size-4 text-white/70" />
                  <span>Get the desktop app</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    router.push("/settings#about");
                  }}
                  className="flex w-full items-center gap-3 px-3.5 py-2 text-left hover:bg-white/10 transition-colors"
                >
                  <Smartphone className="size-4 text-white/70" />
                  <span>Get the mobile app</span>
                </button>

                <div className="my-1 border-t border-white/[0.08]" />

                <button
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    router.push("/settings#about");
                  }}
                  className="flex w-full items-center gap-3 px-3.5 py-2 text-left hover:bg-white/10 transition-colors"
                >
                  <Sparkles className="size-4 text-white/70" />
                  <span>Teams Insider</span>
                </button>

                <div className="my-1 border-t border-white/[0.08]" />

                <button
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    router.push("/settings#about");
                  }}
                  className="flex w-full items-center gap-3 px-3.5 py-2 text-left hover:bg-white/10 transition-colors"
                >
                  <Sparkles className="size-4 text-white/70" />
                  <span>What&apos;s new</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    router.push("/settings#about");
                  }}
                  className="flex w-full items-center gap-3 px-3.5 py-2 text-left hover:bg-white/10 transition-colors"
                >
                  <RefreshCw className="size-4 text-white/70" />
                  <span>Check for updates</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    router.push("/settings#about");
                  }}
                  className="flex w-full items-center gap-3 px-3.5 py-2 text-left hover:bg-white/10 transition-colors"
                >
                  <Info className="size-4 text-white/70" />
                  <span>About M-dots</span>
                </button>
              </div>
            </>
          )}
        </div>

        <Link href="/settings" aria-label="M-dots profile" className="flex size-8 items-center justify-center rounded-full bg-rail text-[12px] font-medium text-white ring-2 ring-black/[0.05]">
          M
        </Link>
      </div>
    </header>
      {overlay && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/55 px-4 pt-[12vh]" onMouseDown={(event) => event.target === event.currentTarget && setOverlay(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="hotkey-title" className="surface w-full max-w-[680px] overflow-hidden shadow-elevated">
            <header className="flex items-center gap-3 border-b border-white/[0.08] px-5 py-4">
              {overlay === "shortcuts" ? <Command className="size-5 text-brand-readable" /> : <Search className="size-5 text-brand-readable" />}
              <h2 id="hotkey-title" className="flex-1 text-[16px] font-medium">{overlay === "shortcuts" ? "Keyboard shortcuts" : "Command list"}</h2>
              <button className="btn-quiet size-8 p-0" aria-label="Close" onClick={() => setOverlay(null)}><X className="size-4" /></button>
            </header>
            {overlay === "commands" ? (
              <div className="grid gap-1 p-3 sm:grid-cols-2">
                <CommandAction label="Search chats" keys="Ctrl E" onClick={() => { setOverlay(null); window.dispatchEvent(new Event("mdots:open-chat-search")); }} />
                <CommandAction label="Start a new chat" keys="Ctrl N" onClick={() => { setOverlay(null); router.push(activeDot ? `/dots/${activeDot}?c=new` : dots[0] ? `/dots/${dots[0].id}?c=new` : "/new"); }} />
                <CommandAction label="Open chat" keys="Ctrl 2" onClick={() => { setOverlay(null); router.push("/"); }} />
                <CommandAction label="Open Teams" keys="Ctrl 3" onClick={() => { setOverlay(null); router.push("/channels/new"); }} />
                <CommandAction label="Open Google Calendar" keys="Ctrl 4" onClick={() => { setOverlay(null); router.push("/apps?search=Google%20Calendar"); }} />
                <CommandAction label="Open Settings" keys="Ctrl ," onClick={() => { setOverlay(null); router.push("/settings"); }} />
              </div>
            ) : (
              <ShortcutList />
            )}
            <footer className="border-t border-white/[0.08] px-5 py-3 text-caption text-foreground/45">
              Windows / PC: Ctrl · Mac: Cmd. Unsupported meeting controls are shown for reference and are not active in M-dots.
            </footer>
          </section>
        </div>
      )}
    </>
  );
}

function CommandAction({ label, keys, onClick }: { label: string; keys: string; onClick: () => void }) {
  return (
    <button className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-white/[0.06]" onClick={onClick}>
      <span className="min-w-0 flex-1 text-[13px]">{label}</span>
      <kbd className="font-mono text-[10px] text-foreground/40">{keys}</kbd>
    </button>
  );
}

const SHORTCUT_GROUPS = [
  {
    title: "General",
    rows: [
      ["Ctrl .", "Open shortcut list", true],
      ["Ctrl E", "Go to search bar", true],
      ["Ctrl /", "Open command list", true],
      ["Ctrl ,", "Open settings", true],
      ["Ctrl Shift F", "Open filter / chat search", true],
      ["Ctrl = / - / 0", "Zoom in / out / reset", true],
      ["Escape", "Close dialog or search", true],
    ],
  },
  {
    title: "Navigation",
    rows: [
      ["Ctrl 1", "Activity / home", true],
      ["Ctrl 2", "Chat", true],
      ["Ctrl 3", "Teams", true],
      ["Ctrl 4", "Google Calendar app directory", true],
      ["Ctrl 5", "Calls / start voice chat", true],
      ["Ctrl 6", "Files on the current dot computer", true],
      ["Alt ↑ / ↓", "Move through the list", true],
      ["F6 / Shift F6", "Next / previous section", true],
    ],
  },
  {
    title: "Messaging and chat",
    rows: [
      ["Ctrl N", "Start a new chat", true],
      ["Ctrl Shift N", "Pop out chat in a new window", true],
      ["↑ in empty composer", "Edit last sent message", false],
      ["Ctrl Shift X", "Expand compose box", true],
      ["Ctrl Enter", "Send from expanded composer", true],
      ["Shift Enter", "Start a new line", true],
      ["Ctrl O", "Attach a file", true],
      ["Ctrl Shift I", "Mark message important", false],
      ["Ctrl F", "Search current chat or channel", true],
    ],
  },
  {
    title: "Meetings and calls",
    rows: [
      ["Ctrl Shift M", "Toggle microphone mute during a call", true],
      ["Hold Ctrl Space", "Push-to-talk", false],
      ["Ctrl Shift O", "Toggle camera", false],
      ["Ctrl Shift P", "Toggle background blur", false],
      ["Ctrl Shift K", "Raise / lower hand", false],
      ["Ctrl Shift E", "Start screen sharing", false],
      ["Ctrl Shift C", "Start an audio call", true],
      ["Ctrl Shift U", "Start a video call", false],
      ["Ctrl Shift S", "Accept incoming call", false],
      ["Ctrl Shift D / H", "Decline or hang up", true],
      ["Alt Shift N", "Schedule a meeting", false],
      ["Ctrl Shift Space", "Go to sharing toolbar", false],
    ],
  },
] as const;

function ShortcutList() {
  const [filter, setFilter] = useState("");
  const [appPreset, setAppPreset] = useState("teams");

  const filteredGroups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return SHORTCUT_GROUPS;
    return SHORTCUT_GROUPS.map((g) => ({
      ...g,
      rows: g.rows.filter(([keys, desc]) => keys.toLowerCase().includes(q) || desc.toLowerCase().includes(q)),
    })).filter((g) => g.rows.length > 0);
  }, [filter]);

  return (
    <div className="max-h-[70vh] overflow-y-auto p-5 text-white">
      {/* Top Filter and App Preset Bar matching user screenshot */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
        <div className="flex items-center gap-2">
          <label className="text-[12px] text-white/60">Use shortcuts from other apps</label>
          <select
            value={appPreset}
            onChange={(e) => setAppPreset(e.target.value)}
            className="h-8 rounded-md border border-white/10 bg-[#29292d] px-2 text-[12px] text-white focus:outline-none"
          >
            <option value="teams">Teams only (default)</option>
            <option value="slack">Slack compatible</option>
            <option value="zoom">Zoom compatible</option>
          </select>
          <button type="button" className="h-8 rounded-md bg-white/10 px-3 text-[12px] font-medium text-white hover:bg-white/15">
            Apply
          </button>
        </div>

        <div className="relative w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Filter shortcuts"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 w-full rounded-md border border-white/10 bg-black/25 pl-8 pr-3 text-[12px] text-white placeholder-white/40 focus:border-[#7b83eb] focus:outline-none"
          />
        </div>
      </div>

      <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        {filteredGroups.map((group) => (
          <section key={group.title} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <h3 className="mb-3 text-[13px] font-semibold text-white/90">{group.title}</h3>
            <dl className="space-y-2">
              {group.rows.map(([keys, description, available]) => (
                <div key={keys} className="flex items-center justify-between gap-3 text-[12px]">
                  <dd className="min-w-0 flex-1 text-white/80">{description}</dd>
                  <dt className="shrink-0 rounded-md border border-white/10 bg-white/[0.06] px-2 py-0.5 font-mono text-[11px] text-white/90">
                    {keys}
                  </dt>
                  {!available && <span className="shrink-0 text-[9px] text-white/30">unsupported</span>}
                </div>
              ))}
            </dl>
          </section>
        ))}
        {!filteredGroups.length && (
          <div className="col-span-2 py-8 text-center text-[13px] text-white/40">
            No shortcuts matching &quot;{filter}&quot;
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-white/[0.08] pt-3 text-[12px] text-[#7b83eb]">
        <button type="button" className="hover:underline">See shortcuts for all platforms</button>
        <button type="button" className="hover:underline">Office Accessibility Centre</button>
      </div>
    </div>
  );
}

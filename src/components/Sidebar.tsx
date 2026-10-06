"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, Building2, CalendarDays, ChevronDown, Info, LayoutGrid, List, MessageSquare, Monitor, PanelLeftClose, PanelLeftOpen, Pencil, Phone, PhoneCall, Plus, Search, Settings, ShieldCheck, Sparkles, SquarePen, Star, Trash2, Users, X } from "lucide-react";
import { CallSectionIcon } from "./CallsView";
import { deleteConversation, deleteDot, startVoiceConversation } from "@/app/actions";
import { markRead, useStore } from "@/lib/store";
import { setSidebarOpen, useSidebarOpen } from "@/lib/ui";
import { statusDot, timeAgo } from "@/lib/status";
import { startCall } from "@/lib/voiceCall";
import DotOrb from "./DotOrb";
import type { Conversation, Dot, Message } from "@/lib/types";

export function Wordmark() {
  return (
    <span className="text-[15px] font-medium tracking-tight">M-dots</span>
  );
}

/** Last readable line of a conversation, for the preview under its title. */
function preview(messages: Message[], convId: string): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.conversationId !== convId) continue;
    if (m.role === "card" && m.card?.status === "pending") return `Needs you: ${m.card.title}`;
    if ((m.role === "dot" || m.role === "user") && m.text) return (m.role === "user" ? "You: " : "") + m.text.replace(/[#*_`>|[\]]/g, "").replace(/\s+/g, " ");
  }
  return "";
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeConv = searchParams.get("c");
  const dots = useStore((s) => s.dots);
  const messages = useStore((s) => s.messages);
  const lastRead = useStore((s) => s.lastRead);
  const conversations = useStore((s) => s.conversations);
  const loaded = useStore((s) => s.loaded);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [dotsLayout, setDotsLayout] = useState<"list" | "columns">("list");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [dotsOrder, setDotsOrder] = useState<string[]>([]);
  const [draggingDotId, setDraggingDotId] = useState<string | null>(null);
  const [dragOverDotId, setDragOverDotId] = useState<string | null>(null);
  const [confirmDeleteDotId, setConfirmDeleteDotId] = useState<string | null>(null);
  const settingsOpen = pathname.startsWith("/settings");
  const callsOpen = pathname.startsWith("/calls");
  const [, start] = useTransition();
  const activeDot = pathname.match(/^\/dots\/([^/]+)/)?.[1];
  const drawerOpen = useSidebarOpen();

  const dotById = useMemo(() => new Map(dots.map((d) => [d.id, d])), [dots]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem("mdots.favoriteConversations") ?? "[]");
        if (Array.isArray(saved) && saved.every((id) => typeof id === "string")) setFavoriteIds(saved);
        const savedLayout = localStorage.getItem("mdots.dotsLayout");
        if (savedLayout === "list" || savedLayout === "columns") setDotsLayout(savedLayout);
        const savedOrder = JSON.parse(localStorage.getItem("mdots.dotsOrder") ?? "[]");
        if (Array.isArray(savedOrder)) setDotsOrder(savedOrder);
      } catch {
        setFavoriteIds([]);
      } finally {
        setFavoritesLoaded(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const orderedDots = useMemo(() => {
    if (!dotsOrder.length) return dots;
    const orderMap = new Map(dotsOrder.map((id, index) => [id, index]));
    return [...dots].sort((a, b) => {
      const ai = orderMap.get(a.id) ?? 999;
      const bi = orderMap.get(b.id) ?? 999;
      return ai - bi;
    });
  }, [dots, dotsOrder]);

  useEffect(() => {
    if (!favoritesLoaded) return;
    try {
      localStorage.setItem("mdots.favoriteConversations", JSON.stringify(favoriteIds));
    } catch {
      // Favorites remain available for this session if storage is unavailable.
    }
  }, [favoriteIds, favoritesLoaded]);

  useEffect(() => {
    if (!favoritesLoaded) return;
    try {
      localStorage.setItem("mdots.dotsLayout", dotsLayout);
    } catch {
      // Keep the selected layout for this session if storage is unavailable.
    }
  }, [dotsLayout, favoritesLoaded]);

  useEffect(() => {
    const openSearch = () => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };
    const close = () => {
      setQ("");
    };
    window.addEventListener("mdots:open-chat-search", openSearch);
    window.addEventListener("mdots:escape", close);
    return () => {
      window.removeEventListener("mdots:open-chat-search", openSearch);
      window.removeEventListener("mdots:escape", close);
    };
  }, []);

  // Chat history across every dot, newest first; search matches titles, dot names, and message text.
  const recent = useMemo(() => {
    const query = q.trim().toLowerCase();
    const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
    if (!query) return sorted;
    const hits = new Set(messages.filter((m) => m.conversationId && m.text.toLowerCase().includes(query)).map((m) => m.conversationId));
    return sorted.filter((c) => c.title.toLowerCase().includes(query) || hits.has(c.id) || dotById.get(c.dotId)?.name.toLowerCase().includes(query));
  }, [conversations, messages, q, dotById]);

  const unread = (c: Conversation) => {
    const since = lastRead[c.dotId];
    return since !== undefined && c.updatedAt > since && messages.some((m) => m.conversationId === c.id && m.role === "dot" && m.createdAt > since);
  };

  const toggleFavorite = (conversationId: string) => {
    setFavoriteIds((current) => {
      return current.includes(conversationId) ? current.filter((id) => id !== conversationId) : [...current, conversationId];
    });
  };

  const callDot = async () => {
    const dot = dots.find((item) => item.id === activeDot) ?? dots[0];
    if (!dot) {
      router.push("/new");
      return;
    }
    try {
      const latest = conversations.filter((item) => item.dotId === dot.id).sort((a, b) => b.updatedAt - a.updatedAt)[0];
      const conversationId = latest?.id ?? (await startVoiceConversation(dot.id));
      if (!latest) router.push(`/dots/${dot.id}?c=${conversationId}`);
      void startCall(dot.id, conversationId);
      setCallError(null);
    } catch (error) {
      setCallError(error instanceof Error ? error.message : "Couldn't start the voice call.");
    }
  };

  const remove = (c: Conversation) =>
    start(async () => {
      await deleteConversation(c.id);
      setConfirming(null);
      if (c.id === activeConv) router.push(`/dots/${c.dotId}`);
    });

  const closeSearch = () => setQ("");
  const renderConversation = (c: Conversation) => {
    const dot = dotById.get(c.dotId);
    if (!dot) return null;
    if (confirming === c.id) {
      return (
        <div key={c.id} className="my-0.5 flex items-center gap-2 rounded-lg bg-destructive/[0.06] px-3 py-2.5">
          <span className="min-w-0 flex-1 truncate text-[13px] text-destructive">Delete “{c.title}”?</span>
          <button className="btn-quiet h-7 px-2 text-[12px] text-destructive" onClick={() => remove(c)}>Delete</button>
          <button className="btn-quiet size-7 p-0" onClick={() => setConfirming(null)} aria-label="Cancel">
            <X className="size-3.5" strokeWidth={2} />
          </button>
        </div>
      );
    }
    const line = preview(messages, c.id);
    const favorite = favoriteIds.includes(c.id);
    return (
      <div key={c.id} className={`group/chat relative flex items-center rounded-xl transition-colors ${c.id === activeConv ? "bg-card shadow-2xs" : "hover:bg-black/[0.03]"}`}>
        <Link href={`/dots/${dot.id}?c=${c.id}`} onClick={() => markRead(dot.id)} className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2">
          <DotOrb look={dot.look} status={dot.status} size={34} />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
              <span className="truncate text-[13px] font-medium">{c.title}</span>
              {unread(c) && <span className="size-2 shrink-0 self-center rounded-full bg-brand" />}
              <span className="ml-auto shrink-0 font-mono text-[9px] text-foreground/35">{timeAgo(c.updatedAt).replace(" ago", "")}</span>
            </span>
            {line && <span className="block truncate text-[11px] text-foreground/45">{line}</span>}
          </span>
        </Link>
        <button
          className={`absolute top-1.5 right-1.5 grid size-6 place-items-center rounded text-foreground/35 transition-colors hover:bg-black/[0.05] hover:text-brand-readable ${favorite ? "opacity-100" : "opacity-0 group-hover/chat:opacity-100 focus:opacity-100"}`}
          onClick={() => toggleFavorite(c.id)}
          aria-label={favorite ? `Remove ${c.title} from favorites` : `Add ${c.title} to favorites`}
          title={favorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Star className={`size-3.5 ${favorite ? "fill-current text-brand-readable" : ""}`} />
        </button>
        <button
          className="absolute right-8 top-1.5 hidden size-6 place-items-center rounded text-foreground/40 group-hover/chat:grid hover:bg-black/[0.05] hover:text-destructive"
          onClick={() => setConfirming(c.id)}
          aria-label={`Delete ${c.title}`}
          title="Delete chat"
        >
          <Trash2 className="size-3.5" strokeWidth={1.75} />
        </button>
      </div>
    );
  };

  return (
    <>
      {/* Phones / narrow windows: the sidebar is a drawer over a dimmed backdrop */}
      {drawerOpen && <div className="fixed inset-0 z-40 bg-black/25 md:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside
        // Picking anything in the drawer closes it.
        onClickCapture={(e) => (e.target as HTMLElement).closest("a") && setSidebarOpen(false)}
        className={`fixed inset-y-0 left-0 z-50 flex w-[336px] max-w-[90vw] shrink-0 bg-sidebar shadow-2xl transition-[width,transform] duration-200 md:static md:z-auto md:max-w-none md:translate-x-0 md:shadow-none ${sidebarCollapsed ? "md:w-16" : "md:w-[336px]"} ${drawerOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
      <nav aria-label="Main navigation" className="hidden w-16 shrink-0 flex-col items-center gap-2 bg-rail py-3 text-white md:flex">
        <button
          type="button"
          onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!sidebarCollapsed}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="mb-1 grid size-10 place-items-center rounded-xl text-white/75 transition-colors hover:bg-white/10 hover:text-white"
        >
          {sidebarCollapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
        </button>
        <Link href="/" aria-label="M-dots home" title="M-dots home" className="mb-3 flex size-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20 transition-colors hover:bg-white/20">
          <Image src="/logo_head_transparent.png" alt="M-dots" width={28} height={28} unoptimized priority className="size-7 object-contain" />
        </Link>
        <RailLink href="/" active={pathname === "/" || pathname.startsWith("/dots/")} label="Chat">
          <MessageSquare className="size-5" />
        </RailLink>
        <RailLink href="/calls" active={pathname.startsWith("/calls")} label="Calls">
          <CallSectionIcon className="size-5" />
        </RailLink>
        <RailLink href="/channels/new" active={pathname.startsWith("/channels")} label="Teams and channels">
          <Users className="size-5" />
        </RailLink>
        <RailLink href="/apps?search=Google%20Calendar" active={pathname.startsWith("/apps") && searchParams.get("search") === "Google Calendar"} label="Google Calendar">
          <CalendarDays className="size-5" />
        </RailLink>
        <RailLink href="/apps" active={pathname.startsWith("/apps")} label="Add apps and plugins">
          <Plus className="size-5" />
        </RailLink>
        <RailLink href="/settings" active={pathname.startsWith("/settings")} label="Settings">
          <Settings className="size-5" />
        </RailLink>
        <Link href="/settings" aria-label="Your profile and settings" title="Your profile and settings" className="mt-auto flex size-10 items-center justify-center rounded-full bg-white/15 text-[12px] font-medium ring-1 ring-white/20">
          M
        </Link>
      </nav>
      <section className={`${sidebarCollapsed ? "hidden" : "flex"} min-w-0 flex-1 flex-col border-r border-black/[0.07] bg-sidebar`}>
      {settingsOpen ? <SettingsNavigation /> : callsOpen ? <CallsNavigation /> : <>
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-black/[0.06] px-3">
        <div className="relative flex h-9 min-w-0 flex-1 items-center">
          <Search className="pointer-events-none absolute left-3 size-4 text-foreground/45" strokeWidth={1.75} />
          <input
            ref={searchInputRef}
            id="sidebar-search-input"
            type="text"
            className="field h-9 w-full rounded-md border border-black/[0.08] bg-black/[0.04] pl-9 pr-7 text-[13px] text-foreground placeholder-foreground/50 transition-colors focus:border-black/20 focus:bg-card"
            placeholder="Search M-dots and chats"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && closeSearch()}
          />
          {q && (
            <button
              type="button"
              className="absolute right-2.5 text-foreground/40 hover:text-foreground"
              onClick={closeSearch}
              aria-label="Clear search"
            >
              <X className="size-3.5" strokeWidth={1.75} />
            </button>
          )}
        </div>
        <Link
          href={activeDot ? `/dots/${activeDot}?c=new` : "/new"}
          className="flex size-9 shrink-0 items-center justify-center rounded-md border border-black/[0.08] text-foreground/70 transition-colors hover:border-black/20 hover:bg-black/[0.04] hover:text-foreground"
          title="New chat"
          aria-label="New chat"
        >
          <SquarePen className="size-4" strokeWidth={1.75} />
        </Link>
      </div>

      {callError && <p role="alert" className="px-4 py-2 text-caption text-destructive">{callError}</p>}
      {q && <div className="eyebrow shrink-0 px-4 pt-2 pb-1.5">Search results for “{q}”</div>}
      <nav
        aria-label="M-dots and chats"
        className="min-h-0 flex-1 overflow-y-auto px-2 pb-2"
        onKeyDown={(event) => {
          if (!event.altKey || !["ArrowDown", "ArrowUp"].includes(event.key)) return;
          if (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(event.target.tagName)) return;
          const items = [...event.currentTarget.querySelectorAll<HTMLElement>("a, button, summary")]
            .filter((item) => item.offsetParent !== null && !item.hasAttribute("disabled"));
          const current = items.indexOf(document.activeElement as HTMLElement);
          if (current < 0 || !items.length) return;
          event.preventDefault();
          const direction = event.key === "ArrowDown" ? 1 : -1;
          items[(current + direction + items.length) % items.length]?.focus();
        }}
      >
        {!loaded && <div className="px-2 py-2 text-body-sm text-foreground/45">Connecting…</div>}
        {q ? (
          <>
            {dots.filter((dot) => dot.name.toLowerCase().includes(q.trim().toLowerCase())).length > 0 && (
              <SidebarGroup title="M-dots" count={dots.filter((dot) => dot.name.toLowerCase().includes(q.trim().toLowerCase())).length} defaultOpen>
                {dots.filter((dot) => dot.name.toLowerCase().includes(q.trim().toLowerCase())).map((dot) => (
                  <Link key={dot.id} href={`/dots/${dot.id}`} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-black/[0.04]">
                    <DotOrb look={dot.look} status={dot.status} size={32} />
                    <span className="truncate text-[13px] font-medium">{dot.name}</span>
                  </Link>
                ))}
              </SidebarGroup>
            )}
            <SidebarGroup title="Chats" count={recent.length} defaultOpen>
            {recent.map(renderConversation)}
            {loaded && !recent.length && <p className="px-3 py-6 text-center text-caption text-foreground/45">No chats match.</p>}
            </SidebarGroup>
          </>
        ) : (
          <div className="space-y-1.5 pt-1">
            <SidebarGroup title="Favorites" count={recent.filter((c) => favoriteIds.includes(c.id)).length} defaultOpen>
              {recent.filter((c) => favoriteIds.includes(c.id)).map(renderConversation)}
              {!recent.some((c) => favoriteIds.includes(c.id)) && <p className="px-3 py-2 text-caption text-foreground/40">Star a chat to keep it here.</p>}
            </SidebarGroup>
            <SidebarGroup
              title="Models / M-dots"
              count={dots.length}
              defaultOpen
              actions={
                <div className="flex items-center">
                  <button
                    type="button"
                    className={`grid size-7 place-items-center rounded-md transition-colors ${dotsLayout === "list" ? "bg-black/[0.06] text-foreground" : "text-foreground/40 hover:bg-black/[0.04] hover:text-foreground"}`}
                    aria-label="Show M-dots as a list"
                    aria-pressed={dotsLayout === "list"}
                    title="List view"
                    onClick={() => setDotsLayout("list")}
                  >
                    <List className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    className={`grid size-7 place-items-center rounded-md transition-colors ${dotsLayout === "columns" ? "bg-black/[0.06] text-foreground" : "text-foreground/40 hover:bg-black/[0.04] hover:text-foreground"}`}
                    aria-label="Show M-dots in columns"
                    aria-pressed={dotsLayout === "columns"}
                    title="Columns view"
                    onClick={() => setDotsLayout("columns")}
                  >
                    <LayoutGrid className="size-3.5" />
                  </button>
                </div>
              }
            >
              <div className={dotsLayout === "columns" ? "grid grid-cols-2 gap-1.5" : "space-y-0.5"}>
                {orderedDots.map((d) => (
                  <div
                    key={d.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggingDotId(d.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", d.id);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (dragOverDotId !== d.id) setDragOverDotId(d.id);
                    }}
                    onDragLeave={() => {
                      if (dragOverDotId === d.id) setDragOverDotId(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const sourceId = draggingDotId || e.dataTransfer.getData("text/plain");
                      if (!sourceId || sourceId === d.id) {
                        setDraggingDotId(null);
                        setDragOverDotId(null);
                        return;
                      }
                      const currentList = orderedDots.map((dot) => dot.id);
                      const fromIdx = currentList.indexOf(sourceId);
                      const toIdx = currentList.indexOf(d.id);
                      if (fromIdx !== -1 && toIdx !== -1) {
                        const nextOrder = [...currentList];
                        nextOrder.splice(fromIdx, 1);
                        nextOrder.splice(toIdx, 0, sourceId);
                        setDotsOrder(nextOrder);
                        try {
                          localStorage.setItem("mdots.dotsOrder", JSON.stringify(nextOrder));
                        } catch {}
                      }
                      setDraggingDotId(null);
                      setDragOverDotId(null);
                    }}
                    onDragEnd={() => {
                      setDraggingDotId(null);
                      setDragOverDotId(null);
                    }}
                    className={`group/dot relative select-none rounded-xl transition-all ${
                      dragOverDotId === d.id ? "ring-2 ring-[#7b83eb] scale-102" : ""
                    } ${draggingDotId === d.id ? "opacity-40" : ""}`}
                  >
                    {/* Small edit & delete icons - only visible on hover */}
                    <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover/dot:opacity-100 transition-opacity z-20">
                      <button
                        type="button"
                        title={`Edit ${d.name}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          router.push(`/dots/${d.id}?tab=setup`);
                        }}
                        className="flex size-5.5 items-center justify-center rounded-md bg-black/70 text-white/70 hover:bg-[#6264a7] hover:text-white transition-colors shadow-sm"
                      >
                        <Pencil className="size-2.5" />
                      </button>
                      <button
                        type="button"
                        title={confirmDeleteDotId === d.id ? `Click again to delete ${d.name}` : `Delete ${d.name}`}
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (confirmDeleteDotId === d.id) {
                            await deleteDot(d.id);
                            setConfirmDeleteDotId(null);
                            if (activeDot === d.id) router.push("/");
                          } else {
                            setConfirmDeleteDotId(d.id);
                          }
                        }}
                        className={`flex size-5.5 items-center justify-center rounded-md transition-colors shadow-sm ${
                          confirmDeleteDotId === d.id
                            ? "bg-destructive text-white animate-pulse"
                            : "bg-black/70 text-white/70 hover:bg-destructive hover:text-white"
                        }`}
                      >
                        <Trash2 className="size-2.5" />
                      </button>
                    </div>

                    <Link
                      href={`/dots/${d.id}`}
                      className={`flex min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors cursor-grab active:cursor-grabbing ${
                        dotsLayout === "columns" ? "flex-col items-start gap-1.5 border border-black/[0.06] p-2.5" : ""
                      } ${activeDot === d.id ? "bg-card shadow-2xs" : "hover:bg-black/[0.04]"}`}
                    >
                      <DotOrb look={d.look} status={d.status} size={dotsLayout === "columns" ? 42 : 32} />
                      <span className={`min-w-0 ${dotsLayout === "columns" ? "w-full" : "flex-1"}`}>
                        <span className="block truncate text-[13px] font-semibold text-foreground group-hover/dot:text-[#7b83eb] transition-colors">
                          {d.name}
                        </span>
                      </span>
                      {d.status !== "idle" && (
                        <span className={`size-2 rounded-full ${statusDot(d)}`} title={d.activity ?? d.status} />
                      )}
                    </Link>
                  </div>
                ))}
              </div>
              <Link href="/new" className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-foreground/55 hover:bg-black/[0.04] hover:text-foreground">
                <span className="grid size-8 place-items-center rounded-full border border-dashed border-black/20"><Plus className="size-4" /></span>
                Add an M-dot
              </Link>
            </SidebarGroup>
            <SidebarGroup title="Chats" count={recent.length} defaultOpen>
              {dots.map((d) => {
                const items = recent.filter((c) => c.dotId === d.id);
                if (!items.length) return null;
                return (
                  <DotChats key={d.id} dot={d} items={items} defaultOpen={activeDot === d.id} renderConversation={renderConversation} />
                );
              })}
              {loaded && !recent.length && <p className="px-3 py-2 text-caption text-foreground/40">No chats yet.</p>}
            </SidebarGroup>
          </div>
        )}
      </nav>
      </>}
      </section>
      </aside>
    </>
  );
}

const SETTINGS_LINKS = [
  { id: "general", label: "General", Icon: Settings },
  { id: "appearance", label: "Appearance", Icon: Sparkles },
  { id: "mdots", label: "M-dots", Icon: Sparkles },
  { id: "agents", label: "AI agents", Icon: Users },
  { id: "notifications", label: "Notifications and activity", Icon: Bell },
  { id: "accounts", label: "Accounts and orgs", Icon: Building2 },
  { id: "plugins", label: "Apps & plugins", Icon: Plus },
  { id: "passwords", label: "Privacy", Icon: ShieldCheck },
  { id: "computers", label: "Devices and models", Icon: Monitor },
];

function SettingsNavigation() {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("general");
  const links = SETTINGS_LINKS.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    const syncActive = () => setActive(window.location.hash.slice(1) || "general");
    syncActive();
    window.addEventListener("hashchange", syncActive);
    return () => window.removeEventListener("hashchange", syncActive);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-14 shrink-0 items-center border-b border-white/[0.08] px-5">
        <h2 className="text-[16px] font-semibold tracking-tight">Settings</h2>
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-3 py-4 md:px-4">
        <label className="relative mb-4 block shrink-0">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-foreground/45" />
          <input
            className="field h-9 bg-[#292929] pl-9 text-[13px]"
            placeholder="Find in Settings"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <nav aria-label="Settings sections" className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {links.map(({ id, label, Icon }) => (
            <a
              key={id}
              href={`/settings#${id}`}
              onClick={() => setActive(id)}
              aria-current={active === id ? "location" : undefined}
              className={`flex min-h-9 shrink-0 items-center gap-3 rounded-md px-3 text-[13px] transition-colors ${active === id ? "bg-[#292929] text-white" : "text-foreground/65 hover:bg-white/[0.06] hover:text-foreground"}`}
            >
              <Icon className={`size-[17px] shrink-0 ${active === id ? "text-[#8b8cf0]" : ""}`} strokeWidth={1.8} />
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <a
          href="/settings#about"
          onClick={() => setActive("about")}
          className={`mt-3 flex min-h-9 shrink-0 items-center gap-3 rounded-md px-3 text-[13px] transition-colors ${active === "about" ? "bg-[#292929] text-white" : "text-foreground/65 hover:bg-white/[0.06] hover:text-foreground"}`}
        >
          <Info className="size-[17px]" strokeWidth={1.8} />
          About M-dots
        </a>
      </div>
    </div>
  );
}

function CallsNavigation() {
  const dots = useStore((s) => s.dots);
  const [query, setQuery] = useState("");
  const filtered = dots.filter((d) => !query || d.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.08] px-4">
        <h2 className="text-[16px] font-semibold tracking-tight text-white">Calls</h2>
        <Link
          href="/calls"
          className="flex size-8 items-center justify-center rounded-md border border-white/10 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          title="Calls home"
        >
          <Phone className="size-4" strokeWidth={1.8} />
        </Link>
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-3 py-3">
        <div className="relative mb-3 block shrink-0">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-white/40" />
          <input
            className="field h-9 bg-[#292929] pl-9 text-[13px] text-white placeholder-white/40"
            placeholder="Search contacts & history"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wider text-white/40">
          Speed dial &amp; M-dots
        </div>
        <div className="space-y-1 overflow-y-auto">
          {filtered.map((dot) => (
            <Link
              key={dot.id}
              href="/calls"
              className="group flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-white/[0.06]"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <DotOrb look={dot.look} status={dot.status} size={28} />
                <span className="truncate text-[13px] font-medium text-white">{dot.name}</span>
              </div>
              <span className="p-1 text-[#7b83eb] opacity-0 transition-opacity group-hover:opacity-100">
                <PhoneCall className="size-3.5" />
              </span>
            </Link>
          ))}
          {!filtered.length && (
            <p className="px-2 py-4 text-center text-[12px] text-white/40">No matching contacts</p>
          )}
        </div>
      </div>
    </div>
  );
}

function RailLink({ href, active, label, children }: { href: string; active?: boolean; label: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={`relative flex size-11 items-center justify-center rounded-xl transition-colors ${active ? "bg-white/15 text-white before:absolute before:inset-y-2 before:-left-3 before:w-1 before:rounded-r-full before:bg-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
    >
      {children}
    </Link>
  );
}

function SidebarGroup({ title, count, defaultOpen = false, actions, children }: { title: string; count: number; defaultOpen?: boolean; actions?: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section>
      <div className="flex items-center">
        <button
          type="button"
          className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12px] font-medium text-foreground/60 hover:bg-black/[0.04] hover:text-foreground ${actions ? "pr-1" : ""}`}
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          <ChevronDown className={`size-3.5 transition-transform ${open ? "" : "-rotate-90"}`} />
          <span className="flex-1">{title}</span>
          <span className="font-mono text-[10px] text-foreground/40">{count}</span>
        </button>
        {actions}
      </div>
      {open && <div className="space-y-0.5 pb-1">{children}</div>}
    </section>
  );
}

function DotChats({ dot, items, defaultOpen, renderConversation }: { dot: Dot; items: Conversation[]; defaultOpen: boolean; renderConversation: (conversation: Conversation) => React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section>
      <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-black/[0.04]" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <ChevronDown className={`size-3.5 text-foreground/35 transition-transform ${open ? "" : "-rotate-90"}`} />
        <DotOrb look={dot.look} status={dot.status} size={26} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{dot.name}</span>
        <span className="font-mono text-[10px] text-foreground/40">{items.length}</span>
      </button>
      {open && <div className="ml-3 border-l border-black/[0.08] pl-2">{items.map(renderConversation)}</div>}
    </section>
  );
}

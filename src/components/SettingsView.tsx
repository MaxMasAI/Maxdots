"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell, Building2, CalendarDays, Check, CheckCircle2, ChevronRight, Code2, Cpu, ExternalLink, KeyRound, Lock, LogOut, Mail, Move, Pencil, Plus, RefreshCw, RotateCcw, ShieldCheck, Sparkles, Terminal, Trash2, UserRound } from "lucide-react";
import { connectApp, deleteDot, deletePassword, refreshApps, savePassword, setCloudKey, setDefaultModel, setDotReaction, setGeminiKey, setOpenAIKey, setOpenRouterKey, setVertexAI, signInComposio, signOutComposio } from "@/app/actions";
import { useStore } from "@/lib/store";
import { openAfter } from "@/lib/popup";
import { Empty, PageHeader, RemoveButton, RuleEditor, Section } from "./SettingsKit";
import ModelPicker from "./ModelPicker";
import { TriggersKey } from "./Triggers";
import DotOrb from "./DotOrb";

const noop = () => () => {};
const notificationPermission = () => ("Notification" in window ? Notification.permission : "unsupported");

export default function SettingsView() {
  const passwords = useStore((s) => s.passwords);
  const computer = useStore((s) => s.computer);
  const permission = useSyncExternalStore(noop, notificationPermission, () => "default");
  const [, force] = useState(0);
  const [form, setForm] = useState({ site: "", username: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-card">
      <div className="mx-auto min-h-full max-w-[1080px] px-5 pb-16 sm:px-8">
        <PageHeader id="general" eyebrow="M-dots workspace" title="Settings" description="Manage your workspace, AI agents, integrations, and security." />

        <DotsShowcaseBanner />

        <section id="appearance" className="scroll-mt-6 border-t border-white/[0.08] py-7">
          <div className="mb-4">
            <div className="eyebrow mb-1.5">Appearance</div>
            <h2 className="text-[15px] leading-snug font-medium">Workspace theme</h2>
            <p className="mt-1.5 text-body-sm text-foreground/55">M-dots uses the high-contrast dark workspace theme shown here, with purple accents and clear status colors.</p>
          </div>
          <div className="surface flex max-w-[560px] items-center gap-4 p-4">
            <span className="grid size-12 grid-cols-2 overflow-hidden rounded-md border border-white/10">
              <span className="bg-[#101010]" />
              <span className="bg-[#292929]" />
              <span className="bg-[#6264a7]" />
              <span className="bg-[#f5f5f5]" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium">Dark workspace</div>
              <div className="text-body-sm text-foreground/50">Charcoal surfaces · Teams purple · accessible contrast</div>
            </div>
            <span className="rounded-full bg-brand/15 px-2.5 py-1 text-[12px] font-medium text-brand-readable">Active</span>
          </div>
        </section>

        <Section id="mdots" eyebrow="M-dots" title="Dot reactions" description="Choose the default way your dots sound when they respond. A dot's profile and your task-specific instructions can further personalize its voice.">
          <DotReactionSettings />
        </Section>

        <Section
          id="passwords"
          eyebrow="Passwords"
          title="Saved logins"
          description="Your dots can securely use these to log into websites in their browser. Encrypted with a key in your macOS Keychain, typed directly into the page, and never shown to the model."
        >
          <div className="space-y-3">
            {passwords.length > 0 ? (
              <div className="surface divide-y divide-black/[0.06]">
                {passwords.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 py-2 pr-2 pl-4">
                    <KeyRound className="size-3.5 text-foreground/40" strokeWidth={1.75} />
                    <span className="w-40 truncate text-[14px]">{p.site}</span>
                    <span className="min-w-0 flex-1 truncate text-body-sm text-foreground/55">{p.username}</span>
                    <span className="font-mono text-[12px] tracking-widest text-foreground/35">••••••••</span>
                    <RemoveButton label="Delete password" onClick={() => start(() => deletePassword(p.id))} />
                  </div>
                ))}
              </div>
            ) : (
              <Empty>No saved logins yet.</Empty>
            )}
            <form
              className="surface space-y-3 p-4"
              autoComplete="off"
              onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  const err = await savePassword(form.site, form.username, form.password);
                  setError(err);
                  if (!err) setForm({ site: "", username: "", password: "" });
                });
              }}
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <input className="field" placeholder="Site, e.g. github.com" value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} />
                <input className="field" placeholder="Username or email" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                <input className="field" type="password" placeholder="Password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-caption text-foreground/45">
                  <Lock className="size-3" strokeWidth={2} /> AES-256-GCM, key in Keychain
                </span>
                {error && <span className="text-caption text-destructive">{error}</span>}
                <button className="btn-primary ml-auto h-8 px-3 text-[13px]" disabled={pending}>
                  Save login
                </button>
              </div>
            </form>
          </div>
        </Section>

        <Section id="agents" eyebrow="AI agents" title="Rules for all dots" description="These apply to every dot, on top of each dot's own rules.">
          <RuleEditor dotId={null} name="a dot" />
        </Section>

        <Section
          id="accounts"
          eyebrow="Accounts and orgs"
          title="Your accounts and organizations"
          description="See the accounts connected to this workspace and the organization behind M-dots."
        >
          <AccountsPanel />
        </Section>

        <Section
          id="plugins"
          eyebrow="Apps & plugins"
          title="Apps connected to your dots"
          description="Manage the apps and plugins your dots can use. Browse the app directory to add more."
        >
          <div className="space-y-4">
            <PluginBanners />
            <AppsList />
          </div>
        </Section>

        <Section
          id="triggers"
          eyebrow="Triggers"
          title="Wake dots from your apps"
          description="Let a dot act when something happens, like a new email or a GitHub issue. Triggers run through a Composio developer project, so they need its API key. Then add them from a dot's Setup page."
        >
          <TriggersKey />
        </Section>

        <Section id="notifications" eyebrow="Notifications" title="Desktop notifications" description={'Get notified when a dot finishes something or needs you, like "Your research is ready".'}>
          <div className="surface flex items-center gap-3 p-4">
            <Bell className="size-4 text-foreground/50" strokeWidth={1.5} />
            <span className="flex-1 text-body-sm">
              {permission === "granted"
                ? "Notifications are on."
                : permission === "denied"
                  ? "Notifications are blocked in your browser settings for this site."
                  : permission === "unsupported"
                    ? "This browser doesn't support notifications."
                    : "Notifications are off."}
            </span>
            {permission === "default" && (
              <button className="btn-primary h-8 px-3 text-[13px]" onClick={() => Notification.requestPermission().then(() => force((n) => n + 1))}>
                Turn on
              </button>
            )}
            {permission === "granted" && <span className="rounded-xs bg-success/12 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-success uppercase">On</span>}
          </div>
        </Section>

        <Section id="computers" eyebrow="Devices" title="Models & computers" description="Choose models from OpenAI, Gemini, Vertex AI, or OpenRouter.">
          <ApiKey />
          <GeminiKey />
          <VertexAI />
          <OpenModelsKey />
          <CloudKey />
          <div className="surface mb-3 flex items-center gap-3 p-4">
            <div className="flex-1">
              <div className="text-[14px]">Default model</div>
              <div className="text-body-sm text-foreground/55">Used by every dot that doesn&apos;t pick its own (pick per dot from its header).</div>
            </div>
            <ModelPicker allowDefault={false} value={computer.model || null} onChange={(m) => start(() => setDefaultModel(m))} />
          </div>
          <dl className="surface divide-y divide-black/[0.06]">
            {[
              ["Models on your key", computer.models.length ? `${computer.models.length} available` : "Loading…", true],
              ["Computer use", computer.computerTool === "off" ? "Off (page tools only)" : "OpenAI computer tool", true],
              ["Dot computers", computer.docker ? `Docker containers · ${computer.image}` : "Sandbox folders (start Docker for containers)", computer.docker],
            ].map(([k, v, ok]) => (
              <div key={String(k)} className="flex items-center gap-4 px-4 py-2.5">
                <dt className="eyebrow w-36 shrink-0">{k}</dt>
                <dd className={`flex-1 text-body-sm ${ok ? "" : "text-warning"}`}>{v}</dd>
              </div>
            ))}
          </dl>
        </Section>
        <AboutSection />
      </div>
    </div>
  );
}

function DotsShowcaseBanner() {
  const dots = useStore((s) => s.dots);
  const router = useRouter();
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [hasMoved, setHasMoved] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [canvasMode, setCanvasMode] = useState<"canvas" | "grid">("canvas");
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number }>({
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
  });

  // Calculate default clean layout positions on canvas
  const getDefaultPosition = (dotId: string, total: number) => {
    const idx = dots.findIndex((d) => d.id === dotId);
    if (idx === -1) return { x: 20, y: 20 };
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    return { x: 24 + col * 196, y: 20 + row * 165 };
  };

  // Load saved canvas positions from storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("mdots.bannerCanvasPositions");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") {
          setPositions(parsed);
          return;
        }
      }
    } catch {}
  }, []);

  const savePositions = (newPos: Record<string, { x: number; y: number }>) => {
    setPositions(newPos);
    try {
      localStorage.setItem("mdots.bannerCanvasPositions", JSON.stringify(newPos));
    } catch {}
  };

  const resetCanvas = () => {
    const fresh: Record<string, { x: number; y: number }> = {};
    dots.forEach((dot) => {
      fresh[dot.id] = getDefaultPosition(dot.id, dots.length);
    });
    savePositions(fresh);
  };

  // Freeform canvas drag handling
  const handlePointerDown = (dotId: string, e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("a")) {
      return;
    }

    const currentPos = positions[dotId] ?? getDefaultPosition(dotId, dots.length);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: currentPos.x,
      initY: currentPos.y,
    };
    setActiveDragId(dotId);
    setHasMoved(false);

    const onPointerMove = (moveEv: PointerEvent) => {
      const dx = moveEv.clientX - dragStartRef.current.startX;
      const dy = moveEv.clientY - dragStartRef.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        setHasMoved(true);
      }

      const container = containerRef.current;
      const maxX = container ? Math.max(container.clientWidth - 185, 20) : 750;
      const maxY = container ? Math.max(container.clientHeight - 155, 20) : 380;

      const newX = Math.max(8, Math.min(maxX, dragStartRef.current.initX + dx));
      const newY = Math.max(8, Math.min(maxY, dragStartRef.current.initY + dy));

      setPositions((prev) => ({
        ...prev,
        [dotId]: { x: newX, y: newY },
      }));
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      setActiveDragId(null);
      setPositions((latest) => {
        savePositions(latest);
        return latest;
      });
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const handleCardClick = (dotId: string) => {
    if (hasMoved) return; // ignore click if user was dragging
    router.push(`/dots/${dotId}`);
  };

  const handleEditDot = (dotId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    router.push(`/dots/${dotId}?tab=setup`);
  };

  const handleDeleteDot = async (dotId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (confirmDeleteId === dotId) {
      await deleteDot(dotId);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(dotId);
    }
  };

  return (
    <section className="relative mt-6 mb-8 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#181920] via-[#121318] to-[#0c0d10] p-5 shadow-2xl">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute -top-24 left-1/4 h-56 w-96 rounded-full bg-[#6264a7]/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 right-1/4 h-56 w-96 rounded-full bg-[#00d2ff]/15 blur-3xl" />

      {/* Header bar with controls */}
      <div className="relative mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5">
        <div>
          <div className="eyebrow mb-1 flex items-center gap-1.5 text-white/50">
            <Sparkles className="size-3.5 text-[#7b83eb]" />
            <span>M-dots Canvas Roster</span>
          </div>
          <h2 className="text-[17px] font-semibold tracking-tight text-white">
            Workspace Dots ({dots.length})
          </h2>
          <p className="mt-0.5 text-[12px] text-white/50">
            Drag and move any M-dot freely across the canvas. Hover on any dot to edit or delete.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Canvas / Grid toggle */}
          <div className="flex items-center rounded-lg border border-white/10 bg-black/40 p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setCanvasMode("canvas")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors ${
                canvasMode === "canvas" ? "bg-[#6264a7] text-white font-medium" : "text-white/60 hover:text-white"
              }`}
            >
              <Move className="size-3" />
              <span>Canvas</span>
            </button>
            <button
              type="button"
              onClick={() => setCanvasMode("grid")}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                canvasMode === "grid" ? "bg-[#6264a7] text-white font-medium" : "text-white/60 hover:text-white"
              }`}
            >
              <span>Grid</span>
            </button>
          </div>

          {canvasMode === "canvas" && (
            <button
              type="button"
              onClick={resetCanvas}
              title="Reset positions"
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/60 hover:bg-white/10 hover:text-white transition-colors"
            >
              <RotateCcw className="size-3" />
              <span>Reset</span>
            </button>
          )}

          <Link
            href="/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#6264a7] px-3 py-1 text-[12px] font-medium text-white transition-colors hover:bg-[#525492]"
          >
            <Plus className="size-3.5" />
            <span>New M-dot</span>
          </Link>
        </div>
      </div>

      {/* Freeform Movable Canvas Mode */}
      {canvasMode === "canvas" ? (
        <div
          ref={containerRef}
          className="relative min-h-[350px] w-full overflow-hidden rounded-xl border border-white/[0.08] bg-[#14151b] [background-image:radial-gradient(circle,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:20px_20px]"
          onClick={() => setConfirmDeleteId(null)}
        >
          {dots.map((dot) => {
            const pos = positions[dot.id] ?? getDefaultPosition(dot.id, dots.length);
            const isDragging = activeDragId === dot.id;

            return (
              <div
                key={dot.id}
                onPointerDown={(e) => handlePointerDown(dot.id, e)}
                onClick={() => handleCardClick(dot.id)}
                style={{
                  position: "absolute",
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                  touchAction: "none",
                }}
                className={`group w-[180px] h-[155px] select-none rounded-2xl border border-white/10 bg-[#1e1f25] p-3.5 transition-all flex flex-col items-center justify-between ${
                  isDragging
                    ? "z-30 cursor-grabbing scale-105 shadow-[0_16px_36px_rgba(0,0,0,0.6)] ring-1 ring-[#7b83eb]/80"
                    : "z-10 cursor-grab hover:border-white/30 hover:shadow-xl hover:-translate-y-0.5"
                }`}
              >
                {/* Small edit & delete icons - visible ONLY on hover matching user screenshot */}
                <div className="absolute top-2.5 right-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20">
                  <button
                    type="button"
                    title="Edit M-dot"
                    onClick={(e) => handleEditDot(dot.id, e)}
                    className="flex size-6 items-center justify-center rounded-md bg-black/70 text-white/70 hover:bg-[#6264a7] hover:text-white transition-colors shadow-sm"
                  >
                    <Pencil className="size-3" />
                  </button>
                  <button
                    type="button"
                    title={confirmDeleteId === dot.id ? "Click again to confirm delete" : "Delete M-dot"}
                    onClick={(e) => handleDeleteDot(dot.id, e)}
                    className={`flex size-6 items-center justify-center rounded-md transition-colors shadow-sm ${
                      confirmDeleteId === dot.id
                        ? "bg-destructive text-white animate-pulse"
                        : "bg-black/70 text-white/70 hover:bg-destructive hover:text-white"
                    }`}
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>

                {/* 3D Orb Avatar */}
                <div className="relative mt-1 flex flex-col items-center">
                  <div className="transition-transform group-hover:scale-105 duration-150">
                    <DotOrb look={dot.look} status={dot.status} size={54} />
                  </div>
                  {/* Subtle 3D floor reflection shadow */}
                  <div className="mt-1 h-1.5 w-10 rounded-full bg-black/45 blur-[1px]" />
                </div>

                {/* Dot Name matching user screenshot */}
                <div className="w-full text-center">
                  <span className="block truncate text-[14px] font-semibold text-white group-hover:text-[#99a0f5] transition-colors">
                    {dot.name}
                  </span>
                  <div className="mt-0.5 flex items-center justify-center gap-1.5 text-[10px] text-white/40">
                    <span
                      className={`size-1.5 rounded-full ${
                        dot.status === "working"
                          ? "bg-[#6264a7] animate-pulse"
                          : dot.status === "waiting"
                          ? "bg-amber-400"
                          : "bg-emerald-400"
                      }`}
                    />
                    <span className="capitalize">{dot.status}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Quick instructions hint */}
          <div className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-black/50 px-2.5 py-1 text-[11px] text-white/40 backdrop-blur-sm">
            Drag to rearrange · Hover to edit or delete
          </div>
        </div>
      ) : (
        /* Grid Mode */
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {dots.map((dot) => (
            <div
              key={dot.id}
              onClick={() => router.push(`/dots/${dot.id}`)}
              className="group relative h-[155px] cursor-pointer select-none rounded-2xl border border-white/10 bg-[#1e1f25] p-3.5 transition-all flex flex-col items-center justify-between hover:border-white/30 hover:shadow-xl hover:-translate-y-0.5"
            >
              {/* Small edit & delete icons on hover */}
              <div className="absolute top-2.5 right-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20">
                <button
                  type="button"
                  title="Edit M-dot"
                  onClick={(e) => handleEditDot(dot.id, e)}
                  className="flex size-6 items-center justify-center rounded-md bg-black/70 text-white/70 hover:bg-[#6264a7] hover:text-white transition-colors"
                >
                  <Pencil className="size-3" />
                </button>
                <button
                  type="button"
                  title={confirmDeleteId === dot.id ? "Confirm delete" : "Delete M-dot"}
                  onClick={(e) => handleDeleteDot(dot.id, e)}
                  className={`flex size-6 items-center justify-center rounded-md transition-colors ${
                    confirmDeleteId === dot.id
                      ? "bg-destructive text-white animate-pulse"
                      : "bg-black/70 text-white/70 hover:bg-destructive hover:text-white"
                  }`}
                >
                  <Trash2 className="size-3" />
                </button>
              </div>

              <div className="relative mt-1 flex flex-col items-center">
                <DotOrb look={dot.look} status={dot.status} size={54} />
                <div className="mt-1 h-1.5 w-10 rounded-full bg-black/45 blur-[1px]" />
              </div>

              <div className="w-full text-center">
                <span className="block truncate text-[14px] font-semibold text-white group-hover:text-[#99a0f5] transition-colors">
                  {dot.name}
                </span>
                <span className="text-[10px] text-white/40 capitalize">{dot.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AboutSection() {
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [autoUpdate, setAutoUpdate] = useState(true);

  const handleCheckForUpdates = () => {
    setChecking(true);
    setTimeout(() => {
      setChecking(false);
      setLastChecked(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }, 1200);
  };

  return (
    <section id="about" className="scroll-mt-6 border-t border-white/[0.08] py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="eyebrow mb-1">About</div>
          <h2 className="text-[18px] font-semibold text-white tracking-tight">Maxdots (M-dots)</h2>
          <p className="mt-1 text-body-sm text-foreground/60 max-w-xl">
            Enterprise workspace for autonomous AI agents that work alongside your team with their own computers, sandboxes, web browser, and live voice communication.
          </p>
        </div>

        {/* Check for updates action */}
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            id="check-for-updates-btn"
            onClick={handleCheckForUpdates}
            disabled={checking}
            className="flex items-center gap-2 rounded-lg bg-[#6264a7] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#525492] disabled:opacity-70 shadow-sm"
          >
            <RefreshCw className={`size-3.5 ${checking ? "animate-spin" : ""}`} />
            <span>{checking ? "Checking for updates…" : "Check for updates"}</span>
          </button>
          {lastChecked ? (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
              <CheckCircle2 className="size-3.5" />
              <span>You&apos;re on the latest version (Checked at {lastChecked})</span>
            </div>
          ) : (
            <span className="text-[11px] text-white/40">Latest version installed</span>
          )}
        </div>
      </div>

      {/* Version & Build Grid */}
      <div className="surface mb-5 divide-y divide-black/[0.06] overflow-hidden">
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <div className="text-[11px] font-medium text-foreground/45 uppercase tracking-wider">Version</div>
            <div className="mt-1 flex items-center gap-2 text-[14px] font-semibold text-white">
              <span>v1.2.4</span>
              <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-medium text-brand-readable">
                Teams Edition
              </span>
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-foreground/45 uppercase tracking-wider">Build &amp; Date</div>
            <div className="mt-1 text-[13px] text-white font-mono">2026.10.5-release</div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-foreground/45 uppercase tracking-wider">Release Channel</div>
            <div className="mt-1 text-[13px] text-white">Teams-grade Insider (PC x64)</div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-foreground/45 uppercase tracking-wider">Voice Calling</div>
            <div className="mt-1 text-[13px] text-emerald-400 font-medium">Google Gemini &amp; OpenAI</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 md:grid-cols-3 bg-black/[0.02]">
          <div className="flex items-center gap-2.5 text-[12px] text-foreground/60">
            <Cpu className="size-4 text-[#7b83eb]" />
            <span>Runtime: Next.js 16 (React 19) · Electron 44</span>
          </div>
          <div className="flex items-center gap-2.5 text-[12px] text-foreground/60">
            <Terminal className="size-4 text-emerald-400" />
            <span>Sandboxes: E2B Desktop &amp; Docker Linux</span>
          </div>
          <div className="flex items-center gap-2.5 text-[12px] text-foreground/60">
            <ShieldCheck className="size-4 text-sky-400" />
            <span>Security: Keychain AES-256 · Human in the Loop</span>
          </div>
        </div>
      </div>

      {/* Automatic updates toggle */}
      <div className="surface mb-5 flex items-center justify-between p-4">
        <div>
          <div className="text-[13.5px] font-medium text-white">Automatic updates</div>
          <div className="text-body-sm text-foreground/50">
            Automatically download and install runtime security patches and AI model updates.
          </div>
        </div>
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={autoUpdate}
            onChange={(e) => setAutoUpdate(e.target.checked)}
            className="peer sr-only"
          />
          <div className="h-6 w-11 rounded-full bg-white/20 peer-checked:bg-[#6264a7] peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full" />
        </label>
      </div>

      {/* What's New In v1.2.4 */}
      <div className="surface mb-5 p-4">
        <h3 className="text-[14px] font-semibold text-white mb-2 flex items-center gap-2">
          <Sparkles className="size-4 text-[#7b83eb]" />
          <span>What&apos;s new in this release</span>
        </h3>
        <ul className="space-y-1.5 text-body-sm text-foreground/65">
          <li className="flex items-start gap-2">
            <span className="text-[#7b83eb] font-bold">·</span>
            <span><strong>Google Gemini Voice Calling:</strong> Live spoken phone calls with your dots powered by Gemini 2.0 models with natural turn-taking and spoken task updates.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#7b83eb] font-bold">·</span>
            <span><strong>Teams-Grade Calls Hub:</strong> Dedicated Calls workspace featuring Speed Dial, Team Contacts, and automatic Call History tracking.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#7b83eb] font-bold">·</span>
            <span><strong>3D Puffball Avatars:</strong> Interactive Three.js character avatars with customizable shapes, colors, facial expressions, and accessories.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#7b83eb] font-bold">·</span>
            <span><strong>Dual Sandboxing:</strong> Run autonomous dot workflows in E2B Cloud Desktops or local Docker Linux containers.</span>
          </li>
        </ul>
      </div>

      {/* Links & Notices */}
      <div className="flex flex-wrap items-center gap-4 text-[12px] text-foreground/45">
        <a
          href="https://github.com/MaxMasAI/Maxdots"
          target="_blank"
          rel="noreferrer"
          className="hover:text-white transition-colors flex items-center gap-1"
        >
          <span>GitHub Repository</span>
          <ExternalLink className="size-3" />
        </a>
        <span>·</span>
        <a href="#appearance" className="hover:text-white transition-colors">Privacy Statement</a>
        <span>·</span>
        <a href="#agents" className="hover:text-white transition-colors">Workspace Terms</a>
        <span>·</span>
        <a href="#mdots" className="hover:text-white transition-colors">Third-Party Notices</a>
        <span>·</span>
        <span>Apache License 2.0 © 2026 Maxdots / MaxMasAI</span>
      </div>
    </section>
  );
}

function PluginBanners() {
  const banners = [
    {
      title: "Plan your week",
      description: "Connect Google Calendar to keep schedules and meetings in sync.",
      app: "Google Calendar",
      query: "Google Calendar",
      Icon: CalendarDays,
      art: "from-[#e6e8ff] via-[#d4d9ff] to-[#bac2ff]",
      accent: "text-[#4b55aa]",
    },
    {
      title: "Keep messages moving",
      description: "Bring your inbox into the same workspace as your dots.",
      app: "Gmail",
      query: "Gmail",
      Icon: Mail,
      art: "from-[#fff0eb] via-[#ffd7ce] to-[#f7b6c3]",
      accent: "text-[#a43d54]",
    },
    {
      title: "Build with your tools",
      description: "Connect code and project apps for help with real work.",
      app: "GitHub",
      query: "GitHub",
      Icon: Code2,
      art: "from-[#e6e5ed] via-[#d2cfdf] to-[#b6b1c9]",
      accent: "text-[#453d5d]",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {banners.map(({ title, description, app, query, Icon, art, accent }) => (
        <article key={app} className="surface overflow-hidden">
          <div className={`relative flex h-24 items-center justify-center overflow-hidden bg-gradient-to-br ${art}`}>
            <span className="absolute -top-7 -left-4 size-24 rounded-full bg-white/35 blur-[1px]" />
            <span className="absolute -right-2 -bottom-10 size-28 rounded-full bg-white/35" />
            <span className={`relative grid size-12 place-items-center rounded-2xl bg-white/70 shadow-sm ${accent}`}>
              <Icon className="size-6" strokeWidth={1.8} />
            </span>
          </div>
          <div className="p-3.5">
            <h3 className="text-[14px] font-medium">{title}</h3>
            <p className="mt-1 min-h-10 text-caption leading-relaxed text-foreground/55">{description}</p>
            <Link className="btn-secondary mt-3 h-8 w-full justify-center px-2 text-[12px]" href={`/apps?search=${encodeURIComponent(query)}`}>
              Explore {app}
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}

function DotReactionSettings() {
  const reaction = useStore((s) => s.computer.dotReaction);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="surface divide-y divide-black/[0.06]">
      {([
        { value: "professional", title: "Professional", description: "Clear, composed, and polished. Best for focused work." },
        { value: "cute", title: "Cute and friendly", description: "Warm, upbeat, and playful, with occasional fitting emojis." },
      ] as const).map((option) => (
        <label key={option.value} className="flex cursor-pointer items-start gap-3 p-4">
          <input
            type="radio"
            name="dot-reaction"
            value={option.value}
            checked={reaction === option.value}
            disabled={pending}
            className="mt-1 accent-[#6264a7]"
            onChange={() => start(async () => {
              try {
                await setDotReaction(option.value);
                setError(null);
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : String(cause));
              }
            })}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-medium">{option.title}</span>
            <span className="mt-0.5 block text-body-sm text-foreground/55">{option.description}</span>
          </span>
          {reaction === option.value && <Check className="mt-0.5 size-4 text-brand-readable" />}
        </label>
      ))}
      {error && <p role="alert" className="px-4 py-2 text-caption text-destructive">{error}</p>}
    </div>
  );
}

function AccountsPanel() {
  const computer = useStore((s) => s.computer);
  const apps = useStore((s) => s.apps);
  const signInError = useSearchParams().get("composio_error");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const connected = apps.filter((app) => app.connected).length;

  return (
    <div className="space-y-3">
      <div className="surface flex items-center gap-4 p-4">
        <div className="grid size-11 shrink-0 place-items-center rounded-full bg-brand/15 text-[15px] font-semibold text-brand-readable">M</div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium">Local workspace</div>
          <div className="text-body-sm text-foreground/55">This M-dots installation is stored on this device. No M-dots login account is connected.</div>
        </div>
        <span className="rounded-xs bg-black/[0.05] px-2 py-1 font-mono text-[10px] tracking-wider text-foreground/50 uppercase">This device</span>
      </div>

      <div className="surface flex flex-wrap items-center gap-3 p-4">
        <UserRound className="size-5 shrink-0 text-foreground/45" strokeWidth={1.7} />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium">Composio app account</div>
          <div className="text-body-sm text-foreground/55">
            {computer.composio
              ? `Signed in · ${connected} connected app${connected === 1 ? "" : "s"}`
              : "Sign in to connect personal accounts such as Gmail, Slack, and GitHub."}
          </div>
        </div>
        {computer.composio ? (
          <>
            <span className="flex items-center gap-1 rounded-xs bg-success/12 px-2 py-1 text-[11px] text-success"><Check className="size-3" /> Signed in</span>
            <button className="btn-quiet h-8 px-2.5 text-[13px]" disabled={pending} onClick={() => start(() => signOutComposio())}>
              <LogOut className="size-3.5" strokeWidth={1.75} /> Sign out
            </button>
          </>
        ) : (
          <button className="btn-primary shrink-0" disabled={pending} onClick={() => start(() => openAfter(signInComposio, setError))}>
            Sign in
          </button>
        )}
        {(error || signInError) && <span className="basis-full text-caption text-destructive">{error ?? signInError}</span>}
      </div>

      <div className="surface overflow-hidden">
        <div className="flex items-center gap-3 border-b border-black/[0.06] px-4 py-3">
          <Building2 className="size-5 text-foreground/45" strokeWidth={1.7} />
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-medium">MaxMasAI</div>
            <div className="text-body-sm text-foreground/55">Organization</div>
          </div>
          <span className="rounded-xs bg-black/[0.05] px-2 py-1 font-mono text-[10px] tracking-wider text-foreground/50 uppercase">Organization</span>
        </div>
        <dl className="divide-y divide-black/[0.06] px-4">
          <div className="flex gap-4 py-3 text-body-sm">
            <dt className="w-28 shrink-0 text-foreground/45">Product</dt>
            <dd>Maxdots (M-dots)</dd>
          </div>
          <div className="flex gap-4 py-3 text-body-sm">
            <dt className="w-28 shrink-0 text-foreground/45">Organization</dt>
            <dd><a className="underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground/60" href="https://github.com/MaxMasAI/Maxdots" target="_blank" rel="noreferrer">MaxMasAI on GitHub</a></dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function AppsList() {
  const apps = useStore((s) => s.apps);
  const signedIn = useStore((s) => s.computer.composio);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const connected = apps.filter((a) => a.connected);
  const suggested = apps.filter((a) => !a.connected);

  if (!signedIn) {
    return (
      <div className="surface flex items-center gap-3 p-4">
        <UserRound className="size-5 text-foreground/45" strokeWidth={1.7} />
        <div className="flex-1 text-body-sm text-foreground/60">Sign in under Accounts and orgs to connect your apps. No app accounts are connected yet.</div>
        <a className="btn-secondary h-8 px-3 text-[13px]" href="/settings#accounts">Accounts and orgs</a>
      </div>
    );
  }

  const connect = (slug: string) => {
    setBusy(slug);
    start(() => openAfter(() => connectApp(slug), setError).finally(() => setBusy(null)));
  };

  return (
    <div className="space-y-3">
      <div className="surface flex items-center gap-3 px-4 py-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://logos.composio.dev/api/composio" alt="" className="size-6 rounded-xs object-contain" />
        <div className="flex-1">
          <div className="text-[14px]">Connected apps</div>
          <div className="text-caption text-foreground/50">{connected.length} app{connected.length === 1 ? "" : "s"} available to your dots</div>
        </div>
        <button className="btn-quiet" disabled={pending} onClick={() => start(() => refreshApps())} title="Refresh">
          <RefreshCw className="size-3.5" strokeWidth={1.75} />
        </button>
      </div>

      {connected.length > 0 && (
        <div className="surface grid gap-px overflow-hidden bg-black/[0.06] sm:grid-cols-2">
          {connected.map((a) => (
            <div key={a.slug} className="flex items-center gap-3 bg-card px-4 py-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.logo} alt="" className="size-5 rounded-xs object-contain" />
              <span className="flex-1 truncate text-[14px]">{a.name}</span>
              <span className="size-1.5 rounded-full bg-success" title="Connected" />
            </div>
          ))}
        </div>
      )}

      {suggested.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="eyebrow">Connect more</span>
            <a href="/apps" className="btn-quiet">Browse all apps →</a>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggested.map((a) => (
              <button
                key={a.slug}
                className="flex h-9 items-center gap-2 rounded-md border border-black/10 bg-card pr-3 pl-2 text-[13px] transition-colors hover:border-black/25"
                disabled={pending}
                onClick={() => connect(a.slug)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.logo} alt="" className="size-4 object-contain" />
                {busy === a.slug ? "Opening…" : a.name}
                <Plus className="size-3 text-foreground/40" strokeWidth={2} />
              </button>
            ))}
          </div>
        </div>
      )}
      {error && <p className="text-caption text-destructive">{error}</p>}
    </div>
  );
}

/** The OpenAI key: paste it here (stored encrypted), unless it comes from OPENAI_API_KEY. */
function ApiKey() {
  const computer = useStore((s) => s.computer);
  const openAiModelCount = computer.models.filter((model) => !model.startsWith("openrouter:") && !model.startsWith("gemini:") && !model.startsWith("vertex:")).length;
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const isEnvFailed = computer.keySource === "env" && openAiModelCount === 0;
  const open = editing || !computer.hasKey || isEnvFailed;

  return (
    <div id="api-key" className="surface mb-3 p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="text-[14px]">OpenAI API key</div>
          <div className={`text-body-sm ${isEnvFailed ? "text-warning" : computer.hasKey ? "text-foreground/55" : "text-warning"}`}>
            {computer.keySource === "env"
              ? openAiModelCount
                ? "Connected from OPENAI_API_KEY."
                : "OPENAI_API_KEY is set, but OpenAI returned no available models. Enter a working key below to save and connect."
              : computer.hasKey
                ? "Connected. Stored encrypted on this computer."
                : computer.gemini || computer.vertex || computer.openRouter
                  ? "No OpenAI key. Gemini, Vertex AI, or OpenRouter can still power your dots."
                  : "Add a provider key to run your dots. Create an OpenAI key at platform.openai.com."}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {computer.keySource === "settings" && !editing && (
            <>
              <button
                className="btn-quiet h-8 px-3 text-[13px]"
                disabled={pending}
                onClick={() => {
                  start(async () => {
                    const err = await setOpenAIKey("");
                    setError(err);
                  });
                }}
              >
                Remove
              </button>
              <button className="btn-secondary h-8 px-3 text-[13px]" onClick={() => setEditing(true)}>
                Change
              </button>
            </>
          )}
          {computer.keySource === "env" && !editing && !isEnvFailed && (
            <button className="btn-secondary h-8 px-3 text-[13px]" onClick={() => setEditing(true)}>
              Override Key
            </button>
          )}
        </div>
      </div>
      {open && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const err = await setOpenAIKey(key);
              setError(err);
              if (!err) (setKey(""), setEditing(false));
            });
          }}
        >
          <input
            className="field font-mono text-[13px]"
            type="password"
            placeholder="Paste your OpenAI API key (sk-... or sk-proj-...)"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
            autoFocus={open}
          />
          <button className="btn-primary shrink-0" disabled={pending || !key.trim()}>
            {pending ? "Checking…" : "Save"}
          </button>
          {editing && !isEnvFailed && (
            <button
              type="button"
              className="btn-quiet shrink-0"
              onClick={() => {
                setEditing(false);
                setError(null);
                setKey("");
              }}
            >
              Cancel
            </button>
          )}
        </form>
      )}
      {error && <p className="mt-2 text-caption text-destructive">{error}</p>}
    </div>
  );
}

/** Optional E2B key: each dot gets a cloud computer that keeps working while this PC sleeps. */
function CloudKey() {
  const computer = useStore((s) => s.computer);
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const saved = computer.cloudKey !== null;
  const save = (value: string) =>
    start(async () => {
      const err = await setCloudKey(value);
      setError(err);
      if (!err) (setKey(""), setEditing(false));
    });

  return (
    <div id="cloud-key" className="surface mb-3 scroll-mt-6 p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="text-[14px]">
            Cloud computers <span className="text-foreground/40">· optional</span>
          </div>
          <div className="text-body-sm text-foreground/55">
            {computer.cloudKey === "env"
              ? "Connected from E2B_API_KEY."
              : saved
                ? "Connected. Each dot gets its own E2B cloud computer that keeps working while your PC sleeps."
                : "Paste an E2B API key (from e2b.dev) to give each dot a cloud computer that keeps working while your PC sleeps."}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {computer.cloudKey === "settings" && !editing && (
            <>
              <button className="btn-quiet h-8 px-3 text-[13px]" disabled={pending} onClick={() => save("")}>
                Remove
              </button>
              <button className="btn-secondary h-8 px-3 text-[13px]" onClick={() => setEditing(true)}>
                Change
              </button>
            </>
          )}
          {computer.cloudKey === "env" && !editing && (
            <button className="btn-secondary h-8 px-3 text-[13px]" onClick={() => setEditing(true)}>
              Override Key
            </button>
          )}
        </div>
      </div>
      {(editing || !saved) && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save(key);
          }}
        >
          <input className="field font-mono text-[13px]" type="password" placeholder="e2b_..." value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" />
          <button className="btn-primary shrink-0" disabled={pending || !key.trim()}>
            {pending ? "Checking…" : "Save"}
          </button>
          {editing && (
            <button
              type="button"
              className="btn-quiet shrink-0"
              onClick={() => {
                setEditing(false);
                setError(null);
                setKey("");
              }}
            >
              Cancel
            </button>
          )}
        </form>
      )}
      {error && <p className="mt-2 text-caption text-destructive">{error}</p>}
    </div>
  );
}

/** Optional OpenRouter key: adds open models (Qwen, DeepSeek, Kimi, GLM, Llama, gpt-oss…) to every model picker. */
function OpenModelsKey() {
  const computer = useStore((s) => s.computer);
  const openCount = computer.models.filter((m) => m.startsWith("openrouter:")).length;
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const saved = computer.openRouter !== null;
  const isEnvFailed = computer.openRouter === "env" && openCount === 0;
  const save = (value: string) =>
    start(async () => {
      const err = await setOpenRouterKey(value);
      setError(err);
      if (!err) (setKey(""), setEditing(false));
    });

  return (
    <div id="open-models" className="surface mb-3 scroll-mt-6 p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="text-[14px]">
            Open models <span className="text-foreground/40">· optional</span>
          </div>
          <div className="text-body-sm text-foreground/55">
            {computer.openRouter === "env"
              ? `Connected from OPENROUTER_API_KEY${openCount ? ` · ${openCount} open models in the model picker` : ""}.`
              : saved
                ? `Connected${openCount ? ` · ${openCount} open models in the model picker` : ""}. Voice calls still use OpenAI.`
                : "Paste an OpenRouter key (from openrouter.ai) to run dots on open models like Qwen, DeepSeek, Kimi, GLM and Llama."}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {computer.openRouter === "settings" && !editing && (
            <>
              <button className="btn-quiet h-8 px-3 text-[13px]" disabled={pending} onClick={() => save("")}>
                Remove
              </button>
              <button className="btn-secondary h-8 px-3 text-[13px]" onClick={() => setEditing(true)}>
                Change
              </button>
            </>
          )}
          {computer.openRouter === "env" && !editing && (
            <button className="btn-secondary h-8 px-3 text-[13px]" onClick={() => setEditing(true)}>
              Override Key
            </button>
          )}
        </div>
      </div>
      {(editing || !saved || isEnvFailed) && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save(key);
          }}
        >
          <input className="field font-mono text-[13px]" type="password" placeholder="sk-or-..." value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" />
          <button className="btn-primary shrink-0" disabled={pending || !key.trim()}>
            {pending ? "Checking…" : "Save"}
          </button>
          {editing && !isEnvFailed && (
            <button
              type="button"
              className="btn-quiet shrink-0"
              onClick={() => {
                setEditing(false);
                setError(null);
                setKey("");
              }}
            >
              Cancel
            </button>
          )}
        </form>
      )}
      {error && <p className="mt-2 text-caption text-destructive">{error}</p>}
    </div>
  );
}

/** Optional Gemini API key: adds Google's Gemini models to every model picker. */
function GeminiKey() {
  const computer = useStore((s) => s.computer);
  const modelCount = computer.models.filter((m) => m.startsWith("gemini:")).length;
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const saved = computer.gemini !== null;
  const isEnvFailed = computer.gemini === "env" && modelCount === 0;
  const save = (value: string) =>
    start(async () => {
      const err = await setGeminiKey(value);
      setError(err);
      if (!err) (setKey(""), setEditing(false));
    });

  return (
    <div id="gemini-key" className="surface mb-3 scroll-mt-6 p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="text-[14px]">
            Google Gemini <span className="text-foreground/40">· optional</span>
          </div>
          <div className="text-body-sm text-foreground/55">
            {computer.gemini === "env"
              ? `Connected from GEMINI_API_KEY${modelCount ? ` · ${modelCount} models in the picker` : ""}. Ready for chat and voice calls.`
              : saved
                ? `Connected${modelCount ? ` · ${modelCount} models in the picker` : ""}. Ready for chat and voice calls.`
                : "Add a Gemini API key from Google AI Studio to use Gemini models for chat and voice calls."}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {computer.gemini === "settings" && !editing && (
            <>
              <button className="btn-quiet h-8 px-3 text-[13px]" disabled={pending} onClick={() => save("")}>
                Remove
              </button>
              <button className="btn-secondary h-8 px-3 text-[13px]" onClick={() => setEditing(true)}>
                Change
              </button>
            </>
          )}
          {computer.gemini === "env" && !editing && (
            <button className="btn-secondary h-8 px-3 text-[13px]" onClick={() => setEditing(true)}>
              Override Key
            </button>
          )}
        </div>
      </div>
      {(editing || !saved || isEnvFailed) && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save(key);
          }}
        >
          <input className="field font-mono text-[13px]" type="password" placeholder="AIza..." value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" />
          <button className="btn-primary shrink-0" disabled={pending || !key.trim()}>
            {pending ? "Checking…" : "Save"}
          </button>
          {editing && !isEnvFailed && (
            <button
              type="button"
              className="btn-quiet shrink-0"
              onClick={() => {
                setEditing(false);
                setError(null);
                setKey("");
              }}
            >
              Cancel
            </button>
          )}
        </form>
      )}
      {error && <p className="mt-2 text-caption text-destructive">{error}</p>}
    </div>
  );
}

function VertexAI() {
  const computer = useStore((s) => s.computer);
  const modelCount = computer.models.filter((model) => model.startsWith("vertex:")).length;
  const [editing, setEditing] = useState(false);
  const [projectDraft, setProjectDraft] = useState<string | null>(null);
  const [locationDraft, setLocationDraft] = useState<string | null>(null);
  const [credentials, setCredentials] = useState("");
  const [useAdc, setUseAdc] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const saved = computer.vertex !== null;
  const environmentManaged = computer.vertex === "env";
  const project = projectDraft ?? computer.vertexProject;
  const location = locationDraft ?? computer.vertexLocation ?? "us-central1";
  const save = (nextProject: string, nextLocation: string, nextCredentials: string, nextUseAdc = false) =>
    start(async () => {
      const err = await setVertexAI(nextProject, nextLocation, nextCredentials, nextUseAdc);
      setError(err);
      setCredentials("");
      if (!err) {
        setProjectDraft(null);
        setLocationDraft(null);
        setUseAdc(false);
        setEditing(false);
      }
    });

  return (
    <div id="vertex-ai" className="surface mb-3 scroll-mt-6 p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="text-[14px]">
            Google Vertex AI <span className="text-foreground/40">· optional</span>
          </div>
          <div className="text-body-sm text-foreground/55">
            {environmentManaged
              ? computer.vertexProject
                ? `Configured from environment${modelCount ? ` · ${modelCount} Gemini models in the picker` : ""}.`
                : "Set VERTEX_AI_PROJECT to complete the environment configuration."
              : saved
                ? `${computer.vertexProject} · ${computer.vertexLocation}${modelCount ? ` · ${modelCount} Gemini models available` : " · no Gemini models returned"}`
                : "Use Gemini models through your Google Cloud project and Vertex AI."}
          </div>
        </div>
        {saved && !environmentManaged && !editing && (
          <>
            <button className="btn-quiet h-8 px-3 text-[13px]" disabled={pending} onClick={() => save("", "", "", true)}>
              Remove
            </button>
            <button className="btn-secondary h-8 px-3 text-[13px]" onClick={() => setEditing(true)}>
              Change
            </button>
          </>
        )}
        {!saved && <span className="rounded-xs bg-black/[0.05] px-2 py-1 font-mono text-[10px] tracking-wider text-foreground/50 uppercase">Not connected</span>}
      </div>
      {(editing || !saved) && !environmentManaged && (
        <form
          className="mt-3 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            save(project, location, credentials);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-caption text-foreground/55">
              Google Cloud project ID
              <input className="field mt-1.5 font-mono text-[13px]" placeholder="my-cloud-project" value={project} onChange={(event) => setProjectDraft(event.target.value)} autoComplete="off" />
            </label>
            <label className="block text-caption text-foreground/55">
              Vertex AI location
              <input className="field mt-1.5 font-mono text-[13px]" placeholder="us-central1" value={location} onChange={(event) => setLocationDraft(event.target.value)} autoComplete="off" />
            </label>
          </div>
          <label className="block text-caption text-foreground/55">
            Service-account JSON key <span className="text-foreground/35">· leave blank to keep an existing key or use ADC</span>
            <textarea
              className="field mt-1.5 min-h-24 resize-y font-mono text-[12px]"
              placeholder="Paste a Google Cloud service-account JSON key. It is encrypted locally and never sent to the browser after saving."
              value={credentials}
              onChange={(event) => setCredentials(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={useAdc}
            />
          </label>
          <label className="flex items-start gap-2 text-caption text-foreground/55">
            <input className="mt-0.5 accent-[#6264a7]" type="checkbox" checked={useAdc} onChange={(event) => setUseAdc(event.target.checked)} />
            <span>Use Application Default Credentials instead of a saved service-account key</span>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <p className="min-w-64 flex-1 text-caption text-foreground/45">
              Enable the Vertex AI API and billing. For local ADC, run <code className="font-mono">gcloud auth application-default login</code>; otherwise paste a service-account key with Vertex AI access.
            </p>
            <button className="btn-primary shrink-0" disabled={pending || !project.trim()}>
              {pending ? "Connecting…" : "Save and connect"}
            </button>
            {editing && <button type="button" className="btn-quiet" onClick={() => { setError(null); setProjectDraft(null); setLocationDraft(null); setCredentials(""); setUseAdc(false); setEditing(false); }}>Cancel</button>}
          </div>
        </form>
      )}
      {error && <p className="mt-2 text-caption text-destructive">{error}</p>}
    </div>
  );
}

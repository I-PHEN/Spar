"use client";

import { HeroHighlight, Highlight } from "@/components/ui/hero-highlight";

import { useEffect, useState, useRef } from "react";
import { ArrowRight, Play, Volume2, VolumeX, X } from "lucide-react";
import { SparringMockup } from "./sparring-mockup";
import { SparLogo } from "./spar-logo";
import { Kwesi } from "./kwesi-mascot";

interface HeroViewProps {
  onEnter: () => void;
}

export interface HeroStageItem {
  id: "debate" | "pitch" | "academic" | "drill";
  phrase: string;
  pillLabel: string;
  accentColor: string;
}

export const HERO_STAGE_ITEMS: HeroStageItem[] = [
  {
    id: "debate",
    phrase: "debate opponent",
    pillLabel: "Debate & Arguments",
    accentColor: "#FF4F28",
  },
  {
    id: "pitch",
    phrase: "pitch panel",
    pillLabel: "Pitches & Decks",
    accentColor: "#2563EB",
  },
  {
    id: "academic",
    phrase: "thesis committee",
    pillLabel: "Academic Defense",
    accentColor: "#EAB308",
  },
  {
    id: "drill",
    phrase: "drill coach",
    pillLabel: "Targeted Drills",
    accentColor: "#10B981",
  },
];

/**
 * Hero section — matte, ultra-simple Whop-inspired landing stage.
 *
 * Structure:
 * 1. Minimal matte glass header (Spar + Sign In / Get Started)
 * 2. Solid 3D voice visualizer capsule (zero glow, 60fps scaleY morph)
 * 3. Uninterrupted large solid 3D 3-slot carousel ("Your [role] / stage / all in one room.")
 * 4. Memorable motto ("The room before the real room.") + single matte Get Started CTA
 * 5. Scroll-autoplay 16:9 "60s Demo" video player frame directly below
 */
export function HeroView({ onEnter }: HeroViewProps) {
  const demoSectionRef = useRef<HTMLDivElement>(null);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [playingInlineDemo, setPlayingInlineDemo] = useState(false);
  const [demoMuted, setDemoMuted] = useState(true);
  const [activeStageIdx, setActiveStageIdx] = useState(0);
  const demoVideoUrl = process.env.NEXT_PUBLIC_DEMO_VIDEO_URL?.trim() || "";
  const inlineMedia = demoVideoUrl ? getEmbedVideoInfo(demoVideoUrl, demoMuted) : null;

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const timer = setInterval(() => {
      setActiveStageIdx((idx) => (idx + 1) % HERO_STAGE_ITEMS.length);
    }, 1550);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const node = demoSectionRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setPlayingInlineDemo(true);
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  function handleDemoFramePlay() {
    if (inlineMedia) {
      setPlayingInlineDemo(true);
      setDemoMuted(false);
      return;
    }
    setDemoModalOpen(true);
  }

  return (
    <div className="spar-hero-root relative flex min-h-screen flex-col overflow-x-clip bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* Matte top glass header (zero neon glow) */}
      <header
        className="sticky top-0 z-30 flex w-full items-center justify-between px-6 py-4 sm:px-10"
        style={{
          background: "rgba(10, 10, 14, 0.88)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <SparLogo size="md" />
            <span className="font-display text-base font-bold tracking-tight text-[var(--text-primary)]">
              Spar
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={onEnter}
              className="rounded-full px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              Sign In
            </button>
            <button
              onClick={onEnter}
              className="spar-white-btn inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-semibold"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* ─── Hero Section ─────────────────────────────────────────────── */}
      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-4 pt-8 pb-20 sm:pt-11">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center text-center">
          {/* Painted fluid circular voice orb (zero glow) */}
          <HeroSolidVoiceVisualizer />

          {/* Whop-Inspired Solid 3D Stage Carousel */}
          <div className="mt-5 w-full">
            <HeroIsometricCarousel
              activeIndex={activeStageIdx}
              onSelect={setActiveStageIdx}
            />
          </div>

          {/* Memorable Motto */}
          <p className="mx-auto mt-6 max-w-md text-base font-medium tracking-tight text-[var(--text-secondary)] sm:text-lg">
            The room before the real room.
          </p>

          {/* Single Volt CTA */}
          <div className="mt-7 flex items-center justify-center">
            <button
              onClick={onEnter}
              className="spar-volt-btn group inline-flex h-13 items-center gap-2 rounded-full px-9 text-base font-bold text-[#0B0D06]"
            >
              Get Started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>

        {/* Focused Quote Band between CTA and 60s Demo */}
        <div className="mx-auto mt-8 w-full max-w-3xl sm:mt-10">
          <HeroHighlight containerClassName="py-8 sm:py-10">
            <h2 className="font-display mx-auto max-w-2xl px-4 text-center text-xl font-bold leading-relaxed tracking-tight text-[var(--text-secondary)] sm:text-2xl sm:leading-snug lg:text-[1.75rem]">
              Don&apos;t rehearse in your head. Survive{" "}
              <Highlight>the hardest question in the room</Highlight> first.
            </h2>
          </HeroHighlight>
        </div>

        <Kwesi
          pose="hype"
          size="sm"
          line="Step into the ring. I'm in your corner — they're across the table."
          className="mx-auto mt-6 justify-center"
        />

        {/* Sleek Single 16:9 60s Demo Video Frame (scroll autoplay) */}
        <div
          ref={demoSectionRef}
          className="spar-chunky-card mx-auto mt-6 w-full max-w-3xl overflow-hidden sm:mt-8"
        >
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-2.5">
            <span className="text-[11px] font-medium text-[var(--text-secondary)]">
              60s Demo
            </span>
            <div className="flex items-center gap-3">
              {playingInlineDemo && inlineMedia?.kind === "video" && (
                <button
                  type="button"
                  onClick={() => setDemoMuted((m) => !m)}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)]"
                >
                  {demoMuted ? (
                    <>
                      <VolumeX className="h-3 w-3" />
                      Unmute
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-3 w-3" />
                      Sound On
                    </>
                  )}
                </button>
              )}
              {playingInlineDemo && !inlineMedia && (
                <button
                  type="button"
                  onClick={() => setDemoModalOpen(true)}
                  className="text-[10px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                >
                  Walkthrough
                </button>
              )}
              <span className="font-mono text-[11px] text-[var(--text-tertiary)]">
                01:00
              </span>
            </div>
          </div>

          <div className="relative min-h-[240px] w-full overflow-hidden bg-[#07070B] sm:min-h-0 sm:aspect-video">
            {playingInlineDemo && inlineMedia ? (
              inlineMedia.kind === "iframe" ? (
                <iframe
                  src={inlineMedia.src}
                  title="Spar 60s Product Demo"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              ) : (
                <video
                  src={inlineMedia.src}
                  controls
                  autoPlay
                  muted={demoMuted}
                  loop
                  playsInline
                  className="h-full w-full bg-black object-cover"
                />
              )
            ) : playingInlineDemo ? (
              <div
                onClick={() => setDemoModalOpen(true)}
                className="flex h-full w-full cursor-pointer items-center justify-center p-4 sm:p-6"
              >
                <div className="w-full">
                  <SparringMockup />
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleDemoFramePlay}
                className="group flex h-full w-full flex-col items-center justify-center gap-3.5 px-6 text-center transition-colors hover:bg-white/[0.015]"
                aria-label="Play 60s Demo"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--text-primary)] transition-transform group-hover:scale-105">
                  <Play className="ml-0.5 h-5 w-5 fill-current" />
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    Watch the 60s walkthrough
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    Hear Ada open the room, interrupt weak claims, and deliver the debrief.
                  </p>
                </div>
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Interactive Demo Modal fallback when inline demo video URL is unset */}
      <DemoShowcaseModal
        open={demoModalOpen}
        onClose={() => setDemoModalOpen(false)}
        onEnter={() => {
          setDemoModalOpen(false);
          onEnter();
        }}
        videoUrl={demoVideoUrl}
      />
    </div>
  );
}

const WALKTHROUGH_PILLARS = [
  { num: "01", title: "Attach & Scan", desc: "Upload a debate case, paper, or resume for instant attack hotspots." },
  { num: "02", title: "Hands-Free Voice Q&A", desc: "Auto-Mic listens, adapts to interruptions, and submits naturally." },
  { num: "03", title: "Live Drill Buzzer", desc: "Catches hedging and filler words mid-sentence in real time." },
  { num: "04", title: "Executive Debrief", desc: "Pinpoints The Moment, your recurring pattern, and 5 skill scores." },
];

function getEmbedVideoInfo(
  url: string,
  muted = false,
): { kind: "iframe" | "video"; src: string } | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    if (trimmed.includes("youtube.com") || trimmed.includes("youtu.be")) {
      const parsed = new URL(trimmed);
      let videoId = parsed.searchParams.get("v") || "";
      if (!videoId && trimmed.includes("youtu.be/")) {
        videoId = parsed.pathname.replace(/^\//, "");
      }
      if (!videoId && parsed.pathname.includes("/embed/")) {
        videoId = parsed.pathname.split("/embed/")[1] || "";
      }
      if (videoId) {
        const muteParam = muted ? "&mute=1" : "";
        return {
          kind: "iframe",
          src: `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0${muteParam}`,
        };
      }
    }
    if (trimmed.includes("loom.com")) {
      const embedSrc = trimmed.includes("/embed/")
        ? trimmed
        : trimmed.replace("/share/", "/embed/");
      return { kind: "iframe", src: embedSrc };
    }
  } catch {
    // Fall back to native HTML5 video if URL parsing fails
  }

  return { kind: "video", src: trimmed };
}

export function DemoShowcaseModal({
  open,
  onClose,
  onEnter,
  videoUrl,
}: {
  open: boolean;
  onClose: () => void;
  onEnter: () => void;
  videoUrl?: string;
}) {
  if (!open) return null;
  const media = videoUrl ? getEmbedVideoInfo(videoUrl) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Spar Product Demo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#FF4F28]">
              Interactive Product Demo
            </p>
            <h2 className="mt-0.5 text-lg font-bold tracking-tight text-[var(--text-primary)]">
              Inside the Sparring Room
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close demo"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--text-secondary)] transition-colors hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {media && (
          <div className="mb-5 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-black">
            {media.kind === "iframe" ? (
              <div className="aspect-video w-full">
                <iframe
                  src={media.src}
                  title="Spar Product Demo Video"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
            ) : (
              <video
                src={media.src}
                controls
                autoPlay
                playsInline
                className="aspect-video w-full bg-black"
              />
            )}
          </div>
        )}

        <div className="mb-4">
          <SparringMockup />
        </div>

        <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {WALKTHROUGH_PILLARS.map((item) => (
            <div
              key={item.num}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/70 px-3 py-2.5"
            >
              <p className="text-[11px] font-semibold text-[var(--text-primary)]">
                <span className="mr-1.5 font-mono text-[10px] text-[#FF4F28]">{item.num}</span>
                {item.title}
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-[var(--border-subtle)] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-white"
          >
            Close preview
          </button>
          <button
            type="button"
            onClick={onEnter}
            className="spar-volt-btn inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold text-[#0B0D06]"
          >
            Try Spar Live Now
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Painted Fluid Circular Voice Orb (Zero Glow, Zero Hollow Strokes) ──

function buildFluidBlobPath(
  cx: number,
  cy: number,
  baseRadius: number,
  time: number,
  speed: number,
  amp1: number,
  amp2: number,
  phaseOffset: number,
): string {
  const numPoints = 32;
  const pts: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const harmonic =
      amp1 * Math.sin(angle * 3 + time * speed + phaseOffset) +
      amp2 * Math.cos(angle * 5 - time * speed * 1.35 + phaseOffset * 1.7);
    const r = baseRadius + harmonic;
    pts.push({
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
    });
  }

  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < numPoints; i++) {
    const p0 = pts[(i - 1 + numPoints) % numPoints];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % numPoints];
    const p3 = pts[(i + 2) % numPoints];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  return `${d} Z`;
}

const INITIAL_OUTER_BLOB = buildFluidBlobPath(40, 40, 31, 0, 1.4, 2.2, 1.0, 0.2);
const INITIAL_MID_BLOB = buildFluidBlobPath(40, 40, 23, 0, 1.9, 1.9, 0.9, 1.8);
const INITIAL_CORE_BLOB = buildFluidBlobPath(40, 40, 15, 0, 2.4, 1.3, 0.6, 3.4);

function HeroSolidVoiceVisualizer() {
  const outerRef = useRef<SVGPathElement | null>(null);
  const midRef = useRef<SVGPathElement | null>(null);
  const coreRef = useRef<SVGPathElement | null>(null);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let rafId = 0;
    const start = performance.now();

    const frame = (now: number) => {
      const t = (now - start) / 1000;
      const breath = 0.85 + 0.15 * Math.sin(t * 2.1);

      if (outerRef.current) {
        outerRef.current.setAttribute(
          "d",
          buildFluidBlobPath(40, 40, 31 + 1.2 * Math.sin(t * 1.9), t, 1.4, 2.4 * breath, 1.1 * breath, 0.2),
        );
      }
      if (midRef.current) {
        midRef.current.setAttribute(
          "d",
          buildFluidBlobPath(40, 40, 23 + 1.0 * Math.cos(t * 2.3), t, 1.9, 2.1 * breath, 1.0 * breath, 1.8),
        );
      }
      if (coreRef.current) {
        coreRef.current.setAttribute(
          "d",
          buildFluidBlobPath(40, 40, 15 + 0.75 * Math.sin(t * 2.8), t, 2.4, 1.5 * breath, 0.7 * breath, 3.4),
        );
      }

      rafId = window.requestAnimationFrame(frame);
    };

    rafId = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="flex h-24 w-24 items-center justify-center sm:h-28 sm:w-28"
    >
      <svg
        viewBox="0 0 80 80"
        className="h-full w-full overflow-visible"
        role="presentation"
      >
        <defs>
          <radialGradient id="voice-orb-outer" cx="38%" cy="32%" r="72%">
            <stop offset="0%" stopColor="#3B4F11" />
            <stop offset="100%" stopColor="#1A2407" />
          </radialGradient>
          <radialGradient id="voice-orb-mid" cx="36%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#C6FF3D" />
            <stop offset="100%" stopColor="#6B8E1A" />
          </radialGradient>
          <radialGradient id="voice-orb-core" cx="35%" cy="30%" r="72%">
            <stop offset="0%" stopColor="#F4FFCC" />
            <stop offset="46%" stopColor="#D4FF66" />
            <stop offset="100%" stopColor="#84CC16" />
          </radialGradient>
        </defs>

        <path
          ref={outerRef}
          d={INITIAL_OUTER_BLOB}
          fill="url(#voice-orb-outer)"
          opacity="0.96"
        />
        <path
          ref={midRef}
          d={INITIAL_MID_BLOB}
          fill="url(#voice-orb-mid)"
          opacity="0.96"
        />
        <path
          ref={coreRef}
          d={INITIAL_CORE_BLOB}
          fill="url(#voice-orb-core)"
        />
      </svg>
    </div>
  );
}

// ─── Whop-Inspired Solid 3D 3-Slot Isometric Hero Carousel ───────────────

function HeroIsometricCarousel({
  activeIndex,
  onSelect,
}: {
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  const total = HERO_STAGE_ITEMS.length;

  return (
    <div className="flex flex-col items-center">
      {/* Top cycling headline with 60fps vertical GPU slot-roller */}
      <h1 className="font-display flex flex-wrap items-center justify-center gap-x-[0.26em] text-center text-[28px] font-bold tracking-tight text-[var(--text-primary)] sm:text-6xl sm:leading-[1.32]">
        <span className="leading-[1.32]">Your </span>
        <span
          className="relative inline-block h-[1.32em] overflow-hidden align-bottom"
          aria-live="polite"
        >
          <span
            className="flex flex-col will-change-transform"
            style={{
              transform: `translate3d(0, -${activeIndex * 25}%, 0)`,
              transition: "transform 480ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            {HERO_STAGE_ITEMS.map((item, idx) => (
              <span
                key={item.id}
                className="flex h-[1.32em] shrink-0 items-center justify-center whitespace-nowrap leading-[1.32]"
                style={{
                  color: item.accentColor,
                  opacity: idx === activeIndex ? 1 : 0,
                  transition: "opacity 220ms ease",
                }}
              >
                {item.phrase}
              </span>
            ))}
          </span>
        </span>
      </h1>

      {/* Large 3-slot Solid 3D Stage (never pauses on mouse hover) */}
      <div
        aria-hidden="true"
        className="relative mx-auto my-3 flex h-[230px] w-full max-w-3xl items-center justify-center overflow-hidden sm:h-[300px] [--stage-x:108px] sm:[--stage-x:248px]"
      >
        {HERO_STAGE_ITEMS.map((item, idx) => {
          const isCenter = idx === activeIndex;
          const isLeft = idx === (activeIndex + total - 1) % total;
          const isRight = idx === (activeIndex + 1) % total;

          let transform = "translate3d(0px, -24px, 0) scale(0.40)";
          let opacity = 0;
          let zIndex = 10;
          let pointerEvents: "auto" | "none" = "none";

          if (isCenter) {
            transform = "translate3d(0px, 0px, 0) scale(1.08)";
            opacity = 1;
            zIndex = 30;
            pointerEvents = "auto";
          } else if (isLeft) {
            transform =
              "translate3d(calc(var(--stage-x) * -1), 12px, 0) scale(0.60)";
            opacity = 0.5;
            zIndex = 20;
            pointerEvents = "auto";
          } else if (isRight) {
            transform = "translate3d(var(--stage-x), 12px, 0) scale(0.60)";
            opacity = 0.5;
            zIndex = 20;
            pointerEvents = "auto";
          }

          return (
            <button
              key={item.id}
              type="button"
              tabIndex={-1}
              onClick={() => onSelect(idx)}
              className="absolute flex h-[220px] w-[240px] items-center justify-center focus:outline-none sm:h-[268px] sm:w-[292px]"
              style={{
                transform,
                opacity,
                zIndex,
                pointerEvents,
                willChange: "transform, opacity",
                transition:
                  "transform 480ms cubic-bezier(0.22, 1, 0.36, 1), opacity 380ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              <IsometricStageObject id={item.id} active={isCenter} />
            </button>
          );
        })}
      </div>

      {/* Bottom completion headline */}
      <p className="font-display text-center text-[32px] font-bold tracking-tight text-[var(--text-primary)] sm:text-6xl sm:leading-[1.12]">
        all in one room.
      </p>
    </div>
  );
}

function IsometricStageObject({
  id,
  active,
}: {
  id: HeroStageItem["id"];
  active: boolean;
}) {
  if (id === "debate") {
    return (
      <svg
        viewBox="0 0 240 210"
        className="h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="d-slab-top" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#323240" />
            <stop offset="100%" stopColor="#1D1D26" />
          </linearGradient>
          <linearGradient id="d-slab-left" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1D1D27" />
            <stop offset="100%" stopColor="#101016" />
          </linearGradient>
          <linearGradient id="d-slab-right" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#111118" />
            <stop offset="100%" stopColor="#07070A" />
          </linearGradient>
          <linearGradient id="d-red-top" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FF7252" />
            <stop offset="100%" stopColor="#FF4F28" />
          </linearGradient>
          <linearGradient id="d-red-side" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D63714" />
            <stop offset="100%" stopColor="#942007" />
          </linearGradient>
          <radialGradient id="d-mic-red" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#FF9E88" />
            <stop offset="45%" stopColor="#FF4F28" />
            <stop offset="100%" stopColor="#7C1A05" />
          </radialGradient>
          <radialGradient id="d-mic-steel" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="45%" stopColor="#D4D4D8" />
            <stop offset="100%" stopColor="#3F3F46" />
          </radialGradient>
        </defs>
        {/* Solid contact shadow */}
        <ellipse
          cx="120"
          cy="176"
          rx="90"
          ry="24"
          fill={active ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0.38)"}
        />
        {/* Heavy 3D Stepped Hardware Plinth */}
        <polygon points="120,122 204,154 120,186 36,154" fill="url(#d-slab-top)" stroke="rgba(255,255,255,0.16)" strokeWidth="1.2" />
        <polygon points="36,154 120,186 120,204 36,172" fill="url(#d-slab-left)" />
        <polygon points="204,154 120,186 120,204 204,172" fill="url(#d-slab-right)" />
        {/* Extruded Solid Podium Column */}
        <polygon points="84,82 120,66 156,82 120,98" fill="#2C2C38" />
        <polygon points="84,82 120,98 120,162 84,146" fill="url(#d-slab-left)" />
        <polygon points="156,82 120,98 120,162 156,146" fill="url(#d-slab-right)" />
        <line x1="120" y1="98" x2="120" y2="162" stroke="rgba(255,255,255,0.22)" strokeWidth="1.2" />
        {/* Recessed Vermilion Red Debate Crest */}
        <polygon points="94,102 114,111 114,134 94,125" fill="url(#d-red-top)" />
        <polygon points="126,111 146,102 146,125 126,134" fill="url(#d-red-side)" />
        {/* Thick Beveled Lectern Top Deck */}
        <polygon points="72,68 120,48 168,68 120,88" fill="url(#d-slab-top)" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2" />
        <polygon points="72,68 120,88 120,98 72,78" fill="#1F1F29" />
        <polygon points="168,68 120,88 120,98 168,78" fill="#0F0F15" />
        {/* 3D Condenser Microphones */}
        <path d="M98 70 L88 42 L98 37" fill="none" stroke="#A1A1AA" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="101" cy="36" r="8" fill="url(#d-mic-red)" />
        <path d="M142 70 L152 42 L142 37" fill="none" stroke="#A1A1AA" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="139" cy="36" r="8" fill="url(#d-mic-steel)" />
        {/* Thick 3D Extruded Vermilion Argument Block */}
        <polygon points="146,14 198,32 174,50 122,32" fill="url(#d-red-top)" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
        <polygon points="122,32 174,50 174,62 122,44" fill="url(#d-red-side)" />
        <polygon points="198,32 174,50 174,62 198,44" fill="#6F1704" />
        <line x1="138" y1="28" x2="168" y2="38" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }

  if (id === "pitch") {
    return (
      <svg
        viewBox="0 0 240 210"
        className="h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="p-table-top" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#323240" />
            <stop offset="100%" stopColor="#1D1D26" />
          </linearGradient>
          <linearGradient id="p-slab-left" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1D1D27" />
            <stop offset="100%" stopColor="#101016" />
          </linearGradient>
          <linearGradient id="p-slab-right" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#111118" />
            <stop offset="100%" stopColor="#07070A" />
          </linearGradient>
          <linearGradient id="p-blue-front" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C6FF3D" />
            <stop offset="100%" stopColor="#6B8E1A" />
          </linearGradient>
          <radialGradient id="p-orb-cobalt" cx="35%" cy="28%" r="65%">
            <stop offset="0%" stopColor="#93C5FD" />
            <stop offset="45%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#0F265C" />
          </radialGradient>
          <radialGradient id="p-orb-white" cx="35%" cy="28%" r="65%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="50%" stopColor="#E4E4E7" />
            <stop offset="100%" stopColor="#52525B" />
          </radialGradient>
        </defs>
        <ellipse
          cx="120"
          cy="176"
          rx="90"
          ry="24"
          fill={active ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0.38)"}
        />
        {/* Thick 3D Aluminum Pitch Display Frame */}
        <polygon points="50,36 164,12 164,96 50,120" fill="#14141D" stroke="rgba(255,255,255,0.2)" strokeWidth="1.4" />
        <polygon points="50,36 164,12 174,17 60,41" fill="#323240" />
        <polygon points="164,12 174,17 174,101 164,96" fill="#0B0B10" />
        {/* Solid 3D Extruded Chart Columns inside Screen */}
        <polygon points="68,96 82,93 82,72 68,75" fill="#1E3A8A" />
        <polygon points="82,93 88,90 88,69 82,72" fill="#172554" />
        <polygon points="92,91 106,88 106,54 92,57" fill="#6B8E1A" />
        <polygon points="106,88 112,85 112,51 106,54" fill="#4D6810" />
        <polygon points="116,86 130,83 130,36 116,39" fill="url(#p-blue-front)" />
        <polygon points="116,39 130,36 136,33 122,36" fill="#D9FF73" />
        <polygon points="130,83 136,80 136,33 130,36" fill="#6B8E1A" />
        <polyline points="72,66 100,48 124,28 148,22" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
        {/* Heavy Extruded Boardroom Table Slab */}
        <polygon points="120,114 206,146 120,178 34,146" fill="url(#p-table-top)" stroke="rgba(255,255,255,0.16)" strokeWidth="1.2" />
        <polygon points="34,146 120,178 120,196 34,164" fill="url(#p-slab-left)" />
        <polygon points="206,146 120,178 120,196 206,164" fill="url(#p-slab-right)" />
        {/* Volumetric 3D Shaded Panelist Spheres */}
        <circle cx="84" cy="126" r="14" fill="url(#p-orb-cobalt)" />
        <circle cx="122" cy="112" r="16" fill="url(#p-orb-white)" />
        <circle cx="158" cy="128" r="14" fill="url(#p-orb-cobalt)" />
      </svg>
    );
  }

  if (id === "academic") {
    return (
      <svg
        viewBox="0 0 240 210"
        className="h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="a-cover-top" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#323240" />
            <stop offset="100%" stopColor="#1D1D26" />
          </linearGradient>
          <linearGradient id="a-pages-side" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F5F5F7" />
            <stop offset="100%" stopColor="#A1A1AA" />
          </linearGradient>
          <linearGradient id="a-gold-top" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#EAB308" />
          </linearGradient>
          <linearGradient id="a-gold-left" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#CA8A04" />
            <stop offset="100%" stopColor="#854D0E" />
          </linearGradient>
          <radialGradient id="a-pearl" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="60%" stopColor="#FACC15" />
            <stop offset="100%" stopColor="#854D0E" />
          </radialGradient>
        </defs>
        <ellipse
          cx="120"
          cy="176"
          rx="90"
          ry="24"
          fill={active ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0.38)"}
        />
        {/* Bottom Heavy 3D Manuscript Volume */}
        <polygon points="120,104 200,136 120,168 40,136" fill="url(#a-cover-top)" stroke="rgba(255,255,255,0.16)" strokeWidth="1.2" />
        <polygon points="40,136 120,168 120,190 40,158" fill="#13131A" />
        <polygon points="200,136 120,168 120,190 200,158" fill="url(#a-pages-side)" />
        {/* Page grain ribs */}
        <line x1="126" y1="173" x2="194" y2="146" stroke="#71717A" strokeWidth="1" />
        <line x1="126" y1="181" x2="194" y2="154" stroke="#71717A" strokeWidth="1" />
        {/* Middle 3D Volume */}
        <polygon points="120,78 188,105 120,132 52,105" fill="#2A2A37" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" />
        <polygon points="52,105 120,132 120,151 52,124" fill="#181822" />
        <polygon points="188,105 120,132 120,151 188,124" fill="url(#a-pages-side)" />
        {/* Top Thesis Manuscript Page */}
        <polygon points="120,56 174,78 120,100 66,78" fill="#F5F5F7" />
        <polygon points="66,78 120,100 120,104 66,82" fill="#D4D4D8" />
        <line x1="94" y1="76" x2="128" y2="90" stroke="#3F3F46" strokeWidth="3" strokeLinecap="round" />
        <line x1="110" y1="68" x2="148" y2="83" stroke="#EAB308" strokeWidth="4" strokeLinecap="round" />
        {/* Solid 3D Amber Gold Faceted Prism */}
        <polygon points="142,14 166,26 142,38 118,26" fill="url(#a-gold-top)" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
        <polygon points="118,26 142,38 142,58 118,46" fill="url(#a-gold-left)" />
        <polygon points="166,26 142,38 142,58 166,46" fill="#713F12" />
        <circle cx="142" cy="26" r="6" fill="url(#a-pearl)" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 240 210"
      className="h-full w-full overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="r-slab-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#323240" />
          <stop offset="100%" stopColor="#1D1D26" />
        </linearGradient>
        <linearGradient id="r-slab-left" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1D1D27" />
          <stop offset="100%" stopColor="#101016" />
        </linearGradient>
        <linearGradient id="r-slab-right" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#111118" />
          <stop offset="100%" stopColor="#07070A" />
        </linearGradient>
        <radialGradient id="r-dome-jade" cx="35%" cy="28%" r="65%">
          <stop offset="0%" stopColor="#A7F3D0" />
          <stop offset="40%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#064E3B" />
        </radialGradient>
        <linearGradient id="r-bar-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
      </defs>
      <ellipse
        cx="120"
        cy="176"
        rx="90"
        ry="24"
        fill={active ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0.38)"}
      />
      {/* Heavy Machined Hardware Drill Console */}
      <polygon points="120,88 204,124 120,160 36,124" fill="url(#r-slab-top)" stroke="rgba(255,255,255,0.16)" strokeWidth="1.2" />
      <polygon points="36,124 120,160 120,186 36,150" fill="url(#r-slab-left)" />
      <polygon points="204,124 120,160 120,186 204,150" fill="url(#r-slab-right)" />
      {/* Extruded Recessed Metal Collar + Volumetric Jade Buzzer Dome */}
      <ellipse cx="102" cy="122" rx="34" ry="17" fill="#0E0E13" stroke="rgba(255,255,255,0.16)" strokeWidth="1.2" />
      <ellipse cx="102" cy="117" rx="28" ry="14" fill="#047857" />
      <path d="M74 117 C74 88, 130 88, 130 117 Z" fill="url(#r-dome-jade)" />
      {/* Solid 3D Level Blocks */}
      <polygon points="146,98 158,103 158,72 146,67" fill="#065F46" />
      <polygon points="158,103 168,98 168,67 158,72" fill="url(#r-bar-front)" />
      <polygon points="146,67 156,62 168,67 158,72" fill="#6EE7B7" />
      <polygon points="164,90 176,95 176,48 164,43" fill="#065F46" />
      <polygon points="176,95 186,90 186,43 176,48" fill="url(#r-bar-front)" />
      <polygon points="164,43 174,38 186,43 176,48" fill="#A7F3D0" />
      {/* 3D Extruded Chronometer Cylinder */}
      <circle cx="171" cy="28" r="19" fill="#09090D" />
      <circle cx="168" cy="25" r="18" fill="#181820" stroke="#10B981" strokeWidth="3.2" />
      <polyline points="168,15 168,25 176,29" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

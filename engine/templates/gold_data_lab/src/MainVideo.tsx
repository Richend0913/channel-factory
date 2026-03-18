import React from "react";
import {
  AbsoluteFill, Audio, Img, staticFile,
  useCurrentFrame, useVideoConfig, interpolate, Easing,
} from "remotion";
import timingData from "../public/audio/timing.json";

const C = {
  bg: "#07080f", primary: "#fbbf24", secondary: "#34d399",
  text: "#f0f4ff", surface: "#111827", muted: "#6b7a99",
  red: "#f87171", green: "#34d399", blue: "#60a5fa",
};

interface TimingItem {
  scene: string; speaker: string; character_name: string;
  text: string; audioOffsetSec: number; durationSec: number;
}
const timing: TimingItem[] = timingData as TimingItem[];

const SCENES: Record<string, { label: string; accent: string; chart?: string }> = {
  HookScene:          { label: "MARKET OPEN",    accent: C.primary, chart: "chart_main.png" },
  ConflictScene:      { label: "KEY LEVELS",     accent: C.red,     chart: "chart_fib.png" },
  InvestigationScene: { label: "INDICATORS",     accent: C.blue,    chart: "chart_h1.png" },
  TwistScene:         { label: "TRADE SIGNAL",   accent: C.green,   chart: "chart_m15.png" },
  ResolutionScene:    { label: "TRADE PLAN",     accent: C.green,   chart: "chart_rsi.png" },
  OutroScene:         { label: "SUBSCRIBE",      accent: C.primary },
};

function getActive(frame: number, fps: number) {
  const t = frame / fps;
  for (let i = timing.length - 1; i >= 0; i--) {
    const d = timing[i];
    if (t >= d.audioOffsetSec && t < d.audioOffsetSec + d.durationSec + 0.15)
      return { active: d, idx: i };
  }
  return { active: null as TimingItem | null, idx: -1 };
}

function getScene(frame: number, fps: number): string {
  const t = frame / fps;
  for (let i = timing.length - 1; i >= 0; i--) {
    if (t >= timing[i].audioOffsetSec) return timing[i].scene;
  }
  return "HookScene";
}

function sceneStartFrame(scene: string, fps: number): number {
  const first = timing.find((t) => t.scene === scene);
  return first ? Math.round(first.audioOffsetSec * fps) : 0;
}

/* ===== Ticker tape at top ===== */
const TickerTape: React.FC<{ frame: number }> = ({ frame }) => {
  const items = [
    "XAUUSD", "EURUSD", "GBPJPY", "SP500", "BTC/USD", "DXY", "US10Y", "VIX",
    "XAUUSD", "EURUSD", "GBPJPY", "SP500",
  ];
  const offset = (frame * 1.5) % (items.length * 180);
  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, height: 36,
      background: `${C.surface}ee`, borderBottom: `1px solid ${C.primary}22`,
      overflow: "hidden", display: "flex", alignItems: "center",
    }}>
      <div style={{
        display: "flex", gap: 40, whiteSpace: "nowrap",
        transform: `translateX(${-offset}px)`,
      }}>
        {items.map((item, i) => (
          <span key={i} style={{
            fontSize: 13, fontWeight: 700, letterSpacing: 2,
            color: i % 2 === 0 ? C.primary : C.muted,
            fontFamily: "monospace",
          }}>
            {item} {i % 3 === 0 ? "▲" : "▼"} {(1200 + i * 37).toFixed(1)}
          </span>
        ))}
      </div>
    </div>
  );
};

/* ===== Chart display with zoom/pan animation ===== */
const ChartDisplay: React.FC<{
  chart: string; frame: number; fps: number; scene: string;
}> = ({ chart, frame, fps, scene }) => {
  const lf = frame - sceneStartFrame(scene, fps);

  const fadeIn = interpolate(lf, [0, 20], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  return (
    <div style={{
      position: "absolute", top: 44, left: 0, right: 0, bottom: 120,
      opacity: fadeIn, overflow: "hidden",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "8px 16px",
    }}>
      <Img
        src={staticFile(`assets/${chart}`)}
        style={{
          maxWidth: "100%", maxHeight: "100%",
          objectFit: "contain",
        }}
      />
      {/* Vignette overlay */}
      <div style={{
        position: "absolute", inset: 0,
        background: `
          linear-gradient(to bottom, ${C.bg}44 0%, transparent 15%, transparent 80%, ${C.bg}cc 100%),
          linear-gradient(to right, ${C.bg}33 0%, transparent 10%, transparent 90%, ${C.bg}33 100%)
        `,
      }} />
    </div>
  );
};

/* ===== Subscribe animation ===== */
const OutroVisual: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const lf = frame - sceneStartFrame("OutroScene", fps);
  const bellSwing = Math.sin(lf * 0.12) * 12;
  const btnScale = interpolate(lf, [15, 30], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(2)),
  });

  return (
    <div style={{
      position: "absolute", top: 44, left: 0, right: 0, bottom: 120,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 24,
    }}>
      <div style={{
        fontSize: 120, transform: `rotate(${bellSwing}deg)`,
        filter: `drop-shadow(0 0 30px ${C.primary}44)`,
      }}>{"\uD83D\uDD14"}</div>
      <div style={{
        padding: "16px 50px", borderRadius: 40,
        background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
        transform: `scale(${btnScale * (1 + Math.sin(lf * 0.06) * 0.04)})`,
        boxShadow: `0 8px 40px ${C.primary}44`,
      }}>
        <div style={{
          fontSize: 26, fontWeight: 900, color: C.bg,
          letterSpacing: 4, fontFamily: "Inter",
        }}>SUBSCRIBE</div>
      </div>
      <div style={{
        fontSize: 16, color: C.muted, letterSpacing: 2, fontWeight: 600,
        opacity: interpolate(lf, [30, 45], [0, 1], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        }),
      }}>DAILY GOLD ANALYSIS</div>
    </div>
  );
};

/* ===== MAIN VIDEO ===== */
export const MainVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { active } = getActive(frame, fps);
  const scene = getScene(frame, fps);
  const cfg = SCENES[scene] || SCENES.HookScene;

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, fontFamily: "Inter, monospace" }}>
      <Audio src={staticFile("audio/narration.mp3")} />

      {/* Ticker tape */}
      <TickerTape frame={frame} />

      {/* Progress bar */}
      <div style={{
        position: "absolute", top: 36, left: 0, right: 0, height: 3,
        background: `${C.muted}12`,
      }}>
        <div style={{
          height: "100%", width: `${(frame / durationInFrames) * 100}%`,
          background: `linear-gradient(90deg, ${C.primary}, ${C.secondary})`,
        }} />
      </div>

      {/* Main chart / visual area */}
      {cfg.chart ? (
        <ChartDisplay chart={cfg.chart} frame={frame} fps={fps} scene={scene} />
      ) : (
        <OutroVisual frame={frame} fps={fps} />
      )}

      {/* Scene badge (top-left, over chart) */}
      <div style={{
        position: "absolute", top: 50, left: 20,
        padding: "6px 16px", borderRadius: 8,
        background: `${C.bg}cc`, border: `1px solid ${cfg.accent}44`,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: cfg.accent,
          boxShadow: `0 0 8px ${cfg.accent}`,
        }} />
        <span style={{
          fontSize: 12, fontWeight: 800, letterSpacing: 3,
          color: cfg.accent, fontFamily: "monospace",
        }}>{cfg.label}</span>
      </div>

      {/* Live price badge (top-right) */}
      <div style={{
        position: "absolute", top: 50, right: 20,
        padding: "6px 16px", borderRadius: 8,
        background: `${C.bg}cc`, border: `1px solid ${C.primary}33`,
      }}>
        <span style={{
          fontSize: 13, fontWeight: 800, color: C.primary,
          fontFamily: "monospace", letterSpacing: 1,
        }}>XAUUSD LIVE</span>
      </div>

      {/* ===== SUBTITLE BAR (bottom, over dark gradient) ===== */}
      {active && (
        <div style={{
          position: "absolute", bottom: 24, left: 24, right: 24,
          padding: "14px 20px", borderRadius: 12,
          background: `${C.bg}dd`,
          border: `1px solid ${C.muted}22`,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          {/* Speaker */}
          <div style={{
            padding: "4px 12px", borderRadius: 6,
            background: `${active.speaker === "MAIN" ? C.primary : C.secondary}18`,
            border: `1px solid ${active.speaker === "MAIN" ? C.primary : C.secondary}33`,
            flexShrink: 0,
          }}>
            <span style={{
              fontSize: 12, fontWeight: 800, letterSpacing: 2,
              color: active.speaker === "MAIN" ? C.primary : C.secondary,
              fontFamily: "monospace",
            }}>{active.character_name}</span>
          </div>
          {/* Text */}
          <div style={{
            fontSize: 20, fontWeight: 600, color: `${C.text}dd`,
            fontFamily: "Inter", lineHeight: 1.4,
          }}>
            {active.text}
          </div>
        </div>
      )}

      {/* Timestamp */}
      <div style={{
        position: "absolute", bottom: 4, right: 24,
        fontSize: 10, color: `${C.muted}66`, fontFamily: "monospace",
        letterSpacing: 1,
      }}>
        {Math.floor(frame / fps / 60)}:{String(Math.floor(frame / fps) % 60).padStart(2, "0")}
      </div>
    </AbsoluteFill>
  );
};

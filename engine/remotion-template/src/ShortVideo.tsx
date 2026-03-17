import React from "react";
import {
  AbsoluteFill,
  Audio,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";
import timingData from "../public/audio/timing.json";

/* ===== CHANNEL COLORS (replaced per-channel by factory.py) ===== */
const CHANNEL_COLORS = {
  background: "#07080f",
  primary: "#4fffff",
  secondary: "#a855f7",
  text: "#f0f4ff",
};

const C = {
  ...CHANNEL_COLORS,
  surface: "#0f1117",
  muted: "#6b7a99",
  red: "#f87171",
};

interface TimingItem {
  scene: string;
  speaker: string;
  character_name: string;
  text: string;
  audioOffsetSec: number;
  durationSec: number;
}
const timing: TimingItem[] = timingData as TimingItem[];

/* Only use first ~58 seconds of content for the short */
const SHORT_DURATION_SEC = 58;
const shortTiming = timing.filter((t) => t.audioOffsetSec < SHORT_DURATION_SEC);

function getActive(frame: number, fps: number): TimingItem | null {
  const t = frame / fps;
  for (let i = shortTiming.length - 1; i >= 0; i--) {
    const d = shortTiming[i];
    if (t >= d.audioOffsetSec && t < d.audioOffsetSec + d.durationSec + 0.15)
      return d;
  }
  return null;
}

/* ===== SHORT VIDEO (1080x1920, vertical) ===== */
export const ShortVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const active = getActive(frame, fps);

  const bgPulse = 0.08 + Math.sin(frame * 0.05) * 0.04;
  const progress = frame / durationInFrames;

  return (
    <AbsoluteFill style={{ backgroundColor: C.background, fontFamily: "Inter, sans-serif" }}>
      <Audio src={staticFile("audio/narration.mp3")} endAt={SHORT_DURATION_SEC * fps} />

      {/* Background gradient */}
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(ellipse at 50% 30%, ${C.primary}${Math.round(bgPulse * 255).toString(16).padStart(2, "0")}, transparent 70%)`,
      }} />

      {/* Side accent lines */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
        background: `linear-gradient(to bottom, transparent, ${C.primary}, transparent)`,
        opacity: 0.4,
      }} />
      <div style={{
        position: "absolute", right: 0, top: 0, bottom: 0, width: 4,
        background: `linear-gradient(to bottom, transparent, ${C.secondary}, transparent)`,
        opacity: 0.4,
      }} />

      {/* Progress bar (top) */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 4,
        background: `${C.muted}22`,
      }}>
        <div style={{
          height: "100%", width: `${progress * 100}%`,
          background: `linear-gradient(90deg, ${C.primary}, ${C.secondary})`,
        }} />
      </div>

      {/* Speaker badge (top center) */}
      {active && (
        <div style={{
          position: "absolute", top: 80, left: 0, right: 0,
          display: "flex", justifyContent: "center",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "12px 28px", borderRadius: 50,
            background: `${C.surface}dd`,
            border: `2px solid ${active.speaker === "MAIN" ? C.primary : C.secondary}44`,
            boxShadow: `0 0 30px ${active.speaker === "MAIN" ? C.primary : C.secondary}22`,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              background: `${active.speaker === "MAIN" ? C.primary : C.secondary}33`,
              border: `2px solid ${active.speaker === "MAIN" ? C.primary : C.secondary}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, fontWeight: 800, color: C.text,
            }}>
              {active.character_name[0]}
            </div>
            <div style={{
              fontSize: 20, fontWeight: 800, letterSpacing: 3,
              color: active.speaker === "MAIN" ? C.primary : C.secondary,
            }}>
              {active.character_name}
            </div>
          </div>
        </div>
      )}

      {/* Main text (center, large, word-wrapped for vertical) */}
      {active && (() => {
        const textFade = interpolate(frame, [0, 8], [0, 1], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        });
        return (
          <div style={{
            position: "absolute",
            top: "25%", bottom: "30%",
            left: 50, right: 50,
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: textFade,
          }}>
            <div style={{
              fontSize: 48,
              fontWeight: 800,
              color: C.text,
              lineHeight: 1.4,
              textAlign: "center",
              textShadow: `0 4px 40px ${C.background}`,
              wordBreak: "break-word",
            }}>
              {active.text}
            </div>
          </div>
        );
      })()}

      {/* Bottom CTA */}
      <div style={{
        position: "absolute", bottom: 120, left: 0, right: 0,
        textAlign: "center",
      }}>
        <div style={{
          fontSize: 18, color: C.muted, fontWeight: 600, letterSpacing: 2,
        }}>
          Follow for more
        </div>
      </div>

      {/* Decorative corner accents */}
      {[
        { top: 20, left: 20 },
        { top: 20, right: 20 },
        { bottom: 20, left: 20 },
        { bottom: 20, right: 20 },
      ].map((pos, i) => (
        <div key={i} style={{
          position: "absolute", ...pos,
          width: 24, height: 24,
          borderTop: i < 2 ? `2px solid ${C.primary}33` : "none",
          borderBottom: i >= 2 ? `2px solid ${C.primary}33` : "none",
          borderLeft: i % 2 === 0 ? `2px solid ${C.primary}33` : "none",
          borderRight: i % 2 === 1 ? `2px solid ${C.primary}33` : "none",
        }} />
      ))}
    </AbsoluteFill>
  );
};

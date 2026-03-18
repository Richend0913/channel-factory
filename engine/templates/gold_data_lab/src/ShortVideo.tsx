import React from "react";
import {
  AbsoluteFill, Audio, Img, staticFile,
  useCurrentFrame, useVideoConfig, interpolate, Easing,
} from "remotion";
import timingData from "../public/audio/timing.json";

const C = {
  bg: "#07080f", primary: "#fbbf24", secondary: "#34d399",
  text: "#f0f4ff", surface: "#111827", muted: "#6b7a99",
  red: "#f87171", green: "#34d399",
};

interface TimingItem {
  scene: string; speaker: string; character_name: string;
  text: string; audioOffsetSec: number; durationSec: number;
}
const timing: TimingItem[] = timingData as TimingItem[];
const SHORT_SEC = 58;
const shortTiming = timing.filter((t) => t.audioOffsetSec < SHORT_SEC);

// Map scenes to charts — cycle through available charts
const CHART_SEQUENCE = [
  "chart_main.png", "chart_fib.png", "chart_h1.png", "chart_m15.png", "chart_rsi.png",
];

function getActive(frame: number, fps: number) {
  const t = frame / fps;
  for (let i = shortTiming.length - 1; i >= 0; i--) {
    const d = shortTiming[i];
    if (t >= d.audioOffsetSec && t < d.audioOffsetSec + d.durationSec + 0.15)
      return { active: d, idx: i };
  }
  return { active: null as TimingItem | null, idx: -1 };
}

export const ShortVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { active, idx } = getActive(frame, fps);
  const progress = frame / durationInFrames;

  // Rotate through charts every ~12 seconds
  const chartIdx = Math.floor((frame / fps) / 12) % CHART_SEQUENCE.length;
  const chart = CHART_SEQUENCE[chartIdx];
  const speakerColor = active?.speaker === "MAIN" ? C.primary : C.secondary;

  // Chart transition
  const cycleFrame = (frame % (12 * fps));
  const chartFade = interpolate(cycleFrame, [0, 15, 12 * fps - 15, 12 * fps], [0, 1, 1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, fontFamily: "Inter, monospace" }}>
      <Audio src={staticFile("audio/narration.mp3")} endAt={SHORT_SEC * fps} />

      {/* Chart image (takes most of screen, no zoom) */}
      <div style={{
        position: "absolute", top: 60, left: 0, right: 0, bottom: 280,
        overflow: "hidden", opacity: chartFade,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "8px 12px",
      }}>
        <Img
          src={staticFile(`assets/${chart}`)}
          style={{
            maxWidth: "100%", maxHeight: "100%",
            objectFit: "contain",
          }}
        />
      </div>

      {/* LIVE badge */}
      <div style={{
        position: "absolute", top: 20, right: 20,
        padding: "4px 12px", borderRadius: 6,
        background: `${C.red}dd`,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />
        <span style={{
          fontSize: 12, fontWeight: 900, color: "#fff",
          letterSpacing: 2, fontFamily: "monospace",
        }}>LIVE</span>
      </div>

      {/* XAUUSD label */}
      <div style={{
        position: "absolute", top: 20, left: 20,
        padding: "4px 14px", borderRadius: 6,
        background: `${C.bg}cc`, border: `1px solid ${C.primary}33`,
      }}>
        <span style={{
          fontSize: 14, fontWeight: 800, color: C.primary,
          letterSpacing: 2, fontFamily: "monospace",
        }}>XAUUSD</span>
      </div>

      {/* Progress */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: `${C.muted}12`,
      }}>
        <div style={{
          height: "100%", width: `${progress * 100}%`,
          background: `linear-gradient(90deg, ${C.primary}, ${C.secondary})`,
        }} />
      </div>

      {/* Side accent */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
        background: `linear-gradient(to bottom, transparent, ${C.primary}55, transparent)`,
      }} />
      <div style={{
        position: "absolute", right: 0, top: 0, bottom: 0, width: 3,
        background: `linear-gradient(to bottom, transparent, ${C.secondary}55, transparent)`,
      }} />

      {/* Subtitle area */}
      {active && (
        <div style={{
          position: "absolute", bottom: 100, left: 20, right: 20,
          textAlign: "center",
        }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "5px 14px", borderRadius: 20, marginBottom: 10,
            background: `${speakerColor}15`, border: `1px solid ${speakerColor}22`,
          }}>
            <span style={{
              fontSize: 12, fontWeight: 800, letterSpacing: 2, color: speakerColor,
              fontFamily: "monospace",
            }}>{active.character_name}</span>
          </div>
          <div style={{
            fontSize: 19, fontWeight: 600, color: `${C.text}cc`,
            lineHeight: 1.5, fontFamily: "Inter",
            textShadow: `0 2px 8px ${C.bg}`,
          }}>
            {active.text.length > 110 ? active.text.substring(0, 107) + "..." : active.text}
          </div>
        </div>
      )}

      {/* Bottom CTA */}
      <div style={{
        position: "absolute", bottom: 40, left: 0, right: 0,
        textAlign: "center",
      }}>
        <span style={{
          fontSize: 13, fontWeight: 700, color: C.primary,
          letterSpacing: 2, fontFamily: "monospace",
        }}>DAILY GOLD ANALYSIS — FOLLOW</span>
      </div>
    </AbsoluteFill>
  );
};

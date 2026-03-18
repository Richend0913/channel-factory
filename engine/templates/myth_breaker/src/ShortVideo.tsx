import React from "react";
import {
  AbsoluteFill, Audio, staticFile,
  useCurrentFrame, useVideoConfig, interpolate, Easing,
} from "remotion";
import timingData from "../public/audio/timing.json";

const C = {
  bg: "#0a0a12", primary: "#f59e0b", secondary: "#10b981",
  text: "#f0f4ff", surface: "#14142a", muted: "#6b7a99",
  red: "#ef4444", green: "#22c55e",
};

interface TimingItem {
  scene: string; speaker: string; character_name: string;
  text: string; audioOffsetSec: number; durationSec: number;
}
const timing: TimingItem[] = timingData as TimingItem[];
const SHORT_SEC = 58;
const shortTiming = timing.filter((t) => t.audioOffsetSec < SHORT_SEC);

function getActive(frame: number, fps: number) {
  const t = frame / fps;
  for (let i = shortTiming.length - 1; i >= 0; i--) {
    const d = shortTiming[i];
    if (t >= d.audioOffsetSec && t < d.audioOffsetSec + d.durationSec + 0.15)
      return { active: d, idx: i };
  }
  return { active: null as TimingItem | null, idx: -1 };
}

function getScene(frame: number, fps: number): string {
  const t = frame / fps;
  for (let i = shortTiming.length - 1; i >= 0; i--) {
    if (t >= shortTiming[i].audioOffsetSec) return shortTiming[i].scene;
  }
  return "HookScene";
}

function sf(s: string, fps: number): number {
  const first = shortTiming.find((t) => t.scene === s);
  return first ? Math.round(first.audioOffsetSec * fps) : 0;
}

/* Scenes */
const ShortHook: React.FC<{ f: number; fps: number }> = ({ f, fps }) => {
  const lf = f - sf("HookScene", fps);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 20 }}>
      <div style={{
        fontSize: 120,
        transform: `scale(${interpolate(lf, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(2)) })})`,
      }}>{"\uD83E\uDDD0"}</div>
      <div style={{
        padding: "16px 24px", borderRadius: 14, background: `${C.surface}ee`, border: `2px solid ${C.primary}33`,
        maxWidth: 450, textAlign: "center",
        opacity: interpolate(lf, [15, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>
        <div style={{ fontSize: 12, color: C.primary, fontWeight: 800, letterSpacing: 3, marginBottom: 6 }}>POPULAR CLAIM</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.text, fontStyle: "italic", lineHeight: 1.4 }}>
          "Is this actually true?"
        </div>
      </div>
    </div>
  );
};

const ShortMyth: React.FC<{ f: number; fps: number }> = ({ f, fps }) => {
  const lf = f - sf("ConflictScene", fps);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 16 }}>
      {["\uD83E\uDDE0 Bias", "\uD83D\uDCE2 Repetition", "\u2728 Intuition"].map((item, i) => {
        const cf = lf - 8 - i * 14;
        return (
          <div key={i} style={{
            width: 380, padding: "18px 20px", borderRadius: 14,
            background: `${C.red}0a`, border: `2px solid ${C.red}22`,
            textAlign: "center", fontSize: 20, fontWeight: 800, color: C.red,
            opacity: interpolate(cf, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            transform: `scale(${interpolate(cf, [0, 12], [0.7, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(1.5)) })})`,
          }}>{item}</div>
        );
      })}
    </div>
  );
};

const ShortEvidence: React.FC<{ f: number; fps: number }> = ({ f, fps }) => {
  const lf = f - sf("InvestigationScene", fps);
  const studies = [
    { year: "2012", result: "NO EFFECT", color: C.red },
    { year: "2019", result: "NO EFFECT", color: C.red },
    { year: "2023", result: "DEBUNKED", color: C.red },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 14 }}>
      <div style={{ fontSize: 50, opacity: interpolate(lf, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>{"\uD83D\uDD2C"}</div>
      {studies.map((s, i) => {
        const cf = lf - 10 - i * 16;
        return (
          <div key={i} style={{
            width: 400, padding: "14px 20px", borderRadius: 12,
            background: `${C.surface}ee`, borderLeft: `4px solid ${s.color}`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
            opacity: interpolate(cf, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}>
            <span style={{ fontSize: 15, color: C.muted, fontWeight: 700 }}>Study {s.year}</span>
            <span style={{ fontSize: 13, fontWeight: 900, color: s.color, letterSpacing: 2 }}>{s.result}</span>
          </div>
        );
      })}
    </div>
  );
};

const ShortVerdict: React.FC<{ f: number; fps: number }> = ({ f, fps }) => {
  const lf = f - sf("ResolutionScene", fps);
  const scale = interpolate(lf, [0, 8], [3, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 16 }}>
      <div style={{
        padding: "16px 40px", borderRadius: 12, border: `4px solid ${C.red}`,
        transform: `scale(${scale}) rotate(-5deg)`,
        opacity: interpolate(lf, [0, 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>
        <div style={{ fontSize: 48, fontWeight: 900, color: C.red, letterSpacing: 8 }}>BUSTED</div>
      </div>
    </div>
  );
};

const ShortTwist: React.FC<{ f: number; fps: number }> = ({ f, fps }) => {
  const lf = f - sf("TwistScene", fps);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 16 }}>
      <div style={{
        fontSize: 100,
        transform: `scale(${interpolate(lf, [0, 15], [0.1, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(2.5)) })})`,
      }}>{"\uD83D\uDCA1"}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: C.green, letterSpacing: 4 }}>THE TRUTH</div>
      <div style={{
        padding: "14px 24px", borderRadius: 14, background: `${C.surface}ee`, border: `2px solid ${C.green}22`,
        maxWidth: 420, textAlign: "center",
        opacity: interpolate(lf, [20, 35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>
        <div style={{ fontSize: 40, marginBottom: 6 }}>{"\uD83E\uDDE0"}</div>
        <div style={{ fontSize: 16, color: C.green, fontWeight: 800 }}>PLACEBO EFFECT</div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Your brain did the work, not the hack</div>
      </div>
    </div>
  );
};

const ShortOutro: React.FC<{ f: number; fps: number }> = ({ f, fps }) => {
  const lf = f - sf("OutroScene", fps);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 16 }}>
      <div style={{ fontSize: 120, transform: `rotate(${Math.sin(lf * 0.12) * 12}deg)` }}>{"\uD83D\uDD14"}</div>
      <div style={{
        padding: "12px 40px", borderRadius: 40,
        background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
        transform: `scale(${interpolate(lf, [10, 25], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(2)) })})`,
      }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: C.bg, letterSpacing: 4 }}>SUBSCRIBE</div>
      </div>
    </div>
  );
};

/* ===== MAIN ===== */
export const ShortVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { active } = getActive(frame, fps);
  const scene = getScene(frame, fps);
  const speakerColor = active?.speaker === "MAIN" ? C.primary : C.secondary;

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, fontFamily: "Inter, sans-serif" }}>
      <Audio src={staticFile("audio/narration.mp3")} endAt={SHORT_SEC * fps} />

      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: `linear-gradient(to bottom, transparent, ${C.primary}55, transparent)` }} />
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 3, background: `linear-gradient(to bottom, transparent, ${C.secondary}55, transparent)` }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `${C.muted}12` }}>
        <div style={{ height: "100%", width: `${(frame / durationInFrames) * 100}%`, background: `linear-gradient(90deg, ${C.primary}, ${C.secondary})` }} />
      </div>

      <div style={{ position: "absolute", top: 60, bottom: 260, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {scene === "HookScene" && <ShortHook f={frame} fps={fps} />}
        {scene === "ConflictScene" && <ShortMyth f={frame} fps={fps} />}
        {scene === "InvestigationScene" && <ShortEvidence f={frame} fps={fps} />}
        {scene === "TwistScene" && <ShortTwist f={frame} fps={fps} />}
        {scene === "ResolutionScene" && <ShortVerdict f={frame} fps={fps} />}
        {scene === "OutroScene" && <ShortOutro f={frame} fps={fps} />}
      </div>

      {active && (
        <div style={{ position: "absolute", bottom: 100, left: 30, right: 30, textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 14px", borderRadius: 20, marginBottom: 8,
            background: `${speakerColor}12`, border: `1px solid ${speakerColor}22`,
          }}>
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2, color: speakerColor }}>{active.character_name}</span>
          </div>
          <div style={{ fontSize: 19, fontWeight: 600, color: `${C.text}cc`, lineHeight: 1.5, textShadow: `0 2px 8px ${C.bg}`, maxHeight: 95, overflow: "hidden" }}>
            {active.text.length > 110 ? active.text.substring(0, 107) + "..." : active.text}
          </div>
        </div>
      )}

      {[{ top: 12, left: 12 }, { top: 12, right: 12 }, { bottom: 12, left: 12 }, { bottom: 12, right: 12 }].map((pos, i) => (
        <div key={i} style={{
          position: "absolute", ...pos, width: 16, height: 16,
          borderTop: i < 2 ? `2px solid ${C.primary}20` : "none",
          borderBottom: i >= 2 ? `2px solid ${C.primary}20` : "none",
          borderLeft: i % 2 === 0 ? `2px solid ${C.primary}20` : "none",
          borderRight: i % 2 === 1 ? `2px solid ${C.primary}20` : "none",
        }} />
      ))}
    </AbsoluteFill>
  );
};

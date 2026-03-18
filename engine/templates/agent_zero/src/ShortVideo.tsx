import React from "react";
import {
  AbsoluteFill, Audio, staticFile,
  useCurrentFrame, useVideoConfig, interpolate, Easing,
} from "remotion";
import timingData from "../public/audio/timing.json";

const C = {
  bg: "#07080f", primary: "#4fffff", secondary: "#a855f7",
  text: "#f0f4ff", surface: "#111827", muted: "#6b7a99",
  red: "#f87171", green: "#34d399", yellow: "#fbbf24", purple: "#c084fc",
};

interface TimingItem {
  scene: string; speaker: string; character_name: string;
  text: string; audioOffsetSec: number; durationSec: number;
}
const timing: TimingItem[] = timingData as TimingItem[];
const SHORT_SEC = 58;
const shortTiming = timing.filter((t) => t.audioOffsetSec < SHORT_SEC);

const SCENE_CFG: Record<string, { accent: string; icon: string; label: string }> = {
  HookScene:          { accent: C.primary, icon: "\uD83E\uDD16", label: "SCAN" },
  ConflictScene:      { accent: C.red,     icon: "\u26A0\uFE0F", label: "ALERT" },
  InvestigationScene: { accent: "#60a5fa", icon: "\uD83D\uDD0D", label: "DATA" },
  TwistScene:         { accent: C.purple,  icon: "\uD83D\uDCA1", label: "TWIST" },
  ResolutionScene:    { accent: C.green,   icon: "\u2705", label: "RULES" },
  OutroScene:         { accent: C.primary, icon: "\uD83D\uDD14", label: "SUB" },
};

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

function sceneStartFrame(s: string, fps: number): number {
  const first = shortTiming.find((t) => t.scene === s);
  return first ? Math.round(first.audioOffsetSec * fps) : 0;
}

/* ===== Scene Visuals ===== */
const ShortHook: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const lf = frame - sceneStartFrame("HookScene", fps);
  const scale = interpolate(lf, [0, 18], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(2)),
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 16 }}>
      {[0, 20, 40].map((d, i) => {
        const r = interpolate((lf - d) % 70, [0, 70], [0.5, 2.5], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return <div key={i} style={{
          position: "absolute", width: 120 * r, height: 120 * r, borderRadius: "50%",
          border: `2px solid ${C.primary}`,
          opacity: interpolate((lf - d) % 70, [0, 70], [0.3, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }} />;
      })}
      <div style={{ fontSize: 120, transform: `scale(${scale})`, filter: `drop-shadow(0 0 40px ${C.primary}66)` }}>{"\uD83E\uDD16"}</div>
      <div style={{
        padding: "14px 20px", borderRadius: 10, background: `${C.surface}ee`, border: `1px solid ${C.primary}22`,
        fontFamily: "monospace", fontSize: 15, color: C.primary, lineHeight: 1.6, textAlign: "left",
        opacity: interpolate(lf, [20, 35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>
        <div style={{ color: C.muted }}>$ agent_zero --scan</div>
        <div>Anomalies found: 3</div>
        <div>Confidence: HIGH</div>
      </div>
    </div>
  );
};

const ShortConflict: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const lf = frame - sceneStartFrame("ConflictScene", fps);
  const bars = [
    { label: "CLAIM", value: 85, color: C.red },
    { label: "REALITY", value: 15, color: C.green },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 20, padding: "0 40px" }}>
      <div style={{ fontSize: 50, opacity: interpolate(lf, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>{"\u26A0\uFE0F"}</div>
      {bars.map((b, i) => {
        const w = interpolate(lf - 10 - i * 12, [0, 25], [0, b.value], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
        return (
          <div key={i} style={{ width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 16, color: C.muted, fontFamily: "monospace", fontWeight: 800 }}>{b.label}</span>
              <span style={{ fontSize: 16, color: b.color, fontFamily: "monospace", fontWeight: 900 }}>{Math.round(w)}%</span>
            </div>
            <div style={{ height: 32, borderRadius: 8, background: `${b.color}11` }}>
              <div style={{ height: "100%", width: `${w}%`, borderRadius: 8, background: `linear-gradient(90deg, ${b.color}88, ${b.color})` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ShortTwist: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const lf = frame - sceneStartFrame("TwistScene", fps);
  const scale = interpolate(lf, [0, 18], [0.1, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(2.5)) });
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 20 }}>
      <div style={{ position: "absolute", width: 300, height: 300, borderRadius: "50%", background: `radial-gradient(circle, ${C.purple}18, transparent 70%)`, filter: "blur(30px)" }} />
      <div style={{ fontSize: 120, transform: `scale(${scale})`, filter: `drop-shadow(0 0 40px ${C.purple}66)` }}>{"\uD83D\uDCA1"}</div>
      <div style={{ fontSize: 32, fontWeight: 900, color: C.purple, letterSpacing: 6, fontFamily: "monospace",
        opacity: interpolate(lf, [15, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>ANOMALY</div>
    </div>
  );
};

const ShortRules: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const lf = frame - sceneStartFrame("ResolutionScene", fps);
  const rules = ["Repetitive tasks only", "Budget for verification", "No automating judgment"];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 16, padding: "0 30px" }}>
      <div style={{ fontSize: 24, fontWeight: 900, color: C.green, letterSpacing: 4, fontFamily: "monospace",
        opacity: interpolate(lf, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>{"\u2705"} PROTOCOL</div>
      {rules.map((r, i) => {
        const f = lf - 12 - i * 18;
        return (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 14, width: "100%",
            padding: "14px 20px", borderRadius: 14,
            background: `${C.green}08`, border: `1.5px solid ${C.green}22`,
            opacity: interpolate(f, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            transform: `translateX(${interpolate(f, [0, 14], [i % 2 === 0 ? -300 : 300, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) })}px)`,
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: C.green, color: C.bg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 900, fontFamily: "monospace", flexShrink: 0,
            }}>{i + 1}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.text }}>{r}</div>
          </div>
        );
      })}
    </div>
  );
};

const ShortOutro: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const lf = frame - sceneStartFrame("OutroScene", fps);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 16 }}>
      <div style={{ fontSize: 120, transform: `rotate(${Math.sin(lf * 0.12) * 12}deg)`, filter: `drop-shadow(0 0 30px ${C.primary}44)` }}>{"\uD83D\uDD14"}</div>
      <div style={{
        padding: "14px 40px", borderRadius: 40,
        background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
        transform: `scale(${interpolate(lf, [10, 25], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(2)) })})`,
      }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: C.bg, letterSpacing: 4 }}>SUBSCRIBE</div>
      </div>
    </div>
  );
};

/* ===== MAIN SHORT ===== */
export const ShortVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { active } = getActive(frame, fps);
  const scene = getScene(frame, fps);
  const cfg = SCENE_CFG[scene] || SCENE_CFG.HookScene;
  const speakerColor = active?.speaker === "MAIN" ? C.primary : C.secondary;

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, fontFamily: "Inter, monospace" }}>
      <Audio src={staticFile("audio/narration.mp3")} endAt={SHORT_SEC * fps} />

      {/* Scanline overlay */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.02,
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, ${C.primary}10 2px, ${C.primary}10 4px)`,
      }} />

      {/* Side lines */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: `linear-gradient(to bottom, transparent, ${C.primary}55, transparent)` }} />
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 3, background: `linear-gradient(to bottom, transparent, ${C.secondary}55, transparent)` }} />

      {/* Progress */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `${C.muted}12` }}>
        <div style={{ height: "100%", width: `${(frame / durationInFrames) * 100}%`, background: `linear-gradient(90deg, ${C.primary}, ${C.secondary})` }} />
      </div>

      {/* Visual area */}
      <div style={{ position: "absolute", top: 60, bottom: 260, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {scene === "HookScene" && <ShortHook frame={frame} fps={fps} />}
        {scene === "ConflictScene" && <ShortConflict frame={frame} fps={fps} />}
        {(scene === "InvestigationScene") && <ShortConflict frame={frame} fps={fps} />}
        {scene === "TwistScene" && <ShortTwist frame={frame} fps={fps} />}
        {scene === "ResolutionScene" && <ShortRules frame={frame} fps={fps} />}
        {scene === "OutroScene" && <ShortOutro frame={frame} fps={fps} />}
      </div>

      {/* Subtitle */}
      {active && (
        <div style={{ position: "absolute", bottom: 100, left: 30, right: 30, textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 14px", borderRadius: 20, marginBottom: 8,
            background: `${speakerColor}12`, border: `1px solid ${speakerColor}22`,
          }}>
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2, color: speakerColor, fontFamily: "monospace" }}>{active.character_name}</span>
          </div>
          <div style={{ fontSize: 19, fontWeight: 600, color: `${C.text}cc`, lineHeight: 1.5, textShadow: `0 2px 8px ${C.bg}`, maxHeight: 95, overflow: "hidden" }}>
            {active.text.length > 110 ? active.text.substring(0, 107) + "..." : active.text}
          </div>
        </div>
      )}

      {/* Corners */}
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

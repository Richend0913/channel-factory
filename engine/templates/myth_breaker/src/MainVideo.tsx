import React from "react";
import {
  AbsoluteFill, Audio, staticFile,
  useCurrentFrame, useVideoConfig, interpolate, Easing,
} from "remotion";
import timingData from "../public/audio/timing.json";

const C = {
  bg: "#0a0a12", primary: "#f59e0b", secondary: "#10b981",
  text: "#f0f4ff", surface: "#14142a", muted: "#6b7a99",
  red: "#ef4444", green: "#22c55e", blue: "#3b82f6",
  purple: "#8b5cf6", yellow: "#f59e0b",
};

interface TimingItem {
  scene: string; speaker: string; character_name: string;
  text: string; audioOffsetSec: number; durationSec: number;
}
const timing: TimingItem[] = timingData as TimingItem[];

const SCENES: Record<string, { label: string; accent: string; icon: string }> = {
  HookScene:          { label: "THE CLAIM",     accent: C.yellow,  icon: "\uD83E\uDDD0" },
  ConflictScene:      { label: "THE MYTH",      accent: C.red,     icon: "\u274C" },
  InvestigationScene: { label: "THE EVIDENCE",  accent: C.blue,    icon: "\uD83D\uDD2C" },
  TwistScene:         { label: "THE TRUTH",     accent: C.green,   icon: "\uD83D\uDCA1" },
  ResolutionScene:    { label: "THE VERDICT",   accent: C.green,   icon: "\u2705" },
  OutroScene:         { label: "SUBSCRIBE",     accent: C.yellow,  icon: "\uD83D\uDD14" },
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

function sf(scene: string, fps: number): number {
  const first = timing.find((t) => t.scene === scene);
  return first ? Math.round(first.audioOffsetSec * fps) : 0;
}

function sceneLines(scene: string): TimingItem[] {
  return timing.filter((t) => t.scene === scene);
}

/* ===== Floating molecule particles ===== */
const Molecules: React.FC<{ frame: number; accent: string }> = ({ frame, accent }) => {
  const pts = React.useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      x: (i * 137 + 29) % 100, y: (i * 97 + 41) % 100,
      s: 20 + (i % 4) * 10, sp: 0.2 + (i % 5) * 0.08, ph: i * 1.1,
    })), []);
  return <>
    {pts.map((p, i) => (
      <div key={i} style={{
        position: "absolute",
        left: `${p.x + Math.sin(frame * 0.01 + p.ph) * 3}%`,
        top: `${(p.y + frame * p.sp * 0.03) % 108 - 4}%`,
        width: p.s, height: p.s, borderRadius: "50%",
        border: `1.5px solid ${accent}`,
        opacity: 0.06 + Math.sin(frame * 0.03 + p.ph) * 0.03,
      }} />
    ))}
  </>;
};

/* ===== Paper citation card ===== */
const PaperCard: React.FC<{
  frame: number; title: string; year: string; result: string;
  resultColor: string; delay?: number;
}> = ({ frame, title, year, result, resultColor, delay = 0 }) => {
  const f = frame - delay;
  const slideY = interpolate(f, [0, 16], [40, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
  });
  const opacity = interpolate(f, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{
      padding: "16px 20px", borderRadius: 14, width: 600,
      background: `${C.surface}ee`, border: `1px solid ${resultColor}22`,
      borderLeft: `4px solid ${resultColor}`,
      transform: `translateY(${slideY}px)`, opacity,
      display: "flex", justifyContent: "space-between", alignItems: "center",
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, lineHeight: 1.4 }}>{title}</div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 4, fontFamily: "monospace" }}>{year}</div>
      </div>
      <div style={{
        padding: "6px 14px", borderRadius: 8,
        background: `${resultColor}18`, border: `1px solid ${resultColor}44`,
        fontSize: 12, fontWeight: 900, color: resultColor, letterSpacing: 2,
      }}>{result}</div>
    </div>
  );
};

/* ===== Big verdict stamp ===== */
const VerdictStamp: React.FC<{
  frame: number; verdict: string; color: string; delay?: number;
}> = ({ frame, verdict, color, delay = 0 }) => {
  const f = frame - delay;
  const scale = interpolate(f, [0, 8], [3, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
  });
  const opacity = interpolate(f, [0, 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rotate = interpolate(f, [0, 8], [-15, -5], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
  });

  return (
    <div style={{
      padding: "20px 50px", borderRadius: 12,
      border: `5px solid ${color}`,
      transform: `scale(${scale}) rotate(${rotate}deg)`, opacity,
    }}>
      <div style={{
        fontSize: 56, fontWeight: 900, color,
        fontFamily: "Inter", letterSpacing: 8,
        textShadow: `0 0 30px ${color}44`,
      }}>{verdict}</div>
    </div>
  );
};

/* ===== Scene Visuals ===== */
const HookViz: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const lf = frame - sf("HookScene", fps);
  const lines = sceneLines("HookScene");
  const hookText = lines.find((l) => l.speaker === "SUB")?.text || "";
  const claim = hookText.split("—")[1]?.trim().split(".")[0] || hookText.split("?")[0] || "A common belief...";

  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24,
    }}>
      <div style={{
        fontSize: 80,
        transform: `scale(${interpolate(lf, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(2)) })})`,
      }}>{"\uD83E\uDDD0"}</div>

      <div style={{
        padding: "24px 32px", borderRadius: 16,
        background: `${C.surface}ee`, border: `2px solid ${C.yellow}33`,
        maxWidth: 700, textAlign: "center",
        opacity: interpolate(lf, [15, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>
        <div style={{ fontSize: 11, color: C.yellow, fontWeight: 800, letterSpacing: 4, marginBottom: 8 }}>POPULAR CLAIM</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: C.text, lineHeight: 1.4, fontStyle: "italic" }}>
          "{claim.length > 80 ? claim.substring(0, 77) + "..." : claim}"
        </div>
      </div>

      <div style={{
        fontSize: 18, fontWeight: 800, color: C.muted, letterSpacing: 4,
        opacity: interpolate(lf, [35, 48], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>BUT IS IT TRUE?</div>
    </div>
  );
};

const ConflictViz: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const lf = frame - sf("ConflictScene", fps);
  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20,
    }}>
      <div style={{
        fontSize: 18, fontWeight: 800, color: C.red, letterSpacing: 4,
        opacity: interpolate(lf, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>{"\u274C"} WHY PEOPLE BELIEVE THIS</div>

      <div style={{ display: "flex", gap: 20, marginTop: 10 }}>
        {["Confirmation\nBias", "Telephone\nGame", "Intuitive\nAppeal"].map((label, i) => {
          const f = lf - 15 - i * 15;
          const scale = interpolate(f, [0, 14], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(1.5)),
          });
          return (
            <div key={i} style={{
              width: 180, padding: "24px 16px", borderRadius: 16,
              background: `${C.red}0a`, border: `2px solid ${C.red}22`,
              textAlign: "center", transform: `scale(${scale})`,
            }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>{["\uD83E\uDDE0", "\uD83D\uDCE2", "\u2728"][i]}</div>
              <div style={{
                fontSize: 14, fontWeight: 800, color: C.red,
                letterSpacing: 1, whiteSpace: "pre-line",
              }}>{label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const InvestigationViz: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const lf = frame - sf("InvestigationScene", fps);
  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
    }}>
      <div style={{
        fontSize: 18, fontWeight: 800, color: C.blue, letterSpacing: 4, marginBottom: 8,
        opacity: interpolate(lf, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>{"\uD83D\uDD2C"} REPLICATION STUDIES</div>

      <PaperCard frame={lf} delay={10}
        title="Original Study (1998) — Small sample, no controls"
        year="n=24, single lab" result="SUPPORTED" resultColor={C.yellow} />
      <PaperCard frame={lf} delay={25}
        title="Replication #1 (2012) — Larger sample, proper controls"
        year="n=300, multi-site" result="NO EFFECT" resultColor={C.red} />
      <PaperCard frame={lf} delay={40}
        title="Replication #2 (2019) — Pre-registered, blinded"
        year="n=1,200, 6 countries" result="NO EFFECT" resultColor={C.red} />
      <PaperCard frame={lf} delay={55}
        title="Meta-Analysis (2023) — All available data combined"
        year="k=47 studies" result="DEBUNKED" resultColor={C.red} />
    </div>
  );
};

const TwistViz: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const lf = frame - sf("TwistScene", fps);
  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20,
    }}>
      <div style={{
        position: "absolute", width: 350, height: 350, borderRadius: "50%",
        background: `radial-gradient(circle, ${C.green}15, transparent 70%)`, filter: "blur(40px)",
      }} />

      <div style={{
        fontSize: 80,
        transform: `scale(${interpolate(lf, [0, 15], [0.1, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(2)) })})`,
      }}>{"\uD83D\uDCA1"}</div>

      <div style={{
        fontSize: 20, fontWeight: 800, color: C.green, letterSpacing: 3,
        opacity: interpolate(lf, [12, 25], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>THE REAL EXPLANATION</div>

      <div style={{
        padding: "20px 28px", borderRadius: 16,
        background: `${C.surface}ee`, border: `2px solid ${C.green}22`,
        maxWidth: 600, textAlign: "center",
        opacity: interpolate(lf, [25, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>
        <div style={{ fontSize: 50, marginBottom: 8 }}>{"\uD83E\uDDE0"}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.green, marginBottom: 6 }}>PLACEBO EFFECT</div>
        <div style={{ fontSize: 15, color: C.muted, lineHeight: 1.5 }}>
          The belief itself creates the result. Your brain is more powerful than any hack.
        </div>
      </div>
    </div>
  );
};

const ResolutionViz: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const lf = frame - sf("ResolutionScene", fps);
  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20,
    }}>
      <VerdictStamp frame={lf} verdict="BUSTED" color={C.red} delay={5} />

      <div style={{ display: "flex", gap: 16, marginTop: 20 }}>
        {["Too simple?\nProbably wrong", "Check sample\nsize & date", "Find the\nreplications"].map((rule, i) => {
          const f = lf - 30 - i * 15;
          return (
            <div key={i} style={{
              width: 200, padding: "20px 16px", borderRadius: 14,
              background: `${C.green}08`, border: `1.5px solid ${C.green}22`,
              textAlign: "center",
              opacity: interpolate(f, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              transform: `translateY(${interpolate(f, [0, 14], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) })}px)`,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, background: C.green, color: C.bg,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, fontWeight: 900, margin: "0 auto 10px",
              }}>{i + 1}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, whiteSpace: "pre-line", lineHeight: 1.4 }}>{rule}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const OutroViz: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const lf = frame - sf("OutroScene", fps);
  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20,
    }}>
      <div style={{ fontSize: 100, transform: `rotate(${Math.sin(lf * 0.12) * 12}deg)`, filter: `drop-shadow(0 0 30px ${C.yellow}44)` }}>{"\uD83D\uDD14"}</div>
      <div style={{
        padding: "14px 50px", borderRadius: 40,
        background: `linear-gradient(135deg, ${C.yellow}, ${C.secondary})`,
        transform: `scale(${interpolate(lf, [15, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(2)) })})`,
      }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: C.bg, letterSpacing: 4 }}>SUBSCRIBE</div>
      </div>
      <div style={{
        fontSize: 14, color: C.muted, letterSpacing: 2, fontWeight: 600,
        opacity: interpolate(lf, [35, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>SCIENCE OVER FOLKLORE — EVERY WEEK</div>
    </div>
  );
};

/* ===== MAIN ===== */
export const MainVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { active } = getActive(frame, fps);
  const scene = getScene(frame, fps);
  const cfg = SCENES[scene] || SCENES.HookScene;

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, fontFamily: "Inter, sans-serif" }}>
      <Audio src={staticFile("audio/narration.mp3")} />

      <Molecules frame={frame} accent={cfg.accent} />

      {/* Subtle hex grid */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.02,
        backgroundImage: `radial-gradient(circle, ${C.blue}30 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
      }} />

      {/* Progress */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `${C.muted}12` }}>
        <div style={{ height: "100%", width: `${(frame / durationInFrames) * 100}%`, background: `linear-gradient(90deg, ${C.yellow}, ${C.secondary})` }} />
      </div>

      {/* Scene label */}
      <div style={{ position: "absolute", top: 20, left: 24, display: "flex", alignItems: "center", gap: 8, opacity: 0.7 }}>
        <span style={{ fontSize: 20 }}>{cfg.icon}</span>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 3, color: cfg.accent }}>{cfg.label}</span>
      </div>

      {/* Scene visual */}
      {scene === "HookScene" && <HookViz frame={frame} fps={fps} />}
      {scene === "ConflictScene" && <ConflictViz frame={frame} fps={fps} />}
      {scene === "InvestigationScene" && <InvestigationViz frame={frame} fps={fps} />}
      {scene === "TwistScene" && <TwistViz frame={frame} fps={fps} />}
      {scene === "ResolutionScene" && <ResolutionViz frame={frame} fps={fps} />}
      {scene === "OutroScene" && <OutroViz frame={frame} fps={fps} />}

      {/* Subtitle */}
      {active && (
        <div style={{ position: "absolute", bottom: 60, left: 60, right: 60, textAlign: "center" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "4px 14px", borderRadius: 20, marginBottom: 8,
            background: `${active.speaker === "MAIN" ? C.yellow : C.secondary}12`,
            border: `1px solid ${active.speaker === "MAIN" ? C.yellow : C.secondary}22`,
          }}>
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2,
              color: active.speaker === "MAIN" ? C.yellow : C.secondary,
            }}>{active.character_name}</span>
          </div>
          <div style={{ fontSize: 21, fontWeight: 600, color: `${C.text}dd`, lineHeight: 1.5, textShadow: `0 2px 12px ${C.bg}` }}>
            {active.text}
          </div>
        </div>
      )}

      <div style={{ position: "absolute", bottom: 16, right: 24, fontSize: 11, color: `${C.muted}66` }}>
        {Math.floor(frame / fps / 60)}:{String(Math.floor(frame / fps) % 60).padStart(2, "0")}
      </div>
    </AbsoluteFill>
  );
};

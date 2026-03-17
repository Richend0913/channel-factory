import React from "react";
import {
  AbsoluteFill,
  Audio,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
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
  green: "#34d399",
  blue: "#60a5fa",
  purple: "#c084fc",
  yellow: "#fbbf24",
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

/* ===== Scene config ===== */
const SCENES: Record<string, { label: string; accent: string; icon: string }> = {
  HookScene: { label: "HOOK", accent: C.primary, icon: "⚡" },
  ConflictScene: { label: "CONFLICT", accent: C.red, icon: "🔥" },
  InvestigationScene: { label: "INVESTIGATION", accent: C.blue, icon: "🔍" },
  TwistScene: { label: "TWIST", accent: C.purple, icon: "💡" },
  ResolutionScene: { label: "RESOLUTION", accent: C.green, icon: "✅" },
  OutroScene: { label: "SUBSCRIBE", accent: C.primary, icon: "🔔" },
};

/* ===== Helpers ===== */
function getActive(frame: number, fps: number) {
  const t = frame / fps;
  let active: TimingItem | null = null;
  let activeIdx = -1;
  for (let i = timing.length - 1; i >= 0; i--) {
    const d = timing[i];
    if (t >= d.audioOffsetSec && t < d.audioOffsetSec + d.durationSec + 0.15) {
      active = d;
      activeIdx = i;
      break;
    }
  }
  return { active, activeIdx };
}

function getScene(frame: number, fps: number): string {
  const t = frame / fps;
  for (let i = timing.length - 1; i >= 0; i--) {
    if (t >= timing[i].audioOffsetSec) return timing[i].scene;
  }
  return "HookScene";
}

function sceneLocalFrame(frame: number, scene: string, fps: number): number {
  const first = timing.find((t) => t.scene === scene);
  if (!first) return 0;
  return frame - Math.round(first.audioOffsetSec * fps);
}

function sceneLineIndex(activeIdx: number, scene: string): number {
  const sceneItems = timing.filter((t) => t.scene === scene);
  const firstIdx = timing.indexOf(sceneItems[0]);
  return activeIdx - firstIdx;
}

/* ===== Animated data bar (fake data viz for visual interest) ===== */
const DataBars: React.FC<{ frame: number; fps: number; accent: string; count: number }> = ({
  frame, fps, accent, count,
}) => {
  const bars = React.useMemo(() => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push({ height: 30 + ((i * 73 + 17) % 70), delay: i * 3 });
    }
    return arr;
  }, [count]);

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 120 }}>
      {bars.map((b, i) => {
        const progress = interpolate(frame - b.delay, [0, 20], [0, 1], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        });
        return (
          <div
            key={i}
            style={{
              width: 18,
              height: b.height * progress,
              background: `linear-gradient(to top, ${accent}cc, ${accent}33)`,
              borderRadius: "4px 4px 0 0",
            }}
          />
        );
      })}
    </div>
  );
};

/* ===== Animated circle stat ===== */
const CircleStat: React.FC<{
  frame: number; value: number; label: string; accent: string; delay?: number;
}> = ({ frame, value, label, accent, delay = 0 }) => {
  const progress = interpolate(frame - delay, [0, 30], [0, value / 100], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const circumference = 2 * Math.PI * 45;
  const offset = circumference * (1 - progress);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r="45" fill="none" stroke={`${accent}22`} strokeWidth="8" />
        <circle
          cx="55" cy="55" r="45" fill="none" stroke={accent} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 55 55)"
        />
        <text x="55" y="55" textAnchor="middle" dominantBaseline="central"
          fill={C.text} fontSize="28" fontWeight="800" fontFamily="Inter">
          {Math.round(progress * 100)}%
        </text>
      </svg>
      <div style={{ fontSize: 13, color: C.muted, marginTop: 4, fontWeight: 600, fontFamily: "Inter" }}>
        {label}
      </div>
    </div>
  );
};

/* ===== Keyword pills (animated) ===== */
const KeywordPills: React.FC<{ frame: number; words: string[]; accent: string }> = ({
  frame, words, accent,
}) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 700 }}>
    {words.map((w, i) => {
      const opacity = interpolate(frame - i * 5, [0, 10], [0, 1], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp",
      });
      return (
        <div
          key={i}
          style={{
            padding: "6px 16px",
            borderRadius: 20,
            background: `${accent}18`,
            border: `1px solid ${accent}44`,
            color: accent,
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "Inter",
            opacity,
            letterSpacing: 1,
          }}
        >
          {w}
        </div>
      );
    })}
  </div>
);

/* ===== Scene-specific visual panel ===== */
const SceneVisual: React.FC<{
  scene: string; frame: number; fps: number; localFrame: number; lineIdx: number;
}> = ({ scene, frame, fps, localFrame, lineIdx }) => {
  const cfg = SCENES[scene] || SCENES.HookScene;

  const fadeIn = interpolate(localFrame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  const slideUp = interpolate(localFrame, [0, 20], [40, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <div style={{
      position: "absolute", top: 100, right: 80, width: 500,
      opacity: fadeIn, transform: `translateY(${slideUp}px)`,
    }}>
      {scene === "HookScene" && (
        <div style={{ display: "flex", gap: 20, justifyContent: "center" }}>
          <CircleStat frame={localFrame} value={85} label="Believe This" accent={cfg.accent} delay={0} />
          <CircleStat frame={localFrame} value={23} label="Actually True" accent={C.red} delay={10} />
          <CircleStat frame={localFrame} value={62} label="Gap" accent={C.yellow} delay={20} />
        </div>
      )}

      {scene === "ConflictScene" && (
        <DataBars frame={localFrame} fps={fps} accent={cfg.accent} count={12} />
      )}

      {scene === "InvestigationScene" && (
        <KeywordPills
          frame={localFrame}
          words={["DATA", "RESEARCH", "EVIDENCE", "STUDIES", "PATTERN", "TREND"]}
          accent={cfg.accent}
        />
      )}

      {scene === "TwistScene" && (
        <div style={{
          padding: "30px 24px", borderRadius: 16,
          background: `linear-gradient(135deg, ${cfg.accent}11, ${cfg.accent}08)`,
          border: `2px solid ${cfg.accent}33`,
          textAlign: "center",
        }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>{cfg.icon}</div>
          <div style={{
            fontSize: 22, fontWeight: 800, color: cfg.accent,
            fontFamily: "Inter", letterSpacing: 2,
          }}>
            PLOT TWIST
          </div>
          <div style={{
            fontSize: 14, color: C.muted, marginTop: 6, fontFamily: "Inter",
          }}>
            The data says the opposite
          </div>
        </div>
      )}

      {scene === "ResolutionScene" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {["Rule 1", "Rule 2", "Rule 3"].map((rule, i) => {
            const show = interpolate(localFrame - i * 15, [0, 12], [0, 1], {
              extrapolateLeft: "clamp", extrapolateRight: "clamp",
            });
            return (
              <div key={i} style={{
                padding: "12px 20px", borderRadius: 10,
                background: `${cfg.accent}12`, border: `1px solid ${cfg.accent}33`,
                display: "flex", alignItems: "center", gap: 12, opacity: show,
                transform: `translateX(${(1 - show) * 30}px)`,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: cfg.accent, color: C.background,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, fontWeight: 800, fontFamily: "Inter",
                }}>
                  {i + 1}
                </div>
                <div style={{ fontSize: 16, color: C.text, fontWeight: 600, fontFamily: "Inter" }}>
                  {rule}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {scene === "OutroScene" && (
        <div style={{ textAlign: "center" }}>
          <div style={{
            fontSize: 64,
            animation: `pulse 1s infinite`,
            opacity: 0.5 + Math.sin(frame * 0.1) * 0.5,
          }}>
            🔔
          </div>
          <div style={{
            fontSize: 28, fontWeight: 800, color: cfg.accent,
            fontFamily: "Inter", marginTop: 8,
          }}>
            SUBSCRIBE
          </div>
          <div style={{
            fontSize: 14, color: C.muted, fontFamily: "Inter", marginTop: 4,
          }}>
            New video every week
          </div>
        </div>
      )}
    </div>
  );
};

/* ===== Progress bar ===== */
const ProgressBar: React.FC<{ frame: number; fps: number; total: number }> = ({
  frame, fps, total,
}) => {
  const progress = frame / total;
  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, height: 4,
      background: `${C.muted}22`,
    }}>
      <div style={{
        height: "100%", width: `${progress * 100}%`,
        background: `linear-gradient(90deg, ${C.primary}, ${C.secondary})`,
      }} />
    </div>
  );
};

/* ===== MAIN VIDEO ===== */
export const MainVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { active, activeIdx } = getActive(frame, fps);
  const scene = getScene(frame, fps);
  const localFrame = sceneLocalFrame(frame, scene, fps);
  const lineIdx = active ? sceneLineIndex(activeIdx, scene) : 0;
  const cfg = SCENES[scene] || SCENES.HookScene;

  /* Background gradient */
  const bgAngle = 135 + Math.sin(frame * 0.004) * 15;

  /* Scene transition */
  const fadeIn = interpolate(localFrame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: C.background, fontFamily: "Inter, sans-serif" }}>
      <Audio src={staticFile("audio/narration.mp3")} />

      {/* Progress bar */}
      <ProgressBar frame={frame} fps={fps} total={durationInFrames} />

      {/* Background gradient */}
      <div style={{
        position: "absolute", inset: 0,
        background: `linear-gradient(${bgAngle}deg, ${C.background} 0%, ${cfg.accent}15 50%, ${C.background} 100%)`,
        opacity: fadeIn,
      }} />

      {/* Grid overlay */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.03,
        backgroundImage: `linear-gradient(${C.primary}40 1px, transparent 1px), linear-gradient(90deg, ${C.primary}40 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
        transform: `translateY(${(frame * 0.2) % 60}px)`,
      }} />

      {/* Radial glow */}
      <div style={{
        position: "absolute", top: "30%", left: "25%",
        width: 500, height: 500, borderRadius: "50%",
        background: `radial-gradient(circle, ${cfg.accent}12, transparent 70%)`,
        filter: "blur(80px)",
        opacity: 0.6 + Math.sin(frame * 0.03) * 0.3,
      }} />

      {/* Scene badge (top-left) */}
      <div style={{
        position: "absolute", top: 30, left: 40,
        display: "flex", alignItems: "center", gap: 10,
        opacity: interpolate(localFrame, [0, 15], [0, 0.9], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        }),
      }}>
        <div style={{
          fontSize: 24, width: 44, height: 44, borderRadius: 12,
          background: `${cfg.accent}20`, border: `2px solid ${cfg.accent}44`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {cfg.icon}
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: 3 }}>
            SCENE
          </div>
          <div style={{ fontSize: 18, color: cfg.accent, fontWeight: 800, letterSpacing: 2 }}>
            {cfg.label}
          </div>
        </div>
      </div>

      {/* Scene visual panel (right side) */}
      <SceneVisual scene={scene} frame={frame} fps={fps} localFrame={localFrame} lineIdx={lineIdx} />

      {/* Speaker indicator (left side) */}
      {active && (
        <div style={{
          position: "absolute", left: 40, top: "50%", transform: "translateY(-50%)",
          display: "flex", flexDirection: "column", gap: 20,
        }}>
          {Array.from(new Set(timing.map((t) => JSON.stringify({ name: t.character_name, speaker: t.speaker }))))
            .map((s) => JSON.parse(s))
            .map((char: { name: string; speaker: string }, idx: number) => {
              const isSpeaking = active?.character_name === char.name;
              const color = char.speaker === "MAIN" ? C.primary : C.secondary;
              return (
                <div key={char.name} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  opacity: isSpeaking ? 1 : 0.25,
                  transform: `scale(${isSpeaking ? 1 : 0.85}) translateX(${isSpeaking ? 10 : 0}px)`,
                }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: "50%",
                    background: `linear-gradient(135deg, ${color}44, ${color}11)`,
                    border: `3px solid ${isSpeaking ? color : color + "33"}`,
                    boxShadow: isSpeaking ? `0 0 20px ${color}44` : "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22, fontWeight: 800, color: C.text,
                  }}>
                    {char.name[0]}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: isSpeaking ? color : C.muted, letterSpacing: 2 }}>
                      {char.name}
                    </div>
                    <div style={{
                      width: isSpeaking ? 40 : 0, height: 2,
                      background: color, borderRadius: 1, marginTop: 3,
                      transition: "width 0.2s",
                    }} />
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Main dialogue text (center-left, large) */}
      {active && (
        <div style={{
          position: "absolute", top: "30%", left: 140, right: 620,
          opacity: interpolate(localFrame, [0, 8], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp",
          }),
        }}>
          <div style={{
            fontSize: 36, fontWeight: 700, color: C.text,
            lineHeight: 1.5, fontFamily: "Inter, sans-serif",
            textShadow: `0 2px 40px ${C.background}`,
          }}>
            {active.text}
          </div>
        </div>
      )}

      {/* Bottom bar with speaker name */}
      {active && (
        <div style={{
          position: "absolute", bottom: 30, left: 40, right: 40,
          display: "flex", alignItems: "center", gap: 16,
        }}>
          <div style={{
            padding: "6px 16px", borderRadius: 8,
            background: (active.speaker === "MAIN" ? C.primary : C.secondary) + "22",
            border: `1px solid ${active.speaker === "MAIN" ? C.primary : C.secondary}44`,
          }}>
            <span style={{
              fontSize: 13, fontWeight: 800, letterSpacing: 2,
              color: active.speaker === "MAIN" ? C.primary : C.secondary,
            }}>
              {active.character_name}
            </span>
          </div>
          <div style={{
            flex: 1, height: 1,
            background: `linear-gradient(90deg, ${C.muted}44, transparent)`,
          }} />
        </div>
      )}
    </AbsoluteFill>
  );
};

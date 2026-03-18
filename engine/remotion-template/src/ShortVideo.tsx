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

const C = {
  bg: "#07080f",
  primary: "#4fffff",
  secondary: "#a855f7",
  text: "#f0f4ff",
  surface: "#111827",
  muted: "#6b7a99",
  red: "#f87171",
  green: "#34d399",
  yellow: "#fbbf24",
  orange: "#fb923c",
  blue: "#60a5fa",
  purple: "#c084fc",
};

interface TimingItem {
  scene: string; speaker: string; character_name: string;
  text: string; audioOffsetSec: number; durationSec: number;
}
const timing: TimingItem[] = timingData as TimingItem[];
const SHORT_SEC = 58;
const shortTiming = timing.filter((t) => t.audioOffsetSec < SHORT_SEC);

const SCENE_CFG: Record<string, { accent: string; icon: string; label: string }> = {
  HookScene:          { accent: C.primary, icon: "\u26A1", label: "HOOK" },
  ConflictScene:      { accent: C.red,     icon: "\uD83D\uDD25", label: "VS" },
  InvestigationScene: { accent: C.blue,    icon: "\uD83D\uDD0D", label: "DATA" },
  TwistScene:         { accent: C.purple,  icon: "\uD83D\uDCA1", label: "TWIST" },
  ResolutionScene:    { accent: C.green,   icon: "\u2705", label: "KEY" },
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

function sceneStartFrame(scene: string, fps: number): number {
  const first = shortTiming.find((t) => t.scene === scene);
  return first ? Math.round(first.audioOffsetSec * fps) : 0;
}

/* ===== Particles ===== */
const Particles: React.FC<{ frame: number; accent: string }> = ({ frame, accent }) => {
  const pts = React.useMemo(() =>
    Array.from({ length: 15 }, (_, i) => ({
      x: (i * 137 + 29) % 100, y: (i * 89 + 13) % 100,
      s: 3 + (i % 4), sp: 0.3 + (i % 5) * 0.12, ph: i * 0.9,
    })), []);
  return <>
    {pts.map((p, i) => (
      <div key={i} style={{
        position: "absolute",
        left: `${p.x + Math.sin(frame * 0.02 + p.ph) * 3}%`,
        top: `${(p.y + frame * p.sp * 0.04) % 110 - 5}%`,
        width: p.s, height: p.s, borderRadius: "50%",
        background: accent, opacity: 0.1 + Math.sin(frame * 0.04 + p.ph) * 0.06,
      }} />
    ))}
  </>;
};

/* ===== HOOK: Big animated question ===== */
const ShortHook: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const lf = frame - sceneStartFrame("HookScene", fps);
  const scale = interpolate(lf, [0, 18], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(2)),
  });
  const pulse = 1 + Math.sin(lf * 0.07) * 0.08;
  const rotate = Math.sin(lf * 0.04) * 5;

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 20, flex: 1,
    }}>
      {/* Ripples */}
      {[0, 20, 40].map((d, i) => {
        const r = interpolate((lf - d) % 80, [0, 80], [0.5, 2.5], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        });
        return (
          <div key={i} style={{
            position: "absolute", width: 150 * r, height: 150 * r,
            borderRadius: "50%",
            border: `2px solid ${C.primary}`,
            opacity: interpolate((lf - d) % 80, [0, 80], [0.3, 0], {
              extrapolateLeft: "clamp", extrapolateRight: "clamp",
            }),
          }} />
        );
      })}
      <div style={{
        fontSize: 160,
        transform: `scale(${scale * pulse}) rotate(${rotate}deg)`,
        filter: `drop-shadow(0 0 50px ${C.primary}66)`,
      }}>{"\u2753"}</div>
      <div style={{
        fontSize: 28, fontWeight: 900, color: C.primary,
        letterSpacing: 4, fontFamily: "Inter",
        opacity: interpolate(lf, [20, 35], [0, 1], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        }),
      }}>WAIT... WHAT?</div>
    </div>
  );
};

/* ===== CONFLICT: VS split ===== */
const ShortConflict: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const lf = frame - sceneStartFrame("ConflictScene", fps);
  const leftSlide = interpolate(lf, [0, 18], [-500, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const rightSlide = interpolate(lf, [0, 18], [500, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const vsScale = interpolate(lf, [15, 28], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(2.5)),
  });

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 24, flex: 1,
    }}>
      {/* Top card */}
      <div style={{
        width: 400, padding: "36px 24px", borderRadius: 24,
        background: `${C.red}12`, border: `2px solid ${C.red}33`,
        textAlign: "center",
        transform: `translateX(${leftSlide}px)`,
      }}>
        <div style={{ fontSize: 60, marginBottom: 8 }}>{"\uD83D\uDCE2"}</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: C.red, letterSpacing: 3, fontFamily: "Inter" }}>
          THE NARRATIVE
        </div>
        <div style={{ fontSize: 56, fontWeight: 900, color: C.text, fontFamily: "Inter", marginTop: 8 }}>
          82%
        </div>
      </div>

      {/* VS */}
      <div style={{
        width: 80, height: 80, borderRadius: "50%",
        background: `linear-gradient(135deg, ${C.yellow}, ${C.orange})`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 28, fontWeight: 900, color: C.bg, fontFamily: "Inter",
        transform: `scale(${vsScale})`,
        boxShadow: `0 0 40px ${C.yellow}66`,
      }}>VS</div>

      {/* Bottom card */}
      <div style={{
        width: 400, padding: "36px 24px", borderRadius: 24,
        background: `${C.green}12`, border: `2px solid ${C.green}33`,
        textAlign: "center",
        transform: `translateX(${rightSlide}px)`,
      }}>
        <div style={{ fontSize: 60, marginBottom: 8 }}>{"\uD83D\uDCCA"}</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: C.green, letterSpacing: 3, fontFamily: "Inter" }}>
          THE REALITY
        </div>
        <div style={{ fontSize: 56, fontWeight: 900, color: C.text, fontFamily: "Inter", marginTop: 8 }}>
          31%
        </div>
      </div>
    </div>
  );
};

/* ===== INVESTIGATION: Evidence flying in ===== */
const ShortInvestigation: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const lf = frame - sceneStartFrame("InvestigationScene", fps);

  const cards = [
    { icon: "\uD83D\uDCC8", label: "FINDING #1", color: C.blue },
    { icon: "\u26A0\uFE0F", label: "FINDING #2", color: C.yellow },
    { icon: "\uD83D\uDCA5", label: "FINDING #3", color: C.red },
  ];

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 20, flex: 1,
    }}>
      {/* Big magnifying glass */}
      <div style={{
        fontSize: 100,
        transform: `scale(${interpolate(lf, [0, 15], [0, 1], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
          easing: Easing.out(Easing.back(1.5)),
        })})`,
        filter: `drop-shadow(0 0 30px ${C.blue}44)`,
        marginBottom: 10,
      }}>{"\uD83D\uDD0D"}</div>

      {cards.map((card, i) => {
        const cf = lf - 20 - i * 20;
        const scale = interpolate(cf, [0, 14], [0, 1], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
          easing: Easing.out(Easing.back(1.8)),
        });
        return (
          <div key={i} style={{
            width: 420, padding: "24px 20px", borderRadius: 20,
            background: `${card.color}0c`, border: `2px solid ${card.color}33`,
            display: "flex", alignItems: "center", gap: 16,
            transform: `scale(${scale})`,
            boxShadow: `0 4px 20px ${card.color}15`,
          }}>
            <div style={{ fontSize: 44 }}>{card.icon}</div>
            <div style={{
              fontSize: 20, fontWeight: 900, color: card.color,
              letterSpacing: 3, fontFamily: "Inter",
            }}>{card.label}</div>
          </div>
        );
      })}
    </div>
  );
};

/* ===== TWIST: Big reveal ===== */
const ShortTwist: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const lf = frame - sceneStartFrame("TwistScene", fps);
  const revealScale = interpolate(lf, [0, 18], [0.1, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(2.5)),
  });
  const revealRotate = interpolate(lf, [0, 18], [180, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Explosion
  const particles = React.useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      angle: (i / 12) * Math.PI * 2,
      dist: 100 + (i % 3) * 50,
      color: [C.purple, C.primary, C.yellow][i % 3],
    })), []);

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 24, flex: 1,
    }}>
      {/* Glow */}
      <div style={{
        position: "absolute",
        width: 400 + Math.sin(lf * 0.05) * 60,
        height: 400 + Math.sin(lf * 0.05) * 60,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${C.purple}18, transparent 70%)`,
        filter: "blur(30px)",
      }} />

      {/* Particles */}
      {lf > 12 && particles.map((p, i) => {
        const d = interpolate(lf - 12, [0, 25], [0, p.dist], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        return (
          <div key={i} style={{
            position: "absolute",
            left: `calc(50% + ${Math.cos(p.angle) * d}px)`,
            top: `calc(50% + ${Math.sin(p.angle) * d}px)`,
            width: 8, height: 8, borderRadius: "50%",
            background: p.color,
            opacity: interpolate(lf - 12, [0, 8, 35], [0, 1, 0], {
              extrapolateLeft: "clamp", extrapolateRight: "clamp",
            }),
          }} />
        );
      })}

      <div style={{
        fontSize: 140,
        transform: `scale(${revealScale}) rotate(${revealRotate}deg)`,
        filter: `drop-shadow(0 0 50px ${C.purple}66)`,
      }}>{"\uD83D\uDCA1"}</div>

      <div style={{
        fontSize: 40, fontWeight: 900, color: C.purple,
        letterSpacing: 6, fontFamily: "Inter",
        opacity: interpolate(lf, [15, 28], [0, 1], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        }),
        textShadow: `0 0 30px ${C.purple}44`,
      }}>PLOT TWIST</div>
    </div>
  );
};

/* ===== RESOLUTION: Rules ===== */
const ShortResolution: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const lf = frame - sceneStartFrame("ResolutionScene", fps);
  const rules = ["Check the source", "Follow the money", "Question everything"];

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 20, flex: 1,
    }}>
      <div style={{
        fontSize: 28, fontWeight: 900, color: C.green,
        letterSpacing: 4, fontFamily: "Inter",
        opacity: interpolate(lf, [0, 15], [0, 1], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        }),
      }}>{"\u2705"} TAKEAWAYS</div>

      {rules.map((r, i) => {
        const f = lf - 15 - i * 20;
        const slideX = interpolate(f, [0, 15], [i % 2 === 0 ? -400 : 400, 0], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        return (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 16,
            width: 440, padding: "20px 24px", borderRadius: 18,
            background: `${C.green}0a`, border: `2px solid ${C.green}22`,
            transform: `translateX(${slideX}px)`,
            opacity: interpolate(f, [0, 10], [0, 1], {
              extrapolateLeft: "clamp", extrapolateRight: "clamp",
            }),
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: C.green, color: C.bg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, fontWeight: 900, fontFamily: "Inter", flexShrink: 0,
            }}>{i + 1}</div>
            <div style={{
              fontSize: 18, fontWeight: 700, color: C.text, fontFamily: "Inter",
            }}>{r}</div>
          </div>
        );
      })}
    </div>
  );
};

/* ===== OUTRO: Subscribe ===== */
const ShortOutro: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const lf = frame - sceneStartFrame("OutroScene", fps);
  const swing = Math.sin(lf * 0.12) * 12;
  const btnScale = interpolate(lf, [15, 30], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(2)),
  });

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 20, flex: 1,
    }}>
      <div style={{
        fontSize: 140,
        transform: `rotate(${swing}deg)`,
        filter: `drop-shadow(0 0 40px ${C.primary}44)`,
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
        }}>FOLLOW</div>
      </div>
    </div>
  );
};

/* ===== MAIN SHORT EXPORT ===== */
export const ShortVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { active } = getActive(frame, fps);
  const scene = getScene(frame, fps);
  const cfg = SCENE_CFG[scene] || SCENE_CFG.HookScene;
  const speakerColor = active?.speaker === "MAIN" ? C.primary : C.secondary;

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, fontFamily: "Inter, sans-serif" }}>
      <Audio src={staticFile("audio/narration.mp3")} endAt={SHORT_SEC * fps} />

      {/* Background */}
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(ellipse at 50% 40%, ${cfg.accent}0c, transparent 70%)`,
      }} />

      <Particles frame={frame} accent={cfg.accent} />

      {/* Side lines */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
        background: `linear-gradient(to bottom, transparent, ${C.primary}55, transparent)`,
      }} />
      <div style={{
        position: "absolute", right: 0, top: 0, bottom: 0, width: 3,
        background: `linear-gradient(to bottom, transparent, ${C.secondary}55, transparent)`,
      }} />

      {/* Progress */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `${C.muted}12` }}>
        <div style={{
          height: "100%", width: `${(frame / durationInFrames) * 100}%`,
          background: `linear-gradient(90deg, ${C.primary}, ${C.secondary})`,
        }} />
      </div>

      {/* ===== CENTER: Scene visual (takes up most of screen) ===== */}
      <div style={{
        position: "absolute", top: 80, bottom: 280,
        left: 0, right: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {scene === "HookScene" && <ShortHook frame={frame} fps={fps} />}
        {scene === "ConflictScene" && <ShortConflict frame={frame} fps={fps} />}
        {scene === "InvestigationScene" && <ShortInvestigation frame={frame} fps={fps} />}
        {scene === "TwistScene" && <ShortTwist frame={frame} fps={fps} />}
        {scene === "ResolutionScene" && <ShortResolution frame={frame} fps={fps} />}
        {scene === "OutroScene" && <ShortOutro frame={frame} fps={fps} />}
      </div>

      {/* ===== SUBTITLE (below animation) ===== */}
      {active && (
        <div style={{
          position: "absolute", bottom: 100, left: 36, right: 36,
          textAlign: "center",
        }}>
          {/* Speaker */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "5px 16px", borderRadius: 24, marginBottom: 10,
            background: `${speakerColor}15`,
            border: `1px solid ${speakerColor}22`,
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%",
              background: `${speakerColor}33`, border: `1.5px solid ${speakerColor}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 900, color: C.text,
            }}>{active.character_name[0]}</div>
            <span style={{
              fontSize: 13, fontWeight: 800, letterSpacing: 2, color: speakerColor,
            }}>{active.character_name}</span>
          </div>
          {/* Text */}
          <div style={{
            fontSize: 20, fontWeight: 600, color: `${C.text}cc`,
            lineHeight: 1.5, fontFamily: "Inter",
            textShadow: `0 2px 8px ${C.bg}`,
            maxHeight: 100, overflow: "hidden",
          }}>
            {active.text.length > 110 ? active.text.substring(0, 107) + "..." : active.text}
          </div>
        </div>
      )}

      {/* Corner accents */}
      {[
        { top: 14, left: 14 }, { top: 14, right: 14 },
        { bottom: 14, left: 14 }, { bottom: 14, right: 14 },
      ].map((pos, i) => (
        <div key={i} style={{
          position: "absolute", ...pos, width: 18, height: 18,
          borderTop: i < 2 ? `2px solid ${C.primary}20` : "none",
          borderBottom: i >= 2 ? `2px solid ${C.primary}20` : "none",
          borderLeft: i % 2 === 0 ? `2px solid ${C.primary}20` : "none",
          borderRight: i % 2 === 1 ? `2px solid ${C.primary}20` : "none",
        }} />
      ))}
    </AbsoluteFill>
  );
};

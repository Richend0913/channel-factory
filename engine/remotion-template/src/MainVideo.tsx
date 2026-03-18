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
  blue: "#60a5fa",
  purple: "#c084fc",
  yellow: "#fbbf24",
  orange: "#fb923c",
};

interface TimingItem {
  scene: string; speaker: string; character_name: string;
  text: string; audioOffsetSec: number; durationSec: number;
}
const timing: TimingItem[] = timingData as TimingItem[];

const SCENES: Record<string, { label: string; accent: string; icon: string }> = {
  HookScene:          { label: "HOOK",       accent: C.primary, icon: "\u26A1" },
  ConflictScene:      { label: "PROBLEM",    accent: C.red,     icon: "\uD83D\uDD25" },
  InvestigationScene: { label: "DEEP DIVE",  accent: C.blue,    icon: "\uD83D\uDD0D" },
  TwistScene:         { label: "PLOT TWIST", accent: C.purple,  icon: "\uD83D\uDCA1" },
  ResolutionScene:    { label: "TAKEAWAY",   accent: C.green,   icon: "\u2705" },
  OutroScene:         { label: "SUBSCRIBE",  accent: C.primary, icon: "\uD83D\uDD14" },
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

function sceneLines(scene: string): TimingItem[] {
  return timing.filter((t) => t.scene === scene);
}

function lineIndexInScene(idx: number, scene: string): number {
  const first = timing.findIndex((t) => t.scene === scene);
  return first >= 0 ? idx - first : 0;
}

/* ===== Particles ===== */
const Particles: React.FC<{ frame: number; accent: string }> = ({ frame, accent }) => {
  const pts = React.useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      x: (i * 137 + 29) % 100, y: (i * 97 + 41) % 100,
      s: 2 + (i % 5), sp: 0.2 + (i % 6) * 0.1, ph: i * 0.8,
    })), []);
  return <>
    {pts.map((p, i) => (
      <div key={i} style={{
        position: "absolute",
        left: `${p.x + Math.sin(frame * 0.015 + p.ph) * 2}%`,
        top: `${(p.y + frame * p.sp * 0.04) % 105 - 3}%`,
        width: p.s, height: p.s, borderRadius: "50%",
        background: accent,
        opacity: 0.08 + Math.sin(frame * 0.03 + p.ph) * 0.06,
        filter: p.s > 4 ? "blur(2px)" : "none",
      }} />
    ))}
  </>;
};

/* ===== HOOK: Big pulsing question + ripple effect ===== */
const HookVisual: React.FC<{ frame: number; fps: number; lines: TimingItem[] }> = ({
  frame, fps, lines,
}) => {
  const lf = frame - sceneStartFrame("HookScene", fps);
  const pulse = 1 + Math.sin(lf * 0.06) * 0.08;
  const rotate = Math.sin(lf * 0.03) * 3;
  const questionScale = interpolate(lf, [0, 25], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(1.5)),
  });

  // Extract a key phrase from the hook
  const hookMain = lines.find((l) => l.speaker === "MAIN");
  const keyPhrase = hookMain
    ? hookMain.text.split(".")[0].substring(0, 50)
    : "What if everything you know is wrong?";

  const phraseOpacity = interpolate(lf, [30, 45], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 30,
    }}>
      {/* Ripple rings */}
      {[0, 15, 30].map((delay, i) => {
        const ripple = interpolate((lf - delay) % 90, [0, 90], [0.3, 2], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        });
        const rippleOpacity = interpolate((lf - delay) % 90, [0, 90], [0.3, 0], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        });
        return (
          <div key={i} style={{
            position: "absolute",
            width: 200 * ripple, height: 200 * ripple,
            borderRadius: "50%",
            border: `2px solid ${C.primary}`,
            opacity: rippleOpacity,
          }} />
        );
      })}

      {/* Big question icon */}
      <div style={{
        fontSize: 140,
        transform: `scale(${questionScale * pulse}) rotate(${rotate}deg)`,
        filter: `drop-shadow(0 0 40px ${C.primary}66)`,
      }}>
        {"\u2753"}
      </div>

      {/* Key phrase */}
      <div style={{
        fontSize: 28, fontWeight: 800, color: C.primary,
        fontFamily: "Inter", letterSpacing: 2, textAlign: "center",
        maxWidth: 700, opacity: phraseOpacity,
        textShadow: `0 0 30px ${C.primary}44`,
      }}>
        {keyPhrase}
      </div>
    </div>
  );
};

/* ===== CONFLICT: Split comparison + clash effect ===== */
const ConflictVisual: React.FC<{ frame: number; fps: number; lines: TimingItem[] }> = ({
  frame, fps, lines,
}) => {
  const lf = frame - sceneStartFrame("ConflictScene", fps);
  const lineIdx = Math.min(Math.floor(lf / (fps * 3)), 3);

  const leftSlide = interpolate(lf, [0, 20], [-400, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const rightSlide = interpolate(lf, [0, 20], [400, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Animated "VS" flash
  const vsScale = interpolate(lf, [18, 28], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(2)),
  });
  const vsPulse = 1 + Math.sin(lf * 0.08) * 0.1;

  // Animated bars that grow over time
  const bars = [
    { label: "WHAT PEOPLE THINK", value: 82, color: C.red },
    { label: "WHAT DATA SHOWS", value: 31, color: C.green },
  ];

  const barOpacity = interpolate(lf, [40, 55], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
    }}>
      {/* Split panels */}
      <div style={{ display: "flex", gap: 40, marginBottom: 40 }}>
        {/* Left: belief */}
        <div style={{
          width: 360, padding: "40px 30px", borderRadius: 24,
          background: `linear-gradient(160deg, ${C.red}15, ${C.red}05)`,
          border: `2px solid ${C.red}33`,
          transform: `translateX(${leftSlide}px)`,
          textAlign: "center",
        }}>
          <div style={{ fontSize: 60, marginBottom: 12 }}>{"\uD83D\uDCE2"}</div>
          <div style={{
            fontSize: 16, fontWeight: 800, color: C.red,
            letterSpacing: 3, fontFamily: "Inter",
          }}>NARRATIVE</div>
          <div style={{
            fontSize: 48, fontWeight: 900, color: C.text,
            fontFamily: "Inter", marginTop: 8,
          }}>82%</div>
          <div style={{
            fontSize: 13, color: C.muted, marginTop: 4,
            fontFamily: "Inter",
          }}>believe the hype</div>
        </div>

        {/* VS badge */}
        <div style={{
          position: "absolute", left: "50%", top: "38%",
          transform: `translate(-50%, -50%) scale(${vsScale * vsPulse})`,
          zIndex: 10,
        }}>
          <div style={{
            width: 70, height: 70, borderRadius: "50%",
            background: `linear-gradient(135deg, ${C.yellow}, ${C.orange})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, fontWeight: 900, color: C.bg,
            fontFamily: "Inter",
            boxShadow: `0 0 30px ${C.yellow}66`,
          }}>VS</div>
        </div>

        {/* Right: reality */}
        <div style={{
          width: 360, padding: "40px 30px", borderRadius: 24,
          background: `linear-gradient(160deg, ${C.green}15, ${C.green}05)`,
          border: `2px solid ${C.green}33`,
          transform: `translateX(${rightSlide}px)`,
          textAlign: "center",
        }}>
          <div style={{ fontSize: 60, marginBottom: 12 }}>{"\uD83D\uDCCA"}</div>
          <div style={{
            fontSize: 16, fontWeight: 800, color: C.green,
            letterSpacing: 3, fontFamily: "Inter",
          }}>REALITY</div>
          <div style={{
            fontSize: 48, fontWeight: 900, color: C.text,
            fontFamily: "Inter", marginTop: 8,
          }}>31%</div>
          <div style={{
            fontSize: 13, color: C.muted, marginTop: 4,
            fontFamily: "Inter",
          }}>backed by data</div>
        </div>
      </div>

      {/* Horizontal bar comparison */}
      <div style={{ width: 700, opacity: barOpacity }}>
        {bars.map((bar, i) => {
          const w = interpolate(lf - 45, [0, 30], [0, bar.value], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          });
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12, marginBottom: 12,
            }}>
              <div style={{
                width: 160, fontSize: 11, fontWeight: 800, color: C.muted,
                textAlign: "right", letterSpacing: 2, fontFamily: "Inter",
              }}>{bar.label}</div>
              <div style={{
                flex: 1, height: 32, borderRadius: 8,
                background: `${bar.color}11`, overflow: "hidden",
              }}>
                <div style={{
                  height: "100%", width: `${w}%`, borderRadius: 8,
                  background: `linear-gradient(90deg, ${bar.color}88, ${bar.color})`,
                  boxShadow: `0 0 20px ${bar.color}44`,
                }} />
              </div>
              <div style={{
                fontSize: 18, fontWeight: 900, color: bar.color,
                fontFamily: "Inter", width: 50,
              }}>{Math.round(w)}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ===== INVESTIGATION: Magnifying glass scanning + evidence cards ===== */
const InvestigationVisual: React.FC<{ frame: number; fps: number; lines: TimingItem[] }> = ({
  frame, fps, lines,
}) => {
  const lf = frame - sceneStartFrame("InvestigationScene", fps);

  // Magnifying glass sweep
  const glassX = interpolate(lf, [0, 60, 120], [200, 960, 700], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const glassY = interpolate(lf, [0, 60, 120], [300, 200, 350], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const glassScale = interpolate(lf, [0, 15], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(1.5)),
  });

  // Evidence cards appear one by one
  const cards = [
    { icon: "\uD83D\uDCC8", label: "FINDING #1", color: C.blue },
    { icon: "\u26A0\uFE0F", label: "FINDING #2", color: C.yellow },
    { icon: "\uD83D\uDCA5", label: "FINDING #3", color: C.red },
  ];

  // Scan line effect
  const scanY = (lf * 3) % 600;

  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
    }}>
      {/* Scan line */}
      <div style={{
        position: "absolute", left: 100, right: 100,
        top: scanY, height: 2,
        background: `linear-gradient(90deg, transparent, ${C.blue}44, transparent)`,
        boxShadow: `0 0 20px ${C.blue}22`,
      }} />

      {/* Data grid background */}
      <div style={{
        position: "absolute", inset: 80, opacity: 0.04,
        backgroundImage: `
          linear-gradient(${C.blue} 1px, transparent 1px),
          linear-gradient(90deg, ${C.blue} 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
        borderRadius: 20,
      }} />

      {/* Magnifying glass */}
      <div style={{
        position: "absolute", left: glassX, top: glassY,
        transform: `scale(${glassScale})`,
        fontSize: 100,
        filter: `drop-shadow(0 0 30px ${C.blue}44)`,
      }}>
        {"\uD83D\uDD0D"}
      </div>

      {/* Evidence cards */}
      <div style={{
        display: "flex", gap: 30, position: "absolute", bottom: 200,
      }}>
        {cards.map((card, i) => {
          const cardF = lf - 30 - i * 25;
          const scale = interpolate(cardF, [0, 15], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp",
            easing: Easing.out(Easing.back(1.8)),
          });
          const opacity = interpolate(cardF, [0, 10], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp",
          });
          return (
            <div key={i} style={{
              width: 200, padding: "30px 20px", borderRadius: 20,
              background: `linear-gradient(160deg, ${C.surface}, ${card.color}08)`,
              border: `2px solid ${card.color}33`,
              boxShadow: `0 8px 32px ${card.color}15`,
              textAlign: "center",
              transform: `scale(${scale})`, opacity,
            }}>
              <div style={{ fontSize: 50, marginBottom: 10 }}>{card.icon}</div>
              <div style={{
                fontSize: 14, fontWeight: 900, color: card.color,
                letterSpacing: 3, fontFamily: "Inter",
              }}>{card.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ===== TWIST: Big reveal with flip/explosion effect ===== */
const TwistVisual: React.FC<{ frame: number; fps: number; lines: TimingItem[] }> = ({
  frame, fps, lines,
}) => {
  const lf = frame - sceneStartFrame("TwistScene", fps);
  const mainText = lines.find((l) => l.speaker === "MAIN");
  const keyLine = mainText ? mainText.text.split(".")[0].substring(0, 60) : "The opposite is true";

  // Big reveal animation
  const revealScale = interpolate(lf, [0, 20], [0.1, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(2)),
  });
  const revealRotate = interpolate(lf, [0, 20], [180, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Explosion particles
  const showParticles = lf > 15;
  const explodeParticles = React.useMemo(() =>
    Array.from({ length: 16 }, (_, i) => ({
      angle: (i / 16) * Math.PI * 2,
      dist: 80 + (i % 4) * 40,
      size: 6 + (i % 3) * 4,
      color: [C.purple, C.primary, C.yellow, C.red][i % 4],
    })), []);

  // Glow pulse
  const glowSize = 300 + Math.sin(lf * 0.05) * 50;

  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
    }}>
      {/* Background glow */}
      <div style={{
        position: "absolute", width: glowSize, height: glowSize,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${C.purple}20, transparent 70%)`,
        filter: "blur(40px)",
      }} />

      {/* Explosion particles */}
      {showParticles && explodeParticles.map((p, i) => {
        const dist = interpolate(lf - 15, [0, 30], [0, p.dist], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        const partOpacity = interpolate(lf - 15, [0, 10, 40], [0, 1, 0], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        });
        return (
          <div key={i} style={{
            position: "absolute",
            left: `calc(50% + ${Math.cos(p.angle) * dist}px)`,
            top: `calc(50% + ${Math.sin(p.angle) * dist}px)`,
            width: p.size, height: p.size, borderRadius: "50%",
            background: p.color, opacity: partOpacity,
            boxShadow: `0 0 10px ${p.color}`,
          }} />
        );
      })}

      {/* Main reveal icon */}
      <div style={{
        fontSize: 120,
        transform: `scale(${revealScale}) rotate(${revealRotate}deg)`,
        filter: `drop-shadow(0 0 40px ${C.purple}66)`,
        marginBottom: 20,
      }}>
        {"\uD83D\uDCA1"}
      </div>

      {/* PLOT TWIST text */}
      <div style={{
        fontSize: 42, fontWeight: 900, color: C.purple,
        fontFamily: "Inter", letterSpacing: 6,
        textShadow: `0 0 30px ${C.purple}44`,
        opacity: interpolate(lf, [15, 25], [0, 1], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        }),
      }}>
        PLOT TWIST
      </div>

      {/* Key insight */}
      <div style={{
        fontSize: 20, fontWeight: 600, color: C.text,
        fontFamily: "Inter", marginTop: 16,
        maxWidth: 600, textAlign: "center", lineHeight: 1.5,
        opacity: interpolate(lf, [30, 45], [0, 1], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        }),
      }}>
        {keyLine}
      </div>
    </div>
  );
};

/* ===== RESOLUTION: Animated checklist ===== */
const ResolutionVisual: React.FC<{ frame: number; fps: number; lines: TimingItem[] }> = ({
  frame, fps, lines,
}) => {
  const lf = frame - sceneStartFrame("ResolutionScene", fps);
  const mainLines = lines.filter((l) => l.speaker === "MAIN");

  const rules = mainLines.length > 0
    ? mainLines.map((l) => l.text.split(".")[0].substring(0, 60))
    : ["Check the data", "Follow the money", "Question the narrative"];

  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 20,
    }}>
      {/* Heading */}
      <div style={{
        fontSize: 32, fontWeight: 900, color: C.green,
        fontFamily: "Inter", letterSpacing: 4, marginBottom: 20,
        opacity: interpolate(lf, [0, 15], [0, 1], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        }),
      }}>
        {"\u2705"} KEY TAKEAWAYS
      </div>

      {/* Rule cards */}
      {rules.slice(0, 3).map((rule, i) => {
        const f = lf - 20 - i * 25;
        const slideX = interpolate(f, [0, 18], [i % 2 === 0 ? -300 : 300, 0], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        const opacity = interpolate(f, [0, 12], [0, 1], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        });
        const checkScale = interpolate(f, [12, 22], [0, 1], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
          easing: Easing.out(Easing.back(2)),
        });

        return (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 20,
            width: 700, padding: "20px 28px", borderRadius: 18,
            background: `linear-gradient(135deg, ${C.surface}, ${C.green}08)`,
            border: `2px solid ${C.green}22`,
            boxShadow: `0 4px 20px ${C.green}11`,
            opacity, transform: `translateX(${slideX}px)`,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: `linear-gradient(135deg, ${C.green}, ${C.green}88)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, fontWeight: 900, color: C.bg,
              fontFamily: "Inter", flexShrink: 0,
              transform: `scale(${checkScale})`,
            }}>
              {i + 1}
            </div>
            <div style={{
              fontSize: 18, fontWeight: 600, color: C.text,
              fontFamily: "Inter", lineHeight: 1.4,
            }}>
              {rule}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ===== OUTRO: Subscribe animation ===== */
const OutroVisual: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const lf = frame - sceneStartFrame("OutroScene", fps);
  const bellSwing = Math.sin(lf * 0.12) * 15;
  const bellScale = interpolate(lf, [0, 20], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(2)),
  });

  const btnScale = interpolate(lf, [25, 40], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(1.5)),
  });
  const btnPulse = 1 + Math.sin(lf * 0.06) * 0.05;

  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 24,
    }}>
      <div style={{
        fontSize: 120,
        transform: `scale(${bellScale}) rotate(${bellSwing}deg)`,
        filter: `drop-shadow(0 0 30px ${C.primary}44)`,
      }}>
        {"\uD83D\uDD14"}
      </div>

      <div style={{
        padding: "18px 60px", borderRadius: 50,
        background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
        transform: `scale(${btnScale * btnPulse})`,
        boxShadow: `0 8px 40px ${C.primary}44`,
      }}>
        <div style={{
          fontSize: 28, fontWeight: 900, color: C.bg,
          fontFamily: "Inter", letterSpacing: 4,
        }}>
          SUBSCRIBE
        </div>
      </div>

      <div style={{
        fontSize: 16, color: C.muted, fontFamily: "Inter",
        letterSpacing: 2, fontWeight: 600,
        opacity: interpolate(lf, [40, 55], [0, 1], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        }),
      }}>
        NEW VIDEO EVERY WEEK
      </div>
    </div>
  );
};

/* ===== MAIN EXPORT ===== */
export const MainVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { active } = getActive(frame, fps);
  const scene = getScene(frame, fps);
  const cfg = SCENES[scene] || SCENES.HookScene;
  const lines = sceneLines(scene);

  const bgAngle = 135 + Math.sin(frame * 0.003) * 15;

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, fontFamily: "Inter, sans-serif" }}>
      <Audio src={staticFile("audio/narration.mp3")} />

      {/* Animated background */}
      <div style={{
        position: "absolute", inset: 0,
        background: `linear-gradient(${bgAngle}deg, ${C.bg}, ${cfg.accent}0a 50%, ${C.bg})`,
      }} />

      <Particles frame={frame} accent={cfg.accent} />

      {/* Radial glow center */}
      <div style={{
        position: "absolute", top: "30%", left: "50%",
        width: 600, height: 600, borderRadius: "50%",
        transform: "translate(-50%, -50%)",
        background: `radial-gradient(circle, ${cfg.accent}0a, transparent 70%)`,
        filter: "blur(60px)",
      }} />

      {/* Progress bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: `${C.muted}12`,
      }}>
        <div style={{
          height: "100%", width: `${(frame / durationInFrames) * 100}%`,
          background: `linear-gradient(90deg, ${C.primary}, ${C.secondary})`,
        }} />
      </div>

      {/* Scene label (top-left, small) */}
      <div style={{
        position: "absolute", top: 24, left: 32,
        display: "flex", alignItems: "center", gap: 8,
        opacity: 0.7,
      }}>
        <span style={{ fontSize: 20 }}>{cfg.icon}</span>
        <span style={{
          fontSize: 12, fontWeight: 800, color: cfg.accent,
          letterSpacing: 3, fontFamily: "Inter",
        }}>{cfg.label}</span>
      </div>

      {/* ===== CENTER STAGE: Scene-specific visual ===== */}
      {scene === "HookScene" && <HookVisual frame={frame} fps={fps} lines={lines} />}
      {scene === "ConflictScene" && <ConflictVisual frame={frame} fps={fps} lines={lines} />}
      {scene === "InvestigationScene" && <InvestigationVisual frame={frame} fps={fps} lines={lines} />}
      {scene === "TwistScene" && <TwistVisual frame={frame} fps={fps} lines={lines} />}
      {scene === "ResolutionScene" && <ResolutionVisual frame={frame} fps={fps} lines={lines} />}
      {scene === "OutroScene" && <OutroVisual frame={frame} fps={fps} />}

      {/* ===== SUBTITLE (below animation area) ===== */}
      {active && (
        <div style={{
          position: "absolute", bottom: 80, left: 80, right: 80,
          textAlign: "center",
        }}>
          {/* Speaker badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "5px 16px", borderRadius: 20, marginBottom: 10,
            background: `${active.speaker === "MAIN" ? C.primary : C.secondary}15`,
            border: `1px solid ${active.speaker === "MAIN" ? C.primary : C.secondary}28`,
          }}>
            <span style={{
              fontSize: 13, fontWeight: 800, letterSpacing: 2,
              color: active.speaker === "MAIN" ? C.primary : C.secondary,
            }}>
              {active.character_name}
            </span>
          </div>
          {/* Subtitle text */}
          <div style={{
            fontSize: 22, fontWeight: 600, color: `${C.text}dd`,
            fontFamily: "Inter", lineHeight: 1.5,
            textShadow: `0 2px 12px ${C.bg}`,
          }}>
            {active.text}
          </div>
        </div>
      )}

      {/* Timestamp */}
      <div style={{
        position: "absolute", bottom: 24, right: 32,
        fontSize: 11, color: `${C.muted}88`, fontWeight: 600,
        letterSpacing: 1, fontFamily: "Inter",
      }}>
        {Math.floor(frame / fps / 60)}:{String(Math.floor(frame / fps) % 60).padStart(2, "0")}
      </div>
    </AbsoluteFill>
  );
};

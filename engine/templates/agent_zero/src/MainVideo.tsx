import React from "react";
import {
  AbsoluteFill, Audio, staticFile,
  useCurrentFrame, useVideoConfig, interpolate, Easing,
} from "remotion";
import timingData from "../public/audio/timing.json";

const C = {
  bg: "#07080f", primary: "#4fffff", secondary: "#a855f7",
  text: "#f0f4ff", surface: "#111827", muted: "#6b7a99",
  red: "#f87171", green: "#34d399", blue: "#60a5fa",
  yellow: "#fbbf24", orange: "#fb923c", purple: "#c084fc",
};

interface TimingItem {
  scene: string; speaker: string; character_name: string;
  text: string; audioOffsetSec: number; durationSec: number;
}
const timing: TimingItem[] = timingData as TimingItem[];

const SCENES: Record<string, { label: string; accent: string; icon: string }> = {
  HookScene:          { label: "INITIALIZING",  accent: C.primary, icon: "\u26A1" },
  ConflictScene:      { label: "ANALYZING",     accent: C.red,     icon: "\uD83D\uDD25" },
  InvestigationScene: { label: "BENCHMARKING",  accent: C.blue,    icon: "\uD83D\uDD0D" },
  TwistScene:         { label: "ANOMALY FOUND", accent: C.purple,  icon: "\uD83D\uDCA1" },
  ResolutionScene:    { label: "CONCLUSION",    accent: C.green,   icon: "\u2705" },
  OutroScene:         { label: "SUBSCRIBE",     accent: C.primary, icon: "\uD83D\uDD14" },
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

/* Extract numbers from dialogue text */
function extractNums(lines: TimingItem[]): string[] {
  const nums: string[] = [];
  for (const l of lines) {
    const m = l.text.match(/\d+[\.\d]*\s*%?/g);
    if (m) nums.push(...m);
  }
  return [...new Set(nums)].slice(0, 6);
}

/* ===== Matrix rain background ===== */
const MatrixRain: React.FC<{ frame: number; accent: string }> = ({ frame, accent }) => {
  const cols = React.useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      x: (i / 30) * 100,
      speed: 0.5 + (i % 5) * 0.3,
      chars: "01ABCDEF>_{}[];".split(""),
      offset: i * 37,
    })), []);

  return (
    <>
      {cols.map((col, i) => {
        const y = ((frame * col.speed + col.offset) % 140) - 20;
        const ch = col.chars[Math.floor(frame * 0.1 + i) % col.chars.length];
        return (
          <div key={i} style={{
            position: "absolute", left: `${col.x}%`, top: `${y}%`,
            fontSize: 14, fontFamily: "monospace", color: accent,
            opacity: 0.06 + (i % 3) * 0.02,
          }}>{ch}</div>
        );
      })}
    </>
  );
};

/* ===== Terminal-style code block ===== */
const CodeBlock: React.FC<{
  frame: number; lines: string[]; accent: string; delay?: number;
}> = ({ frame, lines, accent, delay = 0 }) => {
  const visibleLines = Math.min(lines.length, Math.floor((frame - delay) / 8));
  const opacity = interpolate(frame - delay, [0, 10], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  return (
    <div style={{
      padding: "20px 24px", borderRadius: 12,
      background: `${C.surface}ee`, border: `1px solid ${accent}22`,
      fontFamily: "monospace", fontSize: 14, lineHeight: 1.8,
      opacity, maxWidth: 600,
    }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {["#f87171", "#fbbf24", "#34d399"].map((c, i) => (
          <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c, opacity: 0.6 }} />
        ))}
      </div>
      {lines.slice(0, Math.max(0, visibleLines)).map((line, i) => (
        <div key={i} style={{ color: i === 0 ? accent : `${C.text}aa` }}>
          <span style={{ color: C.muted }}>{`${i + 1}  `}</span>
          {line}
          {i === visibleLines - 1 && <span style={{
            display: "inline-block", width: 8, height: 16,
            background: accent, marginLeft: 2,
            opacity: Math.sin(frame * 0.15) > 0 ? 1 : 0,
          }} />}
        </div>
      ))}
    </div>
  );
};

/* ===== Benchmark bars ===== */
const BenchmarkBars: React.FC<{
  frame: number; items: { label: string; value: number; color: string }[]; delay?: number;
}> = ({ frame, items, delay = 0 }) => {
  const maxVal = Math.max(...items.map((b) => b.value));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 500 }}>
      {items.map((item, i) => {
        const f = frame - (delay || 0) - i * 10;
        const w = interpolate(f, [0, 30], [0, (item.value / maxVal) * 100], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        const opacity = interpolate(f, [0, 8], [0, 1], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        });
        return (
          <div key={i} style={{ opacity }}>
            <div style={{
              display: "flex", justifyContent: "space-between", marginBottom: 4,
            }}>
              <span style={{ fontSize: 13, color: C.muted, fontFamily: "monospace", fontWeight: 700 }}>
                {item.label}
              </span>
              <span style={{ fontSize: 13, color: item.color, fontFamily: "monospace", fontWeight: 800 }}>
                {Math.round(w / 100 * maxVal)}%
              </span>
            </div>
            <div style={{
              height: 24, borderRadius: 6, background: `${item.color}11`, overflow: "hidden",
            }}>
              <div style={{
                height: "100%", width: `${w}%`, borderRadius: 6,
                background: `linear-gradient(90deg, ${item.color}66, ${item.color})`,
                boxShadow: `0 0 16px ${item.color}33`,
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ===== Stat counter ===== */
const StatCounter: React.FC<{
  frame: number; value: number; label: string; suffix?: string;
  accent: string; delay?: number;
}> = ({ frame, value, label, suffix = "%", accent, delay = 0 }) => {
  const f = frame - delay;
  const num = interpolate(f, [0, 35], [0, value], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const scale = interpolate(f, [0, 15], [0.5, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(1.5)),
  });
  return (
    <div style={{
      textAlign: "center", padding: "16px 24px", borderRadius: 16,
      background: `${accent}0a`, border: `1.5px solid ${accent}22`,
      transform: `scale(${scale})`, minWidth: 130,
    }}>
      <div style={{
        fontSize: 40, fontWeight: 900, color: accent,
        fontFamily: "monospace", lineHeight: 1,
      }}>
        {Math.round(num)}{suffix}
      </div>
      <div style={{
        fontSize: 11, color: C.muted, marginTop: 6,
        fontWeight: 700, letterSpacing: 2, textTransform: "uppercase",
      }}>{label}</div>
    </div>
  );
};

/* ===== Scene Visuals ===== */
const HookViz: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const lf = frame - sceneStartFrame("HookScene", fps);
  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20,
    }}>
      {/* Pulsing radar/scan effect */}
      {[0, 20, 40].map((d, i) => {
        const s = interpolate((lf - d) % 70, [0, 70], [0.3, 2.5], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return <div key={i} style={{
          position: "absolute", width: 200 * s, height: 200 * s, borderRadius: "50%",
          border: `2px solid ${C.primary}`,
          opacity: interpolate((lf - d) % 70, [0, 70], [0.4, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }} />;
      })}
      <div style={{
        fontSize: 100,
        transform: `scale(${interpolate(lf, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(2)) })})`,
        filter: `drop-shadow(0 0 40px ${C.primary}66)`,
      }}>{"\uD83E\uDD16"}</div>
      <CodeBlock frame={lf} accent={C.primary} delay={15} lines={[
        "$ agent_zero --analyze",
        "  Loading dataset...",
        "  Scanning claims...",
        "  Anomalies detected: 3",
        "  Running deep analysis...",
      ]} />
    </div>
  );
};

const ConflictViz: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const lf = frame - sceneStartFrame("ConflictScene", fps);
  const lines = sceneLines("ConflictScene");
  const nums = extractNums(lines);

  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 30,
    }}>
      <div style={{
        fontSize: 20, fontWeight: 800, color: C.red, letterSpacing: 4,
        fontFamily: "monospace",
        opacity: interpolate(lf, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>{"\u26A0\uFE0F"} DISCREPANCY DETECTED</div>

      <BenchmarkBars frame={lf} delay={15} items={[
        { label: "MARKETING CLAIM", value: 85, color: C.red },
        { label: "BENCHMARK RESULT", value: 31, color: C.yellow },
        { label: "REAL-WORLD PERF", value: 15, color: C.green },
        { label: "AFTER ERROR FIX", value: 8, color: C.blue },
      ]} />

      {nums.length > 0 && (
        <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
          {nums.slice(0, 3).map((n, i) => (
            <StatCounter key={i} frame={lf} value={parseFloat(n) || 50}
              label={`METRIC ${i + 1}`} accent={[C.primary, C.yellow, C.red][i % 3]}
              delay={40 + i * 12} />
          ))}
        </div>
      )}
    </div>
  );
};

const InvestigationViz: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const lf = frame - sceneStartFrame("InvestigationScene", fps);
  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24,
    }}>
      <div style={{
        fontSize: 18, fontWeight: 800, color: C.blue, letterSpacing: 4,
        fontFamily: "monospace",
        opacity: interpolate(lf, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>{"\uD83D\uDD0D"} BENCHMARK RESULTS</div>

      <BenchmarkBars frame={lf} delay={10} items={[
        { label: "BOILERPLATE CODE", value: 78, color: C.green },
        { label: "CREATIVE WRITING", value: 42, color: C.yellow },
        { label: "DATA ANALYSIS", value: 35, color: C.orange },
        { label: "ERROR RATE", value: 62, color: C.red },
        { label: "TIME-TO-CORRECT", value: 89, color: C.red },
      ]} />

      <CodeBlock frame={lf} accent={C.blue} delay={50} lines={[
        "// Test: AI vs Human speed",
        "human_avg = 23.4 min",
        "ai_gen   = 4.2 min  // ← fast!",
        "ai_debug = 19.1 min // ← oops",
        "net_gain = 0.1 min  // ← LOL",
      ]} />
    </div>
  );
};

const TwistViz: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const lf = frame - sceneStartFrame("TwistScene", fps);
  const scale = interpolate(lf, [0, 18], [0.1, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(2)),
  });

  // Explosion particles
  const parts = React.useMemo(() =>
    Array.from({ length: 14 }, (_, i) => ({
      a: (i / 14) * Math.PI * 2, d: 80 + (i % 4) * 40,
      c: [C.purple, C.primary, C.yellow, C.red][i % 4],
    })), []);

  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20,
    }}>
      <div style={{
        position: "absolute", width: 300 + Math.sin(lf * 0.05) * 50,
        height: 300 + Math.sin(lf * 0.05) * 50, borderRadius: "50%",
        background: `radial-gradient(circle, ${C.purple}18, transparent 70%)`, filter: "blur(30px)",
      }} />

      {lf > 12 && parts.map((p, i) => {
        const d = interpolate(lf - 12, [0, 25], [0, p.d], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
        return <div key={i} style={{
          position: "absolute",
          left: `calc(50% + ${Math.cos(p.a) * d}px)`, top: `calc(50% + ${Math.sin(p.a) * d}px)`,
          width: 6, height: 6, borderRadius: "50%", background: p.c,
          opacity: interpolate(lf - 12, [0, 8, 35], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }} />;
      })}

      <div style={{
        fontSize: 100, transform: `scale(${scale})`,
        filter: `drop-shadow(0 0 40px ${C.purple}66)`,
      }}>{"\uD83D\uDCA1"}</div>

      <div style={{
        fontSize: 36, fontWeight: 900, color: C.purple, letterSpacing: 6,
        fontFamily: "monospace",
        opacity: interpolate(lf, [15, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>ANOMALY FOUND</div>

      <CodeBlock frame={lf} accent={C.purple} delay={30} lines={[
        "// The metric everyone uses:",
        'metric = "time_to_first_output"',
        "// The metric that MATTERS:",
        'metric = "time_to_correct_output"',
        "// Difference: 10x",
      ]} />
    </div>
  );
};

const ResolutionViz: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const lf = frame - sceneStartFrame("ResolutionScene", fps);
  const rules = [
    "Use AI for repetitive, well-defined tasks only",
    "Always budget time for verification",
    "Stop automating things that require judgment",
  ];

  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16,
    }}>
      <div style={{
        fontSize: 20, fontWeight: 900, color: C.green, letterSpacing: 4,
        fontFamily: "monospace", marginBottom: 12,
        opacity: interpolate(lf, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>{"\u2705"} PROTOCOL</div>

      {rules.map((rule, i) => {
        const f = lf - 15 - i * 22;
        const slideX = interpolate(f, [0, 16], [i % 2 === 0 ? -300 : 300, 0], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
        });
        const opacity = interpolate(f, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 16,
            width: 700, padding: "16px 24px", borderRadius: 14,
            background: `${C.green}08`, border: `1.5px solid ${C.green}22`,
            transform: `translateX(${slideX}px)`, opacity,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: C.green, color: C.bg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 900, fontFamily: "monospace", flexShrink: 0,
            }}>{i + 1}</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: C.text, fontFamily: "Inter" }}>
              {rule}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const OutroViz: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const lf = frame - sceneStartFrame("OutroScene", fps);
  const bellSwing = Math.sin(lf * 0.12) * 12;
  const btnScale = interpolate(lf, [15, 30], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(2)),
  });
  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20,
    }}>
      <div style={{ fontSize: 100, transform: `rotate(${bellSwing}deg)`, filter: `drop-shadow(0 0 30px ${C.primary}44)` }}>{"\uD83D\uDD14"}</div>
      <div style={{
        padding: "14px 50px", borderRadius: 40,
        background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
        transform: `scale(${btnScale * (1 + Math.sin(lf * 0.06) * 0.04)})`,
        boxShadow: `0 8px 40px ${C.primary}44`,
      }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: C.bg, letterSpacing: 4 }}>SUBSCRIBE</div>
      </div>
      <div style={{
        fontSize: 14, color: C.muted, letterSpacing: 2, fontWeight: 600, fontFamily: "monospace",
        opacity: interpolate(lf, [35, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>TESTING AI CLAIMS WITH DATA — EVERY WEEK</div>
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
    <AbsoluteFill style={{ backgroundColor: C.bg, fontFamily: "Inter, monospace" }}>
      <Audio src={staticFile("audio/narration.mp3")} />

      {/* Matrix rain bg */}
      <MatrixRain frame={frame} accent={cfg.accent} />

      {/* Scanline */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.03,
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, ${C.primary}08 2px, ${C.primary}08 4px)`,
      }} />

      {/* Progress */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `${C.muted}12` }}>
        <div style={{ height: "100%", width: `${(frame / durationInFrames) * 100}%`, background: `linear-gradient(90deg, ${C.primary}, ${C.secondary})` }} />
      </div>

      {/* Scene label */}
      <div style={{
        position: "absolute", top: 16, left: 20,
        display: "flex", alignItems: "center", gap: 8, opacity: 0.7,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.accent, boxShadow: `0 0 8px ${cfg.accent}` }} />
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 3, color: cfg.accent, fontFamily: "monospace" }}>
          {cfg.label}
        </span>
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
            background: `${active.speaker === "MAIN" ? C.primary : C.secondary}12`,
            border: `1px solid ${active.speaker === "MAIN" ? C.primary : C.secondary}22`,
          }}>
            <span style={{
              fontSize: 12, fontWeight: 800, letterSpacing: 2,
              color: active.speaker === "MAIN" ? C.primary : C.secondary, fontFamily: "monospace",
            }}>{active.character_name}</span>
          </div>
          <div style={{
            fontSize: 21, fontWeight: 600, color: `${C.text}dd`, lineHeight: 1.5,
            textShadow: `0 2px 12px ${C.bg}`,
          }}>{active.text}</div>
        </div>
      )}

      {/* Timestamp */}
      <div style={{
        position: "absolute", bottom: 16, right: 20,
        fontSize: 11, color: `${C.muted}66`, fontFamily: "monospace",
      }}>
        {Math.floor(frame / fps / 60)}:{String(Math.floor(frame / fps) % 60).padStart(2, "0")}
      </div>
    </AbsoluteFill>
  );
};

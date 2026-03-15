import React from "react";
import {
  AbsoluteFill,
  Audio,
  staticFile,
  useCurrentFrame,
  interpolate,
} from "remotion";
import timingData from "../public/audio/timing.json";

const C = {
  bg: "#07080f",
  surface: "#0f1117",
  primary: "#4fffff",
  secondary: "#a855f7",
  accent: "#22d3ee",
  text: "#f0f4ff",
  muted: "#6b7a99",
  green: "#34d399",
  red: "#f87171",
  orange: "#fb923c",
  yellow: "#fbbf24",
};

const FPS = 30;

interface TimingItem {
  scene: string;
  speaker: string;
  character_name: string;
  text: string;
  audioOffsetSec: number;
  durationSec: number;
}
const timing: TimingItem[] = timingData as TimingItem[];

function getActiveDialogue(frame: number): TimingItem | null {
  const t = frame / FPS;
  for (let i = timing.length - 1; i >= 0; i--) {
    const d = timing[i];
    if (t >= d.audioOffsetSec && t < d.audioOffsetSec + d.durationSec + 0.15) return d;
  }
  return null;
}

function getCurrentScene(frame: number): string {
  const t = frame / FPS;
  for (let i = timing.length - 1; i >= 0; i--) {
    if (t >= timing[i].audioOffsetSec) return timing[i].scene;
  }
  return "HookScene";
}

function getSceneProgress(frame: number, sceneName: string): number {
  const items = timing.filter((t) => t.scene === sceneName);
  if (!items.length) return 0;
  const start = items[0].audioOffsetSec;
  const last = items[items.length - 1];
  const end = last.audioOffsetSec + last.durationSec;
  const t = frame / FPS;
  return Math.max(0, Math.min(1, (t - start) / (end - start)));
}

// Which dialogue index within a scene (0-based)
function getSceneDialogueIndex(frame: number, sceneName: string): number {
  const items = timing.filter((t) => t.scene === sceneName);
  const t = frame / FPS;
  for (let i = items.length - 1; i >= 0; i--) {
    if (t >= items[i].audioOffsetSec) return i;
  }
  return 0;
}

const sf = (s: string) => Math.round((timing.find((t) => t.scene === s)?.audioOffsetSec ?? 0) * FPS);

/* ===== PARTICLES ===== */
const Particles: React.FC<{ color: string; count: number; frame: number; speed?: number }> = ({
  color, count, frame, speed = 1,
}) => {
  const dots = React.useMemo(() => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push({ x: (i * 137.5) % 100, y: (i * 97.3) % 100, size: 2 + (i % 4), phase: i * 0.7 });
    }
    return arr;
  }, [count]);
  return (
    <>
      {dots.map((d, i) => {
        const y = (d.y + frame * 0.02 * speed + d.phase * 10) % 110 - 5;
        const opacity = 0.12 + Math.sin(frame * 0.03 + d.phase) * 0.1;
        return (
          <div key={i} style={{
            position: "absolute", left: `${d.x}%`, top: `${y}%`,
            width: d.size, height: d.size, borderRadius: "50%",
            background: color, opacity,
          }} />
        );
      })}
    </>
  );
};

/* ===== ANIMATED COUNTER ===== */
const Counter: React.FC<{
  value: number; frame: number; start: number; dur?: number;
  suffix?: string; color?: string; size?: number;
}> = ({ value, frame, start, dur = 30, suffix = "", color = C.primary, size = 120 }) => {
  const p = interpolate(frame - start, [0, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <span style={{
      fontSize: size, fontWeight: 900, color,
      fontFamily: "Space Grotesk, sans-serif",
      textShadow: `0 0 40px ${color}55`,
    }}>{Math.round(value * p)}{suffix}</span>
  );
};

/* ===== DATA CARD ===== */
const DataCard: React.FC<{
  icon?: string; source: string; stat: string; detail: string;
  color: string; opacity: number; y?: number;
}> = ({ icon, source, stat, detail, color, opacity, y = 0 }) => (
  <div style={{
    background: `${C.surface}dd`, borderRadius: 16,
    padding: "24px 28px", border: `1px solid ${color}33`,
    boxShadow: `0 0 30px ${color}11`,
    opacity, transform: `translateY(${y}px)`,
    width: "100%",
  }}>
    <div style={{ fontSize: 14, color: C.muted, fontFamily: "JetBrains Mono, monospace", marginBottom: 6 }}>
      {icon && <span style={{ marginRight: 6 }}>{icon}</span>}{source}
    </div>
    <div style={{ fontSize: 36, fontWeight: 900, color, fontFamily: "Space Grotesk, sans-serif", marginBottom: 4 }}>
      {stat}
    </div>
    <div style={{ fontSize: 18, color: C.text, fontFamily: "Inter, sans-serif", lineHeight: 1.4 }}>
      {detail}
    </div>
  </div>
);

/* ===== SCENE GRADIENTS ===== */
const grads: Record<string, string[]> = {
  HookScene: ["#0a0e1a", "#0d1b2a", "#1b2838"],
  ConflictScene: ["#100a1e", "#1a0e2e", "#0d1b2a"],
  InvestigationScene: ["#0a1a1a", "#0d2626", "#071515"],
  TwistScene: ["#1a0520", "#2a0e3e", "#150720"],
  ResolutionScene: ["#0a1520", "#0d2030", "#071018"],
  OutroScene: ["#0a0e1a", "#0d1b2a", "#1b2838"],
};

/* ========== MAIN ========== */
export const MainVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const dialogue = getActiveDialogue(frame);
  const scene = getCurrentScene(frame);

  const isMain = dialogue?.speaker === "MAIN";
  const grad = grads[scene] || grads.HookScene;
  const bgShift = Math.sin(frame * 0.005) * 10;

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Audio src={staticFile("audio/narration.mp3")} />

      {/* BG gradient */}
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(${135 + bgShift}deg, ${grad[0]}, ${grad[1]}, ${grad[2]})` }} />

      {/* Grid */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.05,
        backgroundImage: `linear-gradient(${C.primary}40 1px, transparent 1px), linear-gradient(90deg, ${C.primary}40 1px, transparent 1px)`,
        backgroundSize: "80px 80px",
        transform: `translateY(${(frame * 0.3) % 80}px)`,
      }} />

      <Particles color={C.primary} count={18} frame={frame} speed={1} />
      <Particles color={C.secondary} count={10} frame={frame} speed={0.5} />

      {/* ====== HOOK ====== */}
      {scene === "HookScene" && (() => {
        const p = interpolate(frame - sf("HookScene"), [0, 25], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const idx = getSceneDialogueIndex(frame, "HookScene");
        const glowPulse = 0.4 + Math.sin(frame * 0.06) * 0.3;
        return (
          <>
            <div style={{
              position: "absolute", top: "30%", left: "50%", width: 500, height: 500, borderRadius: "50%",
              background: `radial-gradient(circle, ${C.red}${Math.round(glowPulse * 25).toString(16).padStart(2, "0")}, transparent 70%)`,
              transform: "translate(-50%, -50%)", filter: "blur(50px)",
            }} />
            <div style={{ position: "absolute", top: 80, left: 0, right: 0, textAlign: "center", opacity: p }}>
              <div style={{ fontSize: 22, color: C.red, fontFamily: "JetBrains Mono, monospace", letterSpacing: 3, marginBottom: 16 }}>
                METR STUDY 2025 — RANDOMIZED CONTROLLED TRIAL
              </div>
              <div style={{ fontSize: 60, fontWeight: 900, color: C.text, fontFamily: "Inter, sans-serif", lineHeight: 1.3 }}>
                Using AI Made You
              </div>
              <div style={{ display: "flex", justifyContent: "center", alignItems: "baseline", gap: 12, marginTop: 8 }}>
                <Counter value={19} frame={frame} start={sf("HookScene")} dur={40} suffix="%" color={C.red} size={140} />
                <span style={{ fontSize: 48, fontWeight: 900, color: C.text, fontFamily: "Inter, sans-serif" }}>SLOWER</span>
              </div>
              {/* Perception gap */}
              {idx >= 3 && (
                <div style={{
                  marginTop: 32, display: "inline-flex", gap: 40, padding: "20px 40px",
                  background: `${C.surface}cc`, borderRadius: 16, border: `1px solid ${C.orange}33`,
                  opacity: interpolate(frame - sf("HookScene"), [60, 80], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 14, color: C.muted, marginBottom: 4 }}>Self-Perception</div>
                    <div style={{ fontSize: 48, fontWeight: 900, color: C.green }}>+24%</div>
                    <div style={{ fontSize: 14, color: C.green }}>Felt Faster</div>
                  </div>
                  <div style={{ width: 2, background: `${C.muted}33` }} />
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 14, color: C.muted, marginBottom: 4 }}>Reality</div>
                    <div style={{ fontSize: 48, fontWeight: 900, color: C.red }}>-19%</div>
                    <div style={{ fontSize: 14, color: C.red }}>Actually Slower</div>
                  </div>
                  <div style={{ width: 2, background: `${C.muted}33` }} />
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 14, color: C.muted, marginBottom: 4 }}>Gap</div>
                    <div style={{ fontSize: 48, fontWeight: 900, color: C.orange }}>43pt</div>
                    <div style={{ fontSize: 14, color: C.orange }}>Perception Gap</div>
                  </div>
                </div>
              )}
            </div>
          </>
        );
      })()}

      {/* ====== CONFLICT ====== */}
      {scene === "ConflictScene" && (() => {
        const p = getSceneProgress(frame, "ConflictScene");
        const idx = getSceneDialogueIndex(frame, "ConflictScene");
        return (
          <>
            {/* Left: Copilot data */}
            <div style={{ position: "absolute", top: 50, left: 60, width: 520 }}>
              <div style={{ fontSize: 18, color: C.muted, fontFamily: "JetBrains Mono, monospace", letterSpacing: 2, marginBottom: 12 }}>
                GITHUB COPILOT RESEARCH
              </div>
              {/* Visual: big code percentage vs tiny quality */}
              <div style={{
                background: `${C.surface}cc`, borderRadius: 16, padding: 24,
                border: `1px solid ${C.primary}22`,
                opacity: interpolate(p, [0, 0.1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 24 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 80, fontWeight: 900, color: C.primary, fontFamily: "Space Grotesk" }}>46%</div>
                    <div style={{ fontSize: 16, color: C.muted }}>of code written by AI</div>
                  </div>
                  <div style={{ fontSize: 32, color: C.muted, marginBottom: 20 }}>→</div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 80, fontWeight: 900, color: C.orange, fontFamily: "Space Grotesk" }}>3.6%</div>
                    <div style={{ fontSize: 16, color: C.muted }}>quality improvement</div>
                  </div>
                </div>
                <div style={{ marginTop: 12, height: 8, borderRadius: 4, background: `${C.muted}22`, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "46%", background: C.primary, borderRadius: 4 }} />
                </div>
                <div style={{ marginTop: 6, height: 8, borderRadius: 4, background: `${C.muted}22`, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "3.6%", background: C.orange, borderRadius: 4 }} />
                </div>
              </div>
            </div>

            {/* Right: PwC CEO data */}
            <div style={{
              position: "absolute", top: 50, right: 60, width: 520,
              opacity: interpolate(p, [0.3, 0.45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            }}>
              <div style={{ fontSize: 18, color: C.muted, fontFamily: "JetBrains Mono, monospace", letterSpacing: 2, marginBottom: 12 }}>
                PwC 2026 — 4,454 CEOs
              </div>
              <div style={{
                background: `${C.surface}cc`, borderRadius: 16, padding: 24,
                border: `1px solid ${C.red}22`,
              }}>
                <div style={{ fontSize: 72, fontWeight: 900, color: C.red, fontFamily: "Space Grotesk", textAlign: "center" }}>56%</div>
                <div style={{ fontSize: 22, color: C.text, fontFamily: "Inter", textAlign: "center", marginTop: 4 }}>
                  of CEOs report <span style={{ color: C.red, fontWeight: 800 }}>ZERO return</span> on AI investment
                </div>
                {/* Pie visualization */}
                <div style={{ display: "flex", justifyContent: "center", marginTop: 16, gap: 24 }}>
                  {[
                    { pct: 56, label: "Zero", color: C.red },
                    { pct: 32, label: "Some ROI", color: C.orange },
                    { pct: 12, label: "Full ROI", color: C.green },
                  ].map((s) => (
                    <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 12, height: 12, borderRadius: "50%", background: s.color }} />
                      <span style={{ fontSize: 14, color: C.muted }}>{s.pct}% {s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom: question mark */}
            {idx >= 4 && (
              <div style={{
                position: "absolute", bottom: 200, left: "50%", transform: "translateX(-50%)",
                fontSize: 28, color: C.yellow, fontFamily: "Inter", fontWeight: 700,
                opacity: interpolate(p, [0.7, 0.85], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              }}>
                Why is this happening? → 3 Root Causes
              </div>
            )}
          </>
        );
      })()}

      {/* ====== INVESTIGATION ====== */}
      {scene === "InvestigationScene" && (() => {
        const p = getSceneProgress(frame, "InvestigationScene");
        const idx = getSceneDialogueIndex(frame, "InvestigationScene");
        // 9 dialogue items — cycle through different data visuals
        // 0-1: Workday 40%, 2-5: Email 2x + Brain Fry, 6-7: Brain Fry threshold, 8: Cognitive offloading
        const phase = idx <= 1 ? 0 : idx <= 4 ? 1 : idx <= 7 ? 2 : 3;
        return (
          <>
            <div style={{ fontSize: 16, color: C.accent, fontFamily: "JetBrains Mono, monospace", letterSpacing: 3, position: "absolute", top: 24, right: 40 }}>
              CAUSE {phase < 3 ? phase + 1 : 3} / 3{phase === 3 ? " + BONUS" : ""}
            </div>

            {/* Phase 0: Workday 40% */}
            {phase === 0 && (
              <div style={{
                position: "absolute", top: 60, left: 0, right: 0,
                display: "flex", flexDirection: "column", alignItems: "center",
                opacity: interpolate(p, [0, 0.05], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              }}>
                <div style={{ fontSize: 18, color: C.muted, fontFamily: "JetBrains Mono, monospace", marginBottom: 12 }}>WORKDAY 2026 RESEARCH</div>
                <div style={{ fontSize: 28, color: C.text, fontFamily: "Inter", marginBottom: 20 }}>
                  Where Does the "Saved" Time Actually Go?
                </div>
                {/* Stacked bar */}
                <div style={{ width: 800, height: 60, borderRadius: 12, display: "flex", overflow: "hidden", border: `1px solid ${C.muted}22` }}>
                  <div style={{ width: "60%", background: `linear-gradient(90deg, ${C.green}, ${C.accent})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: C.bg }}>60% Actually Saved</span>
                  </div>
                  <div style={{ width: "40%", background: `linear-gradient(90deg, ${C.red}cc, ${C.orange}cc)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>40% Lost to Review & Fixes</span>
                  </div>
                </div>
              </div>
            )}

            {/* Phase 1: AI Brain Fry */}
            {phase === 1 && (
              <div style={{
                position: "absolute", top: 50, left: 60, right: 60,
                opacity: interpolate(p, [0.15, 0.22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              }}>
                <div style={{ fontSize: 18, color: C.muted, fontFamily: "JetBrains Mono, monospace", marginBottom: 8 }}>BCG x HARVARD 2026 — 1,488 RESPONDENTS</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: C.orange, fontFamily: "Inter", marginBottom: 20 }}>
                  AI Brain Fry
                </div>
                <div style={{ display: "flex", gap: 20 }}>
                  {[
                    { stat: "+39%", label: "Critical Errors", color: C.red, icon: "\u26A0" },
                    { stat: "+33%", label: "Decision Fatigue", color: C.orange, icon: "\uD83E\uDDE0" },
                    { stat: "+19%", label: "Info Overload", color: C.yellow, icon: "\uD83D\uDCCA" },
                    { stat: "+14%", label: "Mental Strain", color: C.secondary, icon: "\uD83D\uDE35" },
                  ].map((d, i) => (
                    <div key={d.label} style={{
                      flex: 1, background: `${C.surface}cc`, borderRadius: 16, padding: "20px 16px",
                      border: `1px solid ${d.color}33`, textAlign: "center",
                      opacity: interpolate(p, [0.2 + i * 0.05, 0.25 + i * 0.05], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                      transform: `translateY(${interpolate(p, [0.2 + i * 0.05, 0.25 + i * 0.05], [20, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
                    }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>{d.icon}</div>
                      <div style={{ fontSize: 40, fontWeight: 900, color: d.color, fontFamily: "Space Grotesk" }}>{d.stat}</div>
                      <div style={{ fontSize: 16, color: C.text, fontFamily: "Inter", marginTop: 4 }}>{d.label}</div>
                    </div>
                  ))}
                </div>
                {/* Threshold */}
                <div style={{
                  marginTop: 20, textAlign: "center", padding: "12px 24px",
                  background: `${C.red}11`, borderRadius: 8, border: `1px solid ${C.red}22`,
                  opacity: interpolate(p, [0.35, 0.42], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                }}>
                  <span style={{ fontSize: 22, color: C.text, fontFamily: "Inter" }}>
                    Productivity reverses at <span style={{ color: C.red, fontWeight: 900, fontSize: 28 }}>4+ AI tools</span>
                  </span>
                </div>
              </div>
            )}

            {/* Phase 2: Context Switch */}
            {phase === 2 && (
              <div style={{
                position: "absolute", top: 50, left: 60, right: 60,
                opacity: interpolate(p, [0.45, 0.52], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              }}>
                <div style={{ fontSize: 18, color: C.muted, fontFamily: "JetBrains Mono, monospace", marginBottom: 8 }}>CONTEXT SWITCHING RESEARCH</div>
                <div style={{ display: "flex", gap: 32, justifyContent: "center" }}>
                  {[
                    { value: "9.5", unit: "min", desc: "Focus Recovery Time", color: C.orange },
                    { value: "1,200", unit: "x/day", desc: "App Switches per Day", color: C.red },
                    { value: "3.2", unit: "hrs", desc: "Lost in 8-Hour Day", color: C.red },
                  ].map((d, i) => (
                    <div key={d.desc} style={{
                      flex: 1, textAlign: "center", background: `${C.surface}cc`, borderRadius: 16,
                      padding: 24, border: `1px solid ${d.color}22`,
                      opacity: interpolate(p, [0.5 + i * 0.04, 0.55 + i * 0.04], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                    }}>
                      <div style={{ fontSize: 56, fontWeight: 900, color: d.color, fontFamily: "Space Grotesk" }}>
                        {d.value}<span style={{ fontSize: 24 }}>{d.unit}</span>
                      </div>
                      <div style={{ fontSize: 18, color: C.text, fontFamily: "Inter", marginTop: 8 }}>{d.desc}</div>
                    </div>
                  ))}
                </div>
                {/* Timeline bar showing 8 hours */}
                <div style={{ marginTop: 24, padding: "0 40px" }}>
                  <div style={{ fontSize: 16, color: C.muted, marginBottom: 8 }}>8-Hour Workday Breakdown</div>
                  <div style={{ height: 40, borderRadius: 8, display: "flex", overflow: "hidden" }}>
                    <div style={{ width: "40%", background: `linear-gradient(90deg, ${C.red}cc, ${C.orange}cc)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>3.2h Switching Loss</span>
                    </div>
                    <div style={{ width: "60%", background: `${C.green}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: C.green }}>4.8h Actual Work</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Phase 3: Security */}
            {phase === 3 && (
              <div style={{
                position: "absolute", top: 50, left: 60, right: 60,
                opacity: interpolate(p, [0.65, 0.72], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              }}>
                <div style={{ fontSize: 18, color: C.red, fontFamily: "JetBrains Mono, monospace", letterSpacing: 2, marginBottom: 8 }}>
                  ⚠ VERACODE 2025 SECURITY REPORT
                </div>
                <div style={{ fontSize: 32, fontWeight: 900, color: C.text, fontFamily: "Inter", marginBottom: 20 }}>
                  Security Flaw Rate in AI-Generated Code
                </div>
                <div style={{ display: "flex", gap: 24 }}>
                  {/* Bar chart of vulnerability rates */}
                  {[
                    { lang: "Overall", pct: 45, color: C.orange },
                    { lang: "Java", pct: 72, color: C.red },
                    { lang: "XSS Vuln.", pct: 86, color: C.red },
                    { lang: "Log Inject.", pct: 88, color: C.red },
                  ].map((d, i) => {
                    const barP = interpolate(p, [0.72 + i * 0.03, 0.78 + i * 0.03], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
                    return (
                      <div key={d.lang} style={{ flex: 1, textAlign: "center" }}>
                        {/* Vertical bar */}
                        <div style={{ height: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center" }}>
                          <div style={{
                            width: 80, borderRadius: "8px 8px 0 0",
                            height: `${d.pct * barP * 2}px`,
                            background: `linear-gradient(to top, ${d.color}, ${d.color}88)`,
                            boxShadow: `0 0 20px ${d.color}33`,
                          }} />
                        </div>
                        <div style={{ fontSize: 28, fontWeight: 900, color: d.color, fontFamily: "Space Grotesk", marginTop: 8 }}>
                          {Math.round(d.pct * barP)}%
                        </div>
                        <div style={{ fontSize: 16, color: C.text, fontFamily: "Inter" }}>{d.lang}</div>
                      </div>
                    );
                  })}
                </div>
                {/* Note */}
                <div style={{
                  marginTop: 16, textAlign: "center", fontSize: 20, color: C.yellow,
                  opacity: interpolate(p, [0.88, 0.95], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                }}>
                  Newer models don't improve security — Veracode
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* ====== TWIST ====== */}
      {scene === "TwistScene" && (() => {
        const p = getSceneProgress(frame, "TwistScene");
        const idx = getSceneDialogueIndex(frame, "TwistScene");
        return (
          <>
            {/* Klarna case */}
            {idx <= 2 && (
              <div style={{
                position: "absolute", top: 50, left: 80, right: 80,
                opacity: interpolate(p, [0, 0.08], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              }}>
                <div style={{ fontSize: 18, color: C.muted, fontFamily: "JetBrains Mono, monospace", letterSpacing: 2 }}>CASE STUDY</div>
                <div style={{ fontSize: 44, fontWeight: 900, color: C.text, fontFamily: "Space Grotesk", marginTop: 8 }}>
                  Klarna
                </div>
                <div style={{ display: "flex", gap: 24, marginTop: 24 }}>
                  <div style={{ flex: 1, background: `${C.surface}cc`, borderRadius: 16, padding: 24, border: `1px solid ${C.muted}22` }}>
                    <div style={{ fontSize: 56, fontWeight: 900, color: C.secondary, fontFamily: "Space Grotesk" }}>700</div>
                    <div style={{ fontSize: 20, color: C.text, fontFamily: "Inter" }}>Support staff replaced by AI</div>
                  </div>
                  <div style={{ fontSize: 48, color: C.muted, alignSelf: "center" }}>→</div>
                  <div style={{ flex: 1, background: `${C.surface}cc`, borderRadius: 16, padding: 24, border: `1px solid ${C.red}33` }}>
                    <div style={{ fontSize: 56, fontWeight: 900, color: C.red, fontFamily: "Space Grotesk" }}>-22%</div>
                    <div style={{ fontSize: 20, color: C.text, fontFamily: "Inter" }}>Customer satisfaction dropped</div>
                  </div>
                  <div style={{ fontSize: 48, color: C.muted, alignSelf: "center" }}>→</div>
                  <div style={{ flex: 1, background: `${C.surface}cc`, borderRadius: 16, padding: 24, border: `1px solid ${C.green}33` }}>
                    <div style={{ fontSize: 56, fontWeight: 900, color: C.green, fontFamily: "Space Grotesk" }}>Rehired</div>
                    <div style={{ fontSize: 20, color: C.text, fontFamily: "Inter" }}>Brought humans back</div>
                  </div>
                </div>
                {/* CEO quote */}
                <div style={{
                  marginTop: 24, padding: "16px 28px", background: `${C.surface}cc`,
                  borderRadius: 12, borderLeft: `4px solid ${C.orange}`,
                  opacity: interpolate(p, [0.15, 0.25], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                }}>
                  <div style={{ fontSize: 18, color: C.orange, fontStyle: "italic", fontFamily: "Inter" }}>
                    "We over-indexed on cost savings. And quality suffered." — CEO Sebastian Siemiatkowski
                  </div>
                </div>
              </div>
            )}

            {/* MIT + BCG stats */}
            {idx >= 3 && (
              <div style={{
                position: "absolute", top: 50, left: 80, right: 80,
                opacity: interpolate(p, [0.5, 0.58], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              }}>
                <div style={{ display: "flex", gap: 32 }}>
                  <div style={{ flex: 1, background: `${C.surface}cc`, borderRadius: 20, padding: 32, border: `1px solid ${C.red}33`, textAlign: "center" }}>
                    <div style={{ fontSize: 16, color: C.muted, fontFamily: "JetBrains Mono, monospace" }}>MIT REPORT</div>
                    <div style={{ fontSize: 100, fontWeight: 900, color: C.red, fontFamily: "Space Grotesk", marginTop: 8 }}>95%</div>
                    <div style={{ fontSize: 22, color: C.text, fontFamily: "Inter" }}>of AI projects fail to<br/>deliver ROI within 6 months</div>
                  </div>
                  <div style={{ flex: 1, background: `${C.surface}cc`, borderRadius: 20, padding: 32, border: `1px solid ${C.green}33`, textAlign: "center" }}>
                    <div style={{ fontSize: 16, color: C.muted, fontFamily: "JetBrains Mono, monospace" }}>BCG STUDY</div>
                    <div style={{ fontSize: 100, fontWeight: 900, color: C.green, fontFamily: "Space Grotesk", marginTop: 8 }}>5%</div>
                    <div style={{ fontSize: 22, color: C.text, fontFamily: "Inter" }}>actually create major value<br/><span style={{ color: C.primary }}>Key: Selective AI deployment</span></div>
                  </div>
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* ====== RESOLUTION ====== */}
      {scene === "ResolutionScene" && (() => {
        const p = getSceneProgress(frame, "ResolutionScene");
        const rules = [
          { num: "01", icon: "\uD83D\uDD27", title: "Max 3 AI Tools", detail: "4+ tools → Brain Fry\nCritical errors +39%", color: C.primary, source: "BCG 2026" },
          { num: "02", icon: "\u23F1", title: "Skip If Review > Task", detail: "40% of saved time\ngoes to verification", color: C.accent, source: "Workday 2026" },
          { num: "03", icon: "\uD83D\uDD12", title: "Humans Own Security", detail: "45% of AI code has flaws\nNewer models don't help", color: C.red, source: "Veracode 2025" },
        ];
        return (
          <>
            <div style={{ position: "absolute", top: 40, left: 0, right: 0, textAlign: "center" }}>
              <div style={{ fontSize: 18, color: C.muted, fontFamily: "Space Grotesk", letterSpacing: 4 }}>CONCLUSION</div>
              <div style={{ fontSize: 40, fontWeight: 900, color: C.text, fontFamily: "Inter", marginTop: 4 }}>
                3 Rules to Join the Top 5%
              </div>
            </div>
            <div style={{ position: "absolute", top: 140, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 28, padding: "0 60px" }}>
              {rules.map((r, i) => {
                const cp = interpolate(p, [i * 0.12, i * 0.12 + 0.12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
                return (
                  <div key={r.num} style={{
                    width: 380, background: `${C.surface}dd`, borderRadius: 20, padding: "28px 24px",
                    border: `1px solid ${r.color}33`, boxShadow: `0 0 30px ${r.color}11`,
                    opacity: cp, transform: `translateY(${(1 - cp) * 30}px)`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                      <div style={{ fontSize: 28, fontWeight: 900, color: r.color, fontFamily: "Space Grotesk" }}>{r.num}</div>
                      <div style={{ fontSize: 36 }}>{r.icon}</div>
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: r.color, fontFamily: "Inter", marginBottom: 8 }}>{r.title}</div>
                    <div style={{ fontSize: 20, color: C.text, fontFamily: "Inter", whiteSpace: "pre-line", lineHeight: 1.5 }}>{r.detail}</div>
                    <div style={{ fontSize: 12, color: C.muted, fontFamily: "JetBrains Mono, monospace", marginTop: 8 }}>Source: {r.source}</div>
                  </div>
                );
              })}
            </div>
          </>
        );
      })()}

      {/* ====== OUTRO ====== */}
      {scene === "OutroScene" && (() => {
        const p = getSceneProgress(frame, "OutroScene");
        const bellRot = Math.sin(frame * 0.2) * 12;
        return (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{
              width: 80, height: 80, borderRadius: 16,
              background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 36, fontWeight: 900, color: C.bg, fontFamily: "Space Grotesk, sans-serif",
              marginBottom: 20, boxShadow: `0 0 40px ${C.primary}44`,
            }}>A0</div>
            <div style={{ fontSize: 20, color: C.muted, fontFamily: "Space Grotesk", letterSpacing: 6, marginBottom: 28 }}>AGENT ZERO</div>
            <div style={{ fontSize: 40, fontWeight: 900, color: C.text, fontFamily: "Inter", marginBottom: 36 }}>
              Testing AI Claims with Data — Every Week
            </div>
            <div style={{ display: "flex", gap: 24, alignItems: "center", marginBottom: 40 }}>
              <div style={{
                background: "#ff0000", borderRadius: 8, padding: "14px 44px",
                fontSize: 26, fontWeight: 800, color: "#fff", fontFamily: "Inter",
                boxShadow: "0 0 20px #ff000044",
              }}>SUBSCRIBE</div>
              <div style={{ fontSize: 44, transform: `rotate(${bellRot}deg)` }}>🔔</div>
            </div>
            <div style={{
              opacity: interpolate(p, [0.3, 0.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              background: `${C.surface}cc`, borderRadius: 12, padding: "16px 32px", border: `1px solid ${C.muted}22`,
            }}>
              <span style={{ fontSize: 18, color: C.muted }}>Next → </span>
              <span style={{ fontSize: 20, color: C.text, fontFamily: "Inter" }}>
                AI recommends fake libraries 20% of the time — the dark side of slopsquatting
              </span>
            </div>
          </div>
        );
      })()}

      {/* ===== BRANDING ===== */}
      <div style={{ position: "absolute", top: 24, left: 32, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, fontWeight: 900, color: C.bg, fontFamily: "Space Grotesk",
        }}>A0</div>
        <span style={{ fontSize: 16, color: C.muted, fontFamily: "Space Grotesk", fontWeight: 600, letterSpacing: 2 }}>AGENT ZERO</span>
      </div>

      {/* ===== CHARACTERS ===== */}
      {["ZERO", "NOVA"].map((name) => {
        const isSpeaking = dialogue?.character_name === name;
        const color = name === "ZERO" ? C.primary : C.secondary;
        const side = name === "ZERO" ? "left" : "right";
        return (
          <div key={name} style={{
            position: "absolute", bottom: 120,
            [side]: 50,
            display: "flex", flexDirection: "column", alignItems: "center",
            transform: `scale(${isSpeaking ? 1.12 : 0.9})`, opacity: isSpeaking ? 1 : 0.35,
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              background: `radial-gradient(circle at 30% 30%, ${color}66, ${color}11)`,
              border: `3px solid ${color}`,
              boxShadow: isSpeaking ? `0 0 24px ${color}66` : "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, fontWeight: 800, color: C.text, fontFamily: "Space Grotesk",
            }}>{name[0]}</div>
            <div style={{ marginTop: 5, fontSize: 13, fontWeight: 700, color, fontFamily: "Space Grotesk", letterSpacing: 2 }}>{name}</div>
          </div>
        );
      })}

      {/* ===== DIALOGUE BAR ===== */}
      {dialogue && (
        <div style={{
          position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)",
          maxWidth: 1400, width: "82%", textAlign: "center",
        }}>
          <div style={{
            background: `${C.surface}ee`, borderRadius: 12, padding: "10px 24px",
            border: `1px solid ${(dialogue.speaker === "MAIN" ? C.primary : C.secondary)}33`,
            boxShadow: `0 4px 30px ${C.bg}88`,
          }}>
            <span style={{
              fontSize: 12, fontWeight: 700, letterSpacing: 2,
              color: dialogue.speaker === "MAIN" ? C.primary : C.secondary,
              fontFamily: "Space Grotesk", display: "block", marginBottom: 2,
            }}>{dialogue.character_name}</span>
            <span style={{
              fontSize: 28, color: C.text, fontWeight: 500,
              fontFamily: "Inter", lineHeight: 1.4,
            }}>{dialogue.text}</span>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

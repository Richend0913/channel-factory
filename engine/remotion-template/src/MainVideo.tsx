import React from "react";
import {
  AbsoluteFill,
  Audio,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import timingData from "../public/audio/timing.json";
import scriptData from "../public/audio/script.json";

/* ===== CHANNEL COLORS (replace per-channel) ===== */
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

/* ===== SCENE GRADIENT MAP ===== */
const SCENE_GRADIENTS: Record<string, [string, string]> = {
  HookScene: [C.background, C.primary],
  ConflictScene: [C.background, C.red],
  InvestigationScene: [C.background, C.blue],
  TwistScene: [C.background, C.purple],
  ResolutionScene: [C.background, C.green],
  OutroScene: [C.background, C.primary],
};

const SCENE_LABELS: Record<string, string> = {
  HookScene: "HOOK",
  ConflictScene: "CONFLICT",
  InvestigationScene: "INVESTIGATION",
  TwistScene: "TWIST",
  ResolutionScene: "RESOLUTION",
  OutroScene: "OUTRO",
};

/* ===== HELPERS ===== */
function getActiveDialogue(frame: number, fps: number): TimingItem | null {
  const t = frame / fps;
  for (let i = timing.length - 1; i >= 0; i--) {
    const d = timing[i];
    if (t >= d.audioOffsetSec && t < d.audioOffsetSec + d.durationSec + 0.15)
      return d;
  }
  return null;
}

function getCurrentScene(frame: number, fps: number): string {
  const t = frame / fps;
  for (let i = timing.length - 1; i >= 0; i--) {
    if (t >= timing[i].audioOffsetSec) return timing[i].scene;
  }
  return timing[0]?.scene ?? "HookScene";
}

function getSceneStartFrame(sceneName: string, fps: number): number {
  const item = timing.find((t) => t.scene === sceneName);
  return item ? Math.round(item.audioOffsetSec * fps) : 0;
}

function getSceneProgress(frame: number, sceneName: string, fps: number): number {
  const items = timing.filter((t) => t.scene === sceneName);
  if (!items.length) return 0;
  const start = items[0].audioOffsetSec;
  const last = items[items.length - 1];
  const end = last.audioOffsetSec + last.durationSec;
  const t = frame / fps;
  return Math.max(0, Math.min(1, (t - start) / (end - start)));
}

/* ===== PARTICLES ===== */
const Particles: React.FC<{
  color: string; count: number; frame: number; speed?: number;
}> = ({ color, count, frame, speed = 1 }) => {
  const dots = React.useMemo(() => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        x: (i * 137.5) % 100,
        y: (i * 97.3) % 100,
        size: 2 + (i % 4),
        phase: i * 0.7,
      });
    }
    return arr;
  }, [count]);
  return (
    <>
      {dots.map((d, i) => {
        const y = (d.y + frame * 0.02 * speed + d.phase * 10) % 110 - 5;
        const opacity = 0.12 + Math.sin(frame * 0.03 + d.phase) * 0.08;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${d.x}%`,
              top: `${y}%`,
              width: d.size,
              height: d.size,
              borderRadius: "50%",
              background: color,
              opacity,
            }}
          />
        );
      })}
    </>
  );
};

/* ===== MAIN VIDEO ===== */
export const MainVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dialogue = getActiveDialogue(frame, fps);
  const scene = getCurrentScene(frame, fps);
  const sceneStart = getSceneStartFrame(scene, fps);
  const sceneProgress = getSceneProgress(frame, scene, fps);

  const grad = SCENE_GRADIENTS[scene] ?? SCENE_GRADIENTS.HookScene;
  const sceneLabel = SCENE_LABELS[scene] ?? "";
  const bgAngle = 135 + Math.sin(frame * 0.005) * 10;

  /* scene transition fade */
  const localFrame = frame - sceneStart;
  const fadeIn = interpolate(localFrame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* dialogue text entrance */
  const dialogueSpring = dialogue
    ? spring({ frame: localFrame, fps, config: { damping: 18, stiffness: 120 } })
    : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: C.background, fontFamily: "Inter, sans-serif" }}>
      <Audio src={staticFile("audio/narration.mp3")} />

      {/* Gradient background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(${bgAngle}deg, ${grad[0]} 0%, ${grad[1]}33 60%, ${grad[0]} 100%)`,
          opacity: fadeIn,
        }}
      />

      {/* Scrolling grid overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.04,
          backgroundImage: `linear-gradient(${C.primary}40 1px, transparent 1px), linear-gradient(90deg, ${C.primary}40 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
          transform: `translateY(${(frame * 0.3) % 80}px)`,
        }}
      />

      {/* Particles */}
      <Particles color={C.primary} count={18} frame={frame} speed={1} />
      <Particles color={C.secondary} count={10} frame={frame} speed={0.5} />

      {/* Radial glow tied to scene color */}
      <div
        style={{
          position: "absolute",
          top: "35%",
          left: "50%",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${grad[1]}18, transparent 70%)`,
          transform: "translate(-50%, -50%)",
          filter: "blur(60px)",
          opacity: 0.5 + Math.sin(frame * 0.04) * 0.3,
        }}
      />

      {/* Scene label */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: interpolate(localFrame, [0, 20], [0, 0.6], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: grad[1],
            letterSpacing: 6,
            fontFamily: "Inter, sans-serif",
          }}
        >
          {sceneLabel}
        </div>
      </div>

      {/* Current dialogue text (large, centered) */}
      {dialogue && (
        <div
          style={{
            position: "absolute",
            top: "22%",
            left: "10%",
            right: "10%",
            textAlign: "center",
            opacity: interpolate(sceneProgress, [0, 0.03], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <div
            style={{
              fontSize: 44,
              fontWeight: 700,
              color: C.text,
              lineHeight: 1.45,
              fontFamily: "Inter, sans-serif",
              textShadow: `0 2px 30px ${C.background}cc`,
              maxWidth: 1200,
              margin: "0 auto",
            }}
          >
            {dialogue.text}
          </div>
        </div>
      )}

      {/* Speaker avatars */}
      {(() => {
        const speakers = Array.from(
          new Set(timing.map((t) => t.character_name))
        );
        return speakers.map((name, idx) => {
          const isSpeaking = dialogue?.character_name === name;
          const color = idx === 0 ? C.primary : C.secondary;
          const side = idx === 0 ? 50 : undefined;
          const right = idx !== 0 ? 50 : undefined;
          return (
            <div
              key={name}
              style={{
                position: "absolute",
                bottom: 120,
                ...(side !== undefined ? { left: side } : {}),
                ...(right !== undefined ? { right } : {}),
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                transform: `scale(${isSpeaking ? 1.1 : 0.85})`,
                opacity: isSpeaking ? 1 : 0.3,
                transition: "transform 0.2s, opacity 0.2s",
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: `radial-gradient(circle at 30% 30%, ${color}66, ${color}11)`,
                  border: `3px solid ${color}`,
                  boxShadow: isSpeaking ? `0 0 24px ${color}66` : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 26,
                  fontWeight: 800,
                  color: C.text,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {name[0]}
              </div>
              <div
                style={{
                  marginTop: 5,
                  fontSize: 12,
                  fontWeight: 700,
                  color,
                  fontFamily: "Inter, sans-serif",
                  letterSpacing: 2,
                }}
              >
                {name}
              </div>
            </div>
          );
        });
      })()}

      {/* Dialogue bar at bottom */}
      {dialogue && (
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            maxWidth: 1400,
            width: "82%",
            textAlign: "center",
          }}
        >
          <div
            style={{
              background: `${C.surface}ee`,
              borderRadius: 12,
              padding: "10px 24px",
              border: `1px solid ${dialogue.speaker === "MAIN" ? C.primary : C.secondary}33`,
              boxShadow: `0 4px 30px ${C.background}88`,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 2,
                color:
                  dialogue.speaker === "MAIN" ? C.primary : C.secondary,
                fontFamily: "Inter, sans-serif",
                display: "block",
                marginBottom: 2,
              }}
            >
              {dialogue.character_name}
            </span>
            <span
              style={{
                fontSize: 26,
                color: C.text,
                fontWeight: 500,
                fontFamily: "Inter, sans-serif",
                lineHeight: 1.4,
              }}
            >
              {dialogue.text}
            </span>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

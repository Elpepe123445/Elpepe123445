import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

const FONT = "Inter, DejaVu Sans, sans-serif";
const MONO = "DejaVu Sans Mono, monospace";

/**
 * HUD de primera persona para la serie POV: esquinas de visor, etiqueta POV,
 * indicadores de estado y viñeta. Se dibuja encima de la escena 3D.
 */
export const PovHud: React.FC<{
  title: string;
  accent: string;
  /** Indicadores (p. ej. "O₂ 100 %"); `value` 0-1 dibuja una barra. */
  stats?: { label: string; text: string; value?: number; color?: string }[];
  /** Golpe de pantalla (0-1) para latidos o impactos. */
  shake?: number;
}> = ({ title, accent, stats = [], shake = 0 }) => {
  const frame = useCurrentFrame();
  const corner = (rot: number, style: React.CSSProperties) => (
    <div
      style={{
        position: "absolute",
        width: 90,
        height: 90,
        borderTop: `5px solid ${accent}`,
        borderLeft: `5px solid ${accent}`,
        rotate: `${rot}deg`,
        opacity: 0.85,
        ...style,
      }}
    />
  );
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        translate: `${Math.sin(frame * 2.1) * shake * 10}px ${Math.cos(frame * 1.7) * shake * 10}px`,
      }}
    >
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, transparent 48%, rgba(0,0,0,0.6) 100%)",
        }}
      />
      {corner(0, { left: 50, top: 170 })}
      {corner(90, { right: 50, top: 170 })}
      {corner(-90, { left: 50, bottom: 520 })}
      {corner(180, { right: 50, bottom: 520 })}
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 70,
          display: "flex",
          alignItems: "center",
          gap: 16,
          fontFamily: FONT,
        }}
      >
        <span
          style={{
            background: accent,
            color: "#0B0B10",
            fontWeight: 900,
            fontSize: 34,
            padding: "6px 16px",
            borderRadius: 10,
            letterSpacing: "0.06em",
          }}
        >
          POV
        </span>
        <span
          style={{
            color: "#FFFFFF",
            fontWeight: 800,
            fontSize: 34,
            textShadow: "0 2px 12px rgba(0,0,0,0.7)",
          }}
        >
          {title}
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          right: 60,
          top: 80,
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontFamily: MONO,
          color: "#FF4D5E",
          fontSize: 26,
          opacity: frame % 30 < 18 ? 1 : 0.35,
        }}
      >
        ● REC
      </div>
      <div
        style={{
          position: "absolute",
          left: 70,
          top: 280,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {stats.map((s) => (
          <div
            key={s.label}
            style={{
              fontFamily: MONO,
              color: "#FFFFFF",
              textShadow: "0 2px 10px rgba(0,0,0,0.8)",
            }}
          >
            <div
              style={{ fontSize: 22, opacity: 0.75, letterSpacing: "0.14em" }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontSize: 40,
                fontWeight: 700,
                color: s.color ?? accent,
              }}
            >
              {s.text}
            </div>
            {s.value !== undefined ? (
              <div
                style={{
                  width: 260,
                  height: 10,
                  borderRadius: 5,
                  background: "rgba(255,255,255,0.18)",
                  marginTop: 6,
                }}
              >
                <div
                  style={{
                    width: 260 * Math.max(0, Math.min(1, s.value)),
                    height: 10,
                    borderRadius: 5,
                    background: s.color ?? accent,
                  }}
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

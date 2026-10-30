import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, fmt, fonts, prog } from "../engine/theme";

export type Bar = {
  label: string;
  sub?: string;
  value: number;
  color: string;
  /** Fotograma (local) en que la barra empieza a crecer. */
  start: number;
  /** Medalla junto a la cifra; `start` (opcional) la retrasa hasta un momento de la narración. */
  badge?: { text: string; color: string; start?: number };
};

type Props = {
  bars: Bar[];
  max: number;
  unit: string;
  ticks: number[];
  width?: number;
  barHeight?: number;
  /** Línea de referencia vertical (p. ej. el valor moderno). */
  reference?: { value: number; label: string; start: number };
};

/** Gráfico de barras horizontal animado: barras con `spring`, cifras que cuentan y medallas. */
export const BarChart: React.FC<Props> = ({
  bars,
  max,
  unit,
  ticks,
  width = 1080,
  barHeight = 92,
  reference,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const labelW = 470;
  const x = (v: number) => (v / max) * width;
  const gap = 58;
  const h = bars.length * (barHeight + gap);
  const axisIn = prog(frame, (bars[0]?.start ?? 0) - 20, 30);

  return (
    <div
      style={{
        position: "relative",
        width: labelW + width + 260,
        height: h + 70,
        fontFamily: fonts.body,
      }}
    >
      {ticks.map((t) => (
        <div
          key={t}
          style={{
            position: "absolute",
            left: labelW + x(t),
            top: 0,
            height: h,
            width: 1,
            background: C.line,
            opacity: axisIn,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: h + 14,
              left: -60,
              width: 120,
              textAlign: "center",
              color: C.muted,
              fontSize: 26,
            }}
          >
            {fmt(t)}
          </div>
        </div>
      ))}
      <div
        style={{
          position: "absolute",
          left: labelW + width + 80,
          top: h + 14,
          color: C.muted,
          fontSize: 26,
          opacity: axisIn,
        }}
      >
        {unit}
      </div>
      {bars.map((b, i) => {
        const s = spring({
          frame: frame - b.start,
          fps,
          config: { damping: 22, mass: 0.9, stiffness: 90 },
        });
        const shown = frame >= b.start ? s : 0;
        const top = i * (barHeight + gap);
        const labelIn = prog(frame, b.start - 8, 18);
        const badgeAt = b.badge?.start ?? b.start + 28;
        const badgeIn =
          b.badge && frame >= badgeAt
            ? spring({ frame: frame - badgeAt, fps, config: { damping: 12 } })
            : 0;
        return (
          <div
            key={b.label}
            style={{
              position: "absolute",
              left: 0,
              top,
              height: barHeight,
              width: "100%",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                width: labelW - 36,
                textAlign: "right",
                top: 6,
                opacity: labelIn,
              }}
            >
              <div style={{ color: C.text, fontSize: 36, fontWeight: 600 }}>
                {b.label}
              </div>
              {b.sub ? (
                <div style={{ color: C.muted, fontSize: 26, marginTop: 4 }}>
                  {b.sub}
                </div>
              ) : null}
            </div>
            <div
              style={{
                position: "absolute",
                left: labelW,
                top: 0,
                height: barHeight,
                width: Math.max(0, x(b.value) * shown),
                background: `linear-gradient(90deg, ${b.color}55, ${b.color})`,
                borderRadius: "0 10px 10px 0",
                boxShadow: `0 0 40px ${b.color}44`,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: labelW + x(b.value) * shown + 22,
                top: barHeight / 2 - 26,
                color: C.text,
                fontSize: 46,
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                opacity: labelIn,
                whiteSpace: "nowrap",
              }}
            >
              {fmt(b.value * shown)}
              {b.badge ? (
                <span
                  style={{
                    marginLeft: 20,
                    fontSize: 30,
                    padding: "6px 16px",
                    borderRadius: 30,
                    color: C.night,
                    background: b.badge.color,
                    display: "inline-block",
                    scale: String(badgeIn),
                    verticalAlign: "middle",
                  }}
                >
                  {b.badge.text}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
      {reference ? (
        <div
          style={{
            position: "absolute",
            left: labelW + x(reference.value),
            top: -30,
            height: (h + 30) * prog(frame, reference.start, 24),
            borderLeft: `3px dashed ${C.cyan}`,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -40,
              left: -200,
              width: 400,
              textAlign: "center",
              color: C.cyan,
              fontSize: 28,
              fontWeight: 600,
              opacity: prog(frame, reference.start + 10, 16),
            }}
          >
            {reference.label}
          </div>
        </div>
      ) : null}
    </div>
  );
};

import React from "react";
import {
  AbsoluteFill,
  random,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Starfield } from "../../components/Atmosphere";
import { faceLon, Globe3D, SurfaceMarker } from "../../components/Globe3D";
import { fmt, inOut, mix, prog } from "../../engine/theme";
import { useCues } from "../../engine/timeline";
import { GROUND_ZERO, TSAR } from "./data";
import { heavy, mono, Scanlines, T, Tech } from "./style";

const NO_HIGHLIGHT: string[] = [];

/** Barra de potencia (megatones) que se puede cortar por la mitad o duplicar. */
export const PowerBar: React.FC<{
  y: number;
  cut: number;
  fall: number;
  ghost?: number;
}> = ({ y, cut, fall, ghost = 0 }) => {
  const x0 = 90;
  const w = 900;
  const h = 120;
  return (
    <svg
      width={1080}
      height={y + h + 500}
      style={{ position: "absolute", left: 0, top: 0 }}
    >
      <defs>
        <linearGradient id="fireBar" x1="0" x2="1">
          <stop offset="0%" stopColor="#7A1E0A" />
          <stop offset="60%" stopColor={T.fire} />
          <stop offset="100%" stopColor={T.ember} />
        </linearGradient>
      </defs>
      <rect x={x0} y={y} width={w / 2} height={h} rx={6} fill="url(#fireBar)" />
      <g
        transform={`translate(0 ${fall * 420}) rotate(${fall * 16} ${x0 + w * 0.75} ${y + h / 2})`}
        opacity={1 - fall}
      >
        <rect
          x={x0 + w / 2}
          y={y}
          width={w / 2}
          height={h}
          rx={6}
          fill="url(#fireBar)"
        />
      </g>
      {ghost > 0 ? (
        <rect
          x={x0 + w / 2}
          y={y}
          width={(w / 2) * ghost}
          height={h}
          rx={6}
          fill="none"
          stroke={T.ember}
          strokeWidth={4}
          strokeDasharray="16 12"
        />
      ) : null}
      <line
        x1={x0 + w / 2}
        y1={y - 50}
        x2={x0 + w / 2}
        y2={y - 50 + (h + 100) * cut}
        stroke={T.red}
        strokeWidth={6}
      />
    </svg>
  );
};

/** 1 · «Tan potente que la probaron a media potencia». */
export const ZHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = useCues();
  const at = c.word("z1", "media");
  const cut = prog(frame, at - 6, 12);
  const fall = prog(frame, at + 6, 30, inOut);
  const title = spring({ frame: frame - 4, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, #121B26 0%, #05080C 70%)",
      }}
    >
      <Tech
        style={{
          position: "absolute",
          top: 210,
          left: 0,
          right: 0,
          textAlign: "center",
          color: T.red,
          fontSize: 32,
          opacity: title,
        }}
      >
        ● archivo · URSS · 1961
      </Tech>
      <div
        style={{
          position: "absolute",
          top: 300,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: heavy,
          fontWeight: 900,
          fontSize: 150,
          lineHeight: 0.95,
          color: T.ice,
          letterSpacing: `${(1 - title) * 0.25}em`,
          opacity: title,
          textShadow: "0 0 60px rgba(207,227,242,0.25)",
        }}
      >
        LA BOMBA
        <br />
        DEL ZAR
      </div>
      <Tech
        style={{
          position: "absolute",
          top: 760,
          left: 90,
          color: T.steel,
          fontSize: 30,
        }}
      >
        {frame < at ? "potencia de diseño" : "potencia probada"}
      </Tech>
      <PowerBar y={830} cut={cut} fall={fall} />
      <div
        style={{
          position: "absolute",
          top: 990,
          left: 90,
          width: 900,
          display: "flex",
          justifyContent: "space-between",
          fontFamily: heavy,
          fontWeight: 900,
          color: T.flash,
        }}
      >
        <span style={{ fontSize: 76 }}>
          {frame < at + 6 ? "100" : "50"}{" "}
          <span style={{ fontSize: 40, color: T.ember }}>MEGATONES</span>
        </span>
        <span
          style={{
            fontSize: 56,
            color: T.red,
            opacity: prog(frame, at + 10, 10),
          }}
        >
          ÷ 2
        </span>
      </div>
      <Scanlines />
    </AbsoluteFill>
  );
};

/** 2 · Fecha y lugar: el Ártico soviético. */
export const ZPlace: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = useCues();
  const p = prog(frame, 0, c.duration - 10, inOut);
  const stamp = spring({
    frame: frame - c.word("z2", "1961") - 4,
    fps,
    config: { damping: 9, mass: 0.6 },
  });
  return (
    <AbsoluteFill style={{ background: T.bg }}>
      <Starfield count={600} drift={0.1} seed="tsar" />
      <Globe3D
        spin={faceLon(mix(5, GROUND_ZERO[0], p))}
        tilt={mix(0.6, 1.2, p)}
        cameraZ={mix(10.5, 7.2, p)}
        cameraY={0.32}
        highlight={NO_HIGHLIGHT}
        surface={
          <SurfaceMarker
            lat={GROUND_ZERO[1]}
            lon={GROUND_ZERO[0]}
            pulse={((((frame - 30) % 36) + 36) % 36) / 36}
            amount={prog(frame, 40, 14)}
            color={T.red}
          />
        }
      />
      <div
        style={{
          position: "absolute",
          top: 220,
          left: 0,
          right: 0,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: mono,
            fontWeight: 700,
            fontSize: 110,
            color: T.paper,
            letterSpacing: "0.04em",
            opacity: prog(frame, 6, 12),
          }}
        >
          30·10·1961
        </div>
        <Tech
          style={{
            color: T.ice,
            fontSize: 34,
            marginTop: 10,
            opacity: prog(frame, c.word("z2", "artico") - 4, 12),
          }}
        >
          Nueva Zembla · Ártico
        </Tech>
      </div>
      <div
        style={{
          position: "absolute",
          top: 420,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: frame >= c.word("z2", "1961") ? 1 : 0,
        }}
      >
        <div
          style={{
            fontFamily: "DejaVu Sans, sans-serif",
            fontWeight: 700,
            fontSize: 56,
            color: T.red,
            border: `6px solid ${T.red}`,
            padding: "6px 24px",
            letterSpacing: "0.12em",
            rotate: "-9deg",
            scale: String(2.2 - 1.2 * stamp),
            opacity: Math.min(1, stamp * 1.4) * 0.92,
          }}
        >
          СЕКРЕТНО
        </div>
      </div>
      <Scanlines />
    </AbsoluteFill>
  );
};

/** Silueta lateral de un bombardero cuatrimotor de alas en flecha. */
const Bomber: React.FC<{ x: number; y: number; frame: number }> = ({
  x,
  y,
  frame,
}) => (
  <g transform={`translate(${x} ${y})`} fill="#0D141C">
    <path d="M -230 0 C -210 -16 150 -18 200 -8 C 222 -4 232 2 226 8 C 180 16 -200 16 -230 6 Z" />
    <path d="M -200 -2 L -250 -70 L -222 -70 L -170 -4 Z" />
    <path d="M -10 4 L -120 60 L -86 60 L 40 6 Z" />
    {[-60, -20].map((ex, i) => (
      <g key={i}>
        <rect
          x={ex - 18 + (i ? 8 : 0)}
          y={18 + i * 12}
          width={46}
          height={12}
          rx={6}
        />
        <line
          x1={ex + 30 + (i ? 8 : 0)}
          y1={10 + i * 12}
          x2={ex + 30 + (i ? 8 : 0)}
          y2={40 + i * 12}
          stroke="#0D141C"
          strokeWidth={2}
          opacity={0.4 + 0.4 * random(`p${frame}${i}`)}
        />
      </g>
    ))}
  </g>
);

/** La bomba: cuerpo de 8 × 2,1 m con aletas de cola. `s` = píxeles por metro. */
const Bomb: React.FC<{ x: number; y: number; s: number; rot?: number }> = ({
  x,
  y,
  s,
  rot = 0,
}) => {
  const L = TSAR.lengthM * s;
  const D = TSAR.diameterM * s;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect
        x={-L / 2}
        y={-D / 2}
        width={L * 0.82}
        height={D}
        rx={D / 2}
        fill="#3A4654"
      />
      <path
        d={`M ${L * 0.3} ${-D / 2} L ${L / 2} ${-D * 0.9} L ${L / 2} ${D * 0.9} L ${L * 0.3} ${D / 2} Z`}
        fill="#2A333D"
      />
      <rect
        x={-L / 2 + D * 0.4}
        y={-D / 2 + 3}
        width={L * 0.6}
        height={D * 0.18}
        rx={3}
        fill="#7C8C9C"
        opacity={0.7}
      />
    </g>
  );
};

/** 3 · Lanzamiento y descenso en paracaídas, con altímetro y cronómetro. */
export const ZDrop: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const release = c.word("z3", "suelta");
  const chute = c.word("z3", "paracaidas");
  const tons = c.word("z3", "toneladas");
  const end = c.end("z4", 0.6);
  const descent = prog(frame, release, end - release, (t) => t);
  const alt = mix(TSAR.releaseM, TSAR.burstM, descent);
  const secs = Math.round(TSAR.descentS * descent);
  const bomberX = 540 + (frame - release) * 7;
  const dropY =
    frame < release
      ? 455
      : mix(455, 640, prog(frame, release, chute - release, inOut));
  const bombX = frame < release ? bomberX + 10 : 550;
  const canopy = prog(frame, chute - 4, 16);
  const sway = Math.sin(frame / 18) * 3 * canopy;
  const groundY = mix(1700, 1180, descent);
  const flash = prog(frame, end - 8, 10);
  return (
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(180deg, #08101C 0%, #1C2C40 55%, #6E8299 100%)",
      }}
    >
      <svg
        width={1080}
        height={1920}
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <linearGradient id="ice" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E3EEF6" />
            <stop offset="100%" stopColor="#8EA4B6" />
          </linearGradient>
          <radialGradient id="dropFlash">
            <stop offset="0%" stopColor={T.flash} />
            <stop offset="40%" stopColor={T.flash} stopOpacity={0.9} />
            <stop offset="100%" stopColor={T.flash} stopOpacity={0} />
          </radialGradient>
        </defs>
        {new Array(7).fill(0).map((_, i) => (
          <ellipse
            key={i}
            cx={
              ((((random(`cx${i}`) * 1400 - frame * (0.6 + i * 0.15)) % 1400) +
                1400) %
                1400) -
              160
            }
            cy={groundY - 60 - i * 26}
            rx={180 + random(`cr${i}`) * 140}
            ry={12 + i * 2}
            fill="#C9D7E3"
            opacity={0.08 + i * 0.015}
          />
        ))}
        <rect
          x={0}
          y={groundY}
          width={1080}
          height={1920 - groundY + 10}
          fill="url(#ice)"
        />
        <path
          d={`M 0 ${groundY + 30} Q 300 ${groundY + 10} 560 ${groundY + 40} T 1080 ${groundY + 26}`}
          fill="none"
          stroke="#0E2235"
          strokeWidth={18}
          opacity={0.35}
        />
        <Bomber x={bomberX} y={400} frame={frame} />
        {/* Paracaídas: 1.600 m² de cúpula principal */}
        {canopy > 0 ? (
          <g transform={`rotate(${sway} ${bombX} ${dropY})`} opacity={canopy}>
            {[-1, -0.5, 0, 0.5, 1].map((k) => (
              <line
                key={k}
                x1={bombX}
                y1={dropY - 30}
                x2={bombX + k * 150 * canopy}
                y2={dropY - 250}
                stroke={T.paper}
                strokeWidth={2}
                opacity={0.6}
              />
            ))}
            <path
              d={`M ${bombX - 160 * canopy} ${dropY - 250} Q ${bombX} ${dropY - 250 - 190 * canopy} ${bombX + 160 * canopy} ${dropY - 250} Q ${bombX} ${dropY - 290} ${bombX - 160 * canopy} ${dropY - 250} Z`}
              fill={T.paper}
              opacity={0.92}
            />
            <path
              d={`M ${bombX - 80 * canopy} ${dropY - 300} Q ${bombX} ${dropY - 250 - 170 * canopy} ${bombX + 80 * canopy} ${dropY - 300}`}
              stroke="#B9AE96"
              strokeWidth={3}
              fill="none"
            />
          </g>
        ) : null}
        <g transform={`rotate(${sway} ${bombX} ${dropY})`}>
          <Bomb
            x={bombX}
            y={dropY}
            s={12}
            rot={
              frame < release ? 0 : mix(0, 90, prog(frame, release, 30, inOut))
            }
          />
        </g>
        <circle
          cx={bombX}
          cy={dropY}
          r={1400 * flash}
          fill="url(#dropFlash)"
          opacity={flash}
        />
      </svg>

      {/* Altímetro y cronómetro */}
      <div
        style={{
          position: "absolute",
          left: 70,
          top: 760,
          opacity: prog(frame, release - 6, 10) * (1 - flash),
        }}
      >
        <Tech style={{ color: T.steel, fontSize: 26 }}>altitud</Tech>
        <div
          style={{
            fontFamily: mono,
            fontWeight: 700,
            fontSize: 70,
            color: T.flash,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fmt(Math.round(alt / 10) * 10)} m
        </div>
        <Tech style={{ color: T.steel, fontSize: 26, marginTop: 18 }}>
          tiempo de caída
        </Tech>
        <div
          style={{
            fontFamily: mono,
            fontWeight: 700,
            fontSize: 70,
            color: T.flash,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {secs} s
        </div>
        <Tech
          style={{
            color: T.red,
            fontSize: 24,
            marginTop: 14,
            opacity: frame % 20 < 12 ? 1 : 0.2,
          }}
        >
          ● detonación a {fmt(TSAR.burstM)} m
        </Tech>
      </div>

      {/* Ficha técnica con escala humana */}
      <div
        style={{
          position: "absolute",
          left: 600,
          top: 760,
          width: 420,
          opacity:
            prog(frame, tons - 4, 12) *
            (1 - prog(frame, c.start("z4") - 6, 12)),
        }}
      >
        <div
          style={{
            fontFamily: heavy,
            fontWeight: 900,
            fontSize: 110,
            color: T.flash,
            lineHeight: 1,
          }}
        >
          27 t
        </div>
        <Tech style={{ color: T.ice, fontSize: 28, marginTop: 6 }}>
          8 m × 2,1 m
        </Tech>
        <svg width={420} height={130} style={{ marginTop: 16 }}>
          <Bomb x={160} y={70} s={36} />
          <g transform="translate(355 30)" fill={T.ice}>
            <circle cx={0} cy={6} r={7} />
            <rect x={-7} y={14} width={14} height={30} rx={5} />
            <rect x={-6} y={42} width={5} height={22} />
            <rect x={1} y={42} width={5} height={22} />
          </g>
          <text
            x={355}
            y={122}
            textAnchor="middle"
            fill={T.steel}
            fontFamily={mono}
            fontSize={18}
          >
            1,8 m
          </text>
        </svg>
      </div>
      <Scanlines />
    </AbsoluteFill>
  );
};

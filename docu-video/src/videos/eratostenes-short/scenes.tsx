import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Starfield } from "../../components/Atmosphere";
import {
  AngleArc,
  DrawPath,
  Gnomon,
  polar,
  Sun,
} from "../../components/Diagram";
import { faceLon, Globe3D, SurfaceMarker } from "../../components/Globe3D";
import { C, fmt, fonts, inOut, mix, prog } from "../../engine/theme";
import { useCues } from "../../engine/timeline";
import { DATA } from "../eratostenes/data";

// Formato vertical 1080×1920. Zonas seguras de TikTok: arriba ~180 px, abajo ~420 px, derecha ~150 px.
// El contenido importante vive entre y = 200 y y = 1150; los subtítulos, debajo.

/** 1 · Gancho: la Tierra desde el espacio, viaje al pasado y zoom a Egipto. */
export const ShortHook: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const s2 = c.start("s2");
  const toEgypt = prog(frame, s2 - 10, 60, inOut);
  const year = Math.round(
    interpolate(frame, [s2, c.word("s2", "años", "end")], [2026, -240], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: inOut,
    }),
  );
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 35%, #0E1A33 0%, #05070D 70%)",
      }}
    >
      <Starfield drift={0.2} count={700} />
      <Globe3D
        spin={faceLon(mix(-40, 31, toEgypt))}
        tilt={mix(0.25, 0.47, toEgypt)}
        cameraZ={mix(8.5, 6.4, toEgypt) - prog(frame, 0, 60) * 0.6}
        cameraY={-0.55}
        highlightAmount={prog(frame, s2 + 30, 20) * 0.9}
        surface={
          <SurfaceMarker
            lat={27}
            lon={30.8}
            pulse={((((frame - s2) % 30) + 30) % 30) / 30}
            amount={prog(frame, s2 + 30, 14)}
          />
        }
      />
      <div
        style={{
          position: "absolute",
          top: 1040,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: fonts.display,
          fontWeight: 700,
          fontSize: 130,
          color: C.gold,
          fontVariantNumeric: "tabular-nums",
          opacity: prog(frame, s2, 8),
          textShadow: `0 0 50px ${C.gold}66`,
        }}
      >
        {year > 0 ? year : `${-year} a. C.`}
      </div>
    </AbsoluteFill>
  );
};

/** Panel estrecho con sol, rayos y vara. */
const Panel: React.FC<{
  x: number;
  city: string;
  angle: number;
  shadow: number;
  frame: number;
  on: number;
}> = ({ x, city, angle, shadow, frame, on }) => {
  const w = 520;
  const ground = 980;
  const h = 380;
  const gx = x + w / 2;
  const tan = Math.tan((angle * Math.PI) / 180);
  return (
    <g opacity={0.35 + 0.65 * on}>
      <clipPath id={`clip-${city}`}>
        <rect x={x} y={260} width={w} height={900} rx={28} />
      </clipPath>
      <g clipPath={`url(#clip-${city})`}>
        <rect x={x} y={260} width={w} height={720} fill="url(#skyShort)" />
        {new Array(9).fill(0).map((_, i) => {
          const rx = x - 100 + i * 80;
          return (
            <line
              key={i}
              x1={rx + 720 * tan}
              y1={260}
              x2={rx}
              y2={ground}
              stroke="#FFF1C7"
              strokeWidth={3}
              strokeDasharray="24 20"
              strokeDashoffset={-frame * 4}
              opacity={0.5}
            />
          );
        })}
        <Sun
          x={gx + 330 * tan}
          y={380}
          r={42}
          spin={frame}
          id={`sun-${city}`}
        />
        <rect x={x} y={ground} width={w} height={180} fill="url(#sandShort)" />
        <Gnomon
          x={gx}
          y={ground}
          height={h}
          shadow={shadow}
          shadowDir={180}
          color="#3A2A1A"
        />
        {shadow > 1 ? (
          <circle
            cx={gx - shadow / 2}
            cy={ground}
            r={64}
            fill="none"
            stroke={C.gold}
            strokeWidth={5}
            opacity={0.75 + 0.25 * Math.sin(frame / 4)}
          />
        ) : null}
      </g>
      <text
        x={gx}
        y={325}
        textAnchor="middle"
        fill="#2A1E14"
        fontSize={46}
        fontFamily={fonts.display}
        fontWeight={700}
      >
        {city}
      </text>
      <text
        x={gx}
        y={1100}
        textAnchor="middle"
        fill={C.text}
        fontSize={40}
        fontFamily={fonts.body}
        fontWeight={700}
        opacity={on}
      >
        {shadow > 1 ? "SOMBRA ✓" : "SIN SOMBRA"}
      </text>
    </g>
  );
};

/** 2 · Siena sin sombra / Alejandría con sombra, lado a lado. */
export const ShortShadows: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const s4 = c.start("s4");
  const realShadow = 380 * Math.tan((DATA.angleDeg * Math.PI) / 180);
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <svg width={1080} height={1920}>
        <defs>
          <linearGradient id="skyShort" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7FA9D6" />
            <stop offset="100%" stopColor="#F4D9A4" />
          </linearGradient>
          <linearGradient id="sandShort" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D8B276" />
            <stop offset="100%" stopColor="#8E6A3A" />
          </linearGradient>
        </defs>
        <Panel
          x={10}
          city="SIENA"
          angle={0}
          shadow={0}
          frame={frame}
          on={prog(frame, c.start("s3"), 10)}
        />
        <Panel
          x={550}
          city="ALEJANDRÍA"
          angle={DATA.angleDeg}
          shadow={realShadow * prog(frame, s4 + 6, 18)}
          frame={frame}
          on={prog(frame, s4 - 4, 10)}
        />
      </svg>
    </AbsoluteFill>
  );
};

const O: [number, number] = [540, 830];
const R = 360;
const A0 = 90;
const A1 = 90 + DATA.angleDeg;

const sector = (a0: number, a1: number) => {
  const [x0, y0] = polar(O[0], O[1], R, a0);
  const [x1, y1] = polar(O[0], O[1], R, a1);
  return `M ${O[0]} ${O[1]} L ${x0} ${y0} A ${R} ${R} 0 0 0 ${x1} ${y1} Z`;
};

/** Corte de la Tierra compartido por las escenas 3 y 4 (corte invisible entre ambas). */
const EarthCut: React.FC<{
  frame: number;
  angle: number;
  sectors: number;
  ring: number;
}> = ({ frame, angle, sectors, ring }) => {
  const sTip = polar(O[0], O[1], R + 110, A0);
  const aTip = polar(O[0], O[1], R + 110, A1);
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      {new Array(12).fill(0).map((_, i) => {
        const x = 100 + i * 80;
        const gy =
          Math.abs(x - O[0]) < R
            ? O[1] - Math.sqrt(R * R - (x - O[0]) ** 2)
            : 1300;
        return (
          <line
            key={i}
            x1={x}
            y1={200}
            x2={x}
            y2={gy}
            stroke="#FFE3A0"
            strokeWidth={3}
            strokeDasharray="22 18"
            strokeDashoffset={-frame * 4}
            opacity={0.35}
          />
        );
      })}
      <circle
        cx={O[0]}
        cy={O[1]}
        r={R}
        fill="#13213C"
        stroke={C.papyrus}
        strokeWidth={4}
      />
      {new Array(sectors)
        .fill(0)
        .map((_, i) =>
          i === 0 ? null : (
            <path
              key={i}
              d={sector(A0 + i * DATA.angleDeg, A0 + (i + 1) * DATA.angleDeg)}
              fill={i % 2 ? C.gold : C.goldSoft}
              opacity={0.6}
              stroke="#13213C"
              strokeWidth={1.5}
            />
          ),
        )}
      <path d={sector(A0, A1)} fill={C.gold} opacity={angle} />
      <line
        x1={O[0]}
        y1={O[1]}
        x2={sTip[0]}
        y2={sTip[1]}
        stroke={C.papyrus}
        strokeWidth={5}
        strokeDasharray="14 10"
      />
      <line
        x1={O[0]}
        y1={O[1]}
        x2={aTip[0]}
        y2={aTip[1]}
        stroke={C.papyrus}
        strokeWidth={5}
        strokeDasharray="14 10"
      />
      <AngleArc
        cx={O[0]}
        cy={O[1]}
        r={150}
        a0={A0}
        a1={A1}
        progress={angle}
        color={C.gold}
        width={6}
      />
      <circle cx={O[0]} cy={O[1]} r={12} fill={C.gold} />
      <DrawPath
        d={`M ${O[0]} ${O[1] - R} A ${R} ${R} 0 1 0 ${O[0]} ${O[1] + R} A ${R} ${R} 0 1 0 ${O[0]} ${O[1] - R}`}
        progress={ring}
        color={C.gold}
        width={10}
        glow
      />
    </svg>
  );
};

/** 3 · El ángulo: 1/50 de círculo. */
export const ShortAngle: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = useCues();
  const at = c.word("s5", "cincuentavo");
  const pop = spring({ frame: frame - at, fps, config: { damping: 12 } });
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, #13213C 0%, #070B14 75%)",
      }}
    >
      <EarthCut frame={frame} angle={prog(frame, 4, 16)} sectors={0} ring={0} />
      <div
        style={{
          position: "absolute",
          top: 190,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: fonts.display,
          fontWeight: 700,
          color: C.gold,
          fontSize: 104,
          scale: String(frame >= at ? pop : 0),
          textShadow: `0 0 50px ${C.gold}66`,
        }}
      >
        1/50{" "}
        <span
          style={{
            fontFamily: fonts.body,
            color: C.text,
            fontSize: 64,
            opacity: prog(frame, at + 6, 10),
          }}
        >
          = 7,2°
        </span>
      </div>
    </AbsoluteFill>
  );
};

/** 4 · ×50 = la vuelta al mundo. */
export const ShortMeasure: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = useCues();
  const s6 = c.start("s6");
  const mundo = c.word("s6", "mundo");
  const count = Math.min(
    DATA.fraction,
    Math.max(1, Math.floor((frame - s6) / 0.7) + 1),
  );
  const result = spring({ frame: frame - mundo, fps, config: { damping: 13 } });
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, #13213C 0%, #070B14 75%)",
      }}
    >
      <EarthCut
        frame={frame}
        angle={1}
        sectors={count}
        ring={prog(frame, mundo - 6, 24, inOut)}
      />
      <div
        style={{
          position: "absolute",
          top: 190,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: fonts.display,
          fontWeight: 700,
          color: C.gold,
          fontSize: 110,
          opacity: 1 - prog(frame, mundo - 4, 8),
        }}
      >
        × {count}
      </div>
      <div
        style={{
          position: "absolute",
          top: 165,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: frame >= mundo ? result : 0,
          scale: String(0.7 + 0.3 * result),
        }}
      >
        <div
          style={{
            fontFamily: fonts.display,
            fontWeight: 700,
            color: C.gold,
            fontSize: 104,
            textShadow: `0 0 50px ${C.gold}66`,
          }}
        >
          {fmt(DATA.circumferenceStadia)}
        </div>
        <div
          style={{
            fontFamily: fonts.body,
            fontWeight: 700,
            color: C.text,
            fontSize: 44,
            letterSpacing: "0.1em",
          }}
        >
          ESTADIOS ≈ 40.000 km*
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 1240,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: prog(frame, c.end("s6", 0.1), 10),
        }}
      >
        <div
          style={{
            fontFamily: fonts.display,
            fontWeight: 700,
            color: C.text,
            fontSize: 64,
          }}
        >
          ERATÓSTENES
        </div>
        <div
          style={{
            fontFamily: fonts.body,
            color: C.papyrus,
            fontSize: 36,
            marginTop: 8,
          }}
        >
          c. 240 a. C. · con una vara y una sombra
        </div>
        <div
          style={{
            fontFamily: fonts.body,
            color: C.muted,
            fontSize: 26,
            marginTop: 18,
          }}
        >
          *depende de la longitud del estadio, que no se conoce con certeza
        </div>
      </div>
    </AbsoluteFill>
  );
};

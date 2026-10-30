import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ChapterTag } from "../../../components/ChapterTag";
import { DrawPath, Label, Sun } from "../../../components/Diagram";
import { C, fonts, inOut, prog, visible } from "../../../engine/theme";
import { useCues } from "../../../engine/timeline";
import { DATA } from "../data";

const Grid: React.FC = () => (
  <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
    <defs>
      <pattern id="grid" width={60} height={60} patternUnits="userSpaceOnUse">
        <path
          d="M 60 0 L 0 0 0 60"
          fill="none"
          stroke="#1C2B48"
          strokeWidth={1}
        />
      </pattern>
    </defs>
    <rect width={1920} height={1080} fill="url(#grid)" />
  </svg>
);

/** A · Escala Sol–Tierra: los rayos llegan casi paralelos. */
const SunEarth: React.FC<{
  frame: number;
  lejos: number;
  paralelos: number;
}> = ({ frame, lejos, paralelos }) => {
  const earth: [number, number] = [1650, 540];
  const lens = prog(frame, paralelos - 6, 24);
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
      <Sun x={-60} y={540} r={300} spin={frame * 0.2} id="bigSun" />
      {new Array(9).fill(0).map((_, i) => {
        const y0 = 340 + i * 50;
        const y1 = earth[1] - 24 + i * 6;
        return (
          <DrawPath
            key={i}
            d={`M 250 ${y0} L ${earth[0]} ${y1}`}
            progress={prog(frame, 10 + i * 3, 50)}
            color="#FFE3A0"
            width={2}
            opacity={0.6}
          />
        );
      })}
      <circle cx={earth[0]} cy={earth[1]} r={12} fill="#4A90D9" />
      <Label x={earth[0]} y={earth[1] + 56} size={34}>
        Tierra
      </Label>
      <g opacity={prog(frame, lejos - 6, 20)}>
        <line
          x1={260}
          y1={820}
          x2={earth[0]}
          y2={820}
          stroke={C.muted}
          strokeWidth={2}
        />
        <line
          x1={260}
          y1={805}
          x2={260}
          y2={835}
          stroke={C.muted}
          strokeWidth={2}
        />
        <line
          x1={earth[0]}
          y1={805}
          x2={earth[0]}
          y2={835}
          stroke={C.muted}
          strokeWidth={2}
        />
        <Label x={(260 + earth[0]) / 2} y={880} size={40} color={C.goldSoft}>
          ≈ {DATA.sunDistanceMillionKm} millones de km
        </Label>
      </g>
      {/* Lupa: cerca de la Tierra los rayos son prácticamente paralelos */}
      <g opacity={lens}>
        <line
          x1={earth[0]}
          y1={earth[1]}
          x2={1480}
          y2={300}
          stroke={C.cyan}
          strokeWidth={2}
          strokeDasharray="6 8"
        />
        <circle
          cx={1480}
          cy={250}
          r={150 * lens}
          fill="#0A1426"
          stroke={C.cyan}
          strokeWidth={3}
        />
        {new Array(6).fill(0).map((_, i) => (
          <line
            key={i}
            x1={1360}
            y1={175 + i * 30}
            x2={1600 * lens + 1360 * (1 - lens)}
            y2={175 + i * 30}
            stroke="#FFE3A0"
            strokeWidth={3}
            opacity={Math.abs(i - 2.5) < 2.4 ? 1 : 0.3}
          />
        ))}
        <Label x={1480} y={450} size={40} color={C.cyan} display weight={700}>
          PARALELOS
        </Label>
      </g>
    </svg>
  );
};

/** B · El suelo pasa de plano a curvo: las varas se inclinan y aparece la sombra. */
const Ground: React.FC<{
  frame: number;
  curve: number;
  showShadow: number;
  flatLabel: number;
  curveLabel: number;
}> = ({ frame, curve, showShadow, flatLabel, curveLabel }) => {
  const xS = 1160;
  const yG = 760;
  const h = 240;
  const R = curve > 0.0005 ? 1500 / curve : Infinity;
  const at = (s: number) => {
    if (!isFinite(R)) return { x: xS + s, y: yG, phi: 0 };
    const phi = s / R;
    return { x: xS + R * Math.sin(phi), y: yG + R * (1 - Math.cos(phi)), phi };
  };
  const groundY = (x: number) =>
    isFinite(R) && Math.abs(x - xS) < R
      ? yG + R - Math.sqrt(R * R - (x - xS) ** 2)
      : yG;
  const path = useMemo(() => {
    const pts: string[] = [];
    for (let s = -1500; s <= 1500; s += 25) {
      const p = at(s);
      pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
    }
    return pts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [R]);

  const sticks = [
    { s: -480, name: "Alejandría" },
    { s: 0, name: "Siena" },
  ];
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
      <path
        d={`M ${path.join(" L ")} L 2400 1400 L -400 1400 Z`}
        fill="#1A2236"
      />
      <path
        d={`M ${path.join(" L ")}`}
        fill="none"
        stroke={C.papyrus}
        strokeWidth={4}
      />
      {new Array(22).fill(0).map((_, i) => {
        const x = 230 + i * 70;
        return (
          <line
            key={i}
            x1={x}
            y1={-20}
            x2={x}
            y2={groundY(x)}
            stroke="#FFE3A0"
            strokeWidth={2.5}
            strokeDasharray="24 20"
            strokeDashoffset={-frame * 3}
            opacity={0.4}
          />
        );
      })}
      {sticks.map(({ s, name }) => {
        const b = at(s);
        const tip = {
          x: b.x + h * Math.sin(b.phi),
          y: b.y - h * Math.cos(b.phi),
        };
        const len = h * Math.tan(Math.abs(b.phi)) * showShadow;
        const end = {
          x: b.x - len * Math.cos(b.phi),
          y: b.y - len * Math.sin(b.phi),
        };
        return (
          <g key={name}>
            {len > 1 ? (
              <>
                <line
                  x1={b.x}
                  y1={b.y}
                  x2={end.x}
                  y2={end.y}
                  stroke="#000"
                  strokeWidth={14}
                  strokeLinecap="round"
                  opacity={0.75}
                />
                <line
                  x1={b.x}
                  y1={b.y + 16}
                  x2={end.x}
                  y2={end.y + 16}
                  stroke={C.gold}
                  strokeWidth={3}
                  opacity={0.9}
                />
              </>
            ) : null}
            <line
              x1={b.x}
              y1={b.y}
              x2={tip.x}
              y2={tip.y}
              stroke={C.papyrus}
              strokeWidth={9}
              strokeLinecap="round"
            />
            <circle cx={tip.x} cy={tip.y} r={8} fill={C.papyrus} />
            <Label x={b.x} y={b.y + 70} size={34} color={C.muted}>
              {name}
            </Label>
          </g>
        );
      })}
      <Label x={960} y={190} size={52} display weight={700} opacity={flatLabel}>
        Tierra plana → <tspan fill={C.cyan}>misma sombra</tspan>
      </Label>
      <Label
        x={960}
        y={190}
        size={52}
        display
        weight={700}
        opacity={curveLabel}
      >
        Superficie curva → <tspan fill={C.gold}>sombras distintas</tspan>
      </Label>
      <Label
        x={1840}
        y={1010}
        size={24}
        anchor="end"
        color={C.muted}
        opacity={curveLabel}
      >
        curvatura exagerada para verla
      </Label>
    </svg>
  );
};

export const Rays: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const r3 = c.start("ray-3");
  const r5 = c.start("ray-5");
  const curveAt = c.word("ray-4", "curva");
  const esfera = c.word("ray-5", "esfera");
  const medir = c.word("ray-5", "medirla");

  const aOut = visible(frame, 0, r3 + 6, 16);
  const bIn = visible(frame, r3 - 6, r5 + 24, 16);
  const cIn = prog(frame, r5 + 14, 20);
  const curve = prog(frame, curveAt - 10, 50, inOut);

  return (
    <AbsoluteFill style={{ background: "#0A1222" }}>
      <Grid />
      <AbsoluteFill style={{ opacity: aOut }}>
        <SunEarth
          frame={frame}
          lejos={c.word("ray-2", "lejos")}
          paralelos={c.word("ray-2", "paralelos")}
        />
        <div
          style={{
            position: "absolute",
            left: 420,
            top: 160,
            fontFamily: fonts.display,
            fontSize: 64,
            color: C.text,
            opacity: visible(frame, c.start("ray-1"), r3, 14),
          }}
        >
          La clave estaba en la <span style={{ color: C.gold }}>luz</span>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: bIn }}>
        <Ground
          frame={frame}
          curve={curve}
          showShadow={curve}
          flatLabel={visible(frame, c.word("ray-3", "misma"), curveAt, 12)}
          curveLabel={prog(frame, curveAt + 20, 16)}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: cIn }}>
        <svg
          width={1920}
          height={1080}
          style={{ position: "absolute", inset: 0 }}
        >
          <defs>
            <radialGradient id="ball" cx="38%" cy="35%">
              <stop offset="0%" stopColor="#2F6DB5" />
              <stop offset="100%" stopColor="#0B2244" />
            </radialGradient>
          </defs>
          <circle
            cx={960}
            cy={560}
            r={300}
            fill="url(#ball)"
            opacity={prog(frame, r5, 30)}
          />
          <DrawPath
            d="M 960 260 A 300 300 0 1 1 959.9 260"
            progress={prog(frame, r5, 40, inOut)}
            color={C.papyrus}
            width={4}
          />
          <g
            transform={`rotate(${frame * 0.6} 960 560)`}
            opacity={prog(frame, medir - 6, 16)}
          >
            <circle
              cx={960}
              cy={560}
              r={345}
              fill="none"
              stroke={C.gold}
              strokeWidth={4}
              strokeDasharray="18 14"
            />
          </g>
        </svg>
        <div
          style={{
            position: "absolute",
            left: 140,
            top: 470,
            width: 480,
            opacity: prog(frame, esfera, 16),
          }}
        >
          <div
            style={{
              fontFamily: fonts.display,
              fontSize: 64,
              color: C.text,
              fontWeight: 700,
            }}
          >
            Esfera <span style={{ color: C.cyan }}>✓</span>
          </div>
          <div
            style={{
              fontFamily: fonts.body,
              fontSize: 30,
              color: C.muted,
              marginTop: 10,
            }}
          >
            Aristóteles ya lo argumentaba (s. IV a. C.)
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            right: 140,
            top: 470,
            width: 480,
            textAlign: "right",
            opacity: prog(frame, medir - 4, 16),
          }}
        >
          <div
            style={{
              fontFamily: fonts.display,
              fontSize: 64,
              color: C.gold,
              fontWeight: 700,
            }}
          >
            Tamaño = ?
          </div>
          <div
            style={{
              fontFamily: fonts.body,
              fontSize: 30,
              color: C.muted,
              marginTop: 10,
            }}
          >
            lo que quería medir Eratóstenes
          </div>
        </div>
      </AbsoluteFill>
      <ChapterTag label="II · La luz" />
    </AbsoluteFill>
  );
};

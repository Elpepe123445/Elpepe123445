import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ChapterTag } from "../../../components/ChapterTag";
import { Counter } from "../../../components/Counter";
import { AngleArc, DrawPath, Label, polar } from "../../../components/Diagram";
import { lerpView, type View } from "../../../components/GeoMap";
import { C, fonts, inOut, prog, visible } from "../../../engine/theme";
import { useCues } from "../../../engine/timeline";
import { DATA } from "../data";

// Corte de la Tierra a escala real del ángulo (7,2°); solo las varas están exageradas.
const O: [number, number] = [960, 1950];
const R = 1500;
const L = 240;
const A_SYENE = 90;
const A_ALEX = 90 + DATA.angleDeg;

const V1: View = { x: 437, y: 165, w: 640, h: 360 };
const V2: View = { x: 20, y: -148, w: 1700, h: 956 };
const V3: View = { x: -940, y: 40, w: 3800, h: 2137 };

/** Gráfico circular de 50 porciones con una resaltada (1/50 de círculo). */
const Pie: React.FC<{ p: number; label: React.ReactNode }> = ({ p, label }) => (
  <div
    style={{
      position: "absolute",
      right: 130,
      top: 250,
      width: 300,
      textAlign: "center",
      opacity: p,
    }}
  >
    <svg width={260} height={260} viewBox="-130 -130 260 260">
      <circle r={110} fill="#0E1A30" stroke={C.line} strokeWidth={2} />
      {new Array(50).fill(0).map((_, i) => {
        const a = (i * 7.2 * Math.PI) / 180;
        return (
          <line
            key={i}
            x1={0}
            y1={0}
            x2={Math.cos(a) * 110}
            y2={-Math.sin(a) * 110}
            stroke={C.line}
            strokeWidth={1}
          />
        );
      })}
      <path
        d={`M 0 0 L 0 -110 A 110 110 0 0 0 ${-Math.sin((7.2 * Math.PI) / 180) * 110} ${-Math.cos((7.2 * Math.PI) / 180) * 110} Z`}
        fill={C.gold}
      />
      <circle r={110} fill="none" stroke={C.papyrus} strokeWidth={2} />
    </svg>
    <div
      style={{
        fontFamily: fonts.display,
        fontSize: 46,
        color: C.gold,
        fontWeight: 700,
        marginTop: 6,
      }}
    >
      {label}
    </div>
  </div>
);

export const Geometry: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const g2 = c.start("geo-2");
  const g3 = c.start("geo-3");
  const g4 = c.start("geo-4");
  const g5 = c.start("geo-5");
  const angleAt = c.word("geo-1", "angulo");
  const fifty = c.word("geo-1", "cincuentavo");
  const centro = c.word("geo-3", "centro");
  const prolong = c.word("geo-4", "prolongamos");
  const mismo = c.word("geo-4", "mismo");
  const paralelas = c.word("geo-5", "paralelas");
  const recta = c.word("geo-5", "recta");
  const iguales = c.word("geo-5", "iguales");

  // Cámara: plano cercano de la vara → ambas varas → la Tierra entera con su centro.
  const toV2 = prog(frame, c.end("geo-2") - 6, 40, inOut);
  const toV3 = prog(frame, g3 + 10, 80, inOut);
  const v = lerpView(lerpView(V1, V2, toV2), V3, toV3);
  const k = v.w / 1920;

  const sBase = polar(O[0], O[1], R, A_SYENE);
  const sTip = polar(O[0], O[1], R + L, A_SYENE);
  const aBase = polar(O[0], O[1], R, A_ALEX);
  const aTip = polar(O[0], O[1], R + L, A_ALEX);
  const groundAtTip = O[1] - Math.sqrt(R * R - (aTip[0] - O[0]) ** 2);
  const pulse = 0.5 + 0.5 * Math.sin(frame / 5);
  const hiParallel = prog(frame, paralelas - 4, 14);
  const hiTransversal = prog(frame, recta - 4, 14);
  const equal = prog(frame, iguales - 4, 14);

  return (
    <AbsoluteFill style={{ background: "#0A1222" }}>
      <svg
        width={1920}
        height={1080}
        viewBox={`${v.x} ${v.y} ${v.w} ${v.h}`}
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <radialGradient id="earthCut" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#2A1F18" />
            <stop offset="70%" stopColor="#1B2236" />
            <stop offset="100%" stopColor="#1E2B47" />
          </radialGradient>
        </defs>
        <circle
          cx={O[0]}
          cy={O[1]}
          r={R}
          fill="url(#earthCut)"
          stroke={C.papyrus}
          strokeWidth={4 * k}
        />
        {/* Rayos verticales y paralelos */}
        {new Array(40).fill(0).map((_, i) => {
          const x = -1000 + i * 100 + 42;
          const gy =
            Math.abs(x - O[0]) < R
              ? O[1] - Math.sqrt(R * R - (x - O[0]) ** 2)
              : 2400;
          return (
            <line
              key={i}
              x1={x}
              y1={-400}
              x2={x}
              y2={gy}
              stroke="#FFE3A0"
              strokeWidth={2.5 * k}
              strokeDasharray={`${24 * k} ${20 * k}`}
              strokeDashoffset={-frame * 3 * k}
              opacity={0.35}
            />
          );
        })}
        {/* Rayo que pasa por la punta de la vara de Alejandría (paralela resaltable) */}
        <line
          x1={aTip[0]}
          y1={-400}
          x2={aTip[0]}
          y2={groundAtTip}
          stroke={hiParallel > 0 ? C.cyan : "#FFE3A0"}
          strokeWidth={(3 + 3 * hiParallel) * k}
          opacity={0.6 + 0.4 * hiParallel}
        />
        {/* Sombra en Alejandría */}
        <line
          x1={aBase[0]}
          y1={aBase[1]}
          x2={aTip[0]}
          y2={groundAtTip}
          stroke="#000"
          strokeWidth={12 * k}
          strokeLinecap="round"
          opacity={0.8}
        />
        {/* Prolongaciones hasta el centro */}
        <DrawPath
          d={`M ${sBase[0]} ${sBase[1]} L ${O[0]} ${O[1]}`}
          progress={prog(frame, prolong, 40, inOut)}
          color={hiParallel > 0 ? C.cyan : C.papyrus}
          width={3 + 3 * hiParallel}
          k={k}
        />
        <DrawPath
          d={`M ${aBase[0]} ${aBase[1]} L ${O[0]} ${O[1]}`}
          progress={prog(frame, prolong + 8, 40, inOut)}
          color={hiTransversal > 0 ? C.gold : C.papyrus}
          width={3 + 3 * hiTransversal}
          k={k}
        />
        {hiTransversal > 0 ? (
          <line
            x1={aTip[0]}
            y1={aTip[1]}
            x2={aBase[0]}
            y2={aBase[1]}
            stroke={C.gold}
            strokeWidth={6 * k}
          />
        ) : null}
        {/* Varas */}
        <line
          x1={sBase[0]}
          y1={sBase[1]}
          x2={sTip[0]}
          y2={sTip[1]}
          stroke={C.papyrus}
          strokeWidth={8 * k}
          strokeLinecap="round"
        />
        <line
          x1={aBase[0]}
          y1={aBase[1]}
          x2={aTip[0]}
          y2={aTip[1]}
          stroke={C.papyrus}
          strokeWidth={8 * k}
          strokeLinecap="round"
        />
        <Label
          x={sBase[0] + 30 * k}
          y={sBase[1] + 60 * k}
          size={34 * k}
          anchor="start"
          color={C.muted}
        >
          Siena
        </Label>
        <Label
          x={aBase[0] - 30 * k}
          y={aBase[1] + 60 * k}
          size={34 * k}
          anchor="end"
          color={C.muted}
        >
          Alejandría
        </Label>
        {/* Ángulo de la sombra en la punta */}
        <AngleArc
          cx={aTip[0]}
          cy={aTip[1]}
          r={110}
          a0={270}
          a1={270 + DATA.angleDeg}
          progress={prog(frame, angleAt - 4, 24)}
          color={C.gold}
          width={5}
          fill
        />
        {/* Centro de la Tierra y ángulo central */}
        <g opacity={prog(frame, centro - 4, 16)}>
          <circle
            cx={O[0]}
            cy={O[1]}
            r={(40 + 30 * pulse) * k}
            fill={C.gold}
            opacity={0.18}
          />
          <circle cx={O[0]} cy={O[1]} r={14 * k} fill={C.gold} />
          <Label x={O[0]} y={O[1] + 90 * k} size={46 * k} display weight={700}>
            Centro de la Tierra
          </Label>
        </g>
        <AngleArc
          cx={O[0]}
          cy={O[1]}
          r={600}
          a0={A_SYENE}
          a1={A_ALEX}
          progress={prog(frame, mismo - 4, 30)}
          color={C.gold}
          width={6}
          fill
        />
        <Label
          x={O[0] - 120 * k}
          y={O[1] - 640}
          size={56 * k}
          color={C.gold}
          display
          weight={700}
          opacity={prog(frame, mismo + 10, 16)}
        >
          7,2°
        </Label>
        {equal > 0 ? (
          <>
            <circle
              cx={aTip[0]}
              cy={aTip[1]}
              r={150 + 30 * pulse}
              fill="none"
              stroke={C.gold}
              strokeWidth={4 * k}
              opacity={equal * 0.8}
            />
            <circle
              cx={O[0]}
              cy={O[1]}
              r={680 + 40 * pulse}
              fill="none"
              stroke={C.gold}
              strokeWidth={4 * k}
              opacity={equal * 0.5}
              strokeDasharray={`${20 * k} ${16 * k}`}
            />
          </>
        ) : null}
      </svg>

      {/* Etiqueta del ángulo durante el plano cercano */}
      <div
        style={{
          position: "absolute",
          left: 600,
          top: 120,
          fontFamily: fonts.display,
          fontSize: 84,
          fontWeight: 700,
          color: C.gold,
          opacity: visible(frame, g2 - 2, g3, 12),
          textShadow: "0 0 30px #0008",
        }}
      >
        <Counter
          to={DATA.angleDeg}
          decimals={1}
          start={g2}
          duration={30}
          suffix="°"
        />
      </div>
      <Pie
        p={visible(frame, fifty - 4, g3 + 10, 14)}
        label={frame < g2 ? "1/50" : "1/50 = 7,2°"}
      />

      {/* Regla geométrica */}
      <div
        style={{
          position: "absolute",
          left: 120,
          bottom: 170,
          width: 760,
          opacity: prog(frame, g5, 16),
          fontFamily: fonts.body,
        }}
      >
        <div style={{ fontSize: 38, color: C.text, lineHeight: 1.4 }}>
          <span style={{ color: C.cyan, fontWeight: 700 }}>Dos paralelas</span>{" "}
          +{" "}
          <span style={{ color: C.gold, fontWeight: 700 }}>
            una recta que las corta
          </span>
        </div>
        <div
          style={{
            fontSize: 44,
            color: C.gold,
            fontFamily: fonts.display,
            fontWeight: 700,
            marginTop: 8,
            opacity: equal,
          }}
        >
          → ángulos iguales
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          right: 60,
          bottom: 40,
          fontFamily: fonts.body,
          fontSize: 22,
          color: C.muted,
          opacity: prog(frame, g4, 20),
        }}
      >
        ángulo a escala real · varas exageradas
      </div>
      <ChapterTag label="III · El ángulo" />
    </AbsoluteFill>
  );
};

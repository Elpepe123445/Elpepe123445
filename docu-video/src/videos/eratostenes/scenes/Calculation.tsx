import React from "react";
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ChapterTag } from "../../../components/ChapterTag";
import { Counter } from "../../../components/Counter";
import { DrawPath, Label, polar } from "../../../components/Diagram";
import {
  C,
  fmt,
  fonts,
  inOut,
  mix,
  prog,
  visible,
} from "../../../engine/theme";
import { useCues } from "../../../engine/timeline";
import { DATA } from "../data";

const R = 290;

const sector = (cx: number, cy: number, a0: number, a1: number, r = R) => {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 0 0 ${x1} ${y1} Z`;
};

export const Calculation: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = useCues();
  const c2 = c.start("calc-2");
  const c3 = c.start("calc-3");
  const c4 = c.start("calc-4");
  const c5 = c.start("calc-5");
  const rep = c.word("calc-1", "cincuentavo");
  const estadios = c.word("calc-3", "estadios");
  const por = c.word("calc-4", "por");
  const cincuenta = c.word("calc-4", "cincuenta");

  const shift = prog(frame, c4 - 10, 40, inOut);
  const cx = mix(960, 560, shift);
  const cy = mix(500, 520, shift);
  const count = Math.min(
    DATA.fraction,
    Math.max(0, Math.floor((frame - rep) / 1.6) + 1),
  );
  const othersFade = 1 - 0.75 * prog(frame, c2, 20);
  const routeIn = visible(frame, c3 - 4, c4 + 10, 14);
  const result = spring({
    frame: frame - c5,
    fps,
    config: { damping: 14, mass: 0.8 },
  });

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 45%, #13213C 0%, #070B14 75%)",
      }}
    >
      <svg
        width={1920}
        height={1080}
        style={{ position: "absolute", inset: 0 }}
      >
        <circle
          cx={cx}
          cy={cy}
          r={R}
          fill="#0F1C33"
          stroke={C.line}
          strokeWidth={3}
        />
        {/* Las 50 porciones */}
        {new Array(count)
          .fill(0)
          .map((_, i) =>
            i === 0 ? null : (
              <path
                key={i}
                d={sector(
                  cx,
                  cy,
                  90 + i * DATA.angleDeg,
                  90 + (i + 1) * DATA.angleDeg,
                )}
                fill={i % 2 ? C.gold : C.goldSoft}
                opacity={0.55 * othersFade}
                stroke="#0F1C33"
                strokeWidth={1.5}
              />
            ),
          )}
        <path
          d={sector(cx, cy, 90, 90 + DATA.angleDeg)}
          fill={C.gold}
          opacity={prog(frame, c.start("calc-1"), 20)}
        />
        <DrawPath
          d={`M ${polar(cx, cy, R, 90)[0]} ${polar(cx, cy, R, 90)[1]} A ${R} ${R} 0 0 0 ${polar(cx, cy, R, 90 + DATA.angleDeg)[0]} ${polar(cx, cy, R, 90 + DATA.angleDeg)[1]}`}
          progress={prog(frame, c.start("calc-1") + 6, 20)}
          color="#FFF1C7"
          width={8}
        />
        {/* Circunferencia completa en el resultado */}
        <DrawPath
          d={`M ${cx} ${cy - R} A ${R} ${R} 0 1 0 ${cx} ${cy + R} A ${R} ${R} 0 1 0 ${cx} ${cy - R}`}
          progress={prog(frame, c5 - 4, 50, inOut)}
          color={C.gold}
          width={8}
          glow
        />
        <Label
          x={polar(cx, cy, R + 40, 92)[0] + 30}
          y={polar(cx, cy, R + 40, 92)[1] - 10}
          size={30}
          anchor="start"
          color={C.muted}
          opacity={othersFade}
        >
          Siena
        </Label>
        <Label
          x={polar(cx, cy, R + 40, 97)[0] - 30}
          y={polar(cx, cy, R + 40, 97)[1] - 10}
          size={30}
          anchor="end"
          color={C.muted}
          opacity={othersFade}
        >
          Alejandría
        </Label>
        <Label
          x={cx}
          y={cy - R - 90}
          size={44}
          color={C.gold}
          display
          weight={700}
          opacity={visible(frame, c2 + 4, c3 + 6, 12)}
        >
          ¿distancia?
        </Label>
        {/* Contador de porciones */}
        <g opacity={visible(frame, rep - 2, c2 + 20, 12)}>
          <Label
            x={cx + R + 80}
            y={cy + 24}
            size={84}
            anchor="start"
            color={C.gold}
            display
            weight={700}
          >
            × {count}
          </Label>
        </g>
        {/* Camino Alejandría → Siena, medido a pasos */}
        <g opacity={routeIn}>
          <line
            x1={420}
            y1={880}
            x2={1500}
            y2={880}
            stroke={C.papyrus}
            strokeWidth={3}
            opacity={0.4}
          />
          <DrawPath
            d="M 420 880 L 1500 880"
            progress={prog(frame, c3, c.end("calc-3") - c3, inOut)}
            color={C.gold}
            width={4}
          />
          {new Array(24).fill(0).map((_, i) => {
            const x = 440 + i * 45;
            const shown = prog(
              frame,
              c3 + i * ((c.end("calc-3") - c3) / 24),
              6,
            );
            return (
              <ellipse
                key={i}
                cx={x}
                cy={880 + (i % 2 ? 14 : -14)}
                rx={9}
                ry={5}
                fill={C.papyrus}
                opacity={shown * 0.8}
              />
            );
          })}
          <circle cx={420} cy={880} r={10} fill={C.gold} />
          <circle cx={1500} cy={880} r={10} fill={C.gold} />
          <Label x={420} y={840} size={32} anchor="start" color={C.text}>
            Alejandría
          </Label>
          <Label x={1500} y={840} size={32} anchor="end" color={C.text}>
            Siena
          </Label>
          <Label
            x={960}
            y={830}
            size={50}
            color={C.gold}
            display
            weight={700}
            opacity={prog(frame, estadios - 10, 14)}
          >
            ≈ {fmt(DATA.distanceStadia)} estadios
          </Label>
        </g>
      </svg>

      {/* Ecuación */}
      <div
        style={{
          position: "absolute",
          left: 980,
          top: 330,
          width: 860,
          fontFamily: fonts.display,
          color: C.text,
          fontWeight: 700,
          opacity: shift,
        }}
      >
        <div
          style={{
            fontSize: 96,
            display: "flex",
            gap: 30,
            alignItems: "baseline",
          }}
        >
          <span style={{ opacity: prog(frame, c4, 10) }}>
            {fmt(DATA.distanceStadia)}
          </span>
          <span style={{ color: C.gold, opacity: prog(frame, por - 2, 10) }}>
            ×
          </span>
          <span style={{ opacity: prog(frame, cincuenta - 2, 10) }}>
            {DATA.fraction}
          </span>
        </div>
        <div
          style={{
            fontSize: 132,
            color: C.gold,
            marginTop: 16,
            scale: String(0.6 + 0.4 * result),
            opacity: frame >= c5 ? result : 0,
            transformOrigin: "left center",
            textShadow: `0 0 60px ${C.gold}66`,
          }}
        >
          ={" "}
          <Counter
            from={0}
            to={DATA.circumferenceStadia}
            start={c5}
            duration={40}
          />
        </div>
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: 40,
            color: C.papyrus,
            fontWeight: 400,
            marginTop: 6,
            opacity: prog(frame, c5 + 20, 16),
          }}
        >
          estadios · la circunferencia de la Tierra
        </div>
      </div>
      <ChapterTag label="IV · La medida" />
    </AbsoluteFill>
  );
};

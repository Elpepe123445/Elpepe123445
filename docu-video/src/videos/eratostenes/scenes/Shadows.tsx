import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Gnomon, Sun } from "../../../components/Diagram";
import { KineticText } from "../../../components/KineticText";
import { C, fonts, inOut, mix, prog } from "../../../engine/theme";
import { useCues } from "../../../engine/timeline";
import { DATA } from "../data";

const GROUND = 760;
const W = 960;

/** Panel de una ciudad a mediodía. Se diseña en 960 px de ancho y se centra en el ancho real. */
const Panel: React.FC<{
  x: number;
  width: number;
  city: string;
  sunAngle: number;
  shadow: number;
  well?: number;
  frame: number;
  tag: string;
  tagIn: number;
}> = ({ x, width, city, sunAngle, shadow, well = 0, frame, tag, tagIn }) => {
  const gx = W / 2 - 60;
  const h = 420;
  const tan = Math.tan((sunAngle * Math.PI) / 180);
  const sunX = gx + h * 1.3 * Math.sin((sunAngle * Math.PI) / 180);
  const sunY =
    GROUND - h - h * 1.0 * Math.cos((sunAngle * Math.PI) / 180) + 120;
  const waterGlow = prog(frame, well, 10);
  const beamY = mix(GROUND, 1010, prog(frame, well - 30, 30, inOut));
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: 0,
        width,
        height: 1080,
        overflow: "hidden",
      }}
    >
      <svg
        width={width}
        height={1080}
        viewBox={`${(W - width) / 2} 0 ${width} 1080`}
      >
        <defs>
          <linearGradient id={`sky-${city}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7FA9D6" />
            <stop offset="100%" stopColor="#F4D9A4" />
          </linearGradient>
          <linearGradient id={`sand-${city}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D8B276" />
            <stop offset="100%" stopColor="#8E6A3A" />
          </linearGradient>
        </defs>
        <rect
          x={-600}
          y={0}
          width={2200}
          height={GROUND}
          fill={`url(#sky-${city})`}
        />
        {/* Rayos solares paralelos, fluyendo */}
        {new Array(26).fill(0).map((_, i) => {
          const rx = -560 + i * 90;
          return (
            <line
              key={i}
              x1={rx + GROUND * tan}
              y1={0}
              x2={rx}
              y2={GROUND}
              stroke="#FFF1C7"
              strokeWidth={3}
              strokeDasharray="26 22"
              strokeDashoffset={-frame * 3}
              opacity={0.45}
            />
          );
        })}
        <Sun x={sunX} y={sunY} r={46} spin={frame * 0.5} id={`sun-${city}`} />
        <rect
          x={-600}
          y={GROUND}
          width={2200}
          height={1080 - GROUND}
          fill={`url(#sand-${city})`}
        />
        {/* Pozo en corte (solo Siena) */}
        {well > 0 ? (
          <g>
            <rect
              x={620}
              y={GROUND - 40}
              width={110}
              height={40}
              fill="#B08A57"
              stroke="#6B4E2C"
              strokeWidth={4}
            />
            <rect x={640} y={GROUND} width={70} height={300} fill="#2C1F14" />
            {new Array(9).fill(0).map((_, i) => (
              <line
                key={i}
                x1={640}
                y1={GROUND + i * 34}
                x2={710}
                y2={GROUND + i * 34}
                stroke="#4A3523"
                strokeWidth={3}
              />
            ))}
            <rect x={640} y={1010} width={70} height={50} fill="#2E6FA8" />
            <rect
              x={646}
              y={GROUND - 40}
              width={58}
              height={Math.max(0, beamY - GROUND + 40)}
              fill="#FFE7A6"
              opacity={0.6}
            />
            <ellipse
              cx={675}
              cy={1012}
              rx={30 + waterGlow * 10}
              ry={6}
              fill="#FFF4CF"
              opacity={waterGlow}
            />
          </g>
        ) : null}
        <Gnomon
          x={gx}
          y={GROUND}
          height={h}
          shadow={shadow}
          shadowDir={180}
          color="#3A2A1A"
        />
        {shadow > 1 ? (
          <g>
            <circle
              cx={gx - shadow / 2}
              cy={GROUND}
              r={70}
              fill="none"
              stroke={C.gold}
              strokeWidth={4}
              opacity={0.7 + 0.3 * Math.sin(frame / 5)}
            />
            <line
              x1={gx - shadow / 2 - 50}
              y1={GROUND + 50}
              x2={gx - 210}
              y2={GROUND + 120}
              stroke={C.gold}
              strokeWidth={3}
            />
            <text
              x={gx - 220}
              y={GROUND + 156}
              fill={C.night}
              fontSize={36}
              fontFamily={fonts.body}
              fontWeight={700}
              textAnchor="end"
            >
              sombra
            </text>
          </g>
        ) : null}
        <text
          x={(W - width) / 2 + 70}
          y={110}
          fill="#2A1E14"
          fontSize={58}
          fontFamily={fonts.display}
          fontWeight={700}
          letterSpacing={4}
        >
          {city}
        </text>
      </svg>
      <div
        style={{
          position: "absolute",
          left: width / 2 - 260,
          top: 860,
          width: 520,
          textAlign: "center",
          opacity: tagIn,
          translate: `0 ${(1 - tagIn) * 20}px`,
        }}
      >
        <span
          style={{
            fontFamily: fonts.body,
            fontWeight: 600,
            fontSize: 38,
            color: C.text,
            background: "rgba(10,10,20,0.7)",
            padding: "10px 26px",
            borderRadius: 40,
          }}
        >
          {tag}
        </span>
      </div>
    </div>
  );
};

export const Shadows: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const s2 = c.start("sh-2");
  const s3 = c.start("sh-3");
  const split = prog(frame, s2 - 6, 30, inOut);
  const shadowAt = c.word("sh-2", "proyectaba");
  const realShadow = 420 * Math.tan((DATA.angleDeg * Math.PI) / 180);
  const q = prog(frame, s3 - 4, 20);

  const leftW = mix(1920, 956, split);
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <AbsoluteFill
        style={{
          scale: String(1 - q * 0.06),
          filter: `brightness(${1 - q * 0.55}) blur(${q * 3}px)`,
        }}
      >
        <Panel
          x={0}
          width={leftW}
          city="SIENA"
          sunAngle={0}
          shadow={0}
          well={c.word("sh-1", "luz")}
          frame={frame}
          tag="Sin sombra"
          tagIn={prog(frame, c.word("sh-1", "sombra"), 16)}
        />
        <Panel
          x={mix(1920, 964, split)}
          width={956}
          city="ALEJANDRÍA"
          sunAngle={DATA.angleDeg}
          shadow={realShadow * prog(frame, shadowAt - 10, 30, inOut)}
          frame={frame}
          tag="Pequeña sombra"
          tagIn={prog(frame, shadowAt + 6, 16)}
        />
        <div
          style={{
            position: "absolute",
            left: 958,
            top: 0,
            width: 4,
            height: 1080 * split,
            background: C.gold,
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: "0 200px",
        }}
      >
        <KineticText
          text="¿El mismo Sol… sombras distintas?"
          start={s3}
          highlight={["distintas"]}
          stagger={4}
          style={{
            fontSize: 92,
            fontWeight: 700,
            justifyContent: "center",
            textAlign: "center",
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

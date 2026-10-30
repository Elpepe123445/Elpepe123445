import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BarChart } from "../../../components/BarChart";
import { ChapterTag } from "../../../components/ChapterTag";
import { DrawPath } from "../../../components/Diagram";
import { CityMarker, GeoMap } from "../../../components/GeoMap";
import { KineticText } from "../../../components/KineticText";
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
import { DATA, errorPct, PLACES, resultKm, TROPIC_LAT } from "../data";

const pct = (v: number) => `${v > 0 ? "+" : "−"}${fmt(Math.abs(v), 1)} %`;

/** Regla del estadio: su longitud oscila entre las estimaciones (incertidumbre visible). */
const StadionRuler: React.FC<{ frame: number; p: number }> = ({ frame, p }) => {
  const meters = mix(155, 185, 0.5 + 0.5 * Math.sin(frame / 14));
  const px = meters * 4.2;
  return (
    <div
      style={{
        position: "absolute",
        left: 960 - 400,
        top: 250,
        width: 800,
        opacity: p,
        fontFamily: fonts.body,
        textAlign: "center",
      }}
    >
      <div style={{ color: C.muted, fontSize: 30, letterSpacing: "0.2em" }}>
        1 ESTADIO =
      </div>
      <div style={{ position: "relative", height: 60, marginTop: 20 }}>
        <div
          style={{
            position: "absolute",
            left: 400 - px / 2,
            width: px,
            top: 24,
            height: 12,
            background: `repeating-linear-gradient(90deg, ${C.papyrus} 0 2px, transparent 2px 21px)`,
            borderTop: `3px solid ${C.papyrus}`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 400 - px / 2 - 2,
            top: 6,
            width: 4,
            height: 48,
            background: C.gold,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 400 + px / 2 - 2,
            top: 6,
            width: 4,
            height: 48,
            background: C.gold,
          }}
        />
      </div>
      <div
        style={{
          color: C.gold,
          fontSize: 64,
          fontFamily: fonts.display,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        ¿ {Math.round(meters)}{" "}
        <span style={{ fontFamily: fonts.body, fontWeight: 600 }}>m</span> ?
      </div>
    </div>
  );
};

export const Comparison: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const c1 = c.start("cmp-1");
  const c2 = c.start("cmp-2");
  const c3 = c.start("cmp-3");
  const c4 = c.start("cmp-4");
  const c5 = c.start("cmp-5");
  const c6 = c.start("cmp-6");

  const short = resultKm(DATA.stadionShort);
  const long = resultKm(DATA.stadionLong);
  const chartUp = prog(frame, c3 - 20, 30, inOut);
  const chartOut = prog(frame, c6 - 4, 30, inOut);
  const inset = prog(frame, c6 + 10, 30, inOut);

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, #13213C 0%, #070B14 75%)",
      }}
    >
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <KineticText
          text="¿Qué tan cerca estuvo?"
          start={c1}
          exit={c2 + 6}
          highlight={["cerca"]}
          style={{ fontSize: 110, fontWeight: 700 }}
        />
      </AbsoluteFill>

      <StadionRuler frame={frame} p={visible(frame, c2 + 10, c3 + 30, 16)} />

      <div
        style={{
          position: "absolute",
          left: 120,
          top: mix(420, 360, chartUp),
          opacity: chartUp * (1 - chartOut * 0.75),
          scale: String(1 - chartOut * 0.35),
          transformOrigin: "left top",
          translate: `0 ${chartOut * -40}px`,
        }}
      >
        <BarChart
          max={50000}
          unit="km"
          ticks={[0, 10000, 20000, 30000, 40000, 50000]}
          width={1000}
          reference={{
            value: DATA.modernMeridianKm,
            label: "medición moderna",
            start: c4 + 10,
          }}
          bars={[
            {
              label: "Eratóstenes",
              sub: `estadio ≈ ${fmt(DATA.stadionShort, 1)} m`,
              value: short,
              color: C.gold,
              start: c3 + 12,
              badge: {
                text: pct(errorPct(short)),
                color: C.cyan,
                start: c.word("cmp-4", "error"),
              },
            },
            {
              label: "Hoy (WGS 84)",
              sub: "de polo a polo",
              value: DATA.modernMeridianKm,
              color: C.cyan,
              start: c4,
            },
            {
              label: "Eratóstenes",
              sub: `estadio ≈ ${DATA.stadionLong} m`,
              value: long,
              color: C.terracotta,
              start: c5 + 10,
              badge: {
                text: pct(errorPct(long)),
                color: C.red,
                start: c.word("cmp-5", "error"),
              },
            },
          ]}
        />
      </div>

      {/* Fuentes de error: Siena no está justo al sur ni justo sobre el trópico */}
      <div
        style={{
          position: "absolute",
          right: 110,
          top: 200,
          width: 760,
          height: 640,
          borderRadius: 24,
          overflow: "hidden",
          border: `2px solid ${C.line}`,
          opacity: inset,
          translate: `${(1 - inset) * 80}px 0`,
        }}
      >
        <div style={{ position: "relative", width: 760, height: 640 }}>
          <GeoMap
            fit={[
              [28.6, 23],
              [34.2, 31.8],
            ]}
            size={{ width: 760, height: 640 }}
          >
            {(m) => {
              const alex = m.project(PLACES.alexandria);
              const syene = m.project(PLACES.syene);
              const ty = m.project([30, TROPIC_LAT])[1];
              return (
                <>
                  <DrawPath
                    d={`M ${alex[0]} ${alex[1]} L ${alex[0]} ${syene[1] + 60}`}
                    progress={prog(frame, c6 + 30, 30)}
                    color={C.cyan}
                    width={3}
                    dashed
                  />
                  <DrawPath
                    d={`M ${alex[0]} ${syene[1]} L ${syene[0]} ${syene[1]}`}
                    progress={prog(frame, c.word("cmp-6", "sur"), 24)}
                    color={C.red}
                    width={5}
                  />
                  <line
                    x1={-200}
                    y1={ty}
                    x2={1200}
                    y2={ty}
                    stroke={C.cyan}
                    strokeWidth={2}
                    strokeDasharray="8 10"
                    opacity={0.7}
                  />
                  <CityMarker
                    at={alex}
                    k={1}
                    label="Alejandría"
                    appear={1}
                    pulse={0}
                    side="right"
                  />
                  <CityMarker
                    at={syene}
                    k={1}
                    label="Siena"
                    appear={1}
                    pulse={0}
                    side="right"
                  />
                  <text
                    x={(alex[0] + syene[0]) / 2}
                    y={syene[1] - 22}
                    textAnchor="middle"
                    fill={C.red}
                    fontSize={34}
                    fontFamily={fonts.body}
                    fontWeight={700}
                    opacity={prog(frame, c.word("cmp-6", "sur") + 10, 14)}
                  >
                    ≈ 3° al este
                  </text>
                </>
              );
            }}
          </GeoMap>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 830,
          width: 900,
          opacity: prog(frame, c.word("cmp-6", "impecable") - 6, 16),
          fontFamily: fonts.display,
          fontSize: 64,
          fontWeight: 700,
          color: C.text,
        }}
      >
        El razonamiento: <span style={{ color: C.gold }}>impecable</span>
      </div>
      <ChapterTag label="V · ¿Acertó?" start={c2 + 10} />
    </AbsoluteFill>
  );
};

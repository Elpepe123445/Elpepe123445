import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ChapterTag } from "../../../components/ChapterTag";
import { Counter } from "../../../components/Counter";
import { DrawPath, Label, polar } from "../../../components/Diagram";
import { CityMarker, GeoMap } from "../../../components/GeoMap";
import { C, fonts, inOut, prog, visible } from "../../../engine/theme";
import { useCues } from "../../../engine/timeline";
import { DATA, PLACES } from "../data";

const EVENTS = [
  { year: "c. 240 a. C.", label: "Eratóstenes" },
  { year: "1492", label: "Colón" },
  { year: "1791", label: "El metro" },
];

/** Línea de tiempo superior: se enciende cada hito cuando la narración llega a él. */
const Timeline: React.FC<{ frame: number; marks: number[] }> = ({
  frame,
  marks,
}) => (
  <svg
    width={1920}
    height={200}
    style={{ position: "absolute", left: 0, top: 150 }}
  >
    <line x1={460} y1={60} x2={1460} y2={60} stroke={C.line} strokeWidth={3} />
    <line
      x1={460}
      y1={60}
      x2={
        460 + 1000 * Math.max(...marks.map((m, i) => (frame >= m ? i / 2 : 0)))
      }
      y2={60}
      stroke={C.gold}
      strokeWidth={3}
    />
    {EVENTS.map((e, i) => {
      const on = prog(frame, marks[i], 14);
      const x = 460 + i * 500;
      return (
        <g key={e.year}>
          <circle
            cx={x}
            cy={60}
            r={12 + 6 * on}
            fill={on > 0 ? C.gold : C.line}
          />
          <text
            x={x}
            y={24}
            textAnchor="middle"
            fill={on > 0 ? C.text : C.muted}
            fontSize={30}
            fontFamily={fonts.display}
            fontWeight={700}
          >
            {e.year}
          </text>
          <text
            x={x}
            y={112}
            textAnchor="middle"
            fill={on > 0 ? C.goldSoft : C.muted}
            fontSize={26}
            fontFamily={fonts.body}
          >
            {e.label}
          </text>
        </g>
      );
    })}
  </svg>
);

export const Legacy: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const l2 = c.start("leg-2");
  const l3 = c.start("leg-3");
  const l4 = c.start("leg-4");
  const asia = c.word("leg-2", "asia");
  const cerca = c.word("leg-2", "cerca");

  const mapIn = visible(frame, 0, l3 + 6, 18);
  const meridian = prog(frame, l3 - 4, 20);
  const ecuador = c.word("leg-3", "ecuador");
  const quarter = prog(
    frame,
    c.word("leg-3", "polo"),
    ecuador - c.word("leg-3", "polo") + 10,
    inOut,
  );
  const full = prog(frame, l4 + 10, 60, inOut);
  const cx = 560;
  const cy = 650;
  const r = 290;

  return (
    <AbsoluteFill style={{ background: C.night }}>
      {/* Colón: la Asia que esperaba frente a la real */}
      <AbsoluteFill style={{ opacity: mapIn }}>
        <GeoMap
          fit={[
            [-230, -12],
            [20, 64],
          ]}
          detail="110m"
          projection="equirectangular"
          rotate={60}
          graticuleStep={15}
        >
          {(m) => {
            const palos = m.project(PLACES.palos);
            const carib = m.project(PLACES.caribbean);
            const japan = m.project([PLACES.japan[0] - 360, PLACES.japan[1]]);
            return (
              <>
                <DrawPath
                  d={`M ${palos[0]} ${palos[1]} Q ${(palos[0] + carib[0]) / 2} ${palos[1] - 160} ${carib[0]} ${carib[1]}`}
                  progress={prog(frame, l2 + 10, 50, inOut)}
                  color={C.gold}
                  width={4}
                />
                <CityMarker
                  at={palos}
                  k={1}
                  label="España"
                  appear={prog(frame, l2, 14)}
                  pulse={0}
                  side="right"
                />
                <CityMarker
                  at={carib}
                  k={1}
                  label="Asia «según Colón»"
                  appear={prog(frame, asia - 4, 14)}
                  pulse={((((frame - asia) % 40) + 40) % 40) / 40}
                  side="right"
                  color={C.goldSoft}
                />
                <DrawPath
                  d={`M ${carib[0]} ${carib[1]} L ${japan[0]} ${japan[1]}`}
                  progress={prog(frame, cerca, 40, inOut)}
                  color={C.red}
                  width={3}
                  dashed
                />
                <CityMarker
                  at={japan}
                  k={1}
                  label="Asia real"
                  appear={prog(frame, cerca + 30, 14)}
                  pulse={0}
                  side="right"
                  color={C.red}
                />
                <text
                  x={m.project([-100, 45])[0]}
                  y={m.project([-100, 45])[1]}
                  fill={C.cyan}
                  fontSize={46}
                  fontFamily={fonts.display}
                  fontWeight={700}
                  opacity={prog(frame, cerca + 20, 16)}
                  textAnchor="middle"
                >
                  AMÉRICA
                </text>
              </>
            );
          }}
        </GeoMap>
      </AbsoluteFill>

      {/* El metro: un cuarto de meridiano */}
      <AbsoluteFill style={{ opacity: meridian }}>
        <svg
          width={1920}
          height={1080}
          style={{ position: "absolute", inset: 0 }}
        >
          <defs>
            <radialGradient id="legEarth" cx="40%" cy="35%">
              <stop offset="0%" stopColor="#2F6DB5" />
              <stop offset="100%" stopColor="#0B2244" />
            </radialGradient>
          </defs>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="url(#legEarth)"
            stroke={C.line}
            strokeWidth={3}
          />
          <line
            x1={cx - r - 30}
            y1={cy}
            x2={cx + r + 30}
            y2={cy}
            stroke={C.muted}
            strokeWidth={2}
            strokeDasharray="8 8"
          />
          <DrawPath
            d={`M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            progress={quarter}
            color={C.gold}
            width={9}
            glow
          />
          {[1, 2, 3].map((q) => {
            const [x0, y0] = polar(cx, cy, r, -90 * (q - 1));
            const [x1, y1] = polar(cx, cy, r, -90 * q);
            return (
              <DrawPath
                key={q}
                d={`M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`}
                progress={prog(full * 3, q - 1, 1, (t) => t)}
                color={C.gold}
                width={9}
                glow
              />
            );
          })}
          <circle cx={cx} cy={cy - r} r={10} fill={C.text} />
          <Label x={cx} y={cy - r - 30} size={34}>
            Polo Norte
          </Label>
          <Label x={cx + r + 40} y={cy + 12} size={34} anchor="start">
            Ecuador
          </Label>
          <Label
            x={polar(cx, cy, r + 70, 45)[0]}
            y={polar(cx, cy, r + 70, 45)[1]}
            size={40}
            anchor="start"
            color={C.gold}
            display
            weight={700}
            opacity={prog(frame, ecuador, 16)}
          >
            10.000 km
          </Label>
        </svg>
        <div
          style={{
            position: "absolute",
            left: 1120,
            top: 400,
            width: 720,
            fontFamily: fonts.display,
            color: C.text,
          }}
        >
          <div
            style={{
              fontSize: 40,
              color: C.muted,
              fontFamily: fonts.body,
              letterSpacing: "0.2em",
              opacity: prog(frame, l3, 16),
            }}
          >
            FRANCIA · {DATA.metreYear}
          </div>
          <div
            style={{
              fontSize: 78,
              fontWeight: 700,
              marginTop: 14,
              opacity: prog(frame, c.word("leg-3", "metro"), 16),
            }}
          >
            1 metro =
          </div>
          <div
            style={{
              fontSize: 66,
              fontWeight: 700,
              color: C.gold,
              opacity: prog(frame, c.word("leg-3", "diezmillon"), 16),
            }}
          >
            1 / 10.000.000
          </div>
          <div
            style={{
              fontSize: 34,
              fontFamily: fonts.body,
              color: C.muted,
              marginTop: 8,
              opacity: prog(frame, c.word("leg-3", "diezmillon") + 10, 16),
            }}
          >
            de la distancia del polo norte al ecuador
          </div>
          <div
            style={{
              fontSize: 120,
              fontWeight: 700,
              color: C.gold,
              marginTop: 40,
              opacity: prog(frame, l4, 14),
              textShadow: `0 0 50px ${C.gold}55`,
            }}
          >
            <Counter
              from={10000}
              to={40000}
              start={l4 + 10}
              duration={60}
              suffix=" km"
            />
          </div>
          <div
            style={{
              fontSize: 32,
              fontFamily: fonts.body,
              color: C.papyrus,
              opacity: prog(frame, l4 + 60, 16),
            }}
          >
            la vuelta a la Tierra, de polo a polo
          </div>
        </div>
      </AbsoluteFill>

      <Timeline frame={frame} marks={[0, l2, l3]} />
      <ChapterTag label="VI · El legado" />
    </AbsoluteFill>
  );
};

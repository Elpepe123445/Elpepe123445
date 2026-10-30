import React, { useMemo } from "react";
import {
  AbsoluteFill,
  random,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CameraRig, Dust } from "../../../components/Atmosphere";
import { KineticText } from "../../../components/KineticText";
import { C, fonts, prog, visible } from "../../../engine/theme";
import { useCues } from "../../../engine/timeline";

const HORIZON = 770;

/** Siluetas lejanas de la ciudad, generadas de forma determinista. */
const Skyline: React.FC<{
  seed: string;
  color: string;
  base: number;
  maxH: number;
  offset: number;
}> = ({ seed, color, base, maxH, offset }) => {
  const shapes = useMemo(() => {
    const out: React.ReactNode[] = [];
    let x = -200;
    let i = 0;
    while (x < 2300) {
      const w = 40 + random(`${seed}w${i}`) * 110;
      const h = 30 + random(`${seed}h${i}`) * maxH;
      const kind = random(`${seed}k${i}`);
      out.push(<rect key={`r${i}`} x={x} y={base - h} width={w} height={h} />);
      if (kind > 0.8)
        out.push(
          <ellipse
            key={`d${i}`}
            cx={x + w / 2}
            cy={base - h}
            rx={w / 2.4}
            ry={w / 3}
          />,
        );
      else if (kind > 0.62)
        out.push(
          <polygon
            key={`p${i}`}
            points={`${x - 6},${base - h} ${x + w / 2},${base - h - w / 3.2} ${x + w + 6},${base - h}`}
          />,
        );
      x += w + random(`${seed}g${i}`) * 26;
      i++;
    }
    return out;
  }, [seed, base, maxH]);
  return (
    <g fill={color} transform={`translate(${offset} 0)`}>
      {shapes}
    </g>
  );
};

/** Faro de Alejandría: tres cuerpos (cuadrado, octogonal, cilíndrico) y fuego en la cima. */
const Pharos: React.FC<{
  x: number;
  base: number;
  beam: number;
  frame: number;
}> = ({ x, base, beam, frame }) => {
  const s = 0.8;
  const top = base - 380 * s;
  const angle = Math.sin(frame / 38) * 26 - 8;
  return (
    <g>
      <g transform={`rotate(${angle} ${x} ${top - 10})`} opacity={0.5 * beam}>
        <polygon
          points={`${x},${top - 10} ${x - 900},${top - 160} ${x - 900},${top + 120}`}
          fill="url(#beam)"
        />
      </g>
      <g fill="#2A1520">
        <path
          d={`M ${x - 130 * s} ${base} L ${x - 175 * s} ${base + 16} L ${x + 175 * s} ${base + 16} L ${x + 130 * s} ${base} Z`}
        />
        <rect
          x={x - 62 * s}
          y={base - 200 * s}
          width={124 * s}
          height={200 * s}
        />
        <rect
          x={x - 46 * s}
          y={base - 310 * s}
          width={92 * s}
          height={110 * s}
        />
        <rect
          x={x - 28 * s}
          y={base - 370 * s}
          width={56 * s}
          height={60 * s}
        />
        <rect
          x={x - 72 * s}
          y={base - 206 * s}
          width={144 * s}
          height={8 * s}
        />
        <rect
          x={x - 54 * s}
          y={base - 316 * s}
          width={108 * s}
          height={7 * s}
        />
      </g>
      <circle
        cx={x}
        cy={top - 6}
        r={14 + Math.sin(frame / 3) * 2}
        fill="#FFD27A"
      />
      <circle cx={x} cy={top - 6} r={46} fill="url(#fire)" />
    </g>
  );
};

/** Biblioteca: frontón, columnas y escalinata con luz de borde dorada. */
const Library: React.FC<{ x: number; base: number; w: number }> = ({
  x,
  base,
  w,
}) => {
  const cols = 8;
  const colW = w / (cols * 2 - 1);
  const h = 250;
  return (
    <g>
      <g fill="#1E1018">
        <rect x={x - 30} y={base - 18} width={w + 60} height={18} />
        <rect x={x - 15} y={base - 32} width={w + 30} height={14} />
        {new Array(cols).fill(0).map((_, i) => (
          <rect
            key={i}
            x={x + i * colW * 2}
            y={base - 32 - h}
            width={colW}
            height={h}
          />
        ))}
        <rect x={x - 20} y={base - 32 - h - 40} width={w + 40} height={40} />
        <polygon
          points={`${x - 30},${base - 32 - h - 40} ${x + w / 2},${base - 32 - h - 150} ${x + w + 30},${base - 32 - h - 40}`}
        />
      </g>
      <polyline
        points={`${x - 30},${base - 32 - h - 40} ${x + w / 2},${base - 32 - h - 150} ${x + w + 30},${base - 32 - h - 40}`}
        fill="none"
        stroke={C.goldSoft}
        strokeWidth={3}
        opacity={0.55}
      />
    </g>
  );
};

/** Palmera estilizada. */
const Palm: React.FC<{
  x: number;
  base: number;
  h: number;
  lean: number;
  sway: number;
}> = ({ x, base, h, lean, sway }) => {
  const tx = x + lean;
  const ty = base - h;
  return (
    <g fill="#0E070B" stroke="#0E070B">
      <path
        d={`M ${x - 9} ${base} Q ${x + lean * 0.3} ${base - h * 0.5} ${tx - 4} ${ty} L ${tx + 4} ${ty} Q ${x + lean * 0.3 + 10} ${base - h * 0.5} ${x + 9} ${base} Z`}
      />
      {new Array(7).fill(0).map((_, i) => {
        const a = -170 + i * 48 + sway;
        const r = 150;
        const ex = tx + Math.cos((a * Math.PI) / 180) * r;
        const ey = ty + Math.sin((a * Math.PI) / 180) * r * 0.55 + 40;
        return (
          <path
            key={i}
            d={`M ${tx} ${ty} Q ${(tx + ex) / 2} ${ty - 50} ${ex} ${ey}`}
            fill="none"
            strokeWidth={14}
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
};

/** Silueta de Eratóstenes con himation y vara; luz de borde del atardecer. */
const Scholar: React.FC<{
  x: number;
  base: number;
  scale: number;
  rim: number;
}> = ({ x, base, scale, rim }) => {
  const body =
    "M -26 -268 C -46 -258 -54 -226 -54 -196 L -60 -70 C -62 -40 -66 -14 -70 0 L 58 0 C 56 -30 52 -78 48 -118 L 60 -176 C 64 -186 68 -192 64 -200 L 40 -204 L 36 -248 C 34 -262 24 -270 12 -272 Z";
  const head =
    "M -4 -276 C -24 -278 -32 -296 -30 -312 C -28 -330 -12 -340 4 -338 C 22 -336 30 -322 28 -306 L 34 -298 L 28 -294 C 28 -282 18 -270 2 -262 C -6 -266 -6 -272 -4 -276 Z";
  const beard =
    "M -6 -284 C -10 -270 -4 -256 8 -252 C 18 -258 24 -270 22 -286 Z";
  return (
    <g transform={`translate(${x} ${base}) scale(${scale})`}>
      <ellipse cx={-120} cy={4} rx={150} ry={10} fill="#000" opacity={0.45} />
      <line
        x1={78}
        y1={2}
        x2={78}
        y2={-380}
        stroke="#0B0609"
        strokeWidth={9}
        strokeLinecap="round"
      />
      <g fill="#0B0609">
        <path d={body} />
        <path d={head} />
        <path d={beard} />
        <path d="M 40 -200 C 56 -206 70 -212 80 -214 L 82 -200 C 70 -196 58 -190 48 -186 Z" />
      </g>
      <g fill="none" stroke={C.goldSoft} strokeWidth={3.5} opacity={0.95 * rim}>
        <path d="M 28 -306 L 34 -298 L 28 -294 C 28 -282 18 -270 8 -264" />
        <path d="M 60 -176 C 64 -186 68 -192 64 -200" />
        <path d="M 58 0 C 56 -30 52 -78 48 -118" />
        <line x1={82} y1={0} x2={82} y2={-380} />
      </g>
    </g>
  );
};

const Callout: React.FC<{
  x: number;
  y: number;
  tx: number;
  ty: number;
  title: string;
  p: number;
  o: number;
}> = ({ x, y, tx, ty, title, p, o }) => (
  <g opacity={o}>
    <circle cx={x} cy={y} r={7} fill={C.gold} opacity={p} />
    <line
      x1={x}
      y1={y}
      x2={x + (tx - x) * p}
      y2={y + (ty - y) * p}
      stroke={C.gold}
      strokeWidth={2}
    />
    <text
      x={tx}
      y={ty - 14}
      fill={C.text}
      fontFamily={fonts.display}
      fontSize={40}
      fontWeight={700}
      textAnchor="middle"
      opacity={p}
      style={{ paintOrder: "stroke", stroke: "#0009", strokeWidth: 6 }}
    >
      {title}
    </text>
  </g>
);

export const Alexandria: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = useCues();
  const a1 = c.start("alex-1");
  const a3 = c.start("alex-3");
  const a5 = c.start("alex-5");
  const faro = c.word("alex-2", "faro");
  const biblio = c.word("alex-2", "biblioteca");
  const roles = ["matemático", "astrónomo", "poeta", "geografía"].map((w) =>
    c.word("alex-4", w),
  );
  const beta = c.word("alex-5", "beta");
  const scholarIn = spring({
    frame: frame - a3 + 6,
    fps,
    config: { damping: 200 },
  });
  const dim = prog(frame, a5, 24);

  return (
    <AbsoluteFill style={{ background: "#120A14" }}>
      <CameraRig
        keys={[
          { f: 0, scale: 1.08, x: 60 },
          { f: a3, scale: 1.02, x: -10 },
          { f: c.duration, scale: 1.1, x: -50, y: 10 },
        ]}
      >
        <svg width={1920} height={1080} viewBox="0 0 1920 1080">
          <defs>
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1A1230" />
              <stop offset="45%" stopColor="#6E2F3A" />
              <stop offset="78%" stopColor="#D9793F" />
              <stop offset="100%" stopColor="#F6B460" />
            </linearGradient>
            <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5A2C3A" />
              <stop offset="100%" stopColor="#120A14" />
            </linearGradient>
            <radialGradient id="sunHalo">
              <stop offset="0%" stopColor="#FFE7B3" stopOpacity={1} />
              <stop offset="30%" stopColor="#F7B55B" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#F7B55B" stopOpacity={0} />
            </radialGradient>
            <linearGradient id="beam" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0%" stopColor="#FFE1A0" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#FFE1A0" stopOpacity={0} />
            </linearGradient>
            <radialGradient id="fire">
              <stop offset="0%" stopColor="#FFD27A" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#FF9A3C" stopOpacity={0} />
            </radialGradient>
          </defs>
          <rect width={1920} height={HORIZON} fill="url(#sky)" />
          <circle
            cx={1180}
            cy={HORIZON - 40 + frame * 0.05}
            r={340}
            fill="url(#sunHalo)"
          />
          <circle
            cx={1180}
            cy={HORIZON - 40 + frame * 0.05}
            r={62}
            fill="#FFE2A6"
          />
          <Skyline
            seed="far"
            color="#7A3540"
            base={HORIZON}
            maxH={70}
            offset={-frame * 0.08}
          />
          <rect
            y={HORIZON}
            width={1920}
            height={1080 - HORIZON}
            fill="url(#sea)"
          />
          {new Array(26).fill(0).map((_, i) => {
            const y = HORIZON + 8 + i * 9;
            const w = 30 + random(`sw${i}`) * 140 * (1 - i / 30);
            const x =
              1180 +
              (random(`sx${i}`) - 0.5) * (80 + i * 18) +
              Math.sin(frame / 12 + i) * 10;
            return (
              <rect
                key={i}
                x={x - w / 2}
                y={y}
                width={w}
                height={3}
                fill="#FFD9A0"
                opacity={0.55 - i * 0.018}
              />
            );
          })}
          <Pharos x={1690} base={HORIZON + 6} beam={1} frame={frame} />
          <Skyline
            seed="mid"
            color="#3A1C28"
            base={HORIZON + 40}
            maxH={130}
            offset={-frame * 0.18 - 300}
          />
          <Library x={120} base={900} w={560} />
          <rect y={900} width={1920} height={180} fill="#0F080D" />
          <Palm
            x={60}
            base={905}
            h={420}
            lean={40}
            sway={Math.sin(frame / 50) * 4}
          />
          <Palm
            x={1870}
            base={905}
            h={360}
            lean={-50}
            sway={Math.sin(frame / 45 + 1) * 4}
          />
          {new Array(5).fill(0).map((_, i) => {
            const bx =
              ((300 + i * 260 + frame * (1.2 + i * 0.15)) % 2300) - 200;
            const by = 200 + i * 40 + Math.sin(frame / 20 + i) * 12;
            const flap = Math.sin(frame / 4 + i) * 6;
            return (
              <path
                key={i}
                d={`M ${bx - 14} ${by - flap} Q ${bx - 6} ${by - 4} ${bx} ${by} Q ${bx + 6} ${by - 4} ${bx + 14} ${by - flap}`}
                stroke="#1A0E16"
                strokeWidth={3}
                fill="none"
              />
            );
          })}
          <g
            opacity={scholarIn}
            transform={`translate(${(1 - scholarIn) * 40} 0)`}
          >
            <Scholar x={840} base={940} scale={1.4} rim={scholarIn} />
          </g>
          <Callout
            x={1690}
            y={HORIZON - 300}
            tx={1500}
            ty={300}
            title="El Faro"
            p={prog(frame, faro - 4, 20)}
            o={visible(frame, faro - 4, a3 + 10, 12)}
          />
          <Callout
            x={400}
            y={560}
            tx={400}
            ty={330}
            title="La Gran Biblioteca"
            p={prog(frame, biblio - 4, 20)}
            o={visible(frame, biblio - 4, a3 + 10, 12)}
          />
        </svg>
      </CameraRig>
      <Dust count={60} opacity={0.5} />

      <AbsoluteFill style={{ background: "#05030A", opacity: dim * 0.82 }} />

      {/* Rótulo de lugar */}
      <div
        style={{
          position: "absolute",
          left: 120,
          bottom: 170,
          opacity: visible(frame, a1 - 4, a3, 14),
        }}
      >
        <KineticText
          text="ALEJANDRÍA"
          start={a1}
          mode="track"
          style={{ fontSize: 130, fontWeight: 700, color: C.papyrus }}
        />
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: 38,
            color: C.goldSoft,
            letterSpacing: "0.3em",
            marginTop: 6,
            opacity: prog(frame, a1 + 16, 20),
          }}
        >
          EGIPTO · SIGLO III a. C.
        </div>
      </div>

      {/* Ficha del personaje */}
      <div
        style={{
          position: "absolute",
          left: 1010,
          top: 300,
          width: 820,
          opacity: visible(frame, a3, a5 + 6, 14),
        }}
      >
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: 30,
            letterSpacing: "0.32em",
            color: C.goldSoft,
            opacity: prog(frame, a3, 14),
          }}
        >
          DIRECTOR DE LA BIBLIOTECA
        </div>
        <KineticText
          text="Eratóstenes de Cirene"
          start={a3 + 6}
          highlight={["Eratóstenes"]}
          style={{ fontSize: 76, fontWeight: 700, marginTop: 8 }}
        />
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: 34,
            color: C.papyrus,
            marginTop: 6,
            opacity: prog(frame, a3 + 20, 16),
            textShadow: "0 2px 12px #000a",
          }}
        >
          c. 276 – 194 a. C.
        </div>
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 18, marginTop: 36 }}
        >
          {["Matemático", "Astrónomo", "Poeta", "Geógrafo"].map((r, i) => {
            const s = spring({
              frame: frame - roles[i] + 2,
              fps,
              config: { damping: 14, mass: 0.6 },
            });
            return (
              <span
                key={r}
                style={{
                  fontFamily: fonts.body,
                  fontSize: 34,
                  fontWeight: 600,
                  color: C.night,
                  background: i === 3 ? C.gold : C.papyrus,
                  padding: "8px 22px",
                  borderRadius: 40,
                  scale: String(frame >= roles[i] - 2 ? s : 0),
                }}
              >
                {r}
              </span>
            );
          })}
        </div>
      </div>

      {/* Apodo «Beta» */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: prog(frame, beta - 8, 14),
        }}
      >
        <svg width={600} height={460} viewBox="0 0 600 460">
          <text
            x={300}
            y={360}
            textAnchor="middle"
            fontFamily="DejaVu Serif, serif"
            fontSize={400}
            fill={C.gold}
            fillOpacity={prog(frame, beta + 14, 20)}
            stroke={C.goldSoft}
            strokeWidth={4}
            strokeDasharray={`${prog(frame, beta - 8, 34) * 2600} 2600`}
            style={{ filter: `drop-shadow(0 0 40px ${C.gold}88)` }}
          >
            β
          </text>
        </svg>
        <div
          style={{
            fontFamily: fonts.display,
            fontSize: 64,
            color: C.text,
            marginTop: -10,
            opacity: prog(frame, beta + 6, 16),
          }}
        >
          «Beta»
        </div>
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: 36,
            color: C.muted,
            marginTop: 12,
            opacity: prog(frame, c.word("alex-5", "segundo"), 16),
          }}
        >
          el segundo mejor… en casi todo
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

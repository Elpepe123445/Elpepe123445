import React from "react";
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  AztecTemple,
  Clay,
  ClayDefs,
  Cleopatra,
  Hanafuda,
  Island,
  Mammoth,
  Moon,
  Oxford,
  PineTree,
  Pyramid,
  Shark,
  Stego,
  StumpRings,
  TopHat,
  Tree,
  TRex,
} from "../../components/clay/Clay";
import { fmt, inOut, mix, prog } from "../../engine/theme";
import { useCues } from "../../engine/timeline";

const FONT = "Inter, DejaVu Sans, sans-serif";
export const BG = {
  cleo: "linear-gradient(180deg, #FFD9C2 0%, #F9B9A7 100%)",
  mamut: "linear-gradient(180deg, #CFE8F7 0%, #A9D2EE 100%)",
  arbol: "linear-gradient(180deg, #E2F0CB 0%, #BFDDA4 100%)",
  oxford: "linear-gradient(180deg, #FCE8B8 0%, #F5CF85 100%)",
  nintendo: "linear-gradient(180deg, #E6DDF9 0%, #C9B9F0 100%)",
  dinos: "linear-gradient(180deg, #D8F3E4 0%, #A9E0C5 100%)",
  tiburon: "linear-gradient(180deg, #BEE7F2 0%, #7FC7DD 100%)",
  final: "linear-gradient(180deg, #FFE2EC 0%, #F7BFD3 100%)",
};

/** Tarjeta de plastilina con texto (la forma recibe volumen; el texto queda nítido encima). */
const Card: React.FC<{
  y: number;
  h: number;
  color: string;
  children: React.ReactNode;
  o?: number;
  pop?: number;
}> = ({ y, h, color, children, o = 1, pop = 1 }) => (
  <>
    <svg
      width={1080}
      height={y + h + 60}
      style={{ position: "absolute", left: 0, top: 0, opacity: o }}
    >
      <ClayDefs />
      <Clay
        transform={`translate(540 ${y + h / 2}) scale(${pop}) translate(-540 ${-(y + h / 2)})`}
      >
        <rect x={70} y={y} width={940} height={h} rx={44} fill={color} />
      </Clay>
    </svg>
    <div
      style={{
        position: "absolute",
        left: 110,
        right: 110,
        top: y,
        height: h,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        fontFamily: FONT,
        color: "#2B1F33",
        opacity: o,
        scale: String(pop),
      }}
    >
      {children}
    </div>
  </>
);

const Headline: React.FC<{ children: React.ReactNode; size?: number }> = ({
  children,
  size = 54,
}) => (
  <div style={{ fontWeight: 900, fontSize: size, lineHeight: 1.08 }}>
    {children}
  </div>
);

/** Línea de tiempo de plastilina con marcas. `x(year)` convierte año → píxel. */
const Timeline: React.FC<{
  y: number;
  ticks: { at: number; label: string; dy?: number }[];
  x: (v: number) => number;
  color?: string;
  o?: number;
}> = ({ y, ticks, x, color = "#FFFFFF", o = 1 }) => (
  <g opacity={o}>
    <Clay>
      <rect x={70} y={y - 14} width={940} height={28} rx={14} fill={color} />
    </Clay>
    {ticks.map((t) => (
      <g key={t.label}>
        <Clay>
          <circle cx={x(t.at)} cy={y} r={16} fill="#2B1F33" />
        </Clay>
        <text
          x={x(t.at)}
          y={y + 62 + (t.dy ?? 0)}
          textAnchor="middle"
          fontFamily={FONT}
          fontWeight={800}
          fontSize={30}
          fill="#2B1F33"
        >
          {t.label}
        </text>
      </g>
    ))}
  </g>
);

/** Corchete curvo entre dos puntos de la línea con la distancia temporal. */
const Gap: React.FC<{
  x1: number;
  x2: number;
  y: number;
  label: string;
  color: string;
  p: number;
  up?: boolean;
}> = ({ x1, x2, y, label, color, p, up = true }) => {
  if (p <= 0) return null;
  const h = up ? -70 : 70;
  const xm = x1 + (x2 - x1) * p;
  return (
    <g>
      <Clay>
        <path
          d={`M ${x1} ${y} Q ${(x1 + xm) / 2} ${y + h * 1.6} ${xm} ${y}`}
          stroke={color}
          strokeWidth={14}
          fill="none"
          strokeLinecap="round"
        />
      </Clay>
      <text
        x={(x1 + x2) / 2}
        y={y + h * 1.25 + (up ? -10 : 40)}
        textAnchor="middle"
        fontFamily={FONT}
        fontWeight={900}
        fontSize={46}
        fill={color}
        opacity={Math.min(1, Math.max(0, (p - 0.6) / 0.3))}
        style={{ paintOrder: "stroke", stroke: "#FFFFFF", strokeWidth: 8 }}
      >
        {label}
      </text>
    </g>
  );
};

/** Aparición elástica (squash & stretch) típica de la plastilina. */
const usePop = (at: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    frame: frame - at,
    fps,
    config: { damping: 9, mass: 0.6, stiffness: 140 },
  });
  return frame < at ? 0 : s;
};

const Figure: React.FC<{
  x: number;
  y: number;
  s: number;
  children: React.ReactNode;
  scale?: number;
}> = ({ x, y, s, children, scale = 1 }) =>
  s <= 0 ? null : (
    <Clay
      transform={`translate(${x} ${y}) scale(${1.45 * scale * (0.6 + 0.4 * s) * (1 + (1 - s) * 0.3)} ${1.45 * scale * s})`}
    >
      {children}
    </Clay>
  );

// Escala común −2700 … 2000 (años) para las escenas de Egipto.
const xYear = (y: number) => 200 + ((y + 2700) / 4700) * 690;

/** 1 · Cleopatra: más cerca de la Luna que de la Gran Pirámide. */
export const TCleo: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const pyr = usePop(c.word("h1", "piramide") - 4);
  const cleo = usePop(6);
  const luna = usePop(c.word("h1", "luna") - 4);
  const g1 = prog(frame, c.start("h2"), 40, inOut);
  const g2 = prog(frame, c.start("h2") + 30, 40, inOut);
  const ty = 1090;
  return (
    <AbsoluteFill style={{ background: BG.cleo }}>
      <Card y={210} h={230} color="#FFF3EA" pop={usePop(2)}>
        <Headline>Cleopatra vivió más cerca</Headline>
        <Headline>
          de la <span style={{ color: "#3C5BD6" }}>Luna</span> que de la{" "}
          <span style={{ color: "#C9913F" }}>Pirámide</span>
        </Headline>
      </Card>
      <svg
        width={1080}
        height={1920}
        style={{ position: "absolute", inset: 0 }}
      >
        <ClayDefs />
        <Timeline
          y={ty}
          x={xYear}
          ticks={[
            { at: -2560, label: "2560 a. C." },
            { at: -69, label: "69 a. C." },
            { at: 1969, label: "1969" },
          ]}
        />
        <Figure x={xYear(-2560)} y={ty - 40} s={pyr} scale={0.95}>
          <Pyramid />
        </Figure>
        <Figure x={xYear(-69)} y={ty - 40} s={cleo} scale={0.95}>
          <Cleopatra />
        </Figure>
        <Figure x={xYear(1969)} y={ty - 40} s={luna} scale={0.85}>
          <Moon />
        </Figure>
        <Gap
          x1={xYear(-2560)}
          x2={xYear(-69)}
          y={ty + 110}
          label="≈ 2.500 años"
          color="#C9913F"
          p={g1}
          up={false}
        />
        <Gap
          x1={xYear(-30)}
          x2={xYear(1969)}
          y={ty + 110}
          label="≈ 2.000 años"
          color="#3C5BD6"
          p={g2}
          up={false}
        />
      </svg>
    </AbsoluteFill>
  );
};

/** 2 · Mamuts vivos mientras se construían las pirámides (isla de Wrangel). */
export const TMammoth: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const pyr = usePop(4);
  const mam = usePop(c.word("h3", "mamuts") - 6);
  const walk = mix(-260, 0, prog(frame, c.word("h3", "mamuts") - 6, 50, inOut));
  const ty = 1090;
  return (
    <AbsoluteFill style={{ background: BG.mamut }}>
      <Card y={210} h={230} color="#F3FAFF" pop={usePop(2)}>
        <Headline>Mientras se construían</Headline>
        <Headline>
          las pirámides… <span style={{ color: "#8A5634" }}>había mamuts</span>
        </Headline>
      </Card>
      <svg
        width={1080}
        height={1920}
        style={{ position: "absolute", inset: 0 }}
      >
        <ClayDefs />
        <Timeline
          y={ty}
          x={xYear}
          ticks={[
            { at: -2560, label: "2560 a. C." },
            { at: -2000, label: "≈ 2000 a. C.", dy: 44 },
          ]}
        />
        <Figure x={xYear(-2560)} y={ty - 40} s={pyr} scale={0.9}>
          <Pyramid />
        </Figure>
        <Clay
          transform={`translate(${xYear(-2000) + 150} ${ty - 50})`}
          opacity={prog(frame, c.word("h3", "isla") - 6, 12)}
        >
          <Island />
        </Clay>
        <Figure x={xYear(-2000) + 150 + walk} y={ty - 60} s={mam} scale={0.85}>
          <Mammoth step={frame / 4} />
        </Figure>
        <text
          x={xYear(-2000) + 150}
          y={ty + 140}
          textAnchor="middle"
          fontFamily={FONT}
          fontWeight={800}
          fontSize={30}
          fill="#2B1F33"
          opacity={prog(frame, c.word("h3", "artico") - 4, 12)}
        >
          isla de Wrangel · Ártico
        </text>
      </svg>
    </AbsoluteFill>
  );
};

/** 3 · Matusalén: un pino vivo desde antes de la Gran Pirámide. */
export const TTree: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const pine = usePop(c.word("h3b", "pino") - 6);
  const pyr = usePop(c.word("h3b", "piramide") - 6);
  const rings = Math.round(
    14 * prog(frame, c.word("h3b", "tiene") - 6, 40, inOut),
  );
  const years = Math.round(
    4800 * prog(frame, c.word("h3b", "tiene") - 6, 40, inOut),
  );
  const ty = 1090;
  return (
    <AbsoluteFill style={{ background: BG.arbol }}>
      <Card y={210} h={230} color="#F6FBEE" pop={usePop(2)}>
        <Headline>Un pino que ya estaba vivo</Headline>
        <Headline>
          cuando se hizo la <span style={{ color: "#C9913F" }}>pirámide</span>
        </Headline>
      </Card>
      <svg
        width={1080}
        height={1920}
        style={{ position: "absolute", inset: 0 }}
      >
        <ClayDefs />
        <Timeline
          y={ty}
          x={xYear}
          ticks={[
            { at: -2833, label: "≈ 2830 a. C." },
            { at: -2560, label: "2560 a. C.", dy: 44 },
            { at: 2025, label: "hoy" },
          ]}
        />
        <Figure x={xYear(-2833) + 40} y={ty - 40} s={pine} scale={0.85}>
          <PineTree />
        </Figure>
        <Figure x={xYear(-2560) + 140} y={ty - 40} s={pyr} scale={0.7}>
          <Pyramid />
        </Figure>
        <Clay
          transform={`translate(${xYear(2025) - 150} ${ty - 300})`}
          opacity={prog(frame, c.word("h3b", "tiene") - 8, 10)}
        >
          <StumpRings rings={rings} />
        </Clay>
        <text
          x={xYear(2025) - 150}
          y={ty - 180}
          textAnchor="middle"
          fontFamily={FONT}
          fontWeight={900}
          fontSize={56}
          fill="#2B1F33"
          opacity={prog(frame, c.word("h3b", "tiene") - 8, 10)}
        >
          {fmt(years)}+ años
        </text>
        <text
          x={xYear(-2833) + 40}
          y={ty + 140}
          textAnchor="middle"
          fontFamily={FONT}
          fontWeight={800}
          fontSize={28}
          fill="#2B1F33"
          opacity={pine}
        >
          «Matusalén», California
        </text>
      </svg>
    </AbsoluteFill>
  );
};

/** 4 · Oxford (1096) es anterior a Tenochtitlan (1325). */
export const TOxford: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const xs = (y: number) => 140 + ((y - 1000) / 500) * 800;
  const ox = usePop(c.word("h4", "oxford") - 4);
  const az = usePop(c.word("h4", "tenochtitlan") - 6);
  const ty = 1090;
  return (
    <AbsoluteFill style={{ background: BG.oxford }}>
      <Card y={210} h={230} color="#FFF8E6" pop={usePop(2)}>
        <Headline>Oxford es más antigua</Headline>
        <Headline>
          que la capital <span style={{ color: "#B86A3C" }}>azteca</span>
        </Headline>
      </Card>
      <svg
        width={1080}
        height={1920}
        style={{ position: "absolute", inset: 0 }}
      >
        <ClayDefs />
        <Timeline
          y={ty}
          x={xs}
          ticks={[
            { at: 1096, label: "1096" },
            { at: 1325, label: "1325" },
          ]}
        />
        <Figure x={xs(1096)} y={ty - 40} s={ox} scale={0.9}>
          <Oxford />
        </Figure>
        <Figure x={xs(1325) + 60} y={ty - 40} s={az} scale={0.9}>
          <AztecTemple />
        </Figure>
        <Gap
          x1={xs(1096)}
          x2={xs(1325)}
          y={ty + 110}
          label="229 años antes"
          color="#8C6A4A"
          p={prog(frame, c.word("h4", "capital") - 6, 40, inOut)}
          up={false}
        />
      </svg>
    </AbsoluteFill>
  );
};

/** 5 · Nintendo (1889) y Jack el Destripador (1888). */
export const TNintendo: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const xs = (y: number) => 160 + ((y - 1886) / 5) * 760;
  const card = usePop(c.word("h5", "nintendo") - 2);
  const hat = usePop(c.word("h5", "destripador") - 10);
  const ty = 1090;
  return (
    <AbsoluteFill style={{ background: BG.nintendo }}>
      <Card y={210} h={230} color="#F8F4FF" pop={usePop(2)}>
        <Headline>Nintendo existe desde</Headline>
        <Headline>
          la época de{" "}
          <span style={{ color: "#8E2C3C" }}>Jack el Destripador</span>
        </Headline>
      </Card>
      <svg
        width={1080}
        height={1920}
        style={{ position: "absolute", inset: 0 }}
      >
        <ClayDefs />
        <Timeline
          y={ty}
          x={xs}
          ticks={[
            { at: 1888, label: "1888" },
            { at: 1889, label: "1889" },
          ]}
        />
        <Figure x={xs(1888) - 70} y={ty - 40} s={hat} scale={0.9}>
          <TopHat />
        </Figure>
        <g
          transform={`rotate(${Math.sin(frame / 12) * 4} ${xs(1889) + 90} ${ty - 140})`}
        >
          <Figure x={xs(1889) + 90} y={ty - 40} s={card} scale={1}>
            <Hanafuda />
          </Figure>
        </g>
        <text
          x={xs(1889) + 90}
          y={ty + 140}
          textAnchor="middle"
          fontFamily={FONT}
          fontWeight={800}
          fontSize={28}
          fill="#2B1F33"
          opacity={card}
        >
          empezó haciendo naipes hanafuda
        </text>
      </svg>
    </AbsoluteFill>
  );
};

/** 6 · El tiranosaurio está más cerca de nosotros que del estegosaurio. */
export const TDinos: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const xs = (mya: number) => 120 + ((160 - mya) / 160) * 840;
  const rex = usePop(c.word("h6", "tiranosaurio") - 2);
  const steg = usePop(c.word("h6", "estegosaurio") - 8);
  const ty = 1090;
  return (
    <AbsoluteFill style={{ background: BG.dinos }}>
      <Card y={210} h={230} color="#F2FBF6" pop={usePop(2)}>
        <Headline>El T. rex está más cerca de ti</Headline>
        <Headline>
          que del <span style={{ color: "#3C66B8" }}>estegosaurio</span>
        </Headline>
      </Card>
      <svg
        width={1080}
        height={1920}
        style={{ position: "absolute", inset: 0 }}
      >
        <ClayDefs />
        <Timeline
          y={ty}
          x={xs}
          ticks={[
            { at: 150, label: "150 M" },
            { at: 67, label: "67 M" },
            { at: 0, label: "hoy" },
          ]}
        />
        <Figure x={xs(150) + 40} y={ty - 40} s={steg} scale={0.7}>
          <Stego step={frame / 5} />
        </Figure>
        <Figure x={xs(67)} y={ty - 40} s={rex} scale={0.75}>
          <TRex step={frame / 4} />
        </Figure>
        <Gap
          x1={xs(150)}
          x2={xs(67)}
          y={ty + 110}
          label="≈ 83 M años"
          color="#3C66B8"
          p={prog(frame, c.word("h6", "estegosaurio") - 4, 30, inOut)}
          up={false}
        />
        <Gap
          x1={xs(67)}
          x2={xs(0)}
          y={ty + 110}
          label="≈ 67 M"
          color="#3E8E5A"
          p={prog(frame, c.word("h6", "nosotros") - 4, 30, inOut)}
          up={false}
        />
      </svg>
    </AbsoluteFill>
  );
};

/** 7 · Los tiburones son más antiguos que los árboles. */
export const TShark: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const xs = (mya: number) => 120 + ((480 - mya) / 480) * 840;
  const shark = usePop(c.word("h7", "tiburones") - 4);
  const tree = usePop(c.word("h7", "arboles") - 6);
  const ty = 1090;
  const swim = mix(
    -120,
    0,
    prog(frame, c.word("h7", "tiburones") - 4, 40, inOut),
  );
  return (
    <AbsoluteFill style={{ background: BG.tiburon }}>
      <Card y={210} h={230} color="#EFFAFD" pop={usePop(2)}>
        <Headline>Hay tiburones desde antes</Headline>
        <Headline>
          de que existieran los{" "}
          <span style={{ color: "#3E7D4C" }}>árboles</span>
        </Headline>
      </Card>
      <svg
        width={1080}
        height={1920}
        style={{ position: "absolute", inset: 0 }}
      >
        <ClayDefs />
        <Timeline
          y={ty}
          x={xs}
          ticks={[
            { at: 450, label: "450 M" },
            { at: 385, label: "385 M" },
            { at: 0, label: "hoy" },
          ]}
        />
        <Figure x={xs(450) + 80 + swim} y={ty - 340} s={shark} scale={0.75}>
          <Shark swim={frame / 6} />
        </Figure>
        <Figure x={xs(385) + 40} y={ty - 40} s={tree} scale={0.9}>
          <Tree />
        </Figure>
      </svg>
    </AbsoluteFill>
  );
};

/** 8 · Cierre: ¿cuál te sorprendió más? */
export const TFinal: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const items: [React.FC, number, number][] = [
    [Pyramid as React.FC, 250, 760],
    [Mammoth as React.FC, 800, 760],
    [Hanafuda as React.FC, 250, 1150],
    [Shark as React.FC, 820, 1150],
  ];
  return (
    <AbsoluteFill style={{ background: BG.final }}>
      <Card y={210} h={230} color="#FFF4F8" pop={usePop(2)}>
        <Headline size={58}>El tiempo es más largo</Headline>
        <Headline size={58}>de lo que parece</Headline>
      </Card>
      <svg
        width={1080}
        height={1920}
        style={{ position: "absolute", inset: 0 }}
      >
        <ClayDefs />
        {items.map(([Comp, x, y], i) => {
          const s = Math.min(1, Math.max(0, (frame - 10 - i * 8) / 14));
          return (
            <Figure
              key={i}
              x={x}
              y={y + Math.sin(frame / 10 + i) * 8}
              s={s}
              scale={0.6}
            >
              <Comp />
            </Figure>
          );
        })}
      </svg>
      <Card
        y={1250}
        h={130}
        color="#FFFFFF"
        o={prog(frame, c.word("h8", "cual") - 4, 10)}
        pop={usePop(c.word("h8", "cual") - 4)}
      >
        <Headline size={44}>¿Cuál te sorprendió más?</Headline>
      </Card>
    </AbsoluteFill>
  );
};

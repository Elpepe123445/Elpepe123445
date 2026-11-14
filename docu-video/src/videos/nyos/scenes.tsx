import React from "react";
import {
  AbsoluteFill,
  random,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { faceLon } from "../../components/Globe3D";
import {
  DotEarth,
  globePoint,
  PointCloud,
  project,
  useDotGeometry,
  useHighlightGeometry,
  useLandDots,
} from "../../components/three/Dots";
import { FactCard } from "../../components/three/FactCard";
import { Pin } from "../../components/three/Pin";
import { Bokeh, Stage } from "../../components/three/Stage";
import { fmt, fonts, inOut, mix, prog, visible } from "../../engine/theme";
import { useCues } from "../../engine/timeline";
import {
  Bottle,
  COLUMN_H,
  CRATER,
  GasCloud,
  Jet,
  Lake,
  MoonGlint,
  N,
  Rivers,
  Terrain,
  VALLEY_Z0,
  VALLEY_Z1,
  VillageLights,
  WaterColumn,
} from "./models";

// Resolución interna del WebGL: 0,7 en la nube (software); REMOTION_DPR=1 con GPU.
const DPR = Number(process.env.REMOTION_DPR ?? 0.7);
const W = 1080;
const H = 1920;
type V3 = [number, number, number];
const linear = (t: number) => t;
/** Rampa 0→1 entre `a` y `b` para valores que no son fotogramas. */
const ramp = (x: number, a: number, b: number) =>
  Math.min(1, Math.max(0, (x - a) / (b - a)));

/** Luces y planos de recorte de las escenas de paisaje nocturno. */
const NIGHT = { env: 0.08, ambient: 0.2, fillIntensity: 0, near: 2, far: 140 };

const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.6 }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse at 50% 46%, transparent 52%, rgba(0,0,0,${strength}) 100%)`,
    }}
  />
);

// --- 1 · El misterio: las luces del valle se apagan sin causa visible --------------------------

/** Insignia redonda con un icono que queda tachado. */
const Badge: React.FC<{
  x: number;
  y: number;
  o: number;
  cross: number;
  children: React.ReactNode;
}> = ({ x, y, o, cross, children }) => (
  <svg
    width={260}
    height={260}
    viewBox="-130 -130 260 260"
    style={{
      position: "absolute",
      left: x - 130,
      top: y - 130,
      opacity: Math.min(1, o),
      scale: String(0.5 + 0.5 * o),
    }}
  >
    <circle
      r={112}
      fill="rgba(6,10,26,0.78)"
      stroke="#FFFFFF"
      strokeWidth={4}
    />
    {children}
    <g
      stroke={N.red}
      strokeWidth={20}
      strokeLinecap="round"
      style={{ filter: "drop-shadow(0 0 12px rgba(255,77,94,0.9))" }}
    >
      <line
        x1={-66}
        y1={-66}
        x2={-66 + 132 * Math.min(1, cross * 2)}
        y2={-66 + 132 * Math.min(1, cross * 2)}
        opacity={cross > 0 ? 1 : 0}
      />
      <line
        x1={66}
        y1={-66}
        x2={66 - 132 * Math.max(0, cross * 2 - 1)}
        y2={-66 + 132 * Math.max(0, cross * 2 - 1)}
        opacity={cross > 0.5 ? 1 : 0}
      />
    </g>
  </svg>
);

export const NHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = useCues();
  const mato = c.word("n1", "mato");
  const n1End = c.end("n1");
  const agua = c.word("n2", "agua");
  const fuego = c.word("n2", "fuego");
  const n3 = c.start("n3");
  const push = prog(frame, 0, c.duration, inOut);
  // La oleada baja por tramos: la parte alta en la primera frase y el resto en las dos
  // siguientes, de modo que la última luz visible se apaga al decir «dormidos».
  const front =
    VALLEY_Z0 -
    1 +
    5.1 * prog(frame, mato + 2, n1End - mato, linear) +
    2.7 * prog(frame, n1End, n3 - n1End, linear) +
    3.2 * prog(frame, n3, c.duration - n3 - 12, linear);
  const pop = spring({ frame: frame - 2, fps, config: { damping: 14 } });
  const swap = spring({ frame: frame - mato, fps, config: { damping: 13 } });
  const count = Math.round(1746 * prog(frame, mato, n1End - mato, linear));
  const iconsOut = 1 - prog(frame, n3 - 4, 8);
  const badge = (at: number) =>
    spring({ frame: frame - at + 2, fps, config: { damping: 12 } }) * iconsOut;
  return (
    <AbsoluteFill style={{ background: N.bg }}>
      <Stage
        dpr={DPR}
        camera={[0, mix(14.5, 12.9, push), mix(13.8, 13.0, push)]}
        target={[0, 0, mix(-3.6, -2.5, push)]}
        fov={40}
        {...NIGHT}
      >
        <Terrain />
        <Rivers />
        <Lake />
        <MoonGlint />
        <VillageLights frame={frame} front={front} />
      </Stage>
      <Vignette />
      <AbsoluteFill
        style={{
          background: N.red,
          opacity: frame < mato ? 0 : 0.2 * Math.exp(-(frame - mato) / 7),
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 96,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: fonts.body,
          opacity: Math.min(1, pop) * (1 - Math.min(1, swap * 1.6)),
          scale: String(0.7 + 0.3 * pop),
        }}
      >
        <div
          style={{
            fontWeight: 900,
            fontSize: 196,
            lineHeight: 0.95,
            color: N.white,
            textShadow:
              "0 0 60px rgba(120,170,255,0.85), 0 8px 0 rgba(0,0,0,0.5)",
          }}
        >
          1986
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 84,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: fonts.body,
          opacity: Math.min(1, swap),
          scale: String(0.75 + 0.25 * swap),
        }}
      >
        <div
          style={{
            fontWeight: 800,
            fontSize: 34,
            letterSpacing: "0.2em",
            color: "#C9D8F5",
            textShadow: "0 2px 12px rgba(0,0,0,0.9)",
          }}
        >
          AGOSTO DE 1986
        </div>
        <div
          style={{
            fontWeight: 900,
            fontSize: 190,
            lineHeight: 1,
            color: N.red,
            fontVariantNumeric: "tabular-nums",
            textShadow:
              "0 0 60px rgba(255,77,94,0.75), 0 8px 0 rgba(0,0,0,0.55)",
          }}
        >
          {fmt(count)}
        </div>
        <div
          style={{
            fontWeight: 900,
            fontSize: 44,
            letterSpacing: "0.16em",
            color: N.white,
            textShadow: "0 2px 12px rgba(0,0,0,0.9)",
          }}
        >
          PERSONAS
        </div>
      </div>
      <Badge x={330} y={900} o={badge(agua)} cross={prog(frame, agua + 6, 8)}>
        <path
          d="M0 -64 C 34 -16 54 14 54 40 A 54 54 0 1 1 -54 40 C -54 14 -34 -16 0 -64 Z"
          fill="#4FB3FF"
        />
        <path
          d="M-22 44 A 26 26 0 0 0 4 70"
          stroke="#D6EEFF"
          strokeWidth={9}
          fill="none"
          strokeLinecap="round"
        />
      </Badge>
      <Badge x={750} y={900} o={badge(fuego)} cross={prog(frame, fuego + 6, 8)}>
        <path
          d="M4 -74 C 30 -36 62 -6 50 40 C 40 78 -40 78 -50 40 C -58 10 -30 -6 -20 -40 C -12 -22 4 -26 4 -74 Z"
          fill="#FF8A3C"
        />
        <path
          d="M2 -10 C 18 10 28 26 22 46 C 16 66 -16 66 -22 46 C -26 30 -8 18 2 -10 Z"
          fill="#FFD76B"
        />
      </Badge>
      <FactCard
        top={820}
        o={prog(frame, n3 + 2, 8)}
        big="hacia las 21:00"
        small="21 de agosto de 1986"
        color={N.white}
        size={66}
      />
    </AbsoluteFill>
  );
};

// --- 2 · Dónde está: Camerún ---------------------------------------------------------------------

const GLOBE_R = 1.3;
const GLOBE_TILT = 0.14;
const GLOBE_C: V3 = [0, 0.3, 0];
const NYOS_LL: [number, number] = [6.44, 10.3];
const KIVU_LL: [number, number] = [-2.0, 29.0];

/** Colorea los puntos del globo: azul para la tierra, ámbar para los países resaltados. */
const paintGlobe = (
  geo: ReturnType<typeof useDotGeometry>,
  hi: Uint8Array,
  frame: number,
) => {
  const col = geo.attributes.color.array as Float32Array;
  const pulse = 0.82 + 0.18 * Math.sin(frame * 0.25);
  for (let i = 0; i < hi.length; i++) {
    col[i * 3] = hi[i] ? 1.0 * pulse : 0.14;
    col[i * 3 + 1] = hi[i] ? 0.7 * pulse : 0.5;
    col[i * 3 + 2] = hi[i] ? 0.25 * pulse : 0.85;
  }
  geo.attributes.color.needsUpdate = true;
};

export const NLake: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const cam = c.word("n4", "camerun");
  const crater = c.word("n4", "crater");
  const spin = prog(frame, -10, cam + 6, inOut);
  const zoom = prog(frame, crater - 4, c.duration - crater + 4, inOut);
  const rotY = faceLon(mix(-50, 11, spin));
  const camPos: V3 = [0, 0.4, mix(6.6, 3.5, zoom)];
  const dots = useLandDots(1.3, ["Cameroon"]);
  const geo = useDotGeometry(dots);
  const country = useHighlightGeometry(dots);
  paintGlobe(geo, dots.hi, frame);
  const pin = project(
    globePoint(NYOS_LL[0], NYOS_LL[1], GLOBE_TILT, rotY, GLOBE_C, GLOBE_R),
    camPos,
    GLOBE_C,
    40,
  );
  return (
    <AbsoluteFill style={{ background: N.bg }}>
      <Stage dpr={DPR} camera={camPos} target={GLOBE_C} fov={40} env={0.3}>
        <Bokeh
          frame={frame}
          count={280}
          spread={36}
          color="#FFFFFF"
          size={0.09}
        />
        <group position={GLOBE_C} rotation={[GLOBE_TILT, 0, 0]}>
          <group rotation={[0, rotY, 0]} scale={GLOBE_R}>
            <DotEarth geometry={geo} size={0.042} haloOpacity={0.5}>
              <PointCloud
                geometry={country}
                color={N.amber}
                size={0.085}
                opacity={0.75 + 0.25 * Math.sin(frame * 0.3)}
              />
            </DotEarth>
          </group>
        </group>
      </Stage>
      <Pin
        x={pin.x}
        y={pin.y}
        dx={150}
        dy={-110}
        o={prog(frame, cam + 2, 8) * (1 - prog(frame, c.duration - 12, 8))}
        label="Lago Nyos"
      />
      <FactCard
        top={150}
        o={prog(frame, 6, 10)}
        big="Camerún"
        small="África · un lago en un cráter volcánico"
        color={N.amber}
        size={84}
      />
    </AbsoluteFill>
  );
};

// --- 3 · El gas en el fondo, como un refresco sin abrir -------------------------------------------

const BOTTLE_CAM: V3 = [0, 1.6, 8.4];
const BOTTLE_TARGET: V3 = [0, 1.45, 0];
const BOTTLE_STAGE = {
  env: 0.9,
  keyColor: "#FFE9D0",
  rimColor: "#7FC8FF",
  fillColor: "#FF8A3C",
  fillIntensity: 5,
};

/** Semianchura del cuenco del corte a una profundidad (en píxeles). */
const bowlHalf = (y: number) => 240 * Math.sqrt(Math.max(0, (1010 - y) / 400));

const BOTTLE_BG =
  "radial-gradient(ellipse at 50% 45%, #3A2416 0%, #140D0A 55%, #050305 100%)";

/** Corte esquemático del cráter: agua arriba, CO₂ disuelto en el fondo. */
const CrossSection: React.FC<{ frame: number; fill: number }> = ({
  frame,
  fill,
}) => (
  <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
    <defs>
      <linearGradient id="nd-rock" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2B3F6E" />
        <stop offset="0.45" stopColor="#131D3A" />
        <stop offset="1" stopColor="#070C1C" />
      </linearGradient>
      <linearGradient id="nd-water" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#53BDF0" />
        <stop offset="0.5" stopColor="#1C6FA8" />
        <stop offset="1" stopColor="#0B2E55" />
      </linearGradient>
      <linearGradient id="nd-gas" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#F4FBFF" stopOpacity="0" />
        <stop offset="1" stopColor="#F4FBFF" stopOpacity="0.7" />
      </linearGradient>
      <clipPath id="nd-bowl">
        <path d="M300 585 C 330 760 430 1010 540 1010 C 650 1010 750 760 780 585 Z" />
      </clipPath>
    </defs>
    {new Array(70).fill(0).map((_, i) => (
      <circle
        key={`s${i}`}
        cx={random(`sx${i}`) * W}
        cy={330 + random(`sy${i}`) * 240}
        r={1 + random(`sr${i}`) * 2}
        fill="#FFFFFF"
        opacity={0.3 + 0.5 * (0.5 + 0.5 * Math.sin(frame * 0.08 + i * 2.3))}
      />
    ))}
    <g transform="translate(540 800) scale(1.2) translate(-540 -800)">
      <path
        d="M-200 660 L170 600 Q230 560 262 545 L300 585 C 330 760 430 1010 540 1010 C 650 1010 750 760 780 585 L818 545 Q850 560 910 600 L1280 660 L1280 1600 L-200 1600 Z"
        fill="url(#nd-rock)"
      />
      <path
        d="M-200 660 L170 600 Q230 560 262 545 L300 585 M780 585 L818 545 Q850 560 910 600 L1280 660"
        fill="none"
        stroke="#7C9BE0"
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <g clipPath="url(#nd-bowl)">
        <rect x={280} y={612} width={520} height={410} fill="url(#nd-water)" />
        <rect
          x={280}
          y={mix(1010, 770, fill)}
          width={520}
          height={250}
          fill="url(#nd-gas)"
        />
        {new Array(110).fill(0).map((_, i) => {
          const on = ramp(fill, (i / 110) * 0.9, (i / 110) * 0.9 + 0.08);
          const by = 820 + random(`cy${i}`) * 180;
          const bx = 540 + (random(`cx${i}`) * 2 - 1) * bowlHalf(by) * 0.86;
          return (
            <circle
              key={i}
              cx={bx + Math.sin(frame * 0.09 + i) * 3}
              cy={by + Math.cos(frame * 0.07 + i * 1.7) * 3}
              r={(5 + random(`cr${i}`) * 6) * on}
              fill="#FFFFFF"
              opacity={0.9}
            />
          );
        })}
        {new Array(15).fill(0).map((_, i) => {
          const t = (frame / 34 + random(`rt${i}`)) % 1;
          const vent = 470 + (i % 3) * 70;
          return (
            <circle
              key={`r${i}`}
              cx={vent + Math.sin(t * 9 + i) * 10}
              cy={1004 - t * 130}
              r={8 * (1 - t)}
              fill="#FFFFFF"
              opacity={0.9 * (1 - t)}
            />
          );
        })}
      </g>
      <path
        d="M300 585 C 330 760 430 1010 540 1010 C 650 1010 750 760 780 585"
        fill="none"
        stroke="#4A6AB3"
        strokeWidth={3}
      />
      <line
        x1={303}
        y1={612}
        x2={777}
        y2={612}
        stroke="#D6F0FF"
        strokeWidth={4}
      />
      {[430, 540, 650].map((x, i) => {
        const bob = Math.sin(frame * 0.18 + i) * 8;
        return (
          <g
            key={x}
            stroke="#FFFFFF"
            strokeWidth={9}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={0.92}
          >
            <line x1={x} y1={640 + bob} x2={x} y2={738 + bob} />
            <path
              d={`M${x - 20} ${716 + bob} L${x} ${742 + bob} L${x + 20} ${716 + bob}`}
            />
          </g>
        );
      })}
      <g stroke="#FFFFFF" strokeWidth={4} opacity={0.9}>
        <line x1={850} y1={612} x2={850} y2={1010} />
        <line x1={834} y1={612} x2={866} y2={612} />
        <line x1={834} y1={1010} x2={866} y2={1010} />
      </g>
      <text
        x={850}
        y={1062}
        textAnchor="middle"
        fontFamily={fonts.body}
        fontWeight={900}
        fontSize={42}
        fill="#FFFFFF"
      >
        208 m
      </text>
      <text
        x={540}
        y={950}
        textAnchor="middle"
        fontFamily={fonts.body}
        fontWeight={900}
        fontSize={72}
        fill="#FFFFFF"
        stroke="#0B2E55"
        strokeWidth={10}
        paintOrder="stroke fill"
        opacity={ramp(fill, 0.4, 0.6)}
      >
        CO₂
      </text>
    </g>
  </svg>
);

export const NDeep: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = useCues();
  const como = c.word("n5", "como");
  const fill = prog(frame, 0, como - 6, linear);
  const dim = prog(frame, como - 6, 10);
  const enter = spring({
    frame: frame - como + 5,
    fps,
    config: { damping: 15 },
  });
  return (
    <AbsoluteFill style={{ background: N.bg }}>
      <AbsoluteFill
        style={{
          filter: `blur(${dim * 7}px)`,
          scale: String(1 + 0.06 * dim),
        }}
      >
        <CrossSection frame={frame} fill={fill} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: BOTTLE_BG, opacity: 0.92 * dim }} />
      {frame >= como - 6 ? (
        <Stage
          dpr={DPR}
          camera={BOTTLE_CAM}
          target={BOTTLE_TARGET}
          fov={40}
          opacity={Math.min(1, enter * 1.4)}
          {...BOTTLE_STAGE}
        >
          <group
            position={[0, (1 - enter) * -2.2, 0]}
            scale={0.7 + 0.3 * enter}
          >
            <Bottle
              frame={frame}
              shake={0.25 * prog(frame, como + 14, 30, linear)}
              open={-1}
            />
          </group>
        </Stage>
      ) : null}
      <FactCard
        top={150}
        o={visible(frame, 4, como - 4, 8)}
        big="CO₂ atrapado en el fondo"
        small="la presión del agua lo mantiene disuelto"
        color={N.gas}
        size={62}
      />
      <FactCard
        top={150}
        o={prog(frame, como + 4, 8)}
        big="un refresco sin abrir"
        small="el tapón era el agua de arriba"
        color={N.amber}
        size={66}
      />
    </AbsoluteFill>
  );
};

// --- 4 · Esa noche se destapó --------------------------------------------------------------------

export const NNight: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const pop = c.word("n6", "destapo") + 5;
  const cut = pop + 10;
  const nadie = c.word("n6", "nadie");
  const age = frame - cut;
  const flash = frame < pop ? 0 : Math.exp(-Math.abs(frame - cut) / 3.5);
  const rise = prog(frame, cut, c.duration - cut, linear);
  const cam: V3 = [
    mix(0.6, -0.4, rise),
    mix(5.6, 6.6, rise),
    mix(1.8, 2.8, rise),
  ];
  const target: V3 = [0, 1.1, CRATER[1]];
  const foot = project([0.85, 0, CRATER[1]], cam, target, 40);
  const top = project([0.85, COLUMN_H, CRATER[1]], cam, target, 40);
  const measure = prog(frame, cut + 6, 10);
  return (
    <AbsoluteFill style={{ background: N.bg }}>
      {frame >= cut - 1 ? (
        <Stage dpr={DPR} camera={cam} target={target} fov={40} {...NIGHT}>
          <Terrain />
          <Rivers />
          <Lake />
          <GasCloud
            frame={frame}
            front={CRATER[1] + 1.6 * rise}
            opacity={0.55 * prog(age, 4, 26, linear)}
          />
          <WaterColumn age={age} />
        </Stage>
      ) : null}
      {frame < cut + 1 ? (
        <AbsoluteFill style={{ background: BOTTLE_BG }}>
          <Stage
            dpr={DPR}
            camera={BOTTLE_CAM}
            target={BOTTLE_TARGET}
            fov={40}
            {...BOTTLE_STAGE}
          >
            <Bottle
              frame={frame}
              shake={0.25 + 0.75 * prog(frame, 0, pop, linear)}
              open={frame - pop}
            />
          </Stage>
        </AbsoluteFill>
      ) : (
        <Vignette strength={0.5} />
      )}
      <svg
        width={W}
        height={H}
        style={{ position: "absolute", inset: 0, opacity: measure }}
      >
        <g stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round">
          <line
            x1={foot.x}
            y1={foot.y}
            x2={top.x}
            y2={mix(foot.y, top.y, measure)}
          />
          <line x1={foot.x - 18} y1={foot.y} x2={foot.x + 18} y2={foot.y} />
          <line x1={top.x - 18} y1={top.y} x2={top.x + 18} y2={top.y} />
        </g>
      </svg>
      <div
        style={{
          position: "absolute",
          left: top.x + 28,
          top: (foot.y + top.y) / 2 - 60,
          opacity: measure,
          whiteSpace: "nowrap",
          fontFamily: fonts.body,
          color: N.white,
          textShadow: "0 4px 18px rgba(0,0,0,0.9)",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 78, lineHeight: 1 }}>
          100 m
        </div>
        <div style={{ fontWeight: 700, fontSize: 27, color: N.gas }}>
          de agua y espuma
        </div>
      </div>
      <AbsoluteFill style={{ background: "#FFFFFF", opacity: flash * 0.9 }} />
      <FactCard
        top={150}
        o={prog(frame, nadie + 1, 7)}
        big="¿qué lo provocó?"
        small="no se sabe · quizá un deslizamiento de tierra"
        color={N.amber}
        size={70}
      />
    </AbsoluteFill>
  );
};

// --- 5 · La nube baja por los valles -------------------------------------------------------------

export const NCloud: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const pesada = c.word("n7", "pesada");
  const n8 = c.start("n8");
  const km = c.word("n8", "25");
  const push = prog(frame, 0, c.duration, linear);
  const cam: V3 = [0, mix(13.8, 12.6, push), mix(13.4, 13.9, push)];
  const target: V3 = [0, 0, mix(-3.5, -2.2, push)];
  const flow = prog(frame, -12, c.duration - 2, linear);
  const front = mix(CRATER[1] + 1.6, VALLEY_Z1 + 1, flow ** 1.2);
  const reach = prog(frame, n8 + 2, km - n8 + 10, inOut);
  return (
    <AbsoluteFill style={{ background: N.bg }}>
      <Stage dpr={DPR} camera={cam} target={target} fov={40} {...NIGHT}>
        <Terrain />
        <Rivers opacity={0.55} />
        <Lake />
        <VillageLights frame={frame} front={front - 0.5} />
        <GasCloud frame={frame} front={front} />
      </Stage>
      <Vignette />
      <svg
        width={W}
        height={H}
        style={{ position: "absolute", inset: 0, opacity: prog(frame, n8, 8) }}
      >
        <g
          stroke={N.red}
          strokeWidth={9}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          style={{ filter: "drop-shadow(0 0 12px rgba(255,77,94,0.9))" }}
        >
          <line
            x1={92}
            y1={740}
            x2={92}
            y2={mix(740, 1340, reach)}
            strokeDasharray="22 16"
          />
          <path
            d={`M62 ${mix(740, 1340, reach) - 34} L92 ${mix(740, 1340, reach)} L122 ${mix(740, 1340, reach) - 34}`}
          />
        </g>
        <circle cx={92} cy={740} r={13} fill={N.red} />
      </svg>
      <div
        style={{
          position: "absolute",
          left: 56,
          top: 610,
          opacity: prog(frame, km - 6, 8),
          fontFamily: fonts.body,
          fontWeight: 900,
          fontSize: 84,
          lineHeight: 1,
          whiteSpace: "nowrap",
          color: N.white,
          textShadow: "0 0 30px rgba(255,77,94,0.9), 0 4px 0 rgba(0,0,0,0.6)",
        }}
      >
        25 km
      </div>
      <FactCard
        top={150}
        o={visible(frame, pesada - 6, n8 - 2, 8)}
        big="CO₂: 50 % más denso que el aire"
        small="nube de ≈ 50 m de espesor · 20–50 km/h"
        color={N.gas}
        size={46}
      />
      <FactCard
        top={150}
        o={prog(frame, n8 + 2, 8)}
        big="1.746 personas"
        small="y 3.500 cabezas de ganado"
        color={N.red}
        size={84}
      />
    </AbsoluteFill>
  );
};

// --- 6 · Hoy: las tuberías sacan el gas ----------------------------------------------------------

export const NToday: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const tub = c.word("n9", "tuberias");
  const orbit = prog(frame, 0, c.duration, linear);
  const grow = prog(frame, tub - 10, 16);
  return (
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(180deg, #74BEFF 0%, #BFE4FF 50%, #E6F5FF 100%)",
      }}
    >
      <Stage
        dpr={DPR}
        camera={[
          mix(1.9, 0.7, orbit),
          mix(6.6, 6.0, orbit),
          mix(3.8, 3.2, orbit),
        ]}
        target={[0, 0.7, CRATER[1]]}
        fov={40}
        env={0.5}
        ambient={0.9}
        keyIntensity={2.4}
        fillIntensity={0}
        near={1}
        far={140}
      >
        <Terrain mode="day" fog={{ color: "#C9E8FF", near: 13, far: 40 }} />
        <Rivers color="#5DB6F2" />
        <Lake look="day" />
        <Jet
          position={[0, 0, CRATER[1]]}
          height={1.9 * grow}
          frame={frame}
          seed="a"
        />
        <Jet
          position={[-1.0, 0, CRATER[1] + 0.7]}
          height={1.2 * grow}
          frame={frame + 11}
          seed="b"
        />
        <Jet
          position={[1.0, 0, CRATER[1] - 0.5]}
          height={1.2 * grow}
          frame={frame + 23}
          seed="c"
        />
      </Stage>
      <FactCard
        top={150}
        o={prog(frame, 4, 8)}
        big="tuberías que sacan el gas"
        small="la primera en 2001 · dos más en 2011"
        color="#FFFFFF"
        size={62}
      />
      <FactCard
        top={372}
        o={prog(frame, tub + 4, 8)}
        big="chorro de ≈ 45 m"
        small="en la prueba de 2001"
        color={N.amber}
        size={46}
      />
    </AbsoluteFill>
  );
};

// --- 7 · El Kivu: mil veces mayor y con dos millones de personas ---------------------------------

const KX = 540;
const KY = 900;
const KR = 330;
const PEOPLE = 2000;
const TOWNS = new Array(14)
  .fill(0)
  .map((_, i) => random(`town${i}`) * Math.PI * 2);

/** Comparación a escala de superficie (1,58 km² frente a 2.700 km²) y población alrededor. */
const KivuPlate: React.FC<{
  id: string;
  frame: number;
  grow: number;
  people: number;
  nyos: number;
}> = ({ id, frame, grow, people, nyos }) => (
  <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
    <defs>
      <radialGradient id={`${id}-water`}>
        <stop offset="0" stopColor="#3FA6DA" />
        <stop offset="0.7" stopColor="#1B6FA6" />
        <stop offset="1" stopColor="#0C3A62" />
      </radialGradient>
      <radialGradient id={`${id}-halo`}>
        <stop offset="0.6" stopColor="#3B7BFF" stopOpacity="0.5" />
        <stop offset="1" stopColor="#3B7BFF" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx={KX} cy={KY} r={KR * grow * 1.45} fill={`url(#${id}-halo)`} />
    <circle
      cx={KX}
      cy={KY}
      r={Math.max(0.001, KR * grow)}
      fill={`url(#${id}-water)`}
      stroke="#BFE6FF"
      strokeWidth={5}
    />
    {new Array(PEOPLE).fill(0).map((_, i) => {
      if (i / PEOPLE > people) return null;
      const a =
        random(`pt${i}`) < 0.72
          ? TOWNS[i % TOWNS.length] +
            (random(`pa${i}`) + random(`pb${i}`) - 1) * 0.3
          : random(`pc${i}`) * Math.PI * 2;
      const d = KR + 16 + 150 * random(`pd${i}`) ** 1.9;
      const tw = 0.6 + 0.4 * Math.sin(frame * 0.2 + i * 2.1);
      return (
        <circle
          key={i}
          cx={KX + Math.cos(a) * d}
          cy={KY + Math.sin(a) * d}
          r={3 + random(`pr${i}`) * 2.4}
          fill="#FFC46B"
          opacity={tw}
        />
      );
    })}
    <g opacity={nyos}>
      <circle
        cx={120}
        cy={KY}
        r={8}
        fill="#63C8F2"
        stroke="#FFFFFF"
        strokeWidth={3}
      />
      <text
        x={120}
        y={KY + 62}
        textAnchor="middle"
        fontFamily={fonts.body}
        fontWeight={900}
        fontSize={38}
        fill="#FFFFFF"
      >
        Nyos
      </text>
    </g>
    <text
      x={KX}
      y={KY - 150}
      textAnchor="middle"
      fontFamily={fonts.body}
      fontWeight={900}
      fontSize={92}
      fill="#FFFFFF"
      opacity={ramp(grow, 0.75, 1)}
      style={{ letterSpacing: "0.12em" }}
    >
      KIVU
    </text>
  </svg>
);

export const NKivu: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = useCues();
  const kivu = c.word("n10", "kivu");
  const n11 = c.start("n11");
  const mil = c.word("n11", "mil");
  const mill = c.word("n11", "millones");
  const n12 = c.start("n12");
  const sat = c.word("n12", "saturado");
  const travel = prog(frame, 0, kivu - 4, inOut);
  const rotY = faceLon(mix(13, 22, travel));
  const camPos: V3 = [0, 0.2, mix(5.6, 4.7, travel)];
  const dots = useLandDots(1.3);
  const geo = useDotGeometry(dots);
  paintGlobe(geo, dots.hi, frame);
  const at = (ll: [number, number]) =>
    project(
      globePoint(ll[0], ll[1], GLOBE_TILT, rotY, GLOBE_C, GLOBE_R),
      camPos,
      GLOBE_C,
      40,
    );
  const pNyos = at(NYOS_LL);
  const pKivu = at(KIVU_LL);
  const globeO = 1 - prog(frame, n11 - 4, 10);
  const grow = prog(frame, n11 + 2, mil + 14 - n11, inOut);
  const people = prog(frame, mill - 6, n12 - mill + 12, linear);
  const stamp = spring({
    frame: frame - sat + 2,
    fps,
    config: { damping: 11 },
  });
  return (
    <AbsoluteFill style={{ background: N.bg }}>
      {globeO > 0 ? (
        <AbsoluteFill style={{ opacity: globeO }}>
          <Stage dpr={DPR} camera={camPos} target={GLOBE_C} fov={40} env={0.3}>
            <Bokeh
              frame={frame}
              count={280}
              spread={36}
              color="#FFFFFF"
              size={0.09}
            />
            <group position={GLOBE_C} rotation={[GLOBE_TILT, 0, 0]}>
              <group rotation={[0, rotY, 0]} scale={GLOBE_R}>
                <DotEarth geometry={geo} size={0.042} haloOpacity={0.5} />
              </group>
            </group>
          </Stage>
          <Pin
            x={pNyos.x}
            y={pNyos.y}
            dx={-90}
            dy={-120}
            o={1 - prog(frame, kivu - 10, 8)}
            label="Nyos"
            size={38}
          />
          <Pin
            x={pKivu.x}
            y={pKivu.y}
            dx={120}
            dy={110}
            o={prog(frame, kivu - 6, 8)}
            label="Lago Kivu"
          />
        </AbsoluteFill>
      ) : null}
      {frame >= n11 - 4 ? (
        <AbsoluteFill style={{ opacity: prog(frame, n11 - 4, 10) }}>
          <KivuPlate
            id="nk"
            frame={frame}
            grow={grow}
            people={people}
            nyos={visible(frame, n11, mill - 2, 8)}
          />
        </AbsoluteFill>
      ) : null}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: KY - 60,
          display: "flex",
          justifyContent: "center",
          opacity: Math.min(1, stamp),
          scale: String(1.6 - 0.6 * Math.min(1, stamp)),
          rotate: "-7deg",
        }}
      >
        <div
          style={{
            fontFamily: fonts.body,
            fontWeight: 900,
            fontSize: 88,
            letterSpacing: "0.06em",
            color: N.amber,
            border: `8px solid ${N.amber}`,
            borderRadius: 22,
            padding: "6px 34px",
            background: "rgba(6,10,26,0.72)",
            textShadow: "0 0 30px rgba(255,196,107,0.7)",
          }}
        >
          POR AHORA
        </div>
      </div>
      <FactCard
        top={150}
        o={visible(frame, kivu - 34, n11 + 2, 8)}
        big="Lago Kivu"
        small="entre la R. D. del Congo y Ruanda"
        color={N.amber}
        size={84}
      />
      <FactCard
        top={150}
        o={visible(frame, n11 + 4, mill - 6, 8)}
        big="≈ 1.700 veces mayor"
        small="2.700 km² frente a 1,58 km²"
        color={N.gas}
        size={72}
      />
      <FactCard
        top={150}
        o={visible(frame, mill - 4, n12 + 2, 8)}
        big={`≈ ${fmt(Math.round(2000000 * prog(frame, mill - 4, 22, linear)))}`}
        small="personas viven en su cuenca"
        color={N.amber}
        size={84}
      />
      <FactCard
        top={150}
        o={prog(frame, n12 + 4, 8)}
        big="aún no está saturado"
        small="un estudio de 2018 no ve que el riesgo aumente"
        color={N.teal}
        size={66}
      />
    </AbsoluteFill>
  );
};

// --- 8 · La pregunta final -----------------------------------------------------------------------

export const NQuestion: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = useCues();
  const start = c.start("n13");
  const end = c.end("n13");
  const pop = (at: number, damping = 12) =>
    spring({ frame: frame - at, fps, config: { damping } });
  const line1 = pop(start - 3, 13);
  const line2 = pop(start + 7, 10);
  const stay = pop(end - 4);
  const go = pop(end + 2);
  const cta = pop(end + 14, 14);
  const bounce = Math.sin(frame * 0.35) * 8;
  const pill = (bg: string, color: string, o: number, tilt: number) =>
    ({
      fontWeight: 900,
      fontSize: 64,
      letterSpacing: "0.04em",
      color,
      background: bg,
      padding: "18px 40px",
      borderRadius: 26,
      opacity: Math.min(1, o),
      scale: String(0.5 + 0.5 * o),
      rotate: `${tilt}deg`,
      boxShadow: `0 0 50px ${bg}88, 0 14px 40px rgba(0,0,0,0.6)`,
    }) as const;
  return (
    <AbsoluteFill style={{ background: N.bg }}>
      <AbsoluteFill
        style={{ scale: String(1 + 0.04 * prog(frame, 0, c.duration, linear)) }}
      >
        <KivuPlate id="nq" frame={frame} grow={1} people={1} nyos={0} />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 42%, rgba(3,5,13,0.84) 0%, rgba(3,5,13,0.6) 55%, rgba(3,5,13,0.25) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 540,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: fonts.body,
          fontWeight: 900,
          lineHeight: 1,
        }}
      >
        <div
          style={{
            fontSize: 138,
            color: N.white,
            opacity: Math.min(1, line1),
            translate: `0 ${(1 - line1) * 40}px`,
            textShadow: "0 8px 0 rgba(0,0,0,0.55)",
          }}
        >
          ¿TÚ QUÉ
        </div>
        <div
          style={{
            fontSize: 176,
            color: N.amber,
            opacity: Math.min(1, line2),
            scale: String(0.6 + 0.4 * line2),
            textShadow:
              "0 0 70px rgba(255,196,107,0.7), 0 10px 0 rgba(0,0,0,0.55)",
          }}
        >
          HARÍAS?
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 960,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 30,
          fontFamily: fonts.body,
        }}
      >
        <div style={pill(N.teal, "#06131C", stay, -4)}>ME QUEDO</div>
        <div style={pill(N.red, "#FFFFFF", go, 4)}>ME VOY</div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 1150,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          opacity: Math.min(1, cta),
          translate: `0 ${(1 - cta) * 30}px`,
          fontFamily: fonts.body,
        }}
      >
        <div
          style={{
            fontWeight: 900,
            fontSize: 44,
            letterSpacing: "0.08em",
            color: "#06131C",
            background: N.white,
            padding: "14px 38px",
            borderRadius: 999,
            boxShadow: "0 16px 50px rgba(0,0,0,0.6)",
          }}
        >
          RESPONDE EN COMENTARIOS
        </div>
        <svg
          width={90}
          height={70}
          viewBox="0 0 90 70"
          style={{ translate: `0 ${bounce}px` }}
        >
          <path
            d="M12 10 L45 44 L78 10"
            stroke={N.white}
            strokeWidth={12}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
        <div
          style={{
            fontWeight: 600,
            fontSize: 26,
            color: N.muted,
            marginTop: 8,
          }}
        >
          Fuentes: Wikipedia · Smithsonian Magazine
        </div>
      </div>
    </AbsoluteFill>
  );
};

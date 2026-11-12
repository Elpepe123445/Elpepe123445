import React from "react";
import {
  AbsoluteFill,
  random,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";
import { faceLon, latLon } from "../../components/Globe3D";
import { Bokeh, Glow, Stage } from "../../components/three/Stage";
import { fonts, inOut, mix, prog, visible } from "../../engine/theme";
import { useCues } from "../../engine/timeline";
import {
  AuroraRing,
  DotEarth,
  Flare,
  PointCloud,
  S,
  Satellite,
  SPOT,
  Sun,
  sunPoint,
  Telegraph,
  useDotGeometry,
  useLandDots,
  usePoints,
  WIRE_GAP,
} from "./models";

// Resolución interna del WebGL: 0,7 en la nube (software); REMOTION_DPR=1 con GPU.
const DPR = Number(process.env.REMOTION_DPR ?? 0.7);
const W = 1080;
const H = 1920;
type V3 = [number, number, number];
const linear = (t: number) => t;

/** Proyecta un punto 3D a píxeles con la misma cámara que <Stage> (para rótulos 2D). */
const project = (p: V3, cam: V3, target: V3, fov: number) => {
  const c = new THREE.PerspectiveCamera(fov, W / H, 0.01, 500);
  c.position.set(...cam);
  c.lookAt(...target);
  c.updateMatrixWorld();
  const v = new THREE.Vector3(...p).project(c);
  return { x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H };
};

// --- Rótulos ------------------------------------------------------------------------------------

const Glass: React.FC<{
  top: number;
  o: number;
  children: React.ReactNode;
  scale?: number;
}> = ({ top, o, children, scale = 1 }) => (
  <div
    style={{
      position: "absolute",
      top,
      left: 0,
      right: 0,
      display: "flex",
      justifyContent: "center",
      opacity: o,
      translate: `0 ${(1 - o) * 22}px`,
    }}
  >
    <div
      style={{
        maxWidth: 940,
        padding: "24px 42px",
        borderRadius: 30,
        background:
          "linear-gradient(160deg, rgba(20,14,34,0.72), rgba(12,8,22,0.5))",
        border: "1.5px solid rgba(255,255,255,0.22)",
        boxShadow:
          "0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.25)",
        textAlign: "center",
        scale: String(scale),
        fontFamily: fonts.body,
        color: S.white,
      }}
    >
      {children}
    </div>
  </div>
);

const Big: React.FC<{
  children: React.ReactNode;
  color?: string;
  size?: number;
}> = ({ children, color = S.white, size = 72 }) => (
  <div
    style={{
      fontWeight: 900,
      fontSize: size,
      lineHeight: 1.05,
      color,
      textShadow: `0 0 40px ${color}66`,
    }}
  >
    {children}
  </div>
);

const Small: React.FC<{ children: React.ReactNode; color?: string }> = ({
  children,
  color = S.muted,
}) => (
  <div
    style={{
      fontWeight: 700,
      fontSize: 31,
      letterSpacing: "0.07em",
      textTransform: "uppercase",
      marginTop: 10,
      color,
    }}
  >
    {children}
  </div>
);

// --- Cielo con aurora (2D) ----------------------------------------------------------------------

const AURORA_LAYERS = [
  {
    y: 0.62,
    h: 0.6,
    amp: 70,
    k: 1.0,
    sp: 0.7,
    ph: 0.0,
    o: 0.75,
    grad: "au-red",
  },
  {
    y: 0.72,
    h: 0.5,
    amp: 100,
    k: 1.7,
    sp: -1.0,
    ph: 2.1,
    o: 0.9,
    grad: "au-red",
  },
  {
    y: 0.8,
    h: 0.34,
    amp: 60,
    k: 2.6,
    sp: 1.4,
    ph: 4.0,
    o: 0.8,
    grad: "au-green",
  },
];

/** Cortinas de aurora: franjas verticales con degradado, desenfocadas y con brillo oscilante. */
const AuroraSky: React.FC<{
  frame: number;
  intensity: number;
  height: number;
  seed?: string;
}> = ({ frame, intensity, height, seed = "au" }) => {
  const n = 54;
  const sw = W / n;
  return (
    <svg
      width={W}
      height={height}
      viewBox={`0 0 ${W} ${height}`}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        mixBlendMode: "screen",
        opacity: intensity,
      }}
    >
      <defs>
        <linearGradient id="au-red" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FF1E3C" stopOpacity="0" />
          <stop offset="0.35" stopColor="#FF2846" stopOpacity="0.8" />
          <stop offset="0.75" stopColor="#FF4FA0" stopOpacity="0.95" />
          <stop offset="0.93" stopColor="#FFD0E8" stopOpacity="0.95" />
          <stop offset="1" stopColor="#FFD0E8" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="au-green" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FF3C78" stopOpacity="0" />
          <stop offset="0.45" stopColor="#FF6FB0" stopOpacity="0.55" />
          <stop offset="0.85" stopColor="#7CFFB2" stopOpacity="0.95" />
          <stop offset="1" stopColor="#D8FFE8" stopOpacity="0" />
        </linearGradient>
        <filter id="au-blur" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="13" />
        </filter>
      </defs>
      {AURORA_LAYERS.map((L, li) => (
        <g key={li} filter="url(#au-blur)" opacity={L.o}>
          {new Array(n).fill(0).map((_, i) => {
            const x = i * sw;
            const base =
              L.y * height +
              Math.sin(x * 0.004 * L.k + frame * 0.02 * L.sp + L.ph) * L.amp +
              Math.sin(x * 0.011 + frame * 0.035 * L.sp) * L.amp * 0.35;
            const hgt =
              L.h *
              height *
              (0.5 + 0.5 * random(`${seed}${li}-${i}`)) *
              (0.82 + 0.18 * Math.sin(frame * 0.08 + i * 1.7));
            const a =
              0.3 + 0.7 * (0.5 + 0.5 * Math.sin(i * 0.9 + frame * 0.1 + L.ph));
            return (
              <rect
                key={i}
                x={x}
                y={base - hgt}
                width={sw + 1}
                height={hgt}
                fill={`url(#${L.grad})`}
                opacity={a}
              />
            );
          })}
        </g>
      ))}
    </svg>
  );
};

const Stars: React.FC<{ frame: number; count?: number; height?: number }> = ({
  frame,
  count = 150,
  height = 1300,
}) => (
  <svg width={W} height={height} style={{ position: "absolute", top: 0 }}>
    {new Array(count).fill(0).map((_, i) => (
      <circle
        key={i}
        cx={random(`sx${i}`) * W}
        cy={random(`sy${i}`) * height}
        r={0.8 + random(`sr${i}`) * 1.8}
        fill="#FFFFFF"
        opacity={0.3 + 0.5 * (0.5 + 0.5 * Math.sin(frame * 0.07 + i * 2.3))}
      />
    ))}
  </svg>
);

// --- 1 · El cielo rojo y los telégrafos echando chispas -----------------------------------------

const POLES = [0, 1, 2, 3, 4, 5].map((i) => {
  const s = 1 / (1 + i * 0.8);
  const x = 130 + 760 * s;
  const y = 1190 + 380 * s;
  const h = 760 * s;
  return { s, x, y, top: y - h, arm: y - h + h * 0.07, half: 100 * s };
});

export const CHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = useCues();
  const rojo = c.word("c1", "rojo");
  const tele = c.word("c1", "telegrafos");
  const chis = c.word("c1", "chispas");
  const au = mix(0.3, 1, prog(frame, rojo - 22, 30));
  const sp = prog(frame, tele + 4, 14);
  const zoom = mix(1.12, 1, prog(frame, 0, c.duration, inOut));
  const year = spring({ frame: frame - 3, fps, config: { damping: 14 } });
  const k = Math.floor(frame / 2);
  const live = sp > 0 && random(`wire${k}`) < 0.3 + 0.5 * sp;
  const wire = live ? "#D6F0FF" : "#0B0711";
  const ends = POLES.flatMap((p, i) => [
    { x: p.x - p.half, y: p.arm, s: p.s, id: `${i}l` },
    { x: p.x + p.half, y: p.arm, s: p.s, id: `${i}r` },
  ]);
  return (
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(180deg, #07051A 0%, #150A24 55%, #230C1E 100%)",
      }}
    >
      <AbsoluteFill style={{ scale: String(zoom), transformOrigin: "50% 62%" }}>
        <Stars frame={frame} />
        <AuroraSky frame={frame} intensity={au} height={1420} />
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <radialGradient id="spark-glow">
              <stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
              <stop offset="0.3" stopColor="#9FDCFF" stopOpacity="0.7" />
              <stop offset="1" stopColor="#4FA8FF" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#12070F" />
              <stop offset="1" stopColor="#040206" />
            </linearGradient>
          </defs>
          {/* Colinas y suelo */}
          <path
            d="M0 1215 C 160 1150, 300 1195, 430 1180 S 700 1130, 860 1175 S 1020 1150, 1080 1165 L1080 1920 L0 1920 Z"
            fill="url(#ground)"
          />
          <path
            d="M0 1215 C 160 1150, 300 1195, 430 1180 S 700 1130, 860 1175 S 1020 1150, 1080 1165"
            stroke={`rgba(255,80,110,${0.35 * au})`}
            strokeWidth={3}
            fill="none"
          />
          {/* Cables */}
          {[-1, 1].map((side) => (
            <g key={side}>
              {POLES.slice(0, -1).map((p, i) => {
                const q = POLES[i + 1];
                const x1 = p.x + side * p.half;
                const x2 = q.x + side * q.half;
                return (
                  <path
                    key={i}
                    d={`M${x1} ${p.arm} Q ${(x1 + x2) / 2} ${(p.arm + q.arm) / 2 + 46 * p.s} ${x2} ${q.arm}`}
                    stroke={wire}
                    strokeWidth={1 + 3.2 * p.s}
                    fill="none"
                    style={
                      live
                        ? { filter: "drop-shadow(0 0 10px #7FC8FF)" }
                        : undefined
                    }
                  />
                );
              })}
              <path
                d={`M${POLES[0].x + side * POLES[0].half} ${POLES[0].arm} Q 1080 ${POLES[0].arm + 40} 1300 ${POLES[0].arm - 260}`}
                stroke={wire}
                strokeWidth={4.2}
                fill="none"
              />
            </g>
          ))}
          {/* Postes */}
          {POLES.map((p, i) => (
            <g key={i}>
              <rect
                x={p.x - 11 * p.s}
                y={p.top}
                width={22 * p.s}
                height={p.y - p.top}
                fill="#07040B"
              />
              <rect
                x={p.x - p.half - 8 * p.s}
                y={p.arm - 7 * p.s}
                width={p.half * 2 + 16 * p.s}
                height={14 * p.s}
                fill="#07040B"
              />
              {[-1, 1].map((side) => (
                <rect
                  key={side}
                  x={p.x + side * p.half - 7 * p.s}
                  y={p.arm - 30 * p.s}
                  width={14 * p.s}
                  height={24 * p.s}
                  rx={5 * p.s}
                  fill="#1B1420"
                />
              ))}
              <rect
                x={p.x - 11 * p.s}
                y={p.top}
                width={3 * p.s}
                height={p.y - p.top}
                fill={`rgba(255,90,120,${0.5 * au})`}
              />
            </g>
          ))}
          {/* Chispas en los aisladores */}
          {ends.slice(0, 8).map((e) => {
            const lit = random(`lit${e.id}-${k}`) < 0.8 * sp;
            if (!lit) return null;
            const r = 175 * e.s * (0.7 + random(`r${e.id}-${k}`) * 0.6);
            return (
              <g key={e.id}>
                <circle
                  cx={e.x}
                  cy={e.y - 20 * e.s}
                  r={r}
                  fill="url(#spark-glow)"
                />
                {new Array(7).fill(0).map((_, j) => {
                  const a = random(`a${e.id}-${k}-${j}`) * Math.PI * 2;
                  const len = r * (0.5 + random(`l${e.id}-${k}-${j}`) * 0.9);
                  const mx =
                    e.x +
                    Math.cos(a) * len * 0.5 +
                    (random(`j${e.id}-${k}-${j}`) - 0.5) * 30 * e.s;
                  const my = e.y - 20 * e.s + Math.sin(a) * len * 0.5;
                  return (
                    <polyline
                      key={j}
                      points={`${e.x},${e.y - 20 * e.s} ${mx},${my} ${e.x + Math.cos(a) * len},${e.y - 20 * e.s + Math.sin(a) * len}`}
                      stroke="#F2FAFF"
                      strokeWidth={1.5 + 3 * e.s}
                      fill="none"
                      strokeLinecap="round"
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
      </AbsoluteFill>
      {/* Fogonazo de las chispas sobre toda la escena */}
      <AbsoluteFill
        style={{
          background: "#BFE4FF",
          opacity:
            frame >= chis - 2 && random(`fl${k}`) < 0.3
              ? 0.16 * (1 - prog(frame, chis, 40))
              : 0,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 150,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: fonts.body,
          opacity: Math.min(1, year),
          scale: String(0.7 + 0.3 * year),
        }}
      >
        <div
          style={{
            fontWeight: 900,
            fontSize: 250,
            lineHeight: 0.95,
            color: S.white,
            letterSpacing: "-0.02em",
            textShadow: "0 0 60px rgba(255,64,88,0.9), 0 8px 0 rgba(0,0,0,0.5)",
          }}
        >
          1859
        </div>
        <div
          style={{
            fontWeight: 800,
            fontSize: 38,
            letterSpacing: "0.22em",
            color: "#FFC9D4",
            marginTop: 14,
            textShadow: "0 2px 14px rgba(0,0,0,0.9)",
          }}
        >
          1–2 DE SEPTIEMBRE
        </div>
      </div>
    </AbsoluteFill>
  );
};

// --- 2 · El destello blanco en el Sol -----------------------------------------------------------

export const CSun: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const destello = c.word("c3", "destello");
  const c4 = c.start("c4");
  const zoom = prog(frame, 0, destello + 10, inOut);
  const f = frame - destello;
  const burst =
    f < 0 ? 0 : Math.min(1, f / 4) * (0.3 + 0.7 * Math.exp(-f / 26));
  const flash = f < 0 ? 0 : Math.exp(-f / 7) * 0.7;
  const erupt = prog(frame, c4 - 4, c.duration - c4 + 4, linear);
  const R = 1.5;
  const p0 = sunPoint(SPOT.u + 0.004, SPOT.v - 0.012, R * 1.01);
  const p1 = sunPoint(SPOT.u + 0.02, SPOT.v + 0.012, R * 1.01);
  const N = 1100;
  const geo = usePoints(N);
  const arr = geo.attributes.position.array as Float32Array;
  const len = Math.hypot(...p0);
  for (let i = 0; i < N; i++) {
    const dx = p0[0] / len + (random(`ex${i}`) - 0.5) * 0.9;
    const dy = p0[1] / len + (random(`ey${i}`) - 0.5) * 0.9;
    const dz = p0[2] / len + (random(`ez${i}`) - 0.5) * 0.9;
    const d = erupt * (0.2 + random(`ed${i}`) ** 1.5 * 3.4);
    arr[i * 3] = p0[0] + dx * d;
    arr[i * 3 + 1] = p0[1] + dy * d;
    arr[i * 3 + 2] = p0[2] + dz * d;
  }
  geo.attributes.position.needsUpdate = true;
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, #2C1005 0%, #0C0507 60%, #030204 100%)",
      }}
    >
      <Stage
        dpr={DPR}
        camera={[0, 0.6, mix(9.6, 6.3, zoom)]}
        target={[0, mix(0.55, 0.85, zoom), 0]}
        fov={40}
        env={0.2}
      >
        <Bokeh
          frame={frame}
          count={260}
          spread={34}
          color="#FFFFFF"
          size={0.1}
        />
        <Sun
          r={R}
          position={[0, 0.55, 0]}
          spin={mix(-0.32, 0.03, prog(frame, 0, c.duration, linear))}
        >
          <Flare
            position={p0}
            size={0.12 + burst * 2.6}
            color="#FFFFFF"
            opacity={Math.min(1, burst * 3)}
          />
          <Flare
            position={p1}
            size={0.1 + burst * 1.7}
            color="#FFF6D8"
            opacity={Math.min(1, burst * 3)}
          />
          <PointCloud
            geometry={geo}
            color="#FFD79A"
            size={0.07}
            opacity={Math.min(1, erupt * 4) * (1 - erupt * 0.4)}
          />
        </Sun>
      </Stage>
      <AbsoluteFill style={{ background: "#FFFFFF", opacity: flash }} />
      <Glass top={170} o={visible(frame, 8, c4 - 2, 10)}>
        <Big size={66}>Richard Carrington</Big>
        <Small>astrónomo · Inglaterra · 1 sep 1859</Small>
      </Glass>
      <Glass top={170} o={prog(frame, c4 + 2, 10)}>
        <Big size={66} color={S.gold}>
          la mayor tormenta solar
        </Big>
        <Small color={S.white}>registrada · «evento Carrington»</Small>
      </Glass>
    </AbsoluteFill>
  );
};

// --- 3 · La nube de plasma cruza 150 millones de km ---------------------------------------------

export const CTravel: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const launch = c.start("c5") + 2;
  const hit = c.word("c5", "golpeo");
  const horas = c.word("c5", "menos");
  const tt = Math.max(0, (frame - launch) / (hit - launch));
  const f = frame - hit;
  const shock = f < 0 ? 0 : Math.exp(-f / 12);
  const sunY = -4.9;
  const earth: V3 = [0, 1.7, 0];
  const D = earth[1] - sunY - 1.7;
  const N = 2600;
  const geo = usePoints(N, true);
  const pos = geo.attributes.position.array as Float32Array;
  const col = geo.attributes.color.array as Float32Array;
  for (let i = 0; i < N; i++) {
    const ang = random(`ta${i}`) * Math.PI * 2;
    const cone = random(`tc${i}`) ** 0.8 * 0.36;
    const lag = random(`tl${i}`) ** 2.2 * 0.55;
    const d = 1.7 + D * tt * (1 - lag) * (1 + (1 - Math.cos(cone)) * 0.6);
    const wob = Math.sin(frame * 0.09 + i) * 0.04;
    pos[i * 3] = Math.sin(cone) * Math.cos(ang) * d + wob;
    pos[i * 3 + 1] = sunY + Math.cos(cone) * d;
    pos[i * 3 + 2] = Math.sin(cone) * Math.sin(ang) * d;
    const k = lag / 0.55;
    col[i * 3] = 1;
    col[i * 3 + 1] = mix(0.72, 0.2, k);
    col[i * 3 + 2] = mix(0.25, 0.6, k);
  }
  geo.attributes.position.needsUpdate = true;
  geo.attributes.color.needsUpdate = true;
  const dots = useLandDots(3.2);
  const eg = useDotGeometry(dots);
  const ec = eg.attributes.color.array as Float32Array;
  for (let i = 0; i < dots.count; i++) {
    ec[i * 3] = 0.25 + shock * 0.7;
    ec[i * 3 + 1] = 0.85;
    ec[i * 3 + 2] = 0.75;
  }
  eg.attributes.color.needsUpdate = true;
  const shake = Math.sin(frame * 2.3) * 0.14 * shock;
  return (
    <AbsoluteFill style={{ background: S.bg }}>
      <Stage
        dpr={DPR}
        camera={[shake, shake * 0.6, 12]}
        target={[0, 0, 0]}
        fov={40}
        env={0.3}
      >
        <Bokeh
          frame={frame}
          count={320}
          spread={40}
          color="#FFFFFF"
          size={0.1}
        />
        <Sun r={1.7} position={[0, sunY, 0]} spin={frame * 0.002} />
        <PointCloud
          geometry={geo}
          size={0.15}
          opacity={Math.min(1, tt * 5) * 0.7}
          vertexColors
        />
        <group
          position={earth}
          scale={0.34}
          rotation={[0.3, faceLon(-60) + frame * 0.01, 0]}
        >
          <DotEarth
            geometry={eg}
            size={0.07}
            haloOpacity={0.75}
            oceanGlow={0.6}
          />
        </group>
        <Glow
          position={[0, Math.min(sunY + 1.7 + D * tt, 6), 0]}
          size={2.6}
          color="#FF9A4A"
          opacity={0.5 * Math.min(1, tt * 4)}
        />
        <Glow
          position={[0, Math.min(sunY + 1.7 + D * tt * 0.6, 6), 0]}
          size={3.2}
          color="#FF4F8A"
          opacity={0.28 * Math.min(1, tt * 4)}
        />
        {/* Campo magnético: líneas que se comprimen con el impacto */}
        {[0.75, 1.05, 1.4].map((r, i) => (
          <mesh
            key={i}
            position={[earth[0], earth[1] + shock * 0.12, earth[2]]}
            rotation={[0, i * 1.05 + frame * 0.004, 0]}
            scale={[1, 1.5 - shock * 0.35, 1]}
          >
            <torusGeometry args={[r, 0.006, 6, 120]} />
            <meshBasicMaterial
              color={S.cyan}
              transparent
              opacity={0.22 + shock * 0.5}
            />
          </mesh>
        ))}
        <Glow
          position={earth}
          size={0.8 + shock * 4.2}
          color="#FF7FB8"
          opacity={shock * 0.95}
        />
      </Stage>
      <AbsoluteFill style={{ background: "#FF4F7A", opacity: shock * 0.22 }} />
      <Glass top={150} o={prog(frame, launch, 10)}>
        <Big size={78} color={S.gold}>
          {Math.round(150 * Math.min(1, tt))} millones de km
        </Big>
        <Small color={S.white}>
          <span style={{ opacity: 0.75 }}>Sol → Tierra</span>
          <span style={{ opacity: prog(frame, horas - 4, 10) }}>
            {" "}
            · en 17,6 horas
          </span>
        </Small>
      </Glass>
      <Glass top={372} o={visible(frame, horas + 14, hit + 6, 10)} scale={0.8}>
        <div style={{ fontSize: 33, fontWeight: 800, color: S.muted }}>
          lo habitual: varios días
        </div>
      </Glass>
    </AbsoluteFill>
  );
};

// --- 4 · Auroras hasta en Cuba y Colombia -------------------------------------------------------

const EARTH_R = 1.12;
const globePoint = (
  lat: number,
  lon: number,
  tilt: number,
  rotY: number,
  center: V3,
  r = EARTH_R,
): V3 => {
  const v = new THREE.Vector3(...latLon(lat, lon, r))
    .applyEuler(new THREE.Euler(0, rotY, 0))
    .applyEuler(new THREE.Euler(tilt, 0, 0));
  return [v.x + center[0], v.y + center[1], v.z + center[2]];
};

const Pin: React.FC<{
  x: number;
  y: number;
  dx: number;
  dy: number;
  o: number;
  label: string;
}> = ({ x, y, dx, dy, o, label }) => (
  <>
    <svg
      width={W}
      height={H}
      style={{ position: "absolute", inset: 0, opacity: o }}
    >
      <line
        x1={x}
        y1={y}
        x2={x + dx}
        y2={y + dy}
        stroke="#FFFFFF"
        strokeWidth={3}
      />
      <circle cx={x} cy={y} r={10} fill="#FFFFFF" />
      <circle
        cx={x}
        cy={y}
        r={10 + 16 * o}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={3}
        opacity={0.6}
      />
    </svg>
    <div
      style={{
        position: "absolute",
        left: x + dx,
        top: y + dy,
        translate: `${dx < 0 ? "-100%" : "0"} -50%`,
        opacity: o,
        scale: String(0.8 + 0.2 * o),
        fontFamily: fonts.body,
        fontWeight: 900,
        fontSize: 46,
        color: "#12060C",
        background: "#FFFFFF",
        padding: "6px 22px",
        borderRadius: 16,
        boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
      }}
    >
      {label}
    </div>
  </>
);

export const CAurora: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const cuba = c.word("c6", "cuba");
  const col = c.word("c6", "colombia");
  const lat = mix(66, 17, prog(frame, -6, col + 6, inOut));
  const tilt = 0.5;
  const rotY =
    faceLon(-80) + mix(-0.12, 0.04, prog(frame, 0, c.duration, linear));
  const center: V3 = [0, 0.25, 0];
  const cam: V3 = [0, 0.4, 6.3];
  const dots = useLandDots(1.5);
  const eg = useDotGeometry(dots);
  const ec = eg.attributes.color.array as Float32Array;
  for (let i = 0; i < dots.count; i++) {
    const under = dots.lat[i] > lat - 4 ? 1 : 0;
    ec[i * 3] = 0.16 + under * 0.6;
    ec[i * 3 + 1] = 0.7 - under * 0.35;
    ec[i * 3 + 2] = 0.95 - under * 0.45;
  }
  eg.attributes.color.needsUpdate = true;
  const pc = project(
    globePoint(21.6, -79.5, tilt, rotY, center),
    cam,
    center,
    40,
  );
  const pk = project(
    globePoint(4.6, -74.1, tilt, rotY, center),
    cam,
    center,
    40,
  );
  return (
    <AbsoluteFill style={{ background: S.bg }}>
      <Stage dpr={DPR} camera={cam} target={center} fov={40} env={0.3}>
        <Bokeh
          frame={frame}
          count={300}
          spread={36}
          color="#FFFFFF"
          size={0.09}
        />
        <group position={center} rotation={[tilt, 0, 0]}>
          <group rotation={[0, rotY, 0]} scale={EARTH_R}>
            <DotEarth
              geometry={eg}
              size={0.045}
              halo="#FF4F8A"
              haloOpacity={0.4}
            >
              <AuroraRing lat={lat} frame={frame} />
              <AuroraRing
                lat={lat + 9}
                frame={frame + 40}
                opacity={0.6}
                count={1400}
              />
            </DotEarth>
          </group>
        </group>
      </Stage>
      <Pin
        x={pc.x}
        y={pc.y}
        dx={-150}
        dy={-70}
        o={prog(frame, cuba - 4, 8)}
        label="Cuba"
      />
      <Pin
        x={pk.x}
        y={pk.y}
        dx={150}
        dy={60}
        o={prog(frame, col - 4, 8)}
        label="Colombia"
      />
      <Glass top={170} o={prog(frame, 4, 10)}>
        <Big size={62} color={S.magenta}>
          auroras casi en el ecuador
        </Big>
        <Small color={S.white}>lo normal: solo cerca de los polos</Small>
      </Glass>
    </AbsoluteFill>
  );
};

// --- 5 · Telégrafos funcionando con la electricidad del cielo -----------------------------------

const MORSE = [3, 3, 9, 3, 3, 3, 9, 7, 3, 3, 3, 3, 9, 3, 9, 9];
const MORSE_LEN = MORSE.reduce((a, b) => a + b, 0);
/** 1 mientras el manipulador está pulsado (patrón de puntos y rayas en bucle). */
export const morse = (frame: number) => {
  let t = ((frame % MORSE_LEN) + MORSE_LEN) % MORSE_LEN;
  for (let i = 0; i < MORSE.length; i++) {
    if (t < MORSE[i]) return i % 2 === 0 ? 1 : 0;
    t -= MORSE[i];
  }
  return 0;
};
/** Fotogramas (relativos al inicio del patrón) en que empieza cada pulsación. */
export const morseTaps = (count: number) => {
  const taps: number[] = [];
  for (let f = 0; taps.length < count; f++)
    if (morse(f) === 1 && (f === 0 || morse(f - 1) === 0)) taps.push(f);
  return taps;
};

export const CTelegraph: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const desc = c.word("c7", "desconectaron");
  const sig = c.word("c7", "siguieron");
  const elec = c.word("c7", "electricidad");
  const on = frame >= sig ? morse(frame - sig) : 0;
  const glow = prog(frame, sig - 12, 24);
  const orbit = prog(frame, 0, c.duration, inOut);
  const cam: V3 = [
    mix(0.9, -0.3, orbit),
    mix(3.7, 3.2, orbit),
    mix(6.6, 7.2, orbit),
  ];
  const target: V3 = [0, 1.0, -0.4];
  const gap = project(WIRE_GAP, cam, target, 38);
  const xo = visible(frame, desc - 2, sig + 30, 8);
  return (
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(180deg, #07051A 0%, #170A22 60%, #0B0508 100%)",
      }}
    >
      <Stars frame={frame} count={90} height={1000} />
      <AuroraSky
        frame={frame + 300}
        intensity={0.55 + 0.45 * glow}
        height={1250}
        seed="tg"
      />
      <Stage
        dpr={DPR}
        camera={cam}
        target={target}
        fov={38}
        env={0.4}
        keyColor="#FFD9C0"
        rimColor="#FF5FA8"
        fillColor="#FF4F8A"
        fillIntensity={8}
        fog={{ color: "#0B0508", near: 10, far: 26 }}
      >
        <Telegraph press={on} flow={frame} glow={glow} />
      </Stage>
      <svg
        width={W}
        height={H}
        style={{ position: "absolute", inset: 0, opacity: xo }}
      >
        <circle
          cx={gap.x}
          cy={gap.y}
          r={58}
          fill="rgba(255,64,88,0.18)"
          stroke={S.red}
          strokeWidth={6}
        />
        <path
          d={`M${gap.x - 26} ${gap.y - 26} L${gap.x + 26} ${gap.y + 26} M${gap.x + 26} ${gap.y - 26} L${gap.x - 26} ${gap.y + 26}`}
          stroke={S.red}
          strokeWidth={9}
          strokeLinecap="round"
        />
      </svg>
      <Glass top={170} o={visible(frame, desc - 4, elec - 2, 10)}>
        <Big size={70} color={S.red}>
          pila: desconectada
        </Big>
        <Small color={S.white}>y el telégrafo seguía funcionando</Small>
      </Glass>
      <Glass top={170} o={prog(frame, elec, 10)}>
        <Big size={70} color={S.magenta}>
          energía: la aurora
        </Big>
        <Small color={S.white}>Boston ⇄ Portland · unas 2 horas</Small>
      </Glass>
    </AbsoluteFill>
  );
};

// --- 6 · ¿Y si pasara hoy? ----------------------------------------------------------------------

const Chip: React.FC<{ label: string; o: number; dead: boolean }> = ({
  label,
  o,
  dead,
}) => (
  <div
    style={{
      opacity: o,
      scale: String(0.8 + 0.2 * o),
      fontFamily: fonts.body,
      fontWeight: 900,
      fontSize: 40,
      padding: "14px 26px",
      borderRadius: 18,
      color: dead ? "#FFFFFF" : "#06131C",
      background: dead ? S.red : S.cyan,
      textDecoration: dead ? "line-through" : "none",
      boxShadow: `0 0 40px ${dead ? S.red : S.cyan}88`,
    }}
  >
    {label}
  </div>
);

export const CToday: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = useCues();
  const sat = c.word("c8", "satelites");
  const gps = c.word("c8", "gps");
  const red = c.word("c8", "redes");
  const fail = c.word("c8", "fallar");
  const c9 = c.start("c9");
  const dead = frame >= fail;
  const thr = mix(92, 24, prog(frame, fail, 46, inOut));
  const dots = useLandDots(1.3);
  const eg = useDotGeometry(dots);
  const ec = eg.attributes.color.array as Float32Array;
  const k = Math.floor(frame / 2);
  for (let i = 0; i < dots.count; i++) {
    const w = 0.5 + 0.5 * random(`cw${i}`) ** 2;
    const a = Math.abs(dots.lat[i]);
    let b = w;
    if (a > thr) b = 0.03;
    else if (a > thr - 7 && random(`cf${i}-${k}`) < 0.5) b = 0.03;
    ec[i * 3] = b > 0.05 ? b : 0.02;
    ec[i * 3 + 1] = b > 0.05 ? b * 0.7 : 0.03;
    ec[i * 3 + 2] = b > 0.05 ? b * 0.22 : 0.08;
  }
  eg.attributes.color.needsUpdate = true;
  const q = spring({ frame: frame - 2, fps, config: { damping: 13 } });
  const blink = frame % 10 < 5;
  const flick = dead && frame < fail + 26 && random(`tf${k}`) < 0.45;
  return (
    <AbsoluteFill style={{ background: S.bg }}>
      <Stage
        dpr={DPR}
        camera={[0, 0.9, 6.7]}
        target={[0, 0.25, 0]}
        fov={40}
        env={0.5}
      >
        <Bokeh
          frame={frame}
          count={300}
          spread={36}
          color="#FFFFFF"
          size={0.09}
        />
        <group position={[0, 0.25, 0]} rotation={[0.32, 0, 0]}>
          <group
            rotation={[0, faceLon(-35) + frame * 0.0035, 0]}
            scale={EARTH_R}
          >
            <DotEarth
              geometry={eg}
              size={0.042}
              halo={dead ? "#FF4F6A" : "#3B7BFF"}
              haloOpacity={0.4}
            >
              {dead ? (
                <AuroraRing
                  lat={mix(72, 44, prog(frame, fail, 46, inOut))}
                  frame={frame}
                  opacity={0.8}
                  count={1600}
                />
              ) : null}
            </DotEarth>
          </group>
          {[0, 1, 2].map((i) => {
            const r = 1.75 + i * 0.22;
            const a = frame * (0.022 - i * 0.004) + i * 2.1;
            return (
              <group key={i} rotation={[[0.5, -0.9, 1.25][i], i * 1.3, 0]}>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[r, 0.004, 6, 140]} />
                  <meshBasicMaterial
                    color={dead ? S.red : S.cyan}
                    transparent
                    opacity={0.28 * prog(frame, sat - 6, 12)}
                  />
                </mesh>
                <group
                  position={[Math.cos(a) * r, 0, Math.sin(a) * r]}
                  rotation={[0.4, a, 0.3 + (dead ? (frame - fail) * 0.04 : 0)]}
                  scale={prog(frame, sat - 6, 12)}
                >
                  <Satellite
                    color={dead ? (blink ? "#FF2A3C" : "#330008") : S.cyan}
                    scale={0.85}
                  />
                </group>
              </group>
            );
          })}
        </group>
      </Stage>
      <AbsoluteFill
        style={{
          background: "#FF2A3C",
          opacity: flick ? 0.2 : dead ? 0.05 : 0,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 150,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: fonts.body,
          fontWeight: 900,
          fontSize: 118,
          lineHeight: 1,
          color: S.white,
          opacity: Math.min(1, q) * (1 - prog(frame, sat - 10, 8)),
          scale: String(0.7 + 0.3 * q),
          textShadow: "0 0 50px rgba(127,231,255,0.8), 0 8px 0 rgba(0,0,0,0.5)",
        }}
      >
        ¿Y SI PASARA
        <br />
        <span style={{ color: S.cyan }}>HOY?</span>
      </div>
      <div
        style={{
          position: "absolute",
          top: 180,
          left: 40,
          right: 40,
          display: "flex",
          flexWrap: "wrap",
          gap: 20,
          justifyContent: "center",
          opacity: 1 - prog(frame, c9 - 6, 8),
        }}
      >
        <Chip label="SATÉLITES" o={prog(frame, sat - 3, 7)} dead={dead} />
        <Chip label="GPS" o={prog(frame, gps - 3, 7)} dead={dead} />
        <Chip label="RED ELÉCTRICA" o={prog(frame, red - 3, 7)} dead={dead} />
      </div>
      <Glass top={160} o={prog(frame, c9 + 2, 10)}>
        <Big size={64} color={S.red}>
          años para reparar
        </Big>
        <Small color={S.white}>daños estimados: más de 2 billones de $</Small>
        <div
          style={{
            fontSize: 24,
            color: S.muted,
            marginTop: 8,
            fontWeight: 600,
          }}
        >
          estimación de la Academia de Ciencias de EE. UU. (vía NASA)
        </div>
      </Glass>
    </AbsoluteFill>
  );
};

// --- 7 · 2012: falló por una semana -------------------------------------------------------------

const CX = 540;
const CY = 860;
const RX = 440;
const RY = 320;
const orbitPt = (deg: number, rho = 1) => {
  const a = (deg * Math.PI) / 180;
  return { x: CX + Math.cos(a) * RX * rho, y: CY + Math.sin(a) * RY * rho };
};

export const CFinal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = useCues();
  const tor = c.word("c10", "tormenta");
  const orb = c.word("c10", "orbita");
  const end = c.end("c11", 0.25);
  const EARTH = 198;
  const FIRE = EARTH + 118;
  // La región activa gira con el Sol: una semana antes apuntaba a la Tierra.
  const rot = prog(frame, 6, tor - 6, inOut);
  const region = mix(EARTH, FIRE, rot);
  const days = Math.round(mix(-7, 0, rot));
  const front = mix(0.08, 1.9, prog(frame, tor, orb - tor + 26, linear));
  const fired = frame >= tor;
  const HW = 21;
  const wedge = (deg: number, rho: number) => {
    const pts = [];
    for (let a = -HW; a <= HW; a += 3) pts.push(orbitPt(deg + a, rho));
    return `M${CX} ${CY} ${pts.map((p) => `L${p.x} ${p.y}`).join(" ")} Z`;
  };
  const arc = (deg: number, rho: number) => {
    const pts = [];
    for (let a = -HW; a <= HW; a += 3) pts.push(orbitPt(deg + a, rho));
    return `M${pts.map((p) => `${p.x} ${p.y}`).join(" L")}`;
  };
  const e = orbitPt(EARTH);
  const rp = orbitPt(region, 0.2);
  const title = spring({ frame: frame - end, fps, config: { damping: 200 } });
  const pulse = 0.5 + 0.5 * Math.sin(frame / 5);
  return (
    <AbsoluteFill style={{ background: S.bg }}>
      <Stars frame={frame} count={170} height={H} />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="f-sun">
            <stop offset="0" stopColor="#FFFBE0" />
            <stop offset="0.35" stopColor="#FFC24D" />
            <stop offset="0.6" stopColor="#FF7A1E" stopOpacity="0.6" />
            <stop offset="1" stopColor="#FF5A1E" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="f-cme"
            gradientUnits="userSpaceOnUse"
            cx={CX}
            cy={CY}
            r={RX * front}
          >
            <stop offset="0" stopColor="#FF5FA8" stopOpacity="0" />
            <stop offset="0.55" stopColor="#FF4F7A" stopOpacity="0.35" />
            <stop offset="0.92" stopColor="#FFC24D" stopOpacity="0.9" />
            <stop offset="1" stopColor="#FFF3D0" stopOpacity="0.95" />
          </radialGradient>
          <radialGradient id="f-earth">
            <stop offset="0" stopColor="#BFE6FF" />
            <stop offset="0.5" stopColor="#3B8BFF" />
            <stop offset="1" stopColor="#123A9C" />
          </radialGradient>
          <filter id="f-blur" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
        </defs>
        {/* Órbita de la Tierra */}
        <ellipse
          cx={CX}
          cy={CY}
          rx={RX}
          ry={RY}
          fill="none"
          stroke="rgba(127,231,255,0.5)"
          strokeWidth={3}
          strokeDasharray="4 12"
        />
        {/* Hacia dónde apuntaba la región una semana antes */}
        <path
          d={wedge(EARTH, 1.12)}
          fill="rgba(255,255,255,0.07)"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth={2.5}
          strokeDasharray="10 10"
          opacity={prog(frame, 10, 14)}
        />
        {/* Eyección de masa coronal */}
        {fired ? (
          <g>
            <path
              d={wedge(FIRE, front)}
              fill="url(#f-cme)"
              filter="url(#f-blur)"
            />
            <path
              d={arc(FIRE, front)}
              stroke="#FFF3D0"
              strokeWidth={7}
              fill="none"
              strokeLinecap="round"
              filter="url(#f-blur)"
            />
            <path
              d={arc(FIRE, front)}
              stroke="#FFFFFF"
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
            />
          </g>
        ) : null}
        {/* Sol y su región activa */}
        <circle cx={CX} cy={CY} r={150} fill="url(#f-sun)" />
        <circle cx={CX} cy={CY} r={62} fill="#FFD67A" />
        <line
          x1={CX}
          y1={CY}
          x2={rp.x}
          y2={rp.y}
          stroke="#FFFFFF"
          strokeWidth={5}
          strokeLinecap="round"
        />
        <circle
          cx={rp.x}
          cy={rp.y}
          r={12 + (fired ? 0 : pulse * 5)}
          fill="#FFFFFF"
        />
        {/* Tierra */}
        <circle
          cx={e.x}
          cy={e.y}
          r={46 + pulse * 6}
          fill="none"
          stroke="rgba(127,231,255,0.5)"
          strokeWidth={3}
        />
        <circle cx={e.x} cy={e.y} r={30} fill="url(#f-earth)" />
      </svg>
      <div
        style={{
          position: "absolute",
          left: e.x - 60,
          top: e.y + 58,
          fontFamily: fonts.body,
          fontWeight: 900,
          fontSize: 40,
          color: S.cyan,
          textShadow: "0 2px 12px #000",
        }}
      >
        Tierra
      </div>
      <div
        style={{
          position: "absolute",
          left: 60,
          top: CY - 440,
          width: 420,
          fontFamily: fonts.body,
          fontWeight: 800,
          fontSize: 32,
          lineHeight: 1.2,
          color: "#E9E4F7",
          opacity: prog(frame, 14, 12),
          textShadow: "0 2px 12px #000",
        }}
      >
        una semana antes
        <br />
        apuntaba aquí
      </div>
      <div
        style={{
          position: "absolute",
          right: 50,
          top: CY + 350,
          fontFamily: fonts.body,
          fontWeight: 600,
          fontSize: 24,
          color: S.muted,
        }}
      >
        esquema · no a escala
      </div>
      <Glass top={150} o={prog(frame, 4, 10)}>
        <Big size={74} color={fired ? S.gold : S.white}>
          {fired
            ? "23 jul 2012"
            : days === 0
              ? "día 0"
              : `−${Math.abs(days)} ${days === -1 ? "día" : "días"}`}
        </Big>
        <Small color={S.white}>
          {fired
            ? "tormenta de clase Carrington"
            : "el Sol gira · julio de 2012"}
        </Small>
      </Glass>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: title,
          background: `rgba(5,3,12,${0.78 * title})`,
        }}
      >
        <div
          style={{
            textAlign: "center",
            fontFamily: fonts.body,
            marginTop: -200,
            padding: "0 60px",
          }}
        >
          <div
            style={{
              fontWeight: 900,
              fontSize: 128,
              lineHeight: 1,
              color: S.white,
              letterSpacing: `${(1 - title) * 0.2}em`,
            }}
          >
            ¿Y LA
            <br />
            <span style={{ color: S.red }}>PRÓXIMA?</span>
          </div>
          <div
            style={{
              fontWeight: 900,
              fontSize: 60,
              color: S.gold,
              marginTop: 44,
            }}
          >
            ≈ 12 % por década
          </div>
          <div
            style={{
              fontWeight: 600,
              fontSize: 30,
              color: S.muted,
              marginTop: 14,
            }}
          >
            probabilidad estimada en 2012 (P. Riley)
          </div>
          <div
            style={{
              fontSize: 24,
              color: S.muted,
              marginTop: 60,
              letterSpacing: "0.06em",
            }}
          >
            Fuentes: NASA Science · NOAA · Wikipedia
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

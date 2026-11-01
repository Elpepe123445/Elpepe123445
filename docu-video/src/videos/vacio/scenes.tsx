import React from "react";
import {
  AbsoluteFill,
  random,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Bokeh, Glow, Stage } from "../../components/three/Stage";
import { fmt, fonts, inOut, mix, prog, visible } from "../../engine/theme";
import { useCues } from "../../engine/timeline";
import {
  Beam,
  Cell,
  ElectronCloud,
  Nucleus,
  PointCloud,
  Spoon,
  Stadium,
  SugarCube,
  usePoints,
  V,
  useStarTexture,
  Water,
} from "./models";

/** Tarjeta "de cristal" para cifras y rótulos sobre la escena 3D. */
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
    }}
  >
    <div
      style={{
        padding: "26px 44px",
        borderRadius: 32,
        background:
          "linear-gradient(160deg, rgba(255,255,255,0.16), rgba(255,255,255,0.04))",
        border: "1.5px solid rgba(255,255,255,0.22)",
        boxShadow:
          "0 30px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.3)",
        textAlign: "center",
        scale: String(scale),
        fontFamily: fonts.body,
        color: V.white,
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
}> = ({ children, color = V.white, size = 96 }) => (
  <div
    style={{
      fontWeight: 900,
      fontSize: size,
      lineHeight: 1,
      color,
      textShadow: `0 0 40px ${color}55`,
    }}
  >
    {children}
  </div>
);
const Small: React.FC<{ children: React.ReactNode; color?: string }> = ({
  children,
  color = V.muted,
}) => (
  <div
    style={{
      fontWeight: 600,
      fontSize: 32,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      marginTop: 10,
      color,
    }}
  >
    {children}
  </div>
);

/** 1 · Toda la humanidad se comprime en un cubito de azúcar. */
export const VHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = useCues();
  const at = c.word("v1", "cubito");
  const conv = prog(frame, at - 26, 46, inOut);
  const dive = prog(frame, c.start("v2", 0.6), 50, inOut);
  const N = 5000;
  const geo = usePoints(N);
  const arr = geo.attributes.position.array as Float32Array;
  for (let i = 0; i < N; i++) {
    const r = 1.6 + random(`r${i}`) * 3.4;
    const a = random(`a${i}`) * Math.PI * 2 + frame * 0.006 * (3 / r);
    const y = (random(`y${i}`) - 0.5) * 1.4 * (1 - r / 7);
    const cx = (random(`cx${i}`) - 0.5) * 0.58;
    const cy = (random(`cy${i}`) - 0.5) * 0.58;
    const cz = (random(`cz${i}`) - 0.5) * 0.58;
    arr[i * 3] = mix(Math.cos(a) * r, cx, conv);
    arr[i * 3 + 1] = mix(y + Math.sin(a * 2) * 0.15, cy, conv);
    arr[i * 3 + 2] = mix(Math.sin(a) * r, cz, conv);
  }
  geo.attributes.position.needsUpdate = true;
  const pop = spring({ frame: frame - at - 18, fps, config: { damping: 12 } });
  const camZ = mix(mix(9, 3.6, conv), 0.9, dive);
  return (
    <AbsoluteFill style={{ background: V.bg }}>
      <Stage
        camera={[0, mix(1.6, 0.5, conv), camZ]}
        target={[0, 0, 0]}
        fov={40}
        fog={{ color: "#0B0820", near: 6, far: 26 }}
      >
        <Bokeh frame={frame} count={300} spread={30} />
        <PointCloud
          geometry={geo}
          color={V.amber}
          size={mix(0.07, 0.035, conv)}
          opacity={1 - conv * 0.3}
        />
        <group rotation={[0.45, frame * 0.012, 0.15]}>
          <SugarCube
            size={0.62 * Math.min(1, pop)}
            opacity={Math.min(1, conv * 1.2)}
          />
        </group>
        <Glow size={2.6} color={V.amber} opacity={0.35 * conv} />
      </Stage>
      <Glass top={230} o={visible(frame, 4, at + 10, 12)}>
        <Big color={V.amber}>
          {fmt(Math.round(8000 * prog(frame, 4, 50)))} millones
        </Big>
        <Small>de personas · toda la humanidad</Small>
      </Glass>
      <Glass
        top={230}
        o={prog(frame, at + 14, 12) * (1 - dive)}
        scale={0.85 + 0.15 * Math.min(1, pop)}
      >
        <Big>≈ 2 cm³</Big>
        <Small color={V.amber}>sin espacio vacío · ≈ 500 millones de t</Small>
      </Glass>
      <AbsoluteFill
        style={{
          background: "#FFFFFF",
          opacity: prog(frame, c.duration - 16, 14) * 0.9,
        }}
      />
    </AbsoluteFill>
  );
};

const LEVELS = [
  { key: "celulas", label: "Células", size: "≈ 0,01 mm" },
  { key: "moleculas", label: "Moléculas de agua", size: "≈ 0,0000003 mm" },
  { key: "atomos", label: "Átomo", size: "≈ 0,0000001 mm" },
] as const;

/** 2 · Zoom continuo: células → moléculas → átomo (cada nivel crece hasta "atravesar" la cámara). */
export const VZoom: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const t1 = c.word("v3", "moleculas");
  const t2 = c.word("v3", "atomos");
  const nucleusAt = c.word("v4", "nucleo");
  const elecAt = c.word("v4", "electrones");
  // Escala de cada nivel: entra pequeño, crece, y sale "pasando" la cámara.
  const lvl = (enter: number, exit: number) => {
    const inP = prog(frame, enter - 18, 30, inOut);
    const outP = prog(frame, exit - 14, 26, (t) => t * t);
    return {
      scale: mix(0.08, 1, inP) * mix(1, 9, outP),
      o: Math.min(inP * 1.5, 1) * (1 - outP),
      visible: inP > 0 && outP < 1,
    };
  };
  const L1 = lvl(-30, t1);
  const L2 = lvl(t1, t2);
  const L3 = lvl(t2, 99999);
  const active = frame < t1 ? 0 : frame < t2 ? 1 : 2;
  return (
    <AbsoluteFill style={{ background: V.bg }}>
      <Stage
        camera={[0, 0.2, 6.5]}
        fov={42}
        fog={{ color: "#0B0820", near: 7, far: 30 }}
      >
        <Bokeh frame={frame} count={260} spread={26} color="#C9A8FF" />
        {L1.visible ? (
          <group scale={L1.scale} rotation={[0.2, frame * 0.004, 0]}>
            {new Array(13).fill(0).map((_, i) => (
              <Cell
                key={i}
                seed={i}
                r={0.55 + random(`cr${i}`) * 0.45}
                opacity={L1.o}
                position={[
                  (random(`cx${i}`) - 0.5) * 4.2,
                  (random(`cy${i}`) - 0.5) * 6,
                  (random(`cz${i}`) - 0.5) * 2.5,
                ]}
              />
            ))}
          </group>
        ) : null}
        {L2.visible ? (
          <group scale={L2.scale}>
            {new Array(22).fill(0).map((_, i) => (
              <Water
                key={i}
                opacity={L2.o}
                position={[
                  (random(`wx${i}`) - 0.5) * 4.4,
                  (random(`wy${i}`) - 0.5) * 6.4,
                  (random(`wz${i}`) - 0.5) * 3,
                ]}
                rotation={[
                  random(`wa${i}`) * 6 + frame * 0.02,
                  random(`wb${i}`) * 6 + frame * 0.015,
                  random(`wc${i}`) * 6,
                ]}
              />
            ))}
          </group>
        ) : null}
        {L3.visible ? (
          <group scale={L3.scale}>
            <Nucleus
              spin={frame * 0.02}
              scale={mix(1, 1.4, prog(frame, nucleusAt, 20))}
              opacity={L3.o}
            />
            <ElectronCloud
              radius={2.2}
              color={V.cyan}
              opacity={L3.o * prog(frame, t2 - 10, 30)}
              seed="z"
              frame={frame}
            />
            {[0, 1, 2].map((k) => {
              const a = frame * (0.05 + k * 0.012) + k * 2;
              const R = 1.3 + k * 0.45;
              const tilt = [0.3, -0.8, 1.2][k];
              return (
                <group key={k} rotation={[tilt, k, 0]}>
                  <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[R, 0.006, 8, 160]} />
                    <meshBasicMaterial
                      color={V.cyan}
                      transparent
                      opacity={0.35 * L3.o * prog(frame, elecAt - 6, 16)}
                    />
                  </mesh>
                  <Glow
                    position={[Math.cos(a) * R, 0, Math.sin(a) * R]}
                    size={0.5}
                    color={V.cyan}
                    opacity={L3.o * prog(frame, elecAt - 6, 16)}
                  />
                </group>
              );
            })}
          </group>
        ) : null}
      </Stage>
      <Glass top={220} o={1}>
        <Big size={64} color={[V.white, "#FF9AAA", V.cyan][active]}>
          {LEVELS[active].label}
        </Big>
        <Small>{LEVELS[active].size}</Small>
      </Glass>
      <Glass
        top={1180}
        o={visible(frame, nucleusAt - 4, c.duration, 10)}
        scale={0.8}
      >
        <div style={{ fontSize: 34, fontWeight: 800 }}>
          <span style={{ color: "#FF8FA0" }}>● núcleo</span>
          <span style={{ color: V.muted }}>{"  ·  "}</span>
          <span style={{ color: V.cyan, opacity: prog(frame, elecAt - 4, 10) }}>
            ● electrones
          </span>
        </div>
      </Glass>
    </AbsoluteFill>
  );
};

/** 3 · La canica en el estadio: la cámara despega desde el núcleo hasta ver el estadio entero. */
export const VStadium: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const canica = c.word("v5", "canica");
  const estadio = c.word("v5", "estadio");
  const nada = c.start("v6");
  const crane = prog(frame, canica + 6, estadio - canica + 20, inOut);
  const dark = prog(frame, nada + 10, 30);
  const cam: [number, number, number] = [
    mix(0.22, 0, crane),
    mix(0.24, 9.5, crane),
    mix(0.62, 13, crane),
  ];
  return (
    <AbsoluteFill style={{ background: V.bg }}>
      <Stage
        camera={cam}
        target={[0, 0, 0]}
        fov={mix(40, 52, crane)}
        env={0.7}
        fog={{ color: "#0B0820", near: 14, far: 40 }}
      >
        <Stadium opacity={1 - dark * 0.7} />
        <mesh position={[0, 0.06, 0]}>
          <sphereGeometry args={[0.06, 48, 48]} />
          <meshPhysicalMaterial
            color="#4FC3FF"
            roughness={0.05}
            clearcoat={1}
            emissive="#1A6BFF"
            emissiveIntensity={0.6}
          />
        </mesh>
        <Glow
          position={[0, 0.06, 0]}
          size={mix(0.4, 1.4, crane)}
          color="#7FD8FF"
          opacity={0.9}
        />
        {[0, 1, 2].map((k) => {
          const a = frame * 0.02 + k * 2.1;
          return (
            <Glow
              key={k}
              position={[Math.cos(a) * 7.6, 1.6 + k * 0.6, Math.sin(a) * 5.6]}
              size={0.9}
              color={V.cyan}
              opacity={prog(frame, estadio - 10, 20)}
            />
          );
        })}
      </Stage>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 50% 52%, transparent 6%, rgba(5,4,15,0.92) 30%)",
          opacity: dark,
        }}
      />
      <Glass top={220} o={visible(frame, canica - 6, estadio + 4, 10)}>
        <Big size={70} color={V.cyan}>
          núcleo = canica
        </Big>
      </Glass>
      <Glass top={220} o={visible(frame, estadio - 4, nada + 10, 10)}>
        <Big size={70}>átomo &gt; estadio</Big>
        <Small>hidrógeno: ~60.000 veces más grande</Small>
      </Glass>
      <Glass
        top={240}
        o={prog(frame, nada + 20, 14)}
        scale={0.9 + 0.1 * prog(frame, nada + 20, 20)}
      >
        <Big size={120} color={V.cyan}>
          99,9999 %
        </Big>
        <Small color={V.white}>vacío</Small>
      </Glass>
    </AbsoluteFill>
  );
};

/** 4 · No tocas nada: dos nubes de electrones se acercan y se repelen. */
export const VTouch: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const rep = c.word("v7", "repelen");
  const approach = prog(frame, 0, rep - 8, inOut);
  const bounce =
    Math.exp(-Math.max(0, frame - rep) / 30) *
    Math.sin(Math.max(0, frame - rep) / 6);
  const gap =
    mix(2.3, 1.05, approach) +
    bounce * 0.25 +
    prog(frame, rep, 30, inOut) * 0.25;
  const pulse = 0.5 + 0.5 * Math.sin(frame / 4);
  const fuerza = c.word("v8", "fuerza");
  return (
    <AbsoluteFill style={{ background: V.bg }}>
      <Stage
        camera={[0, 0.3, 8.6]}
        fov={45}
        fog={{ color: "#0B0820", near: 6, far: 24 }}
      >
        <Bokeh frame={frame} count={220} spread={24} />
        <group position={[-gap, 0.4, 0]}>
          <Nucleus spin={frame * 0.02} scale={1.1} />
          <ElectronCloud
            radius={1.15}
            color={V.cyan}
            opacity={1}
            seed="a"
            pointSize={0.11}
            halo={0.35}
            frame={frame}
          />
        </group>
        <group position={[gap, -0.4, 0]}>
          <Nucleus spin={-frame * 0.02} scale={1.1} />
          <ElectronCloud
            radius={1.15}
            color={V.magenta}
            opacity={1}
            seed="b"
            pointSize={0.11}
            halo={0.35}
            frame={-frame}
          />
        </group>
        {frame > rep - 6 ? (
          <>
            {[-1, 1].map((s) => (
              <group
                key={s}
                position={[s * 0.55, 0, 0]}
                rotation={[0, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2]}
              >
                <mesh position={[0, 0.25, 0]}>
                  <coneGeometry args={[0.14, 0.32, 24]} />
                  <meshStandardMaterial
                    color="#FFFFFF"
                    emissive="#FFFFFF"
                    emissiveIntensity={0.6 + pulse}
                  />
                </mesh>
                <mesh>
                  <cylinderGeometry args={[0.04, 0.04, 0.4, 12]} />
                  <meshStandardMaterial
                    color="#FFFFFF"
                    emissive="#FFFFFF"
                    emissiveIntensity={0.6}
                  />
                </mesh>
              </group>
            ))}
            <Glow size={1.6 + pulse * 0.6} color="#FFFFFF" opacity={0.5} />
          </>
        ) : null}
      </Stage>
      <Glass top={230} o={visible(frame, rep - 6, c.start("v8"), 10)}>
        <Big size={72}>
          <span style={{ color: V.cyan }}>–</span> se repelen{" "}
          <span style={{ color: V.magenta }}>–</span>
        </Big>
        <Small>repulsión electromagnética</Small>
      </Glass>
      <Glass top={230} o={prog(frame, fuerza - 10, 12)}>
        <Big size={70}>tocar = sentir una fuerza</Big>
      </Glass>
    </AbsoluteFill>
  );
};

/** 5 · Estrella de neutrones (púlsar) y la cucharadita de mil millones de toneladas. */
export const VStar: React.FC = () => {
  const frame = useCurrentFrame();
  const starTex = useStarTexture();
  const c = useCues();
  const cuchara = c.word("v9", "cucharadita");
  const spoon = prog(frame, cuchara - 10, 30, inOut);
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, #0E1B3A 0%, #03040C 70%)",
      }}
    >
      <Stage camera={[0, 0.4, mix(7, 8.5, spoon)]} fov={42} env={0.8}>
        <Bokeh
          frame={frame}
          count={500}
          spread={40}
          color="#FFFFFF"
          size={0.12}
        />
        <group
          position={[0, mix(1.2, 2.2, spoon), -2]}
          rotation={[0.35, frame * 0.03, 0.3]}
        >
          <mesh>
            <sphereGeometry args={[0.85, 64, 64]} />
            <meshStandardMaterial
              map={starTex}
              emissiveMap={starTex}
              color="#FFFFFF"
              emissive="#FFFFFF"
              emissiveIntensity={0.85}
              roughness={0.6}
            />
          </mesh>
          <Glow size={3.4} color="#8FD6FF" opacity={0.6} />
          <Glow size={7} color="#4F7BFF" opacity={0.22} />
          <group rotation={[0, frame * 0.09, 0]}>
            <group rotation={[0, 0, 0.5]}>
              <Beam length={5} opacity={0.32} />
              <group rotation={[Math.PI, 0, 0]}>
                <Beam length={5} opacity={0.32} />
              </group>
            </group>
          </group>
          {[1.5, 1.9, 2.3].map((r, i) => (
            <mesh
              key={i}
              rotation={[0, frame * 0.02 + i, Math.PI / 2]}
              scale={[1, 1.6, 1]}
            >
              <torusGeometry args={[r, 0.008, 8, 160]} />
              <meshBasicMaterial color="#9FD8FF" transparent opacity={0.3} />
            </mesh>
          ))}
        </group>
        <group
          position={[-0.3, mix(-4, -0.95, spoon), 1.6]}
          rotation={[0.45, 0.85 + frame * 0.004, -0.2]}
          scale={1.25}
        >
          <Spoon opacity={spoon} />
        </group>
      </Stage>
      <Glass top={210} o={visible(frame, 6, cuchara - 6, 10)}>
        <Big size={64} color="#9FD8FF">
          estrella de neutrones
        </Big>
        <Small>≈ 20 km de diámetro</Small>
      </Glass>
      <Glass top={210} o={prog(frame, cuchara + 10, 12)}>
        <Big size={78} color={V.cyan}>
          ≈ 1.000.000.000 t
        </Big>
        <Small color={V.white}>por cucharadita</Small>
      </Glass>
    </AbsoluteFill>
  );
};

/** 6 · Cierre: una persona hecha de partículas, casi toda vacía. */
export const VClosing: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = useCues();
  const N = 3600;
  const geo = usePoints(N);
  const arr = geo.attributes.position.array as Float32Array;
  // Silueta humana muestreada por partes (cabeza, torso, brazos, piernas).
  const parts: [number, number, number, number, number, number][] = [
    [0, 1.62, 0, 0.2, 0.24, 0.2],
    [0, 0.95, 0, 0.32, 0.45, 0.18],
    [-0.48, 0.95, 0, 0.09, 0.45, 0.09],
    [0.48, 0.95, 0, 0.09, 0.45, 0.09],
    [-0.16, 0.0, 0, 0.11, 0.55, 0.11],
    [0.16, 0.0, 0, 0.11, 0.55, 0.11],
  ];
  for (let i = 0; i < N; i++) {
    const p = parts[i % parts.length];
    const u = random(`u${i}`) * Math.PI * 2;
    const v = Math.acos(2 * random(`v${i}`) - 1);
    const s = Math.cbrt(random(`s${i}`));
    const drift = Math.sin(frame / 20 + i) * 0.01;
    arr[i * 3] = p[0] + Math.sin(v) * Math.cos(u) * p[3] * s + drift;
    arr[i * 3 + 1] = p[1] + Math.cos(v) * p[4] * s;
    arr[i * 3 + 2] = p[2] + Math.sin(v) * Math.sin(u) * p[5] * s;
  }
  geo.attributes.position.needsUpdate = true;
  const end = c.end("v10", 0.2);
  const title = spring({ frame: frame - end, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ background: V.bg }}>
      <Stage camera={[0, 1.0, 4.4]} target={[0, 0.8, 0]} fov={40}>
        <Bokeh frame={frame} count={260} spread={24} />
        <group rotation={[0, frame * 0.01, 0]} position={[0, -0.1, 0]}>
          <PointCloud
            geometry={geo}
            color={V.cyan}
            size={0.03}
            opacity={0.95}
          />
        </group>
        <Glow
          position={[0, 0.9, -0.5]}
          size={3.5}
          color="#6A4CFF"
          opacity={0.35}
        />
      </Stage>
      <Glass top={220} o={visible(frame, 10, end, 12)}>
        <Big size={110} color={V.cyan}>
          99,9999 %
        </Big>
        <Small color={V.white}>de ti es vacío</Small>
      </Glass>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: title,
          background: `rgba(5,4,15,${0.55 * title})`,
        }}
      >
        <div
          style={{
            textAlign: "center",
            fontFamily: fonts.body,
            marginTop: -260,
          }}
        >
          <div
            style={{
              fontWeight: 900,
              fontSize: 104,
              lineHeight: 1,
              color: V.white,
              letterSpacing: `${(1 - title) * 0.2}em`,
            }}
          >
            ERES CASI
            <br />
            <span style={{ color: V.cyan }}>TODO VACÍO</span>
          </div>
          <div
            style={{
              fontSize: 24,
              color: V.muted,
              marginTop: 34,
              letterSpacing: "0.08em",
            }}
          >
            Estimaciones con densidad nuclear · astronomy.com · Univ. de
            Melbourne
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

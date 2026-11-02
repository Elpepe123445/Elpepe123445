import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  random,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";
import { PovHud } from "../../components/three/PovHud";
import { Bokeh, Glow, Stage } from "../../components/three/Stage";
import { fmt, inOut, mix, prog, visible } from "../../engine/theme";
import { useCues } from "../../engine/timeline";
import {
  Alveolus,
  FlowingCells,
  Hemoglobin,
  Macrophage,
  makePath,
  MuscleFiber,
  R,
  Vessel,
} from "./models";

const FONT = "Inter, DejaVu Sans, sans-serif";

/** Tarjeta de dato grande, estilo "cristal" sobre la escena. */
const Fact: React.FC<{
  top: number;
  o: number;
  big: string;
  small?: string;
  color?: string;
  scale?: number;
}> = ({ top, o, big, small, color = "#FFFFFF", scale = 1 }) => (
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
        padding: "22px 40px",
        borderRadius: 28,
        background:
          "linear-gradient(160deg, rgba(255,255,255,0.18), rgba(255,255,255,0.05))",
        border: "1.5px solid rgba(255,255,255,0.25)",
        boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
        textAlign: "center",
        fontFamily: FONT,
        scale: String(scale),
      }}
    >
      <div
        style={{
          fontWeight: 900,
          fontSize: 76,
          lineHeight: 1,
          color,
          textShadow: `0 0 34px ${color}66`,
        }}
      >
        {big}
      </div>
      {small ? (
        <div
          style={{
            fontWeight: 700,
            fontSize: 30,
            color: "#FFE3E8",
            marginTop: 10,
            letterSpacing: "0.04em",
          }}
        >
          {small}
        </div>
      ) : null}
    </div>
  </div>
);

/** Cámara en primera persona sobre una curva: posición, mirada hacia delante y balanceo. */
const pov = (
  path: THREE.Curve<THREE.Vector3>,
  u: number,
  frame: number,
  bob = 0.06,
) => {
  const p = path.getPointAt(Math.min(0.995, Math.max(0, u)));
  const t = path.getPointAt(Math.min(1, Math.max(0, u) + 0.012));
  return {
    camera: [
      p.x + Math.sin(frame / 9) * bob,
      p.y + Math.cos(frame / 11) * bob,
      p.z,
    ] as [number, number, number],
    target: [t.x, t.y, t.z] as [number, number, number],
  };
};

/** Latido: pulso 0→1 cada ~0,8 s (unos 75 latidos por minuto). */
const beat = (frame: number) =>
  Math.pow(Math.max(0, Math.sin((frame / 24) * Math.PI * 2)), 12);

/** 1 · Salida del corazón por la aorta, a golpes de latido. */
export const RHeart: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const path = useMemo(() => makePath("aorta", 140, 5), []);
  let u = 0;
  for (let f = 0; f <= frame; f++) u += 0.0011 + beat(f) * 0.0045;
  const cam = pov(path, u, frame);
  const b = beat(frame);
  const count = c.word("r2", "billones");
  return (
    <AbsoluteFill style={{ background: R.bg }}>
      <Stage
        camera={cam.camera}
        target={cam.target}
        fov={64 + b * 6}
        env={0.22}
        keyColor="#FFD6D6"
        rimColor="#FF6A7A"
        fog={{ color: "#2A0410", near: 4, far: 26 }}
      >
        <pointLight
          position={cam.camera}
          intensity={7}
          distance={14}
          color="#FFE1E1"
        />
        <Vessel path={path} radius={3.2} />
        <FlowingCells
          path={path}
          count={320}
          radius={3.2}
          progress={u * 1.15}
          frame={frame}
        />
      </Stage>
      <AbsoluteFill
        style={{
          background: "#FF2D4D",
          opacity: b * 0.18 + (1 - prog(frame, 0, 14)) * 0.8,
          mixBlendMode: "screen",
        }}
      />
      <Fact
        top={520}
        o={visible(frame, count - 4, c.duration, 10)}
        big={fmt(25) + " billones"}
        small="84 % de tus células son glóbulos rojos"
        color="#FFD1D9"
      />
      <PovHud
        title="eres un glóbulo rojo"
        accent={R.accent}
        shake={b * 0.6}
        stats={[
          { label: "RITMO", text: "≈ 75 lpm", color: "#FFFFFF" },
          { label: "OXÍGENO", text: "100 %", value: 1, color: R.oxygen },
        ]}
      />
    </AbsoluteFill>
  );
};

/** 2 · Dentro de la célula: sin núcleo, llena de hemoglobina que atrapa oxígeno. */
export const RHemo: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const nucleo = c.word("r3", "nucleo");
  const hemo = c.word("r3", "hemoglobina");
  const cuatro = c.word("r4", "cuatro");
  const loaded = prog(frame, cuatro - 6, 24);
  const items = useMemo(
    () =>
      new Array(70).fill(0).map((_, i) => ({
        p: [
          (random(`hx${i}`) - 0.5) * 9,
          (random(`hy${i}`) - 0.5) * 12,
          -random(`hz${i}`) * 14,
        ] as [number, number, number],
        r: [
          random(`ha${i}`) * 6,
          random(`hb${i}`) * 6,
          random(`hc${i}`) * 6,
        ] as [number, number, number],
      })),
    [],
  );
  const z = mix(
    6,
    -4,
    prog(frame, 0, c.duration, (t) => t),
  );
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, #5A0718 0%, #1A0208 75%)",
      }}
    >
      <Stage
        camera={[Math.sin(frame / 40) * 0.6, 0, z]}
        target={[0, 0, z - 6]}
        fov={58}
        env={0.6}
        keyColor="#FFE2E2"
        rimColor="#FF7FA0"
        fog={{ color: "#2A0410", near: 3, far: 18 }}
      >
        <Bokeh
          frame={frame}
          count={300}
          spread={20}
          color="#FF8FA0"
          size={0.18}
        />
        {frame < hemo + 10 ? (
          <mesh
            position={[
              mix(0, 1.6, prog(frame, nucleo, 60, inOut)),
              mix(-0.4, 1.2, prog(frame, nucleo, 60, inOut)),
              z - mix(4.5, 13, prog(frame, nucleo, 60, inOut)),
            ]}
            scale={1.4 * (1 - prog(frame, hemo - 10, 20))}
          >
            <icosahedronGeometry args={[1, 4]} />
            <meshPhysicalMaterial
              color="#6B2FA0"
              roughness={0.35}
              clearcoat={1}
              sheen={1}
              sheenColor="#C9A2FF"
            />
          </mesh>
        ) : null}
        {items.map((it, i) => (
          <Hemoglobin
            key={i}
            position={it.p}
            rotation={[
              it.r[0] + frame * 0.01,
              it.r[1] + frame * 0.013,
              it.r[2],
            ]}
            scale={prog(frame, hemo - 30 + (i % 10) * 2, 16)}
            loaded={loaded}
          />
        ))}
        {loaded > 0 && loaded < 1
          ? new Array(30).fill(0).map((_, i) => {
              const it = items[i];
              const k = 1 - loaded;
              return (
                <Glow
                  key={i}
                  position={[
                    it.p[0] + k * (random(`ox${i}`) - 0.5) * 8,
                    it.p[1] + k * 6,
                    it.p[2],
                  ]}
                  size={0.35}
                  color={R.oxygen}
                  opacity={0.9}
                />
              );
            })
          : null}
      </Stage>
      <Fact
        top={520}
        o={visible(frame, nucleo - 4, hemo, 10)}
        big="sin núcleo"
        small="se expulsa al madurar · deja sitio a la hemoglobina"
        color="#FFD1D9"
      />
      <Fact
        top={520}
        o={visible(frame, c.start("r4") - 2, c.duration, 10)}
        big="≈ 270 millones"
        small={
          loaded > 0
            ? "de hemoglobinas · 4 O₂ cada una"
            : "de moléculas de hemoglobina"
        }
        color="#FFD1D9"
      />
      <PovHud
        title="eres un glóbulo rojo"
        accent={R.accent}
        stats={[
          { label: "HEMOGLOBINA", text: "≈ 270 M", color: "#FFFFFF" },
          {
            label: "OXÍGENO",
            text: loaded > 0 ? "4 por molécula" : "—",
            value: loaded,
            color: R.oxygen,
          },
        ]}
      />
    </AbsoluteFill>
  );
};

/** 3 · Pulmones: capilar entre alvéolos; el oxígeno entra y la saturación sube de 75 % a ~100 %. */
export const RLung: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const path = useMemo(() => makePath("pulmon", 60, 3), []);
  const u = 0.05 + prog(frame, 0, c.duration, (t) => t) * 0.5;
  const cam = pov(path, u, frame, 0.03);
  const breathe = prog(frame, c.word("r5", "respiras") - 6, 50, inOut);
  const sat = mix(0.75, 1, breathe);
  const alveoli = useMemo(
    () =>
      new Array(26).fill(0).map((_, i) => {
        const pt = path.getPointAt((i + 0.5) / 26);
        const a = random(`al${i}`) * Math.PI * 2;
        return {
          p: [pt.x + Math.cos(a) * 3.2, pt.y + Math.sin(a) * 3.2, pt.z] as [
            number,
            number,
            number,
          ],
          r: 1.6 + random(`ar${i}`) * 1.2,
        };
      }),
    [path],
  );
  const cellColor = new THREE.Color(R.cell)
    .lerp(new THREE.Color(R.cellBright), breathe)
    .getStyle();
  return (
    <AbsoluteFill style={{ background: "#1C0610" }}>
      <Stage
        camera={cam.camera}
        target={cam.target}
        fov={66}
        env={0.3}
        keyColor="#FFFFFF"
        rimColor="#9FD8FF"
        fog={{ color: "#2A0A18", near: 5, far: 24 }}
      >
        <pointLight
          position={cam.camera}
          intensity={5}
          distance={12}
          color="#FFFFFF"
        />
        <Vessel path={path} radius={1.6} color="#B8263F" opacity={0.55} />
        {alveoli.map((a, i) => (
          <Alveolus
            key={i}
            position={a.p}
            r={a.r * (1 + breathe * 0.12 * Math.sin(frame / 10))}
          />
        ))}
        <FlowingCells
          path={path}
          count={120}
          radius={1.6}
          progress={u * 1.1}
          frame={frame}
          color={cellColor}
        />
        {breathe > 0
          ? new Array(60).fill(0).map((_, i) => {
              const a = alveoli[i % alveoli.length];
              const k = ((frame / 30 + random(`o${i}`)) % 1) * breathe;
              const pt = path.getPointAt(((i % 26) + 0.5) / 26);
              return (
                <Glow
                  key={i}
                  position={[
                    mix(a.p[0], pt.x, k),
                    mix(a.p[1], pt.y, k),
                    mix(a.p[2], pt.z, k),
                  ]}
                  size={0.32}
                  color={R.oxygen}
                  opacity={0.9 * (1 - k * 0.5)}
                />
              );
            })
          : null}
      </Stage>
      <Fact
        top={520}
        o={visible(frame, c.word("r5", "pulmones") - 4, c.duration, 10)}
        big={`O₂ ${Math.round(sat * 100)} %`}
        small="saturación de oxígeno"
        color={R.oxygen}
      />
      <PovHud
        title="eres un glóbulo rojo"
        accent={R.accent}
        stats={[
          { label: "PARADA", text: "pulmones", color: "#FFFFFF" },
          {
            label: "OXÍGENO",
            text: `${Math.round(sat * 100)} %`,
            value: sat,
            color: R.oxygen,
          },
        ]}
      />
    </AbsoluteFill>
  );
};

/** 4 · Capilares: en fila, doblado; el oxígeno sale hacia el músculo y entra CO₂. */
export const RCapillary: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const path = useMemo(() => makePath("capilar", 50, 1.5), []);
  const u = 0.04 + prog(frame, 0, c.duration, (t) => t) * 0.55;
  const cam = pov(path, u, frame, 0.015);
  const give = prog(frame, c.word("r7", "entrego") - 6, 60, inOut);
  const sat = mix(1, 0.75, give);
  const fibers = useMemo(
    () =>
      new Array(10).fill(0).map((_, i) => {
        const pt = path.getPointAt((i + 0.5) / 10);
        const side = i % 2 ? 1 : -1;
        return {
          p: [pt.x + side * 2.1, pt.y + (random(`fy${i}`) - 0.5) * 2, pt.z] as [
            number,
            number,
            number,
          ],
        };
      }),
    [path],
  );
  return (
    <AbsoluteFill style={{ background: "#1C0610" }}>
      <Stage
        camera={cam.camera}
        target={cam.target}
        fov={70}
        env={0.25}
        keyColor="#FFE9E0"
        rimColor="#FF9A8A"
        fog={{ color: "#2A0A12", near: 3, far: 16 }}
      >
        <pointLight
          position={cam.camera}
          intensity={2.2}
          distance={10}
          color="#FFFFFF"
        />
        <Vessel path={path} radius={0.95} color="#C2384F" opacity={0.5} />
        {fibers.map((f, i) => (
          <MuscleFiber
            key={i}
            position={f.p}
            rotation={[Math.PI / 2, 0, 0]}
            length={9}
          />
        ))}
        <FlowingCells
          path={path}
          count={46}
          radius={0.95}
          progress={u * 1.04}
          frame={frame}
          squash={0.8}
          singleFile
          avoid={u * 1.04}
        />
        {give > 0
          ? new Array(50).fill(0).map((_, i) => {
              const pt = path.getPointAt(((i % 25) + 0.5) / 25);
              const out = i % 2 === 0;
              const k = (frame / 26 + random(`g${i}`)) % 1;
              const dir = random(`gd${i}`) > 0.5 ? 1 : -1;
              const x = out ? pt.x + dir * k * 2.2 : pt.x + dir * (1 - k) * 2.2;
              return (
                <Glow
                  key={i}
                  position={[x, pt.y + (random(`gy${i}`) - 0.5), pt.z]}
                  size={0.26}
                  color={out ? R.oxygen : "#8A8698"}
                  opacity={0.9 * give}
                />
              );
            })
          : null}
      </Stage>
      <Fact
        top={520}
        o={visible(frame, c.word("r6", "estrechos") - 4, c.start("r7") + 6, 10)}
        big="5–10 µm"
        small="el capilar · yo mido ≈ 7,5 µm"
        color="#FFD1D9"
      />
      <Fact
        top={520}
        o={prog(frame, c.word("r7", "dioxido") - 6, 10)}
        big="O₂ → músculo"
        small="CO₂ → de vuelta"
        color={R.oxygen}
      />
      <PovHud
        title="eres un glóbulo rojo"
        accent={R.accent}
        stats={[
          { label: "PARADA", text: "músculo", color: "#FFFFFF" },
          {
            label: "OXÍGENO",
            text: `${Math.round(sat * 100)} %`,
            value: sat,
            color: R.oxygen,
          },
        ]}
      />
    </AbsoluteFill>
  );
};

/** 5 · La vida de un glóbulo: un minuto por vuelta, ~4 meses de vida, reemplazo continuo. */
export const RLife: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = useCues();
  const path = useMemo(() => makePath("vida", 160, 5), []);
  const r9 = c.start("r9");
  const bazo = c.word("r9", "bazo");
  const medula = c.word("r9", "medula");
  const fast = prog(frame, 0, r9, (t) => t);
  const u = 0.05 + fast * 0.85;
  const cam = pov(path, u, frame, 0.05);
  const macro =
    prog(frame, bazo - 30, 50, inOut) * (1 - prog(frame, medula - 10, 16));
  const marrow = prog(frame, medula - 8, 20);
  const seconds = Math.min(
    60,
    Math.round(
      interpolate(frame, [c.start("r8"), c.word("r8", "minuto")], [0, 60], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    ),
  );
  const made = Math.round(
    interpolate(frame, [medula, medula + 60], [0, 100], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const pop = spring({ frame: frame - medula, fps, config: { damping: 12 } });
  return (
    <AbsoluteFill style={{ background: "#14020A" }}>
      <Stage
        camera={cam.camera}
        target={cam.target}
        fov={66 + (frame < r9 ? 8 : 0)}
        env={0.3}
        keyColor="#FFD6D6"
        rimColor="#FF6A7A"
        fog={{ color: "#2A0410", near: 4, far: 26 }}
      >
        <pointLight
          position={cam.camera}
          intensity={7}
          distance={14}
          color="#FFE1E1"
        />
        <Vessel path={path} radius={3} />
        <FlowingCells
          path={path}
          count={260}
          radius={3}
          progress={u * 1.05}
          frame={frame}
        />
        {macro > 0 ? (
          <group position={path.getPointAt(Math.min(0.99, u + 0.06)).toArray()}>
            <Macrophage scale={0.4 + macro * 2.0} frame={frame} />
          </group>
        ) : null}
        {marrow > 0
          ? new Array(40).fill(0).map((_, i) => {
              const pt = path.getPointAt(
                Math.min(0.99, u + 0.01 + (i / 40) * 0.08),
              );
              return (
                <Glow
                  key={i}
                  position={[
                    pt.x + (random(`m${i}`) - 0.5) * 4,
                    pt.y + (random(`n${i}`) - 0.5) * 4,
                    pt.z,
                  ]}
                  size={0.6}
                  color="#FFD0D8"
                  opacity={marrow * 0.8}
                />
              );
            })
          : null}
      </Stage>
      <AbsoluteFill
        style={{
          background:
            "repeating-linear-gradient(90deg, transparent 0 40px, rgba(255,255,255,0.05) 40px 42px)",
          opacity: frame < r9 ? 0.6 : 0,
        }}
      />
      <Fact
        top={520}
        o={visible(frame, c.start("r8"), r9, 10)}
        big={`00:${String(seconds).padStart(2, "0")}`}
        small={
          frame > c.word("r8", "repetire")
            ? "× más de 100.000 vueltas"
            : "una vuelta completa"
        }
        color="#FFFFFF"
      />
      <Fact
        top={520}
        o={visible(frame, bazo - 4, medula - 6, 10)}
        big="≈ 120 días"
        small="y el bazo me recicla"
        color="#D9C2FF"
      />
      <Fact
        top={520}
        o={prog(frame, medula - 4, 10)}
        big={`+${made} millones`}
        small="nuevos glóbulos rojos en un minuto"
        color="#FFD1D9"
        scale={0.8 + 0.2 * pop}
      />
      <PovHud
        title="eres un glóbulo rojo"
        accent={R.accent}
        stats={[
          {
            label: "EDAD",
            text: frame < bazo ? "joven" : "≈ 120 días",
            color: "#FFFFFF",
          },
          { label: "OXÍGENO", text: "100 %", value: 1, color: R.oxygen },
        ]}
      />
    </AbsoluteFill>
  );
};

/** 6 · Cierre: de vuelta en la corriente, la cámara frena y aparece el título. */
export const RFinal: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const path = useMemo(() => makePath("final", 120, 4), []);
  const slow = prog(frame, 0, c.duration, (t) => 1 - (1 - t) * (1 - t));
  const u = 0.1 + slow * 0.12;
  const cam = pov(path, u, frame, 0.04);
  const end = c.end("r10", 0.2);
  const t = prog(frame, end, 14);
  return (
    <AbsoluteFill style={{ background: R.bg }}>
      <Stage
        camera={cam.camera}
        target={cam.target}
        fov={62}
        env={0.22}
        keyColor="#FFD6D6"
        rimColor="#FF6A7A"
        fog={{ color: "#2A0410", near: 4, far: 26 }}
      >
        <pointLight
          position={cam.camera}
          intensity={7}
          distance={14}
          color="#FFE1E1"
        />
        <Vessel path={path} radius={3.2} />
        <FlowingCells
          path={path}
          count={300}
          radius={3.2}
          progress={u * 1.2 + frame * 0.0006}
          frame={frame}
          avoid={u}
        />
      </Stage>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: t,
          background: `rgba(13,1,8,${0.55 * t})`,
        }}
      >
        <div style={{ textAlign: "center", fontFamily: FONT, marginTop: -250 }}>
          <div
            style={{
              fontWeight: 900,
              fontSize: 110,
              color: "#FFFFFF",
              lineHeight: 1,
            }}
          >
            RESPIRA
          </div>
          <div
            style={{
              fontWeight: 900,
              fontSize: 110,
              color: R.accent,
              lineHeight: 1,
            }}
          >
            HONDO
          </div>
          <div
            style={{
              fontSize: 24,
              color: "#FFC2CC",
              marginTop: 30,
              letterSpacing: "0.06em",
            }}
          >
            Datos: Sender et al. 2016 · fisiología humana
          </div>
        </div>
      </AbsoluteFill>
      <PovHud title="eres un glóbulo rojo" accent={R.accent} stats={[]} />
    </AbsoluteFill>
  );
};

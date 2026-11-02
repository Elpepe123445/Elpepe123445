import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { FactCard } from "../../components/three/FactCard";
import { PovHud } from "../../components/three/PovHud";
import { Glow, Stage } from "../../components/three/Stage";
import { inOut, mix, prog, visible } from "../../engine/theme";
import { useCues } from "../../engine/timeline";
import {
  AshFall,
  CrouchedFigure,
  Deposit,
  EnableClipping,
  EruptionColumn,
  InscribedWall,
  P,
  PumiceRain,
  PyroclasticCloud,
  Sky,
  Street,
  SUMMIT,
  usePlasterBump,
  Vesuvius,
} from "./models";

const FONT = "Inter, DejaVu Sans, sans-serif";
const TITLE = "vives en Pompeya · año 79";
/** Resolución interna del 3D (HUD y subtítulos siguen a 1080x1920). */
const DPR = Number(process.env.REMOTION_DPR ?? 0.7);
const linear = (t: number) => t;
const easeIn = (t: number) => t * t;

type V3 = [number, number, number];

/** Temblor de cámara determinista. */
const jolt = (frame: number, amount: number): V3 => [
  Math.sin(frame * 2.3) * amount,
  Math.cos(frame * 1.9) * amount,
  Math.sin(frame * 1.3 + 1) * amount * 0.5,
];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/* 1 · Mediodía: el Vesubio ruge y nace la columna «como un pino». */
export const PStreet: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const roar = c.word("p1", "rugir");
  const pine = c.word("p2", "pino");
  const grow = prog(frame, roar - 4, pine - roar + 30, inOut);
  const shake = frame >= roar ? Math.exp(-(frame - roar) / 16) : 0;
  const tilt = prog(frame, c.start("p2") - 10, 130, inOut);
  const z = mix(9, 3.5, prog(frame, 0, c.duration, linear));
  const bob = Math.abs(Math.sin(frame * 0.2)) * 0.05;
  const s = jolt(frame, shake * 0.09);
  const camera = add([Math.sin(frame * 0.1) * 0.05, 1.65 + bob, z], s);
  const target = add([mix(-3, -13, tilt), mix(7, 74, tilt), z - 150], s);
  const km = Math.round(grow * 30);
  return (
    <AbsoluteFill style={{ background: P.bg }}>
      <Stage
        dpr={DPR}
        antialias={false}
        camera={camera}
        target={target}
        fov={62}
        env={0.35}
        ambient={0.5}
        keyColor="#FFF1DC"
        keyIntensity={2.6}
        keyPosition={[30, 60, 25]}
        rimColor="#BFD6FF"
        fillIntensity={0}
        fog={{ color: "#C7D3D8", near: 60, far: 420 }}
      >
        <Sky top="#4F84BE" horizon="#D3E1E8" low="#8C8A6C" />
        <Vesuvius />
        <Street />
        <EruptionColumn grow={grow} frame={frame} />
        <Glow
          position={[SUMMIT[0], SUMMIT[1] + 4, SUMMIT[2] + 10]}
          size={70}
          color="#FF8A3D"
          opacity={shake * 0.9}
        />
      </Stage>
      <FactCard
        top={600}
        o={visible(frame, c.word("p2", "kilometros") - 4, pine - 6, 10)}
        big="≈ 30 km de altura"
        small="casi 3 veces la altura de crucero de un avión"
        color="#FFD7A8"
      />
      <FactCard
        top={600}
        o={visible(frame, pine - 2, c.duration + 20, 10)}
        big="«como un pino»"
        small="así la describió Plinio el Joven, que la vio"
        color="#FFFFFF"
        size={64}
      />
      <PovHud
        title={TITLE}
        accent={P.accent}
        shake={shake}
        stats={[
          { label: "VESUBIO", text: "a ~10 km", color: "#FFFFFF" },
          { label: "COLUMNA", text: `${km} km`, value: grow },
        ]}
      />
    </AbsoluteFill>
  );
};

/* 2 · Lluvia de piedra pómez durante horas; los tejados ceden. */
export const PRain: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const t = prog(frame, 0, c.duration, linear);
  const roofs = c.word("p4", "tejados");
  const creak = c.word("p4", "crujen");
  const others = c.word("p4", "otros");
  const shut = c.word("p4", "encierran");
  const sag = prog(frame, creak, 22, easeIn);
  const doorClose = prog(frame, shut - 2, 20, inOut);
  const toRoof = prog(frame, roofs - 24, 30, inOut);
  const toDoor = prog(frame, others - 26, 30, inOut);
  const shake = frame >= creak ? Math.exp(-(frame - creak) / 10) * 0.6 : 0;
  const s = jolt(frame, shake * 0.06);
  const camera = add([0.2, 1.62 + Math.sin(frame * 0.05) * 0.02, 2.6], s);
  const up: V3 = [0.4, 4.6, -10];
  const roof: V3 = [7, 5.2, -3.5];
  const door: V3 = [-6, 1.5, -3];
  const lookA: V3 = [
    mix(up[0], roof[0], toRoof),
    mix(up[1], roof[1], toRoof),
    mix(up[2], roof[2], toRoof),
  ];
  const target = add(
    [
      mix(lookA[0], door[0], toDoor),
      mix(lookA[1], door[1], toDoor),
      mix(lookA[2], door[2], toDoor),
    ],
    s,
  );
  const hour = 13 + t * 10;
  const hh = Math.floor(hour);
  const mm = Math.floor(((hour - hh) * 60) / 10) * 10;
  return (
    <AbsoluteFill style={{ background: P.bg }}>
      <Stage
        dpr={DPR}
        antialias={false}
        camera={camera}
        target={target}
        fov={64}
        env={0.22}
        ambient={0.35}
        keyColor="#E8C9A4"
        keyIntensity={0.9}
        keyPosition={[20, 40, 10]}
        rimColor="#8E7A66"
        fillIntensity={0}
        fog={{ color: "#5F5246", near: 6, far: 60 }}
      >
        <Sky top="#2E2622" horizon="#6D5D4D" low="#4A4036" />
        <Street
          roofSag={sag}
          doorClose={doorClose}
          roofAsh={mix(0.15, 0.55, t)}
          lampGlow={1 - doorClose}
        />
        <Deposit level={mix(0.02, 0.5, t)} color={P.pumice} seed="pum" />
        <PumiceRain frame={frame} center={camera} />
      </Stage>
      <FactCard
        top={600}
        o={visible(frame, c.word("p3", "pomez") - 2, c.end("p3"), 10)}
        big="Piedra pómez"
        small="roca volcánica tan porosa que flota en el agua"
        color="#F3E6CC"
        size={64}
      />
      <PovHud
        title={TITLE}
        accent={P.accent}
        shake={shake}
        stats={[
          {
            label: "HORA",
            text: `${hh}:${String(mm).padStart(2, "0")}`,
            color: "#FFFFFF",
          },
          { label: "PÓMEZ", text: "sin parar", value: t, color: "#E9DCC2" },
        ]}
      />
    </AbsoluteFill>
  );
};

/* 3 · Amanecer: la columna colapsa y la nube ardiente baja hacia nosotros. */
export const PCloud: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const fall = c.word("p5", "colapsa");
  const collapse = prog(frame, fall - 6, 70, inOut);
  const endLine = c.end("p6");
  const adv = prog(frame, fall - 4, endLine - fall + 2, (t) => Math.pow(t, 1.5));
  const front = mix(-175, 10, adv);
  const shake = Math.min(1, adv * adv * 1.2 + collapse * 0.15);
  const s = jolt(frame, shake * 0.07);
  const camera = add([0, 1.62, 4], s);
  const target = add([-12, mix(20, 9, adv), -170], s);
  const engulf = prog(frame, endLine - 22, 20, inOut);
  const black = prog(frame, endLine + 2, 14, inOut);
  const hot = frame >= c.word("p6", "grados") - 4;
  return (
    <AbsoluteFill style={{ background: "#000000" }}>
      <Stage
        dpr={DPR}
        antialias={false}
        camera={camera}
        target={target}
        fov={64}
        env={0.2}
        ambient={0.3}
        keyColor="#FFB27A"
        keyIntensity={1.1}
        keyPosition={[60, 18, 10]}
        rimColor="#6F5A4C"
        fillIntensity={0}
        fog={{ color: "#4E3B2F", near: 60, far: 460 }}
      >
        <Sky top="#1E1816" horizon="#94552F" low="#3A2E26" />
        <Vesuvius color="#3F3A32" />
        <Street roofAsh={0.6} doorClose={1} />
        <Deposit level={0.62} color="#BDB29C" seed="pum2" />
        <EruptionColumn grow={1} collapse={collapse} frame={frame} />
        {adv > 0 ? (
          <>
            <PyroclasticCloud front={front} frame={frame} />
            <pointLight
              position={[0, 6, front + 8]}
              intensity={30 * adv}
              distance={60}
              color="#FF7A2E"
            />
            {[-40, -15, 10, 35].map((x) => (
              <Glow
                key={x}
                position={[x, 3, front + 4]}
                size={46}
                color="#FF6A1E"
                opacity={0.55}
              />
            ))}
          </>
        ) : null}
        <PumiceRain frame={frame} center={camera} density={0.3} />
      </Stage>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 60%, #FFB066 0%, #D2501C 45%, #2A0C04 100%)",
          opacity: engulf * (1 - black),
        }}
      />
      <AbsoluteFill style={{ background: "#000000", opacity: black }} />
      <FactCard
        top={600}
        o={visible(frame, c.word("p6", "grados") - 4, endLine - 18, 8)}
        big="≥ 250 °C"
        small="temperatura estimada de la nube al llegar a Pompeya"
        color="#FFB070"
      />
      <PovHud
        title={TITLE}
        accent={P.accent}
        shake={shake}
        stats={[
          { label: "HORA", text: "≈ 06:30", color: "#FFFFFF" },
          {
            label: "TEMPERATURA",
            text: hot ? "≥ 250 °C" : "20 °C",
            value: hot ? 1 : 0.08,
            color: hot ? "#FF7A3D" : "#FFFFFF",
          },
        ]}
      />
    </AbsoluteFill>
  );
};

/* 4 · Silencio: la ceniza lo cubre todo y pasan los siglos. */
export const PAsh: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const rise = prog(frame, 0, c.duration, inOut);
  const camera: V3 = [0.4, mix(3.6, 13, rise), mix(5, 0, rise)];
  const target: V3 = [-6, mix(4, 2, rise), -110];
  const yearT = prog(
    frame,
    c.word("p7", "desaparece"),
    c.word("p7", "siglos", "end") - c.word("p7", "desaparece") + 10,
    inOut,
  );
  const year = Math.round(mix(79, 1748, yearT));
  return (
    <AbsoluteFill style={{ background: "#2B2826" }}>
      <Stage
        dpr={DPR}
        antialias={false}
        camera={camera}
        target={target}
        fov={60}
        env={0.25}
        ambient={0.55}
        keyColor="#E7E2DA"
        keyIntensity={0.8}
        keyPosition={[10, 40, 20]}
        rimColor="#9C9690"
        fillIntensity={0}
        fog={{ color: "#8F8984", near: 12, far: 150 }}
      >
        <Sky top="#5F5A56" horizon="#A39D97" low="#7D7873" />
        <Vesuvius color="#6A655F" />
        <Street roofAsh={1} ashColor="#9B9690" doorClose={1} />
        <Deposit level={2.4} color={P.ash} seed="ash" />
        <AshFall frame={frame} center={camera} />
      </Stage>
      <AbsoluteFill style={{ background: "rgba(150,145,140,0.22)" }} />
      <FactCard
        top={600}
        o={visible(frame, c.word("p7", "siglos", "end") + 4, c.duration + 20, 10)}
        big="1748"
        small="empiezan las excavaciones"
        color="#FFFFFF"
      />
      <PovHud
        title={TITLE}
        accent={P.accent}
        stats={[{ label: "AÑO", text: String(year), color: "#FFFFFF" }]}
      />
    </AbsoluteFill>
  );
};

/* 5 · 1863: el yeso rellena el hueco que dejó el cuerpo en la ceniza. */
export const PCast: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const bump = usePlasterBump();
  const pourAt = c.word("p8", "yeso");
  const level = mix(-0.05, 1.25, prog(frame, pourAt - 4, 90, linear));
  const dissolve = prog(frame, c.start("p9") - 6, 40, inOut);
  const pouring = level > -0.04 && level < 1.2;
  const planes = useMemo(
    () => ({
      below: new THREE.Plane(new THREE.Vector3(0, -1, 0), 0),
      above: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    }),
    [],
  );
  planes.below.constant = level;
  planes.above.constant = -level;
  const orbit = 0.7 + prog(frame, 0, c.duration, linear) * 1.5;
  const radius = mix(3.4, 2.7, prog(frame, 0, c.duration, inOut));
  const center: V3 = [0, 0.55, 0.28];
  const camera: V3 = [
    Math.sin(orbit) * radius,
    mix(1.7, 1.15, prog(frame, 0, c.duration, inOut)),
    center[2] + Math.cos(orbit) * radius,
  ];
  return (
    <AbsoluteFill style={{ background: "#0B0908" }}>
      <Stage
        dpr={DPR}
        antialias={false}
        camera={camera}
        target={center}
        fov={52}
        env={0.18}
        ambient={0.06}
        keyColor="#FFE9CC"
        keyIntensity={0.7}
        keyPosition={[-3, 5, 4]}
        rimColor="#8FA8C8"
        fillIntensity={0}
      >
        <EnableClipping />
        <spotLight
          position={[1.2, 5, 2.4]}
          angle={0.45}
          penumbra={0.7}
          intensity={70}
          distance={14}
          decay={2}
          color="#FFF1DC"
        />
        <mesh position={[0, -0.2, 0.25]}>
          <cylinderGeometry args={[1.7, 1.8, 0.4, 48]} />
          <meshStandardMaterial color="#3A3532" roughness={0.9} />
        </mesh>
        <CrouchedFigure
          material={
            <meshStandardMaterial
              color="#D8D0C2"
              roughness={0.97}
              bumpMap={bump}
              bumpScale={1.6}
              clippingPlanes={dissolve > 0.99 ? [] : [planes.below]}
            />
          }
        />
        {dissolve < 1 ? (
          <CrouchedFigure
            material={
              <meshStandardMaterial
                color="#17120F"
                roughness={1}
                clippingPlanes={[planes.above]}
                transparent
                opacity={1 - dissolve}
              />
            }
          />
        ) : null}
        {dissolve < 1 ? (
          <mesh position={[0, 0.6, 0.28]}>
            <boxGeometry args={[1.6, 1.3, 1.6]} />
            <meshStandardMaterial
              color="#77716B"
              roughness={1}
              transparent
              opacity={0.5 * (1 - dissolve)}
              depthWrite={false}
            />
          </mesh>
        ) : null}
        {pouring ? (
          <mesh position={[0.05, 1.25 + (2.6 - 1.25) / 2, 0.25]}>
            <cylinderGeometry args={[0.03, 0.04, 2.6 - 1.25, 12]} />
            <meshStandardMaterial color={P.plaster} roughness={0.6} />
          </mesh>
        ) : null}
      </Stage>
      <FactCard
        top={1170}
        o={visible(frame, c.word("p8", "1863") - 4, c.start("p9") - 10, 10)}
        big="1863"
        small="Giuseppe Fiorelli vierte yeso en los huecos de la ceniza"
        color="#FFFFFF"
      />
      <PovHud
        title={TITLE}
        accent={P.accent}
        stats={[
          { label: "AÑO", text: "1863", color: "#FFFFFF" },
          { label: "MOLDE", text: "yeso", value: Math.max(0, level / 1.25) },
        ]}
      />
    </AbsoluteFill>
  );
};

/* 6 · Una inscripción al carbón: ¿octubre, no agosto? */
export const PFinal: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const reveal = prog(frame, c.word("p10", "inscripcion") - 4, 55, linear);
  const oct = c.word("p10", "octubre");
  const ago = c.word("p10", "agosto");
  const endT = c.end("p10");
  const dolly = prog(frame, 0, c.duration, inOut);
  const flicker = 1 + Math.sin(frame * 0.9) * 0.06 + Math.sin(frame * 2.3) * 0.04;
  const lamp: V3 = [-1.5, 3.1, 1.6];
  return (
    <AbsoluteFill style={{ background: "#0A0807" }}>
      <Stage
        dpr={DPR}
        antialias={false}
        camera={[mix(-0.25, 0.2, dolly), 4.25, mix(6.6, 5.6, dolly)]}
        target={[0, 4.2, 0]}
        fov={60}
        env={0.12}
        ambient={0.12}
        keyColor="#FFE2BF"
        keyIntensity={0.35}
        keyPosition={[2, 6, 6]}
        rimColor="#5A4A3E"
        fillIntensity={0}
      >
        <group position={[0, 4, 0]}>
          <InscribedWall reveal={reveal} />
        </group>
        <pointLight
          position={lamp}
          intensity={9 * flicker}
          distance={9}
          color="#FFB060"
        />
        <Glow position={lamp} size={0.9} color="#FFC070" opacity={0.85} />
        <Glow position={lamp} size={0.25} color="#FFFFFF" opacity={0.9} />
      </Stage>
      <div
        style={{
          position: "absolute",
          top: 1220,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: visible(frame, ago - 4, endT + 6, 10),
          fontFamily: FONT,
        }}
      >
        <div
          style={{
            position: "relative",
            fontSize: 46,
            fontWeight: 800,
            color: "#D9D3CA",
            padding: "10px 30px",
            background: "rgba(0,0,0,0.45)",
            borderRadius: 18,
          }}
        >
          24 de agosto
          <div
            style={{
              position: "absolute",
              left: 18,
              right: 18,
              top: "52%",
              height: 6,
              borderRadius: 3,
              background: "#FF4D3D",
              transformOrigin: "left",
              scale: `${prog(frame, ago + 6, 14)} 1`,
            }}
          />
        </div>
      </div>
      <FactCard
        top={560}
        o={visible(frame, oct - 4, endT + 6, 10)}
        big="= 17 de octubre"
        small="«16 días antes de las calendas de noviembre»"
        color="#FFD08A"
        size={62}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(8,6,5,0.85) 0%, rgba(8,6,5,0.55) 45%, rgba(8,6,5,0.2) 100%)",
          opacity: prog(frame, endT + 6, 20),
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 560,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: FONT,
          opacity: prog(frame, endT + 10, 18),
          translate: `0 ${(1 - prog(frame, endT + 10, 24)) * 30}px`,
        }}
      >
        <div
          style={{
            fontFamily: "Cinzel, serif",
            fontWeight: 700,
            fontSize: 92,
            color: "#FFFFFF",
            letterSpacing: "0.08em",
            textShadow: "0 6px 40px rgba(0,0,0,0.8)",
          }}
        >
          POMPEYA
        </div>
        <div
          style={{
            fontSize: 36,
            fontWeight: 700,
            color: P.accent,
            marginTop: 6,
          }}
        >
          79 d.C.
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 600,
            color: "#D9D3CA",
            marginTop: 18,
          }}
        >
          Inscripción hallada en 2018 · la fecha exacta aún se debate
        </div>
      </div>
      <PovHud
        title={TITLE}
        accent={P.accent}
        stats={[
          {
            label: "FECHA",
            text: frame < oct ? "¿24 de agosto?" : "¿octubre?",
            color: frame < oct ? "#FFFFFF" : "#FFD08A",
          },
        ]}
      />
    </AbsoluteFill>
  );
};

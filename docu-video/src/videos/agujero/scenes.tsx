import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";
import { PovHud } from "../../components/three/PovHud";
import { Glow, Stage } from "../../components/three/Stage";
import { inOut, mix, prog, visible } from "../../engine/theme";
import { useCues } from "../../engine/timeline";
import { Astronaut, B, BlackHole, StarSky } from "./models";

const FONT = "Inter, DejaVu Sans, sans-serif";
const TITLE = "caes en un agujero negro";

const Fact: React.FC<{
  top: number;
  o: number;
  big: string;
  small?: string;
  color?: string;
}> = ({ top, o, big, small, color = "#FFFFFF" }) => (
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
          "linear-gradient(160deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04))",
        border: "1.5px solid rgba(255,255,255,0.22)",
        boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
        textAlign: "center",
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          fontWeight: 900,
          fontSize: 70,
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
            fontSize: 28,
            color: "#D9DDF0",
            marginTop: 10,
          }}
        >
          {small}
        </div>
      ) : null}
    </div>
  </div>
);

/** 1 · Llegada: el agujero negro del centro de la galaxia crece en el visor. */
export const BArrive: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const z = mix(
    34,
    14,
    prog(frame, 0, c.duration, (t) => t),
  );
  const merc = prog(frame, c.word("b2", "mercurio") - 8, 24);
  const dist = Math.round(
    mix(
      1200,
      300,
      prog(frame, 0, c.duration, (t) => t),
    ),
  );
  return (
    <AbsoluteFill style={{ background: B.bg }}>
      <Stage
        camera={[Math.sin(frame / 90) * 0.8, 1.2, z]}
        target={[0, 0, 0]}
        fov={46}
        env={0.2}
      >
        <StarSky frame={frame} />
        <group rotation={[0, 0, 0.12 + Math.sin(frame / 70) * 0.03]}>
          <BlackHole time={frame / 30} />
          {merc > 0 ? (
            <mesh rotation={[1.33, 0, 0.08]}>
              <torusGeometry args={[4.57, 0.02, 8, 200, Math.PI * 2 * merc]} />
              <meshBasicMaterial color={B.cyan} transparent opacity={0.85} />
            </mesh>
          ) : null}
        </group>
      </Stage>
      <Fact
        top={520}
        o={visible(frame, c.word("b1", "sagitario") - 4, c.start("b2"), 10)}
        big="Sagitario A*"
        small="centro de la Vía Láctea · ~26.000 años luz"
        color={B.accent}
      />
      <Fact
        top={520}
        o={visible(
          frame,
          c.start("b2"),
          merc > 0 ? c.duration : c.duration,
          10,
        )}
        big={merc > 0 ? "< órbita de Mercurio" : "≈ 4 millones de soles"}
        small={
          merc > 0
            ? "horizonte: ~12 M km de radio · Mercurio: 58 M km"
            : "de masa"
        }
        color={merc > 0 ? B.cyan : B.accent}
      />
      <PovHud
        title={TITLE}
        accent={B.accent}
        stats={[
          { label: "DISTANCIA", text: `${dist} M km`, color: "#FFFFFF" },
          { label: "MAREA", text: "despreciable", color: B.cyan },
        ]}
      />
    </AbsoluteFill>
  );
};

/** 2 · Lente gravitacional: arcos de estrellas alrededor de la sombra. */
export const BLens: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const arcs = prog(frame, c.word("b3", "curva") - 6, 30);
  return (
    <AbsoluteFill style={{ background: B.bg }}>
      <Stage
        camera={[
          0,
          0.5,
          mix(
            13,
            9,
            prog(frame, 0, c.duration, (t) => t),
          ),
        ]}
        target={[0, 0, 0]}
        fov={50}
        env={0.2}
      >
        <StarSky frame={frame} arcs={arcs} />
        <group rotation={[0, 0, 0.12]}>
          <BlackHole time={(frame + 330) / 30} ring={1 + arcs} />
        </group>
        <Glow size={4.5} color={B.accent} opacity={0.18} />
      </Stage>
      <Fact
        top={520}
        o={prog(frame, c.word("b3", "arcos") - 6, 10)}
        big="lente gravitacional"
        small="la luz rodea la sombra"
        color={B.hot}
      />
      <PovHud
        title={TITLE}
        accent={B.accent}
        stats={[
          { label: "DISTANCIA", text: "≈ 200 M km", color: "#FFFFFF" },
          { label: "LUZ", text: "curvándose", color: B.cyan },
        ]}
      />
    </AbsoluteFill>
  );
};

/** 3 · Espaguetización (en uno pequeño) vs cruzar sin notarlo (en uno gigante). */
export const BSpaghetti: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const b5 = c.start("b5");
  const stretch =
    prog(frame, c.word("b4", "estirado") - 10, 50, inOut) *
    (1 - prog(frame, b5 - 6, 10));
  const cross = prog(frame, c.word("b5", "cruzo") - 6, 50, inOut);
  const nada = c.word("b5", "nada");
  const small = frame < b5 - 4;
  return (
    <AbsoluteFill style={{ background: B.bg }}>
      {small ? (
        <Stage camera={[0, 0.6, 7]} target={[0, 0.6, 0]} fov={45} env={0.6}>
          <StarSky frame={frame} />
          <group position={[0, -2.6, -3]} scale={0.6}>
            <BlackHole time={frame / 20} diskIntensity={0.7} />
          </group>
          <group
            position={[0, 0.6 - stretch * 0.6, 0]}
            rotation={[0.1, frame * 0.01, 0]}
          >
            <Astronaut stretch={stretch} />
          </group>
        </Stage>
      ) : (
        <Stage
          camera={[0, 0.2, mix(8, 0.2, cross)]}
          target={[0, 0, -2]}
          fov={mix(50, 80, cross)}
          env={0.2}
        >
          <StarSky frame={frame} />
          <group rotation={[0, 0, 0.12]}>
            <BlackHole time={(frame + 600) / 30} />
          </group>
        </Stage>
      )}
      <AbsoluteFill
        style={{
          background: "#000",
          opacity: cross > 0.8 ? (cross - 0.8) * 4 : 0,
        }}
      />
      <Fact
        top={520}
        o={visible(frame, c.word("b4", "espaguetizacion") - 8, b5, 10)}
        big="espaguetización"
        small="agujero pequeño: la marea te estira"
        color={B.accent}
      />
      <Fact
        top={520}
        o={visible(frame, c.word("b5", "horizonte") - 4, nada + 30, 10)}
        big="horizonte de sucesos"
        small="en uno gigante, no se siente al cruzarlo"
        color={B.cyan}
      />
      <PovHud
        title={TITLE}
        accent={B.accent}
        shake={small ? stretch * 0.4 : 0}
        stats={[
          {
            label: "MAREA",
            text: small
              ? stretch > 0.3
                ? "EXTREMA"
                : "creciendo"
              : "imperceptible",
            color: small ? "#FF6A5A" : B.cyan,
            value: small ? stretch : 0.02,
          },
          {
            label: "ESTADO",
            text: cross > 0.95 ? "dentro" : "fuera",
            color: "#FFFFFF",
          },
        ]}
      />
    </AbsoluteFill>
  );
};

/** 4 · Visto desde fuera: el astronauta se congela, enrojece y se apaga en el borde. */
export const BOutside: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const slow = prog(frame, c.word("b6", "frenar") - 6, 40, inOut);
  const red = prog(frame, c.word("b6", "enrojecer") - 6, 40, inOut);
  const fade = prog(frame, c.word("b6", "apagarme") - 6, 40, inOut);
  const y = 1.25 + 0.6 * (1 - slow) * Math.max(0, 1 - frame / 80);
  const tint = new THREE.Color("#F2F4F8")
    .lerp(new THREE.Color("#C02010"), red)
    .getStyle();
  return (
    <AbsoluteFill style={{ background: B.bg }}>
      <Stage camera={[3.2, 1.0, 6.5]} target={[0, 0.8, 0]} fov={42} env={0.5}>
        <StarSky frame={frame} />
        <group rotation={[0, 0, 0.12]}>
          <BlackHole time={(frame + 900) / 30} />
        </group>
        <group position={[0.6, y, 0.6]} scale={0.32} rotation={[0.2, 0.6, 0.2]}>
          <Astronaut tint={tint} opacity={1 - fade * 0.95} />
        </group>
      </Stage>
      <div
        style={{
          position: "absolute",
          top: 220,
          right: 70,
          fontFamily: FONT,
          color: "#FFFFFF",
          background: "rgba(255,255,255,0.1)",
          border: "1.5px solid rgba(255,255,255,0.25)",
          padding: "10px 20px",
          borderRadius: 14,
          fontWeight: 800,
          fontSize: 30,
        }}
      >
        visto desde lejos
      </div>
      <Fact
        top={520}
        o={prog(frame, c.word("b6", "nunca") - 6, 10)}
        big={
          fade > 0.5
            ? "se apaga"
            : red > 0.5
              ? "enrojece"
              : slow > 0.5
                ? "se congela"
                : "nunca entra"
        }
        small="dilatación del tiempo y corrimiento al rojo"
        color={red > 0.5 ? "#FF7A5A" : B.cyan}
      />
      <PovHud
        title={TITLE}
        accent={B.accent}
        stats={[
          {
            label: "SU RELOJ",
            text: slow > 0.5 ? "≈ detenido" : "más lento",
            color: "#FFFFFF",
          },
        ]}
      />
    </AbsoluteFill>
  );
};

/** 5 · Dentro: miro atrás y el universo se encoge en un círculo; todo camino lleva al centro. */
export const BInside: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const look = prog(frame, c.word("b7", "atras") - 10, 30, inOut);
  const shrink = prog(frame, c.word("b7", "encoge") - 6, 70, inOut);
  const b8 = c.start("b8");
  const lines = prog(frame, b8, 30);
  return (
    <AbsoluteFill style={{ background: "#000000" }}>
      <Stage
        camera={[0, 0, 0]}
        target={[
          Math.sin(look * Math.PI) * 8,
          mix(-0.6, 0.6, look),
          -Math.cos(look * Math.PI) * 8,
        ]}
        fov={70}
        env={0.1}
      >
        <group position={[0, 2.6, 10]} scale={mix(4, 0.9, shrink)}>
          <mesh>
            <circleGeometry args={[1, 96]} />
            <meshBasicMaterial color="#BFD8FF" transparent opacity={look} />
          </mesh>
          <Glow size={3.6} color="#9FC8FF" opacity={0.8 * look} />
        </group>
        {lines > 0
          ? new Array(36).fill(0).map((_, i) => {
              const a = (i / 36) * Math.PI * 2;
              const k = ((frame / 20 + i * 0.37) % 1) * lines;
              return (
                <mesh
                  key={i}
                  position={[
                    Math.cos(a) * mix(9, 0.3, k),
                    Math.sin(a) * mix(9, 0.3, k),
                    -12,
                  ]}
                  rotation={[0, 0, a]}
                >
                  <boxGeometry args={[1.4, 0.03, 0.03]} />
                  <meshBasicMaterial
                    color={B.accent}
                    transparent
                    opacity={0.8 * lines}
                    blending={THREE.AdditiveBlending}
                  />
                </mesh>
              );
            })
          : null}
      </Stage>
      <Fact
        top={520}
        o={visible(frame, c.word("b7", "circulo") - 6, b8, 10)}
        big="el universo, en un círculo"
        small="detrás de mí: toda la luz que me alcanza"
        color="#BFD8FF"
      />
      <Fact
        top={520}
        o={prog(frame, c.word("b8", "futuro") - 10, 10)}
        big="el centro = mi futuro"
        small="dentro, el radio actúa como el tiempo"
        color={B.accent}
      />
      <PovHud
        title={TITLE}
        accent={B.accent}
        stats={[
          { label: "ESTADO", text: "dentro del horizonte", color: "#FF6A5A" },
          { label: "SALIDA", text: "ninguna", color: "#FFFFFF" },
        ]}
      />
    </AbsoluteFill>
  );
};

/** 6 · Final: cuenta atrás de ~1 minuto (tiempo propio máximo, modelo sin rotación). */
export const BFinal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = useCues();
  const secs = Math.max(
    0,
    Math.round(
      interpolate(frame, [c.start("b9"), c.duration], [60, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    ),
  );
  const end = c.end("b9", 0.2);
  const title = spring({ frame: frame - end, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 42%, rgba(255,180,74,${0.25 * (1 - title)}) 0%, transparent 35%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 520,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: "DejaVu Sans Mono, monospace",
          color: "#FF6A5A",
          opacity: 1 - title,
        }}
      >
        <div style={{ fontSize: 30, letterSpacing: "0.2em" }}>
          TIEMPO MÁXIMO RESTANTE
        </div>
        <div style={{ fontSize: 150, fontWeight: 700 }}>
          0:{String(secs).padStart(2, "0")}
        </div>
        <div style={{ fontSize: 22, color: "#9A9AB0" }}>
          ≈ πGM/c³ · Sgr A* sin rotación
        </div>
      </div>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: title,
        }}
      >
        <div style={{ textAlign: "center", fontFamily: FONT, marginTop: -200 }}>
          <div
            style={{
              fontWeight: 900,
              fontSize: 92,
              color: "#FFFFFF",
              lineHeight: 1.05,
            }}
          >
            NADIE SABRÁ
          </div>
          <div
            style={{
              fontWeight: 900,
              fontSize: 92,
              color: B.accent,
              lineHeight: 1.05,
            }}
          >
            LO QUE VI
          </div>
          <div style={{ fontSize: 24, color: "#9A9AB0", marginTop: 30 }}>
            Datos: Event Horizon Telescope · relatividad general
          </div>
        </div>
      </AbsoluteFill>
      <PovHud title={TITLE} accent={B.accent} stats={[]} />
    </AbsoluteFill>
  );
};

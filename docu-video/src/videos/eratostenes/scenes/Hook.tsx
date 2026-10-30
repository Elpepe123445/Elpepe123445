import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Starfield } from "../../../components/Atmosphere";
import { DrawPath } from "../../../components/Diagram";
import {
  ArcRing,
  faceLon,
  Globe3D,
  SurfaceMarker,
} from "../../../components/Globe3D";
import { KineticText } from "../../../components/KineticText";
import { C, fonts, inOut, mix, prog, visible } from "../../../engine/theme";
import { useCues } from "../../../engine/timeline";

const ORBITS = [
  { r: 1.32, inc: 0.5, rot: 0.3, speed: 0.012, phase: 0.4 },
  { r: 1.5, inc: -0.9, rot: -0.6, speed: 0.009, phase: 2.2 },
  { r: 1.72, inc: 1.25, rot: 1.1, speed: 0.007, phase: 4.1 },
];

const Satellites: React.FC<{ frame: number; amount: number }> = ({
  frame,
  amount,
}) => (
  <>
    {ORBITS.map((o, i) => {
      const a = frame * o.speed + o.phase;
      return (
        <group key={i} rotation={[o.inc, o.rot, 0]}>
          <ArcRing
            radius={o.r}
            progress={amount}
            tube={0.0025}
            color="#7FDBFF"
            opacity={0.35 * amount}
          />
          <mesh
            position={[Math.cos(a) * o.r, 0, Math.sin(a) * o.r]}
            scale={amount}
          >
            <sphereGeometry args={[0.018, 16, 16]} />
            <meshBasicMaterial color="#DFF8FF" />
          </mesh>
        </group>
      );
    })}
  </>
);

/** Iconos lineales que se dibujan: vara, sombra, idea. */
const Icon: React.FC<{ kind: "vara" | "sombra" | "idea"; p: number }> = ({
  kind,
  p,
}) => (
  <svg width={260} height={260} viewBox="0 0 220 220">
    {kind === "vara" && (
      <>
        <DrawPath
          d="M 110 30 L 110 180"
          progress={p}
          width={8}
          color={C.papyrus}
        />
        <DrawPath
          d="M 60 182 L 160 182"
          progress={p}
          width={4}
          color={C.sand}
        />
      </>
    )}
    {kind === "sombra" && (
      <>
        <DrawPath
          d="M 80 40 L 80 180"
          progress={p}
          width={8}
          color={C.papyrus}
        />
        <DrawPath
          d="M 80 182 L 190 182"
          progress={p}
          width={12}
          color="#000"
          opacity={0.7}
        />
        <DrawPath
          d="M 190 40 L 80 40"
          progress={p}
          width={3}
          color={C.gold}
          dashed
        />
      </>
    )}
    {kind === "idea" && (
      <>
        <circle cx={110} cy={110} r={34 * p} fill={C.gold} opacity={0.9} />
        {new Array(8).fill(0).map((_, i) => {
          const a = (i * Math.PI) / 4;
          return (
            <DrawPath
              key={i}
              d={`M ${110 + Math.cos(a) * 52} ${110 + Math.sin(a) * 52} L ${110 + Math.cos(a) * 88} ${110 + Math.sin(a) * 88}`}
              progress={p}
              width={6}
              color={C.goldSoft}
            />
          );
        })}
      </>
    )}
  </svg>
);

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = useCues();

  const s2 = c.start("hook-2");
  const s3 = c.start("hook-3");
  const s4 = c.start("hook-4");
  const s5 = c.start("hook-5");
  const titleAt = c.end("hook-5", 0.3);

  // La Tierra gira despacio y, al viajar al pasado, se orienta hacia Egipto.
  const lon = interpolate(frame, [0, s3, s4 + 10], [-70, -25, 31], {
    extrapolateRight: "clamp",
    easing: inOut,
  });
  const tilt = interpolate(frame, [s3, s4 + 10], [0.3, 0.47], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: inOut,
  });
  const zoom = prog(frame, s3 + 10, s4 - s3 + 20, inOut);
  const pullBack = prog(frame, s5, 40, inOut);
  const cameraZ =
    mix(mix(5.6, 4.6, prog(frame, 0, s3)), 2.5, zoom) + pullBack * 1.4;
  const cameraX = mix(-1.0, -0.42, zoom) + pullBack * 0.42;
  const globeDim =
    1 - 0.72 * prog(frame, s5, 30) - 0.18 * prog(frame, titleAt - 10, 30);

  const ring = prog(frame, s2 + 8, 70, inOut) * (1 - prog(frame, s3, 20));
  const sats = prog(frame, s2, 30) * (1 - prog(frame, s3 + 10, 30));
  const egypt = prog(frame, s4 - 6, 24);

  // Contador de años: 2026 → 240 a. C.
  const year = Math.round(
    interpolate(frame, [s3 + 6, c.end("hook-3")], [2026, -240], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: inOut,
    }),
  );
  const yearText = year > 0 ? `${year}` : `${-year} a. C.`;

  const title = spring({
    frame: frame - titleAt,
    fps,
    config: { damping: 200 },
  });

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 70% 50%, #0E1A33 0%, #05070D 70%)",
      }}
    >
      <Starfield drift={0.12} />
      <Globe3D
        spin={faceLon(lon)}
        tilt={tilt}
        cameraZ={cameraZ}
        cameraX={cameraX}
        highlightAmount={egypt * 0.9}
        opacity={globeDim}
        surface={
          <>
            <ArcRing
              radius={1.012}
              progress={ring}
              tube={0.005}
              color="#4FD1E8"
            />
            <SurfaceMarker
              lat={27}
              lon={30.8}
              pulse={((frame - s4) % 40) / 40}
              amount={egypt * (1 - prog(frame, s5, 20))}
            />
          </>
        }
        space={<Satellites frame={frame} amount={sats} />}
      />

      <AbsoluteFill
        style={{
          background:
            "linear-gradient(90deg, rgba(4,6,12,0.88) 0%, rgba(4,6,12,0.55) 34%, rgba(4,6,12,0) 58%)",
          opacity: 1 - prog(frame, s5, 20),
        }}
      />

      {/* 1 · Pregunta inicial */}
      <div style={{ position: "absolute", left: 140, top: 380, width: 820 }}>
        <KineticText
          text="¿Cuánto mide la Tierra?"
          start={c.start("hook-1")}
          exit={s3 - 4}
          highlight={["Tierra"]}
          style={{ fontSize: 100, fontWeight: 700, lineHeight: 1.08 }}
        />
        <div
          style={{
            opacity: visible(frame, s2 + 20, s3, 14),
            marginTop: 40,
            fontFamily: fonts.body,
            color: C.cyan,
            fontSize: 40,
            letterSpacing: "0.06em",
          }}
        >
          MEDICIÓN SATELITAL · ≈ 40.000 km
          <div
            style={{
              height: 3,
              marginTop: 14,
              width: 520 * ring,
              background: C.cyan,
            }}
          />
        </div>
      </div>

      {/* 2 · Viaje en el tiempo */}
      <div
        style={{
          position: "absolute",
          left: 140,
          top: 360,
          fontFamily: fonts.display,
          color: C.gold,
          fontSize: 150,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          opacity: visible(frame, s3 + 4, s5, 12),
          textShadow: `0 0 50px ${C.gold}55`,
        }}
      >
        {yearText}
      </div>
      <div style={{ position: "absolute", left: 146, top: 560, width: 760 }}>
        <KineticText
          text="sin salir de Egipto."
          start={s4}
          exit={s5}
          highlight={["Egipto"]}
          style={{ fontSize: 76, fontWeight: 600 }}
          mode="blur"
        />
      </div>

      {/* 3 · Las tres herramientas, sincronizadas con la voz */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 330,
          display: "flex",
          justifyContent: "center",
          gap: 140,
          opacity: 1 - prog(frame, titleAt - 8, 16),
        }}
      >
        {(
          [
            ["vara", c.word("hook-5", "vara")],
            ["sombra", c.word("hook-5", "sombra")],
            ["idea", c.word("hook-5", "idea")],
          ] as const
        ).map(([kind, at]) => (
          <div
            key={kind}
            style={{ textAlign: "center", opacity: prog(frame, at - 4, 10) }}
          >
            <Icon kind={kind} p={prog(frame, at - 4, 26)} />
            <div
              style={{
                fontFamily: fonts.display,
                fontSize: 44,
                color: kind === "idea" ? C.gold : C.text,
                letterSpacing: "0.2em",
                marginTop: 10,
              }}
            >
              {kind.toUpperCase()}
            </div>
          </div>
        ))}
      </div>

      {/* Título del video */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: title,
        }}
      >
        <div
          style={{
            fontFamily: fonts.display,
            color: C.text,
            fontSize: 104,
            fontWeight: 700,
            textAlign: "center",
            lineHeight: 1.1,
            letterSpacing: `${0.02 + (1 - title) * 0.3}em`,
            textShadow: "0 6px 40px rgba(0,0,0,0.7)",
          }}
        >
          LA SOMBRA QUE
          <br />
          <span style={{ color: C.gold }}>MIDIÓ EL MUNDO</span>
        </div>
        <div
          style={{
            width: 560 * title,
            height: 2,
            background: C.gold,
            marginTop: 36,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Dust, Starfield } from "../../../components/Atmosphere";
import { Sun } from "../../../components/Diagram";
import { faceLon, Globe3D } from "../../../components/Globe3D";
import { KineticText } from "../../../components/KineticText";
import { C, fonts, inOut, mix, prog, visible } from "../../../engine/theme";
import { useCues } from "../../../engine/timeline";

const GROUND = 720;

/** Vara en la arena: el Sol cruza el cielo y la sombra gira; al final su punta traza un círculo. */
const Sundial: React.FC<{
  frame: number;
  t: number;
  ring: number;
  glow: number;
}> = ({ frame, t, ring, glow }) => {
  const x = 960;
  const base = GROUND + 90;
  const h = 260;
  const sunA = mix(160, 20, t); // el Sol va de este a oeste
  const sun = [
    x + Math.cos((sunA * Math.PI) / 180) * 720,
    GROUND - Math.sin((sunA * Math.PI) / 180) * 560,
  ];
  const ringR = 260;
  // Sombra en el plano del suelo (vista en perspectiva: eje vertical comprimido).
  // La sombra apunta al lado contrario del Sol (azimut + 180°) y sigue girando para trazar el círculo.
  const theta0 = sunA + 180;
  const theta = theta0 - 360 * ring;
  const len = mix(
    160 + 320 * Math.abs(Math.cos(Math.PI * t)),
    ringR,
    prog(ring, 0, 0.15, (v) => v),
  );
  const squash = 0.32;
  const pt = (a: number, r: number) => [
    x + r * Math.cos((a * Math.PI) / 180),
    base - r * Math.sin((a * Math.PI) / 180) * squash,
  ];
  const trail: string[] = [];
  for (let a = 0; a <= 360 * ring; a += 4) {
    const [px, py] = pt(theta0 - a, ringR);
    trail.push(`${px.toFixed(1)},${py.toFixed(1)}`);
  }
  const [ex, ey] = pt(theta, len);
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B5C8F" />
          <stop offset="100%" stopColor="#F2C68A" />
        </linearGradient>
        <linearGradient id="sandEnd" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D2AA6C" />
          <stop offset="100%" stopColor="#6E4F2A" />
        </linearGradient>
      </defs>
      <rect width={1920} height={GROUND} fill="url(#dusk)" />
      <Sun x={sun[0]} y={sun[1]} r={46} spin={frame * 0.4} id="endSun" />
      <rect
        y={GROUND}
        width={1920}
        height={1080 - GROUND}
        fill="url(#sandEnd)"
      />
      {trail.length > 1 ? (
        <>
          <polyline
            points={trail.join(" ")}
            fill="none"
            stroke={C.gold}
            strokeWidth={22}
            strokeOpacity={0.2}
            strokeLinecap="round"
          />
          <polyline
            points={trail.join(" ")}
            fill="none"
            stroke={C.gold}
            strokeWidth={6}
            strokeLinecap="round"
          />
        </>
      ) : null}
      <line
        x1={x}
        y1={base}
        x2={ex}
        y2={ey}
        stroke="#000"
        strokeWidth={16}
        strokeLinecap="round"
        opacity={0.55}
      />
      <ellipse
        cx={x}
        cy={base}
        rx={60 + glow * 40}
        ry={14}
        fill={C.gold}
        opacity={glow * 0.35}
      />
      <line
        x1={x}
        y1={base}
        x2={x}
        y2={base - h}
        stroke="#3A2A1A"
        strokeWidth={10}
        strokeLinecap="round"
      />
      <circle cx={x} cy={base - h} r={8} fill="#3A2A1A" />
    </svg>
  );
};

export const Closing: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = useCues();
  const e2 = c.start("end-2");
  const e3 = c.start("end-3");
  const e4 = c.start("end-4");
  const finalAt = c.end("end-4", 0.3);

  const globeOut = 1 - prog(frame, e3 - 10, 24);
  const dialIn = prog(frame, e3 - 10, 24);
  const sweep = interpolate(frame, [e3, e4 + 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: inOut,
  });
  const ring = prog(frame, c.word("end-4", "cabe") - 10, 50, inOut);
  const title = spring({
    frame: frame - finalAt,
    fps,
    config: { damping: 200 },
  });

  return (
    <AbsoluteFill style={{ background: "#05070D" }}>
      <AbsoluteFill style={{ opacity: globeOut }}>
        <Starfield drift={0.08} seed="end" />
        <Globe3D
          spin={faceLon(mix(25, 60, frame / c.duration))}
          tilt={0.42}
          cameraZ={mix(3.2, 6.5, prog(frame, 0, e3, inOut))}
          cameraX={0}
          highlightAmount={0.35}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 230,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <KineticText
            text="Nunca vio la Tierra desde el espacio."
            start={c.start("end-1")}
            exit={e2 - 4}
            style={{ fontSize: 66, fontWeight: 600 }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 230,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <KineticText
            text="No le hizo falta."
            start={e2}
            exit={e3 - 6}
            highlight={["falta"]}
            style={{ fontSize: 80, fontWeight: 700 }}
            mode="blur"
          />
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ opacity: dialIn * (1 - 0.65 * title) }}>
        <Sundial
          frame={frame}
          t={sweep}
          ring={ring}
          glow={visible(frame, c.word("end-3", "sombra") - 6, e4, 10)}
        />
        <Dust count={40} opacity={0.5} />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 140,
            display: "flex",
            justifyContent: "center",
            opacity: visible(frame, c.word("end-3", "sombra") - 4, finalAt, 12),
          }}
        >
          <div
            style={{
              fontFamily: fonts.display,
              fontSize: 84,
              fontWeight: 700,
              color: C.night,
              letterSpacing: "0.3em",
              textShadow: "0 0 30px #fff6",
            }}
          >
            UNA SOMBRA
          </div>
        </div>
      </AbsoluteFill>

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
            textShadow: "0 6px 40px rgba(0,0,0,0.8)",
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
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: 34,
            color: C.papyrus,
            marginTop: 28,
            letterSpacing: "0.2em",
          }}
        >
          ERATÓSTENES DE CIRENE · c. 240 a. C.
        </div>
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: 24,
            color: C.muted,
            marginTop: 60,
            opacity: prog(frame, finalAt + 30, 20),
          }}
        >
          Fuentes en la descripción · Narración con voz sintética (Piper)
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

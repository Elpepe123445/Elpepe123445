import { geoDistance } from "d3-geo";
import React from "react";
import {
  AbsoluteFill,
  random,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Starfield } from "../../components/Atmosphere";
import { DotGrid } from "../../components/DotGrid";
import {
  faceLon,
  Globe3D,
  SurfaceMarker,
  WaveRing,
} from "../../components/Globe3D";
import { GeoMap } from "../../components/GeoMap";
import { fmt, inOut, mix, prog, visible } from "../../engine/theme";
import { useCues } from "../../engine/timeline";
import { GROUND_ZERO, PLACES, TSAR } from "./data";
import { PowerBar } from "./scenesA";
import { heavy, mono, Scanlines, T, Tech } from "./style";

const NO_HIGHLIGHT: string[] = [];

// Escena 4 a escala: suelo en y = 1180, 13,4 px por km.
const G = 1180;
const S = 940 / 70;
const yKm = (km: number) => G - km * S;

/** 4 · Detonación: bola de fuego y nube a escala real, comparadas con el Everest. */
export const ZBoom: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const siete = c.word("z6", "siete");
  const otro = c.word("z6", "otro", "end");
  const flash = 1 - prog(frame, 0, 26, (t) => t);
  const rise = prog(frame, 8, otro - 8, inOut);
  const top = mix(TSAR.burstM / 1000 + TSAR.fireballKm / 2, TSAR.cloudKm, rise);
  const capH = mix(TSAR.fireballKm, 20, rise) * S;
  const capW = mix(TSAR.fireballKm * S, 620, rise);
  const capY = yKm(top) + capH / 2;
  const cool = prog(frame, 40, 160, (t) => t);
  const everests = Math.max(
    0,
    Math.min(
      7,
      Math.floor(((frame - siete) / Math.max(1, otro - siete)) * 7) + 1,
    ),
  );
  return (
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(180deg, #0B1320 0%, #26354A 70%, #9AAFC0 100%)",
      }}
    >
      <svg
        width={1080}
        height={1920}
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <radialGradient id="fireball">
            <stop offset="0%" stopColor={T.flash} />
            <stop offset="35%" stopColor={T.ember} />
            <stop offset="75%" stopColor={T.fire} />
            <stop offset="100%" stopColor="#5A1A08" />
          </radialGradient>
          <radialGradient id="cap" cx="50%" cy="60%">
            <stop
              offset="0%"
              stopColor={`rgb(${mix(255, 120, cool)},${mix(140, 110, cool)},${mix(60, 100, cool)})`}
            />
            <stop
              offset="70%"
              stopColor={`rgb(${mix(200, 150, cool)},${mix(90, 140, cool)},${mix(50, 135, cool)})`}
            />
            <stop offset="100%" stopColor="#D8DDE2" stopOpacity={0.7} />
          </radialGradient>
          <linearGradient id="stem" x1="0" x2="1">
            <stop offset="0%" stopColor="#8E8A86" stopOpacity={0.5} />
            <stop offset="50%" stopColor="#C9C2BA" />
            <stop offset="100%" stopColor="#8E8A86" stopOpacity={0.5} />
          </linearGradient>
          <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <radialGradient id="glow">
            <stop offset="0%" stopColor={T.ember} stopOpacity={0.6} />
            <stop offset="100%" stopColor={T.ember} stopOpacity={0} />
          </radialGradient>
        </defs>
        <rect x={0} y={G} width={1080} height={800} fill="#DCE7EF" />
        {/* Onda de choque en el suelo */}
        <ellipse
          cx={600}
          cy={G + 6}
          rx={prog(frame, 4, 90, (t) => t) * 900}
          ry={prog(frame, 4, 90, (t) => t) * 60}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={4}
          opacity={1 - prog(frame, 4, 90, (t) => t)}
        />
        {/* Regla de altura */}
        <line
          x1={110}
          y1={G}
          x2={110}
          y2={yKm(70)}
          stroke={T.steel}
          strokeWidth={2}
        />
        {[0, 10, 20, 30, 40, 50, 60, 70].map((km) => (
          <g key={km}>
            <line
              x1={100}
              y1={yKm(km)}
              x2={120}
              y2={yKm(km)}
              stroke={T.steel}
              strokeWidth={2}
            />
            <text
              x={132}
              y={yKm(km) + 8}
              fill={T.steel}
              fontFamily={mono}
              fontSize={22}
            >
              {km} km
            </text>
          </g>
        ))}
        {/* Avión comercial, como referencia */}
        <g opacity={prog(frame, 60, 20) * 0.9}>
          <line
            x1={110}
            y1={yKm(TSAR.airlinerKm)}
            x2={990}
            y2={yKm(TSAR.airlinerKm)}
            stroke={T.ice}
            strokeWidth={1.5}
            strokeDasharray="6 8"
            opacity={0.6}
          />
          <text
            x={300}
            y={yKm(TSAR.airlinerKm) - 10}
            textAnchor="start"
            fill={T.ice}
            fontFamily={mono}
            fontSize={22}
          >
            ✈ vuelo comercial · 11 km
          </text>
        </g>
        {/* Tallo y sombrero del hongo */}
        {rise > 0.05 ? (
          <path
            d={`M ${600 - mix(30, 90, rise)} ${G} C ${600 - 40} ${(G + capY) / 2} ${600 - 50} ${capY + capH * 0.3} ${600 - capW * 0.18} ${capY} L ${600 + capW * 0.18} ${capY} C ${600 + 50} ${capY + capH * 0.3} ${600 + 40} ${(G + capY) / 2} ${600 + mix(30, 90, rise)} ${G} Z`}
            fill="url(#stem)"
            opacity={Math.min(1, rise * 3)}
          />
        ) : null}
        <circle
          cx={600}
          cy={capY}
          r={capW * 0.9}
          fill="url(#glow)"
          opacity={1 - cool * 0.7}
        />
        {/* Sombrero: nubes superpuestas y suavizadas, núcleo incandescente que se enfría */}
        <g filter={rise > 0.08 ? "url(#soft)" : undefined}>
          <ellipse
            cx={600}
            cy={capY}
            rx={capW / 2}
            ry={capH / 2}
            fill={rise < 0.08 ? "url(#fireball)" : "url(#cap)"}
          />
          {new Array(28).fill(0).map((_, i) => {
            const a = (i / 28) * Math.PI * 2 + frame * 0.003 * (i % 2 ? 1 : -1);
            const ring = 0.25 + random(`ring${i}`) * 0.2;
            return (
              <circle
                key={i}
                cx={600 + Math.cos(a) * capW * ring}
                cy={capY + Math.sin(a) * capH * 0.3 - capH * 0.08}
                r={capH * (0.2 + random(`b${i}`) * 0.16)}
                fill="url(#cap)"
                opacity={Math.min(1, rise * 4) * 0.7}
              />
            );
          })}
          <ellipse
            cx={600}
            cy={capY + capH * 0.32}
            rx={capW * 0.42}
            ry={capH * 0.16}
            fill="#3E3A3A"
            opacity={Math.min(1, rise * 4) * 0.35}
          />
          <ellipse
            cx={600}
            cy={capY + capH * 0.05}
            rx={capW * 0.22}
            ry={capH * 0.22}
            fill={T.ember}
            opacity={Math.min(1, rise * 4) * (1 - cool) * 0.8}
          />
        </g>
        {/* Etiquetas a escala */}
        <g
          opacity={visible(
            frame,
            c.word("z5", "fuego") - 4,
            c.start("z6") + 10,
            10,
          )}
        >
          <line
            x1={600 - (TSAR.fireballKm / 2) * S}
            y1={yKm(TSAR.burstM / 1000) + 70}
            x2={600 + (TSAR.fireballKm / 2) * S}
            y2={yKm(TSAR.burstM / 1000) + 70}
            stroke={T.slate}
            strokeWidth={3}
          />
          <text
            x={600}
            y={yKm(TSAR.burstM / 1000) + 110}
            textAnchor="middle"
            fill={T.slate}
            fontFamily={heavy}
            fontWeight={900}
            fontSize={54}
          >
            8 km
          </text>
        </g>
        <g opacity={prog(frame, c.word("z6", "64") - 6, 12)}>
          <line
            x1={120}
            y1={yKm(TSAR.cloudKm)}
            x2={600}
            y2={yKm(TSAR.cloudKm)}
            stroke={T.ember}
            strokeWidth={3}
            strokeDasharray="10 8"
          />
          <text
            x={300}
            y={yKm(TSAR.cloudKm) - 18}
            fill={T.ember}
            fontFamily={heavy}
            fontWeight={900}
            fontSize={64}
          >
            64 km
          </text>
        </g>
        {/* Siete Everest apilados (8,85 km cada uno) */}
        {new Array(everests).fill(0).map((_, i) => {
          const b = yKm(i * TSAR.everestKm);
          const t = yKm((i + 1) * TSAR.everestKm);
          return (
            <path
              key={i}
              d={`M 860 ${b} L 930 ${t} L 1000 ${b} Z`}
              fill={i % 2 ? "#E6EDF3" : "#B8C7D4"}
              stroke="#5D6F80"
              strokeWidth={2}
            />
          );
        })}
        <text
          x={930}
          y={yKm(everests * TSAR.everestKm) - 14}
          textAnchor="middle"
          fill={T.ice}
          fontFamily={heavy}
          fontWeight={900}
          fontSize={40}
          opacity={everests > 0 ? 1 : 0}
        >
          ×{everests}
        </text>
      </svg>
      <AbsoluteFill style={{ background: T.flash, opacity: flash }} />
      <Scanlines />
    </AbsoluteFill>
  );
};

/** 5 · Alcance: círculos geodésicos verdaderos (proyección azimutal centrada en la zona cero). */
export const ZReach: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const flashAt = c.word("z7", "destello");
  const winAt = c.word("z7", "ventanas");
  const villAt = c.word("z8", "pueblo");
  const rings = [
    {
      km: TSAR.flashKm,
      at: flashAt,
      color: T.flash,
      label: "destello visible · 1.000 km",
      dash: "14 10",
    },
    {
      km: TSAR.windowsKm,
      at: winAt,
      color: T.ice,
      label: "ventanas rotas · 900 km",
      dash: undefined,
    },
    {
      km: TSAR.severnyKm,
      at: villAt,
      color: T.red,
      label: "Severny · 55 km",
      dash: undefined,
    },
  ];
  const murmanskKm =
    Math.round((geoDistance(GROUND_ZERO, PLACES.murmansk) * 6371) / 10) * 10;
  return (
    <AbsoluteFill style={{ background: T.bg }}>
      <div
        style={{
          position: "absolute",
          top: 230,
          left: 0,
          width: 1080,
          height: 1080,
        }}
      >
        <GeoMap
          fit={[
            [0, 0],
            [1, 1],
          ]}
          projection="azimuthal"
          center={GROUND_ZERO}
          radiusKm={1180}
          size={{ width: 1080, height: 1080 }}
          land="#2B3744"
          ocean="#0A1520"
          coast="#8EA4B6"
          graticuleStep={10}
          detail="50m"
        >
          {(m) => {
            const [gx, gy] = m.project(GROUND_ZERO);
            const mur = m.project(PLACES.murmansk);
            return (
              <>
                {rings.map((r) => {
                  const p = prog(frame, r.at - 6, 30, inOut);
                  return p > 0 ? (
                    <g key={r.km}>
                      <path
                        d={m.circle(GROUND_ZERO, r.km * p)}
                        fill={r.color}
                        fillOpacity={0.06}
                        stroke={r.color}
                        strokeWidth={r.km < 100 ? 4 : 3}
                        strokeDasharray={r.dash}
                      />
                    </g>
                  ) : null;
                })}
                <circle cx={mur[0]} cy={mur[1]} r={7} fill={T.ice} />
                <text
                  x={mur[0] + 14}
                  y={mur[1] + 8}
                  fill={T.ice}
                  fontFamily={mono}
                  fontSize={24}
                >
                  Murmansk · {fmt(murmanskKm)} km
                </text>
                <text
                  x={m.project([42, 75.5])[0]}
                  y={m.project([42, 75.5])[1]}
                  fill="#4D6175"
                  fontFamily={mono}
                  fontSize={26}
                  letterSpacing={6}
                >
                  MAR DE BARENTS
                </text>
                <circle
                  cx={gx}
                  cy={gy}
                  r={10 + 30 * ((((frame % 30) + 30) % 30) / 30)}
                  fill="none"
                  stroke={T.red}
                  strokeWidth={3}
                  opacity={1 - (frame % 30) / 30}
                />
                <circle cx={gx} cy={gy} r={8} fill={T.red} />
              </>
            );
          }}
        </GeoMap>
      </div>
      {/* Leyenda */}
      <div
        style={{
          position: "absolute",
          top: 1100,
          left: 70,
          right: 70,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {rings.map((r) => (
          <Tech
            key={r.km}
            style={{
              fontSize: 30,
              color: r.color,
              opacity: prog(frame, r.at, 12),
            }}
          >
            {r.km < 100 ? "■" : "○"} {r.label}
          </Tech>
        ))}
      </div>
      <Tech
        style={{
          position: "absolute",
          top: 200,
          left: 70,
          fontSize: 28,
          color: T.steel,
        }}
      >
        zona cero · Nueva Zembla
      </Tech>
      <Scanlines />
    </AbsoluteFill>
  );
};

/** 6 · Escala: 1 punto = 1 Hiroshima; luego la onda que dio tres vueltas al planeta. */
export const ZScale: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const total = Math.round((TSAR.testMt * 1000) / TSAR.hiroshimaKt);
  const hiro = c.word("z9", "hiroshima");
  const lit = Math.round(total * prog(frame, hiro - 30, 50, inOut));
  const z10 = c.start("z10");
  const gridOut = prog(frame, z10 - 8, 14);
  const laps = prog(frame, z10, c.duration - z10 - 6, (t) => t) * TSAR.waveLaps;
  const phase = (laps % 1) * Math.PI * 2;
  const angle = phase <= Math.PI ? phase : Math.PI * 2 - phase;
  return (
    <AbsoluteFill style={{ background: T.bg }}>
      <AbsoluteFill style={{ opacity: 1 - gridOut }}>
        <div
          style={{
            position: "absolute",
            top: 200,
            left: 0,
            right: 0,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: heavy,
              fontWeight: 900,
              fontSize: 92,
              color: T.ember,
              lineHeight: 1,
            }}
          >
            50.000.000 t
          </div>
          <Tech style={{ fontSize: 28, color: T.steel, marginTop: 8 }}>
            de TNT · {fmt(lit)} Hiroshimas
          </Tech>
        </div>
        <div
          style={{
            position: "absolute",
            top: 380,
            left: 90,
            opacity: prog(frame, c.start("z9"), 10),
          }}
        >
          <DotGrid
            count={total}
            columns={60}
            width={900}
            lit={lit}
            color={T.fire}
            highlightFirst={T.flash}
          />
        </div>
        <Tech
          style={{
            position: "absolute",
            top: 1240,
            left: 90,
            fontSize: 24,
            color: T.steel,
          }}
        >
          ● = 1 bomba de Hiroshima (≈15.000 t)
        </Tech>
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: gridOut }}>
        <Starfield count={500} drift={0.1} seed="wave" />
        <Globe3D
          spin={faceLon(GROUND_ZERO[0] - 30 + frame * 0.15)}
          tilt={0.6}
          cameraZ={8.4}
          cameraY={0.35}
          highlight={NO_HIGHLIGHT}
          surface={
            <>
              <SurfaceMarker
                lat={GROUND_ZERO[1]}
                lon={GROUND_ZERO[0]}
                pulse={0}
                amount={1}
                color={T.red}
              />
              {gridOut > 0 ? (
                <WaveRing
                  lat={GROUND_ZERO[1]}
                  lon={GROUND_ZERO[0]}
                  angle={Math.max(0.02, angle)}
                />
              ) : null}
            </>
          }
        />
        <div
          style={{
            position: "absolute",
            top: 220,
            left: 0,
            right: 0,
            textAlign: "center",
          }}
        >
          <Tech style={{ fontSize: 30, color: T.steel }}>
            vueltas de la onda de presión
          </Tech>
          <div
            style={{
              fontFamily: heavy,
              fontWeight: 900,
              fontSize: 130,
              color: T.flash,
            }}
          >
            {Math.min(TSAR.waveLaps, Math.floor(laps) + 1)} / 3
          </div>
        </div>
      </AbsoluteFill>
      <Scanlines />
    </AbsoluteFill>
  );
};

/** 7 · Legado: el diseño de 100 Mt, nunca un arma, y el tratado de 1963. */
export const ZLegacy: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = useCues();
  const doble = c.word("z11", "doble");
  const z12 = c.start("z12");
  const treaty = c.word("z12", "prohibieron");
  const endCard = c.end("z13", 0.15);
  const ghost = prog(frame, doble - 4, 24, inOut);
  const barOut = prog(frame, z12 - 6, 14);
  const seal = spring({
    frame: frame - treaty - 10,
    fps,
    config: { damping: 10 },
  });
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, #121B26 0%, #05080C 70%)",
      }}
    >
      <AbsoluteFill style={{ opacity: 1 - barOut }}>
        <Tech
          style={{
            position: "absolute",
            top: 640,
            left: 90,
            color: T.steel,
            fontSize: 30,
          }}
        >
          diseño original
        </Tech>
        <PowerBar y={710} cut={0} fall={1} ghost={ghost} />
        <div
          style={{
            position: "absolute",
            top: 870,
            left: 90,
            width: 900,
            display: "flex",
            justifyContent: "space-between",
            fontFamily: heavy,
            fontWeight: 900,
            color: T.flash,
          }}
        >
          <span style={{ fontSize: 60 }}>
            50 <span style={{ fontSize: 32, color: T.ember }}>Mt</span>
          </span>
          <span style={{ fontSize: 60, color: T.ember, opacity: ghost }}>
            100 Mt
          </span>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: visible(frame, z12, endCard, 12) }}>
        <div
          style={{
            position: "absolute",
            top: 260,
            left: 70,
            right: 70,
            textAlign: "center",
            fontFamily: heavy,
            fontWeight: 900,
            fontSize: 84,
            lineHeight: 1.05,
            color: T.ice,
            opacity: prog(frame, z12, 12),
          }}
        >
          NUNCA FUE
          <br />
          UN ARMA REAL
        </div>
        <div
          style={{
            position: "absolute",
            top: 560,
            left: 110,
            right: 110,
            background: T.paper,
            color: "#2B2418",
            padding: "40px 44px",
            borderRadius: 6,
            boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
            rotate: "-2deg",
            opacity: prog(frame, treaty - 6, 12),
            translate: `0 ${(1 - prog(frame, treaty - 6, 18)) * 60}px`,
          }}
        >
          <Tech style={{ fontSize: 26, color: "#6B5E46" }}>
            Moscú · 5 de agosto de 1963
          </Tech>
          <div
            style={{
              fontFamily: heavy,
              fontWeight: 900,
              fontSize: 46,
              lineHeight: 1.1,
              marginTop: 14,
            }}
          >
            TRATADO DE PROHIBICIÓN PARCIAL DE ENSAYOS NUCLEARES
          </div>
          <Tech style={{ fontSize: 24, marginTop: 18, color: "#6B5E46" }}>
            EE. UU. · URSS · Reino Unido
          </Tech>
          <div
            style={{
              position: "absolute",
              right: 30,
              bottom: -40,
              width: 130,
              height: 130,
              borderRadius: 65,
              border: `6px solid ${T.red}`,
              color: T.red,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              fontFamily: mono,
              fontWeight: 700,
              fontSize: 20,
              lineHeight: 1.1,
              rotate: "14deg",
              scale: String(frame >= treaty + 10 ? 2 - seal : 0),
              opacity: frame >= treaty + 10 ? Math.min(1, seal) : 0,
            }}
          >
            SIN
            <br />
            PRUEBAS EN
            <br />
            ATMÓSFERA
          </div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          opacity: prog(frame, endCard, 14),
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div style={{ textAlign: "center", marginTop: -200 }}>
          <div
            style={{
              fontFamily: heavy,
              fontWeight: 900,
              fontSize: 110,
              color: T.ice,
              lineHeight: 0.95,
            }}
          >
            LA BOMBA
            <br />
            DEL ZAR
          </div>
          <Tech style={{ fontSize: 30, color: T.ember, marginTop: 20 }}>
            30 · 10 · 1961 · 50 Mt
          </Tech>
          <Tech
            style={{
              fontSize: 20,
              color: T.steel,
              marginTop: 40,
              letterSpacing: "0.08em",
            }}
          >
            Fuentes: Nuclear Weapon Archive · Center for Arms Control
          </Tech>
        </div>
      </AbsoluteFill>
      <Scanlines />
    </AbsoluteFill>
  );
};

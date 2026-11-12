import { geoEquirectangular, geoPath } from "d3-geo";
import React, { useMemo } from "react";
import { random } from "remotion";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import land110 from "world-atlas/land-110m.json";
import { latLon } from "../../components/Globe3D";
import { Glow, useGlowTexture } from "../../components/three/Stage";

const LAND = land110 as unknown as Topology;

/** Paleta del video: noche profunda, aurora roja/verde y oro solar. */
export const S = {
  bg: "radial-gradient(ellipse at 50% 30%, #1B1030 0%, #0A0716 55%, #04030A 100%)",
  red: "#FF4058",
  magenta: "#FF5FA8",
  green: "#7CFFB2",
  gold: "#FFC24D",
  cyan: "#7FE7FF",
  white: "#F6F2FF",
  muted: "#B1A9C9",
};

type V3 = [number, number, number];

/** Nube de puntos animable (posición y, opcionalmente, color por punto). */
export const usePoints = (count: number, colors = false) =>
  useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(count * 3), 3),
    );
    if (colors)
      g.setAttribute(
        "color",
        new THREE.BufferAttribute(new Float32Array(count * 3).fill(1), 3),
      );
    return g;
  }, [count, colors]);

export const PointCloud: React.FC<{
  geometry: THREE.BufferGeometry;
  color?: string;
  size: number;
  opacity?: number;
  vertexColors?: boolean;
}> = ({ geometry, color = "#FFFFFF", size, opacity = 1, vertexColors }) => {
  const tex = useGlowTexture();
  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        map={tex}
        color={color}
        size={size}
        sizeAttenuation
        transparent
        opacity={opacity}
        vertexColors={vertexColors}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
};

// --- Sol ---------------------------------------------------------------------------------------

/** Punto de la superficie para unas coordenadas UV de la textura (mismo mapeo que SphereGeometry). */
export const sunPoint = (u: number, v: number, r: number): V3 => {
  const phi = u * Math.PI * 2;
  const theta = v * Math.PI;
  return [
    -Math.cos(phi) * Math.sin(theta) * r,
    Math.cos(theta) * r,
    Math.sin(phi) * Math.sin(theta) * r,
  ];
};

/** Grupo de manchas donde Carrington vio el destello (UV de la textura). */
export const SPOT = { u: 0.262, v: 0.4 };

const useSunTexture = () =>
  useMemo(() => {
    const w = 1024;
    const h = 512;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#FF8A1C";
    ctx.fillRect(0, 0, w, h);
    // Moteado amplio y granulación fina.
    for (let i = 0; i < 160; i++) {
      const x = random(`mx${i}`) * w;
      const y = random(`my${i}`) * h;
      const r = 30 + random(`mr${i}`) * 90;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const hot = random(`mh${i}`) > 0.45;
      g.addColorStop(0, hot ? "rgba(255,214,96,0.34)" : "rgba(214,70,0,0.3)");
      g.addColorStop(1, "rgba(255,140,30,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 11000; i++) {
      const x = random(`gx${i}`) * w;
      const y = random(`gy${i}`) * h;
      const r = 1.2 + random(`gr${i}`) * 3.4;
      ctx.fillStyle =
        random(`gh${i}`) > 0.5
          ? "rgba(255,232,150,0.2)"
          : "rgba(170,48,0,0.17)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Manchas solares: umbra oscura con penumbra.
    const spots: [number, number, number][] = [
      [SPOT.u, SPOT.v, 26],
      [SPOT.u + 0.03, SPOT.v + 0.03, 15],
      [SPOT.u - 0.028, SPOT.v + 0.02, 11],
      [SPOT.u + 0.012, SPOT.v - 0.045, 8],
      [0.16, 0.62, 12],
      [0.36, 0.66, 9],
    ];
    for (const [u, v, r] of spots) {
      const x = u * w;
      const y = v * h;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(20,4,0,0.98)");
      g.addColorStop(0.45, "rgba(40,8,0,0.92)");
      g.addColorStop(0.7, "rgba(150,50,0,0.6)");
      g.addColorStop(1, "rgba(200,80,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    return t;
  }, []);

/** Sol: esfera sin sombreado (emite luz) + corona de halos aditivos. */
export const Sun: React.FC<{
  r: number;
  position?: V3;
  spin?: number;
  children?: React.ReactNode;
}> = ({ r, position = [0, 0, 0], spin = 0, children }) => {
  const tex = useSunTexture();
  return (
    <group position={position}>
      <group rotation={[0.12, spin, 0]}>
        <mesh>
          <sphereGeometry args={[r, 72, 72]} />
          <meshBasicMaterial map={tex} toneMapped={false} />
        </mesh>
        {children}
      </group>
      <Glow size={r * 3.1} color="#FFA53A" opacity={0.8} />
      <Glow size={r * 5.2} color="#FF5A1E" opacity={0.32} />
    </group>
  );
};

// --- Tierra de puntos --------------------------------------------------------------------------

export type LandDots = {
  count: number;
  positions: Float32Array;
  lat: Float32Array;
  lon: Float32Array;
};

/** Muestrea la tierra firme (Natural Earth) en una rejilla casi uniforme sobre la esfera. */
export const useLandDots = (step = 1.5): LandDots =>
  useMemo(() => {
    const w = 720;
    const h = 360;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    const proj = geoEquirectangular()
      .scale(w / (2 * Math.PI))
      .translate([w / 2, h / 2]);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    ctx.beginPath();
    geoPath(proj, ctx)(feature(LAND, LAND.objects.land));
    ctx.fillStyle = "#FFF";
    ctx.fill();
    const img = ctx.getImageData(0, 0, w, h).data;
    const pos: number[] = [];
    const lats: number[] = [];
    const lons: number[] = [];
    for (let lat = -56; lat <= 82; lat += step) {
      const dl = step / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
      for (let lon = -180; lon < 180; lon += dl) {
        const x = Math.min(w - 1, Math.floor(((lon + 180) / 360) * w));
        const y = Math.min(h - 1, Math.floor(((90 - lat) / 180) * h));
        if (img[(y * w + x) * 4] > 128) {
          pos.push(...latLon(lat, lon, 1));
          lats.push(lat);
          lons.push(lon);
        }
      }
    }
    return {
      count: lats.length,
      positions: new Float32Array(pos),
      lat: new Float32Array(lats),
      lon: new Float32Array(lons),
    };
  }, [step]);

/** Geometría de los puntos de tierra con un color por punto que la escena puede animar. */
export const useDotGeometry = (dots: LandDots) =>
  useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(dots.positions, 3));
    g.setAttribute(
      "color",
      new THREE.BufferAttribute(new Float32Array(dots.count * 3).fill(1), 3),
    );
    return g;
  }, [dots]);

/** Planeta nocturno: esfera oscura, continentes de puntos luminosos y halo atmosférico. */
export const DotEarth: React.FC<{
  geometry: THREE.BufferGeometry;
  size?: number;
  halo?: string;
  haloOpacity?: number;
  /** Brillo propio del océano (0 = noche cerrada). */
  oceanGlow?: number;
  children?: React.ReactNode;
}> = ({
  geometry,
  size = 0.022,
  halo = "#3B7BFF",
  haloOpacity = 0.4,
  oceanGlow = 0.22,
  children,
}) => (
  <>
    <mesh>
      <sphereGeometry args={[0.99, 64, 64]} />
      <meshStandardMaterial
        color="#0B1838"
        emissive="#0A1F5C"
        emissiveIntensity={oceanGlow}
        roughness={0.85}
        metalness={0.1}
      />
    </mesh>
    <PointCloud geometry={geometry} size={size} vertexColors />
    <Glow size={2.75} color={halo} opacity={haloOpacity} />
    {children}
  </>
);

/** Óvalo auroral: cortina de puntos alrededor del polo, verde abajo y roja arriba. */
export const AuroraRing: React.FC<{
  lat: number;
  frame: number;
  opacity?: number;
  count?: number;
}> = ({ lat, frame, opacity = 1, count = 3600 }) => {
  const geo = usePoints(count, true);
  const pos = geo.attributes.position.array as Float32Array;
  const col = geo.attributes.color.array as Float32Array;
  for (let i = 0; i < count; i++) {
    const a = random(`aa${i}`) * 360;
    const rad = (a * Math.PI) / 180;
    const t = random(`ah${i}`);
    const la =
      lat +
      3.2 * Math.sin(rad * 3 + frame * 0.035) +
      1.8 * Math.sin(rad * 7 - frame * 0.05) +
      (random(`al${i}`) - 0.5) * 5;
    const p = latLon(la, a, 1.012 + t * 0.17);
    pos[i * 3] = p[0];
    pos[i * 3 + 1] = p[1];
    pos[i * 3 + 2] = p[2];
    const flick =
      (0.5 + 0.5 * Math.sin(frame * 0.16 + rad * 9 + i * 0.01)) * 0.6 + 0.4;
    const k = t ** 0.4;
    col[i * 3] = (0.12 + 0.88 * k) * flick;
    col[i * 3 + 1] = (1 - 0.92 * k) * flick;
    col[i * 3 + 2] = (0.45 - 0.15 * k) * flick;
  }
  geo.attributes.position.needsUpdate = true;
  geo.attributes.color.needsUpdate = true;
  return (
    <PointCloud geometry={geo} size={0.07} opacity={opacity} vertexColors />
  );
};

/** Satélite sencillo: cuerpo y dos paneles solares. */
export const Satellite: React.FC<{ color: string; scale?: number }> = ({
  color,
  scale = 1,
}) => (
  <group scale={scale}>
    <mesh>
      <boxGeometry args={[0.07, 0.07, 0.1]} />
      <meshStandardMaterial color="#D8DCE6" metalness={0.8} roughness={0.3} />
    </mesh>
    {[-1, 1].map((s) => (
      <mesh key={s} position={[s * 0.13, 0, 0]}>
        <boxGeometry args={[0.16, 0.012, 0.08]} />
        <meshStandardMaterial
          color="#1B3C8C"
          metalness={0.6}
          roughness={0.3}
          emissive="#12306E"
          emissiveIntensity={0.6}
        />
      </mesh>
    ))}
    <Glow size={0.3} color={color} opacity={0.9} />
  </group>
);

// --- Destello ----------------------------------------------------------------------------------

/** Halo que se dibuja siempre encima (sin prueba de profundidad): destellos sobre una superficie. */
export const Flare: React.FC<{
  position: V3;
  size: number;
  color: string;
  opacity: number;
}> = ({ position, size, color, opacity }) => {
  const tex = useGlowTexture();
  return (
    <sprite position={position} scale={[size, size, size]} renderOrder={5}>
      <spriteMaterial
        map={tex}
        color={color}
        transparent
        opacity={opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
      />
    </sprite>
  );
};

// --- Telégrafo ---------------------------------------------------------------------------------

const Brass: React.FC = () => (
  <meshStandardMaterial color="#E2AE4A" metalness={1} roughness={0.24} />
);

const useTube = (pts: V3[], radius: number) =>
  useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(
      pts.map((p) => new THREE.Vector3(...p)),
    );
    return { curve, geo: new THREE.TubeGeometry(curve, 80, radius, 8, false) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(pts), radius]);

/** Giro del manipulador sobre la mesa: el pomo queda hacia la cámara, los bornes al fondo. */
const KEY_ROT = -0.9;
const keyToWorld = (p: V3): V3 => {
  const c = Math.cos(KEY_ROT);
  const s = Math.sin(KEY_ROT);
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
};
const TERM_LINE = keyToWorld([-1.3, 0.52, 0.42]);
const TERM_BATT = keyToWorld([-1.3, 0.52, -0.42]);
/** Posición de la pila y punto donde los dos cables sueltos NO se tocan (para el rótulo). */
const BATT: V3 = [0.8, 0, -2.35];
export const WIRE_GAP: V3 = [-0.13, 0.1, -1.72];

/**
 * Manipulador de telégrafo (latón sobre madera), su cable de línea «vivo» y una pila
 * de vaso desconectada. `press` 0-1 baja la palanca; `flow` anima la corriente del cable.
 */
export const Telegraph: React.FC<{
  press: number;
  flow: number;
  glow: number;
}> = ({ press, flow, glow }) => {
  const base = useMemo(
    () => new RoundedBoxGeometry(3.3, 0.24, 1.5, 4, 0.05),
    [],
  );
  const line = useTube(
    [
      TERM_LINE,
      [TERM_LINE[0] - 0.22, 0.95, TERM_LINE[2] - 0.25],
      [-1.2, 2.3, -1.7],
      [-0.55, 3.9, -2.5],
      [0.15, 6, -3.6],
      [0.6, 9.5, -5.2],
    ],
    0.03,
  );
  const stub = useTube(
    [
      TERM_BATT,
      [TERM_BATT[0] - 0.02, 0.78, TERM_BATT[2] - 0.2],
      [-0.42, 0.34, -1.72],
      [-0.3, 0.05, -1.72],
    ],
    0.028,
  );
  const battWire = useTube(
    [
      [BATT[0] - 0.2, 1.24, BATT[2]],
      [BATT[0] - 0.45, 1.5, BATT[2] + 0.15],
      [0.12, 0.6, -1.85],
      [0.04, 0.05, -1.72],
    ],
    0.028,
  );
  const sparks = [0, 1, 2, 3, 4, 5].map((k) => {
    const t = (((flow * 0.012 + k / 6) % 1) + 1) % 1;
    return line.curve.getPoint(1 - t);
  });
  return (
    <group>
      {/* Mesa: su borde trasero deja ver el cielo */}
      <mesh position={[0, -0.24, -1]}>
        <boxGeometry args={[11, 0.2, 7.4]} />
        <meshPhysicalMaterial color="#120907" roughness={0.92} />
      </mesh>
      <group rotation={[0, KEY_ROT, 0]}>
        {/* Base de madera */}
        <mesh geometry={base}>
          <meshPhysicalMaterial
            color="#4A2210"
            roughness={0.45}
            clearcoat={0.6}
            clearcoatRoughness={0.3}
          />
        </mesh>
        {/* Soportes del eje */}
        {[-0.3, 0.3].map((z) => (
          <mesh key={z} position={[0.1, 0.4, z]}>
            <cylinderGeometry args={[0.07, 0.09, 0.56, 24]} />
            <Brass />
          </mesh>
        ))}
        <mesh position={[0.1, 0.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.74, 16]} />
          <Brass />
        </mesh>
        {/* Palanca */}
        <group
          position={[0.1, 0.6, 0]}
          rotation={[0, 0, -0.075 * press + 0.03]}
        >
          <mesh position={[0.45, 0, 0]}>
            <boxGeometry args={[2.3, 0.075, 0.17]} />
            <Brass />
          </mesh>
          <mesh position={[1.45, 0.1, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.16, 12]} />
            <Brass />
          </mesh>
          <mesh position={[1.45, 0.2, 0]}>
            <cylinderGeometry args={[0.25, 0.21, 0.1, 40]} />
            <meshPhysicalMaterial
              color="#0E0E12"
              roughness={0.25}
              clearcoat={1}
            />
          </mesh>
          <mesh position={[-0.55, 0.1, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.3, 16]} />
            <Brass />
          </mesh>
          <mesh position={[1.0, -0.08, 0]}>
            <cylinderGeometry args={[0.04, 0.03, 0.1, 12]} />
            <Brass />
          </mesh>
        </group>
        {/* Yunque de contacto y chispa */}
        <mesh position={[1.1, 0.25, 0]}>
          <cylinderGeometry args={[0.07, 0.09, 0.28, 20]} />
          <Brass />
        </mesh>
        <Flare
          position={[1.1, 0.48, 0]}
          size={0.25 + press * 0.55}
          color="#BFE9FF"
          opacity={press * 0.85}
        />
        {/* Bornes */}
        {[-0.42, 0.42].map((z) => (
          <group key={z} position={[-1.3, 0.3, z]}>
            <mesh>
              <cylinderGeometry args={[0.07, 0.07, 0.4, 20]} />
              <Brass />
            </mesh>
            <mesh position={[0, 0.22, 0]}>
              <cylinderGeometry args={[0.11, 0.11, 0.08, 24]} />
              <Brass />
            </mesh>
          </group>
        ))}
      </group>
      {/* Cable de línea: brilla con la corriente inducida por la aurora */}
      <mesh geometry={line.geo}>
        <meshStandardMaterial
          color="#B8632A"
          metalness={0.7}
          roughness={0.35}
          emissive="#FF5FA8"
          emissiveIntensity={0.4 + glow * 1.8}
        />
      </mesh>
      {sparks.map((p, k) => (
        <Glow
          key={k}
          position={[p.x, p.y, p.z]}
          size={0.5}
          color="#FFB0D8"
          opacity={0.9 * glow}
        />
      ))}
      {/* Cable del manipulador y cable de la pila: sueltos, no se tocan */}
      <mesh geometry={stub.geo}>
        <meshStandardMaterial
          color="#C0703A"
          metalness={0.8}
          roughness={0.35}
        />
      </mesh>
      <mesh geometry={battWire.geo}>
        <meshStandardMaterial
          color="#C0703A"
          metalness={0.8}
          roughness={0.35}
        />
      </mesh>
      {/* Pila de vaso (tipo Daniell): vidrio, sulfato de cobre azul y electrodos */}
      <group position={BATT}>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.4, 0.4, 0.64, 40]} />
          <meshStandardMaterial
            color="#2D6BFF"
            emissive="#1238B0"
            emissiveIntensity={0.4}
            transparent
            opacity={0.82}
            roughness={0.2}
          />
        </mesh>
        <mesh position={[0, 0.45, 0]}>
          <cylinderGeometry args={[0.46, 0.46, 1.15, 40, 1, true]} />
          <meshPhysicalMaterial
            color="#CFEFFF"
            transparent
            opacity={0.24}
            roughness={0.05}
            clearcoat={1}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[0.18, 0.7, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 1.0, 16]} />
          <meshStandardMaterial
            color="#9AA3AD"
            metalness={0.9}
            roughness={0.4}
          />
        </mesh>
        <mesh position={[-0.2, 0.75, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 1.0, 16]} />
          <meshStandardMaterial color="#C8743A" metalness={1} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
};

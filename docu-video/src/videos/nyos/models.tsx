import React, { useMemo } from "react";
import { random } from "remotion";
import * as THREE from "three";
import { Flare, PointCloud, usePoints } from "../../components/three/Dots";
import { Glow } from "../../components/three/Stage";

/** Paleta del video: noche azul, luces ámbar de las aldeas, gas blanco azulado y rojo de alarma. */
export const N = {
  bg: "radial-gradient(ellipse at 50% 30%, #0E1A38 0%, #070C1C 55%, #03050D 100%)",
  amber: "#FFC46B",
  gas: "#CFE9FF",
  red: "#FF4D5E",
  teal: "#58D6C9",
  white: "#F2F6FF",
  muted: "#9FB0CC",
};

type V3 = [number, number, number];
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// --- Terreno (esquemático: no es la topografía real de Nyos) -----------------------------------

const hash = (x: number, z: number) => {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const vnoise = (x: number, z: number) => {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const u = smooth(0, 1, x - xi);
  const v = smooth(0, 1, z - zi);
  return mix(
    mix(hash(xi, zi), hash(xi + 1, zi), u),
    mix(hash(xi, zi + 1), hash(xi + 1, zi + 1), u),
    v,
  );
};
const fbm = (x: number, z: number) =>
  0.5 * vnoise(x, z) +
  0.25 * vnoise(x * 2.1 + 7, z * 2.1 + 3) +
  0.125 * vnoise(x * 4.3 + 1, z * 4.3 + 9);

/** Centro del cráter (x, z), nivel del lago y radios de la orilla y del borde. */
export const CRATER: [number, number] = [0, -7];
export const LAKE_Y = 0;
export const LAKE_R = 2.35;
const RIM_R = 3.3;
/** Los valles empiezan en la brecha del cráter y bajan hacia la cámara. */
export const VALLEY_Z0 = -3.6;
export const VALLEY_Z1 = 10;

/** Eje de cada uno de los dos valles (forman una Y) y su semianchura. */
export const valleyX = (z: number, k: number) => {
  // Un solo cauce al salir del cráter que luego se abre en dos.
  const split = smooth(-2.8, 2.6, z);
  const trunk = 0.12 * Math.sin(z * 0.8);
  return k === 0
    ? trunk + split * (2.2 + 0.35 * Math.sin(z * 0.55))
    : trunk - split * (2.3 + 0.35 * Math.sin(z * 0.5 + 2));
};
export const valleyW = (z: number) => 0.75 + 0.045 * (z + 4);

const valleyMask = (x: number, z: number) => {
  const open = smooth(-4.6, -3.2, z);
  const w = valleyW(z);
  const a = Math.exp(-(((x - valleyX(z, 0)) / w) ** 2));
  const b = Math.exp(-(((x - valleyX(z, 1)) / w) ** 2));
  return Math.max(a, b) * open;
};

const analyticHeight = (x: number, z: number) => {
  const dx = x - CRATER[0];
  const dz = z - CRATER[1];
  const d = Math.hypot(dx, dz);
  // Ladera general: baja hacia la cámara y sube detrás del cráter.
  const base = dz > 0 ? 0.1 - 0.2 * dz : 0.1 - 0.16 * dz;
  const hills = 0.2 + 1.9 * fbm(x * 0.33 + 3, z * 0.33 + 11) + 0.04 * x * x;
  const h = base + hills * (1 - 0.96 * valleyMask(x, z));
  // Borde del cráter: bajo por delante (para ver el lago) y con una brecha hacia los valles.
  const facing = Math.atan2(dx, dz);
  const breach = Math.exp(-((facing / 0.4) ** 2));
  const front = 0.5 + 0.5 * Math.cos(facing);
  const rimH =
    mix(1.3, 0.2, front) * (1 - 0.85 * breach) + 0.25 * fbm(x * 1.3, z * 1.3);
  const outside =
    h + rimH * (d < RIM_R ? 1 : Math.exp(-(((d - RIM_R) / 1.3) ** 2)));
  // Cuenco: fondo hundido, playa circular a ras del lago y pared hasta el borde.
  if (d < LAKE_R + 0.15) return mix(-1.0, 0.1, smooth(1.2, LAKE_R + 0.15, d));
  if (d < RIM_R) return mix(0.1, outside, smooth(LAKE_R + 0.15, RIM_R, d));
  return outside;
};

// Rejilla de alturas: la malla y todo lo que se apoya en el suelo usan los mismos triángulos.
const GX = 140;
const GZ = 280;
const X0 = -10;
const Z0 = -28;
const SX = 20 / GX;
const SZ = 40 / GZ;
const GRID = (() => {
  const g = new Float32Array((GX + 1) * (GZ + 1));
  for (let j = 0; j <= GZ; j++)
    for (let i = 0; i <= GX; i++)
      g[j * (GX + 1) + i] = analyticHeight(X0 + i * SX, Z0 + j * SZ);
  return g;
})();

/** Altura del suelo en (x, z), interpolada sobre los mismos triángulos que dibuja la malla. */
export const groundY = (x: number, z: number) => {
  const fx = Math.min(GX - 1e-4, Math.max(0, (x - X0) / SX));
  const fz = Math.min(GZ - 1e-4, Math.max(0, (z - Z0) / SZ));
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const u = fx - i;
  const v = fz - j;
  const a = GRID[j * (GX + 1) + i];
  const b = GRID[j * (GX + 1) + i + 1];
  const c = GRID[(j + 1) * (GX + 1) + i];
  const e = GRID[(j + 1) * (GX + 1) + i + 1];
  return u + v <= 1
    ? a + u * (b - a) + v * (c - a)
    : e + (1 - u) * (c - e) + (1 - v) * (b - e);
};

const TERRAIN_LOOK = {
  night: {
    low: "#06101F",
    high: "#1B4A8F",
    line: "#5FB4FF",
    light: 0.75,
    lines: 1,
  },
  day: {
    low: "#1F6B33",
    high: "#9CC25A",
    line: "#F4FFD9",
    light: 1.0,
    lines: 0.4,
  },
};

const TERRAIN_VERT = `
varying vec3 vPos;
varying vec3 vNormalW;
void main() {
  vPos = position;
  vNormalW = normal;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const TERRAIN_FRAG = `
uniform vec3 uLow;
uniform vec3 uHigh;
uniform vec3 uLine;
uniform vec3 uSun;
uniform vec3 uFog;
uniform float uLight;
uniform float uLines;
uniform float uFogNear;
uniform float uFogFar;
varying vec3 vPos;
varying vec3 vNormalW;
void main() {
  vec3 n = normalize(vNormalW);
  float diff = clamp(dot(n, normalize(uSun)), 0.0, 1.0);
  float t = clamp((vPos.y + 2.6) / 6.2, 0.0, 1.0);
  vec3 col = mix(uLow, uHigh, t) * (0.3 + uLight * diff);
  // Curvas de nivel: una cada 0,25 de altura, con grosor constante en pantalla.
  float f = vPos.y * 4.0;
  float w = fwidth(f);
  float line = 1.0 - smoothstep(0.0, w * 1.6, abs(fract(f - 0.5) - 0.5));
  line *= 1.0 - smoothstep(0.35, 0.7, w);
  col += uLine * line * (0.1 + 0.5 * t) * uLines;
  float depth = gl_FragCoord.z / gl_FragCoord.w;
  col = mix(col, uFog, smoothstep(uFogNear, uFogFar, depth));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** Malla del terreno: relieve suave con curvas de nivel luminosas (aspecto de mapa topográfico). */
export const Terrain: React.FC<{
  mode?: "night" | "day";
  fog?: { color: string; near: number; far: number };
}> = ({ mode = "night", fog = { color: "#050816", near: 22, far: 52 } }) => {
  const geo = useMemo(() => {
    const pos = new Float32Array((GX + 1) * (GZ + 1) * 3);
    let p = 0;
    for (let j = 0; j <= GZ; j++) {
      for (let i = 0; i <= GX; i++) {
        pos[p] = X0 + i * SX;
        pos[p + 1] = GRID[j * (GX + 1) + i];
        pos[p + 2] = Z0 + j * SZ;
        p += 3;
      }
    }
    const idx: number[] = [];
    for (let j = 0; j < GZ; j++) {
      for (let i = 0; i < GX; i++) {
        const a = j * (GX + 1) + i;
        const b = a + 1;
        const c = a + GX + 1;
        const e = c + 1;
        idx.push(a, c, b, b, c, e);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, []);
  const uniforms = useMemo(() => {
    const look = TERRAIN_LOOK[mode];
    return {
      uLow: { value: new THREE.Color(look.low) },
      uHigh: { value: new THREE.Color(look.high) },
      uLine: { value: new THREE.Color(look.line) },
      uSun: { value: new THREE.Vector3(-0.7, 0.55, 0.45) },
      uFog: { value: new THREE.Color(fog.color) },
      uLight: { value: look.light },
      uLines: { value: look.lines },
      uFogNear: { value: fog.near },
      uFogFar: { value: fog.far },
    };
  }, [mode, fog.color, fog.near, fog.far]);
  return (
    <mesh geometry={geo}>
      <shaderMaterial
        key={mode}
        vertexShader={TERRAIN_VERT}
        fragmentShader={TERRAIN_FRAG}
        uniforms={uniforms}
      />
    </mesh>
  );
};

const LAKE_LOOK = {
  night: ["#2F93CC", "#1C73AB", "#145486"],
  day: ["#9EE3FF", "#3BA4E0", "#1F6FB5"],
  red: ["#E9A18C", "#A8402E", "#4E1410"],
};

/** Superficie del lago: disco con degradado radial (más claro en el centro). */
export const Lake: React.FC<{ look?: keyof typeof LAKE_LOOK }> = ({
  look = "night",
}) => {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    const [a, b, e] = LAKE_LOOK[look];
    g.addColorStop(0, a);
    g.addColorStop(0.45, b);
    g.addColorStop(1, e);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [look]);
  return (
    <mesh
      position={[CRATER[0], LAKE_Y, CRATER[1]]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <circleGeometry args={[LAKE_R + 0.12, 72]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
      {[0.8, 1.45, 2.0].map((r) => (
        <mesh key={r} position={[0, 0, 0.01]}>
          <ringGeometry args={[r - 0.012, r + 0.012, 72]} />
          <meshBasicMaterial
            color="#BFE6FF"
            transparent
            opacity={0.22}
            toneMapped={false}
          />
        </mesh>
      ))}
    </mesh>
  );
};

/** Ríos que salen de la brecha y marcan el fondo de los dos valles. */
export const Rivers: React.FC<{ color?: string; opacity?: number }> = ({
  color = "#2F78C4",
  opacity = 0.85,
}) => {
  const geo = useMemo(() => {
    const pos: number[] = [];
    const idx: number[] = [];
    for (let k = 0; k < 2; k++) {
      const start = pos.length / 3;
      let n = 0;
      for (let z = VALLEY_Z0 - 0.5; z <= VALLEY_Z1 + 1; z += 0.12) {
        const x = valleyX(z, k) + 0.1 * Math.sin(z * 2.3 + k * 2);
        const w = 0.05 + 0.012 * (z - VALLEY_Z0);
        for (const side of [-1, 1]) {
          const px = x + side * w;
          pos.push(px, groundY(px, z) + 0.035, z);
        }
        n++;
      }
      for (let i = 0; i < n - 1; i++) {
        const a = start + i * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    return g;
  }, []);
  return (
    <mesh geometry={geo}>
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

// --- Luces de las aldeas -----------------------------------------------------------------------

const LIGHTS = 1300;
/** Aldeas: posición a lo largo del valle (0 = junto al cráter, 1 = final). */
const CLUSTERS = [0.04, 0.15, 0.27, 0.39, 0.5, 0.62, 0.74, 0.86, 0.96];
const valleyZ = (t: number) =>
  mix(VALLEY_Z0 + 0.4, VALLEY_Z1, Math.min(1, Math.max(0, t)));

/** Posición fija de cada luz: racimos (aldeas) a lo largo de los dos valles. */
const lightSpot = (i: number): V3 => {
  const k = i % 2;
  const t =
    random(`lc${i}`) < 0.85
      ? CLUSTERS[Math.floor(random(`lk${i}`) * CLUSTERS.length)] +
        (random(`lj${i}`) + random(`lm${i}`) - 1) * 0.045
      : random(`lu${i}`);
  const z = valleyZ(t);
  const x =
    valleyX(z, k) +
    (random(`lx${i}`) + random(`ly${i}`) - 1) * valleyW(z) * 1.15;
  return [x, groundY(x, z) + 0.07, z];
};

/** 0 = encendida, 1 = apagada, según hasta dónde ha llegado la nube (`front`, en z). */
const deadAt = (front: number, z: number, jitter: number) =>
  smooth(0, 0.7, front - z - jitter);

/**
 * Luces de las casas y el resplandor de cada aldea. Las que quedan por detrás
 * del frente de la nube se apagan.
 */
export const VillageLights: React.FC<{
  frame: number;
  front: number;
  size?: number;
}> = ({ frame, front, size = 0.42 }) => {
  const geo = usePoints(LIGHTS, true);
  const spots = useMemo(
    () => new Array(LIGHTS).fill(0).map((_, i) => lightSpot(i)),
    [],
  );
  const pos = geo.attributes.position.array as Float32Array;
  const col = geo.attributes.color.array as Float32Array;
  for (let i = 0; i < LIGHTS; i++) {
    const s = spots[i];
    pos[i * 3] = s[0];
    pos[i * 3 + 1] = s[1];
    pos[i * 3 + 2] = s[2];
    const twinkle =
      0.72 + 0.28 * Math.sin(frame * 0.21 + random(`lt${i}`) * 40);
    const b =
      (0.55 + 0.75 * random(`lb${i}`)) *
      twinkle *
      (1 - deadAt(front, s[2], random(`ld${i}`) * 0.9));
    col[i * 3] = b;
    col[i * 3 + 1] = b * 0.62;
    col[i * 3 + 2] = b * 0.2;
  }
  geo.attributes.position.needsUpdate = true;
  geo.attributes.color.needsUpdate = true;
  return (
    <>
      <PointCloud geometry={geo} size={size} vertexColors />
      {[0, 1].flatMap((k) =>
        CLUSTERS.map((t, j) => {
          const z = valleyZ(t);
          const x = valleyX(z, k);
          return (
            <Glow
              key={`${k}-${j}`}
              position={[x, groundY(x, z) + 0.2, z]}
              size={2.1}
              color="#FF9A3C"
              opacity={0.3 * (1 - deadAt(front, z, 0.4))}
            />
          );
        }),
      )}
    </>
  );
};

/** Reflejo de la luna en el lago (sin prueba de profundidad: el disco del lago no lo corta). */
export const MoonGlint: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => (
  <Flare
    position={[CRATER[0] - 0.5, LAKE_Y + 0.05, CRATER[1] - 0.2]}
    size={0.9}
    color="#D8ECFF"
    opacity={0.4 * opacity}
  />
);

// --- Nube de gas -------------------------------------------------------------------------------

const BREACH_Z = VALLEY_Z0 - 0.4;

/**
 * Posición de una partícula de gas cuando va por `zeta` (coordenada z de su recorrido):
 * primero forma una cúpula sobre el lago, sale por la brecha y baja por su valle pegada al suelo.
 */
const gasSpot = (i: number, zeta: number, frame: number): V3 => {
  const k = i % 2;
  const u = random(`gu${i}`) + random(`gw${i}`) - 1;
  const v = random(`gv${i}`) ** 2;
  const wob = 0.07 * Math.sin(frame * 0.06 + i * 1.3);
  if (zeta < BREACH_Z) {
    const t = (zeta - CRATER[1]) / (BREACH_Z - CRATER[1]);
    const a = random(`ga${i}`) * Math.PI * 2;
    const rr = 2.0 * Math.sqrt(random(`gr${i}`));
    const x =
      mix(Math.cos(a) * rr, valleyX(BREACH_Z, k) + u * 0.5, t * t) + wob;
    const z = mix(CRATER[1] + Math.sin(a) * rr, BREACH_Z, t * t);
    const y = Math.max(groundY(x, z), LAKE_Y) + 0.1 + v * mix(1.0, 0.4, t);
    return [x, y, z];
  }
  const x = valleyX(zeta, k) + u * valleyW(zeta) * 0.95 + wob;
  return [x, groundY(x, zeta) + 0.1 + v * 0.42, zeta];
};

const useGas = (
  count: number,
  offset: number,
  frame: number,
  front: number,
) => {
  const geo = usePoints(count);
  const arr = geo.attributes.position.array as Float32Array;
  for (let i = 0; i < count; i++) {
    const id = i + offset;
    const zeta = mix(CRATER[1], front, random(`gq${id}`) ** 0.6);
    const p = gasSpot(id, zeta, frame);
    arr[i * 3] = p[0];
    arr[i * 3 + 1] = p[1];
    arr[i * 3 + 2] = p[2];
  }
  geo.attributes.position.needsUpdate = true;
  return geo;
};

/**
 * Nube de CO₂. `front` es la z hasta la que ha llegado. El CO₂ real es incoloro:
 * se dibuja blanco para poder verlo.
 */
export const GasCloud: React.FC<{
  frame: number;
  front: number;
  opacity?: number;
}> = ({ frame, front, opacity = 1 }) => {
  const body = useGas(3000, 0, frame, front);
  const wisps = useGas(500, 5000, frame, front);
  return (
    <>
      <PointCloud
        geometry={body}
        color="#E6F4FF"
        size={1.05}
        opacity={0.085 * opacity}
      />
      <PointCloud
        geometry={wisps}
        color="#FFFFFF"
        size={0.3}
        opacity={0.22 * opacity}
      />
    </>
  );
};

/** Columna de agua y espuma de la erupción. `age` = fotogramas desde que empieza. No está a escala. */
export const WaterColumn: React.FC<{ age: number; height?: number }> = ({
  age,
  height = COLUMN_H,
}) => {
  const count = 900;
  const geo = usePoints(count);
  const arr = geo.attributes.position.array as Float32Array;
  for (let i = 0; i < count; i++) {
    const t = (age - random(`ws${i}`) * 26) / (34 + random(`wl${i}`) * 22);
    if (t < 0 || t > 1) {
      arr[i * 3 + 1] = -60;
      continue;
    }
    const ang = random(`wa${i}`) * Math.PI * 2;
    const r = (0.12 + 0.6 * random(`wr${i}`)) * t * 1.7;
    const peak = height * (0.5 + 0.5 * random(`wp${i}`));
    arr[i * 3] = CRATER[0] + Math.cos(ang) * r;
    arr[i * 3 + 1] = LAKE_Y + 4 * peak * t * (1 - t);
    arr[i * 3 + 2] = CRATER[1] + Math.sin(ang) * r;
  }
  geo.attributes.position.needsUpdate = true;
  const burst = Math.exp(-Math.max(0, age) / 22);
  return (
    <>
      <PointCloud geometry={geo} color="#EAF6FF" size={0.36} opacity={0.5} />
      <Flare
        position={[CRATER[0], LAKE_Y + 0.4, CRATER[1]]}
        size={1.5 + 4.5 * burst}
        color="#DFF1FF"
        opacity={age < 0 ? 0 : 0.35 + 0.6 * burst}
      />
      {[0, 14].map((delay) => {
        const k = Math.min(1, Math.max(0, (age - delay) / 46));
        return (
          <mesh
            key={delay}
            position={[CRATER[0], LAKE_Y + 0.02, CRATER[1]]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[LAKE_R * k * 0.96, LAKE_R * k, 72]} />
            <meshBasicMaterial
              color="#FFFFFF"
              transparent
              opacity={k > 0 ? 0.75 * (1 - k) : 0}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </>
  );
};

/** Chorro de una tubería de desgasificación sobre su balsa. No está a escala. */
export const Jet: React.FC<{
  position: V3;
  height: number;
  frame: number;
  seed: string;
}> = ({ position, height, frame, seed }) => {
  const count = 260;
  const geo = usePoints(count);
  const arr = geo.attributes.position.array as Float32Array;
  for (let i = 0; i < count; i++) {
    const t = ((frame + random(`${seed}o${i}`) * 44) / 44) % 1;
    const ang = random(`${seed}a${i}`) * Math.PI * 2;
    const up = Math.min(1, t / 0.5);
    const fall = Math.max(0, (t - 0.5) / 0.5);
    const r =
      0.03 + 0.42 * height * fall * (0.3 + 0.7 * random(`${seed}r${i}`));
    arr[i * 3] = position[0] + Math.cos(ang) * r;
    arr[i * 3 + 1] = position[1] + height * (up ** 0.7 - 0.85 * fall * fall);
    arr[i * 3 + 2] = position[2] + Math.sin(ang) * r;
  }
  geo.attributes.position.needsUpdate = true;
  return (
    <>
      <PointCloud geometry={geo} color="#FFFFFF" size={0.2} opacity={0.75} />
      <mesh position={[position[0], position[1] + 0.03, position[2]]}>
        <boxGeometry args={[0.34, 0.05, 0.34]} />
        <meshStandardMaterial color="#5B4630" roughness={0.8} />
      </mesh>
    </>
  );
};

// --- Botella de refresco -----------------------------------------------------------------------

const lathe = (profile: [number, number][]) =>
  new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    56,
  );
const GLASS: [number, number][] = [
  [0, 0],
  [0.5, 0],
  [0.56, 0.07],
  [0.56, 1.45],
  [0.52, 1.7],
  [0.3, 2.3],
  [0.2, 2.55],
  [0.2, 2.95],
  [0.235, 2.98],
  [0.235, 3.08],
  [0.2, 3.1],
];
const DRINK: [number, number][] = [
  [0, 0.06],
  [0.5, 0.06],
  [0.52, 0.12],
  [0.52, 1.45],
  [0.48, 1.68],
  [0.27, 2.26],
  [0.17, 2.5],
  [0.17, 2.6],
  [0, 2.6],
];
/** Radio interior aproximado de la botella a una altura. */
const drinkR = (y: number) =>
  y < 1.5 ? 0.46 : mix(0.46, 0.14, (y - 1.5) / 1.0);
export const BOTTLE_MOUTH = 3.1;
/** Altura (en unidades de escena) con la que se dibuja la columna de agua. */
export const COLUMN_H = 2.6;

/**
 * Botella de refresco. `shake` 0-1 la hace vibrar; `open` son los fotogramas desde que
 * salta el tapón (negativo = cerrada).
 */
export const Bottle: React.FC<{
  frame: number;
  shake: number;
  open: number;
}> = ({ frame, shake, open }) => {
  const glass = useMemo(() => lathe(GLASS), []);
  const drink = useMemo(() => lathe(DRINK), []);
  const label = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 256;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#F7F3EA";
    ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = "#E23B4E";
    ctx.fillRect(0, 0, 1024, 34);
    ctx.fillRect(0, 222, 1024, 34);
    ctx.fillStyle = "#1B1B24";
    ctx.font = "900 150px Inter, DejaVu Sans, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("CO₂", 256, 132);
    ctx.fillText("CO₂", 768, 132);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const fizz = open >= 0 ? 1 : 0.12 + 0.5 * shake;
  const bubbles = usePoints(150);
  const ba = bubbles.attributes.position.array as Float32Array;
  for (let i = 0; i < 150; i++) {
    const y =
      0.12 +
      ((random(`by${i}`) * 2.4 + frame * 0.012 * (0.5 + fizz * 3)) % 2.4);
    const a = random(`ba${i}`) * Math.PI * 2;
    const r = drinkR(y) * Math.sqrt(random(`br${i}`)) * 0.92;
    ba[i * 3] = Math.cos(a) * r;
    ba[i * 3 + 1] = y;
    ba[i * 3 + 2] = Math.sin(a) * r;
  }
  bubbles.attributes.position.needsUpdate = true;
  const foamN = 520;
  const foam = usePoints(foamN);
  const fa = foam.attributes.position.array as Float32Array;
  for (let i = 0; i < foamN; i++) {
    const t = (open - random(`fs${i}`) * 6) / (11 + random(`fl${i}`) * 12);
    if (open < 0 || t < 0 || t > 1) {
      fa[i * 3 + 1] = -60;
      continue;
    }
    const a = random(`fa${i}`) * Math.PI * 2;
    const r = (0.05 + 0.85 * random(`fr${i}`) ** 1.4) * t * 2.6;
    fa[i * 3] = Math.cos(a) * r;
    fa[i * 3 + 1] =
      BOTTLE_MOUTH + (3.2 + 3.2 * random(`fv${i}`)) * t * (1.15 - 0.35 * t);
    fa[i * 3 + 2] = Math.sin(a) * r;
  }
  foam.attributes.position.needsUpdate = true;
  const o = Math.max(0, open);
  return (
    <group
      position={[Math.sin(frame * 2.3) * 0.035 * shake, 0, 0]}
      rotation={[0, 0, Math.sin(frame * 1.9) * 0.045 * shake]}
    >
      <mesh geometry={drink}>
        <meshStandardMaterial
          color="#FF8A1E"
          emissive="#FF5A00"
          emissiveIntensity={0.45}
          roughness={0.3}
          transparent
          opacity={0.92}
        />
      </mesh>
      <PointCloud
        geometry={bubbles}
        color="#FFF3D6"
        size={0.07}
        opacity={0.9}
      />
      <mesh position={[0, 0.98, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <cylinderGeometry args={[0.566, 0.566, 0.6, 56, 1, true]} />
        <meshStandardMaterial map={label} roughness={0.6} />
      </mesh>
      <mesh geometry={glass}>
        <meshPhysicalMaterial
          color="#DDFBF0"
          transparent
          opacity={0.2}
          roughness={0.04}
          clearcoat={1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh
        position={[0.05 * o, BOTTLE_MOUTH + 0.03 + 0.34 * o - 0.006 * o * o, 0]}
        rotation={[0, 0, -0.3 * o]}
      >
        <cylinderGeometry args={[0.26, 0.25, 0.12, 40]} />
        <meshStandardMaterial
          color="#E23B4E"
          metalness={0.65}
          roughness={0.3}
        />
      </mesh>
      <PointCloud geometry={foam} color="#FFFFFF" size={0.34} opacity={0.6} />
      <Flare
        position={[0, BOTTLE_MOUTH + 0.2, 0]}
        size={open >= 0 ? 0.6 + 1.6 * Math.exp(-open / 5) : 0}
        color="#FFFFFF"
        opacity={open >= 0 ? 0.8 * Math.exp(-open / 6) : 0}
      />
    </group>
  );
};

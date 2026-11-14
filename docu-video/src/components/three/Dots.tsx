import { geoEquirectangular, geoPath } from "d3-geo";
import React, { useMemo } from "react";
import * as THREE from "three";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import countries110 from "world-atlas/countries-110m.json";
import land110 from "world-atlas/land-110m.json";
import { latLon } from "../Globe3D";
import { Glow, useGlowTexture } from "./Stage";

const LAND = land110 as unknown as Topology;
const COUNTRIES = countries110 as unknown as Topology;

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

// --- Tierra de puntos --------------------------------------------------------------------------

export type LandDots = {
  count: number;
  positions: Float32Array;
  lat: Float32Array;
  lon: Float32Array;
  /** 1 si el punto cae dentro de alguno de los países resaltados. */
  hi: Uint8Array;
};

/**
 * Muestrea la tierra firme (Natural Earth) en una rejilla casi uniforme sobre la esfera.
 * `highlight`: nombres de país en inglés tal como vienen en world-atlas (p. ej. "Cameroon").
 */
export const useLandDots = (step = 1.5, highlight: string[] = []): LandDots =>
  useMemo(() => {
    const w = 1440;
    const h = 720;
    const proj = geoEquirectangular()
      .scale(w / (2 * Math.PI))
      .translate([w / 2, h / 2]);
    const mask = (draw: (ctx: CanvasRenderingContext2D) => void) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      ctx.beginPath();
      draw(ctx);
      ctx.fillStyle = "#FFF";
      ctx.fill();
      return ctx.getImageData(0, 0, w, h).data;
    };
    const land = mask((ctx) =>
      geoPath(proj, ctx)(feature(LAND, LAND.objects.land)),
    );
    const all = feature(COUNTRIES, COUNTRIES.objects.countries) as unknown as {
      features: { properties: { name: string } }[];
    };
    const chosen = all.features.filter((f) =>
      highlight.includes(f.properties.name),
    );
    const marked = chosen.length
      ? mask((ctx) => {
          const path = geoPath(proj, ctx);
          chosen.forEach((f) => path(f as never));
        })
      : null;
    const pos: number[] = [];
    const lats: number[] = [];
    const lons: number[] = [];
    const his: number[] = [];
    for (let lat = -56; lat <= 82; lat += step) {
      const dl = step / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
      for (let lon = -180; lon < 180; lon += dl) {
        const x = Math.min(w - 1, Math.floor(((lon + 180) / 360) * w));
        const y = Math.min(h - 1, Math.floor(((90 - lat) / 180) * h));
        if (land[(y * w + x) * 4] > 128) {
          pos.push(...latLon(lat, lon, 1));
          lats.push(lat);
          lons.push(lon);
          his.push(marked && marked[(y * w + x) * 4] > 128 ? 1 : 0);
        }
      }
    }
    return {
      count: lats.length,
      positions: new Float32Array(pos),
      lat: new Float32Array(lats),
      lon: new Float32Array(lons),
      hi: new Uint8Array(his),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, highlight.join("|")]);

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

/** Geometría solo con los puntos de los países resaltados (para dibujarlos más grandes). */
export const useHighlightGeometry = (dots: LandDots) =>
  useMemo(() => {
    const pos: number[] = [];
    for (let i = 0; i < dots.count; i++)
      if (dots.hi[i]) pos.push(...dots.positions.subarray(i * 3, i * 3 + 3));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
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

// --- De 3D a píxeles ---------------------------------------------------------------------------

/** Proyecta un punto 3D a píxeles con la misma cámara que <Stage> (para rótulos 2D). */
export const project = (
  p: V3,
  cam: V3,
  target: V3,
  fov: number,
  width = 1080,
  height = 1920,
) => {
  const c = new THREE.PerspectiveCamera(fov, width / height, 0.01, 500);
  c.position.set(...cam);
  c.lookAt(...target);
  c.updateMatrixWorld();
  const v = new THREE.Vector3(...p).project(c);
  return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height };
};

/**
 * Posición en el mundo de una latitud/longitud sobre un globo de radio `r` centrado en `center`,
 * girado `rotY` sobre su eje y luego inclinado `tilt` hacia la cámara.
 */
export const globePoint = (
  lat: number,
  lon: number,
  tilt: number,
  rotY: number,
  center: V3,
  r: number,
): V3 => {
  const v = new THREE.Vector3(...latLon(lat, lon, r))
    .applyEuler(new THREE.Euler(0, rotY, 0))
    .applyEuler(new THREE.Euler(tilt, 0, 0));
  return [v.x + center[0], v.y + center[1], v.z + center[2]];
};

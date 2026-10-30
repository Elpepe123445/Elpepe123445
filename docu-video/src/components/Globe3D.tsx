import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { geoEquirectangular, geoGraticule10, geoPath } from "d3-geo";
import React, { useMemo } from "react";
import { useVideoConfig } from "remotion";
import * as THREE from "three";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import countries50 from "world-atlas/countries-50m.json";
import land50 from "world-atlas/land-50m.json";

const LAND = land50 as unknown as Topology;
const COUNTRIES = countries50 as unknown as Topology;

/** Vector unitario en la esfera para una latitud/longitud (coincide con el mapeo UV de SphereGeometry). */
export const latLon = (
  lat: number,
  lon: number,
  r = 1,
): [number, number, number] => {
  const phi = ((lon + 180) * Math.PI) / 180;
  const la = (lat * Math.PI) / 180;
  return [
    -Math.cos(phi) * Math.cos(la) * r,
    Math.sin(la) * r,
    Math.sin(phi) * Math.cos(la) * r,
  ];
};

/** Rotación Y que pone la longitud `lon` de cara a la cámara. */
export const faceLon = (lon: number) =>
  Math.PI / 2 - ((lon + 180) * Math.PI) / 180;

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

/** Textura estilizada a partir de Natural Earth (dominio público): océano, graticula, tierra por latitud. */
const useEarthTextures = (highlightIds: string[]) =>
  useMemo(() => {
    const w = 4096;
    const h = 2048;
    const proj = geoEquirectangular()
      .scale(w / (2 * Math.PI))
      .translate([w / 2, h / 2]);

    const base = makeCanvas(w, h);
    const ctx = base.getContext("2d")!;
    const path = geoPath(proj, ctx);
    const ocean = ctx.createLinearGradient(0, 0, 0, h);
    ocean.addColorStop(0, "#0A2140");
    ocean.addColorStop(0.5, "#0F3966");
    ocean.addColorStop(1, "#0A2140");
    ctx.fillStyle = ocean;
    ctx.fillRect(0, 0, w, h);
    ctx.beginPath();
    path(geoGraticule10());
    ctx.strokeStyle = "rgba(140,190,240,0.13)";
    ctx.lineWidth = 2;
    ctx.stroke();

    const land = feature(LAND, LAND.objects.land);
    const tint = ctx.createLinearGradient(0, 0, 0, h);
    [
      [0, "#EEF2F4"],
      [0.11, "#E6ECEF"],
      [0.2, "#6F8458"],
      [0.33, "#B49A64"],
      [0.42, "#C9A86C"],
      [0.5, "#6E8A4E"],
      [0.6, "#B49A64"],
      [0.72, "#7A8C5C"],
      [0.86, "#E6ECEF"],
      [1, "#EEF2F4"],
    ].forEach(([o, c]) => tint.addColorStop(o as number, c as string));
    ctx.beginPath();
    path(land);
    ctx.fillStyle = tint;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,240,205,0.55)";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Capa aparte (transparente) con los países a resaltar: su opacidad se anima sin regenerar texturas.
    const hi = makeCanvas(w, h);
    const hctx = hi.getContext("2d")!;
    const hpath = geoPath(proj, hctx);
    const countries = feature(
      COUNTRIES,
      COUNTRIES.objects.countries,
    ) as unknown as GeoJSON.FeatureCollection;
    countries.features
      .filter((f) => highlightIds.includes(String(f.id)))
      .forEach((f) => {
        hctx.beginPath();
        hpath(f);
        hctx.fillStyle = "rgba(244,183,64,0.85)";
        hctx.fill();
        hctx.strokeStyle = "#FFE7A8";
        hctx.lineWidth = 4;
        hctx.stroke();
      });

    const toTex = (c: HTMLCanvasElement) => {
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      return t;
    };
    return { base: toTex(base), highlight: toTex(hi) };
  }, [highlightIds]);

const glowShader = {
  vertexShader: `varying vec3 vNormal;
    void main(){ vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `varying vec3 vNormal; uniform vec3 color; uniform float strength;
    void main(){ float i = pow(max(0.0, 0.68 - dot(vNormal, vec3(0.0,0.0,1.0))), 3.6) * strength; gl_FragColor = vec4(color, 1.0) * i; }`,
};

const CameraRig3D: React.FC<{ z: number; x: number; y: number }> = ({
  z,
  x,
  y,
}) => {
  const { camera } = useThree();
  camera.position.set(x, y, z);
  camera.lookAt(x, y, 0);
  camera.updateProjectionMatrix();
  return null;
};

export type GlobeProps = {
  /** Rotación de la Tierra (rad) sobre su eje. */
  spin: number;
  /** Inclinación hacia la cámara (rad): positivo muestra el hemisferio norte. */
  tilt?: number;
  cameraZ?: number;
  cameraX?: number;
  cameraY?: number;
  /** 0→1: intensidad del resaltado de `highlight` (códigos ISO numéricos de Natural Earth). */
  highlight?: string[];
  highlightAmount?: number;
  /** Elementos 3D adicionales que giran con la Tierra (marcadores, arcos…). */
  surface?: React.ReactNode;
  /** Elementos 3D fijos respecto a la cámara (órbitas…). */
  space?: React.ReactNode;
  opacity?: number;
};

const EGYPT = ["818"];

export const Globe3D: React.FC<GlobeProps> = ({
  spin,
  tilt = 0.35,
  cameraZ = 4,
  cameraX = 0,
  cameraY = 0,
  highlight = EGYPT,
  highlightAmount = 0,
  surface,
  space,
  opacity = 1,
}) => {
  const { width, height } = useVideoConfig();
  const tex = useEarthTextures(highlight);
  const glowUniforms = useMemo(
    () => ({
      color: { value: new THREE.Color("#6FC3FF") },
      strength: { value: 0.85 },
    }),
    [],
  );
  return (
    <ThreeCanvas
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, opacity }}
      camera={{ fov: 30, near: 0.1, far: 100, position: [0, 0, cameraZ] }}
    >
      <CameraRig3D z={cameraZ} x={cameraX} y={cameraY} />
      <ambientLight intensity={0.18} />
      <directionalLight
        position={[-4, 1.5, 3]}
        intensity={2.6}
        color="#FFF4E0"
      />
      <group rotation={[tilt, 0, 0]}>
        <group rotation={[0, spin, 0]}>
          <mesh>
            <sphereGeometry args={[1, 128, 128]} />
            <meshStandardMaterial
              map={tex.base}
              roughness={0.85}
              metalness={0}
            />
          </mesh>
          <mesh>
            <sphereGeometry args={[1.002, 128, 128]} />
            <meshBasicMaterial
              map={tex.highlight}
              transparent
              opacity={highlightAmount}
              depthWrite={false}
            />
          </mesh>
          {surface}
        </group>
      </group>
      <mesh scale={1.11}>
        <sphereGeometry args={[1, 64, 64]} />
        <shaderMaterial
          args={[glowShader]}
          uniforms={glowUniforms}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          transparent
          depthWrite={false}
        />
      </mesh>
      {space}
    </ThreeCanvas>
  );
};

/** Marcador pulsante sobre la superficie (anillo + punto) en lat/lon. */
export const SurfaceMarker: React.FC<{
  lat: number;
  lon: number;
  pulse: number;
  amount: number;
  color?: string;
}> = ({ lat, lon, pulse, amount, color = "#F4B740" }) => {
  const pos = latLon(lat, lon, 1.004);
  const normal = new THREE.Vector3(...pos).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    normal,
  );
  return (
    <group position={pos} quaternion={quat} scale={amount}>
      <mesh>
        <circleGeometry args={[0.018, 32]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh scale={1 + pulse * 3}>
        <ringGeometry args={[0.03, 0.036, 64]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={(1 - pulse) * 0.9}
        />
      </mesh>
    </group>
  );
};

/**
 * Frente de onda sobre la esfera: círculo a una distancia angular `angle` (rad) de un punto.
 * `angle` 0→π recorre el planeta hasta las antípodas (una vuelta completa = ida y regreso).
 */
export const WaveRing: React.FC<{
  lat: number;
  lon: number;
  angle: number;
  color?: string;
  opacity?: number;
}> = ({ lat, lon, angle, color = "#FFE1A8", opacity = 1 }) => {
  const dir = new THREE.Vector3(...latLon(lat, lon)).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    dir,
  );
  const r = Math.max(0.001, Math.sin(angle)) * 1.012;
  const pos = dir.clone().multiplyScalar(Math.cos(angle) * 1.012);
  return (
    <mesh position={pos} quaternion={quat}>
      <torusGeometry args={[r, 0.008, 8, 160]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} />
    </mesh>
  );
};

/** Anillo que se dibuja progresivamente (p. ej. medición del ecuador). */
export const ArcRing: React.FC<{
  radius: number;
  progress: number;
  color?: string;
  tube?: number;
  rotation?: [number, number, number];
  opacity?: number;
}> = ({
  radius,
  progress,
  color = "#4FD1E8",
  tube = 0.004,
  rotation = [Math.PI / 2, 0, 0],
  opacity = 1,
}) =>
  progress <= 0 ? null : (
    <mesh rotation={rotation}>
      <torusGeometry
        args={[radius, tube, 8, 256, Math.PI * 2 * Math.min(1, progress)]}
      />
      <meshBasicMaterial color={color} transparent opacity={opacity} />
    </mesh>
  );

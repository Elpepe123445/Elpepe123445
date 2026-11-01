import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import React, { useMemo } from "react";
import { random, useVideoConfig } from "remotion";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/** Reflejos realistas sin archivos HDR: entorno de estudio generado por Three.js (una vez por pestaña). */
const StudioEnvironment: React.FC<{ intensity: number }> = ({ intensity }) => {
  const { gl, scene } = useThree();
  useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = intensity;
    pmrem.dispose();
  }, [gl, scene, intensity]);
  return null;
};

const CameraRig: React.FC<{
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}> = ({ position, target, fov }) => {
  const { camera } = useThree();
  camera.position.set(...position);
  camera.lookAt(...target);
  (camera as THREE.PerspectiveCamera).fov = fov;
  camera.updateProjectionMatrix();
  return null;
};

export type StageProps = {
  camera: [number, number, number];
  target?: [number, number, number];
  fov?: number;
  /** Intensidad del entorno de estudio (reflejos). */
  env?: number;
  /** Luz principal cálida y luz de contorno fría: el "look" de producto 3D. */
  keyColor?: string;
  rimColor?: string;
  fog?: { color: string; near: number; far: number };
  opacity?: number;
  children: React.ReactNode;
};

/** Escenario 3D para Remotion: cámara controlada por fotograma, entorno PBR, luces y niebla. */
export const Stage: React.FC<StageProps> = ({
  camera,
  target = [0, 0, 0],
  fov = 35,
  env = 0.9,
  keyColor = "#FFF1DD",
  rimColor = "#7FC8FF",
  fog,
  opacity = 1,
  children,
}) => {
  const { width, height } = useVideoConfig();
  return (
    <ThreeCanvas
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, opacity }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      camera={{ fov, near: 0.01, far: 500, position: camera }}
    >
      <CameraRig position={camera} target={target} fov={fov} />
      <StudioEnvironment intensity={env} />
      {fog ? <fog attach="fog" args={[fog.color, fog.near, fog.far]} /> : null}
      <ambientLight intensity={0.15} />
      <directionalLight position={[4, 6, 5]} intensity={2.2} color={keyColor} />
      <directionalLight
        position={[-6, 2, -4]}
        intensity={2.4}
        color={rimColor}
      />
      <pointLight
        position={[0, -4, 3]}
        intensity={6}
        distance={20}
        color="#B48CFF"
      />
      {children}
    </ThreeCanvas>
  );
};

/** Textura de brillo radial (para partículas y halos con mezcla aditiva). */
export const useGlowTexture = (
  inner = "rgba(255,255,255,1)",
  outer = "rgba(255,255,255,0)",
) =>
  useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, inner);
    g.addColorStop(0.25, inner.replace(/[\d.]+\)$/, "0.55)"));
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [inner, outer]);

/** Halo luminoso (sprite aditivo). */
export const Glow: React.FC<{
  position?: [number, number, number];
  size: number;
  color: string;
  opacity?: number;
}> = ({ position = [0, 0, 0], size, color, opacity = 1 }) => {
  const tex = useGlowTexture();
  return (
    <sprite position={position} scale={[size, size, size]}>
      <spriteMaterial
        map={tex}
        color={color}
        transparent
        opacity={opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </sprite>
  );
};

/** Polvo/bokeh de fondo: puntos con atenuación por distancia (sensación de profundidad). */
export const Bokeh: React.FC<{
  count?: number;
  spread?: number;
  color?: string;
  size?: number;
  drift?: number;
  frame: number;
  seed?: string;
}> = ({
  count = 400,
  spread = 30,
  color = "#9FB8FF",
  size = 0.25,
  drift = 0.002,
  frame,
  seed = "bokeh",
}) => {
  const tex = useGlowTexture();
  const geo = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (random(`${seed}x${i}`) - 0.5) * spread;
      pos[i * 3 + 1] = (random(`${seed}y${i}`) - 0.5) * spread * 1.6;
      pos[i * 3 + 2] = -random(`${seed}z${i}`) * spread;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, [count, spread, seed]);
  return (
    <points geometry={geo} rotation={[0, frame * drift, 0]}>
      <pointsMaterial
        map={tex}
        color={color}
        size={size}
        sizeAttenuation
        transparent
        opacity={0.55}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};

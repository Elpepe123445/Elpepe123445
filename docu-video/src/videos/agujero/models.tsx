import React, { useMemo } from "react";
import { random } from "remotion";
import * as THREE from "three";
import { useGlowTexture } from "../../components/three/Stage";

export const B = {
  bg: "#020208",
  accent: "#FFB44A",
  hot: "#FFE9B8",
  cyan: "#8FD8FF",
};

/**
 * Disco de acreción procedimental: bandas turbulentas que giran más rápido por dentro
 * (rotación diferencial), color por temperatura y efecto Doppler (un lado más brillante).
 * Todo se calcula a partir de `uTime`, que viene del fotograma: render determinista.
 */
const diskShader = {
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    varying vec3 vPos;
    void main() { vUv = uv; vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform float uTime; uniform float uInner; uniform float uOuter; uniform float uIntensity;
    varying vec3 vPos;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
    float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
    void main() {
      float r = length(vPos.xy);
      float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
      float ang = atan(vPos.y, vPos.x);
      float spin = uTime * (1.6 / pow(r, 1.5));
      float bands = fbm(vec2(ang * 3.0 + spin * 3.0, r * 2.2)) * 0.75 + fbm(vec2(ang * 9.0 + spin * 5.0, r * 7.0)) * 0.35;
      vec3 hot = vec3(1.0, 0.95, 0.85), mid = vec3(1.0, 0.62, 0.22), cool = vec3(0.65, 0.12, 0.05);
      vec3 col = mix(hot, mid, smoothstep(0.0, 0.35, t));
      col = mix(col, cool, smoothstep(0.35, 1.0, t));
      float doppler = 1.0 + 0.75 * cos(ang - 0.6);
      float edge = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.7, 1.0, t));
      float a = edge * (0.35 + bands) * doppler * uIntensity;
      gl_FragColor = vec4(col * a, a);
    }`,
};

export const AccretionDisk: React.FC<{
  time: number;
  inner?: number;
  outer?: number;
  intensity?: number;
}> = ({ time, inner = 1.6, outer = 6.5, intensity = 1 }) => {
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uInner: { value: inner },
      uOuter: { value: outer },
      uIntensity: { value: intensity },
    }),
    [inner, outer, intensity],
  );
  uniforms.uTime.value = time;
  uniforms.uIntensity.value = intensity;
  const geo = useMemo(
    () => new THREE.RingGeometry(inner, outer, 256, 8),
    [inner, outer],
  );
  return (
    <mesh geometry={geo}>
      <shaderMaterial
        args={[diskShader]}
        uniforms={uniforms}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

/** Agujero negro: sombra negra, anillo de fotones y disco (más su imagen curvada por la lente). */
export const BlackHole: React.FC<{
  time: number;
  tilt?: number;
  diskIntensity?: number;
  ring?: number;
}> = ({ time, tilt = 1.33, diskIntensity = 1, ring = 1 }) => (
  <group>
    <mesh>
      <sphereGeometry args={[1, 64, 64]} />
      <meshBasicMaterial color="#000000" />
    </mesh>
    {/* disco casi de canto */}
    <group rotation={[tilt, 0, 0.08]}>
      <AccretionDisk time={time} intensity={diskIntensity} />
    </group>
    {/* imagen "lenteada" del disco, que asoma por encima y por debajo de la sombra (efecto tipo Gargantúa) */}
    <group position={[0, 0, -0.4]} rotation={[0, 0, 0.08]} scale={[1, 0.62, 1]}>
      <AccretionDisk
        time={time * 0.9}
        inner={1.12}
        outer={2.4}
        intensity={diskIntensity * 0.7}
      />
    </group>
    <mesh position={[0, 0, 0.02]}>
      <torusGeometry args={[1.07, 0.012 * ring + 0.004, 12, 160]} />
      <meshBasicMaterial
        color={B.hot}
        transparent
        opacity={0.85 * ring}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  </group>
);

/** Cielo de estrellas con la banda de la Vía Láctea; algunas convertidas en arcos por la lente. */
export const StarSky: React.FC<{
  frame: number;
  arcs?: number;
  radius?: number;
}> = ({ frame, arcs = 0, radius = 60 }) => {
  const tex = useGlowTexture();
  const geo = useMemo(() => {
    const n = 2600;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const band = i % 3 === 0;
      const u = random(`su${i}`) * Math.PI * 2;
      const v = band
        ? (random(`sv${i}`) - 0.5) * 0.35
        : Math.acos(2 * random(`sv${i}`) - 1) - Math.PI / 2;
      pos[i * 3] = Math.cos(v) * Math.cos(u) * radius;
      pos[i * 3 + 1] = Math.sin(v) * radius;
      pos[i * 3 + 2] = Math.cos(v) * Math.sin(u) * radius;
      const warm = random(`sc${i}`);
      col[i * 3] = 0.8 + warm * 0.2;
      col[i * 3 + 1] = 0.82 + (1 - warm) * 0.1;
      col[i * 3 + 2] = 0.9 + (1 - warm) * 0.1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, [radius]);
  return (
    <group rotation={[0.4, frame * 0.0006, 0.3]}>
      <points geometry={geo}>
        <pointsMaterial
          map={tex}
          size={0.55}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
      {arcs > 0
        ? new Array(14).fill(0).map((_, i) => (
            <mesh
              key={i}
              rotation={[
                -0.4,
                -frame * 0.0006,
                (i / 14) * Math.PI * 2 + frame * 0.002,
              ]}
              position={[0, 0, 0]}
            >
              <torusGeometry
                args={[
                  1.25 + random(`ar${i}`) * 1.8,
                  0.008,
                  6,
                  64,
                  0.4 + random(`al${i}`) * 0.9,
                ]}
              />
              <meshBasicMaterial
                color="#FFFFFF"
                transparent
                opacity={arcs * (0.4 + random(`ao${i}`) * 0.5)}
                blending={THREE.AdditiveBlending}
              />
            </mesh>
          ))
        : null}
    </group>
  );
};

/** Astronauta sencillo (traje blanco, visor dorado). `stretch` lo alarga como un fideo. */
export const Astronaut: React.FC<{
  stretch?: number;
  tint?: string;
  opacity?: number;
}> = ({ stretch = 0, tint = "#F2F4F8", opacity = 1 }) => {
  const sy = 1 + stretch * 4;
  const sx = 1 / Math.sqrt(sy);
  const mat = (
    <meshPhysicalMaterial
      color={tint}
      roughness={0.5}
      clearcoat={0.4}
      transparent
      opacity={opacity}
    />
  );
  return (
    <group scale={[sx, sy, sx]}>
      <mesh position={[0, 0.25, 0]}>
        <capsuleGeometry args={[0.28, 0.5, 8, 16]} />
        {mat}
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <sphereGeometry args={[0.24, 32, 32]} />
        {mat}
      </mesh>
      <mesh position={[0, 0.86, 0.13]} scale={[1, 0.8, 0.6]}>
        <sphereGeometry args={[0.17, 32, 32]} />
        <meshPhysicalMaterial
          color="#E9A93A"
          metalness={1}
          roughness={0.12}
          transparent
          opacity={opacity}
        />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.4, 0.3, 0]} rotation={[0, 0, s * 0.4]}>
            <capsuleGeometry args={[0.09, 0.45, 6, 12]} />
            {mat}
          </mesh>
          <mesh position={[s * 0.14, -0.38, 0]}>
            <capsuleGeometry args={[0.1, 0.5, 6, 12]} />
            {mat}
          </mesh>
        </group>
      ))}
    </group>
  );
};

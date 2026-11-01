import React, { useMemo } from "react";
import { random } from "remotion";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Glow, useGlowTexture } from "../../components/three/Stage";

/** Paleta del video: noche violeta, cian eléctrico, magenta y ámbar. */
export const V = {
  bg: "radial-gradient(ellipse at 50% 32%, #22184A 0%, #0B0820 55%, #05040F 100%)",
  cyan: "#7FE7FF",
  magenta: "#FF5FD2",
  amber: "#FFC26B",
  white: "#F4F1FF",
  muted: "#A9A3C9",
};

/** Nube de puntos animable: las posiciones se recalculan en cada fotograma (determinista). */
export const usePoints = (count: number) =>
  useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(count * 3), 3),
    );
    return g;
  }, [count]);

export const PointCloud: React.FC<{
  geometry: THREE.BufferGeometry;
  color: string;
  size: number;
  opacity?: number;
}> = ({ geometry, color, size, opacity = 1 }) => {
  const tex = useGlowTexture();
  return (
    <points geometry={geometry}>
      <pointsMaterial
        map={tex}
        color={color}
        size={size}
        sizeAttenuation
        transparent
        opacity={opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};

/** Cubito de azúcar: caja redondeada con acabado mate cristalino. */
export const SugarCube: React.FC<{ size: number; opacity: number }> = ({
  size,
  opacity,
}) => {
  const geo = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 6, 0.08), []);
  return (
    <group scale={size}>
      <mesh geometry={geo}>
        <meshPhysicalMaterial
          color="#FFFFFF"
          roughness={0.55}
          clearcoat={0.6}
          clearcoatRoughness={0.4}
          sheen={1}
          sheenColor="#FFE8F4"
          transparent
          opacity={opacity}
        />
      </mesh>
      {new Array(18).fill(0).map((_, i) => (
        <mesh
          key={i}
          position={[
            (random(`sx${i}`) - 0.5) * 1.02,
            (random(`sy${i}`) - 0.5) * 1.02,
            0.505,
          ]}
          scale={0.03 + random(`ss${i}`) * 0.04}
        >
          <octahedronGeometry args={[1, 0]} />
          <meshPhysicalMaterial
            color="#FFFFFF"
            metalness={0.1}
            roughness={0.05}
            clearcoat={1}
            transparent
            opacity={opacity}
          />
        </mesh>
      ))}
    </group>
  );
};

/** Célula: membrana translúcida rosada con núcleo interior. */
export const Cell: React.FC<{
  position: [number, number, number];
  r: number;
  opacity: number;
  seed: number;
}> = ({ position, r, opacity, seed }) => (
  <group position={position}>
    <mesh scale={[r, r * (0.85 + random(`c${seed}`) * 0.2), r]}>
      <sphereGeometry args={[1, 48, 48]} />
      <meshPhysicalMaterial
        color="#FF8FB1"
        roughness={0.35}
        clearcoat={0.7}
        sheen={1}
        sheenColor="#FFD0E0"
        transparent
        opacity={0.72 * opacity}
      />
    </mesh>
    <mesh position={[r * 0.15, r * 0.1, r * 0.2]} scale={r * 0.38}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshPhysicalMaterial
        color="#9C2D6B"
        roughness={0.3}
        clearcoat={0.8}
        transparent
        opacity={opacity}
      />
    </mesh>
  </group>
);

/** Molécula de agua (bolas y varillas). */
export const Water: React.FC<{
  position: [number, number, number];
  rotation: [number, number, number];
  opacity: number;
}> = ({ position, rotation, opacity }) => {
  const a = (104.5 / 2) * (Math.PI / 180);
  const h1: [number, number, number] = [
    Math.sin(a) * 0.55,
    -Math.cos(a) * 0.55,
    0,
  ];
  const h2: [number, number, number] = [
    -Math.sin(a) * 0.55,
    -Math.cos(a) * 0.55,
    0,
  ];
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <sphereGeometry args={[0.32, 32, 32]} />
        <meshPhysicalMaterial
          color="#FF4D6A"
          roughness={0.25}
          clearcoat={1}
          transparent
          opacity={opacity}
        />
      </mesh>
      {[h1, h2].map((p, i) => (
        <group key={i}>
          <mesh position={p}>
            <sphereGeometry args={[0.2, 32, 32]} />
            <meshPhysicalMaterial
              color="#F4F4FF"
              roughness={0.25}
              clearcoat={1}
              transparent
              opacity={opacity}
            />
          </mesh>
          <mesh
            position={[p[0] / 2, p[1] / 2, 0]}
            rotation={[0, 0, i === 0 ? a : -a]}
          >
            <cylinderGeometry args={[0.06, 0.06, 0.55, 12]} />
            <meshPhysicalMaterial
              color="#D9D6EA"
              roughness={0.4}
              transparent
              opacity={opacity}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
};

/** Núcleo atómico: protones (rojos) y neutrones (gris azulado) brillantes. */
export const Nucleus: React.FC<{
  scale?: number;
  opacity?: number;
  spin: number;
}> = ({ scale = 1, opacity = 1, spin }) => {
  const nucleons = useMemo(
    () =>
      new Array(14).fill(0).map((_, i) => {
        const phi = Math.acos(1 - (2 * (i + 0.5)) / 14);
        const th = Math.PI * (1 + Math.sqrt(5)) * i;
        const r = 0.16;
        return {
          p: [
            Math.cos(th) * Math.sin(phi) * r,
            Math.sin(th) * Math.sin(phi) * r,
            Math.cos(phi) * r,
          ] as [number, number, number],
          proton: i % 2 === 0,
        };
      }),
    [],
  );
  return (
    <group scale={scale} rotation={[spin * 0.7, spin, 0]}>
      {nucleons.map((n, i) => (
        <mesh key={i} position={n.p}>
          <sphereGeometry args={[0.12, 32, 32]} />
          <meshPhysicalMaterial
            color={n.proton ? "#FF5468" : "#9DB6E8"}
            roughness={0.2}
            clearcoat={1}
            emissive={n.proton ? "#5A0010" : "#0A1A3A"}
            transparent
            opacity={opacity}
          />
        </mesh>
      ))}
      <Glow size={1.6} color="#FF9AB0" opacity={0.45 * opacity} />
    </group>
  );
};

/** Nube electrónica: densidad exponencial alrededor del núcleo (orbital 1s estilizado). */
export const ElectronCloud: React.FC<{
  count?: number;
  radius: number;
  color: string;
  opacity: number;
  seed: string;
  frame: number;
  pointSize?: number;
  halo?: number;
}> = ({
  count = 2600,
  radius,
  color,
  opacity,
  seed,
  frame,
  pointSize = 0.07,
  halo = 0,
}) => {
  const geo = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = Math.max(1e-4, random(`${seed}u${i}`));
      const r = -Math.log(u) * radius * 0.35;
      const th = random(`${seed}t${i}`) * Math.PI * 2;
      const ph = Math.acos(2 * random(`${seed}p${i}`) - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      pos[i * 3 + 2] = r * Math.cos(ph);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, [count, radius, seed]);
  return (
    <group rotation={[frame * 0.004, frame * 0.01, 0]}>
      <PointCloud
        geometry={geo}
        color={color}
        size={pointSize}
        opacity={opacity * 0.8}
      />
      {halo > 0 ? (
        <Glow size={radius * 2.4} color={color} opacity={halo * opacity} />
      ) : null}
    </group>
  );
};

/** Estadio estilizado: campo, tres anillos de gradas, techo y torres de luz. */
export const Stadium: React.FC<{ opacity: number }> = ({ opacity }) => {
  const field = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 660;
    const ctx = c.getContext("2d")!;
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 2 ? "#2F8F46" : "#2A8040";
      ctx.fillRect((i * 1024) / 12, 0, 1024 / 12 + 1, 660);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 6;
    ctx.strokeRect(30, 30, 964, 600);
    ctx.beginPath();
    ctx.moveTo(512, 30);
    ctx.lineTo(512, 630);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(512, 330, 90, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeRect(30, 180, 150, 300);
    ctx.strokeRect(844, 180, 150, 300);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const seats = useMemo(() => {
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ roughness: 0.7, transparent: true }),
      3 * 96,
    );
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const color = new THREE.Color();
    let k = 0;
    for (let tier = 0; tier < 3; tier++) {
      for (let i = 0; i < 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        const ax = 6.4 + tier * 1.25;
        const az = 4.6 + tier * 1.25;
        q.setFromEuler(new THREE.Euler(0, -a, 0));
        m.compose(
          new THREE.Vector3(
            Math.cos(a) * ax,
            0.35 + tier * 0.85,
            Math.sin(a) * az,
          ),
          q,
          new THREE.Vector3(0.75, 0.7 + tier * 0.1, 0.5),
        );
        mesh.setMatrixAt(k, m);
        color
          .set(["#3D4E8C", "#2D3B70", "#253060"][tier])
          .offsetHSL(0, 0, (random(`seat${k}`) - 0.5) * 0.08);
        mesh.setColorAt(k, color);
        k++;
      }
    }
    return mesh;
  }, []);
  (seats.material as THREE.MeshStandardMaterial).opacity = opacity;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 6.4]} />
        <meshStandardMaterial
          map={field}
          roughness={0.9}
          transparent
          opacity={opacity}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[11, 64]} />
        <meshStandardMaterial
          color="#1A2140"
          roughness={1}
          transparent
          opacity={opacity}
        />
      </mesh>
      <primitive object={seats} />
      <mesh
        position={[0, 3.6, 0]}
        scale={[1, 1, 0.74]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[9.6, 0.18, 12, 128]} />
        <meshPhysicalMaterial
          color="#E8ECF8"
          metalness={0.6}
          roughness={0.25}
          transparent
          opacity={opacity}
        />
      </mesh>
      {[
        [9.6, 0, 6.6],
        [-9.6, 0, 6.6],
        [9.6, 0, -6.6],
        [-9.6, 0, -6.6],
      ].map(([x, , z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 2.6, 0]}>
            <cylinderGeometry args={[0.07, 0.1, 5.2, 12]} />
            <meshStandardMaterial
              color="#8A93B8"
              metalness={0.7}
              roughness={0.3}
              transparent
              opacity={opacity}
            />
          </mesh>
          <Glow
            position={[0, 5.3, 0]}
            size={2.4}
            color="#FFF4D6"
            opacity={0.9 * opacity}
          />
        </group>
      ))}
    </group>
  );
};

/** Cucharita metálica (perfil torneado + mango). */
export const Spoon: React.FC<{ opacity: number }> = ({ opacity }) => {
  const bowl = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = (i / 24) * (Math.PI / 2);
      pts.push(new THREE.Vector2(Math.sin(t) * 0.55, -Math.cos(t) * 0.22));
    }
    return new THREE.LatheGeometry(pts, 64);
  }, []);
  return (
    <group>
      <mesh geometry={bowl} scale={[1, 1, 1.45]}>
        <meshPhysicalMaterial
          color="#DDE3F0"
          metalness={1}
          roughness={0.12}
          side={THREE.DoubleSide}
          transparent
          opacity={opacity}
        />
      </mesh>
      <mesh position={[0, 0.02, 1.45]} rotation={[Math.PI / 2 - 0.15, 0, 0]}>
        <boxGeometry args={[0.16, 1.9, 0.05]} />
        <meshPhysicalMaterial
          color="#DDE3F0"
          metalness={1}
          roughness={0.15}
          transparent
          opacity={opacity}
        />
      </mesh>
      <mesh position={[0, -0.04, 0]} scale={[0.5, 0.12, 0.72]}>
        <sphereGeometry args={[1, 48, 24]} />
        <meshStandardMaterial
          color="#BFE9FF"
          emissive="#7FE7FF"
          emissiveIntensity={1.0}
          transparent
          opacity={opacity}
        />
      </mesh>
      <Glow
        position={[0, 0.1, 0]}
        size={1.1}
        color="#7FE7FF"
        opacity={0.5 * opacity}
      />
    </group>
  );
};

/** Haz de púlsar: cono abierto con degradado aditivo. */
export const Beam: React.FC<{ length: number; opacity: number }> = ({
  length,
  opacity,
}) => {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 256;
    const ctx = c.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "rgba(160,220,255,0)");
    g.addColorStop(1, "rgba(200,240,255,1)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 256);
    return new THREE.CanvasTexture(c);
  }, []);
  return (
    <mesh position={[0, length / 2, 0]}>
      <cylinderGeometry args={[0.24, 0.04, length, 32, 1, true]} />
      <meshBasicMaterial
        map={tex}
        transparent
        opacity={opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

/** Superficie de la estrella: degradado azul con manchas calientes (para emissiveMap). */
export const useStarTexture = () =>
  useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#1E4FB8";
    ctx.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 220; i++) {
      const x = random(`sx${i}`) * 512;
      const y = random(`sy${i}`) * 256;
      const r = 6 + random(`sr${i}`) * 40;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(
        0,
        random(`sc${i}`) > 0.6
          ? "rgba(235,248,255,0.95)"
          : "rgba(120,190,255,0.7)",
      );
      g.addColorStop(1, "rgba(60,120,230,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

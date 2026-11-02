import React, { useMemo } from "react";
import { random } from "remotion";
import * as THREE from "three";

/** Paleta: rojos de sangre, rosa de tejido y azul-blanco del oxígeno. */
export const R = {
  bg: "#12020A",
  wall: "#7E0B22",
  cell: "#C8102E",
  cellBright: "#F0233F",
  oxygen: "#BFE9FF",
  co2: "#6E6A7A",
  tissue: "#E37A7A",
  accent: "#FF5470",
};

/**
 * Glóbulo rojo: disco bicóncavo con el perfil de Evans y Fung (1972),
 * z(r) = ½·√(1−r²)·(c0 + c2 r² + c4 r⁴), torneado alrededor de su eje.
 */
export const useRbcGeometry = () =>
  useMemo(() => {
    const c0 = 0.207;
    const c2 = 2.003;
    const c4 = -1.123;
    const pts: THREE.Vector2[] = [];
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const r = Math.sin((i / n) * (Math.PI / 2)) * 0.999;
      const z = 0.5 * Math.sqrt(1 - r * r) * (c0 + c2 * r * r + c4 * r ** 4);
      pts.push(new THREE.Vector2(r, z));
    }
    for (let i = n; i >= 0; i--) {
      const r = Math.sin((i / n) * (Math.PI / 2)) * 0.999;
      const z = 0.5 * Math.sqrt(1 - r * r) * (c0 + c2 * r * r + c4 * r ** 4);
      pts.push(new THREE.Vector2(r, -z));
    }
    const g = new THREE.LatheGeometry(pts, 64);
    g.computeVertexNormals();
    return g;
  }, []);

/** Material "húmedo" para tejidos y células (barniz + brillo aterciopelado). */
export const WetMaterial: React.FC<{
  color: string;
  opacity?: number;
  side?: THREE.Side;
  emissive?: string;
  emissiveIntensity?: number;
}> = ({
  color,
  opacity = 1,
  side = THREE.FrontSide,
  emissive = "#000000",
  emissiveIntensity = 0,
}) => (
  <meshPhysicalMaterial
    color={color}
    roughness={0.32}
    clearcoat={1}
    clearcoatRoughness={0.15}
    sheen={1}
    sheenColor="#FF9AA8"
    side={side}
    transparent={opacity < 1}
    opacity={opacity}
    emissive={emissive}
    emissiveIntensity={emissiveIntensity}
  />
);

/** Textura de pared vascular: vetas y manchas suaves (para dar escala y velocidad). */
export const useWallTexture = (base: string, vein: string) =>
  useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 70; i++) {
      ctx.strokeStyle = vein;
      ctx.globalAlpha = 0.25 + random(`va${i}`) * 0.4;
      ctx.lineWidth = 1 + random(`vw${i}`) * 4;
      ctx.beginPath();
      let x = random(`vx${i}`) * 512;
      let y = random(`vy${i}`) * 512;
      ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += (random(`vdx${i}${k}`) - 0.5) * 120;
        y += random(`vdy${i}${k}`) * 90;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 160; i++) {
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = random(`sp${i}`) > 0.5 ? "#FFFFFF" : "#000000";
      ctx.beginPath();
      ctx.arc(
        random(`sx${i}`) * 512,
        random(`sy${i}`) * 512,
        2 + random(`sr${i}`) * 10,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(8, 2);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [base, vein]);

/** Camino serpenteante determinista (para el túnel y la cámara). */
export const makePath = (seed: string, length = 120, wiggle = 6) =>
  new THREE.CatmullRomCurve3(
    new Array(16)
      .fill(0)
      .map(
        (_, i) =>
          new THREE.Vector3(
            Math.sin(i * 0.9 + random(`${seed}a`) * 6) * wiggle,
            Math.cos(i * 0.7 + random(`${seed}b`) * 6) * wiggle * 0.7,
            -i * (length / 15),
          ),
      ),
  );

/** Vaso sanguíneo visto desde dentro. */
export const Vessel: React.FC<{
  path: THREE.Curve<THREE.Vector3>;
  radius: number;
  color?: string;
  opacity?: number;
}> = ({ path, radius, color = R.wall, opacity = 1 }) => {
  const geo = useMemo(
    () => new THREE.TubeGeometry(path, 400, radius, 48, false),
    [path, radius],
  );
  const tex = useWallTexture(color, "#3A0010");
  return (
    <mesh geometry={geo}>
      <meshPhysicalMaterial
        map={tex}
        roughness={0.35}
        clearcoat={1}
        clearcoatRoughness={0.2}
        sheen={1}
        sheenColor="#FF8A9A"
        side={THREE.BackSide}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  );
};

/** Glóbulos que fluyen por el camino (malla instanciada: cientos de células a bajo coste). */
export const FlowingCells: React.FC<{
  path: THREE.Curve<THREE.Vector3>;
  count: number;
  radius: number;
  progress: number;
  frame: number;
  color?: string;
  squash?: number;
  singleFile?: boolean;
  /** Oculta las células demasiado cerca de la cámara (u de la cámara sobre el camino). */
  avoid?: number;
}> = ({
  path,
  count,
  radius,
  progress,
  frame,
  color = R.cell,
  squash = 0,
  singleFile = false,
  avoid,
}) => {
  const rbc = useRbcGeometry();
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(
      rbc,
      new THREE.MeshPhysicalMaterial({
        roughness: 0.3,
        clearcoat: 0.8,
        clearcoatRoughness: 0.25,
        sheen: 1,
        sheenColor: new THREE.Color("#FFB3BF"),
      }),
      count,
    );
    return m;
  }, [rbc, count]);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const base = random(`t${i}`);
    const u =
      (((base + progress * (0.92 + random(`sp${i}`) * 0.1)) % 1) + 1) % 1;
    const p = path.getPointAt(u);
    const tan = path.getTangentAt(u);
    const hidden = avoid !== undefined && u > avoid - 0.012 && u < avoid + 0.02;
    const nrm = new THREE.Vector3(0, 1, 0).cross(tan).normalize();
    const bin = tan.clone().cross(nrm).normalize();
    const a = random(`ang${i}`) * Math.PI * 2;
    const rr = singleFile ? 0 : Math.sqrt(random(`rad${i}`)) * radius * 0.75;
    p.add(nrm.multiplyScalar(Math.cos(a) * rr)).add(
      bin.multiplyScalar(Math.sin(a) * rr),
    );
    q.setFromEuler(
      new THREE.Euler(
        random(`rx${i}`) * 6 + frame * 0.03 * (random(`wr${i}`) - 0.5),
        random(`ry${i}`) * 6 + frame * 0.02,
        random(`rz${i}`) * 6,
      ),
    );
    if (singleFile) q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
    const s = 0.55 * (0.9 + random(`sc${i}`) * 0.2);
    m4.compose(
      hidden ? p.set(0, -9999, 0) : p,
      q,
      new THREE.Vector3(
        s * (1 - squash * 0.35),
        s * (1 + squash * 1.2),
        s * (1 - squash * 0.35),
      ),
    );
    mesh.setMatrixAt(i, m4);
    col.set(color).offsetHSL(0, 0, (random(`cl${i}`) - 0.5) * 0.08);
    mesh.setColorAt(i, col);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return <primitive object={mesh} />;
};

/** Hemoglobina: cuatro subunidades globulares (2 α rojas, 2 β moradas). */
export const Hemoglobin: React.FC<{
  position: [number, number, number];
  rotation: [number, number, number];
  scale?: number;
  loaded: number;
}> = ({ position, rotation, scale = 1, loaded }) => (
  <group position={position} rotation={rotation} scale={scale}>
    {[
      [0.22, 0.22, 0],
      [-0.22, 0.22, 0],
      [0.22, -0.22, 0.05],
      [-0.22, -0.22, -0.05],
    ].map((p, i) => (
      <group key={i} position={p as [number, number, number]}>
        <mesh>
          <icosahedronGeometry args={[0.25, 2]} />
          <meshPhysicalMaterial
            color={i < 2 ? "#E0405A" : "#9A4BC2"}
            roughness={0.4}
            clearcoat={0.8}
            flatShading
          />
        </mesh>
        {loaded > 0 ? (
          <mesh
            position={[(p[0] as number) * 0.9, (p[1] as number) * 0.9, 0.22]}
            scale={loaded}
          >
            <sphereGeometry args={[0.09, 16, 16]} />
            <meshStandardMaterial
              color={R.oxygen}
              emissive={R.oxygen}
              emissiveIntensity={1.2}
            />
          </mesh>
        ) : null}
      </group>
    ))}
  </group>
);

/** Alvéolo pulmonar: burbuja translúcida rosada. */
export const Alveolus: React.FC<{
  position: [number, number, number];
  r: number;
}> = ({ position, r }) => (
  <mesh position={position} scale={r}>
    <sphereGeometry args={[1, 48, 48]} />
    <meshPhysicalMaterial
      color="#E98AA0"
      roughness={0.15}
      clearcoat={1}
      transparent
      opacity={0.3}
      sheen={1}
      sheenColor="#FFFFFF"
    />
  </mesh>
);

/** Fibra muscular estriada. */
export const MuscleFiber: React.FC<{
  position: [number, number, number];
  rotation: [number, number, number];
  length: number;
}> = ({ position, rotation, length }) => {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 16;
    c.height = 128;
    const ctx = c.getContext("2d")!;
    for (let y = 0; y < 128; y += 8) {
      ctx.fillStyle = y % 16 ? "#C2453F" : "#E0706A";
      ctx.fillRect(0, y, 16, 8);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, length * 2);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [length]);
  return (
    <mesh position={position} rotation={rotation}>
      <cylinderGeometry args={[0.6, 0.6, length, 32]} />
      <meshPhysicalMaterial map={tex} roughness={0.45} clearcoat={0.6} />
    </mesh>
  );
};

/** Macrófago del bazo: masa morada irregular (desplazamiento de vértices determinista). */
export const Macrophage: React.FC<{ scale: number; frame: number }> = ({
  scale,
  frame,
}) => {
  const geo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(1, 5);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const n =
        1 +
        0.18 * Math.sin(v.x * 5 + 1) * Math.cos(v.y * 4) +
        0.1 * Math.sin(v.z * 7);
      v.multiplyScalar(n);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh
      geometry={geo}
      scale={scale}
      rotation={[frame * 0.004, frame * 0.006, 0]}
    >
      <meshPhysicalMaterial
        color="#8E5BD6"
        roughness={0.35}
        clearcoat={0.8}
        sheen={1}
        sheenColor="#E3C8FF"
        transparent
        opacity={0.92}
      />
    </mesh>
  );
};

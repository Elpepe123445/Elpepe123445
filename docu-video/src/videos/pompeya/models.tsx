import { useThree } from "@react-three/fiber";
import React, { useMemo } from "react";
import { random } from "remotion";
import * as THREE from "three";
import { useGlowTexture } from "../../components/three/Stage";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const P = {
  bg: "#120D0A",
  accent: "#FF8A3D",
  plaster: "#ECE5D7",
  pumice: "#D3C8B1",
  ash: "#8C8783",
};

/** Cumbre del Vesubio en coordenadas de la escena (la calle mira hacia −z). */
export const SUMMIT: [number, number, number] = [-25, 38, -170];

const canvasTex = (
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
  repeat?: [number, number],
) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
};

const grain = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  seed: string,
  n: number,
  alpha: number,
) => {
  for (let i = 0; i < n; i++) {
    const v = random(`${seed}g${i}`) > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha * random(`${seed}a${i}`)})`;
    const s = 1 + random(`${seed}s${i}`) * 3;
    ctx.fillRect(
      random(`${seed}x${i}`) * w,
      random(`${seed}y${i}`) * h,
      s,
      s,
    );
  }
};

/** Habilita los planos de recorte locales (para «rellenar» el molde de yeso). */
export const EnableClipping: React.FC = () => {
  const gl = useThree((s) => s.gl);
  gl.localClippingEnabled = true;
  return null;
};

/** Cielo degradado (cúpula) que no se ve afectado por la niebla. */
export const Sky: React.FC<{ top: string; horizon: string; low?: string }> = ({
  top,
  horizon,
  low = horizon,
}) => {
  const tex = useMemo(
    () =>
      canvasTex(4, 256, (ctx) => {
        const g = ctx.createLinearGradient(0, 0, 0, 256);
        g.addColorStop(0, top);
        g.addColorStop(0.47, horizon);
        g.addColorStop(0.52, low);
        g.addColorStop(1, low);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 4, 256);
      }),
    [top, horizon, low],
  );
  return (
    <mesh>
      <sphereGeometry args={[450, 32, 16]} />
      <meshBasicMaterial
        map={tex}
        side={THREE.BackSide}
        fog={false}
        depthWrite={false}
      />
    </mesh>
  );
};

/* ------------------------------------------------------------------ */
/* Calle romana                                                         */
/* ------------------------------------------------------------------ */

const PLASTERS = ["#E4D3B0", "#C98F4A", "#9E3B2C", "#D9CBB5", "#B5552F"];
const DADOS = ["#6E2219", "#2A2420", "#7A3A1E", "#3B2A22"];

type House = {
  side: 1 | -1;
  z: number;
  w: number;
  h: number;
  d: number;
  color: string;
  tex: THREE.Texture;
};

const facade = (seed: string, color: string, doorAt: number) =>
  canvasTex(256, 384, (ctx) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 256, 384);
    grain(ctx, 256, 384, seed, 900, 0.08);
    // zócalo oscuro con filete claro (típico de las fachadas pompeyanas)
    const dado = DADOS[Math.floor(random(`${seed}d`) * DADOS.length)];
    ctx.fillStyle = dado;
    ctx.fillRect(0, 384 * 0.72, 256, 384 * 0.28);
    ctx.fillStyle = "rgba(240,232,215,0.75)";
    ctx.fillRect(0, 384 * 0.715, 256, 4);
    // puerta con marco de piedra
    const dw = 60;
    const dx = doorAt * (256 - dw - 30) + 15;
    const dh = 384 * 0.5;
    ctx.fillStyle = "#CFC3AA";
    ctx.fillRect(dx - 7, 384 - dh - 9, dw + 14, dh + 9);
    ctx.fillStyle = "#1A1410";
    ctx.fillRect(dx, 384 - dh, dw, dh);
    // ventanuco alto
    if (random(`${seed}w`) > 0.35) {
      const wx = 20 + random(`${seed}wx`) * 200;
      ctx.fillStyle = "#1E1712";
      ctx.fillRect(wx, 384 * 0.18, 26, 30);
    }
    // manchas de humedad y desgaste
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = `rgba(40,25,15,${0.02 + random(`${seed}m${i}`) * 0.04})`;
      const x = random(`${seed}mx${i}`) * 256;
      ctx.fillRect(x, 0, 1 + random(`${seed}mw${i}`) * 5, 384 * 0.72);
    }
    const g = ctx.createLinearGradient(0, 0, 0, 384);
    g.addColorStop(0, "rgba(0,0,0,0.12)");
    g.addColorStop(0.15, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 384);
  });

const usePaving = () =>
  useMemo(
    () =>
      canvasTex(
        512,
        512,
        (ctx) => {
          ctx.fillStyle = "#24221F";
          ctx.fillRect(0, 0, 512, 512);
          const n = 6;
          const cs = 512 / n;
          for (let gy = -1; gy <= n; gy++) {
            for (let gx = -1; gx <= n; gx++) {
              const cx = (gx + 0.5) * cs + (random(`pc${gx}${gy}`) - 0.5) * 18;
              const cy = (gy + 0.5) * cs + (random(`pd${gx}${gy}`) - 0.5) * 18;
              const v = 52 + random(`pv${gx}${gy}`) * 34;
              ctx.fillStyle = `rgb(${v + 4},${v + 2},${v})`;
              ctx.beginPath();
              const k = 6;
              for (let j = 0; j < k; j++) {
                const a = (j / k) * Math.PI * 2 + random(`pa${gx}${gy}`) * 0.6;
                const r = cs * (0.46 + random(`pr${gx}${gy}${j}`) * 0.1);
                const x = cx + Math.cos(a) * r;
                const y = cy + Math.sin(a) * r;
                if (j === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
              }
              ctx.closePath();
              ctx.fill();
              ctx.strokeStyle = "rgba(255,255,255,0.08)";
              ctx.lineWidth = 2;
              ctx.stroke();
            }
          }
          grain(ctx, 512, 512, "pav", 2500, 0.12);
          // surcos de las ruedas de los carros
          for (const x of [150, 362]) {
            const g = ctx.createLinearGradient(x - 14, 0, x + 14, 0);
            g.addColorStop(0, "rgba(0,0,0,0)");
            g.addColorStop(0.5, "rgba(0,0,0,0.35)");
            g.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = g;
            ctx.fillRect(x - 14, 0, 28, 512);
          }
        },
        [1, 25],
      ),
    [],
  );

export const useNoiseTexture = (base: string, seed: string, repeat = 20) =>
  useMemo(
    () =>
      canvasTex(
        256,
        256,
        (ctx) => {
          ctx.fillStyle = base;
          ctx.fillRect(0, 0, 256, 256);
          grain(ctx, 256, 256, seed, 3500, 0.18);
        },
        [repeat, repeat],
      ),
    [base, seed, repeat],
  );

const useTiles = () =>
  useMemo(
    () =>
      canvasTex(
        128,
        128,
        (ctx) => {
          ctx.fillStyle = "#9C4A2C";
          ctx.fillRect(0, 0, 128, 128);
          for (let i = 0; i < 8; i++) {
            ctx.fillStyle = i % 2 ? "#B35A36" : "#8A3F24";
            ctx.fillRect(i * 16, 0, 9, 128);
          }
          grain(ctx, 128, 128, "tile", 600, 0.15);
        },
        [3, 1],
      ),
    [],
  );

/**
 * Calle de Pompeya: calzada de basalto con surcos de carros, aceras elevadas,
 * piedras para cruzar, pórtico y fachadas con zócalo pompeyano.
 * `roofSag` hunde un tejado; `doorClose` cierra una puerta; `roofAsh` acumula material encima.
 */
export const Street: React.FC<{
  roofSag?: number;
  doorClose?: number;
  roofAsh?: number;
  ashColor?: string;
  lampGlow?: number;
}> = ({
  roofSag = 0,
  doorClose = 0,
  roofAsh = 0,
  ashColor = P.pumice,
  lampGlow = 0,
}) => {
  const paving = usePaving();
  const curb = useNoiseTexture("#B4A890", "curb", 12);
  const tiles = useTiles();
  const field = useNoiseTexture("#55533A", "field", 80);
  const houses = useMemo(() => {
    const out: House[] = [];
    for (const side of [-1, 1] as const) {
      let z = 16;
      let i = 0;
      while (z > -80) {
        const w = 3.6 + random(`hw${side}${i}`) * 2.6;
        const color =
          PLASTERS[Math.floor(random(`hc${side}${i}`) * PLASTERS.length)];
        // la casa de la puerta que se cierra (izquierda, z≈−2) tiene la puerta centrada
        const doorAt =
          side === -1 && z - w / 2 < 1 && z - w / 2 > -6
            ? 0.5
            : random(`hd${side}${i}`);
        out.push({
          side,
          z: z - w / 2,
          w,
          h: 4.2 + random(`hh${side}${i}`) * 2.6,
          d: 6,
          color,
          tex: facade(`f${side}${i}`, color, doorAt),
        });
        z -= w + 0.06;
        i++;
      }
    }
    return out;
  }, []);
  const sagIdx = houses.findIndex((h) => h.side === 1 && h.z < 0);
  const doorHouse = houses.find(
    (h) => h.side === -1 && h.z < 1 && h.z > -6,
  ) as House | undefined;
  return (
    <group>
      {/* campos alrededor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -120]}>
        <planeGeometry args={[700, 700]} />
        <meshStandardMaterial map={field} roughness={1} />
      </mesh>
      {/* calzada */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -35]}>
        <planeGeometry args={[4, 100]} />
        <meshStandardMaterial map={paving} roughness={0.85} />
      </mesh>
      {/* aceras */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 2.7, 0.15, -35]}>
          <boxGeometry args={[1.4, 0.3, 100]} />
          <meshStandardMaterial map={curb} roughness={0.95} />
        </mesh>
      ))}
      {/* piedras para cruzar */}
      {[-1.2, 0, 1.2].map((x) => (
        <mesh key={x} position={[x, 0.16, -9]} scale={[1, 1, 0.7]}>
          <cylinderGeometry args={[0.42, 0.46, 0.32, 20]} />
          <meshStandardMaterial map={curb} roughness={0.9} />
        </mesh>
      ))}
      {/* pórtico */}
      {new Array(6).fill(0).map((_, i) => (
        <mesh key={i} position={[-3.0, 1.95, -16 - i * 2.4]}>
          <cylinderGeometry args={[0.17, 0.2, 3.6, 16]} />
          <meshStandardMaterial color="#E8DFCC" roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[-3.05, 3.9, -22]}>
        <boxGeometry args={[0.55, 0.4, 13]} />
        <meshStandardMaterial color="#D9CDB4" roughness={0.9} />
      </mesh>
      {houses.map((h, i) => {
        const sag = i === sagIdx ? roofSag : 0;
        return (
          <group key={i}>
            <mesh position={[h.side * (3.4 + h.d / 2), h.h / 2, h.z]}>
              <boxGeometry args={[h.d, h.h, h.w]} />
              <meshStandardMaterial color={h.color} roughness={0.95} />
            </mesh>
            <mesh
              position={[h.side * 3.39, h.h / 2, h.z]}
              rotation={[0, (-h.side * Math.PI) / 2, 0]}
            >
              <planeGeometry args={[h.w, h.h]} />
              <meshStandardMaterial map={h.tex} roughness={0.95} />
            </mesh>
            <group
              position={[
                h.side * (3.4 + h.d / 2 - 0.2),
                h.h + 0.35 - sag * 1.6,
                h.z,
              ]}
              rotation={[sag * 0.25, 0, h.side * (0.2 + sag * 0.35)]}
            >
              <mesh>
                <boxGeometry args={[h.d + 0.8, 0.22, h.w + 0.2]} />
                <meshStandardMaterial map={tiles} roughness={0.85} />
              </mesh>
              {roofAsh > 0 ? (
                <mesh position={[0, 0.11 + roofAsh * 0.3, 0]}>
                  <boxGeometry args={[h.d + 0.6, roofAsh * 0.6, h.w]} />
                  <meshStandardMaterial color={ashColor} roughness={1} />
                </mesh>
              ) : null}
            </group>
          </group>
        );
      })}
      {doorHouse ? (
        <group position={[-3.36, 0, doorHouse.z]}>
          {[-1, 1].map((s) => (
            <group
              key={s}
              position={[0, 0, s * 0.43]}
              rotation={[0, s * (1 - doorClose) * 1.5, 0]}
            >
              <mesh position={[0.03, 1.5, -s * 0.21]}>
                <boxGeometry args={[0.06, 2.9, 0.42]} />
                <meshStandardMaterial color="#5A3A22" roughness={0.8} />
              </mesh>
            </group>
          ))}
          {lampGlow > 0 ? (
            <pointLight
              position={[0.5, 1.4, 0]}
              intensity={lampGlow * 8}
              distance={7}
              color="#FFB060"
            />
          ) : null}
        </group>
      ) : null}
    </group>
  );
};

/** Vesubio (cono con relieve) a lo lejos, al fondo de la calle. */
export const Vesuvius: React.FC<{ color?: string }> = ({
  color = "#5E5848",
}) => {
  const geo = useMemo(() => {
    const prof: [number, number][] = [
      [0.01, 38],
      [7, 37.5],
      [13, 34],
      [28, 23],
      [52, 9],
      [85, 0],
    ];
    const g = new THREE.LatheGeometry(
      prof.map(([r, y]) => new THREE.Vector2(r, y)),
      72,
    );
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const a = Math.atan2(z, x);
      const k =
        1 +
        0.06 * Math.sin(a * 9 + y * 0.2) +
        0.035 * Math.sin(a * 23 - y * 0.5);
      p.setXYZ(i, x * k, y * (1 + 0.03 * Math.sin(a * 5)), z * k);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} position={[SUMMIT[0], 0, SUMMIT[2]]}>
      <meshStandardMaterial color={color} roughness={1} flatShading />
    </mesh>
  );
};

/* ------------------------------------------------------------------ */
/* Columna eruptiva («como un pino») y nube piroclástica                */
/* ------------------------------------------------------------------ */

/** Bocanada «coliflor»: esfera con bultos suaves (normales suavizadas). */
const usePuffGeometry = () =>
  useMemo(() => {
    const base = new THREE.IcosahedronGeometry(1, 3);
    base.deleteAttribute("normal");
    base.deleteAttribute("uv");
    const g = mergeVertices(base);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const n =
        0.16 * Math.sin(x * 4.1 + 1.3) * Math.sin(y * 3.7 + 0.7) * Math.sin(z * 4.4 + 2.1) +
        0.08 * Math.sin(x * 9.3 + y * 8.1) * Math.cos(z * 7.7) +
        0.04 * Math.sin(x * 17 + z * 13);
      p.setXYZ(i, x * (1 + n), y * (1 + n), z * (1 + n));
    }
    g.computeVertexNormals();
    return g;
  }, []);

const tmp = new THREE.Object3D();
const tmpColor = new THREE.Color();

/**
 * Columna pliniana con forma de pino: tronco de nubes que crece y copa que se abre.
 * `grow` 0-1 la levanta; `collapse` 0-1 la hace caer y extenderse.
 */
export const EruptionColumn: React.FC<{
  grow: number;
  collapse?: number;
  frame: number;
  height?: number;
}> = ({ grow, collapse = 0, frame, height = 150 }) => {
  const geo = usePuffGeometry();
  const N = 240;
  const puffs = useMemo(
    () =>
      new Array(N).fill(0).map((_, i) => {
        const trunk = i < N * 0.6;
        if (trunk) {
          const s = random(`es${i}`);
          return {
            trunk,
            s,
            x: (random(`ex${i}`) - 0.5) * (8 + s * 22),
            y: s * height,
            z: (random(`ez${i}`) - 0.5) * (8 + s * 22),
            r: 4 + s * 8 + random(`er${i}`) * 6,
          };
        }
        const a = random(`ea${i}`) * Math.PI * 2;
        const rr = Math.sqrt(random(`eq${i}`));
        return {
          trunk,
          s: rr,
          x: Math.cos(a) * rr * 72,
          y: height + random(`ey${i}`) * 16 - rr * 14,
          z: Math.sin(a) * rr * 40,
          r: 10 + random(`er${i}`) * 9,
        };
      }),
    [height],
  );
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(
      geo,
      new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }),
      N,
    );
    m.frustumCulled = false;
    return m;
  }, [geo]);
  puffs.forEach((p, i) => {
    let k: number;
    let x = p.x;
    let y = p.y;
    let z = p.z;
    if (p.trunk) {
      k = Math.min(1, Math.max(0, (grow * 1.15 - p.s) * 6));
    } else {
      const open = Math.min(1, Math.max(0, (grow - 0.8) * 5));
      k = open;
      x *= 0.3 + 0.7 * open;
      z *= 0.3 + 0.7 * open;
    }
    // viento: la columna se inclina con la altura
    x += y * 0.12;
    // colapso: cae y se expande
    y *= 1 - collapse * 0.75;
    x *= 1 + collapse * 0.8;
    z *= 1 + collapse * 0.8;
    const b = 1 + 0.07 * Math.sin(frame * 0.05 + i * 1.7);
    tmp.position.set(SUMMIT[0] + x, SUMMIT[1] + y, SUMMIT[2] + z);
    tmp.rotation.set(i, frame * 0.004 + i, 0);
    const sc = p.r * k * b * (1 + collapse * 0.4);
    tmp.scale.set(sc, sc * (p.trunk ? 1 : 0.72), sc);
    tmp.updateMatrix();
    mesh.setMatrixAt(i, tmp.matrix);
    const lift = Math.min(1, p.y / height);
    tmpColor
      .set("#433A33")
      .lerp(new THREE.Color("#D6CDBF"), 0.15 + lift * 0.75)
      .multiplyScalar(
        (0.82 + random(`ec${i}`) * 0.3) * (1 - collapse * 0.35),
      );
    mesh.setColorAt(i, tmpColor);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return <primitive object={mesh} />;
};

/**
 * Nube piroclástica: frente de nubes que rueda ladera abajo. `front` es la z del frente.
 * La base brilla en naranja (gases y cenizas a cientos de grados).
 */
export const PyroclasticCloud: React.FC<{ front: number; frame: number }> = ({
  front,
  frame,
}) => {
  const geo = usePuffGeometry();
  const N = 240;
  const puffs = useMemo(
    () =>
      new Array(N).fill(0).map((_, i) => {
        const d = random(`pd${i}`) * 80;
        const hot = i % 3 === 0;
        return {
          d,
          hot,
          x: (random(`px${i}`) - 0.5) * 180,
          y: hot
            ? random(`py${i}`) * 4
            : Math.pow(random(`py${i}`), 0.8) * (10 + d * 0.8),
          r: (hot ? 3 : 5) + random(`pr${i}`) * 7 + d * 0.06,
        };
      }),
    [],
  );
  const [dark, hot] = useMemo(() => {
    const mk = (mat: THREE.Material) => {
      const m = new THREE.InstancedMesh(geo, mat, N);
      m.frustumCulled = false;
      return m;
    };
    return [
      mk(new THREE.MeshStandardMaterial({ color: "#5E554D", roughness: 1 })),
      mk(
        new THREE.MeshStandardMaterial({
          color: "#5A3626",
          emissive: new THREE.Color("#FF5A14"),
          emissiveIntensity: 1.25,
          roughness: 1,
        }),
      ),
    ];
  }, [geo]);
  let nd = 0;
  let nh = 0;
  puffs.forEach((p, i) => {
    const roll = Math.sin(frame * 0.07 + i * 2.3);
    tmp.position.set(
      p.x,
      p.y + p.r * 0.5 + roll * 0.8,
      front - p.d + Math.cos(frame * 0.05 + i) * 1.2,
    );
    tmp.rotation.set(frame * 0.01 + i, i, 0);
    const sc = p.r * (1 + 0.08 * roll);
    tmp.scale.set(sc, sc * 0.85, sc);
    tmp.updateMatrix();
    if (p.hot) hot.setMatrixAt(nh++, tmp.matrix);
    else dark.setMatrixAt(nd++, tmp.matrix);
  });
  dark.count = nd;
  hot.count = nh;
  dark.instanceMatrix.needsUpdate = true;
  hot.instanceMatrix.needsUpdate = true;
  return (
    <group>
      <primitive object={dark} />
      <primitive object={hot} />
    </group>
  );
};

/** Lluvia de piedra pómez alrededor de la cámara. */
export const PumiceRain: React.FC<{
  frame: number;
  center: [number, number, number];
  density?: number;
  speed?: number;
}> = ({ frame, center, density = 1, speed = 1 }) => {
  const N = 420;
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({
        color: P.pumice,
        roughness: 1,
        flatShading: true,
      }),
      N,
    );
    m.frustumCulled = false;
    return m;
  }, []);
  for (let i = 0; i < N; i++) {
    const on = i < N * density;
    const v = (0.16 + random(`rv${i}`) * 0.12) * speed;
    const H = 14;
    const y = H - ((frame * v + random(`ry${i}`) * H) % H);
    tmp.position.set(
      center[0] + (random(`rx${i}`) - 0.5) * 14,
      y,
      center[2] - 1.2 - random(`rz${i}`) * 26,
    );
    tmp.rotation.set(frame * 0.08 * random(`rr${i}`), i, i * 0.3);
    const s = on ? 0.025 + random(`rs${i}`) * 0.05 : 0;
    tmp.scale.set(s, s * 0.8, s);
    tmp.updateMatrix();
    mesh.setMatrixAt(i, tmp.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return <primitive object={mesh} />;
};

/** Capa de pómez o ceniza que va enterrando la ciudad. */
export const Deposit: React.FC<{ level: number; color: string; seed: string }> = ({
  level,
  color,
  seed,
}) => {
  const tex = useNoiseTexture(color, seed, 90);
  if (level <= 0) return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, level, -60]}>
      <planeGeometry args={[400, 400]} />
      <meshStandardMaterial map={tex} roughness={1} />
    </mesh>
  );
};

/** Ceniza fina cayendo lentamente (puntos en bucle). */
export const AshFall: React.FC<{
  frame: number;
  center: [number, number, number];
  color?: string;
  opacity?: number;
}> = ({ frame, center, color = "#CFCAC4", opacity = 0.8 }) => {
  const dot = useGlowTexture();
  const geo = useMemo(() => {
    const n = 1400;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (random(`ax${i}`) - 0.5) * 24;
      pos[i * 3 + 1] = random(`ay${i}`) * 20;
      pos[i * 3 + 2] = -random(`az${i}`) * 30 + 4;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  const dy = (frame * 0.025) % 20;
  return (
    <group position={[center[0], center[1] - 10, center[2]]}>
      {[0, 20].map((o) => (
        <points key={o} geometry={geo} position={[0, o - dy, 0]}>
          <pointsMaterial
            map={dot}
            color={color}
            size={0.14}
            sizeAttenuation
            transparent
            opacity={opacity}
            depthWrite={false}
          />
        </points>
      ))}
    </group>
  );
};

/* ------------------------------------------------------------------ */
/* Molde de yeso                                                         */
/* ------------------------------------------------------------------ */

const Limb: React.FC<{
  a: [number, number, number];
  b: [number, number, number];
  r: number;
  children: React.ReactNode;
}> = ({ a, b, r, children }) => {
  const A = new THREE.Vector3(...a);
  const Bv = new THREE.Vector3(...b);
  const dir = Bv.clone().sub(A);
  const len = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.normalize(),
  );
  const mid = A.add(Bv).multiplyScalar(0.5);
  return (
    <mesh position={mid} quaternion={q}>
      <capsuleGeometry args={[r, Math.max(0.01, len - r), 8, 16]} />
      {children}
    </mesh>
  );
};

/**
 * Figura agachada, abrazando las rodillas y cubriéndose la cara: la postura
 * que conservan muchos moldes. `material` se repite en cada pieza.
 */
export const CrouchedFigure: React.FC<{ material: React.ReactNode }> = ({
  material,
}) => {
  const L = (
    a: [number, number, number],
    b: [number, number, number],
    r: number,
  ) => (
    <Limb a={a} b={b} r={r}>
      {material}
    </Limb>
  );
  return (
    <group>
      {L([0, 0.28, -0.05], [0, 0.78, 0.12], 0.21)}
      <mesh position={[0, 0.98, 0.3]} scale={[1, 1.1, 1]}>
        <sphereGeometry args={[0.15, 24, 24]} />
        {material}
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          {L([s * 0.12, 0.24, 0.02], [s * 0.13, 0.62, 0.42], 0.13)}
          {L([s * 0.13, 0.62, 0.42], [s * 0.12, 0.08, 0.5], 0.105)}
          {L([s * 0.12, 0.05, 0.5], [s * 0.12, 0.04, 0.66], 0.07)}
          {L([s * 0.24, 0.8, 0.12], [s * 0.2, 0.62, 0.46], 0.095)}
          {L([s * 0.2, 0.62, 0.46], [s * 0.07, 0.94, 0.42], 0.085)}
        </group>
      ))}
    </group>
  );
};

/** Textura de yeso para el relieve (bumpMap). */
export const usePlasterBump = () =>
  useMemo(
    () =>
      canvasTex(
        256,
        256,
        (ctx) => {
          ctx.fillStyle = "#808080";
          ctx.fillRect(0, 0, 256, 256);
          grain(ctx, 256, 256, "plb", 5000, 0.5);
        },
        [3, 3],
      ),
    [],
  );

/* ------------------------------------------------------------------ */
/* Muro con la inscripción al carbón                                     */
/* ------------------------------------------------------------------ */

/** Muro enlucido con «XVI K NOV» escrito al carbón; `reveal` 0-1 lo va trazando. */
export const InscribedWall: React.FC<{ reveal: number; glow?: number }> = ({
  reveal,
  glow = 0,
}) => {
  const { canvas, tex, bg } = useMemo(() => {
    const W = 600;
    const H = 1000;
    const bgC = document.createElement("canvas");
    bgC.width = W;
    bgC.height = H;
    const b = bgC.getContext("2d")!;
    b.fillStyle = "#E3D7C0";
    b.fillRect(0, 0, W, H);
    grain(b, W, H, "wall", 9000, 0.1);
    for (let i = 0; i < 40; i++) {
      b.fillStyle = `rgba(90,60,30,${0.03 + random(`ws${i}`) * 0.05})`;
      b.beginPath();
      b.ellipse(
        random(`wx${i}`) * W,
        random(`wy${i}`) * H,
        20 + random(`wr${i}`) * 120,
        10 + random(`wq${i}`) * 60,
        random(`wa${i}`) * 3,
        0,
        Math.PI * 2,
      );
      b.fill();
    }
    b.fillStyle = "#7B2A1E";
    b.fillRect(0, H * 0.82, W, H * 0.18);
    b.fillStyle = "rgba(240,230,210,0.7)";
    b.fillRect(0, H * 0.815, W, 5);
    b.strokeStyle = "rgba(60,40,25,0.35)";
    b.lineWidth = 1.5;
    b.beginPath();
    b.moveTo(W * 0.08, 0);
    b.lineTo(W * 0.14, H * 0.3);
    b.lineTo(W * 0.11, H * 0.55);
    b.stroke();
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return { canvas: c, tex: t, bg: bgC };
  }, []);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bg, 0, 0);
  ctx.font = "700 80px Cinzel, serif";
  ctx.textBaseline = "middle";
  // «XVI K» en la primera línea y «NOV» en la segunda
  const lines = ["XVI K", "NOV"];
  const glyphs: { ch: string; x: number; y: number; w: number }[] = [];
  lines.forEach((ln, li) => {
    const ws = [...ln].map((ch) => ctx.measureText(ch).width + 6);
    let gx = (canvas.width - ws.reduce((a, b) => a + b, 0)) / 2;
    [...ln].forEach((ch, k) => {
      glyphs.push({ ch, x: gx, y: 405 + li * 100, w: ws[k] });
      gx += ws[k];
    });
  });
  const shown = reveal * glyphs.length;
  glyphs.forEach(({ ch, x, y, w }, i) => {
    const a = Math.max(0, Math.min(1, shown - i));
    if (a > 0 && ch !== " ") {
      ctx.save();
      ctx.translate(x + w / 2, y + (random(`cy${i}`) - 0.5) * 14);
      ctx.rotate((random(`cr${i}`) - 0.5) * 0.16);
      // trazo de carbón: muchas pasadas con poca opacidad y pequeños desvíos
      for (let k = 0; k < 14; k++) {
        ctx.fillStyle = `rgba(28,24,22,${0.13 * a})`;
        ctx.fillText(
          ch,
          -w / 2 + (random(`ck${i}${k}`) - 0.5) * 5,
          (random(`cj${i}${k}`) - 0.5) * 5,
        );
      }
      ctx.restore();
    }
  });
  tex.needsUpdate = true;
  return (
    <mesh>
      <planeGeometry args={[6, 10]} />
      <meshStandardMaterial
        map={tex}
        roughness={0.92}
        emissive="#FFB070"
        emissiveIntensity={glow * 0.08}
        emissiveMap={tex}
      />
    </mesh>
  );
};

import React, { useLayoutEffect, useMemo, useRef } from "react";
import {
  AbsoluteFill,
  random,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/** Campo de estrellas en Canvas: determinista, con parallax y centelleo suave. */
export const Starfield: React.FC<{
  count?: number;
  drift?: number;
  seed?: string;
  opacity?: number;
}> = ({ count = 900, drift = 0.15, seed = "stars", opacity = 1 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const stars = useMemo(
    () =>
      new Array(count).fill(0).map((_, i) => ({
        x: random(`${seed}x${i}`) * width,
        y: random(`${seed}y${i}`) * height,
        z: 0.2 + random(`${seed}z${i}`) * 0.8, // profundidad: más cerca = más brillo y más parallax
        tw: random(`${seed}t${i}`) * Math.PI * 2,
      })),
    [count, seed, width, height],
  );

  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    for (const s of stars) {
      const x = (((s.x - frame * drift * s.z * 4) % width) + width) % width;
      const a =
        (0.35 + 0.65 * s.z) * (0.75 + 0.25 * Math.sin(frame * 0.08 + s.tw));
      ctx.fillStyle = `rgba(235,240,255,${a})`;
      const r = s.z * 1.6;
      ctx.beginPath();
      ctx.arc(x, s.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [frame, stars, width, height, drift]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, opacity }}
    />
  );
};

/** Polvo en suspensión iluminado (SVG), para dar profundidad a escenas cálidas. */
export const Dust: React.FC<{
  count?: number;
  color?: string;
  seed?: string;
  opacity?: number;
}> = ({ count = 70, color = "#FBE3B0", seed = "dust", opacity = 0.7 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <svg
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, opacity }}
    >
      {new Array(count).fill(0).map((_, i) => {
        const z = 0.3 + random(`${seed}z${i}`) * 0.7;
        const x =
          random(`${seed}x${i}`) * width + Math.sin(frame / 60 + i) * 30 * z;
        const y =
          (((random(`${seed}y${i}`) * height - frame * 0.4 * z) % height) +
            height) %
          height;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={1 + z * 2.4}
            fill={color}
            opacity={0.15 + z * 0.45}
          />
        );
      })}
    </svg>
  );
};

/** Grano de película + viñeta: unifica el aspecto de todas las escenas con un coste mínimo. */
export const FilmLook: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  // Tesela de ruido generada una vez; cada fotograma se pinta desplazada (en Canvas, sin cargas asíncronas).
  const tile = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = random(`grain${i}`) * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }, []);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx || !tile) return;
    const pattern = ctx.createPattern(tile, "repeat")!;
    ctx.setTransform(
      1,
      0,
      0,
      1,
      random(`gx${frame}`) * 256,
      random(`gy${frame}`) * 256,
    );
    ctx.fillStyle = pattern;
    ctx.fillRect(-256, -256, width + 512, height + 512);
  }, [frame, tile, width, height]);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <canvas
        ref={ref}
        width={width}
        height={height}
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.05,
          mixBlendMode: "overlay",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

/** Movimiento de cámara suave sobre una escena vectorial (zoom + desplazamiento por keyframes). */
export const CameraRig: React.FC<{
  keys: {
    f: number;
    scale?: number;
    x?: number;
    y?: number;
    rotate?: number;
  }[];
  children: React.ReactNode;
}> = ({ keys, children }) => {
  const frame = useCurrentFrame();
  const at = (prop: "scale" | "x" | "y" | "rotate", def: number) => {
    const fs = keys.map((k) => k.f);
    const vs = keys.map((k) => k[prop] ?? def);
    if (fs.length === 1) return vs[0];
    const i = fs.findIndex((f) => f > frame);
    if (i === -1) return vs[vs.length - 1];
    if (i === 0) return vs[0];
    const t = (frame - fs[i - 1]) / (fs[i] - fs[i - 1]);
    const e = t * t * (3 - 2 * t); // smoothstep: sin tirones entre keyframes
    return vs[i - 1] + (vs[i] - vs[i - 1]) * e;
  };
  return (
    <AbsoluteFill
      style={{
        scale: String(at("scale", 1)),
        translate: `${at("x", 0)}px ${at("y", 0)}px`,
        rotate: `${at("rotate", 0)}deg`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

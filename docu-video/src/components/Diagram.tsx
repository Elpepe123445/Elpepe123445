import React from "react";
import { C, fonts } from "../engine/theme";

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Punto a `r` del centro en el ángulo `deg` (0° = derecha, 90° = arriba, como en matemáticas). */
export const polar = (
  cx: number,
  cy: number,
  r: number,
  deg: number,
): [number, number] => [
  cx + r * Math.cos(rad(deg)),
  cy - r * Math.sin(rad(deg)),
];

/**
 * Trazo que se dibuja de 0 a 1 (stroke-dashoffset normalizado con pathLength).
 * No usa `non-scaling-stroke` (rompe la normalización con zoom): bajo una cámara con escala,
 * pasa `k` para que el grosor se vea constante en pantalla.
 */
export const DrawPath: React.FC<{
  d: string;
  progress: number;
  color?: string;
  width?: number;
  dashed?: boolean;
  opacity?: number;
  glow?: boolean;
  k?: number;
}> = ({
  d,
  progress,
  color = C.gold,
  width = 3,
  dashed = false,
  opacity = 1,
  glow = false,
  k = 1,
}) => {
  if (progress <= 0) return null;
  const w = width * k;
  return (
    <g opacity={opacity}>
      {glow ? (
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={w * 4}
          strokeOpacity={0.18}
          pathLength={1}
          strokeDasharray={`${progress} 1`}
          strokeLinecap="round"
        />
      ) : null}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={w}
        pathLength={dashed ? undefined : 1}
        strokeDasharray={dashed ? `${10 * k} ${12 * k}` : `${progress} 1`}
        strokeLinecap="round"
        opacity={dashed ? Math.min(1, progress * 2) : 1}
      />
    </g>
  );
};

/** Arco de ángulo entre `a0` y `a1` grados, que crece con `progress`. */
export const AngleArc: React.FC<{
  cx: number;
  cy: number;
  r: number;
  a0: number;
  a1: number;
  progress: number;
  color?: string;
  width?: number;
  fill?: boolean;
}> = ({
  cx,
  cy,
  r,
  a0,
  a1,
  progress,
  color = C.gold,
  width = 4,
  fill = false,
}) => {
  if (progress <= 0) return null;
  const end = a0 + (a1 - a0) * progress;
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, end);
  const large = Math.abs(end - a0) > 180 ? 1 : 0;
  const sweep = end > a0 ? 0 : 1;
  const arc = `M ${x0} ${y0} A ${r} ${r} 0 ${large} ${sweep} ${x1} ${y1}`;
  return (
    <g>
      {fill ? (
        <path
          d={`M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} ${sweep} ${x1} ${y1} Z`}
          fill={color}
          opacity={0.22}
        />
      ) : null}
      <path
        d={arc}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
};

/** Vara vertical (gnomon) con su sombra. `tilt` en grados respecto a la vertical (+ = hacia la izquierda). */
export const Gnomon: React.FC<{
  x: number;
  y: number;
  height: number;
  tilt?: number;
  shadow: number;
  /** Dirección de la sombra a lo largo del suelo (grados, 0 = derecha). */
  shadowDir?: number;
  color?: string;
  opacity?: number;
}> = ({
  x,
  y,
  height,
  tilt = 0,
  shadow,
  shadowDir = 180,
  color = C.papyrus,
  opacity = 1,
}) => {
  const [tx, ty] = polar(x, y, height, 90 + tilt);
  const [sx, sy] = polar(x, y, shadow, shadowDir);
  return (
    <g opacity={opacity}>
      {shadow > 0.5 ? (
        <line
          x1={x}
          y1={y}
          x2={sx}
          y2={sy}
          stroke="#000"
          strokeOpacity={0.7}
          strokeWidth={16}
          strokeLinecap="round"
        />
      ) : null}
      <line
        x1={x}
        y1={y}
        x2={tx}
        y2={ty}
        stroke={color}
        strokeWidth={11}
        strokeLinecap="round"
      />
      <circle cx={tx} cy={ty} r={7} fill={color} />
    </g>
  );
};

/** Sol con halo (gradiente radial) y corona girando. */
export const Sun: React.FC<{
  x: number;
  y: number;
  r: number;
  spin?: number;
  intensity?: number;
  id?: string;
}> = ({ x, y, r, spin = 0, intensity = 1, id = "sun" }) => (
  <g opacity={intensity}>
    <defs>
      <radialGradient id={`${id}-halo`}>
        <stop offset="0%" stopColor="#FFE9B0" stopOpacity={0.9} />
        <stop offset="35%" stopColor={C.gold} stopOpacity={0.35} />
        <stop offset="100%" stopColor={C.gold} stopOpacity={0} />
      </radialGradient>
    </defs>
    <circle cx={x} cy={y} r={r * 4} fill={`url(#${id}-halo)`} />
    <g transform={`rotate(${spin} ${x} ${y})`}>
      {new Array(12).fill(0).map((_, i) => {
        const [x0, y0] = polar(x, y, r * 1.25, i * 30);
        const [x1, y1] = polar(x, y, r * 1.6, i * 30);
        return (
          <line
            key={i}
            x1={x0}
            y1={y0}
            x2={x1}
            y2={y1}
            stroke="#FFE3A0"
            strokeWidth={4}
            strokeLinecap="round"
            opacity={0.8}
          />
        );
      })}
    </g>
    <circle cx={x} cy={y} r={r} fill="#FFE9B0" />
  </g>
);

/** Etiqueta de diagrama (SVG) con contorno para legibilidad sobre cualquier fondo. */
export const Label: React.FC<{
  x: number;
  y: number;
  children: React.ReactNode;
  size?: number;
  color?: string;
  anchor?: "start" | "middle" | "end";
  opacity?: number;
  display?: boolean;
  weight?: number;
}> = ({
  x,
  y,
  children,
  size = 36,
  color = C.text,
  anchor = "middle",
  opacity = 1,
  display = false,
  weight = 600,
}) => (
  <text
    x={x}
    y={y}
    fill={color}
    fontSize={size}
    fontFamily={display ? fonts.display : fonts.body}
    fontWeight={weight}
    textAnchor={anchor}
    opacity={opacity}
    style={{
      paintOrder: "stroke",
      stroke: "rgba(5,8,16,0.75)",
      strokeWidth: size / 6,
    }}
  >
    {children}
  </text>
);

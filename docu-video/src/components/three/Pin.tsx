import React from "react";

const FONT = "Inter, DejaVu Sans, sans-serif";

/** Chincheta 2D con rótulo, para señalar un punto proyectado desde una escena 3D. */
export const Pin: React.FC<{
  x: number;
  y: number;
  /** Desplazamiento del rótulo respecto al punto. */
  dx: number;
  dy: number;
  o: number;
  label: string;
  size?: number;
}> = ({ x, y, dx, dy, o, label, size = 46 }) => (
  <>
    <svg
      width="100%"
      height="100%"
      style={{ position: "absolute", inset: 0, opacity: o }}
    >
      <line
        x1={x}
        y1={y}
        x2={x + dx}
        y2={y + dy}
        stroke="#FFFFFF"
        strokeWidth={3}
      />
      <circle cx={x} cy={y} r={10} fill="#FFFFFF" />
      <circle
        cx={x}
        cy={y}
        r={10 + 16 * o}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={3}
        opacity={0.6}
      />
    </svg>
    <div
      style={{
        position: "absolute",
        left: x + dx,
        top: y + dy,
        translate: `${dx < 0 ? "-100%" : "0"} -50%`,
        opacity: o,
        scale: String(0.8 + 0.2 * o),
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: size,
        whiteSpace: "nowrap",
        color: "#12060C",
        background: "#FFFFFF",
        padding: "6px 22px",
        borderRadius: 16,
        boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
      }}
    >
      {label}
    </div>
  </>
);

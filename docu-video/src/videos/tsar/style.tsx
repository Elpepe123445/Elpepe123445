import React from "react";
import { AbsoluteFill } from "remotion";

/** Paleta "archivo de la Guerra Fría": acero y hielo del Ártico, fuego solo donde hay fuego. */
export const T = {
  bg: "#05080C",
  ice: "#CFE3F2",
  steel: "#6E8299",
  slate: "#1A2633",
  fire: "#FF7A1A",
  ember: "#FFB15C",
  flash: "#FFF6E0",
  red: "#D7263D",
  paper: "#E9E2D0",
};

export const mono = "DejaVu Sans Mono, monospace";
export const heavy = "Inter, DejaVu Sans, sans-serif";

/** Líneas de escaneo muy sutiles: textura de película de archivo sin coste de render. */
export const Scanlines: React.FC<{ opacity?: number }> = ({
  opacity = 0.06,
}) => (
  <AbsoluteFill
    style={{
      background:
        "repeating-linear-gradient(0deg, rgba(255,255,255,0.9) 0 1px, transparent 1px 4px)",
      opacity,
      mixBlendMode: "overlay",
      pointerEvents: "none",
    }}
  />
);

/** Etiqueta técnica (monoespaciada) para rótulos tipo informe clasificado. */
export const Tech: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div
    style={{
      fontFamily: mono,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      ...style,
    }}
  >
    {children}
  </div>
);

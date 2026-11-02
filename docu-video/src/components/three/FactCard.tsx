import React from "react";

const FONT = "Inter, DejaVu Sans, sans-serif";

/** Tarjeta de dato grande, estilo «cristal», para superponer a escenas 3D verticales. */
export const FactCard: React.FC<{
  top: number;
  o: number;
  big: string;
  small?: string;
  color?: string;
  size?: number;
}> = ({ top, o, big, small, color = "#FFFFFF", size = 70 }) => (
  <div
    style={{
      position: "absolute",
      top,
      left: 0,
      right: 0,
      display: "flex",
      justifyContent: "center",
      opacity: o,
      translate: `0 ${(1 - o) * 24}px`,
    }}
  >
    <div
      style={{
        maxWidth: 900,
        padding: "22px 40px",
        borderRadius: 28,
        background:
          "linear-gradient(160deg, rgba(24,18,14,0.62), rgba(24,18,14,0.38))",
        border: "1.5px solid rgba(255,255,255,0.24)",
        boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
        backdropFilter: "blur(6px)",
        textAlign: "center",
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          fontWeight: 900,
          fontSize: size,
          lineHeight: 1.05,
          color,
          textShadow: `0 0 34px ${color}66`,
        }}
      >
        {big}
      </div>
      {small ? (
        <div
          style={{
            fontWeight: 700,
            fontSize: 30,
            color: "#E6E1D8",
            marginTop: 10,
          }}
        >
          {small}
        </div>
      ) : null}
    </div>
  </div>
);

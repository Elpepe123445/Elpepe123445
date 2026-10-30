import React, { useLayoutEffect, useRef } from "react";
import { useCurrentFrame } from "remotion";

/**
 * Comparación por unidades: `count` puntos que se encienden en orden (p. ej. 1 punto = 1 Hiroshima).
 * Se pinta en Canvas porque pueden ser miles de elementos.
 */
export const DotGrid: React.FC<{
  count: number;
  columns: number;
  width: number;
  /** Puntos encendidos ahora mismo (0…count). */
  lit: number;
  color: string;
  dim?: string;
  /** Destaca el primer punto (la unidad de referencia). */
  highlightFirst?: string;
}> = ({
  count,
  columns,
  width,
  lit,
  color,
  dim = "rgba(255,255,255,0.08)",
  highlightFirst,
}) => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const cell = width / columns;
  const rows = Math.ceil(count / columns);
  const height = Math.ceil(rows * cell);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    const r = cell * 0.36;
    for (let i = 0; i < count; i++) {
      const x = (i % columns) * cell + cell / 2;
      const y = Math.floor(i / columns) * cell + cell / 2;
      const on = i < lit;
      ctx.fillStyle =
        i === 0 && highlightFirst ? highlightFirst : on ? color : dim;
      ctx.beginPath();
      ctx.arc(x, y, i === 0 && highlightFirst ? r * 1.6 : r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [
    frame,
    count,
    columns,
    width,
    height,
    cell,
    lit,
    color,
    dim,
    highlightFirst,
  ]);
  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{ display: "block" }}
    />
  );
};

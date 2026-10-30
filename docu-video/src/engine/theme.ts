import { loadFont } from "@remotion/fonts";
import { Easing, interpolate, staticFile } from "remotion";

// Fuentes locales (OFL, en public/fonts): el render no depende de la red.
loadFont({
  family: "Cinzel",
  url: staticFile("fonts/Cinzel-Variable.woff2"),
  weight: "400 900",
});
loadFont({
  family: "Inter",
  url: staticFile("fonts/Inter-Variable.woff2"),
  weight: "100 900",
});

export const fonts = {
  display: "Cinzel, DejaVu Serif, serif",
  body: "Inter, DejaVu Sans, sans-serif",
};

export const C = {
  night: "#070B14",
  navy: "#0C1526",
  ink: "#13203A",
  line: "#2A3A5C",
  gold: "#F4B740",
  goldSoft: "#F9D88A",
  cyan: "#4FD1E8",
  papyrus: "#EAD9B8",
  sand: "#C9A66B",
  terracotta: "#C2562F",
  text: "#F3EEE3",
  muted: "#8C96AB",
  red: "#E8665A",
};

export const ease = Easing.bezier(0.16, 1, 0.3, 1);
export const inOut = Easing.bezier(0.65, 0, 0.35, 1);

/** Progreso 0→1 entre `start` y `start + duration` (fotogramas), con recorte y easing. */
export const prog = (
  frame: number,
  start: number,
  duration: number,
  easing = ease,
) =>
  interpolate(frame, [start, start + Math.max(1, duration)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

/** Entra en `start`, sale en `end` (ambos con fundido de `fade` fotogramas). */
export const visible = (frame: number, start: number, end: number, fade = 12) =>
  Math.min(prog(frame, start, fade), 1 - prog(frame, end - fade, fade, inOut));

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Formato numérico español: 250.000 · 7,2 (agrupa también los números de 4 cifras). */
export const fmt = (value: number, decimals = 0) => {
  const [int, dec] = value.toFixed(decimals).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return dec ? `${grouped},${dec}` : grouped;
};

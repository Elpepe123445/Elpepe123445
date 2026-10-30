import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, fonts, prog, inOut } from "../engine/theme";

type Props = {
  text: string;
  /** Fotograma (local) en que empieza a entrar la primera palabra. */
  start: number;
  /** Fotograma en que sale el bloque completo (opcional). */
  exit?: number;
  stagger?: number;
  /** Palabras que se resaltan con el color de acento. */
  highlight?: string[];
  accent?: string;
  style?: React.CSSProperties;
  /** "rise": sube desde abajo · "blur": aparece desde desenfoque · "track": se abre el tracking. */
  mode?: "rise" | "blur" | "track";
};

/** Texto cinético palabra a palabra, impulsado por `spring()`. */
export const KineticText: React.FC<Props> = ({
  text,
  start,
  exit,
  stagger = 3,
  highlight = [],
  accent = C.gold,
  style,
  mode = "rise",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = exit === undefined ? 0 : prog(frame, exit, 14, inOut);
  const words = text.split(" ");

  return (
    <div
      style={{
        fontFamily: fonts.display,
        color: C.text,
        display: "flex",
        flexWrap: "wrap",
        columnGap: "0.28em",
        opacity: 1 - out,
        translate: `0 ${-out * 24}px`,
        ...style,
      }}
    >
      {words.map((w, i) => {
        const s = spring({
          frame: frame - start - i * stagger,
          fps,
          config: { damping: 200, mass: 0.7 },
        });
        const isHi = highlight.some((h) =>
          w.toLowerCase().includes(h.toLowerCase()),
        );
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: s,
              color: isHi ? accent : undefined,
              translate: mode === "rise" ? `0 ${(1 - s) * 0.6}em` : undefined,
              filter: mode !== "track" ? `blur(${(1 - s) * 10}px)` : undefined,
              letterSpacing:
                mode === "track" ? `${(1 - s) * 0.5 + 0.04}em` : undefined,
              textShadow: isHi
                ? `0 0 28px ${accent}66`
                : "0 4px 30px rgba(0,0,0,0.5)",
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

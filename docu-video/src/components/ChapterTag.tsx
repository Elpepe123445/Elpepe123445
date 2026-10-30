import React from "react";
import { useCurrentFrame } from "remotion";
import { C, fonts, prog, visible } from "../engine/theme";

/** Rótulo de capítulo ("III · El ángulo"): una línea dorada que se dibuja y el texto que se abre. */
export const ChapterTag: React.FC<{
  label: string;
  start?: number;
  hold?: number;
}> = ({ label, start = 18, hold = 150 }) => {
  const frame = useCurrentFrame();
  const [num, title] = label.split(" · ");
  const line = prog(frame, start, 24);
  const o = visible(frame, start, start + hold, 16);
  return (
    <div
      style={{
        position: "absolute",
        left: 110,
        top: 86,
        opacity: o,
        fontFamily: fonts.display,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <span
          style={{
            color: C.gold,
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: "0.12em",
          }}
        >
          {num}
        </span>
        <span style={{ width: 90 * line, height: 2, background: C.gold }} />
        <span
          style={{
            color: C.text,
            fontSize: 34,
            letterSpacing: `${0.32 - 0.14 * prog(frame, start + 6, 30)}em`,
            textTransform: "uppercase",
            opacity: prog(frame, start + 6, 20),
          }}
        >
          {title}
        </span>
      </div>
    </div>
  );
};

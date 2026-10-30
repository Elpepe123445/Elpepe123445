import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, fonts } from "../engine/theme";

export type SubtitleCue = {
  text: string;
  from: number;
  durationInFrames: number;
};

/** Divide una frase en "páginas" cortas (≤ maxChars), cortando en signos de puntuación o espacios. */
export const paginate = (cue: SubtitleCue, maxChars = 58): SubtitleCue[] => {
  const words = cue.text.split(" ");
  const pages: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxChars && cur) {
      pages.push(cur);
      cur = w;
    } else {
      cur = next;
      if (/[.:;?!…]$/.test(w) && cur.length > maxChars * 0.55) {
        pages.push(cur);
        cur = "";
      }
    }
  }
  if (cur) pages.push(cur);
  const total = pages.reduce((n, p) => n + p.length, 0);
  let t = cue.from;
  return pages.map((p) => {
    const d = Math.round((p.length / total) * cue.durationInFrames);
    const page = { text: p, from: t, durationInFrames: d };
    t += d;
    return page;
  });
};

/** Subtítulos integrados (opcionales) a partir de las frases de la narración. */
export const Subtitles: React.FC<{ cues: SubtitleCue[] }> = ({ cues }) => {
  const frame = useCurrentFrame();
  const page = cues
    .flatMap((c) => paginate(c))
    .find((p) => frame >= p.from && frame < p.from + p.durationInFrames + 6);
  if (!page) return null;
  const o = interpolate(
    frame,
    [
      page.from,
      page.from + 5,
      page.from + page.durationInFrames,
      page.from + page.durationInFrames + 6,
    ],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 64,
        display: "flex",
        justifyContent: "center",
        opacity: o,
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          padding: "12px 28px",
          borderRadius: 12,
          background: "rgba(5,8,16,0.62)",
          color: C.text,
          fontFamily: fonts.body,
          fontSize: 40,
          lineHeight: 1.3,
          fontWeight: 400,
          textAlign: "center",
        }}
      >
        {page.text}
      </div>
    </div>
  );
};

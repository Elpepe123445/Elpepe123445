import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { VoiceWords } from "../engine/timeline";
import { C, fonts } from "../engine/theme";

type Line = {
  id: string;
  text: string;
  from: number;
  durationInFrames: number;
};
type Word = { text: string; from: number };

/**
 * Tiempo de cada palabra del texto en pantalla. Si la alineación de Whisper tiene el mismo
 * número de palabras se usa tal cual; si no (p. ej. "2.200" → "2" ".200"), se reparte por letras.
 */
const timeWords = (line: Line, words: VoiceWords, fps: number): Word[] => {
  const tokens = line.text.split(" ");
  const heard = words[line.id] ?? [];
  if (heard.length === tokens.length) {
    return tokens.map((t, i) => ({
      text: t,
      from: line.from + Math.round(heard[i][1] * fps),
    }));
  }
  const total = tokens.reduce((n, t) => n + t.length + 1, 0);
  let acc = 0;
  return tokens.map((t) => {
    const w = {
      text: t,
      from: line.from + Math.round((acc / total) * line.durationInFrames),
    };
    acc += t.length + 1;
    return w;
  });
};

/** Agrupa en bloques cortos (≤ maxWords), cortando también tras un signo de puntuación. */
const chunk = (ws: Word[], maxWords: number): Word[][] => {
  const out: Word[][] = [];
  let cur: Word[] = [];
  for (const w of ws) {
    cur.push(w);
    if (cur.length >= maxWords || /[.,:;?!…]$/.test(w.text)) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
};

/** Subtítulos estilo TikTok/Reels: bloques de pocas palabras, la palabra dicha resaltada. */
export const WordCaptions: React.FC<{
  lines: Line[];
  words: VoiceWords;
  top: number;
  maxWords?: number;
  fontSize?: number;
  accent?: string;
}> = ({ lines, words, top, maxWords = 3, fontSize = 92, accent = C.gold }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const blocks = lines.flatMap((l) => {
    const cs = chunk(timeWords(l, words, fps), maxWords);
    const end = l.from + l.durationInFrames + 4;
    return cs.map((c, i) => ({
      words: c,
      from: c[0].from,
      to: i < cs.length - 1 ? cs[i + 1][0].from : end,
    }));
  });
  const block = blocks.find((b) => frame >= b.from && frame < b.to);
  if (!block) return null;
  const pop = spring({
    frame: frame - block.from,
    fps,
    config: { damping: 14, mass: 0.5, stiffness: 180 },
  });
  return (
    <div
      style={{
        position: "absolute",
        left: 70,
        right: 70,
        top,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          columnGap: "0.3em",
          scale: String(0.85 + 0.15 * pop),
          fontFamily: fonts.body,
          fontWeight: 900,
          fontSize,
          lineHeight: 1.1,
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        {block.words.map((w, i) => {
          const spoken = frame >= w.from;
          return (
            <span
              key={i}
              style={{
                color: spoken
                  ? i === block.words.filter((x) => frame >= x.from).length - 1
                    ? accent
                    : C.text
                  : "rgba(243,238,227,0.55)",
                WebkitTextStroke: "3px #000",
                paintOrder: "stroke fill",
                textShadow: "0 6px 0 rgba(0,0,0,0.6), 0 0 30px rgba(0,0,0,0.6)",
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};

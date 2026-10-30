import React, { createContext, useContext } from "react";

/** Generado por scripts/plan.py — fuente única de sincronía entre voz, escenas y música. */
export type PlanLine = {
  id: string;
  text: string;
  /** Inicio relativo a la escena (fotogramas). */
  from: number;
  durationInFrames: number;
};

export type PlanScene = {
  id: string;
  chapter: string | null;
  /** Inicio absoluto en el video (fotogramas). */
  from: number;
  durationInFrames: number;
  lines: PlanLine[];
};

export type Plan = {
  fps: number;
  transitionFrames: number;
  durationInFrames: number;
  scenes: PlanScene[];
};

/** Generado por scripts/align.py: [palabra, inicio_s, fin_s] relativos a cada clip de voz. */
export type VoiceWords = Record<string, [string, number, number][]>;

type SceneCtx = { scene: PlanScene; words: VoiceWords; fps: number };

const Ctx = createContext<SceneCtx | null>(null);

export const SceneProvider: React.FC<
  SceneCtx & { children: React.ReactNode }
> = ({ children, ...value }) => (
  <Ctx.Provider value={value}>{children}</Ctx.Provider>
);

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ]/g, "");

/**
 * Marcas de tiempo de una escena, en fotogramas locales.
 * `word(lineId, "sombra")` devuelve el instante en que la voz dice esa palabra.
 */
export const makeCues = ({ scene, words, fps }: SceneCtx) => {
  const line = (id: string) => {
    const found = scene.lines.find((l) => l.id === id);
    if (!found)
      throw new Error(`Línea "${id}" no existe en la escena "${scene.id}"`);
    return found;
  };

  const word = (
    id: string,
    needle: string,
    edge: "start" | "end" = "start",
    nth = 0,
  ) => {
    const l = line(id);
    const target = normalize(needle);
    const matches = (words[id] ?? []).filter(([w]) =>
      normalize(w).includes(target),
    );
    const hit = matches[Math.min(nth, matches.length - 1)];
    if (hit)
      return l.from + Math.round((edge === "start" ? hit[1] : hit[2]) * fps);
    // Respaldo: posición proporcional dentro del texto (la locución es casi uniforme).
    const text = normalize(l.text);
    const idx = Math.max(0, text.indexOf(target));
    return (
      l.from + Math.round((idx / Math.max(1, text.length)) * l.durationInFrames)
    );
  };

  return {
    fps,
    duration: scene.durationInFrames,
    start: (id: string, offsetSeconds = 0) =>
      line(id).from + Math.round(offsetSeconds * fps),
    end: (id: string, offsetSeconds = 0) =>
      line(id).from +
      line(id).durationInFrames +
      Math.round(offsetSeconds * fps),
    word,
  };
};

export type Cues = ReturnType<typeof makeCues>;

/** Marcas de tiempo de la escena actual (dentro de <SceneProvider>). */
export const useCues = (): Cues => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCues() necesita <SceneProvider>");
  return makeCues(ctx);
};

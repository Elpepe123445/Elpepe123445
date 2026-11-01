import {
  linearTiming,
  TransitionSeries,
  type TransitionPresentation,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import React from "react";
import { AbsoluteFill, staticFile } from "remotion";
import { FilmLook } from "../components/Atmosphere";
import {
  MusicBed,
  Narration,
  SfxTrack,
  type SfxCue,
} from "../components/Soundtrack";
import { WordCaptions } from "../components/WordCaptions";
import {
  makeCues,
  SceneProvider,
  type Cues,
  type Plan,
  type VoiceWords,
} from "./timeline";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyPresentation = TransitionPresentation<any>;

export type ShortConfig = {
  plan: Plan;
  words: VoiceWords;
  /** Carpeta en public/ con voice/, music.wav y sfx/. */
  folder: string;
  scenes: Record<string, React.FC>;
  transitions?: Record<string, () => AnyPresentation>;
  /** Efectos: recibe un ayudante para obtener fotogramas absolutos de palabras/escenas. */
  sfx?: (at: (sceneId: string) => { from: number; cues: Cues }) => SfxCue[];
  captions: { top: number; fontSize?: number; accent: string };
  background: string;
  music?: { under: number; open: number };
  filmGrain?: boolean;
};

/** Composición genérica para videos cortos: escenas + transiciones + voz + música + efectos + subtítulos. */
export const makeShort = (cfg: ShortConfig): React.FC => {
  const { plan, words, folder } = cfg;
  const lines = plan.scenes.flatMap((s) =>
    s.lines.map((l) => ({ ...l, from: s.from + l.from })),
  );
  const at = (id: string) => {
    const scene = plan.scenes.find((s) => s.id === id);
    if (!scene) throw new Error(`Escena "${id}" no existe`);
    return {
      from: scene.from,
      cues: makeCues({ scene, words, fps: plan.fps }),
    };
  };
  const sfx = cfg.sfx ? cfg.sfx(at) : [];
  const Short: React.FC = () => (
    <AbsoluteFill style={{ background: cfg.background }}>
      <TransitionSeries>
        {plan.scenes.flatMap((s, i) => {
          const Comp = cfg.scenes[s.id];
          return [
            ...(i > 0
              ? [
                  <TransitionSeries.Transition
                    key={`t-${s.id}`}
                    presentation={(cfg.transitions?.[s.id] ?? fade)()}
                    timing={linearTiming({
                      durationInFrames: plan.transitionFrames,
                    })}
                  />,
                ]
              : []),
            <TransitionSeries.Sequence
              key={s.id}
              name={s.id}
              durationInFrames={s.durationInFrames}
            >
              <SceneProvider scene={s} words={words} fps={plan.fps}>
                <Comp />
              </SceneProvider>
            </TransitionSeries.Sequence>,
          ];
        })}
      </TransitionSeries>
      {cfg.filmGrain === false ? null : <FilmLook />}
      <WordCaptions
        lines={lines}
        words={words}
        top={cfg.captions.top}
        fontSize={cfg.captions.fontSize ?? 84}
        accent={cfg.captions.accent}
      />
      <Narration folder={folder} clips={lines} />
      <MusicBed
        src={staticFile(`${folder}/music.wav`)}
        clips={lines}
        durationInFrames={plan.durationInFrames}
        under={cfg.music?.under ?? 0.38}
        open={cfg.music?.open ?? 0.65}
      />
      <SfxTrack folder={folder} cues={sfx} />
    </AbsoluteFill>
  );
  return Short;
};

import {
  linearTiming,
  TransitionSeries,
  type TransitionPresentation,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import React from "react";
import { AbsoluteFill, staticFile } from "remotion";
import { FilmLook } from "../../components/Atmosphere";
import {
  MusicBed,
  Narration,
  SfxTrack,
  type SfxCue,
} from "../../components/Soundtrack";
import { blurDissolve, lightFlash } from "../../components/transitions";
import { WordCaptions } from "../../components/WordCaptions";
import { C } from "../../engine/theme";
import {
  makeCues,
  SceneProvider,
  type Plan,
  type VoiceWords,
} from "../../engine/timeline";
import planJson from "./plan.json";
import wordsJson from "./voice-words.json";
import { ShortAngle, ShortHook, ShortMeasure, ShortShadows } from "./scenes";

export const shortPlan = planJson as Plan;
const words = wordsJson as unknown as VoiceWords;
const FOLDER = "eratostenes-short";

const SCENES: Record<string, React.FC> = {
  hook: ShortHook,
  sombras: ShortShadows,
  angulo: ShortAngle,
  medida: ShortMeasure,
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TRANSITIONS: Record<string, () => TransitionPresentation<any>> = {
  sombras: lightFlash,
  angulo: blurDissolve,
  medida: fade,
};

const lines = shortPlan.scenes.flatMap((s) =>
  s.lines.map((l) => ({ ...l, from: s.from + l.from })),
);

const sfx = (): SfxCue[] => {
  const scene = (id: string) => shortPlan.scenes.find((s) => s.id === id)!;
  const cue = (id: string) =>
    makeCues({ scene: scene(id), words, fps: shortPlan.fps });
  const medida = scene("medida");
  return [
    ...shortPlan.scenes
      .slice(1)
      .map((s) => ({ at: s.from - 3, name: "whoosh", volume: 0.3 })),
    {
      at: scene("angulo").from + cue("angulo").word("s5", "cincuentavo"),
      name: "shimmer",
      volume: 0.35,
    },
    {
      at: medida.from + cue("medida").start("s6"),
      name: "riser",
      volume: 0.25,
    },
    {
      at: medida.from + cue("medida").word("s6", "mundo"),
      name: "boom",
      volume: 0.6,
    },
  ];
};

/** Versión vertical de 15 s para TikTok / Reels / Shorts. */
export const EratostenesShort: React.FC = () => (
  <AbsoluteFill style={{ background: C.night }}>
    <TransitionSeries>
      {shortPlan.scenes.flatMap((s, i) => {
        const Comp = SCENES[s.id];
        return [
          ...(i > 0
            ? [
                <TransitionSeries.Transition
                  key={`t-${s.id}`}
                  presentation={(TRANSITIONS[s.id] ?? fade)()}
                  timing={linearTiming({
                    durationInFrames: shortPlan.transitionFrames,
                  })}
                />,
              ]
            : []),
          <TransitionSeries.Sequence
            key={s.id}
            name={s.id}
            durationInFrames={s.durationInFrames}
          >
            <SceneProvider scene={s} words={words} fps={shortPlan.fps}>
              <Comp />
            </SceneProvider>
          </TransitionSeries.Sequence>,
        ];
      })}
    </TransitionSeries>
    <FilmLook />
    <WordCaptions lines={lines} words={words} top={1250} />
    <Narration folder={FOLDER} clips={lines} />
    <MusicBed
      src={staticFile(`${FOLDER}/music.wav`)}
      clips={lines}
      durationInFrames={shortPlan.durationInFrames}
      under={0.4}
      open={0.7}
    />
    <SfxTrack folder={FOLDER} cues={sfx()} />
  </AbsoluteFill>
);

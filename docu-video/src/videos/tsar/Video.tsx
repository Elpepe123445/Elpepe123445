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
import {
  makeCues,
  SceneProvider,
  type Plan,
  type VoiceWords,
} from "../../engine/timeline";
import planJson from "./plan.json";
import { ZDrop, ZHook, ZPlace } from "./scenesA";
import { ZBoom, ZLegacy, ZReach, ZScale } from "./scenesB";
import { T } from "./style";
import wordsJson from "./voice-words.json";

export const tsarPlan = planJson as Plan;
const words = wordsJson as unknown as VoiceWords;
const FOLDER = "tsar";

const SCENES: Record<string, React.FC> = {
  "z-hook": ZHook,
  "z-lugar": ZPlace,
  "z-caida": ZDrop,
  "z-boom": ZBoom,
  "z-alcance": ZReach,
  "z-escala": ZScale,
  "z-legado": ZLegacy,
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TRANSITIONS: Record<string, () => TransitionPresentation<any>> = {
  "z-lugar": blurDissolve,
  "z-caida": fade,
  "z-boom": lightFlash,
  "z-alcance": blurDissolve,
  "z-escala": blurDissolve,
  "z-legado": fade,
};

const lines = tsarPlan.scenes.flatMap((s) =>
  s.lines.map((l) => ({ ...l, from: s.from + l.from })),
);

const sfx = (): SfxCue[] => {
  const scene = (id: string) => tsarPlan.scenes.find((s) => s.id === id)!;
  const cues = (id: string) =>
    makeCues({ scene: scene(id), words, fps: tsarPlan.fps });
  const drop = scene("z-caida");
  const boom = scene("z-boom");
  return [
    ...tsarPlan.scenes
      .slice(1)
      .filter((s) => s.id !== "z-boom")
      .map((s) => ({ at: s.from - 3, name: "whoosh", volume: 0.25 })),
    {
      at: scene("z-hook").from + cues("z-hook").word("z1", "media") - 4,
      name: "tick",
      volume: 0.5,
    },
    {
      at: drop.from + cues("z-caida").end("z4") - 60,
      name: "riser",
      volume: 0.35,
    },
    { at: boom.from - 6, name: "boom", volume: 0.55 },
    { at: boom.from + 10, name: "boom", volume: 0.3 },
    {
      at: scene("z-lugar").from + cues("z-lugar").word("z2", "1961"),
      name: "tick",
      volume: 0.4,
    },
  ];
};

/** «La Bomba del Zar» — vertical, 1 minuto. */
export const TsarVideo: React.FC = () => (
  <AbsoluteFill style={{ background: T.bg }}>
    <TransitionSeries>
      {tsarPlan.scenes.flatMap((s, i) => {
        const Comp = SCENES[s.id];
        return [
          ...(i > 0
            ? [
                <TransitionSeries.Transition
                  key={`t-${s.id}`}
                  presentation={(TRANSITIONS[s.id] ?? fade)()}
                  timing={linearTiming({
                    durationInFrames: tsarPlan.transitionFrames,
                  })}
                />,
              ]
            : []),
          <TransitionSeries.Sequence
            key={s.id}
            name={s.id}
            durationInFrames={s.durationInFrames}
          >
            <SceneProvider scene={s} words={words} fps={tsarPlan.fps}>
              <Comp />
            </SceneProvider>
          </TransitionSeries.Sequence>,
        ];
      })}
    </TransitionSeries>
    <FilmLook />
    <WordCaptions
      lines={lines}
      words={words}
      top={1340}
      fontSize={84}
      accent={T.ember}
    />
    <Narration folder={FOLDER} clips={lines} />
    <MusicBed
      src={staticFile(`${FOLDER}/music.wav`)}
      clips={lines}
      durationInFrames={tsarPlan.durationInFrames}
      under={0.38}
      open={0.65}
    />
    <SfxTrack folder={FOLDER} cues={sfx()} />
  </AbsoluteFill>
);

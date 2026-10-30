import {
  linearTiming,
  TransitionSeries,
  type TransitionPresentation,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import React from "react";
import { AbsoluteFill, staticFile } from "remotion";
import { FilmLook } from "../../components/Atmosphere";
import {
  MusicBed,
  Narration,
  SfxTrack,
  type SfxCue,
} from "../../components/Soundtrack";
import { Subtitles } from "../../components/Subtitles";
import { blurDissolve, lightFlash } from "../../components/transitions";
import { C } from "../../engine/theme";
import {
  makeCues,
  SceneProvider,
  type Plan,
  type PlanScene,
  type VoiceWords,
} from "../../engine/timeline";
import planJson from "./plan.json";
import wordsJson from "./voice-words.json";
import { SCENES } from "./scenes";

export const plan = planJson as Plan;
const words = wordsJson as unknown as VoiceWords;
const FOLDER = "eratostenes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPresentation = TransitionPresentation<any>;

/** Transición de entrada de cada escena (la primera no tiene). */
const TRANSITIONS: Record<string, () => AnyPresentation> = {
  alejandria: lightFlash,
  mapa: blurDissolve,
  sombras: () => wipe({ direction: "from-left" }),
  rayos: blurDissolve,
  geometria: fade,
  calculo: blurDissolve,
  comparacion: () => slide({ direction: "from-right" }),
  legado: blurDissolve,
  cierre: lightFlash,
};

/** Líneas con fotograma absoluto (para voz y subtítulos). */
const absoluteLines = plan.scenes.flatMap((s) =>
  s.lines.map((l) => ({ ...l, from: s.from + l.from })),
);

/** Efectos de sonido anclados a palabras de la narración o a los cortes de escena. */
const sfxCues = (): SfxCue[] => {
  const at = (sceneId: string) => {
    const scene = plan.scenes.find((s) => s.id === sceneId)!;
    return { s: scene, c: makeCues({ scene, words, fps: plan.fps }) };
  };
  const cues: SfxCue[] = plan.scenes
    .slice(1)
    .map((s) => ({ at: s.from - 4, name: "whoosh", volume: 0.28 }));
  const hook = at("hook");
  cues.push({
    at: hook.s.from + hook.c.word("hook-5", "idea"),
    name: "shimmer",
    volume: 0.35,
  });
  cues.push({
    at: hook.s.from + hook.c.end("hook-5", 0.3),
    name: "boom",
    volume: 0.55,
  });
  const alex = at("alejandria");
  cues.push({
    at: alex.s.from + alex.c.word("alex-5", "beta") - 6,
    name: "shimmer",
    volume: 0.3,
  });
  const sh = at("sombras");
  cues.push({ at: sh.s.from + sh.c.end("sh-3"), name: "boom", volume: 0.35 });
  const geo = at("geometria");
  cues.push({
    at: geo.s.from + geo.c.start("geo-2"),
    name: "shimmer",
    volume: 0.3,
  });
  cues.push({
    at: geo.s.from + geo.c.word("geo-4", "mismo"),
    name: "shimmer",
    volume: 0.3,
  });
  const calc = at("calculo");
  for (let i = 0; i < 6; i++)
    cues.push({
      at: calc.s.from + calc.c.word("calc-1", "cincuentavo") + i * 12,
      name: "tick",
      volume: 0.18,
    });
  cues.push({
    at: calc.s.from + calc.c.start("calc-5") - 90,
    name: "riser",
    volume: 0.3,
  });
  cues.push({
    at: calc.s.from + calc.c.start("calc-5"),
    name: "boom",
    volume: 0.6,
  });
  const leg = at("legado");
  cues.push({
    at: leg.s.from + leg.c.word("leg-4", "40"),
    name: "shimmer",
    volume: 0.35,
  });
  const end = at("cierre");
  cues.push({
    at: end.s.from + end.c.end("end-4", 0.4),
    name: "boom",
    volume: 0.45,
  });
  return cues;
};

const SceneSlot: React.FC<{ scene: PlanScene }> = ({ scene }) => {
  const Comp = SCENES[scene.id];
  return (
    <SceneProvider scene={scene} words={words} fps={plan.fps}>
      <Comp />
    </SceneProvider>
  );
};

export type VideoProps = { subtitles: boolean };

export const EratostenesVideo: React.FC<VideoProps> = ({ subtitles }) => (
  <AbsoluteFill style={{ background: C.night }}>
    <TransitionSeries>
      {plan.scenes.flatMap((s, i) => [
        ...(i > 0
          ? [
              <TransitionSeries.Transition
                key={`t-${s.id}`}
                presentation={(TRANSITIONS[s.id] ?? fade)()}
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
          <SceneSlot scene={s} />
        </TransitionSeries.Sequence>,
      ])}
    </TransitionSeries>
    <FilmLook />
    {subtitles ? <Subtitles cues={absoluteLines} /> : null}
    <Narration folder={FOLDER} clips={absoluteLines} />
    <MusicBed
      src={staticFile(`${FOLDER}/music.wav`)}
      clips={absoluteLines}
      durationInFrames={plan.durationInFrames}
    />
    <SfxTrack folder={FOLDER} cues={sfxCues()} />
  </AbsoluteFill>
);

/** Una escena suelta con su narración, para editarla y previsualizarla en Studio. */
export const EratostenesScene: React.FC<{ sceneId: string }> = ({
  sceneId,
}) => {
  const scene = plan.scenes.find((s) => s.id === sceneId)!;
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <SceneSlot scene={scene} />
      <FilmLook />
      <Narration folder={FOLDER} clips={scene.lines} />
    </AbsoluteFill>
  );
};

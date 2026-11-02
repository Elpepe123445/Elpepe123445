import React from "react";
import { Composition, Folder } from "remotion";
import {
  EratostenesScene,
  EratostenesVideo,
  plan,
} from "./videos/eratostenes/Video";
import { EratostenesShort, shortPlan } from "./videos/eratostenes-short/Video";
import { TsarVideo, tsarPlan } from "./videos/tsar/Video";
import { VacioVideo, vacioPlan } from "./videos/vacio/Video";
import { MapasVideo, mapasPlan } from "./videos/mapas/Video";
import { TiempoVideo, tiempoPlan } from "./videos/tiempo/Video";
import { GlobuloVideo, globuloPlan } from "./videos/globulo/Video";
import { AgujeroVideo, agujeroPlan } from "./videos/agujero/Video";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Eratostenes"
      component={EratostenesVideo}
      width={1920}
      height={1080}
      fps={plan.fps}
      durationInFrames={plan.durationInFrames}
      defaultProps={{ subtitles: true }}
    />
    <Composition
      id="EratostenesShort"
      component={EratostenesShort}
      width={1080}
      height={1920}
      fps={shortPlan.fps}
      durationInFrames={shortPlan.durationInFrames}
    />
    <Composition
      id="TsarBomba"
      component={TsarVideo}
      width={1080}
      height={1920}
      fps={tsarPlan.fps}
      durationInFrames={tsarPlan.durationInFrames}
    />
    <Composition
      id="Vacio"
      component={VacioVideo}
      width={1080}
      height={1920}
      fps={vacioPlan.fps}
      durationInFrames={vacioPlan.durationInFrames}
    />
    <Composition
      id="Mapas"
      component={MapasVideo}
      width={1080}
      height={1920}
      fps={mapasPlan.fps}
      durationInFrames={mapasPlan.durationInFrames}
    />
    <Composition
      id="Tiempo"
      component={TiempoVideo}
      width={1080}
      height={1920}
      fps={tiempoPlan.fps}
      durationInFrames={tiempoPlan.durationInFrames}
    />
    <Composition
      id="Globulo"
      component={GlobuloVideo}
      width={1080}
      height={1920}
      fps={globuloPlan.fps}
      durationInFrames={globuloPlan.durationInFrames}
    />
    <Composition
      id="Agujero"
      component={AgujeroVideo}
      width={1080}
      height={1920}
      fps={agujeroPlan.fps}
      durationInFrames={agujeroPlan.durationInFrames}
    />
    <Folder name="Eratostenes-Escenas">
      {plan.scenes.map((s) => (
        <Composition
          key={s.id}
          id={`E-${s.id}`}
          component={EratostenesScene}
          width={1920}
          height={1080}
          fps={plan.fps}
          durationInFrames={s.durationInFrames}
          defaultProps={{ sceneId: s.id }}
        />
      ))}
    </Folder>
  </>
);

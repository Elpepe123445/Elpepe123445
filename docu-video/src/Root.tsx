import React from "react";
import { Composition, Folder } from "remotion";
import {
  EratostenesScene,
  EratostenesVideo,
  plan,
} from "./videos/eratostenes/Video";
import { EratostenesShort, shortPlan } from "./videos/eratostenes-short/Video";

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

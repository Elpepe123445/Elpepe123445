import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";
import React from "react";
import { AbsoluteFill, interpolate } from "remotion";

type Empty = Record<string, never>;

/** Disolución con desenfoque y ligero zoom: transición "documental" por defecto. */
const BlurDissolve: React.FC<TransitionPresentationComponentProps<Empty>> = ({
  children,
  presentationDirection,
  presentationProgress: p,
}) => {
  const entering = presentationDirection === "entering";
  return (
    <AbsoluteFill
      style={{
        opacity: entering ? p : 1,
        filter: `blur(${entering ? (1 - p) * 14 : p * 10}px)`,
        scale: String(
          entering
            ? interpolate(p, [0, 1], [1.06, 1])
            : interpolate(p, [0, 1], [1, 0.97]),
        ),
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** Destello solar: la escena saliente se sobreexpone y la entrante nace de la luz. */
const LightFlash: React.FC<TransitionPresentationComponentProps<Empty>> = ({
  children,
  presentationDirection,
  presentationProgress: p,
}) => {
  const entering = presentationDirection === "entering";
  const glow = entering ? 1 - p : p;
  return (
    <AbsoluteFill
      style={{
        opacity: entering
          ? interpolate(p, [0, 0.5], [0, 1], { extrapolateRight: "clamp" })
          : 1,
      }}
    >
      <AbsoluteFill
        style={{
          filter: `brightness(${1 + glow * 2.2}) saturate(${1 - glow * 0.4})`,
        }}
      >
        {children}
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 50% 40%, #FFF3D0, #F4B74000 70%)",
          opacity: glow * 0.85,
        }}
      />
    </AbsoluteFill>
  );
};

export const blurDissolve = (): TransitionPresentation<Empty> => ({
  component: BlurDissolve,
  props: {},
});
export const lightFlash = (): TransitionPresentation<Empty> => ({
  component: LightFlash,
  props: {},
});

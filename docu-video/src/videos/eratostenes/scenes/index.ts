import type React from "react";
import { Alexandria } from "./Alexandria";
import { Calculation } from "./Calculation";
import { Closing } from "./Closing";
import { Comparison } from "./Comparison";
import { Geometry } from "./Geometry";
import { Hook } from "./Hook";
import { Legacy } from "./Legacy";
import { MapScene } from "./MapScene";
import { Rays } from "./Rays";
import { Shadows } from "./Shadows";

/** id de escena (en script.json) → componente. */
export const SCENES: Record<string, React.FC> = {
  hook: Hook,
  alejandria: Alexandria,
  mapa: MapScene,
  sombras: Shadows,
  rayos: Rays,
  geometria: Geometry,
  calculo: Calculation,
  comparacion: Comparison,
  legado: Legacy,
  cierre: Closing,
};

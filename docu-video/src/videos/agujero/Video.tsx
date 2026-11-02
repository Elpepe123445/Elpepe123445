import { blurDissolve, lightFlash } from "../../components/transitions";
import { makeShort } from "../../engine/ShortVideo";
import type { Plan, VoiceWords } from "../../engine/timeline";
import { B } from "./models";
import planJson from "./plan.json";
import {
  BArrive,
  BFinal,
  BInside,
  BLens,
  BOutside,
  BSpaghetti,
} from "./scenes";
import wordsJson from "./voice-words.json";

export const agujeroPlan = planJson as Plan;

/** «POV: caes en un agujero negro» — 3D en primera persona, voz Kokoro, vertical. */
export const AgujeroVideo = makeShort({
  plan: agujeroPlan,
  words: wordsJson as unknown as VoiceWords,
  folder: "agujero",
  background: B.bg,
  scenes: {
    "b-llegada": BArrive,
    "b-lente": BLens,
    "b-fideo": BSpaghetti,
    "b-fuera": BOutside,
    "b-dentro": BInside,
    "b-final": BFinal,
  },
  transitions: {
    "b-lente": blurDissolve,
    "b-fideo": blurDissolve,
    "b-fuera": lightFlash,
    "b-dentro": blurDissolve,
    "b-final": blurDissolve,
  },
  captions: { top: 1440, fontSize: 80, accent: B.accent },
  music: { under: 0.34, open: 0.62 },
  sfx: (at) => [
    ...["b-lente", "b-fideo", "b-fuera", "b-dentro", "b-final"].map((id) => ({
      at: at(id).from - 3,
      name: "whoosh",
      volume: 0.28,
    })),
    { at: at("b-llegada").from + 4, name: "riser", volume: 0.2 },
    {
      at: at("b-fideo").from + at("b-fideo").cues.word("b5", "cruzo"),
      name: "riser",
      volume: 0.3,
    },
    {
      at: at("b-fideo").from + at("b-fideo").cues.word("b5", "nada"),
      name: "boom",
      volume: 0.45,
    },
    {
      at: at("b-final").from + at("b-final").cues.end("b9", 0.2),
      name: "boom",
      volume: 0.4,
    },
  ],
});

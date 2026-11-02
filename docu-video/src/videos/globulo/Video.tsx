import { blurDissolve, lightFlash } from "../../components/transitions";
import { makeShort } from "../../engine/ShortVideo";
import type { Plan, VoiceWords } from "../../engine/timeline";
import { R } from "./models";
import planJson from "./plan.json";
import { RCapillary, RFinal, RHeart, RHemo, RLife, RLung } from "./scenes";
import wordsJson from "./voice-words.json";

export const globuloPlan = planJson as Plan;

/** «POV: eres un glóbulo rojo» — 3D en primera persona, voz Kokoro, vertical. */
export const GlobuloVideo = makeShort({
  plan: globuloPlan,
  words: wordsJson as unknown as VoiceWords,
  folder: "globulo",
  background: R.bg,
  scenes: {
    "r-corazon": RHeart,
    "r-hemo": RHemo,
    "r-pulmon": RLung,
    "r-capilar": RCapillary,
    "r-vida": RLife,
    "r-final": RFinal,
  },
  transitions: {
    "r-hemo": lightFlash,
    "r-pulmon": blurDissolve,
    "r-capilar": blurDissolve,
    "r-vida": blurDissolve,
    "r-final": lightFlash,
  },
  captions: { top: 1440, fontSize: 80, accent: R.accent },
  music: { under: 0.34, open: 0.6 },
  sfx: (at) => [
    ...["r-hemo", "r-pulmon", "r-capilar", "r-vida", "r-final"].map((id) => ({
      at: at(id).from - 3,
      name: "whoosh",
      volume: 0.3,
    })),
    ...new Array(13)
      .fill(0)
      .map((_, i) => ({ at: 6 + i * 24, name: "boom", volume: 0.16 })),
    {
      at: at("r-hemo").from + at("r-hemo").cues.word("r4", "cuatro"),
      name: "shimmer",
      volume: 0.3,
    },
    {
      at: at("r-pulmon").from + at("r-pulmon").cues.word("r5", "respiras"),
      name: "shimmer",
      volume: 0.3,
    },
    {
      at: at("r-vida").from + at("r-vida").cues.word("r9", "medula"),
      name: "shimmer",
      volume: 0.3,
    },
  ],
});

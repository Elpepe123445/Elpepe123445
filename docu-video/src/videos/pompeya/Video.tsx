import { random } from "remotion";
import { blurDissolve, lightFlash } from "../../components/transitions";
import { makeShort } from "../../engine/ShortVideo";
import type { Plan, VoiceWords } from "../../engine/timeline";
import { P } from "./models";
import planJson from "./plan.json";
import { PAsh, PCast, PCloud, PFinal, PRain, PStreet } from "./scenes";
import wordsJson from "./voice-words.json";

export const pompeyaPlan = planJson as Plan;

/** «POV: vives en Pompeya en el año 79» — 3D en primera persona, voz Kokoro, vertical. */
export const PompeyaVideo = makeShort({
  plan: pompeyaPlan,
  words: wordsJson as unknown as VoiceWords,
  folder: "pompeya",
  background: P.bg,
  scenes: {
    "p-calle": PStreet,
    "p-lluvia": PRain,
    "p-nube": PCloud,
    "p-ceniza": PAsh,
    "p-yeso": PCast,
    "p-final": PFinal,
  },
  transitions: {
    "p-lluvia": blurDissolve,
    "p-nube": blurDissolve,
    "p-ceniza": blurDissolve,
    "p-yeso": blurDissolve,
    "p-final": lightFlash,
  },
  captions: { top: 1440, fontSize: 80, accent: P.accent },
  music: { under: 0.34, open: 0.6 },
  sfx: (at) => {
    const rain = at("p-lluvia");
    const cloud = at("p-nube");
    return [
      ...["p-lluvia", "p-nube", "p-ceniza", "p-yeso", "p-final"].map((id) => ({
        at: at(id).from - 3,
        name: "whoosh",
        volume: 0.28,
      })),
      {
        at: at("p-calle").from + at("p-calle").cues.word("p1", "rugir") - 2,
        name: "boom",
        volume: 0.5,
      },
      // granizo de pómez: golpecitos irregulares
      ...new Array(46).fill(0).map((_, i) => ({
        at: rain.from + 6 + Math.round(i * 6.2 + random(`pt${i}`) * 5),
        name: "tick",
        volume: 0.03 + random(`pv${i}`) * 0.05,
      })),
      {
        at: rain.from + rain.cues.word("p4", "crujen"),
        name: "boom",
        volume: 0.22,
      },
      {
        at: cloud.from + cloud.cues.word("p5", "colapsa") - 10,
        name: "riser",
        volume: 0.4,
      },
      { at: cloud.from + cloud.cues.end("p6") - 6, name: "boom", volume: 0.55 },
      {
        at: at("p-yeso").from + at("p-yeso").cues.word("p8", "1863"),
        name: "shimmer",
        volume: 0.3,
      },
      {
        at: at("p-final").from + at("p-final").cues.word("p10", "octubre"),
        name: "shimmer",
        volume: 0.3,
      },
    ];
  },
});

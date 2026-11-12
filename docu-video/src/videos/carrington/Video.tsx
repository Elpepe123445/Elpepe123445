import { blurDissolve, lightFlash } from "../../components/transitions";
import { makeShort } from "../../engine/ShortVideo";
import type { Plan, VoiceWords } from "../../engine/timeline";
import { S } from "./models";
import planJson from "./plan.json";
import {
  CAurora,
  CFinal,
  CHook,
  CSun,
  CTelegraph,
  CToday,
  CTravel,
  morseTaps,
} from "./scenes";
import wordsJson from "./voice-words.json";

export const carringtonPlan = planJson as Plan;

/** «El día que el cielo electrificó los telégrafos» — tormenta solar de 1859, vertical, ~45 s. */
export const CarringtonVideo = makeShort({
  plan: carringtonPlan,
  words: wordsJson as unknown as VoiceWords,
  folder: "carrington",
  background: "#04030A",
  scenes: {
    "c-hook": CHook,
    "c-sol": CSun,
    "c-viaje": CTravel,
    "c-aurora": CAurora,
    "c-telegrafo": CTelegraph,
    "c-hoy": CToday,
    "c-final": CFinal,
  },
  transitions: {
    "c-sol": lightFlash,
    "c-viaje": blurDissolve,
    "c-aurora": lightFlash,
    "c-telegrafo": blurDissolve,
    "c-hoy": blurDissolve,
    "c-final": blurDissolve,
  },
  captions: { top: 1430, fontSize: 80, accent: S.gold },
  music: { under: 0.34, open: 0.62 },
  sfx: (at) => {
    const hook = at("c-hook");
    const sol = at("c-sol");
    const viaje = at("c-viaje");
    const tel = at("c-telegrafo");
    const hoy = at("c-hoy");
    const fin = at("c-final");
    const chis = hook.from + hook.cues.word("c1", "chispas");
    const hit = viaje.from + viaje.cues.word("c5", "golpeo");
    const sig = tel.from + tel.cues.word("c7", "siguieron");
    return [
      ...[
        "c-sol",
        "c-viaje",
        "c-aurora",
        "c-telegrafo",
        "c-hoy",
        "c-final",
      ].map((id) => ({ at: at(id).from - 3, name: "whoosh", volume: 0.26 })),
      { at: 2, name: "shimmer", volume: 0.35 },
      ...[-8, 0, 7, 15].map((d) => ({
        at: chis + d,
        name: "tick",
        volume: 0.5,
      })),
      {
        at: sol.from + sol.cues.word("c3", "destello") - 4,
        name: "shimmer",
        volume: 0.45,
      },
      { at: hit - 48, name: "riser", volume: 0.3 },
      { at: hit - 2, name: "boom", volume: 0.42 },
      { at: at("c-aurora").from + 8, name: "shimmer", volume: 0.35 },
      ...morseTaps(9).map((f) => ({ at: sig + f, name: "tick", volume: 0.42 })),
      {
        at: hoy.from + hoy.cues.word("c8", "fallar") - 2,
        name: "boom",
        volume: 0.4,
      },
      {
        at: fin.from + fin.cues.word("c10", "tormenta") - 30,
        name: "riser",
        volume: 0.24,
      },
      { at: fin.from + fin.cues.end("c11") + 6, name: "boom", volume: 0.32 },
    ];
  },
});

import { blurDissolve, lightFlash } from "../../components/transitions";
import { makeShort } from "../../engine/ShortVideo";
import type { Plan, VoiceWords } from "../../engine/timeline";
import { V } from "./models";
import planJson from "./plan.json";
import { VClosing, VHook, VStadium, VStar, VTouch, VZoom } from "./scenes";
import wordsJson from "./voice-words.json";

export const vacioPlan = planJson as Plan;

/** «Eres 99,9999 % vacío» — 3D realista, vertical, ~1 minuto. */
export const VacioVideo = makeShort({
  plan: vacioPlan,
  words: wordsJson as unknown as VoiceWords,
  folder: "vacio",
  background: "#05040F",
  scenes: {
    "v-hook": VHook,
    "v-zoom": VZoom,
    "v-estadio": VStadium,
    "v-tocar": VTouch,
    "v-estrella": VStar,
    "v-cierre": VClosing,
  },
  transitions: {
    "v-zoom": lightFlash,
    "v-estadio": blurDissolve,
    "v-tocar": blurDissolve,
    "v-estrella": lightFlash,
    "v-cierre": blurDissolve,
  },
  captions: { top: 1420, fontSize: 82, accent: V.cyan },
  music: { under: 0.36, open: 0.62 },
  sfx: (at) => {
    const hook = at("v-hook");
    const est = at("v-estadio");
    const star = at("v-estrella");
    return [
      ...["v-zoom", "v-estadio", "v-tocar", "v-estrella", "v-cierre"].map(
        (id) => ({ at: at(id).from - 3, name: "whoosh", volume: 0.28 }),
      ),
      {
        at: hook.from + hook.cues.word("v1", "cubito") - 10,
        name: "shimmer",
        volume: 0.4,
      },
      {
        at: est.from + est.cues.word("v5", "canica") - 40,
        name: "riser",
        volume: 0.25,
      },
      { at: est.from + est.cues.start("v6") + 20, name: "boom", volume: 0.35 },
      {
        at: at("v-tocar").from + at("v-tocar").cues.word("v7", "repelen"),
        name: "tick",
        volume: 0.5,
      },
      { at: star.from + 10, name: "boom", volume: 0.4 },
      {
        at: star.from + star.cues.word("v9", "cucharadita"),
        name: "shimmer",
        volume: 0.35,
      },
    ];
  },
});

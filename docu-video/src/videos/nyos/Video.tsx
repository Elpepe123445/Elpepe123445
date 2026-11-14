import { blurDissolve, lightFlash } from "../../components/transitions";
import { makeShort } from "../../engine/ShortVideo";
import type { Plan, VoiceWords } from "../../engine/timeline";
import { N } from "./models";
import planJson from "./plan.json";
import {
  NCloud,
  NDeep,
  NHook,
  NKivu,
  NLake,
  NNight,
  NQuestion,
  NToday,
} from "./scenes";
import wordsJson from "./voice-words.json";

export const nyosPlan = planJson as Plan;

/** «El lago que mató a más de 1.700 personas en una noche» — lago Nyos, 1986. Vertical, ~40 s. */
export const NyosVideo = makeShort({
  plan: nyosPlan,
  words: wordsJson as unknown as VoiceWords,
  folder: "nyos",
  background: "#03050D",
  scenes: {
    "n-gancho": NHook,
    "n-lago": NLake,
    "n-fondo": NDeep,
    "n-noche": NNight,
    "n-nube": NCloud,
    "n-hoy": NToday,
    "n-kivu": NKivu,
    "n-pregunta": NQuestion,
  },
  // `n-noche` entra con el fundido por defecto: la botella sigue en plano.
  transitions: {
    "n-lago": blurDissolve,
    "n-fondo": blurDissolve,
    "n-nube": lightFlash,
    "n-hoy": lightFlash,
    "n-kivu": blurDissolve,
    "n-pregunta": blurDissolve,
  },
  // La pregunta final ya sale en grande en su escena: no lleva subtítulo.
  captions: { top: 1430, fontSize: 80, accent: N.amber, skip: ["n13"] },
  music: { under: 0.34, open: 0.62 },
  sfx: (at) => {
    const hook = at("n-gancho");
    const noche = at("n-noche");
    const kivu = at("n-kivu");
    const fin = at("n-pregunta");
    const mato = hook.from + hook.cues.word("n1", "mato");
    const pop = noche.from + noche.cues.word("n6", "destapo") + 5;
    const mil = kivu.from + kivu.cues.word("n11", "mil");
    return [
      ...["n-lago", "n-fondo", "n-nube", "n-hoy", "n-kivu", "n-pregunta"].map(
        (id) => ({ at: at(id).from - 3, name: "whoosh", volume: 0.24 }),
      ),
      { at: 0, name: "shimmer", volume: 0.3 },
      { at: Math.max(0, mato - 88), name: "riser", volume: 0.2 },
      { at: mato, name: "boom", volume: 0.36 },
      ...["agua", "fuego"].map((w) => ({
        at: hook.from + hook.cues.word("n2", w) + 6,
        name: "tick",
        volume: 0.5,
      })),
      {
        at: at("n-lago").from + at("n-lago").cues.word("n4", "camerun") + 2,
        name: "shimmer",
        volume: 0.3,
      },
      {
        at: at("n-fondo").from + at("n-fondo").cues.word("n5", "como") - 2,
        name: "tick",
        volume: 0.4,
      },
      { at: pop, name: "pop", volume: 0.8 },
      { at: pop + 1, name: "hiss", volume: 0.45 },
      { at: pop + 9, name: "boom", volume: 0.5 },
      { at: at("n-nube").from + 6, name: "hiss", volume: 0.25 },
      { at: at("n-hoy").from + 4, name: "shimmer", volume: 0.35 },
      {
        at: kivu.from + kivu.cues.word("n10", "kivu") - 6,
        name: "shimmer",
        volume: 0.3,
      },
      { at: mil - 8, name: "whoosh", volume: 0.3 },
      { at: mil + 16, name: "boom", volume: 0.3 },
      {
        at: kivu.from + kivu.cues.word("n12", "saturado") + 2,
        name: "tick",
        volume: 0.55,
      },
      { at: fin.from + fin.cues.start("n13") + 9, name: "boom", volume: 0.34 },
    ];
  },
});

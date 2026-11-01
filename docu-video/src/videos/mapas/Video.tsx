import { slide } from "@remotion/transitions/slide";
import { blurDissolve } from "../../components/transitions";
import { makeShort } from "../../engine/ShortVideo";
import type { Plan, VoiceWords } from "../../engine/timeline";
import planJson from "./plan.json";
import {
  GAfrica,
  GFinal,
  GHook,
  GMercator,
  GMove,
  GRussia,
  GSize,
} from "./scenes";
import wordsJson from "./voice-words.json";

export const mapasPlan = planJson as Plan;

/** «El mapa que te miente» — 2D papel recortado, vertical, ~1 minuto. */
export const MapasVideo = makeShort({
  plan: mapasPlan,
  words: wordsJson as unknown as VoiceWords,
  folder: "mapas",
  background: "#2A211C",
  scenes: {
    "g-hook": GHook,
    "g-tamano": GSize,
    "g-mercator": GMercator,
    "g-mover": GMove,
    "g-rusia": GRussia,
    "g-africa": GAfrica,
    "g-final": GFinal,
  },
  transitions: {
    "g-tamano": blurDissolve,
    "g-mercator": blurDissolve,
    "g-mover": blurDissolve,
    "g-rusia": () => slide({ direction: "from-right" }),
    "g-africa": () => slide({ direction: "from-bottom" }),
    "g-final": blurDissolve,
  },
  captions: { top: 1440, fontSize: 80, accent: "#FFE45C" },
  music: { under: 0.36, open: 0.62 },
  sfx: (at) => {
    const hook = at("g-hook");
    const size = at("g-tamano");
    const af = at("g-africa");
    return [
      ...[
        "g-tamano",
        "g-mercator",
        "g-mover",
        "g-rusia",
        "g-africa",
        "g-final",
      ].map((id) => ({ at: at(id).from - 3, name: "whoosh", volume: 0.25 })),
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({
        at: hook.from + 8 + i * 5,
        name: "tick",
        volume: 0.18,
      })),
      {
        at: hook.from + hook.cues.word("g1", "miente"),
        name: "boom",
        volume: 0.3,
      },
      {
        at: size.from + size.cues.word("g3", "catorce"),
        name: "shimmer",
        volume: 0.35,
      },
      ...["estados", "china", "india", "union"].map((w) => ({
        at: af.from + af.cues.word("g7", w) + 4,
        name: "tick",
        volume: 0.35,
      })),
    ];
  },
});

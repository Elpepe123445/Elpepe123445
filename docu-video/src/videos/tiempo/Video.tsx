import { slide } from "@remotion/transitions/slide";
import { makeShort } from "../../engine/ShortVideo";
import type { Plan, VoiceWords } from "../../engine/timeline";
import planJson from "./plan.json";
import {
  TCleo,
  TDinos,
  TFinal,
  TMammoth,
  TNintendo,
  TOxford,
  TShark,
  TTree,
} from "./scenes";
import wordsJson from "./voice-words.json";

export const tiempoPlan = planJson as Plan;
const right = () => slide({ direction: "from-right" });

/** «La historia es más rara de lo que crees» — 2D plastilina, vertical, ~1 minuto. */
export const TiempoVideo = makeShort({
  plan: tiempoPlan,
  words: wordsJson as unknown as VoiceWords,
  folder: "tiempo",
  background: "#F7BFD3",
  scenes: {
    "t-cleo": TCleo,
    "t-mamut": TMammoth,
    "t-arbol": TTree,
    "t-oxford": TOxford,
    "t-nintendo": TNintendo,
    "t-dinos": TDinos,
    "t-tiburon": TShark,
    "t-final": TFinal,
  },
  transitions: {
    "t-mamut": right,
    "t-arbol": right,
    "t-oxford": right,
    "t-nintendo": right,
    "t-dinos": right,
    "t-tiburon": right,
    "t-final": right,
  },
  captions: { top: 1440, fontSize: 80, accent: "#FFE45C" },
  music: { under: 0.36, open: 0.62 },
  filmGrain: false,
  sfx: (at) => [
    ...[
      "t-mamut",
      "t-arbol",
      "t-oxford",
      "t-nintendo",
      "t-dinos",
      "t-tiburon",
      "t-final",
    ].map((id) => ({ at: at(id).from - 3, name: "whoosh", volume: 0.25 })),
    { at: at("t-cleo").cues.word("h1", "luna"), name: "shimmer", volume: 0.3 },
    {
      at: at("t-arbol").from + at("t-arbol").cues.word("h3b", "tiene"),
      name: "tick",
      volume: 0.3,
    },
    {
      at: at("t-dinos").from + at("t-dinos").cues.word("h6", "estegosaurio"),
      name: "tick",
      volume: 0.3,
    },
  ],
});

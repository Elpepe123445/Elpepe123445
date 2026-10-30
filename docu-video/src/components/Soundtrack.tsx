import { Audio } from "@remotion/media";
import React, { useMemo } from "react";
import { Sequence, staticFile } from "remotion";

export type VoiceClip = { id: string; from: number; durationInFrames: number };
export type SfxCue = { at: number; name: string; volume?: number };

/** Narración: un clip por frase, colocado en su fotograma exacto del plan. */
export const Narration: React.FC<{
  folder: string;
  clips: VoiceClip[];
  volume?: number;
}> = ({ folder, clips, volume = 1 }) => (
  <>
    {clips.map((c) => (
      <Sequence
        key={c.id}
        from={c.from}
        durationInFrames={c.durationInFrames + 10}
        name={`voz ${c.id}`}
        layout="none"
      >
        <Audio
          src={staticFile(`${folder}/voice/${c.id}.wav`)}
          volume={volume}
        />
      </Sequence>
    ))}
  </>
);

/**
 * Música con "ducking": baja suavemente mientras hay voz y respira en los silencios.
 * La envolvente se precalcula por fotograma (barato y determinista).
 */
export const MusicBed: React.FC<{
  src: string;
  clips: VoiceClip[];
  durationInFrames: number;
  under?: number;
  open?: number;
}> = ({ src, clips, durationInFrames, under = 0.3, open = 0.55 }) => {
  const env = useMemo(() => {
    const raw = new Float32Array(durationInFrames).fill(open);
    for (const c of clips) {
      for (
        let f = Math.max(0, c.from - 6);
        f < Math.min(durationInFrames, c.from + c.durationInFrames + 8);
        f++
      )
        raw[f] = under;
    }
    // Suavizado (media móvil de ~0,8 s) para que los cambios de nivel no se noten.
    const out = new Float32Array(durationInFrames);
    const w = 12;
    for (let f = 0; f < durationInFrames; f++) {
      let s = 0;
      let n = 0;
      for (let k = -w; k <= w; k++) {
        const i = f + k;
        if (i >= 0 && i < durationInFrames) {
          s += raw[i];
          n++;
        }
      }
      out[f] = s / n;
    }
    return out;
  }, [clips, durationInFrames, under, open]);
  return (
    <Audio
      src={src}
      volume={(f) => env[Math.min(env.length - 1, Math.max(0, f))]}
    />
  );
};

/** Efectos de sonido sintetizados, disparados en fotogramas concretos. */
export const SfxTrack: React.FC<{ folder: string; cues: SfxCue[] }> = ({
  folder,
  cues,
}) => (
  <>
    {cues.map((c, i) => (
      <Sequence
        key={`${c.name}-${i}`}
        from={Math.max(0, c.at)}
        durationInFrames={150}
        name={`sfx ${c.name}`}
        layout="none"
      >
        <Audio
          src={staticFile(`${folder}/sfx/${c.name}.wav`)}
          volume={c.volume ?? 0.5}
        />
      </Sequence>
    ))}
  </>
);

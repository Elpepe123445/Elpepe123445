"""Obtiene el instante de cada palabra de la narración con faster-whisper (local, gratuito).

Uso:  python scripts/align.py eratostenes [modelo=small]
Lee   public/<video>/voice/*.wav
Crea  src/videos/<video>/voice-words.json  { lineId: [[palabra, inicio_s, fin_s], ...] }

Las escenas lo usan para disparar animaciones en palabras concretas (p. ej. "sombra").
También sirve de control de calidad: imprime lo que el modelo entendió de cada línea.
"""

import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parent.parent


def load(path: Path) -> np.ndarray:
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, np.float32)


def main(video: str, model_name: str) -> None:
    script = json.loads((ROOT / "content" / video / "script.json").read_text())
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    words = {}
    for scene in script["scenes"]:
        for line in scene["lines"]:
            wav = ROOT / "public" / video / "voice" / f"{line['id']}.wav"
            segs, _ = model.transcribe(load(wav), language="es", word_timestamps=True, beam_size=5,
                                       initial_prompt=line["text"])
            ws = [[w.word.strip(), round(w.start, 2), round(w.end, 2)] for s in segs for w in s.words]
            words[line["id"]] = ws
            print(f"{line['id']:>7}: {' '.join(w[0] for w in ws)}")
    out = ROOT / "src" / "videos" / video / "voice-words.json"
    out.write_text(json.dumps(words, ensure_ascii=False) + "\n")
    print(f"-> {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "eratostenes", sys.argv[2] if len(sys.argv) > 2 else "small")

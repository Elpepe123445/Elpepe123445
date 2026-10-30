"""Genera la narración línea a línea con Piper (offline) y escribe las duraciones.

Uso:  python scripts/tts.py eratostenes
Lee   content/<video>/script.json
Crea  public/<video>/voice/<lineId>.wav
      src/videos/<video>/voice-timings.json   (duración real de cada línea)
"""

import json
import subprocess
import sys
import urllib.request
import wave
from pathlib import Path

import numpy as np
from piper import PiperVoice, SynthesisConfig

ROOT = Path(__file__).resolve().parent.parent
VOICES_DIR = ROOT / ".cache" / "voices"
HF = "https://huggingface.co/rhasspy/piper-voices/resolve/main"
TARGET_PEAK = 10 ** (-3 / 20)  # -3 dBFS antes de la mezcla en Remotion


def ensure_voice(name: str) -> Path:
    """Descarga el modelo de Piper si no está en caché (es_MX-claude-high -> es/es_MX/claude/high/...)."""
    lang, speaker, quality = name.split("-")
    model = VOICES_DIR / f"{name}.onnx"
    VOICES_DIR.mkdir(parents=True, exist_ok=True)
    for suffix in (".onnx", ".onnx.json"):
        dest = VOICES_DIR / f"{name}{suffix}"
        if not dest.exists():
            url = f"{HF}/{lang.split('_')[0]}/{lang}/{speaker}/{quality}/{name}{suffix}"
            print(f"Descargando {url}")
            urllib.request.urlretrieve(url, dest)
    return model


def trim_silence(samples: np.ndarray, rate: int, threshold_db: float = -45) -> np.ndarray:
    """Recorta silencios de los extremos y deja 40 ms de aire con fundidos suaves."""
    threshold = 10 ** (threshold_db / 20) * 32768
    loud = np.where(np.abs(samples) > threshold)[0]
    if len(loud) == 0:
        return samples
    margin = int(0.04 * rate)
    start = max(0, loud[0] - margin)
    end = min(len(samples), loud[-1] + margin)
    out = samples[start:end].astype(np.float32)
    fade = min(int(0.015 * rate), len(out) // 4)
    out[:fade] *= np.linspace(0, 1, fade)
    out[-fade:] *= np.linspace(1, 0, fade)
    return out


def main(video: str) -> None:
    script = json.loads((ROOT / "content" / video / "script.json").read_text())
    vcfg = script["voice"]
    voice = PiperVoice.load(ensure_voice(vcfg["model"]))
    syn = SynthesisConfig(
        length_scale=vcfg.get("lengthScale"),
        noise_scale=vcfg.get("noiseScale"),
        noise_w_scale=vcfg.get("noiseW"),
    )

    out_dir = ROOT / "public" / video / "voice"
    out_dir.mkdir(parents=True, exist_ok=True)
    raw_dir = ROOT / ".cache" / "raw-voice" / video
    raw_dir.mkdir(parents=True, exist_ok=True)

    # 1) Síntesis cruda
    lines = [line for scene in script["scenes"] for line in scene["lines"]]
    clips: dict[str, np.ndarray] = {}
    rate = voice.config.sample_rate
    lexicon = vcfg.get("lexicon", {})  # respellings para palabras que la voz pronuncia mal
    for line in lines:
        text = line.get("say", line["text"])
        for word, respelled in lexicon.items():
            text = text.replace(word, respelled)
        raw = raw_dir / f"{line['id']}.wav"
        with wave.open(str(raw), "wb") as w:
            voice.synthesize_wav(text, w, syn_config=syn)
        with wave.open(str(raw), "rb") as w:
            data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
        clips[line["id"]] = trim_silence(data, rate)

    # 2) Ganancia común para todas las líneas (mantiene la dinámica natural entre frases)
    peak = max(float(np.abs(c).max()) for c in clips.values()) / 32768
    gain = TARGET_PEAK / peak

    timings = {}
    for line_id, clip in clips.items():
        tmp = raw_dir / f"{line_id}.trim.wav"
        with wave.open(str(tmp), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(rate)
            w.writeframes(np.clip(clip * gain, -32768, 32767).astype(np.int16).tobytes())
        dest = out_dir / f"{line_id}.wav"
        # Ecualización ligera de "voz de documental": quita graves sucios, añade cuerpo y presencia.
        subprocess.run(
            [
                "ffmpeg", "-v", "error", "-y", "-i", str(tmp),
                "-af", "highpass=f=75,equalizer=f=160:t=q:w=1.1:g=2.5,equalizer=f=3200:t=q:w=1.4:g=1.5,"
                "acompressor=threshold=-18dB:ratio=2.5:attack=8:release=120:makeup=1.5,aresample=48000",
                "-ac", "1", str(dest),
            ],
            check=True,
        )
        timings[line_id] = round(len(clip) / rate, 3)

    timings_path = ROOT / "src" / "videos" / video / "voice-timings.json"
    timings_path.parent.mkdir(parents=True, exist_ok=True)
    timings_path.write_text(json.dumps(timings, indent=2, ensure_ascii=False) + "\n")
    total = sum(timings.values())
    print(f"{len(timings)} líneas · {total:.1f} s de voz · {timings_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "eratostenes")

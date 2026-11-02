"""Genera la narración línea a línea con Piper (offline) y escribe las duraciones.

Uso:  python scripts/tts.py eratostenes
Lee   content/<video>/script.json
Crea  public/<video>/voice/<lineId>.wav
      src/videos/<video>/voice-timings.json   (duración real de cada línea)
"""

import io
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


def _words(text: str) -> list[str]:
    import re
    import unicodedata

    text = unicodedata.normalize("NFD", text.lower())
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return re.findall(r"[a-zñ]+", text)


def take_score(judge, data: np.ndarray, rate: int, expected: str) -> float:
    """Parecido (0–1) entre lo que Whisper entiende de la toma y el texto esperado (ignora cifras)."""
    import difflib

    audio = data.astype(np.float32) / 32768
    idx = np.linspace(0, len(audio) - 1, int(len(audio) * 16000 / rate)).astype(int)
    segs, _ = judge.transcribe(audio[idx], language="es", beam_size=5)
    heard = _words(" ".join(s.text for s in segs))
    return difflib.SequenceMatcher(None, _words(expected), heard).ratio()


KOKORO_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"


def make_synth(vcfg: dict):
    """Devuelve (sintetizar(texto) -> int16, frecuencia). Motores: "piper" (por defecto) o "kokoro"."""
    if vcfg.get("engine") == "kokoro":
        # Kokoro-82M (Apache-2.0): prosodia más natural; voces masculinas em_alex / em_santa.
        from kokoro_onnx import Kokoro

        kdir = ROOT / ".cache" / "kokoro"
        kdir.mkdir(parents=True, exist_ok=True)
        for name in ("kokoro-v1.0.onnx", "voices-v1.0.bin"):
            if not (kdir / name).exists():
                print(f"Descargando {name}")
                urllib.request.urlretrieve(f"{KOKORO_URL}/{name}", kdir / name)
        kokoro = Kokoro(str(kdir / "kokoro-v1.0.onnx"), str(kdir / "voices-v1.0.bin"))

        def synth(text: str) -> np.ndarray:
            samples, _ = kokoro.create(text, voice=vcfg.get("voice", "em_alex"), speed=vcfg.get("speed", 1.0), lang="es")
            return (np.clip(samples, -1, 1) * 32767).astype(np.int16)

        return synth, 24000

    voice = PiperVoice.load(ensure_voice(vcfg["model"]))
    syn = SynthesisConfig(
        length_scale=vcfg.get("lengthScale"),
        noise_scale=vcfg.get("noiseScale"),
        noise_w_scale=vcfg.get("noiseW"),
    )

    def synth(text: str) -> np.ndarray:
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            voice.synthesize_wav(text, w, syn_config=syn)
        buf.seek(0)
        with wave.open(buf, "rb") as w:
            return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)

    return synth, voice.config.sample_rate


def main(video: str) -> None:
    script = json.loads((ROOT / "content" / video / "script.json").read_text())
    vcfg = script["voice"]
    synth, rate = make_synth(vcfg)

    out_dir = ROOT / "public" / video / "voice"
    out_dir.mkdir(parents=True, exist_ok=True)
    raw_dir = ROOT / ".cache" / "raw-voice" / video
    raw_dir.mkdir(parents=True, exist_ok=True)

    # 1) Síntesis cruda
    lines = [line for scene in script["scenes"] for line in scene["lines"]]
    clips: dict[str, np.ndarray] = {}
    # Respellings para lo que la voz pronuncia mal (p. ej. el hiato "ía" → "íia"; ver README).
    lexicon = vcfg.get("lexicon", {})
    # "takes" > 1: Piper varía en cada síntesis; se generan varias tomas y se queda la que
    # faster-whisper transcribe (sin pistas) más parecida al texto. Pronunciación verificada, no supuesta.
    takes = int(vcfg.get("takes", 1))
    judge = None
    if takes > 1:
        from faster_whisper import WhisperModel

        judge = WhisperModel("small", device="cpu", compute_type="int8")
    for line in lines:
        spoken = line.get("say", line["text"])
        text = spoken
        for word, respelled in lexicon.items():
            text = text.replace(word, respelled)
        best, best_score = None, -1.0
        for _ in range(takes):
            data = synth(text)
            score = 1.0 if judge is None else take_score(judge, data, rate, spoken)
            if score > best_score:
                best, best_score = data, score
            if best_score >= 0.97:
                break
        if judge is not None:
            print(f"{line['id']:>6}: mejor toma {best_score:.2f}")
        clips[line["id"]] = trim_silence(best, rate)

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

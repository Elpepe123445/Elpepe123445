"""Control de calidad del MP4 final: formato, sonoridad, silencios y fidelidad de la narración.

Uso:  python scripts/qa.py eratostenes out/eratostenes.mp4
- Comprueba resolución, fps, códecs y duración frente al plan.
- Mide la sonoridad integrada (EBU R128) y el pico real.
- Transcribe el audio del MP4 con faster-whisper SIN pistas del guion y lo compara con el texto
  (porcentaje de palabras coincidentes) y verifica que cada frase suena en su instante previsto.
También exporta los subtítulos a out/<video>.srt.
"""

import difflib
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent


def norm_words(text: str) -> list[str]:
    text = unicodedata.normalize("NFD", text.lower())
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return re.findall(r"[a-zñ0-9]+", text)


def srt_time(seconds: float) -> str:
    ms = int(round(seconds * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def main(video: str, mp4: str) -> None:
    plan = json.loads((ROOT / "src" / "videos" / video / "plan.json").read_text())
    script = json.loads((ROOT / "content" / video / "script.json").read_text())
    fps = plan["fps"]
    lines = [
        {"id": l["id"], "text": l["text"], "start": (s["from"] + l["from"]) / fps, "end": (s["from"] + l["from"] + l["durationInFrames"]) / fps}
        for s in plan["scenes"] for l in s["lines"]
    ]

    # 1) Formato
    probe = json.loads(subprocess.run(
        ["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", mp4], capture_output=True, check=True).stdout)
    v = next(s for s in probe["streams"] if s["codec_type"] == "video")
    a = next((s for s in probe["streams"] if s["codec_type"] == "audio"), None)
    dur = float(probe["format"]["duration"])
    print(f"video  {v['codec_name']} {v['width']}x{v['height']} @ {v['r_frame_rate']} · {v.get('nb_frames', '?')} fotogramas")
    print(f"audio  {a['codec_name'] if a else 'NINGUNO'} {a.get('sample_rate') if a else ''} Hz {a.get('channels') if a else ''} canales")
    print(f"duración {dur:.2f} s (plan: {plan['durationInFrames'] / fps:.2f} s) · {int(probe['format']['size']) / 1e6:.1f} MB")

    # 2) Sonoridad
    r128 = subprocess.run(["ffmpeg", "-hide_banner", "-i", mp4, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    summary = r128[r128.rfind("Summary:"):]
    integrated = re.search(r"I:\s+(-?[\d.]+) LUFS", summary)
    peak = re.search(r"Peak:\s+(-?[\d.]+) dBFS", summary)
    print(f"sonoridad integrada {integrated.group(1) if integrated else '?'} LUFS · pico real {peak.group(1) if peak else '?'} dBFS")

    # 3) Fidelidad de la narración (transcripción ciega del audio final)
    from faster_whisper import WhisperModel

    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", mp4, "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
    audio = np.frombuffer(raw, np.float32)
    model = WhisperModel("small", device="cpu", compute_type="int8")
    segs, _ = model.transcribe(audio, language="es", word_timestamps=True, beam_size=5, vad_filter=True)
    heard = [(w.word, w.start) for s in segs for w in s.words]

    expected = norm_words(" ".join(l.get("say", l["text"]) for sc in script["scenes"] for l in sc["lines"]))
    got = norm_words(" ".join(w for w, _ in heard))
    ratio = difflib.SequenceMatcher(None, expected, got, autojunk=False).ratio()
    print(f"coincidencia de palabras guion↔audio: {ratio * 100:.1f} % ({len(got)} palabras oídas / {len(expected)} esperadas)")

    # Sincronía: la primera palabra de cada frase debe sonar cerca de su inicio planificado.
    offsets = []
    for line in lines:
        near = [t for w, t in heard if abs(t - line["start"]) < 1.5]
        if near:
            offsets.append(min(near, key=lambda t: abs(t - line["start"])) - line["start"])
    if offsets:
        print(f"sincronía: {len(offsets)}/{len(lines)} frases detectadas en su instante · desfase medio {np.mean(np.abs(offsets)) * 1000:.0f} ms · máx {np.max(np.abs(offsets)) * 1000:.0f} ms")

    # 4) Subtítulos SRT (para subir a YouTube aparte, si se renderiza sin subtítulos integrados)
    srt = ROOT / "out" / f"{video}.srt"
    srt.write_text("\n".join(f"{i}\n{srt_time(l['start'])} --> {srt_time(l['end'])}\n{l['text']}\n" for i, l in enumerate(lines, 1)))
    print(f"subtítulos -> {srt.relative_to(ROOT)}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

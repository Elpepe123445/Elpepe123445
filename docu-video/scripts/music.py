"""Sintetiza la música ambiental y los efectos de sonido con numpy (sin samples ni servicios externos).

Uso:  python scripts/music.py eratostenes
Lee   src/videos/<video>/plan.json   (los acordes cambian con las escenas)
Crea  public/<video>/music.wav y public/<video>/sfx/*.wav

La mezcla deja un "hueco" espectral entre 1 y 4 kHz para que la música no compita con la voz.
"""

import json
import sys
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
rng = np.random.default_rng(240)  # semilla fija: el render es reproducible


def hz(midi: float) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


def env_adsr(n: int, attack: float, release: float) -> np.ndarray:
    e = np.ones(n)
    a, r = min(int(attack * SR), n // 2), min(int(release * SR), n // 2)
    e[:a] = np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    e[n - r:] = np.cos(np.linspace(0, np.pi / 2, r)) ** 2
    return e


# --- Instrumentos -----------------------------------------------------------------------------

def pad(out: np.ndarray, notes: list[int], t0: float, t1: float, amp: float) -> None:
    """Pad aditivo: armónicos suaves, dos voces desafinadas (estéreo) y brillo que respira."""
    fade = 3.0
    s0, s1 = max(0, int((t0 - fade / 2) * SR)), min(out.shape[1], int((t1 + fade / 2) * SR))
    n = s1 - s0
    if n <= 0:
        return
    t = np.arange(n) / SR
    e = env_adsr(n, fade, fade)
    for note in notes:
        f = hz(note)
        weight = amp * (0.75 if note < 48 else 1.0) / len(notes) ** 0.6
        breath = 0.6 + 0.4 * np.sin(2 * np.pi * (0.05 + rng.random() * 0.05) * t + rng.random() * 6.28)
        for ch, cents in ((0, -4), (1, 4)):
            fd = f * 2 ** (cents / 1200)
            phase = rng.random() * 6.28
            sig = np.zeros(n)
            for h in range(1, 7):
                if fd * h > 9000:
                    break
                g = 1 / h ** 1.7 * (breath if h > 2 else 1)
                sig += g * np.sin(2 * np.pi * fd * h * t + phase * h)
            out[ch, s0:s1] += weight * e * sig


def bell(out: np.ndarray, note: int, t0: float, amp: float, pan: float) -> None:
    """Campana suave con parciales inarmónicos (brillos agudos)."""
    n = int(4.0 * SR)
    s0 = int(t0 * SR)
    n = min(n, out.shape[1] - s0)
    if n <= 0:
        return
    t = np.arange(n) / SR
    f = hz(note)
    sig = sum(g * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d)
              for r, g, d in ((1, 1, 1.2), (2.76, 0.35, 2.4), (5.4, 0.12, 4.0)))
    sig *= np.minimum(1, t / 0.01)
    out[0, s0:s0 + n] += amp * (1 - pan) * sig
    out[1, s0:s0 + n] += amp * pan * sig


def pluck(out: np.ndarray, note: int, t0: float, amp: float, pan: float = 0.5, length: float = 3.0) -> None:
    """Arpa pulsada (Karplus-Strong vectorizado por bloques de un periodo)."""
    period = int(round(SR / hz(note)))
    n = min(int(length * SR), out.shape[1] - int(t0 * SR))
    if n <= period + 2:
        return
    y = np.zeros(n)
    y[:period] = rng.uniform(-1, 1, period)
    y[:period] = np.convolve(y[:period], np.ones(4) / 4, mode="same")  # ataque menos áspero
    for k in range(period, n, period):
        end = min(k + period, n)
        prev = y[k - period:end - period]
        prev2 = np.concatenate(([y[k - period - 1] if k - period - 1 >= 0 else 0], prev[:-1]))
        y[k:end] = 0.996 * 0.5 * (prev + prev2)
    s0 = int(t0 * SR)
    out[0, s0:s0 + n] += amp * (1 - pan) * y
    out[1, s0:s0 + n] += amp * pan * y


def pulse(out: np.ndarray, t0: float, amp: float) -> None:
    """Latido grave (tensión) — barrido 85→42 Hz."""
    n = int(1.2 * SR)
    s0 = int(t0 * SR)
    n = min(n, out.shape[1] - s0)
    if n <= 0:
        return
    t = np.arange(n) / SR
    f = 42 + 43 * np.exp(-t * 18)
    sig = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4.5) * np.minimum(1, t / 0.004)
    out[:, s0:s0 + n] += amp * sig


# --- Procesado espectral ----------------------------------------------------------------------

def reverb_ir(seconds: float = 4.2, decay: float = 1.1) -> np.ndarray:
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((2, n)) * np.exp(-t / decay)
    ir[:, : int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
    return ir / np.sqrt((ir ** 2).sum(axis=1, keepdims=True))


def spectral_mix(dry: np.ndarray, wet_gain: float, voice_pocket_db: float) -> np.ndarray:
    """Reverb por convolución FFT + EQ: pasa-altos 35 Hz, pasa-bajos suave 7 kHz, hueco para la voz."""
    ir = reverb_ir()
    size = 1 << int(np.ceil(np.log2(dry.shape[1] + ir.shape[1])))
    freqs = np.fft.rfftfreq(size, 1 / SR)
    hp = 1 / np.sqrt(1 + (35 / np.maximum(freqs, 1)) ** 4)
    lp = 1 / np.sqrt(1 + (freqs / 7000) ** 4)
    pocket = 1 - (1 - 10 ** (voice_pocket_db / 20)) * np.exp(-0.5 * (np.log2(np.maximum(freqs, 1) / 2000) / 0.8) ** 2)
    eq = hp * lp * pocket
    out = np.zeros_like(dry)
    for ch in range(2):
        D = np.fft.rfft(dry[ch], size)
        W = D * np.fft.rfft(ir[ch], size)
        out[ch] = np.fft.irfft((D + wet_gain * W) * eq, size)[: dry.shape[1]]
    return out


def write_wav(path: Path, data: np.ndarray, peak_db: float = -1.0) -> None:
    data = np.atleast_2d(data)
    data = data / (np.abs(data).max() + 1e-9) * 10 ** (peak_db / 20)
    pcm = (np.clip(data.T, -1, 1) * 32767).astype(np.int16)
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(data.shape[0])
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


# --- Partitura -------------------------------------------------------------------------------
# Re menor con color frigio (Mi bemol) para el misterio; resuelve a Re mayor en la gran revelación.
DM9 = [38, 45, 50, 57, 64]
BB9 = [34, 46, 53, 58, 62, 65]
GM9 = [43, 50, 55, 58, 62]
EB = [39, 46, 51, 55, 58]
F = [41, 48, 53, 57, 60, 65]
AM7 = [45, 52, 57, 60, 64]
FMAJ7 = [41, 48, 52, 57, 64]
C = [36, 48, 55, 60, 64]
DMAJ = [38, 45, 50, 54, 57, 62, 66]

SCORE = {
    "hook": {"chords": [DM9], "amp": 0.8, "bells": 0.10},
    "alejandria": {"chords": [BB9, DM9], "amp": 0.9, "harp": 0.18, "bells": 0.06},
    "mapa": {"chords": [GM9, DM9], "amp": 0.85, "bells": 0.05},
    "sombras": {"chords": [DM9, EB], "amp": 0.85, "pulse": 0.35},
    "rayos": {"chords": [BB9, F], "amp": 0.9, "bells": 0.07},
    "geometria": {"chords": [DM9, AM7], "amp": 0.8, "arp": 0.12},
    "calculo": {"chords": [BB9, C, DMAJ], "amp": 0.95, "pulse": 0.3, "climax": "calc-5"},
    "comparacion": {"chords": [FMAJ7, AM7], "amp": 0.75, "arp": 0.08},
    "legado": {"chords": [BB9, C, DM9, F], "amp": 1.0, "bells": 0.08},
    "cierre": {"chords": [DM9, DMAJ], "amp": 0.85, "bells": 0.09, "harp": 0.1},
}


def compose(plan: dict) -> np.ndarray:
    fps = plan["fps"]
    total = plan["durationInFrames"] / fps + 1.0
    out = np.zeros((2, int(total * SR)))
    for scene in plan["scenes"]:
        spec = SCORE[scene["id"]]
        t0 = scene["from"] / fps
        t1 = (scene["from"] + scene["durationInFrames"]) / fps
        cues = {line["id"]: line["from"] / fps + t0 for line in scene["lines"]}
        chords = spec["chords"]

        # Cambios de acorde: repartidos en la escena, o anclados al clímax si existe.
        if "climax" in spec:
            climax = cues[spec["climax"]]
            bounds = list(np.linspace(t0, climax, len(chords))) + [t1]
        else:
            bounds = list(np.linspace(t0, t1, len(chords) + 1))
        for chord, a, b in zip(chords, bounds[:-1], bounds[1:]):
            pad(out, chord, a, b, 0.11 * spec["amp"])

        top = [n + 24 for n in chords[0] if n >= 50]
        if spec.get("bells"):
            for t in np.arange(t0 + 1.5, t1 - 1, 2.6 + rng.random()):
                bell(out, int(rng.choice(top)), t + rng.random() * 0.8, spec["bells"], rng.random())
        if spec.get("harp"):
            scale = [62, 63, 66, 67, 69, 70, 74]  # Re frigio dominante: sabor antiguo, usado con moderación
            for i, t in enumerate(np.arange(t0 + 2, t1 - 2, 0.42)):
                if rng.random() < 0.55:
                    pluck(out, scale[(i * 3 + int(rng.random() * 2)) % len(scale)], t, spec["harp"], rng.random())
        if spec.get("arp"):
            for i, t in enumerate(np.arange(t0 + 1, t1 - 1, 0.6)):
                chord = chords[min(int((t - t0) / (t1 - t0) * len(chords)), len(chords) - 1)]
                tones = [n + 12 for n in chord if n >= 45]
                pluck(out, tones[i % len(tones)], t, spec["arp"], 0.3 + 0.4 * (i % 2), length=2.0)
        if spec.get("pulse"):
            for t in np.arange(t0 + 2, t1 - 1.5, 1.25):
                pulse(out, t, spec["pulse"])
        if "climax" in spec:
            climax = cues[spec["climax"]]
            for k, n in enumerate([62, 66, 69, 74, 78]):
                bell(out, n, climax + 0.08 * k, 0.12, 0.2 + 0.15 * k)
            pulse(out, climax, 0.9)

    # Dinámica general: entrada y salida suaves.
    n = out.shape[1]
    out *= env_adsr(n, 3.0, 5.0)
    return spectral_mix(out, wet_gain=0.55, voice_pocket_db=-5)


# --- Efectos de sonido -----------------------------------------------------------------------

def sfx_whoosh() -> np.ndarray:
    dur, hop, win = 1.4, 256, 1024
    n = int(dur * SR)
    noise = rng.standard_normal(n + win)
    out = np.zeros((2, n + win))
    window = np.hanning(win)
    freqs = np.fft.rfftfreq(win, 1 / SR)
    for i, s in enumerate(range(0, n, hop)):
        x = s / n
        center = 250 * (14 ** np.sin(np.pi * x))  # 250 Hz -> 3,5 kHz -> 250 Hz
        band = np.exp(-0.5 * (np.log2(np.maximum(freqs, 1) / center) / 0.9) ** 2)
        frame = np.fft.irfft(np.fft.rfft(noise[s:s + win] * window) * band) * window
        g = np.sin(np.pi * x) ** 1.5
        out[0, s:s + win] += frame * g * (1 - x * 0.7)
        out[1, s:s + win] += frame * g * (0.3 + x * 0.7)
    return out[:, :n]


def sfx_boom() -> np.ndarray:
    n = int(4.5 * SR)
    t = np.arange(n) / SR
    f = 30 + 30 * np.exp(-t * 3)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.3)
    hit = rng.standard_normal(n) * np.exp(-t * 30) * 0.25
    hit = np.convolve(hit, np.ones(24) / 24, mode="same")
    mono = (body + hit) * np.minimum(1, t / 0.003)
    return spectral_mix(np.vstack([mono, mono]), wet_gain=0.35, voice_pocket_db=0)


def sfx_tick() -> np.ndarray:
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    s = (np.sin(2 * np.pi * 2300 * t) + 0.5 * np.sin(2 * np.pi * 4100 * t)) * np.exp(-t * 90)
    return np.vstack([s, s])


def sfx_shimmer() -> np.ndarray:
    out = np.zeros((2, int(4.5 * SR)))
    for k, note in enumerate([81, 86, 88, 93, 98]):
        bell(out, note, 0.07 * k, 0.25, 0.15 + 0.17 * k)
    return spectral_mix(out, wet_gain=0.8, voice_pocket_db=0)


def sfx_riser() -> np.ndarray:
    n = int(3.0 * SR)
    t = np.arange(n) / SR
    f = 180 * 4 ** (t / 3.0)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.4 * np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR)
    noise = np.convolve(rng.standard_normal(n), np.ones(6) / 6, mode="same")
    env = (t / 3.0) ** 2.2
    mono = (0.5 * tone + 0.5 * noise) * env
    mono[-int(0.03 * SR):] *= np.linspace(1, 0, int(0.03 * SR))
    return spectral_mix(np.vstack([mono, mono]), wet_gain=0.4, voice_pocket_db=0)


def main(video: str) -> None:
    plan = json.loads((ROOT / "src" / "videos" / video / "plan.json").read_text())
    pub = ROOT / "public" / video
    write_wav(pub / "music.wav", compose(plan), peak_db=-1.0)
    for name, fn in {"whoosh": sfx_whoosh, "boom": sfx_boom, "tick": sfx_tick,
                     "shimmer": sfx_shimmer, "riser": sfx_riser}.items():
        write_wav(pub / "sfx" / f"{name}.wav", fn(), peak_db=-1.0)
    print(f"música {plan['durationInFrames'] / plan['fps']:.1f} s + 5 efectos en {pub.relative_to(ROOT)}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "eratostenes")

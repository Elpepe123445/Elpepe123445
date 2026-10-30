"""Convierte guion + duraciones de voz en un plan de fotogramas (fuente única de sincronía).

Uso:  python scripts/plan.py eratostenes
Lee   content/<video>/script.json, src/videos/<video>/voice-timings.json
Crea  src/videos/<video>/plan.json  (lo consumen Remotion y music.py)

Reglas (iguales a <TransitionSeries>): la escena i+1 empieza `transitionFrames` antes de que
termine la escena i, así que su narración arranca después de esa superposición.
"""

import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FPS = 30


def build(video: str) -> dict:
    script = json.loads((ROOT / "content" / video / "script.json").read_text())
    timings = json.loads((ROOT / "src" / "videos" / video / "voice-timings.json").read_text())
    d = script["defaults"]
    overlap = d["transitionFrames"]

    scenes, cursor = [], 0
    for i, scene in enumerate(script["scenes"]):
        t = scene.get("padStart", d["padStart"]) * FPS + (overlap if i > 0 else 0)
        lines = []
        for line in scene["lines"]:
            dur = timings[line["id"]] * FPS
            lines.append({
                "id": line["id"],
                "text": line["text"],
                "from": round(t),
                "durationInFrames": math.ceil(dur),
            })
            t += dur + line.get("pauseAfter", d["pauseAfter"]) * FPS
        duration = math.ceil(t + scene.get("padEnd", d["padEnd"]) * FPS)
        scenes.append({
            "id": scene["id"],
            "chapter": scene.get("chapter"),
            "from": cursor,
            "durationInFrames": duration,
            "lines": lines,
        })
        cursor += duration - overlap

    total = scenes[-1]["from"] + scenes[-1]["durationInFrames"]
    plan = {"fps": FPS, "transitionFrames": overlap, "durationInFrames": total, "scenes": scenes}
    out = ROOT / "src" / "videos" / video / "plan.json"
    out.write_text(json.dumps(plan, indent=1, ensure_ascii=False) + "\n")
    print(f"plan: {len(scenes)} escenas · {total} fotogramas ({total / FPS:.1f} s) · {out.relative_to(ROOT)}")
    return plan


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "eratostenes")

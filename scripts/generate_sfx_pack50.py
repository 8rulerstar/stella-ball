#!/usr/bin/env python3
"""Create 50 tiny, web-safe Prism Breakers WAV sound effects.

The pack is deterministic, has no external samples or licences, and uses only
the Python standard library.  Each cue is short enough for responsive browser
play; named cues can be previewed or selected by the runtime later.
"""
from __future__ import annotations

import json
import math
import os
import random
import struct
import wave
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "audio", "sfx50")
RATE = 22050

CUES = [
    *(f"launch-{n:02}" for n in range(1, 6)),
    *(f"wall-{n:02}" for n in range(1, 6)),
    *(f"unit-{n:02}" for n in range(1, 9)),
    *(f"weak-{n:02}" for n in range(1, 6)),
    *(f"riposte-{n:02}" for n in range(1, 6)),
    *(f"ability-{n:02}" for n in range(1, 9)),
    *(f"mult-{n:02}" for n in range(1, 5)),
    *(f"ui-{n:02}" for n in range(1, 6)),
    *(f"victory-{n:02}" for n in range(1, 4)),
    *(f"fail-{n:02}" for n in range(1, 3)),
]

assert len(CUES) == 50

def family(name: str) -> tuple[float, float, float, str]:
    kind, number = name.rsplit("-", 1)
    n = int(number)
    base = {
        "launch": (170, 620, .15, "triangle"),
        "wall": (190, 330, .09, "square"),
        "unit": (230, 510, .12, "triangle"),
        "weak": (410, 980, .19, "saw"),
        "riposte": (270, 1240, .28, "saw"),
        "ability": (320, 790, .22, "triangle"),
        "mult": (510, 1120, .16, "square"),
        "ui": (470, 720, .08, "square"),
        "victory": (330, 880, .42, "triangle"),
        "fail": (240, 110, .27, "saw"),
    }[kind]
    spread = 1 + (n - 3) * .035
    return base[0] * spread, base[1] * spread, base[2] + (n % 3) * .012, base[3]

def wave_value(kind: str, phase: float) -> float:
    s = math.sin(phase)
    if kind == "square":
        return 1.0 if s >= 0 else -1.0
    if kind == "saw":
        return (phase / math.pi) % 2 - 1
    return s

def make(name: str) -> dict[str, object]:
    start, end, duration, shape = family(name)
    count = int(RATE * duration)
    rng = random.Random(zlib.crc32(name.encode()))
    samples: list[int] = []
    for index in range(count):
        t = index / RATE
        progress = index / max(1, count - 1)
        frequency = start * ((end / start) ** progress)
        phase = 2 * math.pi * frequency * t
        attack = min(1, t / .008)
        decay = (1 - progress) ** (1.3 if "riposte" in name else 1.8)
        body = wave_value(shape, phase) * .52
        harmonic = math.sin(phase * (1.996 + (rng.random() - .5) * .015)) * .18
        grit = (rng.random() * 2 - 1) * (.12 if "wall" in name or "weak" in name else .045)
        if name.startswith("victory"):
            body += math.sin(phase * .75) * .18
        if name.startswith("fail"):
            body += math.sin(phase * .5) * .12
        value = max(-1, min(1, (body + harmonic + grit) * attack * decay))
        samples.append(int(value * 24575))
    path = os.path.join(OUT, f"{name}.wav")
    with wave.open(path, "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(struct.pack("<" + "h" * len(samples), *samples))
    return {"file": f"audio/sfx50/{name}.wav", "cue": name, "durationMs": round(duration * 1000), "sampleRate": RATE}

def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    cues = [make(name) for name in CUES]
    manifest = {"name": "Prism Breakers SFX Pack 50", "format": "WAV / mono / PCM 16-bit", "licence": "project-original procedural synthesis", "cues": cues}
    with open(os.path.join(ROOT, "assets", "audio", "SFX50_MANIFEST.json"), "w", encoding="utf-8") as output:
        json.dump(manifest, output, ensure_ascii=False, indent=2)
        output.write("\n")
    print(json.dumps({"result": "created", "count": len(cues), "output": "assets/audio/sfx50"}, ensure_ascii=False))

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Generate the unreferenced Observatory Pack 01 candidate sound effects."""

from __future__ import annotations

import json
import math
import random
import struct
import wave
from pathlib import Path


RATE = 22050
OUT = Path(__file__).parent

CUES = {
    "luna-arrival": ([523.25, 659.25, 783.99], 0.42, "sine"),
    "luna-advance": ([659.25, 880.0], 0.15, "sine"),
    "tutorial-pulse": ([261.63, 392.0, 523.25], 0.30, "triangle"),
    "constellation-link": ([392.0, 523.25, 659.25, 783.99], 0.46, "sine"),
    "constellation-complete": ([523.25, 659.25, 783.99, 1046.5], 0.64, "triangle"),
    "core-fracture": ([420.0, 280.0, 150.0], 0.38, "crystal"),
}


def oscillator(shape: str, phase: float) -> float:
    if shape == "triangle":
        return 2 * abs(2 * ((phase / (2 * math.pi)) % 1) - 1) - 1
    if shape == "crystal":
        return math.sin(phase) * 0.52 + math.sin(phase * 2.01) * 0.25
    return math.sin(phase)


def render(name: str, notes: list[float], duration: float, shape: str) -> dict[str, object]:
    count = round(RATE * duration)
    rng = random.Random(name)
    samples: list[int] = []
    note_count = len(notes)
    for index in range(count):
        t = index / RATE
        progress = index / max(1, count - 1)
        note_index = min(note_count - 1, int(progress * note_count))
        local = (progress * note_count) % 1
        frequency = notes[note_index]
        phase = 2 * math.pi * frequency * t
        attack = min(1.0, local / 0.08)
        release = max(0.0, 1 - local) ** (1.55 if shape != "crystal" else 0.7)
        value = oscillator(shape, phase) * attack * release * 0.48
        if shape == "crystal":
            value += (rng.random() * 2 - 1) * 0.08 * release
        samples.append(int(max(-1, min(1, value)) * 24575))
    path = OUT / f"{name}.wav"
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(struct.pack("<" + "h" * len(samples), *samples))
    return {
        "cue": name,
        "file": f"audio/{name}.wav",
        "durationMs": round(duration * 1000),
        "sampleRate": RATE,
        "format": "WAV / mono / PCM 16-bit",
    }


def main() -> None:
    cues = [render(name, *settings) for name, settings in CUES.items()]
    manifest = {
        "name": "Stella Ball Observatory Pack 01 (candidate)",
        "status": "unreferenced candidate; no runtime loading or manifest registration",
        "licence": "project-original procedural synthesis",
        "cues": cues,
    }
    (OUT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({"created": len(cues), "output": str(OUT)}, ensure_ascii=False))


if __name__ == "__main__":
    main()

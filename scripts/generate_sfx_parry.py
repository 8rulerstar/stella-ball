#!/usr/bin/env python3
"""Create the parry, starlight and constellation cues the 50-pack has no slot for.

Companion to `generate_sfx_pack50.py`, deliberately separate: that pack is a
fixed set of fifty tuned by family and index, and widening its families would
renumber files the runtime already names.  These eleven are their own cues.

Same rules as the pack — deterministic, standard library only, no external
samples and no licences — and the same 22050Hz mono 16-bit format, so the
runtime's existing `sampleSfxPool` plays them without knowing the difference.

Run: python3 scripts/generate_sfx_parry.py
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

# start, end, seconds, wave, character
#
# The parry pair is the point of this file.  A timed input whose success and
# failure sound alike cannot teach the timing, and until now neither had a
# sound at all: success borrowed the generic unlock tone and both failures were
# silent.  So they are built as opposites — success rises, fails fall; success
# is bright, failure is dull; success is short, the scatter is long.
CUES: dict[str, tuple[float, float, float, str, str]] = {
    # Success: a quick bright lift, over before the meteor has left the unit.
    "parry-hit": (430, 1180, 0.16, "triangle", "clean"),
    # The window closed on nothing.  Low, brief, unmistakably not the above.
    "parry-miss": (300, 165, 0.17, "saw", "dull"),
    # The chain being wiped, which is the most expensive thing that can happen
    # in a shot and had no sound whatsoever.  Longest and lowest of the three.
    "parry-scatter": (520, 120, 0.42, "saw", "scatter"),
    # One node landing.  Tiny, so seven of them in a shot never becomes noise.
    "node-01": (880, 1320, 0.09, "sine", "clean"),
    # Constellations by point count rather than by name: the tier is what the
    # player earned, and three of the five tiers have only one shape anyway.
    "figure-03": (392, 784, 0.34, "triangle", "bloom"),
    "figure-04": (440, 880, 0.38, "triangle", "bloom"),
    "figure-05": (494, 988, 0.44, "triangle", "bloom"),
    "figure-06": (523, 1046, 0.52, "triangle", "bloom"),
    "figure-07": (587, 1175, 0.62, "triangle", "bloom"),
    # Two beats of the summon: starlight drawing in, then the answer.
    "summon-01": (210, 640, 0.9, "sine", "gather"),
    "summon-02": (330, 990, 1.1, "triangle", "bloom"),
}


def wave_value(kind: str, phase: float) -> float:
    s = math.sin(phase)
    if kind == "square":
        return 1.0 if s >= 0 else -1.0
    if kind == "saw":
        return (phase / math.pi) % 2 - 1
    return s


def make(name: str) -> dict[str, object]:
    start, end, duration, shape, character = CUES[name]
    count = int(RATE * duration)
    rng = random.Random(zlib.crc32(name.encode()))
    samples: list[int] = []
    for index in range(count):
        t = index / RATE
        progress = index / max(1, count - 1)
        # `gather` accelerates into its own end; everything else glides evenly.
        travel = progress**2.1 if character == "gather" else progress
        frequency = start * ((end / start) ** travel)
        phase = 2 * math.pi * frequency * t
        attack = min(1, t / (0.05 if character == "gather" else 0.006))
        decay = {
            "clean": (1 - progress) ** 2.4,
            "dull": (1 - progress) ** 1.2,
            "scatter": (1 - progress) ** 1.05,
            "bloom": (1 - progress) ** 1.5,
            "gather": (1 - progress) ** 0.6,
        }[character]
        body = wave_value(shape, phase) * 0.52
        # A fifth above for anything that should read as a chord rather than a
        # blip; the constellation cues are the reward sound, so they get body.
        if character in ("bloom", "gather"):
            body += math.sin(phase * 1.5) * 0.22
        if character == "bloom":
            body += math.sin(phase * 2.0) * 0.14
        # Failure is noisy and detuned on purpose: the ear reads roughness as
        # "wrong" faster than it reads pitch as "lower".
        harmonic = math.sin(phase * (1.996 + (rng.random() - 0.5) * 0.015)) * 0.18
        grit = (rng.random() * 2 - 1) * (
            0.16 if character in ("dull", "scatter") else 0.03
        )
        if character == "scatter":
            # Breaking apart: a slow tremolo that widens as it falls.
            body *= 0.6 + 0.4 * math.sin(2 * math.pi * (7 + progress * 16) * t)
        value = max(-1, min(1, (body + harmonic + grit) * attack * decay))
        samples.append(int(value * 24575))
    path = os.path.join(OUT, f"{name}.wav")
    with wave.open(path, "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(struct.pack("<" + "h" * len(samples), *samples))
    return {
        "file": f"audio/sfx50/{name}.wav",
        "cue": name,
        "durationMs": round(duration * 1000),
        "sampleRate": RATE,
    }


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    written = [make(name) for name in CUES]
    print(json.dumps({"written": len(written), "cues": written}, indent=2))


if __name__ == "__main__":
    main()

// Feedback pass: collisions, high-value hits, unit awakenings, and multipliers
// each get their own readable beat.  The short stop is intentionally paired
// with a longer ring/popup so the player has time to register the result.
let feedbackBeats = [],
  feedbackCooldown = 0,
  finisherFocus = null,
  finisherImpacts = [],
  settlementBeat = null;
const cssReplayTokens = new WeakMap();
function replayCssClass(element, className) {
  if (!element) return;
  const token = (cssReplayTokens.get(element) || 0) + 1;
  cssReplayTokens.set(element, token);
  element.classList.remove(className);
  requestAnimationFrame(() => {
    if (cssReplayTokens.get(element) === token && element.isConnected)
      element.classList.add(className);
  });
}
function feedbackBeat(kind, px, py, col = "#fff1a6", power = 1, label = "") {
  if (!Number.isFinite(px) || !Number.isFinite(py)) return;
  feedbackBeats.push({
    kind,
    x: px,
    y: py,
    col,
    power: Math.min(1.8, power),
    label,
    t: 0,
    d:
      kind === "weak" || kind === "riposte"
        ? 0.68
        : kind === "awaken"
          ? 0.58
          : 0.42,
  });
  if (feedbackBeats.length > 8)
    feedbackBeats.splice(0, feedbackBeats.length - 8);
}
function combatSfx(kind = "hit", strength = 1, heroId = "") {
  if (settings.sfx <= 0) return;
  // Project samples are the primary path.  Synthesis remains a fallback for
  // regular contacts. Supers deliberately layer a short sample with a low,
  // procedural body so charge, release and impact remain distinct.
  const sampled = playSampleSfx(kind, strength, heroId),
    layered = [
      "bumper",
      "launch",
      "settlement",
      "finisherCharge",
      "finisherRelease",
      "finisherHit",
      "victory",
      "fail",
    ].includes(kind);
  if (sampled && !layered) return;
  const engine = ensureAudio();
  if (!engine) return;
  const ac = engine.ac,
    now = ac.currentTime,
    tones = {
      wall: [170, 235, 0.055],
      unit: [215, 405, 0.085],
      hit: [250, 390, 0.1],
      weak: [360, 760, 0.16],
      riposte: [290, 930, 0.24],
      awaken: [420, 640, 0.13],
      mult: [510, 820, 0.13],
      bumper: [155, 590, 0.14],
      launch: [128, 510, 0.18],
      settlement: [196, 660, 0.3],
      finisherCharge: [104, 520, 0.48],
      finisherRelease: [820, 145, 0.26],
      finisherHit: [92, 46, 0.34],
      victory: [262, 784, 0.62],
      fail: [180, 72, 0.46],
    }[kind] || [260, 420, 0.08];
  const gain = ac.createGain(),
    osc = ac.createOscillator();
  osc.type =
    kind === "weak" ||
    kind === "riposte" ||
    kind === "finisherRelease" ||
    kind === "finisherHit"
      ? "sawtooth"
      : kind === "finisherCharge" || kind === "victory"
        ? "triangle"
        : "square";
  osc.frequency.setValueAtTime(tones[0], now);
  osc.frequency.exponentialRampToValueAtTime(tones[1], now + tones[2]);
  gain.gain.setValueAtTime(
    (layered ? 0.028 : 0.042) * settings.sfx * Math.min(1.5, strength),
    now,
  );
  gain.gain.exponentialRampToValueAtTime(0.001, now + tones[2]);
  osc.connect(gain);
  gain.connect(engine.master);
  osc.start(now);
  osc.stop(now + tones[2] + 0.025);
  if (layered) {
    const body = ac.createOscillator(),
      bodyGain = ac.createGain(),
      bodyStart = Math.max(38, Math.min(120, tones[0] * 0.5)),
      bodyEnd = Math.max(32, Math.min(180, tones[1] * 0.38));
    body.type = "sine";
    body.frequency.setValueAtTime(bodyStart, now);
    body.frequency.exponentialRampToValueAtTime(bodyEnd, now + tones[2]);
    bodyGain.gain.setValueAtTime(
      0.055 * settings.sfx * Math.min(1.35, strength),
      now,
    );
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + tones[2] + 0.08);
    body.connect(bodyGain);
    bodyGain.connect(engine.master);
    body.start(now);
    body.stop(now + tones[2] + 0.1);
  }
}
const abilitySampleCue = {
  gaon: "ability-01",
  biyeon: "ability-02",
  lumi: "ability-03",
  haru: "ability-04",
  ria: "ability-05",
  sera: "ability-06",
  taeo: "ability-07",
  nyx: "ability-08",
};
const sampleSfxCue = {
  wall: "wall-03",
  unit: "unit-03",
  hit: "unit-06",
  weak: "weak-03",
  riposte: "riposte-03",
  awaken: "ability-05",
  mult: "mult-03",
  bumper: "mult-02",
  launch: "launch-02",
  settlement: "mult-04",
  finisherRelease: "riposte-02",
  finisherHit: "weak-05",
  victory: "victory-03",
  fail: "fail-01",
  // Parry, from `generate_sfx_parry.py`.  Success and the two failures are
  // deliberately opposite in direction, brightness and length: a timed input
  // whose outcomes sound alike cannot teach its own timing, and until these
  // existed success borrowed the generic unlock tone while both failures made
  // no sound at all.
  parry: "parry-hit",
  parryMiss: "parry-miss",
  parryScatter: "parry-scatter",
  node: "node-01",
  // Constellations by point count. Three of the five tiers hold a single shape
  // anyway, and the count is what the player actually earned.
  figure3: "figure-03",
  figure4: "figure-04",
  figure5: "figure-05",
  figure6: "figure-06",
  figure7: "figure-07",
  summonGather: "summon-01",
  summonReveal: "summon-02",
};
const sampleSfxCooldown = {};
const sampleSfxPools = new Map();
function sampleSfxPool(cue) {
  let pool = sampleSfxPools.get(cue);
  if (pool) return pool;
  pool = {
    cursor: 0,
    voices: Array.from({ length: 2 }, () => {
      const sound = new Audio("../assets/audio/sfx50/" + cue + ".wav");
      sound.preload = "auto";
      return sound;
    }),
  };
  sampleSfxPools.set(cue, pool);
  return pool;
}
function playSampleSfx(kind = "hit", strength = 1, heroId = "") {
  const cue =
    kind === "finisherCharge"
      ? abilitySampleCue[heroId] || "ability-05"
      : sampleSfxCue[kind];
  if (!cue || settings.sfx <= 0) return false;
  const now = performance.now(),
    last = sampleSfxCooldown[cue] || 0;
  if (now - last < 90) return true;
  sampleSfxCooldown[cue] = now;
  const pool = sampleSfxPool(cue),
    sound = pool.voices[pool.cursor++ % pool.voices.length];
  sound.pause();
  sound.currentTime = 0;
  sound.volume = Math.min(
    0.24,
    settings.master * settings.sfx * 0.18 * Math.min(1.35, strength),
  );
  sound.play().catch(() => {});
  return true;
}
function paintFeedbackAsset(
  path,
  px,
  py,
  size,
  alpha = 1,
  angle = 0,
  turn = 0,
) {
  const image = textures[path];
  if (!image?.complete || !image.naturalWidth) return;
  x.save();
  x.translate(px, py);
  x.rotate(angle + turn);
  x.globalAlpha = Math.max(0, Math.min(1, alpha));
  x.globalCompositeOperation = "screen";
  x.imageSmoothingEnabled = false;
  x.shadowBlur = 12;
  x.shadowColor = "#ffe9ad";
  x.drawImage(image, -size / 2, -size / 2, size, size);
  x.restore();
}
function paintElectricRing(px, py, size, progress, alpha = 1) {
  const image = textures[feedbackArt.electric];
  if (!image?.complete || !image.naturalWidth) return;
  const cols = 6,
    rows = 5,
    frame = Math.min(cols * rows - 1, Math.floor(progress * (cols * rows - 1))),
    fw = image.naturalWidth / cols,
    fh = image.naturalHeight / rows;
  x.save();
  x.translate(px, py);
  x.rotate(progress * Math.PI * 0.8);
  x.globalAlpha = Math.max(0, Math.min(1, alpha));
  x.globalCompositeOperation = "screen";
  x.imageSmoothingEnabled = false;
  x.drawImage(
    image,
    (frame % cols) * fw,
    Math.floor(frame / cols) * fh,
    fw,
    fh,
    -size / 2,
    -size / 2,
    size,
    size,
  );
  x.restore();
}
function isVfxOverBudget() {
  return (
    fieldFx.length +
      feedbackBeats.length +
      abilityBursts.length +
      assistShots.length >
    18
  );
}
const baseFieldFx = drawFieldFx;
drawFieldFx = function () {
  baseFieldFx();
  const start = isVfxOverBudget() ? Math.max(0, fieldFx.length - 6) : 0;
  for (let index = start; index < fieldFx.length; index++) {
    const f = fieldFx[index];
    const p = Math.max(0, 1 - f.t / f.d),
      size = 72 + (1 - p) * 36;
    if (f.type === "bumper")
      paintElectricRing(f.x, f.y, 78 + (1 - p) * 28, 1 - p, p * 0.78);
    else if (f.type === "relay")
      paintFeedbackAsset(
        feedbackArt.comet,
        f.x,
        f.y,
        size * 0.92,
        p * 0.52,
        f.t * 2.6,
      );
    else if (f.type === "mirror" || f.type === "shockwave")
      paintFeedbackAsset(
        feedbackArt.shockwave,
        f.x,
        f.y,
        size * 1.35,
        p * 0.42,
        -f.t * 1.8,
      );
    else if (f.type === "turn")
      paintFeedbackAsset(
        feedbackArt.comet,
        f.x,
        f.y,
        size,
        p * 0.52,
        -Math.PI * 0.25,
        f.t * 3,
      );
    else if (f.type === "blaze" || f.type === "assist")
      paintFeedbackAsset(feedbackArt.impact, f.x, f.y, size, p * 0.4, f.t * 2);
  }
};
function drawFeedbackBeats() {
  const start = isVfxOverBudget() ? Math.max(0, feedbackBeats.length - 6) : 0;
  for (let index = start; index < feedbackBeats.length; index++) {
    const beat = feedbackBeats[index];
    const p = Math.min(1, beat.t / beat.d),
      fade = 1 - p,
      size = (28 + 76 * p) * beat.power;
    if (beat.kind === "wall")
      paintElectricRing(beat.x, beat.y, size * 1.22, p, fade * 0.8);
    else if (beat.kind === "weak")
      paintFeedbackAsset(
        feedbackArt.impact,
        beat.x,
        beat.y,
        size * 1.85,
        fade * 0.8,
        p * 0.7,
      );
    else if (beat.kind === "riposte")
      paintFeedbackAsset(
        feedbackArt.comet,
        beat.x,
        beat.y,
        size * 2.1,
        fade * 0.88,
        -Math.PI * 0.25 + p * 0.55,
      );
    else if (beat.kind === "unit" || beat.kind === "awaken")
      paintFeedbackAsset(
        feedbackArt.shockwave,
        beat.x,
        beat.y,
        size * 1.8,
        fade * 0.54,
        -p * 1.7,
      );
    else if (beat.kind === "hit")
      paintFeedbackAsset(
        feedbackArt.burst,
        beat.x,
        beat.y,
        size * 1.36,
        fade * 0.75,
        p * 0.5,
      );
    x.save();
    x.globalAlpha = fade;
    x.translate(beat.x, beat.y);
    x.strokeStyle = beat.col;
    x.fillStyle = beat.col;
    x.shadowBlur = 16;
    x.shadowColor = beat.col;
    if (beat.kind === "unit" || beat.kind === "awaken") {
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 + p * 1.4,
          inner = 10,
          outer = size * 0.48;
        x.lineWidth = i % 2 ? 2 : 4;
        x.beginPath();
        x.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
        x.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
        x.stroke();
      }
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3 - p * 0.9,
          distance = 18 + p * size * (0.45 + (i % 2) * 0.12),
          block = i % 2 ? 4 : 7;
        x.fillStyle = i % 2 ? beat.col : "#fff4c9";
        x.fillRect(
          Math.round(Math.cos(angle) * distance - block / 2),
          Math.round(Math.sin(angle) * distance - block / 2),
          block,
          block,
        );
      }
    } else if (beat.kind === "weak" || beat.kind === "riposte") {
      for (let i = 0; i < 3; i++) {
        x.lineWidth = 3 + i;
        x.beginPath();
        x.arc(
          0,
          0,
          size * (0.18 + i * 0.13),
          p * 4 + i,
          Math.PI * 2 + p * 4 + i,
        );
        x.stroke();
      }
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 - p * 3;
        x.fillRect(
          Math.cos(a) * size * 0.46 - 3,
          Math.sin(a) * size * 0.46 - 3,
          6,
          6,
        );
      }
    } else {
      x.lineWidth = 3;
      x.beginPath();
      x.arc(0, 0, size * 0.34, 0, Math.PI * 2);
      x.stroke();
      x.lineWidth = 1;
      x.beginPath();
      x.arc(0, 0, size * 0.52, 0, Math.PI * 2);
      x.stroke();
    }
    if (beat.kind === "weak" || beat.kind === "riposte") {
      const ray = 10 + size * 0.16;
      x.fillStyle = "#fff7d2";
      x.shadowColor = "#f2ca70";
      x.shadowBlur = 20;
      x.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 8,
          r = i % 2 ? ray * 0.36 : ray;
        x.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      x.closePath();
      x.fill();
    }
    if (beat.label && p < 0.72) {
      x.globalAlpha = fade * 1.35;
      x.font =
        (beat.kind === "weak" || beat.kind === "riposte"
          ? "bold 15px"
          : "bold 12px") + " Galmuri11, ui-monospace";
      x.textAlign = "center";
      x.fillStyle = "#080a1d";
      x.shadowBlur = 0;
      x.fillText(beat.label, 2, -size * 0.55 + 2);
      x.fillStyle =
        beat.kind === "weak" || beat.kind === "riposte" ? "#fff3bd" : "#f0f4ff";
      x.shadowBlur = 12;
      x.shadowColor = beat.col;
      x.fillText(beat.label, 0, -size * 0.55);
    }
    x.restore();
  }
}
const baseDrawAssists = drawAssists;
drawAssists = function () {
  baseDrawAssists();
  for (const shot of assistShots) {
    if (shot.delay > 0) {
      if (shot.finisher && shot !== finisherFocus) continue;
      const charge = shot.finisher
        ? Math.min(1, (shot.focusT || 0) / 0.48)
        : Math.max(0, Math.min(1, 1 - shot.delay / 0.32));
      paintFeedbackAsset(
        feedbackArt.shockwave,
        shot.fromX,
        shot.fromY,
        62 + charge * (shot.finisher ? 42 : 18),
        0.24 + charge * 0.28,
        -shot.delay * 4,
      );
      continue;
    }
    const p = Math.min(1, shot.t / shot.dur),
      // Ultimate shots hang in anticipation, then cover the final distance
      // quickly enough that the hit still feels decisive.
      ease = shot.finisher
        ? p < 0.72
          ? 0.58 * Math.pow(p / 0.72, 2.2)
          : 0.58 + 0.42 * (1 - Math.pow(1 - (p - 0.72) / 0.28, 3))
        : p * p * (3 - 2 * p),
      px = shot.fromX + (boss.x - shot.fromX) * ease,
      py = shot.fromY + (boss.y - shot.fromY) * ease,
      angle = Math.atan2(boss.y - shot.fromY, boss.x - shot.fromX);
    paintFeedbackAsset(
      feedbackArt.comet,
      px,
      py,
      (shot.finisher ? 68 : 52) + (1 - p) * (shot.finisher ? 36 : 24),
      0.35 + (shot.finisher ? 0.5 : 0.36) * p,
      angle,
      Math.PI * 0.25,
    );
    if (p > (shot.finisher ? 0.7 : 0.78))
      paintFeedbackAsset(
        feedbackArt.impact,
        px,
        py,
        76 + (p - (shot.finisher ? 0.7 : 0.78)) * (shot.finisher ? 230 : 150),
        (p - (shot.finisher ? 0.7 : 0.78)) * (shot.finisher ? 3.2 : 4),
        angle,
      );
  }
};
impact = function (
  weak = false,
  px = ball?.x ?? boss?.x,
  py = boss?.y ?? ball?.y,
  profile = "default",
) {
  const force = Math.min(1.9, 1 + (hitCombo - 1) * 0.18),
    heavy = Boolean(weak) || hitCombo >= 3,
    contact = profile === "contact",
    finisher = profile === "finisher",
    stop = contact ? 0.028 : (finisher ? 0.046 : heavy ? 0.075 : 0.034) * force,
    shake = contact ? 5.5 : (finisher ? 8.5 : heavy ? 10 : 5.5) * force;
  impactStop = Math.max(Number.isFinite(impactStop) ? impactStop : 0, stop);
  screenShake = Math.max(Number.isFinite(screenShake) ? screenShake : 0, shake);
  screenFlash = Math.max(
    Number.isFinite(screenFlash) ? screenFlash : 0,
    (heavy ? 1 : 0.58) * force,
  );
  const kind = hitCombo >= 3 ? "riposte" : weak ? "weak" : "hit";
  feedbackBeat(
    kind,
    px,
    py,
    heavy ? "#fff0a3" : "#e6f7ef",
    force,
    hitCombo >= 3 ? "연타!" : weak ? "WEAK!" : "",
  );
  combatSfx(kind, force);
  if (heavy && !contact) replayCssClass(stageEl, "impact-heavy");
  const banner = document.querySelector(".boss-banner");
  if (heavy && !contact && banner) replayCssClass(banner, "impact-heavy");
  if (navigator.vibrate)
    navigator.vibrate(contact ? 5 : heavy ? [10, 16, 12] : 7);
};
const baseRegisterBossHit = registerBossHit;
registerBossHit = function (weak) {
  baseRegisterBossHit(weak);
  if (hitCombo >= 3) {
    comboTimer = Math.max(comboTimer, 1.45);
    comboPulse = 1.45;
  }
};
const baseTableWall = tableWall;
tableWall = function () {
  baseTableWall();
  if (!ball) return;
  feedbackBeat("wall", ball.x, ball.y, "#8ae9e0", 0.62);
  combatSfx("wall", 0.7);
};
const baseMobilePair = mobilePair;
mobilePair = function (a, ar, b, br, onHit) {
  return baseMobilePair(a, ar, b, br, (...args) => {
    onHit?.(...args);
    const hero = gates.includes(a) ? a : gates.includes(b) ? b : null;
    if (hero && feedbackCooldown <= 0) {
      feedbackCooldown = 0.12;
      feedbackBeat("unit", hero.x, hero.y, hero.col, 1.05, "공명!");
      combatSfx("unit", 1);
    }
  });
};
const baseEarnBlaze = earnBlaze;
earnBlaze = function (amount, detail) {
  baseEarnBlaze(amount, detail);
  feedbackBeat(
    "awaken",
    ball?.x ?? W / 2,
    ball?.y ?? H / 2,
    "#ffe09a",
    1.08,
    "CONSTELLATION +" + amount.toFixed(1),
  );
  combatSfx("mult", 1);
  replayCssClass(U.blazeCard, "impact-heavy");
};
const baseQueueUnitAssist = queueUnitAssist;
queueUnitAssist = function (g, amount, name, options = {}) {
  const queued = assistShots.length;
  baseQueueUnitAssist(g, amount, name, options);
  const shot = assistShots.at(-1);
  if (shot) {
    if (shot.finisher) {
      // One hero owns a complete ultimate beat before the next takes focus.
      // Future shots keep counting down but stay visually hidden.
      shot.delay = 0.52 + shot.finisherOrder * 1.62;
      shot.dur = 1.08;
      shot.focusT = 0;
    } else {
      shot.delay = Math.min(0.32, queued * 0.085);
      shot.dur = Math.max(
        options.parry ? 0.22 : 0.3,
        shot.dur + (options.parry ? 0.02 : 0.1),
      );
    }
  }
  if (!shot?.finisher) {
    feedbackBeat(
      "awaken",
      g.x,
      g.y,
      g.col,
      options.parry ? 0.54 : 1.08,
      g.s + (options.parry ? " 공명" : " 각성"),
    );
    combatSfx("awaken", options.parry ? 0.52 : 0.9);
  }
};
const baseFeedbackSettleParty = settleParty;
settleParty = function () {
  const awakened = gates.filter((gate) => gate.moved && gate.travel > 10),
    finishers = awakened.filter((gate) => {
      const fx = gate.fx === "copycat" ? gate.copiedFx : gate.fx;
      return fx !== "bladewheel";
    });
  // The figure system owns every active combat's settle, but it does so a layer
  // below this one, so the banner and its slow-motion must stay muted. The
  // `typeof` guard keeps this line harmless if the system is ever removed.
  const figureOwnsSettle = typeof figureActive === "function" && figureActive();
  if (awakened.length && !figureOwnsSettle) {
    settlementBeat = {
      t: 0,
      d: 0.92,
      col: finishers[0]?.col || awakened[0].col,
      kicker: finishers.length ? "STELLAR SETTLEMENT" : "MOTION COMPLETE",
      label: awakened.map((gate) => gate.s).join(" · "),
    };
    combatSfx("settlement", 0.92);
  }
  return baseFeedbackSettleParty();
};
updateAssists = function (d) {
  let writeImpact = 0;
  for (let index = 0; index < finisherImpacts.length; index++) {
    const impact = finisherImpacts[index];
    impact.t += d;
    if (impact.t < impact.d) finisherImpacts[writeImpact++] = impact;
  }
  finisherImpacts.length = writeImpact;

  let writeShot = 0,
    nextFocus = null;
  for (let index = 0; index < assistShots.length; index++) {
    const shot = assistShots[index];
    if (shot.delay > 0) {
      const waiting = shot.delay;
      shot.delay = Math.max(0, shot.delay - d);
      if (shot.finisher && waiting > 0 && shot.delay <= 0) {
        shot.releaseSfx = true;
        combatSfx("finisherRelease", 1.08, shot.sourceId);
        screenFlash = Math.max(screenFlash || 0, 0.32);
      }
    } else shot.t += d;
    if (shot.delay <= 0 && shot.t >= shot.dur) {
      if (shot.finisher) {
        finisherImpacts.push({ ...shot, t: 0, d: 0.58 });
        if (finisherImpacts.length > 2) finisherImpacts.shift();
        combatSfx("finisherHit", 1.2, shot.sourceId);
      }
      resolveAssist(shot);
      continue;
    }
    assistShots[writeShot++] = shot;
    if (!nextFocus && shot.finisher) nextFocus = shot;
  }
  assistShots.length = writeShot;
  if (nextFocus !== finisherFocus) {
    finisherFocus = nextFocus;
    if (finisherFocus) {
      finisherFocus.focusT = 0;
      const gate = gates.find((unit) => unit.id === finisherFocus.sourceId);
      if (gate) {
        playUnitAttack(gate);
        emitAbilityFx(
          gate,
          gate.x,
          gate.y,
          138,
          0.56,
          Math.atan2(boss.y - gate.y, boss.x - gate.x),
        );
        fieldFx.push({
          type: "assist",
          x: gate.x,
          y: gate.y,
          t: 0,
          d: 0.5,
          col: gate.col,
        });
        feedbackBeat(
          "awaken",
          gate.x,
          gate.y,
          gate.col,
          1.08,
          gate.s + " 각성",
        );
        combatSfx("finisherCharge", 1.04, gate.id);
      }
    }
  }
  if (finisherFocus) {
    finisherFocus.focusT += d;
    battle.slow = Math.max(battle.slow || 0, 0.08);
  }
};
function drawFinisherMotif(gate, heroX, heroY, release, alpha) {
  const fx = gate.fx === "copycat" ? gate.copiedFx || "copycat" : gate.fx,
    phase = finisherFocus.focusT,
    bossX = boss.x,
    bossY = boss.y;
  x.save();
  x.globalAlpha = alpha * 0.72;
  x.strokeStyle = gate.col;
  x.fillStyle = gate.col;
  x.shadowBlur = 13;
  x.shadowColor = gate.col;
  x.lineWidth = 3;
  if (fx === "slash") {
    x.translate(heroX, heroY);
    x.rotate(-0.42);
    for (let i = -1; i <= 1; i++) {
      const sweep = 80 + release * 110 + i * 12;
      x.fillRect(-sweep * 0.48, i * 26 - 3, sweep, i ? 4 : 7);
    }
  } else if (fx === "longshot") {
    const radius = 42 + Math.sin(phase * 5) * 4;
    x.setLineDash([9, 6]);
    x.beginPath();
    x.arc(bossX, bossY, radius, 0, Math.PI * 2);
    x.stroke();
    x.setLineDash([]);
    x.beginPath();
    x.moveTo(heroX + 88, heroY - 22);
    x.lineTo(bossX - radius, bossY);
    x.stroke();
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      x.fillRect(
        bossX + Math.cos(angle) * radius - 9,
        bossY + Math.sin(angle) * radius - 2,
        18,
        4,
      );
    }
  } else if (fx === "split") {
    for (let i = -1; i <= 1; i += 2) {
      x.save();
      x.translate(heroX + i * (68 + release * 24), heroY + i * 16);
      x.rotate(i * (0.2 + phase * 0.04));
      x.strokeRect(-39, -39, 78, 78);
      x.fillRect(-5, -5, 10, 10);
      x.restore();
    }
  } else if (fx === "seek") {
    for (let i = 0; i < 6; i++) {
      const angle = phase * 1.4 + (i * Math.PI) / 3,
        radius = 72 + (i % 2) * 22;
      x.fillRect(
        heroX + Math.cos(angle) * radius - 4,
        heroY + Math.sin(angle) * radius - 4,
        8,
        8,
      );
    }
    x.beginPath();
    x.arc(heroX, heroY, 72, -phase, Math.PI * 1.35 - phase);
    x.stroke();
  } else if (fx === "turn") {
    for (let i = 0; i < 4; i++) {
      const px = heroX - 98 + i * 54 + release * 18;
      x.beginPath();
      x.moveTo(px - 13, heroY - 18);
      x.lineTo(px + 9, heroY);
      x.lineTo(px - 13, heroY + 18);
      x.stroke();
    }
  } else if (fx === "shockwave") {
    x.translate(heroX, heroY);
    for (let i = 0; i < 3; i++) {
      const size = 76 + i * 44 + release * 24;
      x.save();
      x.rotate(phase * (i % 2 ? -0.18 : 0.18));
      x.strokeRect(-size / 2, -size / 2, size, size);
      x.restore();
    }
  } else {
    x.translate(heroX, heroY);
    for (const side of [-1, 1]) {
      x.save();
      x.scale(side, 1);
      x.beginPath();
      x.moveTo(22, -82);
      x.lineTo(92 + release * 22, 0);
      x.lineTo(22, 82);
      x.stroke();
      x.restore();
    }
  }
  x.restore();
}
function drawFinisherFocus() {
  if (!finisherFocus || !boss) return;
  const gate = gates.find((unit) => unit.id === finisherFocus.sourceId);
  if (!gate) return;
  const p = Math.min(1, finisherFocus.focusT / 0.32),
    launching = finisherFocus.delay <= 0,
    release = launching ? Math.min(1, finisherFocus.t / finisherFocus.dur) : 0,
    pulse = 1 + Math.sin(finisherFocus.focusT * 7) * 0.025,
    label = finisherFocus.name || gate.s + " 각성",
    heroX = W * (0.27 + release * 0.055),
    heroY = H * 0.77;
  x.save();
  x.globalAlpha = (launching ? 0.78 : 0.92) * p;
  x.fillStyle = "#02030bf8";
  x.fillRect(0, 0, W, H);
  x.globalAlpha = 0.2 * p;
  x.fillStyle = gate.col;
  x.beginPath();
  x.moveTo(0, H * 0.28);
  x.lineTo(W * 0.7, H * 0.08);
  x.lineTo(W * 0.53, H);
  x.lineTo(0, H);
  x.closePath();
  x.fill();
  // Chunky edge blocks and hard cuts borrow the readable rhythm of classic
  // pixel-action RPG supers without copying any one game's UI or assets.
  x.globalAlpha = 0.32 * p;
  for (let i = 0; i < 9; i++) {
    const width = 26 + (i % 3) * 18,
      py = 66 + i * 76;
    x.fillStyle = i % 2 ? gate.col : "#fff4c9";
    x.fillRect(0, py, width, 5);
    x.fillRect(W - width, H - py, width, 5);
  }
  // A small constellation grows around the acting hero during focus. The
  // nodes are deterministic canvas primitives, so this reads as a new layer
  // without adding texture uploads or particle allocations.
  x.globalAlpha = 0.64 * p;
  x.strokeStyle = "#fff2bd";
  x.fillStyle = gate.col;
  x.lineWidth = 2;
  x.shadowBlur = 12;
  x.shadowColor = gate.col;
  const focusNodes = isVfxOverBudget() ? 4 : 6,
    focusRadius = 124 + Math.sin(finisherFocus.focusT * 4) * 8;
  x.beginPath();
  for (let i = 0; i <= focusNodes; i++) {
    const node = i % focusNodes,
      angle =
        -Math.PI * 0.72 +
        (node / Math.max(1, focusNodes - 1)) * Math.PI * 1.44 +
        finisherFocus.focusT * 0.08,
      px = heroX + Math.cos(angle) * focusRadius,
      py = H * 0.6 + Math.sin(angle) * focusRadius * 0.7;
    if (i === 0) x.moveTo(px, py);
    else x.lineTo(px, py);
  }
  x.stroke();
  for (let i = 0; i < focusNodes; i++) {
    const angle =
        -Math.PI * 0.72 +
        (i / Math.max(1, focusNodes - 1)) * Math.PI * 1.44 +
        finisherFocus.focusT * 0.08,
      px = heroX + Math.cos(angle) * focusRadius,
      py = H * 0.6 + Math.sin(angle) * focusRadius * 0.7,
      nodeSize = i === Math.floor(focusNodes / 2) ? 8 : 5;
    x.fillRect(px - nodeSize / 2, py - nodeSize / 2, nodeSize, nodeSize);
  }
  // The boss-side reticle gives the release a destination before the comet
  // appears, making the anticipation legible even on a busy table.
  x.globalAlpha = p * (0.28 + release * 0.58);
  x.strokeStyle = release > 0.72 ? "#fff7d5" : gate.col;
  x.lineWidth = 2 + release * 3;
  const targetRadius = 62 - release * 18;
  x.beginPath();
  x.arc(boss.x, boss.y, targetRadius, -0.55, 0.55);
  x.arc(boss.x, boss.y, targetRadius, Math.PI - 0.55, Math.PI + 0.55);
  x.stroke();
  x.fillRect(boss.x - targetRadius - 16, boss.y - 2, 20, 4);
  x.fillRect(boss.x + targetRadius - 4, boss.y - 2, 20, 4);
  if (launching && release > 0.08) {
    const streak = Math.min(1, release / 0.72),
      travelX = heroX + (boss.x - heroX) * streak,
      travelY = H * 0.6 + (boss.y - H * 0.6) * streak;
    x.globalAlpha = (0.18 + release * 0.56) * p;
    x.strokeStyle = gate.col;
    x.shadowBlur = 18;
    x.lineCap = "square";
    for (let i = -2; i <= 2; i++) {
      x.lineWidth = i === 0 ? 6 : 2;
      x.beginPath();
      x.moveTo(heroX - 42, H * 0.6 + i * 19);
      x.lineTo(travelX, travelY + i * (9 - release * 5));
      x.stroke();
    }
  }
  x.globalAlpha = 0.26 * p;
  x.strokeStyle = gate.col;
  x.lineWidth = 2;
  const focusRayCount = isVfxOverBudget() ? 12 : 18;
  for (let i = 0; i < focusRayCount; i++) {
    const angle =
        (i / focusRayCount) * Math.PI * 2 + finisherFocus.focusT * 0.12,
      inner = 72 + (i % 3) * 12,
      outer = 330 + (i % 5) * 34;
    x.beginPath();
    x.moveTo(
      heroX + Math.cos(angle) * inner,
      H * 0.59 + Math.sin(angle) * inner,
    );
    x.lineTo(
      heroX + Math.cos(angle) * outer,
      H * 0.59 + Math.sin(angle) * outer,
    );
    x.stroke();
  }
  x.restore();
  paintFeedbackAsset(
    abilityFx[gate.id],
    heroX,
    H * 0.6,
    270 + release * 70,
    0.2 + p * 0.22,
    -finisherFocus.focusT * 0.22,
  );
  drawFinisherMotif(gate, heroX, H * 0.6, release, p);
  x.save();
  x.globalAlpha = p * (launching ? 0.7 : 0.92);
  x.strokeStyle = "#fff4c9";
  x.shadowBlur = 18;
  x.shadowColor = gate.col;
  x.lineWidth = 2;
  x.beginPath();
  x.arc(heroX, H * 0.6, 82 + release * 28, -0.7, Math.PI * 1.32);
  x.stroke();
  x.setLineDash([8, 7]);
  x.beginPath();
  x.arc(
    heroX,
    H * 0.6,
    104 + Math.sin(finisherFocus.focusT * 3) * 5,
    0,
    Math.PI * 2,
  );
  x.stroke();
  x.setLineDash([]);
  x.restore();
  x.save();
  x.globalAlpha = p;
  x.translate(heroX, heroY);
  x.scale(pulse * (0.94 + p * 0.06), pulse * (0.94 + p * 0.06));
  drawFrame(
    { ...gate, combatSize: 210, animState: "attack", on: 1 },
    0,
    0,
    Math.floor(finisherFocus.focusT / 0.25),
  );
  x.restore();
  x.save();
  x.globalAlpha = p;
  x.textAlign = "left";
  x.fillStyle = gate.col;
  x.font = "bold 10px Galmuri11, ui-monospace";
  x.fillText(
    "STELLAR ART // " +
      String(finisherFocus.finisherOrder + 1).padStart(2, "0"),
    W * 0.5,
    H * 0.39,
  );
  x.fillStyle = "#070a1e";
  x.font = "bold 30px Galmuri11, ui-monospace";
  x.fillText(gate.s + " · 각성", W * 0.5 + 3, H * 0.47 + 3);
  x.fillStyle = "#fff4c9";
  x.shadowBlur = 20;
  x.shadowColor = gate.col;
  x.fillText(gate.s + " · 각성", W * 0.5, H * 0.47);
  x.font = "bold 14px Galmuri11, ui-monospace";
  x.fillStyle = "#f0ecff";
  x.fillText(label, W * 0.5, H * 0.535);
  x.fillStyle = gate.col;
  x.fillRect(W * 0.5, H * 0.575, (132 + release * 72) * p, 4);
  x.fillStyle = "#d8dcff";
  x.font = "9px Galmuri11, ui-monospace";
  x.fillText(launching ? "RELEASE" : "FOCUSING...", W * 0.5, H * 0.615);
  if (launching && release > 0.82) {
    const flash = (release - 0.82) / 0.18;
    x.globalAlpha = flash * 0.42;
    x.fillStyle = "#ffffff";
    x.fillRect(0, 0, W, H);
    x.globalAlpha = flash * 0.8;
    x.fillStyle = gate.col;
    x.fillRect(0, H * 0.49, W, 7);
  }
  x.fillStyle = "#02030a";
  x.fillRect(0, 0, W, 30);
  x.fillRect(0, H - 30, W, 30);
  x.restore();
}
function drawSettlementBeat() {
  if (!settlementBeat || finisherFocus) return;
  const p = Math.min(1, settlementBeat.t / settlementBeat.d),
    fade = Math.min(1, settlementBeat.t / 0.12) * Math.min(1, (1 - p) / 0.28),
    bar = 32 + Math.sin(Math.min(1, p * 2.2) * Math.PI) * 28;
  x.save();
  x.globalAlpha = fade * 0.86;
  x.fillStyle = "#02030cf2";
  x.fillRect(0, 0, W, bar);
  x.fillRect(0, H - bar, W, bar);
  x.fillStyle = settlementBeat.col;
  x.fillRect(0, bar - 3, W * Math.min(1, p * 2.4), 3);
  x.fillRect(W * Math.max(0, 1 - p * 2.4), H - bar, W, 3);
  x.globalAlpha = fade;
  x.textAlign = "center";
  x.font = "bold 10px Galmuri11, ui-monospace";
  x.fillStyle = settlementBeat.col;
  x.fillText(settlementBeat.kicker, W / 2, H * 0.46);
  x.font = "bold 22px Galmuri11, ui-monospace";
  x.fillStyle = "#050718";
  x.fillText(settlementBeat.label, W / 2 + 2, H * 0.52 + 2);
  x.fillStyle = "#fff4c9";
  x.shadowBlur = 16;
  x.shadowColor = settlementBeat.col;
  x.fillText(settlementBeat.label, W / 2, H * 0.52);
  x.restore();
}
function drawFinisherImpactMotif(impact, p, radius) {
  const gate = gates.find((unit) => unit.id === impact.sourceId),
    fx = gate
      ? gate.fx === "copycat"
        ? gate.copiedFx || "copycat"
        : gate.fx
      : "",
    fade = 1 - p;
  x.save();
  x.translate(boss.x, boss.y);
  x.globalCompositeOperation = "screen";
  x.globalAlpha = fade * 0.9;
  x.strokeStyle = impact.col;
  x.fillStyle = "#fff5ca";
  x.shadowBlur = 18;
  x.shadowColor = impact.col;
  x.lineWidth = 3 + fade * 3;
  if (fx === "slash") {
    x.rotate(-0.48);
    for (let i = -1; i <= 1; i++) {
      const length = radius * (0.72 + i * 0.08);
      x.fillRect(-length, i * 20 - 3, length * 2, i ? 5 : 8);
    }
  } else if (fx === "longshot") {
    x.setLineDash([10, 7]);
    x.beginPath();
    x.arc(0, 0, radius * 0.72, p * 2, Math.PI * 2 + p * 2);
    x.stroke();
    x.setLineDash([]);
    x.fillRect(-radius, -3, radius * 2, 6);
    x.fillRect(-3, -radius, 6, radius * 2);
  } else if (fx === "split") {
    for (const side of [-1, 1]) {
      x.beginPath();
      x.arc(side * radius * 0.38, side * 11, radius * 0.42, 0, Math.PI * 2);
      x.stroke();
      x.fillRect(side * radius * 0.38 - 5, side * 11 - 5, 10, 10);
    }
  } else if (fx === "seek") {
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + p * 1.5,
        distance = radius * 0.66;
      x.save();
      x.rotate(angle);
      x.translate(distance, 0);
      x.beginPath();
      x.moveTo(-18, -10);
      x.lineTo(3, 0);
      x.lineTo(-18, 10);
      x.stroke();
      x.restore();
    }
  } else if (fx === "turn") {
    for (let i = 0; i < 3; i++) {
      x.beginPath();
      x.arc(0, 0, radius * (0.32 + i * 0.18), -1.2 + p, 1.7 + p);
      x.stroke();
    }
  } else if (fx === "shockwave") {
    for (let i = 0; i < 3; i++) {
      const size = radius * (0.48 + i * 0.2);
      x.save();
      x.rotate(p * (i % 2 ? -1 : 1) + i * 0.24);
      x.strokeRect(-size / 2, -size / 2, size, size);
      x.restore();
    }
  } else {
    for (let i = 0; i < 2; i++) {
      const size = radius * (0.5 + i * 0.25);
      x.save();
      x.rotate(Math.PI / 4 + p * (i ? -1 : 1));
      x.strokeRect(-size / 2, -size / 2, size, size);
      x.restore();
    }
  }
  x.restore();
}
function drawFinisherImpacts() {
  for (const impact of finisherImpacts) {
    const p = Math.min(1, impact.t / impact.d),
      fade = 1 - p,
      radius = 34 + p * 180;
    x.save();
    x.globalCompositeOperation = "screen";
    x.globalAlpha = fade * 0.58;
    x.fillStyle = impact.col;
    x.beginPath();
    x.arc(boss.x, boss.y, radius * 0.55, 0, Math.PI * 2);
    x.fill();
    x.globalAlpha = fade;
    x.fillStyle = "#ffffff";
    const core = Math.max(4, 22 * fade);
    x.fillRect(boss.x - core, boss.y - core, core * 2, core * 2);
    x.strokeStyle = "#fff4c9";
    x.shadowBlur = 22;
    x.shadowColor = impact.col;
    x.lineWidth = 5 * fade + 1;
    for (let i = 0; i < 3; i++) {
      x.beginPath();
      x.arc(
        boss.x,
        boss.y,
        radius * (0.38 + i * 0.22),
        p * 3 + i,
        Math.PI * 2 + p * 3 + i,
      );
      x.stroke();
    }
    const rayCount = isVfxOverBudget() ? 8 : 12;
    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2 - p * 0.8,
        inner = 24 + p * 20,
        outer = radius * (0.72 + (i % 3) * 0.1);
      x.beginPath();
      x.moveTo(
        boss.x + Math.cos(angle) * inner,
        boss.y + Math.sin(angle) * inner,
      );
      x.lineTo(
        boss.x + Math.cos(angle) * outer,
        boss.y + Math.sin(angle) * outer,
      );
      x.stroke();
      const pixel = 3 + (i % 3) * 2;
      x.fillStyle = i % 2 ? impact.col : "#fff4c9";
      x.fillRect(
        Math.round(boss.x + Math.cos(angle) * outer - pixel / 2),
        Math.round(boss.y + Math.sin(angle) * outer - pixel / 2),
        pixel,
        pixel,
      );
    }
    x.restore();
    drawFinisherImpactMotif(impact, p, radius);
  }
}
function drawBladeWheels() {
  for (const gate of gates) {
    const fx = gate.fx === "copycat" ? gate.copiedFx : gate.fx,
      strength = gate.bladeStrength || 0;
    if (fx !== "bladewheel" || strength < 0.025) continue;
    const radius = 47 + strength * 32;
    x.save();
    x.translate(gate.x, gate.y - 7);
    x.rotate(gate.bladeAngle || 0);
    x.globalCompositeOperation = "screen";
    x.globalAlpha = Math.min(0.92, 0.35 + strength * 0.62);
    x.strokeStyle = gate.col;
    x.fillStyle = "#fff4c9";
    x.shadowBlur = 10;
    x.shadowColor = gate.col;
    x.lineWidth = 3 + strength * 2;
    x.setLineDash([12, 8]);
    x.beginPath();
    x.arc(0, 0, radius, 0, Math.PI * 2);
    x.stroke();
    x.setLineDash([]);
    for (let i = 0; i < 3; i++) {
      x.save();
      x.rotate((i * Math.PI * 2) / 3);
      x.beginPath();
      x.moveTo(radius - 17, -5);
      x.lineTo(radius + 15 + strength * 11, 0);
      x.lineTo(radius - 17, 5);
      x.lineTo(radius - 5, 0);
      x.closePath();
      x.fill();
      x.fillStyle = gate.col;
      x.fillRect(radius + 18, -2, 7 + strength * 8, 4);
      x.restore();
    }
    x.restore();
  }
}
registerRuntimeHook("afterFeedbackUpdate", (d) => {
  advanceTimed(abilityBursts, d);
  if (settlementBeat) {
    settlementBeat.t += d;
    if (settlementBeat.t >= settlementBeat.d) settlementBeat = null;
  }
  if (battle?.victory)
    battle.victory.t = Math.min(battle.victory.d, battle.victory.t + d);
});
registerRuntimeHook("afterSpecialDraw", () => {
  drawAbilityFx();
  drawFeedbackBeats();
  drawBladeWheels();
  drawSettlementBeat();
  drawFinisherFocus();
  drawFinisherImpacts();
  drawVictoryFx();
});
registerRuntimeHook("afterFeedbackUpdate", (d) => {
  advanceTimed(feedbackBeats, d);
  feedbackCooldown = Math.max(0, feedbackCooldown - d);
});
function loop(t) {
  const d = Math.min(0.033, (t - last) / 1000 || 0);
  last = t;
  frameClock = t;
  // Title, map and roster screens are DOM-only. Skipping the canvas solver,
  // texture draws and feedback scans there prevents an old battle state from
  // consuming a full frame budget behind an overlay. The time delta stays
  // capped, so returning from a hidden tab cannot advance combat abruptly.
  if (document.hidden) {
    requestAnimationFrame(loop);
    return;
  }
  if (!isRuntimeScene("game")) {
    // Let short-lived feedback expire after leaving combat, but do not keep
    // physics or any canvas draw work alive behind DOM-only screens.
    impactStop = 0;
    updateFeedback(d);
    requestAnimationFrame(loop);
    return;
  }
  if (impactStop > 0) impactStop -= d;
  else {
    // A continuous time scale reads as smooth slow motion.  Hit-stop remains
    // reserved for the exact impact frame instead of skipping every third frame.
    const finisherScale = !finisherFocus
      ? 1
      : finisherFocus.delay > 0
        ? 0.46
        : finisherFocus.t / finisherFocus.dur < 0.72
          ? 0.62
          : 0.82;
    const simulationStep = d * finisherScale;
    update(simulationStep);
    updateSpecial(simulationStep);
  }
  updateFeedback(d);
  if (boss && ball) {
    draw();
    drawProjectileOverlay();
    drawAimGuide();
    drawAssists();
    drawSpecial();
    drawCombo();
  }
  requestAnimationFrame(loop);
}

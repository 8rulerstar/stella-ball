// Feedback pass: collisions, high-value hits, unit awakenings, and multipliers
// each get their own readable beat.  The short stop is intentionally paired
// with a longer ring/popup so the player has time to register the result.
let feedbackBeats = [],
  pixelDust = [],
  pixelDustSerial = 0,
  feedbackCooldown = 0,
  finisherFocus = null,
  finisherImpacts = [],
  settlementBeat = null;
const cssReplayTokens = new WeakMap();
const PIXEL_DUST_BUDGET = 112;
function pixelDustBurst(kind, px, py, col, power) {
  const count =
      kind === "riposte"
        ? 24
        : kind === "weak" || kind === "awaken"
          ? 18
          : kind === "unit"
            ? 12
            : kind === "wall"
              ? 6
              : 10,
    speed = (kind === "wall" ? 86 : kind === "riposte" ? 230 : 150) * power,
    base = pixelDustSerial++ * 0.754877666;
  for (let i = 0; i < count; i++) {
    const angle = base + i * GOLDEN_ANGLE,
      spread = 0.42 + ((i * 37 + pixelDustSerial * 17) % 61) / 100,
      size = i % 7 === 0 ? 4 : i % 3 === 0 ? 3 : 2;
    pixelDust.push({
      x: Math.round(px / 2) * 2,
      y: Math.round(py / 2) * 2,
      vx: Math.cos(angle) * speed * spread,
      vy: Math.sin(angle) * speed * spread - (kind === "awaken" ? 62 : 18),
      grav: kind === "awaken" ? -16 : 135,
      col,
      size,
      t: 0,
      d: 0.28 + (i % 5) * 0.045,
    });
  }
  if (pixelDust.length > PIXEL_DUST_BUDGET)
    pixelDust.splice(0, pixelDust.length - PIXEL_DUST_BUDGET);
}
function updatePixelDust(d) {
  let write = 0;
  for (let i = 0; i < pixelDust.length; i++) {
    const p = pixelDust[i];
    p.t += d;
    if (p.t >= p.d) continue;
    p.vy += p.grav * d;
    p.x += p.vx * d;
    p.y += p.vy * d;
    pixelDust[write++] = p;
  }
  pixelDust.length = write;
}
function drawPixelDust() {
  if (!pixelDust.length) return;
  x.save();
  x.globalCompositeOperation = "lighter";
  // 다른 연출과 같은 저하 규칙: 예산 초과면 최근 것만 그린다.
  const start = isVfxOverBudget() ? Math.max(0, pixelDust.length - 36) : 0;
  for (let index = start; index < pixelDust.length; index++) {
    const p = pixelDust[index];
    const life = 1 - p.t / p.d,
      size = Math.max(1, Math.round(p.size * (0.55 + life * 0.45))),
      px = Math.round(p.x / 2) * 2,
      py = Math.round(p.y / 2) * 2;
    x.globalAlpha = Math.min(1, life * 1.5);
    x.fillStyle = p.col;
    x.fillRect(px, py, size, size);
    if (p.size >= 4 && life > 0.46) {
      x.fillRect(px - size, py + 1, size * 3, 1);
      x.fillRect(px + 1, py - size, 1, size * 3);
    }
  }
  x.restore();
}
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
  // 예산 초과 프레임에는 먼지를 새로 만들지 않는다. 비트·필드FX는 초과 시
  // 마지막 6개로 줄이는데 먼지만 상한 112를 lighter 합성으로 다 그리면,
  // 저하 장치가 덜어 준 만큼을 도로 얹는 셈이다.
  if (!isVfxOverBudget())
    pixelDustBurst(kind, px, py, col, Math.min(1.5, power));
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
/* 새 전투는 빈 판에서 시작한다. 이 배열들에는 전투 식별자가 없어서, 치우지
   않으면 이전 판의 팝업·타격 링·정산 연출이 다음 판 위에서 계속 재생된다.
   온보딩은 수업마다 setupBattle을 다시 부르므로 여기가 가장 잘 드러났다. */
registerRuntimeHook("afterBattleSetup", () => {
  feedbackBeats = [];
  pixelDust = [];
  pixelDustSerial = 0;
  finisherImpacts = [];
  finisherFocus = null;
  settlementBeat = null;
  feedbackCooldown = 0;
  screenShake = 0;
  screenFlash = 0;
  impactStop = 0;
  comboPulse = 0;
  popups.length = 0;
});
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

  /* ── 조용하던 자리들 (2026-08-16) ────────────────────────────────────
     50종 팩에서 `ui-01`~`ui-05` 다섯은 반입 이후 한 번도 울린 적이 없다.
     메타 UI가 `playSfx`의 합성 사각파 3종만 쓰고 샘플 경로를 아예 타지
     않았기 때문이다. 아래 이름들은 그 다섯과, 팩 안에서 놀고 있던 대체
     테이크들을 실제 사건에 배정한 것이다. 새 자산은 만들지 않았다. */
  uiConfirm: "ui-01", // 확정 버튼
  uiTap: "ui-02", // 일반 클릭·전환
  uiCard: "ui-03", // 수업 대화창이 뜬다
  uiUnlock: "ui-04", // 해금
  uiScreen: "ui-05", // 화면이 바뀐다
  uiFail: "fail-02", // 눌렀지만 안 되는 것 (playSfx("fail")이 여태 기본 비프였다)
  /* `combatSfx("unlock")`은 네 곳에서 불리는데 — 안내별이 얹힐 때, 오망성이
     전원을 깨울 때, 별자리가 현현할 때, 페이즈가 별지기를 다시 재울 때 —
     이 이름이 표에도 합성음 표에도 없었다. 넷 다 조용히 기본 비프
     [260,420,0.08]로 떨어지고 있었다. `playSfx("unlock")`과 같은 소리를 준다. */
  unlock: "ui-04",

  steer: "launch-03", // 궤도 전환
  battleIntro: "launch-04", // 전투 입장
  shotReady: "wall-02", // 다음 샷이 준비됐다 — 판이 다시 내 것이다
  toast: "wall-01", // 시스템 알림. 잦으므로 가장 조용한 것

  speechUnit: "unit-01", // 별지기가 말한다
  speechBoss: "riposte-04", // 거상이 말한다
  speechLuna: "ui-05", // 루나가 말한다 — 판 밖이라 UI 어휘를 쓴다
  roar: "riposte-05", // 포효
  bossFall: "fail-02", // 거상 퇴장
};
/* 큐마다 다시 울리기까지의 최소 간격(ms). 기본 90은 타격용이라 잦은 알림에는
   짧다 — 토스트가 연달아 뜨면 기관총이 된다. 오너의 조건이 「투머치가 아닌
   이상」이었으므로, 넣되 겹치지 않게 하는 것은 이 표가 맡는다. */
const sampleSfxHold = {
  toast: 460,
  speechUnit: 240,
  speechBoss: 240,
  speechLuna: 240,
  shotReady: 300,
  uiTap: 70,
};
/* 「투머치가 아닌 이상」의 실제 구현. 이 큐들은 «조용할 때만» 말한다.

   토스트가 대표적이다 — 전투 중 거의 모든 알림은 이미 소리를 가진 사건의
   메아리다(궤도 전환은 impact와 전환음을 내고 나서 토스트를 띄운다). 거기에
   알림음을 또 얹으면 한 번의 입력이 세 번 울린다. 반대로 정산·골드·해금처럼
   판이 조용할 때 뜨는 알림은 소리가 있어야 「무슨 일이 났다」가 읽힌다.
   그 둘을 «내용»으로 가르는 것은 문자열 검사가 되므로, 값 대신 시간으로
   가른다: 직전 소리로부터 이만큼 조용했을 때만 낸다. */
const sampleSfxNeedsQuiet = { toast: 260, shotReady: 220 };
let lastSampleSfxAt = -1e9;
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
  if (now - last < (sampleSfxHold[kind] ?? 90)) return true;
  const quiet = sampleSfxNeedsQuiet[kind];
  if (quiet !== undefined && now - lastSampleSfxAt < quiet) return true;
  sampleSfxCooldown[cue] = now;
  lastSampleSfxAt = now;
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
/* 여기의 `screen` + `shadowBlur` 조합은 측정상 패링 프레임의 가장 큰 단일
   항목이다(3연쇄 CPU 래스터에서 이 호출만 막으면 46.34ms → 9.17ms). 그런데
   흐림을 텍스처에 미리 굽는 치환은 두 번 시도해 두 번 다 기각했다.
     · 그림자와 그림을 한 장으로 구움 → 최대 17% 어두워짐. `screen`이 둘에
       «각각» 걸려야 하는데 미리 합치면 합성 수식 자체가 달라진다.
     · 그림자만 따로 굽고 그리는 쪽에서 두 번 얹음 → 합성 순서는 맞았지만
       여전히 최대 10% 어둡고(구운 흐림이 원본 해상도라 확대되면 묽어진다)
       이득은 1.36배뿐이었다.
   이펙트가 이미 약하다는 지적이 있는 마당에 10% 어두워지는 것과 1.36배를
   바꿀 수는 없다. 이 자리를 진짜로 싸게 만들려면 텍스처마다 «목표 크기에서»
   구운 빛이 필요하고, 그건 자산 파이프라인 쪽 일이다 —
   ART_DIRECTION_REQUEST_2026_08_16.md 4절로 넘긴다. */
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
  x.shadowBlur = combatFxBlur(12);
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
registerRuntimeHook("afterFieldFxDraw", function drawFeedbackFieldFx() {
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
});
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
    x.shadowBlur = combatFxBlur(16);
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
      x.shadowBlur = combatFxBlur(20);
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
      setCombatFont(
        x,
        (beat.kind === "weak" || beat.kind === "riposte"
          ? "bold 15px"
          : "bold 12px") + " Galmuri11, ui-monospace",
      );
      x.textAlign = "center";
      x.fillStyle = "#080a1d";
      x.shadowBlur = combatFxBlur(0);
      x.fillText(beat.label, 2, -size * 0.55 + 2);
      x.fillStyle =
        beat.kind === "weak" || beat.kind === "riposte" ? "#fff3bd" : "#f0f4ff";
      x.shadowBlur = combatFxBlur(12);
      x.shadowColor = beat.col;
      x.fillText(beat.label, 0, -size * 0.55);
    }
    x.restore();
  }
}
registerRuntimeHook("afterAssistsDraw", function drawFeedbackAssists() {
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
});
function impact(
  weak = false,
  px = ball?.x ?? boss?.x,
  py = boss?.y ?? ball?.y,
  profile = "default",
) {
  // 페이즈가 있는 거상은 부서질수록 손맛이 무거워진다. 8-1은 형태가 진행도를
  // 대신하는데(다리 손실·기울기·동공 확장), 타격감이 P1과 P4에서 같으면 눈에
  // 보이는 변화와 손에 오는 감각이 서로 다른 말을 한다. 기존 세 값을 같은
  // 배수로 키울 뿐이라 새 파티클 배열도 새 DOM 갱신도 늘지 않는다.
  const phaseForce = 1 + Math.min(3, stagePhases?.fired ?? 0) * 0.12,
    force = Math.min(2.3, (1 + (hitCombo - 1) * 0.18) * phaseForce),
    heavy = Boolean(weak) || hitCombo >= 3,
    contact = profile === "contact",
    finisher = profile === "finisher",
    /* 정지는 발수로 나눈다 — 정산 «길이»에 준 예산과 같은 규칙이다.

       `impactStop > 0`인 프레임은 update()가 통째로 건너뛴다. 판이 실제로
       언다. 0.046초는 한 샷이 피니셔를 하나 낼까 말까 하던 시절의 값인데,
       각성이 움직임으로 돌아오면서 한 샷이 2~4발을 낸다. 연타 배수까지
       곱해지면 실측으로 한 발이 42ms, 63ms씩 얼었고 그것이 줄줄이 이어졌다.
       프레임 지표에는 안 잡힌다: rAF는 4ms로 계속 돌고 draw()도 0.8ms다.

       나누면 일제 사격 전체가 예전 한 발만큼만 멈춘다. 첫 타의 «맛»은
       발수가 적을수록 그대로다(1발이면 나눗셈이 없다). */
    volley = finisher ? Math.max(1, battle?.finisherSerial || 1) : 1,
    stop =
      (contact ? 0.028 : (finisher ? 0.046 : heavy ? 0.075 : 0.034) * force) /
      volley,
    /* 디자인 세션 §4. 예전 값은 5.5 / 5.5 / 10 / 8.5px이라 가장 약한 사건과
       가장 강한 사건의 비가 두 배도 안 됐다 — 판 가로 720px 대비 0.76%와
       1.4%다. 접촉을 «더 줄이고» 위를 벌린다: 4 / 8 / 24 / 34px.
       24px는 판 가로의 3.3%이고, 값 자체를 크게 키우지 않고도 강약이 생긴다. */
    shake = contact ? 4 : (finisher ? 34 : heavy ? 24 : 8) * force,
    /* 방향 어휘 셋. 지금 화면 전체를 건드리는 것은 흔들림과 플래시뿐이고 둘
       다 방향이 없다 — 그래서 어디서 맞았는지가 손에 오지 않는다.
       밀림은 판을 타격이 진행한 방향으로 밀고, 기울기는 판을 살짝 돌리고,
       잔상은 직전 프레임을 낮은 알파로 한 장 남긴다. 셋 다 캔버스/DOM 변환
       한 번이라 fillRect 호출 수가 늘지 않는다. */
    push = contact ? 0 : (finisher ? 28 : heavy ? 20 : 6) * force,
    tilt = contact ? 0 : finisher ? 0.019 : heavy ? 0.0105 : 0,
    ghost = contact ? 0 : finisher ? 0.45 : heavy ? 0.25 : 0;
  impactStop = Math.max(Number.isFinite(impactStop) ? impactStop : 0, stop);
  screenShake = Math.max(Number.isFinite(screenShake) ? screenShake : 0, shake);
  if (push > 0) {
    // 밀림 방향은 유성이 가던 쪽이다. 멈춰 있으면 위로 민다.
    const speed = Math.hypot(ball?.vx ?? 0, ball?.vy ?? 0);
    screenPushX = speed > 1 ? (ball.vx / speed) * push : 0;
    screenPushY = speed > 1 ? (ball.vy / speed) * push : -push;
  }
  screenTilt =
    Math.abs(screenTilt) > Math.abs(tilt)
      ? screenTilt
      : tilt * (px < W / 2 ? -1 : 1);
  screenGhost = Math.max(screenGhost || 0, ghost);
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
  safeVibrate(contact ? 5 : heavy ? [10, 16, 12] : 7);
}
registerRuntimeHook("afterBossHitRegistered", () => {
  if (hitCombo >= 3) {
    comboTimer = Math.max(comboTimer, 1.45);
    comboPulse = 1.45;
  }
});
registerRuntimeHook("afterTableWall", () => {
  if (!ball) return;
  feedbackBeat("wall", ball.x, ball.y, "#8ae9e0", 0.62);
  combatSfx("wall", 0.7);
});
registerRuntimeHook("afterMobilePairCollision", ({ a, b, kind }) => {
  // Only the meteor striking a starkeeper is a 공명. The solver is shared with
  // starkeeper-on-starkeeper nudges - whose own call site says they stay
  // physical only - and with clone relays, which announce themselves with
  // 분열 연계. Both of those used to play the resonance beat and SFX here,
  // because every caller has a starkeeper on one side of the pair.
  if (kind !== "meteor-hero") return;
  const hero = gates.includes(a) ? a : gates.includes(b) ? b : null;
  if (hero && feedbackCooldown <= 0) {
    feedbackCooldown = 0.12;
    feedbackBeat("unit", hero.x, hero.y, hero.col, 1.05, "공명!");
    combatSfx("unit", 1);
  }
});
registerRuntimeHook("afterBlazeEarned", ({ amount }) => {
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
});
/* 정산은 «인원수 × 한 명분»이 아니라 예산이다.

   0.52 + 순서 × 1.62라는 배분은 각성이 패링 전용이던 때 것이다. 그때 한 샷의
   피니셔는 0~1명이었으므로 한 명이 1.62초를 온전히 갖는 것이 맞았다. 각성이
   다시 움직임으로 돌아온 지금은 거의 매 샷이 파티 전원을 깨우고, 같은 배분이
   그대로 3명 4.84초 · 4명 6.46초가 된다. 실측(probe-settle-cost.mjs, 2-2,
   3인)에서 유성이 멈춘 뒤 판이 플레이어에게 돌아오기까지 **3.26초**였다 —
   변경 전 같은 샷은 0.00초였다. 다섯 발이면 16초를 구경만 한다. 「렉 걸린다」는
   제보의 정체가 프레임이 아니라 이 대기였다.

   그래서 총량을 고정한다. 인원이 늘면 간격이 좁아져 한 명씩 서는 행렬이 아니라
   «일제 사격»이 된다 — 짧아지면서 오히려 세진다. 초점(finisherFocus)은 여전히
   한 번에 하나라 겹쳐도 그리는 값은 늘지 않는다.

   프레임은 문제가 아니었음을 먼저 확인했다: 초점이 떠 있는 프레임의 draw()가
   0.5ms(p95 0.8)로 idle과 같고, CPU는 70%가 idle이며, DOM 쓰기는 정산 구간에서
   toast 2·popup 2다. 잘라야 할 것은 그리는 값이 아니라 «기다리는 시간»이다.

   총 정산 시간 = SETTLE_LEAD + SETTLE_BUDGET (인원 2명 이상에서 일정).
   여기 값은 잠정이다 — 한 타가 «어떻게 생겼는가»는 디자인 세션의 몫이고
   (AWAKEN_FX_REQUEST_2026_08_16.md), 이 상수들은 그 세션에 주는 예산이다. */
const SETTLE_LEAD = 0.34, // 유성이 멈추고 첫 타가 시작하기까지
  SETTLE_BEAT = 0.92, // 한 명분 연출의 길이
  SETTLE_BUDGET = 1.3; // 첫 타 시작부터 마지막 타 종료까지의 상한
function settleStep(count) {
  const n = Math.max(1, count || 1);
  if (n < 2) return 0;
  return Math.max(0.12, (SETTLE_BUDGET - SETTLE_BEAT) / (n - 1));
}
registerRuntimeHook(
  "afterUnitAssistQueued",
  ({ gate: g, shot, queued, options }) => {
    if (shot) {
      if (shot.finisher) {
        /* 별자리가 뜬 샷이면 현현이 끝난 다음에 줄을 선다. 별자리와 각성은
           이제 둘 다 나가므로(game-figure.js의 afterFigure 주석), 겹치면
           피니셔의 슬로모션 초점이 현현 위로 올라타 둘 다 읽히지 않는다.
           순서만 준다 — 없애지 않는다. */
        shot.delay =
          (options.afterFigure ? FIGURE_CAST_AT + 0.24 : 0) +
          SETTLE_LEAD +
          shot.finisherOrder * settleStep(options.finisherCount);
        shot.dur = SETTLE_BEAT;
        shot.focusT = 0;
      } else {
        shot.delay = Math.min(0.32, queued * 0.085);
        shot.dur = Math.max(0.3, shot.dur + 0.1);
      }
    }
    if (!shot?.finisher) {
      feedbackBeat("awaken", g.x, g.y, g.col, 1.08, g.s + " 각성");
      combatSfx("awaken", 0.9);
    }
  },
);
registerRuntimeHook("afterPartySettle", ({ awakened, afterFigure }) => {
  const finishers = awakened.filter((gate) => {
    const fx = gate.fx === "copycat" ? gate.copiedFx : gate.fx;
    return fx !== "bladewheel";
  });
  /* «이번 샷에 별자리가 떴는가»(afterFigure)로 갈라야 한다. 예전 조건의
     figureActive는 「별자리 시스템이 켜져 있는가」라 모든 정상 정산에서
     참이었고, 정산 배너와 settlement 효과음이 한 번도 나가지 못했다 —
     별자리가 뜬 샷만 자기 연출에 자리를 내주면 된다. */
  if (awakened.length && !afterFigure) {
    settlementBeat = {
      t: 0,
      d: 0.92,
      col: finishers[0]?.col || awakened[0].col,
      kicker: finishers.length ? "STELLAR SETTLEMENT" : "MOTION COMPLETE",
      label: awakened.map((gate) => gate.s).join(" · "),
    };
    combatSfx("settlement", 0.92);
  }
});
/* 별자리 발동 순간의 먼지. afterFigureShot에 걸려 있던 예전 판은 한 번도
   돌지 못했다 — finishFigureShot이 훅을 부르기 전에 clearFigureShot으로
   state.nodes를 비우고, 노드 경제 모드에서는 resolved가 항상 false다.
   발동의 단일 관문인 resolveFigure가 쏘는 훅으로 옮긴다. */
registerRuntimeHook("afterFigureResolve", ({ points }) => {
  if (!points?.length) return;
  const center = figureCentroid(points);
  pixelDustBurst("riposte", center.x, center.y, "#fff0b8", 1.35);
});
function updateAssists(d) {
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
    // 훅 등 바깥에서 밀어 넣은 항목이 delay를 빠뜨려도 불멸이 되지 않게
    // 숫자로 강제한다. undefined는 두 분기 모두에서 거짓이라 영원히 남는다.
    if (!Number.isFinite(shot.delay)) shot.delay = 0;
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
}
function drawFinisherMotif(gate, heroX, heroY, release, alpha) {
  const fx = gate.fx === "copycat" ? gate.copiedFx || "copycat" : gate.fx,
    phase = finisherFocus.focusT,
    bossX = boss.x,
    bossY = boss.y;
  x.save();
  x.globalAlpha = alpha * 0.72;
  x.strokeStyle = gate.col;
  x.fillStyle = gate.col;
  x.shadowBlur = combatFxBlur(13);
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
  x.shadowBlur = combatFxBlur(12);
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
    x.shadowBlur = combatFxBlur(18);
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
  x.shadowBlur = combatFxBlur(18);
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
  setCombatFont(x, "bold 10px Galmuri11, ui-monospace");
  x.fillText(
    "STELLAR ART // " +
      String(finisherFocus.finisherOrder + 1).padStart(2, "0"),
    W * 0.5,
    H * 0.39,
  );
  x.fillStyle = "#070a1e";
  setCombatFont(x, "bold 30px Galmuri11, ui-monospace");
  x.fillText(gate.s + " · 각성", W * 0.5 + 3, H * 0.47 + 3);
  x.fillStyle = "#fff4c9";
  x.shadowBlur = combatFxBlur(20);
  x.shadowColor = gate.col;
  x.fillText(gate.s + " · 각성", W * 0.5, H * 0.47);
  setCombatFont(x, "bold 14px Galmuri11, ui-monospace");
  x.fillStyle = "#f0ecff";
  x.fillText(label, W * 0.5, H * 0.535);
  x.fillStyle = gate.col;
  x.fillRect(W * 0.5, H * 0.575, (132 + release * 72) * p, 4);
  x.fillStyle = "#d8dcff";
  setCombatFont(x, "9px Galmuri11, ui-monospace");
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
  setCombatFont(x, "bold 10px Galmuri11, ui-monospace");
  x.fillStyle = settlementBeat.col;
  x.fillText(settlementBeat.kicker, W / 2, H * 0.46);
  setCombatFont(x, "bold 22px Galmuri11, ui-monospace");
  x.fillStyle = "#050718";
  x.fillText(settlementBeat.label, W / 2 + 2, H * 0.52 + 2);
  x.fillStyle = "#fff4c9";
  x.shadowBlur = combatFxBlur(16);
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
  x.shadowBlur = combatFxBlur(18);
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
    x.shadowBlur = combatFxBlur(22);
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
    x.shadowBlur = combatFxBlur(10);
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
  drawPixelDust();
});
registerRuntimeHook("afterFeedbackUpdate", (d) => {
  advanceTimed(feedbackBeats, d);
  updatePixelDust(d);
  feedbackCooldown = Math.max(0, feedbackCooldown - d);
});
function resetInactiveCanvasFeedback() {
  impactStop = 0;
  screenShake = 0;
  screenPushX = 0;
  screenPushY = 0;
  screenTilt = 0;
  screenGhost = 0;
  screenFlash = 0;
  if (lastStageTransform) {
    stageEl.style.transform = "";
    lastStageTransform = "";
  }
  if (U.flash && lastFlashOpacity !== "0") {
    U.flash.style.opacity = "0";
    U.flash.style.display = "none";
    lastFlashOpacity = "0";
  }
}
function loop(t) {
  // Very high refresh displays used to redraw the complete 720x900 combat
  // canvas 180-240 times per second. Detect that cadence over several frames,
  // then distribute 120 presentations across it. A simple "skip one" rule
  // dropped 170 Hz straight to 85 Hz; the independent deadline avoids that
  // cliff while 60/120/144/165 Hz panels retain their native cadence.
  const rafGap = lastRafFrame ? t - lastRafFrame : 0;
  lastRafFrame = t;
  if (rafGap > 0 && rafGap < 6)
    fastRafSamples = Math.min(12, fastRafSamples + 1);
  else fastRafSamples = Math.max(0, fastRafSamples - 1);
  if (isRuntimeScene("game") && fastRafSamples >= 6) {
    const interval = 1000 / 120;
    if (nextPresentedFrame && t < nextPresentedFrame - 0.25) {
      requestAnimationFrame(loop);
      return;
    }
    if (!nextPresentedFrame || t - nextPresentedFrame > interval)
      nextPresentedFrame = t;
    nextPresentedFrame += interval;
  } else {
    nextPresentedFrame = 0;
  }
  const rawDelta = (t - last) / 1000 || 0,
    d = Math.min(0.033, rawDelta);
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
    // Feedback updates include delayed assists and constellation casts, so
    // advancing them here would keep combat alive behind a DOM-only screen.
    // Freeze that state for a paused return and only clear DOM transforms.
    resetInactiveCanvasFeedback();
    /* 배너 시계는 장면의 것이 아니다. 예전에는 update()에서만 세어서,
       상점·소환·편성에서 띄운 토스트(「골드가 부족합니다」 등)가 감쇠할
       기회를 얻지 못해 다음 setScene까지 화면에 붙어 있었다 — 정지한
       배너는 「기다리는 중」이 아니라 「멈춘 버그」로 읽힌다. */
    advanceToastQueue(d);
    requestAnimationFrame(loop);
    return;
  }
  if (paused) {
    // Pausing promises a frozen table. In particular, delayed assists must not
    // damage the boss and timed figure effects must not cast under the dialog.
    resetInactiveCanvasFeedback();
    requestAnimationFrame(loop);
    return;
  }
  // The tutorial stops the table on the frame the player has to decide, so the
  // steer and the parry are taught at the moment they are used instead of one
  // card earlier. The simulation halts like a pause - no delayed assist lands
  // while the board is held - but the canvas must NOT keep its last frame: a
  // fully static frame right before the promised contact reads as the game
  // freezing, not as the game waiting. Keep presenting the held state with a
  // wall-clock pulse around the meteor so the picture stays visibly alive
  // while zero simulation time passes.
  const onboardingModule = StellaRuntime.modules.optional("onboarding");
  if (onboardingModule?.isTeachingHold()) {
    resetInactiveCanvasFeedback();
    // 판은 멈춰도 배너는 계속 세어야 한다. 멈춘 배너가 살아 있는 큐 옆에
    // 굳어 있으면 「기다리는 중」이 아니라 「멈춘 버그」로 읽힌다.
    advanceToastQueue(d);
    // The safety grace is counted here rather than on a wall clock, so it
    // stops while the pause dialog is up - the `paused` branch above returns
    // before this one ever runs.
    onboardingModule.tickTeachingHold?.(d);
    draw();
    onboardingModule.drawTeachingHoldCue?.();
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

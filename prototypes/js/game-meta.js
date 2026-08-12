// Damage is feedback only.  The collision solver has already chosen the
// rebound vector, so combat must not reverse it a second time.
damage = function (weak = false) {
  if (battleComplete) return;
  let amount = RULES.baseDamage + build.weakFlat;
  amount *=
    1 + Math.max(0, chain.length - 1) * (RULES.chainStep + build.chainStep);
  amount *= 1 + ball.power * 0.18;
  const marked = weak && ball.mark;
  if (marked) amount *= build.markMultiplier;
  amount *= weak ? 1.8 : 0.72;
  amount *= 1 + Math.min(0.48, ball.bounces * build.bounceStep);
  const crit =
    weak && Math.random() < 0.1 + Math.min(0.18, chain.length * 0.04);
  if (crit) amount *= 1.6;
  amount = Math.max(1, Math.round(amount));
  const label = weak ? (crit ? "치명 약점" : "약점") : "몸체";
  boss.hp = Math.max(0, boss.hp - amount);
  addPopup(
    ball.x,
    ball.y - 28,
    label + " -" + amount,
    weak ? "#ffe59a" : "#e6c7ff",
    crit,
  );
  triggerZone("boss");
  if (marked)
    areaAttack(
      "비연 표식 폭발",
      Math.max(9, Math.round(amount * 0.34)),
      "#ef718d",
    );
  if (ball.blink) {
    const a = Math.atan2(ball.y - boss.y, ball.x - boss.x) + Math.PI;
    ball.x = boss.x + Math.cos(a) * 96;
    ball.y = boss.y + Math.sin(a) * 96;
    ball.vx = Math.cos(a) * 760;
    ball.vy = Math.sin(a) * 760;
    ball.blink = false;
    fieldFx.push({
      type: "blink",
      x: ball.x,
      y: ball.y,
      t: 0,
      d: 0.5,
      col: "#ff7fc8",
    });
    toast("카이 · 균열 도약!");
  } else
    toast(weak ? label + " " + amount + " 피해" : "몸체 " + amount + " 피해");
  if (boss.hp <= 0) scheduleWin();
  ball.power = 0;
  if (weak) ball.mark = false;
  ball.pulse = 0;
  chain = [];
  sync();
};
const META_COPY = {
  ko: {
    start: "게임 시작",
    party: "별지기 편성",
    guide: "조작법",
    achievements: "업적",
    settings: "설정",
    back: "뒤로",
    daily: "오늘의 밤하늘",
    dailyNote: "위기의 별자리에 도전하세요.",
    currentParty: "현재 별지기",
    system: "시스템",
    language: "언어",
    languageNote: "메뉴와 시스템 안내 언어를 바꿉니다.",
    audio: "오디오",
    master: "전체 음량",
    bgm: "배경음",
    sfx: "효과음",
    reset: "기본값으로",
    saveNote: "변경 사항은 이 브라우저에 자동 저장됩니다.",
    records: "관측 기록",
    clears: "되찾은 별",
    bestTime: "최단 시간",
    bestCombo: "최고 콤보",
    achTitle: "업적 도감",
    achNote: "플레이 기록으로 해금되는 전투 이정표입니다.",
    locked: "미해금",
    unlocked: "해금 완료",
  },
  en: {
    start: "START",
    party: "STARKEEPERS",
    guide: "GUIDE",
    achievements: "ACHIEVEMENTS",
    settings: "SETTINGS",
    back: "BACK",
    daily: "TODAY’S NIGHT SKY",
    dailyNote: "Challenge the constellation in danger.",
    currentParty: "STARKEEPERS",
    system: "SYSTEM",
    language: "LANGUAGE",
    languageNote: "Changes menu and system guidance language.",
    audio: "AUDIO",
    master: "MASTER VOLUME",
    bgm: "BGM",
    sfx: "SFX",
    reset: "RESET DEFAULTS",
    saveNote: "Changes are saved automatically in this browser.",
    records: "OBSERVATION RECORD",
    clears: "RETURNED STARS",
    bestTime: "BEST TIME",
    bestCombo: "BEST COMBO",
    achTitle: "ACHIEVEMENTS",
    achNote: "Combat milestones unlocked by your play record.",
    locked: "LOCKED",
    unlocked: "UNLOCKED",
  },
};
const SETTINGS_STORAGE = "prism-breakers.settings.v1",
  PROGRESS_STORAGE = "prism-breakers.progress.v1";
function readStored(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value && typeof value === "object"
      ? { ...fallback, ...value }
      : { ...fallback };
  } catch {
    return { ...fallback };
  }
}
function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
let settings = readStored(SETTINGS_STORAGE, {
  language: "ko",
  master: 0.7,
  bgm: 0.28,
  sfx: 0.65,
});
if (document.documentElement) document.documentElement.lang = settings.language;
let progress = readStored(PROGRESS_STORAGE, {
  clears: 0,
  bestTime: 0,
  bestShots: 99,
  bestCombo: 0,
});
const tr = (key) =>
  META_COPY[settings.language]?.[key] ?? META_COPY.ko[key] ?? key;
function saveSettings() {
  writeStored(SETTINGS_STORAGE, settings);
  if (document.documentElement)
    document.documentElement.lang = settings.language;
  syncAudio();
}
function saveProgress() {
  writeStored(PROGRESS_STORAGE, progress);
}
let audioEngine = null;
function ensureAudio() {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return null;
  if (!audioEngine) {
    const ac = new Context(),
      master = ac.createGain(),
      music = ac.createGain();
    master.connect(ac.destination);
    music.connect(master);
    for (const [freq, detune] of [
      [82.4, -5],
      [123.47, 5],
    ]) {
      const osc = ac.createOscillator(),
        gain = ac.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      osc.detune.value = detune;
      gain.gain.value = 0.021;
      osc.connect(gain);
      gain.connect(music);
      osc.start();
    }
    audioEngine = { ac, master, music };
  }
  audioEngine.ac.resume?.();
  syncAudio();
  return audioEngine;
}
function syncAudio() {
  if (!audioEngine) return;
  audioEngine.master.gain.value = settings.master;
  audioEngine.music.gain.value = settings.bgm;
}
function playSfx(kind = "confirm") {
  if (settings.sfx <= 0) return;
  const engine = ensureAudio();
  if (!engine) return;
  const ac = engine.ac,
    osc = ac.createOscillator(),
    gain = ac.createGain(),
    now = ac.currentTime,
    tones = {
      confirm: [420, 620, 0.09],
      flip: [190, 520, 0.07],
      unlock: [380, 760, 0.22],
    }[kind] || [300, 480, 0.08];
  osc.type = "square";
  osc.frequency.setValueAtTime(tones[0], now);
  osc.frequency.exponentialRampToValueAtTime(tones[1], now + tones[2]);
  gain.gain.setValueAtTime(0.055 * settings.sfx, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + tones[2]);
  osc.connect(gain);
  gain.connect(engine.master);
  osc.start(now);
  osc.stop(now + tones[2] + 0.02);
}
function formatRunTime(ms) {
  if (!ms) return "—";
  return (ms / 1000).toFixed(1) + "s";
}
function achievementList() {
  return [
    {
      id: "observer",
      name:
        settings.language === "ko" ? "첫 관측자의 증명" : "OBSERVER’S PROOF",
      text:
        settings.language === "ko"
          ? "1-1 관측 수업을 마치고 파티 슬롯을 하나 해금하세요."
          : "Complete 1-1 observation training and unlock a party slot.",
      done: hasThirdPartySlot(),
      ratio: hasThirdPartySlot() ? "1/1 · 파티 슬롯 +1" : "0/1 · 파티 슬롯 +1",
    },
    {
      id: "first",
      name: settings.language === "ko" ? "첫 별" : "FIRST STAR",
      text:
        settings.language === "ko"
          ? "보스를 한 번 처치하세요."
          : "Defeat a boss once.",
      done: progress.clears >= 1,
      ratio: Math.min(progress.clears, 1) + "/1",
    },
    {
      id: "riposte",
      name: "RIPOSTE",
      text:
        settings.language === "ko"
          ? "한 전투에서 3 HIT 콤보를 달성하세요."
          : "Reach a 3 HIT combo in one battle.",
      done: progress.bestCombo >= 3,
      ratio: Math.min(progress.bestCombo, 3) + "/3",
    },
    {
      id: "sharp",
      name: settings.language === "ko" ? "한 발의 해답" : "ONE SHOT",
      text:
        settings.language === "ko"
          ? "유성 한 개만 사용해 클리어하세요."
          : "Clear using a single meteor.",
      done: progress.bestShots <= 1,
      ratio: progress.bestShots <= 1 ? "1/1" : "0/1",
    },
    {
      id: "veteran",
      name: settings.language === "ko" ? "밤하늘의 단골" : "NIGHT SKY REGULAR",
      text:
        settings.language === "ko"
          ? "세 번의 전투를 클리어하세요."
          : "Clear three battles.",
      done: progress.clears >= 3,
      ratio: Math.min(progress.clears, 3) + "/3",
    },
  ];
}
function metaHeader(label = "PLAYER 01") {
  return (
    '<div class="meta-brand"><img src="' +
    metaArt.wordmark +
    '" alt="STELLA BALL"><span class="meta-profile">OBSERVATORY ID<b>' +
    label +
    "</b></span></div>"
  );
}
showMeta = function () {
  run = false;
  drag = null;
  setScene("meta");
  const s = currentStage(),
    today = new Intl.DateTimeFormat(
      settings.language === "ko" ? "ko-KR" : "en-US",
      { month: "long", day: "numeric" },
    ).format(new Date()),
    party = selected
      .map((id) => {
        const h = heroes[id],
          stone = runeStone(id);
        return (
          '<div class="meta-rune"><span class="meta-rune-art" data-hero="' +
          id +
          '" style="background-image:url(\'' +
          stone +
          '\')"></span><b style="color:' +
          h.col +
          '">' +
          h.s +
          "</b><small>" +
          h.e +
          "</small></div>"
        );
      })
      .join("");
  U.over.className = "overlay meta-scene";
  U.over.innerHTML =
    '<div class="meta-hub">' +
    metaHeader() +
    '<section class="meta-daily"><img src="' +
    metaArt.daily +
    '" alt="' +
    tr("daily") +
    '"><div><small>' +
    today +
    " · " +
    tr("daily") +
    "</small><h2>" +
    s.id +
    " · " +
    s.name +
    "</h2><p>" +
    tr("dailyNote") +
    '</p></div><button class="meta-launch" id="metaLaunch"><img src="' +
    metaArt.play +
    '" alt="">' +
    tr("start") +
    '</button></section><div class="meta-section-title"><span>' +
    tr("currentParty") +
    '</span><span>3 / 3</span></div><section class="meta-party">' +
    party +
    '</section><div class="meta-actions meta-tabs"><button class="meta-tab" id="metaRoster"><img src="../assets/library/system/icon-home.png" alt="">' +
    tr("party") +
    '</button><button class="meta-tab" id="metaHelp"><img src="' +
    metaArt.help +
    '" alt="">' +
    tr("guide") +
    '</button><button class="meta-tab" id="metaAchievements"><img src="../assets/library/event/achievement-unlocked.png" alt="">' +
    tr("achievements") +
    '</button><button class="meta-tab" id="metaSettings"><img src="../assets/library/system/icon-settings.png" alt="">' +
    tr("settings") +
    '</button></div><p class="meta-note">오늘의 관측은 한 번의 궤적으로 더 큰 별자리를 완성하는 도전입니다.</p></div>';
  for (const el of document.querySelectorAll(".meta-rune-art")) {
    const id = el.dataset.hero;
    if (!["gaon", "biyeon", "lumi", "haru", "sera", "taeo", "nyx"].includes(id))
      setPortrait(el, heroes[id], 58);
  }
  document.querySelector("#metaLaunch").onclick = () => {
    playSfx();
    showRoster();
  };
  document.querySelector("#metaRoster").onclick = () => {
    playSfx();
    showRoster();
  };
  document.querySelector("#metaHelp").onclick = () => {
    playSfx();
    showMetaHelp();
  };
  document.querySelector("#metaAchievements").onclick = () => {
    playSfx();
    showAchievements();
  };
  document.querySelector("#metaSettings").onclick = () => {
    playSfx();
    showSettings();
  };
};
function showSettings() {
  run = false;
  drag = null;
  setScene("meta");
  U.over.className = "overlay meta-scene";
  const volume = (key, label, note) =>
    '<label class="setting-row"><span><b>' +
    label +
    "</b><small>" +
    note +
    '</small></span><span><input id="setting-' +
    key +
    '" type="range" min="0" max="1" step="0.05" value="' +
    settings[key] +
    '"><output id="setting-' +
    key +
    '-value">' +
    Math.round(settings[key] * 100) +
    "%</output></span></label>";
  U.over.innerHTML =
    '<div class="meta-hub">' +
    metaHeader(tr("system")) +
    '<section class="system-panel"><h2>' +
    tr("settings") +
    "</h2><p>" +
    tr("saveNote") +
    '</p><div class="settings-group"><h3>' +
    tr("language") +
    '</h3><div class="setting-row"><span><b>' +
    tr("language") +
    "</b><small>" +
    tr("languageNote") +
    '</small></span><span class="language-choice"><button data-lang="ko" class="' +
    (settings.language === "ko" ? "active" : "") +
    '">한국어</button><button data-lang="en" class="' +
    (settings.language === "en" ? "active" : "") +
    '">English</button></span></div></div><div class="settings-group"><h3>' +
    tr("audio") +
    "</h3>" +
    volume("master", tr("master"), "MASTER") +
    volume("bgm", tr("bgm"), "AMBIENT") +
    volume("sfx", tr("sfx"), "PINBALL FX") +
    '</div><div class="settings-actions"><button id="settingsReset">' +
    tr("reset") +
    '</button><button id="settingsBack">' +
    tr("back") +
    "</button></div></section></div>";
  for (const button of document.querySelectorAll("[data-lang]"))
    button.onclick = () => {
      settings.language = button.dataset.lang;
      saveSettings();
      playSfx("confirm");
      showSettings();
    };
  for (const key of ["master", "bgm", "sfx"]) {
    const input = document.querySelector("#setting-" + key),
      output = document.querySelector("#setting-" + key + "-value");
    input.oninput = () => {
      settings[key] = Number(input.value);
      output.textContent = Math.round(settings[key] * 100) + "%";
      ensureAudio();
      saveSettings();
    };
  }
  document.querySelector("#settingsReset").onclick = () => {
    settings = { language: "ko", master: 0.7, bgm: 0.28, sfx: 0.65 };
    saveSettings();
    playSfx("unlock");
    showSettings();
  };
  document.querySelector("#settingsBack").onclick = () => {
    playSfx();
    showMeta();
  };
}
function showAchievements() {
  run = false;
  drag = null;
  setScene("meta");
  U.over.className = "overlay meta-scene";
  const list = achievementList(),
    unlocked = list.filter((v) => v.done).length,
    cards = list
      .map(
        (a) =>
          '<article class="achievement-card ' +
          (a.done ? "" : "locked") +
          '"><img src="../assets/library/event/achievement-' +
          (a.done ? "unlocked" : "locked") +
          '.png" alt=""><b>' +
          a.name +
          "</b><small>" +
          a.text +
          "</small><em>" +
          a.ratio +
          " · " +
          tr(a.done ? "unlocked" : "locked") +
          "</em></article>",
      )
      .join("");
  U.over.innerHTML =
    '<div class="meta-hub">' +
    metaHeader("ARCHIVE") +
    '<section class="system-panel"><h2>' +
    tr("achTitle") +
    "</h2><p>" +
    tr("achNote") +
    '</p><div class="profile-stats"><div class="profile-stat"><small>' +
    tr("clears") +
    "</small><b>" +
    progress.clears +
    '</b></div><div class="profile-stat"><small>' +
    tr("bestTime") +
    "</small><b>" +
    formatRunTime(progress.bestTime) +
    '</b></div><div class="profile-stat"><small>' +
    tr("bestCombo") +
    "</small><b>" +
    progress.bestCombo +
    ' HIT</b></div></div><div class="meta-section-title"><span>' +
    tr("records") +
    "</span><span>" +
    unlocked +
    " / " +
    list.length +
    '</span></div><div class="achievement-grid">' +
    cards +
    '</div><div class="settings-actions"><span></span><button id="achievementBack">' +
    tr("back") +
    "</button></div></section></div>";
  document.querySelector("#achievementBack").onclick = () => {
    playSfx();
    showMeta();
  };
}
const originalRegisterBossHit = registerBossHit;
registerBossHit = function (weak) {
  originalRegisterBossHit(weak);
  if (hitCombo > progress.bestCombo) {
    progress.bestCombo = hitCombo;
    saveProgress();
  }
};
const originalWin = win;
win = function () {
  if (!battleComplete && battle && boss?.hp <= 0) {
    const used = battle.shotMax - battle.shots,
      elapsed = Math.round(performance.now() - battle.startedAt);
    progress.clears++;
    progress.bestShots = Math.min(progress.bestShots, used);
    progress.bestTime = !progress.bestTime
      ? elapsed
      : Math.min(progress.bestTime, elapsed);
    saveProgress();
    if (achievementList().some((a) => a.done)) playSfx("unlock");
  }
  originalWin();
};
const originalStartShot = startShot;
startShot = function () {
  originalStartShot();
  for (const gate of gates) gate.r = 23;
};
// Bumpers are deliberately sparse: they build momentum and invoke the bumper
// rule-slot. Damage belongs to the boss hit and the supporting unit, not to a
// pile of anonymous table objects.
hitBumper = function (b) {
  if (b.on > 0 || battleComplete) return;
  b.on = 0.22;
  const speed = Math.hypot(ball.vx, ball.vy) || 1,
    boosted = Math.min(1040, speed + 82);
  ball.vx *= boosted / speed;
  ball.vy *= boosted / speed;
  ball.power += 0.2;
  ball.runeBurst = 0.42;
  addPopup(b.x, b.y - 26, "공명 가속", "#80e8df", false);
  fieldFx.push({
    type: "bumper",
    x: b.x,
    y: b.y,
    t: 0,
    d: 0.36,
    col: "#80e8df",
  });
  triggerZone("bumper");
  impact(false);
  toast("공명 범퍼 · 운동량 상승");
  sync();
};
// Support characters use the full frame centre as their anchor.  The earlier
// sprite baseline was tuned for the boss and made small hero frames look cut.
drawFrame = function (
  spec,
  cx,
  cy,
  frame = 0,
  scale = spec.scale,
  state = spec.animState === "hit" && spec.on > 0.08
    ? "hit"
    : spec.animState === "attack" && spec.on > 0.08
      ? "attack"
      : spec.animState === "move" && spec.on > 0.05
        ? "move"
        : "idle",
) {
  // Cute tokens keep the resting table readable; any action state swaps in
  // the full-size animation sheet so the awakening reads as a power-up.
  const unit = Boolean(spec.id),
    cute = unit && spec.cuteSprite && state === "idle",
    wanted = cute ? null : spec.animations?.[state];
  // Lazy-load action sheets (mid-battle deployments skip the battle prime)
  // and fall back to the still sprite until the sheet is actually ready.
  if (wanted && !textures[wanted]) loadTexture(wanted);
  const animTex = wanted ? textures[wanted] : null,
    animated = animTex?.complete && animTex.naturalWidth ? wanted : null,
    path = cute ? spec.cuteSprite : (animated ?? spec.sprite),
    im = textures[path];
  if (!im?.complete || !im.naturalWidth) return false;
  const unitSize = spec.combatSize;
  if (cute) {
    const size = unitSize || 96;
    x.drawImage(
      im,
      Math.round(cx - size / 2),
      Math.round(cy - size * 0.61),
      Math.round(size),
      Math.round(size),
    );
    return true;
  }
  const unitScale = unit ? 1.55 : 1,
    anchor = unit ? 0.62 : 0.64,
    safeFrame = animated ? frame : unit ? 0 : frame;
  if (animated) {
    const frameSize = spec.sheetFrame || 256,
      // The strike needs to read as a deliberate payoff after the short roll,
      // not as a tiny flicker between resting tokens.
      statePop = unit
        ? state === "attack"
          ? 1.72
          : state === "move"
            ? 1.03
            : 1
        : 1,
      size =
        (unitSize || frameSize * (spec.sheetScale ?? scale) * unitScale) *
        statePop,
      sx = (safeFrame % 4) * frameSize;
    x.drawImage(
      im,
      sx,
      0,
      frameSize,
      frameSize,
      Math.round(cx - size / 2),
      Math.round(cy - size * anchor),
      Math.round(size),
      Math.round(size),
    );
    return true;
  }
  const dw = unitSize || spec.fw * scale * unitScale,
    dh = unitSize || spec.fh * scale * unitScale,
    sx = spec.atlas
      ? spec.atlas[0] * spec.fw
      : (safeFrame % spec.frames) * spec.fw,
    sy = spec.atlas ? spec.atlas[1] * spec.fh : 0;
  x.drawImage(
    im,
    sx,
    sy,
    spec.fw,
    spec.fh,
    Math.round(cx - dw / 2),
    Math.round(cy - dh * anchor),
    Math.round(dw),
    Math.round(dh),
  );
  return true;
};
const baseMetaHub = showMeta;
showMeta = function () {
  baseMetaHub();
  document.querySelector("#metaLaunch").onclick = () => {
    playSfx();
    showStageSelect();
  };
};
function showStageSelect() {
  run = false;
  drag = null;
  setScene("meta");
  const mapStages = [
    {
      id: "1-1",
      name: "별빛의 첫 충돌",
      note: "온보딩 튜토리얼",
      mark: "✦",
      onboarding: true,
    },
    {
      id: "1-2",
      name: "균열 회랑",
      note: "신규 기믹 · 공명 범퍼",
      mark: "✧",
      stage: 1,
    },
    {
      id: "1-3",
      name: "침식의 계단",
      note: "다음 관측 지점",
      mark: "★",
      locked: true,
    },
    {
      id: "2-1",
      name: "원심 정원",
      note: "다음 별자리",
      mark: "◇",
      locked: true,
    },
    {
      id: "2-2",
      name: "잠든 항구",
      note: "관측 기록 수집 중",
      mark: "✦",
      locked: true,
    },
  ];
  const nodes = mapStages
    .map(
      (stage, index) =>
        '<button class="constellation-node s' +
        (index + 1) +
        (stage.locked ? " locked" : "") +
        (stage.onboarding ? " active" : "") +
        '" ' +
        (stage.locked
          ? "disabled"
          : stage.onboarding
            ? 'data-onboarding="true"'
            : 'data-stage="' + stage.stage + '"') +
        '><span class="stage-star">' +
        stage.mark +
        '</span><span class="stage-copy"><small>STAGE ' +
        stage.id +
        "</small><b>" +
        stage.name +
        "</b><span>" +
        stage.note +
        '</span></span><em class="node-status">' +
        (stage.locked ? "잠김" : "시작 →") +
        "</em></button>",
    )
    .join("");
  U.over.className = "overlay constellation-map-scene";
  U.over.innerHTML =
    '<div class="constellation-map-shell"><header class="constellation-map-head"><div><div class="tag">TODAY\'S NIGHT SKY</div><h2>별자리 관측도</h2></div><p>1-2 균열 회랑의 관측 기록이 열렸습니다.<br>공명 범퍼로 반사각을 만들어 보세요.</p></header><section class="constellation-map" aria-label="스테이지 별자리 지도"><svg class="constellation-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M16 75 L34 53 L57 31 L78 48"/><path class="future" d="M78 48 L72 75"/></svg>' +
    nodes +
    '</section><footer class="constellation-map-foot"><button class="constellation-training" id="replayOnboarding">튜토리얼 다시보기</button><span>현재 플레이 가능: 1-1 · 1-2</span><button id="stageSelectBack">뒤로</button></footer></div>';
  for (const button of document.querySelectorAll("[data-stage]"))
    button.onclick = () => {
      stageIndex = Number(button.dataset.stage);
      primeCombatTextures();
      playSfx();
      showRoster();
    };
  document.querySelector("[data-onboarding]").onclick = () => {
    playSfx();
    showOnboardingTutorial(true);
  };
  document.querySelector("#replayOnboarding").onclick = () => {
    playSfx();
    showOnboardingTutorial(true);
  };
  document.querySelector("#stageSelectBack").onclick = () => {
    playSfx();
    showMeta();
  };
}
const baseRosterScreen = showRoster;
showRoster = function () {
  baseRosterScreen();
  document.querySelector("#stageChoices")?.remove();
  document.querySelector("#backMeta").onclick = showStageSelect;
};
const tutorialSteps = [
  {
    tag: "01 / 03 · 발사",
    title: "당겨서 발사",
    text: "유성을 아래로 끌어 당긴 뒤 놓으세요. 끈 방향의 반대로 강하게 출발하며, 점선이 첫 충돌 경로를 보여줍니다.",
    art: "../assets/library/tutorial/hint-drag-shot.png",
  },
  {
    tag: "02 / 03 · 연쇄",
    title: "별지기를 굴려라",
    text: "별지기에 부딪히면 공과 별지기가 함께 가속합니다. 움직인 별지기는 모든 공이 멈춘 뒤, 현재 위치에서 고유 공격을 합니다.",
    art: "../assets/library/projectiles/support-bolt.png",
  },
  {
    tag: "03 / 03 · 마무리",
    title: "약점에 집중",
    text: "보스 몸체도 피해를 받지만, 빛나는 약점은 더 큰 피해를 줍니다. 별지기를 모두 깨우고 배율을 쌓아 한 번에 마무리하세요.",
    art: "../assets/library/projectiles/marked-orb.png",
  },
];
function showTutorial(step = 0) {
  run = false;
  drag = null;
  setScene("meta");
  const index = clamp(step, 0, tutorialSteps.length - 1),
    guide = tutorialSteps[index],
    progress = tutorialSteps
      .map((_, i) => '<i class="' + (i <= index ? "active" : "") + '"></i>')
      .join("");
  U.over.className = "overlay tutorial-scene";
  U.over.innerHTML =
    '<div class="tutorial-shell"><div class="meta-brand"><img src="' +
    metaArt.wordmark +
    '" alt="Prism Breakers"><span class="meta-profile">TUTORIAL<b>REPLAY</b></span></div><section class="tutorial-card"><div class="tutorial-visual"><img src="' +
    guide.art +
    '" alt=""></div><div class="tutorial-copy"><small>' +
    guide.tag +
    "</small><h2>" +
    guide.title +
    "</h2><p>" +
    guide.text +
    '</p></div></section><div class="tutorial-progress">' +
    progress +
    '</div><div class="tutorial-actions"><button id="tutorialBack">메타로</button><span><button id="tutorialPrev" ' +
    (index === 0 ? "disabled" : "") +
    '>이전</button><button id="tutorialNext">' +
    (index === tutorialSteps.length - 1 ? "완료" : "다음") +
    "</button></span></div></div>";
  document.querySelector("#tutorialBack").onclick = () => {
    playSfx();
    showMeta();
  };
  document.querySelector("#tutorialPrev").onclick = () => {
    playSfx();
    showTutorial(index - 1);
  };
  document.querySelector("#tutorialNext").onclick = () => {
    playSfx();
    index === tutorialSteps.length - 1 ? showMeta() : showTutorial(index + 1);
  };
}
showMetaHelp = showTutorial;
showMeta = function () {
  run = false;
  drag = null;
  setScene("meta");
  const stage = currentStage(),
    avatar = selected[0]
      ? '<img src="' + runeStone(selected[0]) + '" alt="">'
      : "◆",
    party = Array.from({ length: 3 }, (_, i) =>
      selected[i]
        ? '<span class="hub-party-slot"><img src="' +
          runeStone(selected[i]) +
          '" alt="' +
          heroes[selected[i]].s +
          '"></span>'
        : '<span class="hub-party-slot empty">+</span>',
    ).join(""),
    clear = progress.clears || 0,
    best = formatRunTime(progress.bestTime);
  U.over.className = "overlay meta-scene";
  U.over.innerHTML =
    '<div class="survivor-hub"><div class="hub-topbar"><div class="hub-player"><span class="hub-avatar">' +
    avatar +
    '</span><span>PRISM ID<b>PLAYER 01</b><small>오늘의 전장 준비</small></span></div><div class="hub-resources"><span class="hub-resource">클리어<b>' +
    clear +
    '</b></span><span class="hub-resource">최단 기록<b>' +
    best +
    '</b></span></div></div><section class="hub-mission" style="--stage-art:url(\'' +
    libraryArt.stages[stageIndex].tile +
    '\')"><div class="hub-mission-copy"><small>오늘의 메인 스테이지 · STAGE ' +
    stage.id +
    "</small><h2>" +
    stage.name +
    "</h2><p>" +
    stage.terrain +
    '</p></div><button class="hub-start" id="hubStageSelect">스테이지 선택</button></section><section class="hub-party-row"><span class="hub-party-label">현재 파티</span><span class="hub-party-slots">' +
    party +
    '</span><button id="hubParty">편성</button></section><section class="hub-quick-grid"><button class="hub-quick" id="hubTutorial"><img src="' +
    metaArt.help +
    '" alt=""><strong>튜토리얼</strong><small>다시 보기</small></button><button class="hub-quick" id="hubAchievements"><img src="../assets/library/event/achievement-unlocked.png" alt=""><strong>업적</strong><small>전투 기록</small></button><button class="hub-quick" id="hubSettings"><img src="../assets/library/system/icon-settings.png" alt=""><strong>설정</strong><small>언어 · 사운드</small></button><button class="hub-quick" id="hubGuide"><img src="' +
    metaArt.play +
    '" alt=""><strong>플레이 방법</strong><small>핵심 규칙</small></button></section></div>';
  document.querySelector("#hubStageSelect").onclick = () => {
    playSfx();
    showStageSelect();
  };
  document.querySelector("#hubParty").onclick = () => {
    playSfx();
    showRoster();
  };
  document.querySelector("#hubTutorial").onclick = () => {
    playSfx();
    showTutorial();
  };
  document.querySelector("#hubAchievements").onclick = () => {
    playSfx();
    showAchievements();
  };
  document.querySelector("#hubSettings").onclick = () => {
    playSfx();
    showSettings();
  };
  document.querySelector("#hubGuide").onclick = () => {
    playSfx();
    showTutorial();
  };
};
// During battle, rules are taught in deployment. Keep the table readable:
// only the launch instruction remains until the first ball is fired.
drawZoneRules = function () {};
drawCombatControls = function () {
  if (!run || ball?.moving) return;
  x.save();
  x.fillStyle = "#07131be8";
  x.strokeStyle = "#5e9290";
  x.lineWidth = 1;
  x.beginPath();
  x.roundRect(W / 2 - 116, H - 126, 232, 25, 6);
  x.fill();
  x.stroke();
  x.fillStyle = "#e8dfbd";
  x.font = "bold 10px ui-monospace";
  x.textAlign = "center";
  x.fillText("하단을 아래로 드래그한 뒤 놓기", W / 2, H - 110);
  x.restore();
};

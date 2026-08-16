/* Meta persistence, progression, economy, audio, and achievement state. */
// Damage is feedback only.  The collision solver has already chosen the
// rebound vector, so combat must not reverse it a second time.
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
    firstRun: "첫 실행 상태로",
    firstRunTitle: "처음 켠 상태로 되돌릴까요?",
    firstRunBody:
      "이 브라우저에 저장된 진행도·골드·해금·업적·출석이 모두 지워지고, 프롤로그와 6단계 온보딩이 처음부터 다시 재생됩니다. 되돌릴 수 없습니다.",
    firstRunYes: "지우고 다시 시작",
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
    firstRun: "RESET TO FIRST RUN",
    firstRunTitle: "Reset to a fresh install?",
    firstRunBody:
      "Progress, gold, unlocks, achievements and attendance saved in this browser are erased, and the prologue and six-card onboarding play again from the start. This cannot be undone.",
    firstRunYes: "ERASE AND RESTART",
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
const DEFAULT_SETTINGS = Object.freeze({
  language: "ko",
  master: 0.7,
  bgm: 0.28,
  sfx: 0.65,
});
let settings = appStorage.readRecord(SETTINGS_STORAGE, DEFAULT_SETTINGS);
settings.language = META_COPY[settings.language]
  ? settings.language
  : DEFAULT_SETTINGS.language;
for (const key of ["master", "bgm", "sfx"]) {
  const value = Number(settings[key]);
  settings[key] = Number.isFinite(value)
    ? clamp(value, 0, 1)
    : DEFAULT_SETTINGS[key];
}
if (document.documentElement) document.documentElement.lang = settings.language;
let progress = appStorage.readRecord(PROGRESS_STORAGE, {
  clears: 0,
  gold: 0,
  ownedHeroes: [...STARTER_HERO_IDS],
  ownedSkins: [DEFAULT_METEOR_SKIN],
  skin: DEFAULT_METEOR_SKIN,
  freeSummons: 0,
  claimedAchievements: [],
  announcedAchievementIds: null,
  pendingGold: 0,
  pendingRewards: [],
  pendingRewardSerial: 0,
  bestTime: 0,
  bestShots: 99,
  bestCombo: 0,
});
/* readRecord merges the stored record over the defaults, so a key that EXISTS
   but holds a broken value keeps that value - the default never applies. That
   matters because JSON.stringify writes NaN as null, and a single bad write
   sticks forever: `bestShots` null makes `null <= 1` true, permanently
   granting the 400-gold one-shot achievement while the profile prints
   "null발"; `clears` null re-locks every stage but the first, with no in-game
   way back short of a full reset. Repair the numeric fields once at load, in
   the one place they are all named. */
for (const [key, fallback, min] of [
  ["clears", 0, 0],
  ["gold", 0, 0],
  ["freeSummons", 0, 0],
  ["pendingGold", 0, 0],
  ["pendingRewardSerial", 0, 0],
  ["bestTime", 0, 0],
  // A clear takes at least one meteor, so 0 is not a better record - it is a
  // broken one, and `0 <= 1` would hand out the one-shot achievement.
  ["bestShots", 99, 1],
  ["bestCombo", 0, 0],
]) {
  const value = progress[key];
  // Check the raw value, not a coercion: Number(null) is 0, which is finite,
  // so coercing first would quietly accept a null as a legitimate record.
  progress[key] =
    typeof value === "number" && Number.isFinite(value) && value >= min
      ? value
      : fallback;
}
const tr = (key) =>
  META_COPY[settings.language]?.[key] ?? META_COPY.ko[key] ?? key;
function saveSettings() {
  appStorage.writeRecord(SETTINGS_STORAGE, settings);
  if (document.documentElement)
    document.documentElement.lang = settings.language;
  syncAudio();
}
function saveProgress() {
  appStorage.writeRecord(PROGRESS_STORAGE, progress);
}
function goldBalance() {
  return Math.max(0, Math.floor(Number(progress.gold) || 0));
}
// Reward feedback follows the 연타 promotion pattern: an ordinary line becomes
// a louder, self-dismissing card when something was actually earned, so gold
// and unlocks read as a claim instead of a number quietly changing.
let rewardToastTimer = 0;
function rewardToast(kicker, title, detail = "", { onClick = null } = {}) {
  const host = document.querySelector(".stage") ?? document.body;
  document.querySelector(".reward-toast")?.remove();
  const card = document.createElement(onClick ? "button" : "div");
  if (onClick) card.type = "button";
  card.className = "reward-toast" + (onClick ? " actionable" : "");
  card.setAttribute("role", "status");
  card.innerHTML =
    "<small>" +
    kicker +
    "</small><b>" +
    title +
    "</b>" +
    (detail ? "<span>" + detail + "</span>" : "");
  host.append(card);
  requestAnimationFrame(() => card.classList.add("show"));
  const dismiss = () => {
    clearTimeout(rewardToastTimer);
    card.classList.remove("show");
    setTimeout(() => card.remove(), 320);
  };
  if (onClick)
    card.onclick = () => {
      dismiss();
      onClick();
    };
  clearTimeout(rewardToastTimer);
  rewardToastTimer = setTimeout(dismiss, 2600);
  playSfx?.("unlock");
}
// Gold is earned but not auto-credited: clears accrue into a pending pool and
// achievements hold one-time rewards.  Both are collected in the 업적 tab, so
// the player always performs the claim.
function pendingGold() {
  return pendingRewardEntries().reduce((sum, entry) => sum + entry.gold, 0);
}
function pendingRewardEntries() {
  const entries = Array.isArray(progress.pendingRewards)
    ? progress.pendingRewards
        .filter((entry) => entry && entry.id && Number(entry.gold) > 0)
        .map((entry) => ({
          id: String(entry.id),
          title: String(entry.title || "관측 보상"),
          gold: Math.floor(Number(entry.gold)),
        }))
    : [];
  // Old saves stored every clear in one number. Keep that money claimable as
  // one explicitly labelled legacy entry instead of silently crediting it.
  const legacy = Math.max(0, Math.floor(Number(progress.pendingGold) || 0));
  if (legacy)
    entries.unshift({
      id: "legacy-pending-gold",
      title: "이전 관측 보상",
      gold: legacy,
    });
  return entries;
}
function accrueGold(amount, title = "스테이지 클리어") {
  const earned = Math.max(0, Math.floor(Number(amount) || 0));
  if (!earned) return 0;
  const serial =
    Math.max(0, Math.floor(Number(progress.pendingRewardSerial) || 0)) + 1;
  progress.pendingRewardSerial = serial;
  progress.pendingRewards = [
    ...(Array.isArray(progress.pendingRewards) ? progress.pendingRewards : []),
    { id: "clear-" + serial, title, gold: earned },
  ];
  // `pendingGold` is the pre-migration single-number pool, and
  // pendingRewardEntries deliberately surfaces it as a claimable legacy entry
  // rather than crediting it silently. Zeroing it here destroyed it: it was
  // not credited, not moved into pendingRewards, just deleted on the next
  // clear. An old save with 450 unclaimed gold lost all of it the first time
  // the player finished a stage. Migrate it into a real entry instead, once.
  const legacy = Math.max(0, Math.floor(Number(progress.pendingGold) || 0));
  if (legacy) {
    progress.pendingRewards = [
      { id: "legacy-pending-gold", title: "이전 관측 보상", gold: legacy },
      ...progress.pendingRewards,
    ];
    progress.pendingGold = 0;
  }
  return earned;
}
function claimedAchievementIds() {
  return Array.isArray(progress.claimedAchievements)
    ? progress.claimedAchievements
    : [];
}
function isAchievementClaimed(id) {
  return claimedAchievementIds().includes(id);
}
function claimableAchievements() {
  return achievementList().filter((a) => a.done && !isAchievementClaimed(a.id));
}
function claimCount() {
  // The hub chip opens the archive, so count only rewards that can actually
  // be collected there. Daily attendance lives in the profile screen and has
  // its own ready state; including it here produced a misleading “수령 1”.
  return claimableAchievements().length + pendingRewardEntries().length;
}
function claimAchievement(id) {
  const entry = claimableAchievements().find((a) => a.id === id);
  if (!entry) return null;
  progress.claimedAchievements = [...claimedAchievementIds(), id];
  progress.gold = goldBalance() + entry.gold;
  saveProgress();
  return entry;
}
function claimPendingGold(id) {
  const entry = pendingRewardEntries().find((item) => item.id === id);
  if (!entry) return null;
  // Two places can hold the claimed entry, and both have to give it up. The
  // legacy pool is the bare `pendingGold` number on pre-migration saves, but
  // accrueGold now migrates that pool into a real pendingRewards entry under
  // the same id - so clearing only the number left the migrated entry sitting
  // there, claimable again and again. Clear the number when it applies, and
  // remove the array entry unconditionally.
  if (id === "legacy-pending-gold") progress.pendingGold = 0;
  // pendingRewardEntries normalises ids with String(), so the id handed back
  // here is always a string while the stored one may not be. A strict !==
  // matched nothing and the entry survived every claim - a save holding
  // {id: 1} could be collected indefinitely. Compare in the same normalised
  // space, and drop only the first match so two entries sharing an id (which a
  // stale serial can mint) are not both deleted for one payout.
  const stored = Array.isArray(progress.pendingRewards)
    ? [...progress.pendingRewards]
    : [];
  const at = stored.findIndex((item) => String(item?.id) === id);
  if (at >= 0) stored.splice(at, 1);
  progress.pendingRewards = stored;
  progress.gold = goldBalance() + entry.gold;
  saveProgress();
  return entry;
}
function initializeAchievementNotifications() {
  if (Array.isArray(progress.announcedAchievementIds)) return;
  progress.announcedAchievementIds = achievementList()
    .filter((entry) => entry.done)
    .map((entry) => entry.id);
  saveProgress();
}
function announceNewAchievements() {
  initializeAchievementNotifications();
  const announced = new Set(progress.announcedAchievementIds),
    newlyDone = achievementList().filter(
      (entry) => entry.done && !announced.has(entry.id),
    );
  if (!newlyDone.length) return;
  progress.announcedAchievementIds = [
    ...progress.announcedAchievementIds,
    ...newlyDone.map((entry) => entry.id),
  ];
  saveProgress();
  const inCombat = Boolean(battle && run && !battleComplete),
    title =
      newlyDone.length === 1
        ? newlyDone[0].name
        : "업적 " + newlyDone.length + "개 달성",
    detail =
      newlyDone.length === 1
        ? "보상 " + newlyDone[0].gold + " 골드 · 업적 탭에서 수령"
        : "각 보상은 업적 탭에서 직접 수령";
  rewardToast("업적 달성", title, detail, {
    onClick: inCombat ? null : () => showAchievements(),
  });
}
function ownedSkinIds() {
  const stored = Array.isArray(progress.ownedSkins) ? progress.ownedSkins : [];
  return [...new Set([DEFAULT_METEOR_SKIN, ...stored])].filter((id) =>
    METEOR_SKINS.some((skin) => skin.id === id),
  );
}
/* Both skin lookups sit on the per-frame draw path - the meteor's once, the
   hero filter once per starkeeper - and both rebuilt arrays, a Set and a
   filter string on every call. Skins only change when the shop writes one, so
   the results are cached and every mutation site calls invalidateSkinCaches().
   The hero map is declared here rather than in game-meta.js because this file
   loads first and both files' equip paths have to reach the same cache. */
const heroSkinFilterCache = new Map();
let equippedSkinCache = null;
function invalidateSkinCaches() {
  heroSkinFilterCache.clear();
  equippedSkinCache = null;
}
function equippedSkin() {
  if (equippedSkinCache) return equippedSkinCache;
  const id = progress.skin;
  equippedSkinCache =
    METEOR_SKINS.find(
      (skin) => skin.id === id && ownedSkinIds().includes(id),
    ) ?? METEOR_SKINS[0];
  return equippedSkinCache;
}
function buySkin(id) {
  const skin = METEOR_SKINS.find((entry) => entry.id === id);
  if (!skin) return { reason: "missing" };
  if (ownedSkinIds().includes(id)) return { reason: "owned" };
  if (goldBalance() < ECONOMY.skinCost) return { reason: "gold" };
  progress.gold = goldBalance() - ECONOMY.skinCost;
  progress.ownedSkins = [...ownedSkinIds(), id];
  progress.skin = id;
  invalidateSkinCaches();
  saveProgress();
  return { id, cost: ECONOMY.skinCost };
}
function equipSkin(id) {
  if (!ownedSkinIds().includes(id)) return false;
  progress.skin = id;
  invalidateSkinCaches();
  saveProgress();
  return true;
}
// The tutorial hands out one free summon instead of gold, so the "1-1 pays no
// gold" economy rule stays intact.
function hasFreeSummon() {
  return Number(progress.freeSummons || 0) > 0;
}
function grantFreeSummon(count = 1) {
  progress.freeSummons = Number(progress.freeSummons || 0) + count;
  saveProgress();
}
function ownedHeroIds() {
  const stored = Array.isArray(progress.ownedHeroes)
    ? progress.ownedHeroes
    : [];
  return [...new Set([...STARTER_HERO_IDS, ...stored])].filter((id) =>
    Boolean(heroes[id]),
  );
}
function ownsHero(id) {
  return ownedHeroIds().includes(id);
}
function pullGachaHero() {
  const pool = GACHA_HERO_IDS.filter((id) => !ownsHero(id));
  if (!pool.length) return { reason: "complete" };
  const free = hasFreeSummon();
  if (!free && goldBalance() < ECONOMY.gachaCost) return { reason: "gold" };
  const id = pool[Math.floor(Math.random() * pool.length)];
  if (free) progress.freeSummons = Number(progress.freeSummons || 0) - 1;
  else progress.gold = goldBalance() - ECONOMY.gachaCost;
  progress.ownedHeroes = [...ownedHeroIds(), id];
  saveProgress();
  return { id, cost: free ? 0 : ECONOMY.gachaCost, free };
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
    startObservatoryScore(audioEngine);
  }
  audioEngine.ac.resume?.();
  syncAudio();
  return audioEngine;
}
/* --- the score ------------------------------------------------------------
 * Generated at runtime rather than shipped as a file.  The two drone
 * oscillators above were already the whole of the music, and they are E2 and
 * B2 — a bare fifth — so the piece is written in E and simply continues them
 * instead of replacing them.  Nothing is loaded, nothing is licensed, and the
 * existing `music` gain and the `배경음` slider stay in charge of the level.
 *
 * It never loops.  A loop of any length announces itself over a 60 to 90
 * second battle and then over the next one, so each bar picks its own notes
 * and the piece simply continues.  What repeats is the harmony, not the audio.
 */
const SCORE = {
  // E natural minor.  The drone already sits on E and B, so this is what those
  // two were implying; the pad below moves underneath them rather than against.
  root: 82.41,
  // Four chords as semitone offsets from the root, one per bar: Em, C, Am, B.
  // A slow, unhurried circle that resolves without ever quite settling, which
  // is what the observatory wants — waiting, not arriving.
  progression: [
    [0, 3, 7],
    [8, 12, 15],
    [5, 8, 12],
    [7, 11, 14],
  ],
  // Pentatonic degrees, in semitones from the root.  Any of these against any
  // of the chords above is consonant, which is what lets the melody be chosen
  // at random without ever sounding wrong.
  scale: [0, 3, 5, 7, 10, 12, 15, 17, 19, 22],
  barSeconds: 7.2,
  lookahead: 0.6,
  tickMs: 220,
};
function startObservatoryScore(engine) {
  const ac = engine.ac,
    bed = ac.createGain();
  bed.gain.value = 1;
  bed.connect(engine.music);
  // A soft ceiling on the pad's brightness.  Without it the stacked sines beat
  // against the drone and the result reads as a mistuned organ.
  const veil = ac.createBiquadFilter();
  veil.type = "lowpass";
  veil.frequency.value = 1250;
  veil.Q.value = 0.4;
  veil.connect(bed);
  const state = { bar: 0, at: ac.currentTime + 0.4, seed: 20260813 };
  // Deterministic: the same session always writes the same piece, which makes
  // an odd-sounding bar reproducible instead of a ghost.
  const rnd = () =>
    (state.seed = (state.seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const hz = (semitones) => SCORE.root * Math.pow(2, semitones / 12);
  function voice(freq, at, dur, peak, type = "sine", target = veil) {
    const osc = ac.createOscillator(),
      gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + dur * 0.25);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain);
    gain.connect(target);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }
  function writeBar(at, index) {
    const chord = SCORE.progression[index % SCORE.progression.length];
    // The pad: the chord an octave up, entering and leaving slowly enough that
    // no single note is ever the thing you notice.
    for (const step of chord)
      voice(hz(step + 12), at, SCORE.barSeconds * 1.1, 0.09);
    // Two or three struck notes a bar, placed on eighths so they land with the
    // pad rather than across it.  Sparse on purpose: this plays under a game.
    const strikes = 2 + (rnd() < 0.4 ? 1 : 0);
    for (let i = 0; i < strikes; i++) {
      const beat = Math.floor(rnd() * 8) / 8,
        step = SCORE.scale[Math.floor(rnd() * SCORE.scale.length)];
      voice(
        hz(step + 24),
        at + beat * SCORE.barSeconds,
        1.7 + rnd() * 1.4,
        0.07,
        "triangle",
      );
    }
    // One low swell every fourth bar, to mark the turn of the progression.
    if (index % 4 === 0)
      voice(hz(chord[0] - 12), at, SCORE.barSeconds * 1.6, 0.1, "sine", bed);
  }
  // A lookahead scheduler rather than the render loop: music has to keep its
  // own clock, and the frame loop stops on menus and hidden tabs.
  setInterval(() => {
    if (ac.state !== "running") return;
    // Browsers throttle timers in the background while the audio clock keeps
    // moving. Skip bars that are already lost instead of creating every missed
    // oscillator in one burst when the tab wakes up.
    if (state.at < ac.currentTime - SCORE.barSeconds) {
      const missed = Math.ceil((ac.currentTime - state.at) / SCORE.barSeconds);
      state.at += missed * SCORE.barSeconds;
      state.bar += missed;
    }
    while (state.at < ac.currentTime + SCORE.lookahead) {
      writeBar(state.at, state.bar++);
      state.at += SCORE.barSeconds;
    }
  }, SCORE.tickMs);
  engine.score = state;
}
function syncAudio() {
  if (!audioEngine) return;
  audioEngine.master.gain.value = settings.master;
  audioEngine.music.gain.value = settings.bgm;
}
/* 메타 UI의 소리. 여태 합성 사각파 3종(confirm·flip·unlock)만 냈고, 50종
   샘플 팩은 전투 쪽만 썼다 — 그래서 팩의 `ui-01`~`ui-05`가 반입 이후 한 번도
   울린 적이 없다. 화면을 넘기고 버튼을 누르는 소리가 게임에서 가장 자주
   들리는 소리인데 그것만 합성음이었다.
   샘플이 있으면 샘플을 쓰고, 없거나 아직 못 받았으면 기존 합성음이 그대로
   받는다 — 조용해지는 경우는 없다. */
const UI_SAMPLE_CUE = {
  confirm: "uiConfirm",
  flip: "uiTap",
  unlock: "uiUnlock",
  fail: "uiFail",
  card: "uiCard",
  screen: "uiScreen",
};
function playSfx(kind = "confirm") {
  if (settings.sfx <= 0) return;
  const cue = UI_SAMPLE_CUE[kind] ?? "uiTap";
  if (typeof playSampleSfx === "function" && playSampleSfx(cue, 1)) return;
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
  const thirdPartySlot =
    typeof hasThirdPartySlot === "function" && hasThirdPartySlot();
  return [
    {
      id: "observer",
      name:
        settings.language === "ko" ? "첫 관측자의 증명" : "OBSERVER’S PROOF",
      text:
        settings.language === "ko"
          ? "1-1 관측 수업을 마치고 파티 슬롯을 하나 해금하세요."
          : "Complete 1-1 observation training and unlock a party slot.",
      done: thirdPartySlot,
      gold: 150,
      ratio: thirdPartySlot ? "1/1 · 파티 슬롯 +1" : "0/1 · 파티 슬롯 +1",
    },
    {
      id: "first",
      name: settings.language === "ko" ? "첫 별" : "FIRST STAR",
      text:
        settings.language === "ko"
          ? "보스를 한 번 처치하세요."
          : "Defeat a boss once.",
      done: progress.clears >= 1,
      gold: 100,
      ratio: Math.min(progress.clears, 1) + "/1",
    },
    {
      id: "riposte",
      name: settings.language === "ko" ? "3연타" : "TRIPLE HIT",
      text:
        settings.language === "ko"
          ? "한 전투에서 3 HIT 콤보를 달성하세요."
          : "Reach a 3 HIT combo in one battle.",
      done: progress.bestCombo >= 3,
      gold: 200,
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
      gold: 400,
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
      gold: 300,
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

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
  /* 음소거는 «전체 음량 0»과 다르다(2026-08-24). 0으로 끌어 두면 다시 켤 때
     얼마였는지가 사라진다. 별도 스위치로 두면 눌러 끄고 눌러 켰을 때 원래
     균형이 그대로 돌아온다. */
  muted: false,
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
  // 별무기 보관함과 장착표(2026-08-24). ownedWeapons 는 보유한 무기 «종류»의
  // 목록(중복 없음), equippedWeapons 는 별지기 id → 무기 id 다. 한 종류를 여러
  // 별지기가 함께 낄 수 있게 두었다 — 전용 무기는 어차피 임자에게만 큰 값이라
  // 공유가 이득을 깨지 않고, 인스턴스 장부를 지우면 저장이 단순해진다.
  ownedWeapons: [],
  equippedWeapons: {},
  freeSummons: 0,
  claimedAchievements: [],
  announcedAchievementIds: null,
  pendingGold: 0,
  pendingRewards: [],
  pendingRewardSerial: 0,
  bestTime: 0,
  bestShots: 99,
  bestCombo: 0,
  /* 조준 교습이 «이미 한 말»의 목록(핸드오프 §2-3·2-4·2-6). 세션이 아니라
     저장 슬롯 단위인 이유는, 이것들이 규칙을 처음 만나는 사람에게 하는
     말이기 때문이다 — 어제 배운 사람에게 오늘 또 「셋을 찍어 봐」라고
     하면 안내가 아니라 잔소리가 된다. 문자열 목록으로 둔 것은 비트를
     하나씩 늘릴 때마다 저장 스키마를 고치지 않기 위해서다. */
  aimHints: [],
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
/* 목록 필드도 같은 이유로 고친다. 숫자만 복구하고 있었는데, 배열 자리에
   객체나 문자열이 들어오면 크래시 없이 «조용히 망가진 상태»로 산다 —
   실측으로 ownedHeroes가 객체, ownedSkins가 null, claimedAchievements가
   문자열인 저장으로도 게임이 서고 화면이 열렸다. 그런데 그 상태에서
   claimedAchievements.includes(id)는 배열 조회가 아니라 «문자열 안에 그
   글자가 있는가»가 되어, 긴 문자열이면 받은 적 없는 보상을 받았다고
   판정할 수 있다. 목록이 아닌 값은 빈 목록으로 되돌린다 — 잃는 것은
   이미 못 읽는 값뿐이다. */
for (const [key, fallback] of [
  ["ownedHeroes", [...STARTER_HERO_IDS]],
  ["ownedSkins", [DEFAULT_METEOR_SKIN]],
  ["claimedAchievements", []],
  ["pendingRewards", []],
  ["aimHints", []],
  ["ownedWeapons", []],
]) {
  if (!Array.isArray(progress[key])) progress[key] = fallback;
}
/* 보유 무기 목록에서 로스터(WEAPONS)에 없는 id 를 걸러낸다 — 저장을 손으로
   고쳤거나 무기를 뺐을 때 undefined 를 읽지 않도록. 목록 필드와 같은 이유다. */
progress.ownedWeapons = [
  ...new Set(progress.ownedWeapons.filter((id) => WEAPONS[id])),
];
/* 장착표는 배열이 아니라 평범한 객체여야 한다(별지기 id → 무기 id). 배열이나
   null 이 들어오면 빈 객체로 되돌리고, 값이 살아 있어도 «보유하지 않은 무기»나
   «로스터에 없는 별지기»를 가리키는 항목은 버린다. */
if (
  typeof progress.equippedWeapons !== "object" ||
  progress.equippedWeapons === null ||
  Array.isArray(progress.equippedWeapons)
)
  progress.equippedWeapons = {};
for (const heroId of Object.keys(progress.equippedWeapons)) {
  const weaponId = progress.equippedWeapons[heroId];
  if (
    !heroes[heroId] ||
    !WEAPONS[weaponId] ||
    !progress.ownedWeapons.includes(weaponId)
  )
    delete progress.equippedWeapons[heroId];
}
/* 보유 목록에 로스터에 없는 id가 섞이면 편성·소환이 그 자리에서 undefined를
   읽는다. 저장을 손으로 고쳤거나 로스터에서 별지기를 뺐을 때 생긴다. */
progress.ownedHeroes = progress.ownedHeroes.filter((id) => heroes[id]);
if (!progress.ownedHeroes.length) progress.ownedHeroes = [...STARTER_HERO_IDS];
const tr = (key) =>
  META_COPY[settings.language]?.[key] ?? META_COPY.ko[key] ?? key;
function saveSettings() {
  appStorage.writeRecord(SETTINGS_STORAGE, settings);
  if (document.documentElement)
    document.documentElement.lang = settings.language;
  syncAudio();
}
/* 저장이 막힌 것을 «한 번만» 알린다. 매번 띄우면 조작할 때마다 배너가
   떠 플레이가 불가능하고, 한 번도 안 알리면 새로고침 전까지 아무도 모른다.
   여기서 부르는 이유 — 이 함수는 실제 플레이 중에만 도므로 toast()가 이미
   서 있다(game-platform.js 는 체인 첫 파일이라 그 안에서는 못 부른다). */
let storageWarned = false;
/* 음소거 한 버튼(2026-08-24, 오너 지시).

   여태 소리를 끄는 길은 설정 화면의 전체 음량 슬라이더뿐이었다 — 전투
   중에는 일시정지를 거쳐야 하고, 슬라이더를 0으로 끌면 다시 켤 때 원래
   값이 사라진다. 한 번 눌러 끄고 한 번 눌러 켠다.

   일시정지 버튼과 같은 이유로 JS가 만든다: HTML을 건드리면 스모크의 문서
   계약이 흔들린다. 다만 그 버튼(game-session.js)과 «같은 파일»에는 두지
   못한다 — session 은 로드 순서 98이고 settings 를 만드는 이 파일은 101이라
   거기서는 첫 refresh() 가 settings 를 못 본다(실제로 스모크가 그렇게
   죽었다). 끄고 켜는 상태의 주인이 여기이므로 자리도 여기가 맞다.

   body 에 붙이고 «타이틀과 전투»에서만 보인다 — 허브·상점·프로필에는 설정
   탭이 바로 옆에 있어 이 버튼이 겹쳐 설 이유가 없다. */
(() => {
  if (!document.body) return;
  const button = document.createElement("button");
  button.type = "button";
  button.id = "muteButton";
  button.className = "mute-button";
  button.innerHTML = '<span aria-hidden="true">\u266a</span>';
  const refresh = () => {
    const off = Boolean(settings.muted);
    button.dataset.muted = off ? "1" : "";
    button.setAttribute("aria-pressed", off ? "true" : "false");
    button.setAttribute("aria-label", off ? "소리 켜기" : "소리 끄기");
    button.title = off ? "소리 켜기" : "소리 끄기";
  };
  button.onclick = () => {
    settings.muted = !settings.muted;
    saveSettings();
    refresh();
    /* 켤 때만 소리를 낸다. 끄는 순간에 소리를 내면 그 소리가 마지막으로
       들리는 것이 되어 «꺼졌다»가 아니라 «눌렸다»로 읽힌다. */
    if (!settings.muted) playSfx?.("confirm");
  };
  refresh();
  document.body.append(button);
  // 설정 화면의 전체 음량 슬라이더가 음소거를 풀 때 표시를 맞춘다.
  window.StellaMute = { refresh };
})();
function saveProgress() {
  const ok = appStorage.writeRecord(PROGRESS_STORAGE, progress);
  if (ok === false && !storageWarned) {
    storageWarned = true;
    toast?.("이 브라우저가 저장을 막고 있습니다 · 진행이 남지 않습니다");
  }
}
function goldBalance() {
  return Math.max(0, Math.floor(Number(progress.gold) || 0));
}
// Reward feedback follows the 연타 promotion pattern: an ordinary line becomes
// a louder, self-dismissing card when something was actually earned, so gold
// and unlocks read as a claim instead of a number quietly changing.
let rewardToastTimer = 0;
function rewardToast(kicker, title, detail = "", { onClick = null } = {}) {
  const outcome = document.querySelector(".overlay:not(.hide) .outcome-cut"),
    host = outcome ?? document.querySelector(".stage") ?? document.body;
  document.querySelector(".reward-toast")?.remove();
  const card = document.createElement(onClick ? "button" : "div");
  if (onClick) card.type = "button";
  card.className =
    "reward-toast" +
    (outcome ? " inline" : "") +
    (onClick ? " actionable" : "");
  card.setAttribute("role", "status");
  card.innerHTML =
    "<small>" +
    kicker +
    "</small><b>" +
    title +
    "</b>" +
    (detail ? "<span>" + detail + "</span>" : "");
  if (outcome) outcome.insertBefore(card, outcome.querySelector("button"));
  else host.append(card);
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
/* 조준 교습 1회성 안내. `aimHintDone`은 묻기만 하고, `markAimHintDone`은
   처음 표시했을 때 한 번 적는다 — 되돌리려면 저장소에서 aimHints를 비운다.

   쓰는 곳: game-combat-physics.js의 drawAimStars(범례·반대편 라벨),
   game-speech.js의 루나 1회성 멘트. */
function aimHintDone(id) {
  return Array.isArray(progress.aimHints) && progress.aimHints.includes(id);
}
function markAimHintDone(id) {
  if (aimHintDone(id)) return false;
  progress.aimHints = [
    ...(Array.isArray(progress.aimHints) ? progress.aimHints : []),
    id,
  ];
  saveProgress();
  return true;
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
/* --- 별무기: 보관·장착·소환 ---------------------------------------------- */
function ownedWeaponIds() {
  const stored = Array.isArray(progress.ownedWeapons)
    ? progress.ownedWeapons
    : [];
  return [...new Set(stored)].filter((id) => Boolean(WEAPONS[id]));
}
function ownsWeapon(id) {
  return ownedWeaponIds().includes(id);
}
// 한 별지기가 «지금» 낀 무기 id. 저장이 손상돼 보유하지 않은 무기를 가리키면
// 낀 것이 없는 것으로 읽는다(전투 배율이 조용히 1이 되도록).
function equippedWeaponId(heroId) {
  const map =
    progress.equippedWeapons && typeof progress.equippedWeapons === "object"
      ? progress.equippedWeapons
      : {};
  const id = map[heroId];
  return WEAPONS[id] && ownsWeapon(id) ? id : null;
}
function equipWeapon(heroId, weaponId) {
  if (!heroes[heroId] || !WEAPONS[weaponId] || !ownsWeapon(weaponId))
    return false;
  if (
    typeof progress.equippedWeapons !== "object" ||
    progress.equippedWeapons === null ||
    Array.isArray(progress.equippedWeapons)
  )
    progress.equippedWeapons = {};
  progress.equippedWeapons[heroId] = weaponId;
  saveProgress();
  return true;
}
function unequipWeapon(heroId) {
  if (progress.equippedWeapons && heroId in progress.equippedWeapons) {
    delete progress.equippedWeapons[heroId];
    saveProgress();
    return true;
  }
  return false;
}
/* 한 별지기의 정산 피해 배율. 전투(게이트 생성·queueUnitAssist·회전칼날)가
   읽는 단 하나의 값이다. 무기가 없으면 mult 1(무변화)이라, 무기를 한 번도
   안 뽑은 저장·봇 시뮬레이션은 예전과 똑같이 돈다. 전용 무기를 임자에게
   끼웠을 때만 matched 가 참이 되어 bonusMult 가 더해진다. */
function weaponStatsFor(heroId) {
  const id = equippedWeaponId(heroId),
    weapon = id ? WEAPONS[id] : null;
  if (!weapon) return { id: null, weapon: null, mult: 1, matched: false };
  const matched = weapon.grade === "exclusive" && weapon.exclusiveTo === heroId;
  const mult = 1 + (weapon.mult || 0) + (matched ? weapon.bonusMult || 0 : 0);
  return { id, weapon, mult, matched };
}
/* 무기 소환. 먼저 등급을 굴리고(전용은 낮은 확률), 그 등급 안에서 고르게
   한 자루를 뽑는다. 이미 가진 무기가 나오면 «중복»으로 값의 절반을 돌려준다
   — 종류 기반 보관함이라 두 자루째는 쓸모가 없기 때문이다. 골드가 모자라면
   아무 것도 하지 않는다. */
function pullGachaWeapon() {
  if (goldBalance() < ECONOMY.weaponCost) return { reason: "gold" };
  const exclusive = Math.random() < WEAPON_EXCLUSIVE_RATE,
    pool = exclusive ? EXCLUSIVE_WEAPON_IDS : COMMON_WEAPON_IDS,
    id = pool[Math.floor(Math.random() * pool.length)],
    dup = ownsWeapon(id);
  progress.gold = goldBalance() - ECONOMY.weaponCost;
  let refund = 0;
  if (dup) {
    refund = Math.round(ECONOMY.weaponCost * 0.5);
    progress.gold = goldBalance() + refund;
  } else {
    progress.ownedWeapons = [...ownedWeaponIds(), id];
  }
  saveProgress();
  return {
    id,
    weapon: WEAPONS[id],
    grade: WEAPONS[id].grade,
    cost: ECONOMY.weaponCost,
    dup,
    refund,
  };
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
  // 음소거는 마스터 게인 하나에서 끝난다 — 곡·효과음·앰비언트가 전부 이
  // 노드를 지나므로 끄는 자리가 하나면 새 소리가 생겨도 새지 않는다.
  audioEngine.master.gain.value = settings.muted ? 0 : settings.master;
  /* 실제 곡(game-bgm.js)이 흐르는 동안은 합성 앰비언트를 눌러 곡과 겹치지
     않게 한다. 곡이 없으면 1이라 앰비언트가 그대로 돌아온다. 곡 볼륨도 같은
     슬라이더를 따라오게 여기서 함께 갱신한다. */
  const duck = typeof bgmSynthDuck === "function" ? bgmSynthDuck() : 1;
  audioEngine.music.gain.value = settings.bgm * duck;
  if (typeof bgmRefreshVolume === "function") bgmRefreshVolume();
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
  /* «첫 관측자의 증명 · 파티 슬롯 +1» 업적은 걷었다(2026-08-23 오너 지시 —
     세 번째 자리는 처음부터 열려 있어 해금할 것이 없다). */
  return [
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

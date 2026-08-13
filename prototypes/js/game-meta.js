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
  if (marked)
    areaAttack(
      "비연 표식 폭발",
      Math.max(9, Math.round(amount * 0.34)),
      "#ef718d",
    );
  toast(weak ? label + " " + amount + " 피해" : "몸체 " + amount + " 피해");
  if (boss.hp <= 0) scheduleWin();
  ball.power = 0;
  if (weak) ball.mark = false;
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
let settings = appStorage.readRecord(SETTINGS_STORAGE, {
  language: "ko",
  master: 0.7,
  bgm: 0.28,
  sfx: 0.65,
});
if (document.documentElement) document.documentElement.lang = settings.language;
let progress = appStorage.readRecord(PROGRESS_STORAGE, {
  clears: 0,
  gold: 0,
  ownedHeroes: [...STARTER_HERO_IDS],
  ownedSkins: [DEFAULT_METEOR_SKIN],
  skin: DEFAULT_METEOR_SKIN,
  freeSummons: 0,
  claimedAchievements: [],
  pendingGold: 0,
  bestTime: 0,
  bestShots: 99,
  bestCombo: 0,
});
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
function grantGold(amount) {
  const reward = Math.max(0, Math.floor(Number(amount) || 0));
  progress.gold = goldBalance() + reward;
  return reward;
}
// Reward feedback follows the 연타 promotion pattern: an ordinary line becomes
// a louder, self-dismissing card when something was actually earned, so gold
// and unlocks read as a claim instead of a number quietly changing.
let rewardToastTimer = 0;
function rewardToast(kicker, title, detail = "") {
  const host = document.querySelector(".stage") ?? document.body;
  document.querySelector(".reward-toast")?.remove();
  const card = document.createElement("div");
  card.className = "reward-toast";
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
  clearTimeout(rewardToastTimer);
  rewardToastTimer = setTimeout(() => {
    card.classList.remove("show");
    setTimeout(() => card.remove(), 320);
  }, 2600);
  playSfx?.("unlock");
}
// Gold is earned but not auto-credited: clears accrue into a pending pool and
// achievements hold one-time rewards.  Both are collected in the 업적 tab, so
// the player always performs the claim.
function pendingGold() {
  return Math.max(0, Math.floor(Number(progress.pendingGold) || 0));
}
function accrueGold(amount) {
  const earned = Math.max(0, Math.floor(Number(amount) || 0));
  progress.pendingGold = pendingGold() + earned;
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
  return (
    claimableAchievements().length +
    (pendingGold() > 0 ? 1 : 0) +
    (typeof attendanceReady === "function" && attendanceReady() ? 1 : 0)
  );
}
function claimAchievement(id) {
  const entry = claimableAchievements().find((a) => a.id === id);
  if (!entry) return null;
  progress.claimedAchievements = [...claimedAchievementIds(), id];
  progress.gold = goldBalance() + entry.gold;
  saveProgress();
  return entry;
}
function claimPendingGold() {
  const amount = pendingGold();
  if (!amount) return 0;
  progress.pendingGold = 0;
  progress.gold = goldBalance() + amount;
  saveProgress();
  return amount;
}
function ownedSkinIds() {
  const stored = Array.isArray(progress.ownedSkins) ? progress.ownedSkins : [];
  return [...new Set([DEFAULT_METEOR_SKIN, ...stored])].filter((id) =>
    METEOR_SKINS.some((skin) => skin.id === id),
  );
}
function equippedSkin() {
  const id = progress.skin;
  return (
    METEOR_SKINS.find(
      (skin) => skin.id === id && ownedSkinIds().includes(id),
    ) ?? METEOR_SKINS[0]
  );
}
function buySkin(id) {
  const skin = METEOR_SKINS.find((entry) => entry.id === id);
  if (!skin) return { reason: "missing" };
  if (ownedSkinIds().includes(id)) return { reason: "owned" };
  if (goldBalance() < ECONOMY.skinCost) return { reason: "gold" };
  progress.gold = goldBalance() - ECONOMY.skinCost;
  progress.ownedSkins = [...ownedSkinIds(), id];
  progress.skin = id;
  saveProgress();
  return { id, cost: ECONOMY.skinCost };
}
function equipSkin(id) {
  if (!ownedSkinIds().includes(id)) return false;
  progress.skin = id;
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
      gold: 150,
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
// `onBack` lets the pause menu borrow this screen without losing the battle
// behind it.  Menu callers keep the default hub return.
function showSettings(onBack) {
  const back = typeof onBack === "function" ? onBack : showMeta;
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
      showSettings(back);
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
    showSettings(back);
  };
  document.querySelector("#settingsBack").onclick = () => {
    playSfx();
    back();
  };
}
function showAchievements() {
  run = false;
  drag = null;
  setScene("menu");
  U.over.className = "overlay archive-scene";
  const list = achievementList(),
    unlocked = list.filter((v) => v.done).length,
    cards = list
      .map((a) => {
        const claimed = isAchievementClaimed(a.id),
          ready = a.done && !claimed;
        return (
          '<article class="achievement-card ' +
          (a.done ? "" : "locked") +
          (ready ? " claimable" : "") +
          '">' +
          // A card that owes the player gold has to say so before it is read.
          (ready ? '<i class="claim-badge card-dot">수령</i>' : "") +
          '<img src="../assets/library/event/achievement-' +
          (a.done ? "unlocked" : "locked") +
          '.png" alt=""><b>' +
          a.name +
          "</b><small>" +
          a.text +
          "</small><em>" +
          a.ratio +
          " · " +
          tr(a.done ? "unlocked" : "locked") +
          '</em><span class="achievement-reward">보상 ' +
          a.gold +
          " 골드</span>" +
          (ready
            ? '<button class="achievement-claim" data-claim="' +
              a.id +
              '">수령하기</button>'
            : '<span class="achievement-claim-state">' +
              (claimed ? "수령 완료" : "조건 미달") +
              "</span>") +
          "</article>"
        );
      })
      .join("");
  const pending = pendingGold(),
    pendingCard =
      '<section class="claim-banner' +
      (pending > 0 ? " ready" : "") +
      '"><div><small>관측 보상함</small><b>' +
      (pending > 0 ? pending + " 골드" : "쌓인 보상 없음") +
      "</b><span>" +
      (pending > 0
        ? "클리어 보상이 여기에 모입니다. 수령해야 사용할 수 있습니다."
        : "스테이지를 클리어하면 보상이 여기에 쌓입니다.") +
      '</span></div><button id="claimPending"' +
      (pending > 0 ? "" : " disabled") +
      ">모두 수령</button></section>";
  U.over.innerHTML =
    '<div class="meta-hub">' +
    metaHeader("ARCHIVE") +
    '<section class="system-panel"><div class="archive-tabs"><button class="archive-tab" id="tabLibrary">도서관</button><button class="archive-tab on" id="tabAchievements">업적</button></div><h2>' +
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
    " HIT</b></div></div>" +
    pendingCard +
    '<div class="meta-section-title"><span>' +
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
  document.querySelector("#tabLibrary").onclick = () => {
    playSfx();
    showLibrary();
  };
  document.querySelector("#claimPending").onclick = (event) => {
    const amount = claimPendingGold();
    if (!amount) return;
    playClaimBurst(event.currentTarget.closest(".claim-banner"), amount, () => {
      rewardToast(
        "관측 보상함",
        "+" + amount + " 골드",
        "보유 " + goldBalance(),
      );
      showAchievements();
    });
  };
  for (const button of document.querySelectorAll("[data-claim]"))
    button.onclick = (event) => {
      const id = button.dataset.claim,
        card = event.currentTarget.closest(".achievement-card"),
        entry = claimAchievement(id);
      if (!entry) return;
      playClaimBurst(card, entry.gold, () => {
        rewardToast(
          "업적 보상 · " + entry.name,
          "+" + entry.gold + " 골드",
          "보유 " + goldBalance(),
        );
        showAchievements();
      });
    };
}
// Profile gathers identity, the record board and the mailbox in one tab.  The
// board is local-only today; Hive would replace the source without changing
// this surface, so nothing here claims a live connection.
const MAILBOX_STORAGE = "stella-ball.mailbox.v1";
function mailboxEntries() {
  const stored = appStorage.readRecord(MAILBOX_STORAGE, { items: [] });
  return Array.isArray(stored.items) ? stored.items : [];
}
function saveMailbox(items) {
  appStorage.writeRecord(MAILBOX_STORAGE, { items });
}
function pushMail(title, body, gold = 0) {
  const items = mailboxEntries();
  items.unshift({
    id: "mail-" + (items.length + 1) + "-" + title,
    title,
    body,
    gold,
    read: false,
  });
  saveMailbox(items.slice(0, 20));
}
function unreadMailCount() {
  return mailboxEntries().filter((m) => !m.read).length;
}
function claimMail(id) {
  const items = mailboxEntries(),
    entry = items.find((m) => m.id === id);
  if (!entry || entry.read) return null;
  entry.read = true;
  if (entry.gold > 0) {
    progress.gold = goldBalance() + entry.gold;
    saveProgress();
  }
  saveMailbox(items);
  return entry;
}
function localLeaderboard() {
  const rows = [
    {
      name: "PLAYER 01",
      you: true,
      clears: progress.clears || 0,
      best: progress.bestTime || 0,
      shots: progress.bestShots < 99 ? progress.bestShots : 0,
    },
  ];
  return rows;
}
// Chest-opening feel: the card squashes and overshoots, the amount lifts off
// it, and a few sparks scatter.  The redraw waits for the animation so the
// number does not change under the player's finger.
function playClaimBurst(card, amount, done) {
  if (!card) return done?.();
  playSfx?.("unlock");
  card.classList.add("claiming");
  card.style.position = card.style.position || "relative";
  const burst = document.createElement("span");
  burst.className = "claim-burst";
  burst.textContent = "+" + amount;
  burst.style.left = "50%";
  burst.style.top = "38%";
  card.append(burst);
  for (let i = 0; i < 6; i++) {
    const spark = document.createElement("i");
    spark.className = "claim-spark";
    const angle = (Math.PI * 2 * i) / 6 + 0.4;
    spark.style.left = "50%";
    spark.style.top = "42%";
    spark.style.setProperty("--sx", Math.round(Math.cos(angle) * 46) + "px");
    spark.style.setProperty("--sy", Math.round(Math.sin(angle) * 40) + "px");
    spark.style.animationDelay = i * 22 + "ms";
    card.append(spark);
  }
  if (navigator.vibrate) navigator.vibrate([10, 26, 14]);
  setTimeout(() => done?.(), 620);
}
/* Profile icon ------------------------------------------------------------
   The observatory ID had no face at all.  Rather than commission portraits,
   the picker offers what the build already owns: the seven rune stones, the
   dawn kit's procedural symbols, and its decor sprites.  Nothing here adds an
   asset file, so this stays inside the deferred-art rule. */
const PROFILE_ICON_STORAGE = "stella-ball.profile-icon";
const PROFILE_ICON_DEFAULT = "star";
const PROFILE_ICON_HEROES = [
  "gaon",
  "biyeon",
  "lumi",
  "haru",
  "sera",
  "taeo",
  "nyx",
];
function profileIconOptions() {
  const kit = window.StellaPixelUI,
    symbol = (kind) => (kit ? kit.icon(kind, 52) : ""),
    decor = (name) => (kit ? kit.sprite(name) : "");
  return [
    { id: "star", name: "별", src: symbol("star") },
    { id: "moon", name: "달", src: symbol("moon") },
    { id: "sun", name: "해", src: symbol("sun") },
    { id: "heart", name: "하트", src: symbol("heart") },
    { id: "rabbit", name: "달토끼", src: decor("rabbitUp") },
    { id: "astro", name: "우주비행사", src: decor("astroIdle") },
    { id: "tele", name: "망원경", src: decor("tele") },
    { id: "compass", name: "나침반", src: decor("compass") },
    { id: "keeper", name: "도색장 오르", src: decor("orr") },
    ...PROFILE_ICON_HEROES.map((id) => ({
      id: "hero-" + id,
      name: heroes[id].s,
      src: runeStone(id),
    })),
  ].filter((option) => option.src);
}
function profileIcon() {
  const list = profileIconOptions(),
    saved = appStorage.readText(PROFILE_ICON_STORAGE) || PROFILE_ICON_DEFAULT;
  return list.find((option) => option.id === saved) || list[0] || null;
}
function profileIconMarkup() {
  const icon = profileIcon();
  return icon
    ? '<img src="' + icon.src + '" alt="' + icon.name + '">'
    : '<i aria-hidden="true">✦</i>';
}
function showProfileIconPicker() {
  document.querySelector("#profileIconPicker")?.remove();
  const current = profileIcon()?.id,
    modal = document.createElement("div");
  modal.id = "profileIconPicker";
  modal.className = "icon-picker";
  modal.innerHTML =
    '<div class="icon-picker-card" role="dialog" aria-label="프로필 아이콘 선택"><div class="icon-picker-head"><div><small>PROFILE ICON</small><h3>아이콘 선택</h3></div><button id="profileIconClose">닫기</button></div><div class="icon-picker-grid">' +
    profileIconOptions()
      .map(
        (option) =>
          '<button class="profile-icon-option' +
          (option.id === current ? " on" : "") +
          '" data-icon="' +
          option.id +
          '" aria-pressed="' +
          (option.id === current) +
          '"><img src="' +
          option.src +
          '" alt=""><span>' +
          option.name +
          "</span></button>",
      )
      .join("") +
    "</div></div>";
  document.body.append(modal);
  const close = () => modal.remove();
  modal.querySelector("#profileIconClose").onclick = () => {
    playSfx();
    close();
  };
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
  for (const button of modal.querySelectorAll("[data-icon]"))
    button.onclick = () => {
      appStorage.writeText(PROFILE_ICON_STORAGE, button.dataset.icon);
      playSfx("confirm");
      close();
      showProfile();
    };
  window.StellaPixelUI?.apply(modal);
}
function showProfile() {
  run = false;
  drag = null;
  setScene("menu");
  const mail = mailboxEntries(),
    unread = unreadMailCount(),
    rows = localLeaderboard()
      .map(
        (r) =>
          '<tr class="' +
          (r.you ? "you" : "") +
          '"><td>1</td><td>' +
          r.name +
          "</td><td>" +
          r.clears +
          "</td><td>" +
          formatRunTime(r.best) +
          "</td><td>" +
          (r.shots ? r.shots + "발" : "—") +
          "</td></tr>",
      )
      .join(""),
    mailCards = mail.length
      ? mail
          .map(
            (m) =>
              '<article class="mail-item' +
              (m.read ? " read" : "") +
              '"><div><b>' +
              m.title +
              "</b><small>" +
              m.body +
              "</small></div>" +
              (m.read
                ? '<span class="mail-state">수령 완료</span>'
                : '<button data-mail="' +
                  m.id +
                  '">' +
                  (m.gold ? "수령 · " + m.gold + " 골드" : "확인") +
                  "</button>") +
              "</article>",
          )
          .join("")
      : '<p class="mail-empty">받은 우편이 없습니다.</p>';
  U.over.className = "overlay profile-scene";
  U.over.innerHTML =
    '<section class="profile-shell"><div class="profile-head"><button id="profileBack">뒤로</button><div class="profile-identity"><span><small>OBSERVATORY ID</small><b>PLAYER 01</b></span><button id="profileIconPick" class="profile-avatar" aria-label="프로필 아이콘 바꾸기">' +
    profileIconMarkup() +
    '<i class="profile-avatar-edit" aria-hidden="true">✎</i></button></div></div><section class="claim-banner attendance' +
    (attendanceReady() ? " ready" : "") +
    '"><div><small>오늘의 관측 출석</small><b>' +
    (attendanceReady()
      ? attendanceStreak() + "일째 · " + attendanceReward() + " 골드"
      : attendanceStreak() + "일째 · 오늘은 받았습니다") +
    "</b><span>" +
    (attendanceReady()
      ? "하루 한 번 받을 수 있습니다. 하루를 건너뛰면 연속이 처음부터 시작합니다."
      : "내일 다시 오면 연속 " +
        (attendanceStreak() + 1) +
        "일째 보상을 받습니다.") +
    '</span></div><button id="claimAttendance"' +
    (attendanceReady() ? "" : " disabled") +
    '>출석 보상 받기</button></section><div class="profile-grid"><section class="profile-panel"><div class="panel-title"><small>PROFILE</small><h2>관측자 기록</h2></div><div class="profile-stats"><div class="profile-stat"><small>되찾은 별</small><b>' +
    (progress.clears || 0) +
    '</b></div><div class="profile-stat"><small>최단 시간</small><b>' +
    formatRunTime(progress.bestTime) +
    '</b></div><div class="profile-stat"><small>최소 발사</small><b>' +
    (progress.bestShots < 99 ? progress.bestShots + "발" : "—") +
    '</b></div><div class="profile-stat"><small>보유 골드</small><b>' +
    goldBalance() +
    '</b></div><div class="profile-stat"><small>별지기</small><b>' +
    ownedHeroIds().length +
    " / " +
    Object.keys(heroes).length +
    '</b></div><div class="profile-stat"><small>도색</small><b>' +
    ownedSkinIds().length +
    " / " +
    METEOR_SKINS.length +
    '</b></div></div><button class="profile-exit" id="profileToTitle">타이틀 화면으로</button></section><section class="profile-panel"><div class="panel-title"><small>LEADERBOARD</small><h2>오늘의 밤하늘 순위</h2></div><table class="rank-table"><thead><tr><th>#</th><th>관측자</th><th>별</th><th>최단</th><th>최소</th></tr></thead><tbody>' +
    rows +
    '</tbody></table><p class="rank-note">현재는 이 브라우저에 저장된 <b>로컬 기록</b>입니다. Hive 리더보드 연동은 준비 중이며, 연동되면 같은 표에 다른 관측자의 기록이 함께 표시됩니다.</p></section><section class="profile-panel mail-panel"><div class="panel-title"><small>MAILBOX</small><h2>우편함' +
    (unread ? ' <i class="claim-badge">' + unread + "</i>" : "") +
    '</h2></div><div class="mail-list">' +
    mailCards +
    "</div></section></div></section>";
  document.querySelector("#profileBack").onclick = () => {
    playSfx();
    showMeta();
  };
  document.querySelector("#profileIconPick").onclick = () => {
    playSfx();
    showProfileIconPicker();
  };
  document.querySelector("#claimAttendance").onclick = (event) => {
    const gold = claimAttendance();
    if (!gold) return;
    playClaimBurst(event.currentTarget.closest(".claim-banner"), gold, () => {
      rewardToast("출석 보상", "+" + gold + " 골드", "보유 " + goldBalance());
      showProfile();
    });
  };
  document.querySelector("#profileToTitle").onclick = () => {
    playSfx();
    showConfirm({
      kicker: "TITLE",
      title: "타이틀 화면으로 나갈까요?",
      body: "진행한 기록은 저장되어 있습니다. 타이틀에서 다시 이어서 관측할 수 있습니다.",
      confirmLabel: "타이틀로 나가기",
      onConfirm: () => showTitle(),
      onCancel: () => showProfile(),
    });
  };
  for (const button of document.querySelectorAll("[data-mail]"))
    button.onclick = () => {
      const entry = claimMail(button.dataset.mail);
      if (!entry) return;
      if (entry.gold > 0)
        rewardToast("우편 수령", "+" + entry.gold + " 골드", entry.title);
      else playSfx("confirm");
      showProfile();
    };
}
// The dawn UI kit draws its decor sprites procedurally, so a portrait costs no
// asset file.  Falls back to the caller's glyph when the kit is absent, which
// is what a direct local-file launch with the kit script blocked would see.
function pixelSpriteMarkup(name, fallback, alt = "") {
  const url = window.StellaPixelUI?.sprite(name);
  return url ? '<img src="' + url + '" alt="' + alt + '">' : fallback;
}
// The shopkeeper reacts to what the player can afford, so the tab has a voice
// without needing a new screen or a dialogue system.
const SHOP_KEEPER_LINES = {
  broke: [
    "골드가 모자라네. 별 하나 더 되찾아 오면 그때 얘기하지.",
    "빈손으로는 색을 못 내. 보상함부터 비우고 오게.",
  ],
  ready: [
    "유성은 결국 자네 손에서 끝나. 색 정도는 마음에 들어야지.",
    "밤하늘에 그을 선인데, 아무 색이나 쓸 텐가?",
  ],
  collector: [
    "제법 모았군. 남은 건 자네가 어떤 밤을 좋아하느냐뿐이야.",
    "이 정도면 관측소에서 제일 화려한 유성일세.",
  ],
};
function shopKeeperLine(ownedCount, gold) {
  const pool =
    ownedCount >= METEOR_SKINS.length
      ? SHOP_KEEPER_LINES.collector
      : gold < ECONOMY.skinCost
        ? SHOP_KEEPER_LINES.broke
        : SHOP_KEEPER_LINES.ready;
  return pool[(progress.clears || 0) % pool.length];
}
function showShop() {
  run = false;
  drag = null;
  setScene("menu");
  const owned = ownedSkinIds(),
    current = equippedSkin().id,
    gold = goldBalance();
  const cards = METEOR_SKINS.map((skin) => {
    const isOwned = owned.includes(skin.id),
      isOn = skin.id === current,
      afford = gold >= ECONOMY.skinCost;
    const action = isOn
      ? '<span class="shop-state on">장착 중</span>'
      : isOwned
        ? '<button class="shop-buy equip" data-equip="' +
          skin.id +
          '">장착하기</button>'
        : '<button class="shop-buy' +
          (afford ? "" : " short") +
          '" data-buy="' +
          skin.id +
          '"' +
          (afford ? "" : " disabled") +
          ">" +
          (afford ? "구매하기" : "골드 부족") +
          "</button>";
    return (
      '<article class="shop-card' +
      (isOn ? " active" : "") +
      '"><div class="shop-orb" style="--skin-glow:' +
      skin.moving +
      ";--skin-core:" +
      skin.core +
      ";--skin-hue:" +
      skin.hue +
      'deg"><img src="' +
      staticArt.orb +
      '" alt=""></div><div class="shop-copy"><b>' +
      skin.name +
      "</b><small>" +
      skin.note +
      '</small><span class="shop-price">' +
      (skin.id === DEFAULT_METEOR_SKIN
        ? "기본 지급"
        : isOwned
          ? "구매 완료 · " + ECONOMY.skinCost + " 골드"
          : ECONOMY.skinCost + " 골드") +
      "</span></div>" +
      action +
      "</article>"
    );
  }).join("");
  // Every owned starkeeper gets a row of colours.  The swatch is the hero's
  // own portrait under the same hue rotation the arena will use, so what the
  // player buys is exactly what they see here.
  const heroSkinRows = ownedHeroIds()
    .map((id) => {
      const h = heroes[id],
        chips = HERO_SKINS.map((skin) => {
          const has = ownsHeroSkin(id, skin.id),
            on = equippedHeroSkinId(id) === skin.id;
          return (
            '<button class="hero-skin-chip' +
            (on ? " on" : "") +
            (has ? "" : " buy") +
            '" data-hero-skin="' +
            id +
            ":" +
            skin.id +
            '" title="' +
            skin.note +
            '"><span class="hero-skin-swatch" data-skin-portrait="' +
            id +
            '" style="filter:' +
            heroSkinPreviewFilter(skin) +
            '"></span><b>' +
            skin.name +
            "</b><small>" +
            (on
              ? "장착 중"
              : has
                ? "장착하기"
                : ECONOMY.heroSkinCost + " 골드") +
            "</small></button>"
          );
        }).join("");
      return (
        '<article class="hero-skin-row" style="--unit:' +
        h.col +
        '"><div class="hero-skin-name"><b>' +
        h.s +
        "</b><small>" +
        h.e +
        '</small></div><div class="hero-skin-chips">' +
        chips +
        "</div></article>"
      );
    })
    .join("");
  U.over.className = "overlay shop-scene";
  U.over.innerHTML =
    '<section class="shop-shell"><div class="shop-head"><button id="shopBack">뒤로</button><span><small>관측소 상점</small><b>보유 골드 ' +
    gold +
    '</b></span></div><div class="shop-keeper"><span class="shop-keeper-art">' +
    pixelSpriteMarkup("orr", "☄", "도색장 오르") +
    "</span><div><small>도색장 · 오르</small><p>" +
    shopKeeperLine(owned.length, gold) +
    '</p></div></div><div class="shop-intro"><small>METEOR SKINS</small><h2>유성 도색</h2><p>겉모습만 바뀝니다. 피해·속도·물리에는 영향이 없습니다.</p></div><div class="shop-grid">' +
    cards +
    '</div><div class="shop-intro"><small>STARKEEPER SKINS</small><h2>별지기 도색</h2><p>보유한 별지기의 색만 바뀝니다. 전장 판정색과 이름표는 그대로입니다.</p></div><div class="hero-skin-list">' +
    heroSkinRows +
    "</div></section>";
  for (const slot of document.querySelectorAll("[data-skin-portrait]"))
    setPortrait(slot, heroes[slot.dataset.skinPortrait], 44);
  for (const button of document.querySelectorAll("[data-hero-skin]"))
    button.onclick = () => {
      const [heroId, skinId] = button.dataset.heroSkin.split(":");
      if (ownsHeroSkin(heroId, skinId)) {
        equipHeroSkin(heroId, skinId);
        playSfx("confirm");
        return showShop();
      }
      const result = buyHeroSkin(heroId, skinId);
      if (result.reason === "gold") {
        playSfx("fail");
        toast("골드가 부족합니다. 스테이지를 클리어해 보세요.");
        return;
      }
      playSfx("unlock");
      rewardToast(
        "별지기 도색",
        heroes[heroId].s + " · " + HERO_SKINS.find((s) => s.id === skinId).name,
        "보유 " + goldBalance(),
      );
      showShop();
    };
  document.querySelector("#shopBack").onclick = () => {
    playSfx();
    showMeta();
  };
  for (const button of document.querySelectorAll("[data-equip]"))
    button.onclick = () => {
      equipSkin(button.dataset.equip);
      playSfx("confirm");
      showShop();
    };
  for (const button of document.querySelectorAll("[data-buy]"))
    button.onclick = () => {
      const result = buySkin(button.dataset.buy);
      if (result.reason === "gold") {
        playSfx("fail");
        toast("골드가 부족합니다. 스테이지를 클리어해 보세요.");
        return;
      }
      playSfx("unlock");
      const skin = METEOR_SKINS.find((entry) => entry.id === result.id);
      rewardToast("유성 도색 획득", skin.name, "-" + result.cost + " 골드");
      showShop();
    };
}
function showGacha() {
  run = false;
  drag = null;
  setScene("menu");
  const owned = ownedHeroIds(),
    pool = GACHA_HERO_IDS.filter((id) => !owned.includes(id)),
    canAfford = hasFreeSummon() || goldBalance() >= ECONOMY.gachaCost,
    poolCards = GACHA_HERO_IDS.map((id) => {
      const h = heroes[id],
        unlocked = owned.includes(id);
      return (
        '<article class="gacha-pool-unit ' +
        (unlocked ? "unlocked" : "") +
        '"><span class="portrait" data-gacha-hero="' +
        id +
        '"></span><b>' +
        h.s +
        "</b><small>" +
        (unlocked ? "해금 완료" : "별빛 속에서 대기") +
        "</small></article>"
      );
    }).join("");
  U.over.className = "overlay gacha-scene";
  U.over.innerHTML =
    '<section class="gacha-shell"><div class="gacha-header"><button id="gachaBack">뒤로</button><span><small>별빛 보관함</small><b>' +
    (hasFreeSummon() ? "무료 소환권 1장" : "보유 골드 " + goldBalance()) +
    '</b></span></div><div class="gacha-ritual"><div class="gacha-orbit" aria-hidden="true"><i>✦</i><i>✧</i><i>✦</i></div><div class="gacha-reveal" id="gachaReveal"><span>✦</span><small>아직 만나지 못한 별지기를<br>관측하세요</small></div></div><div class="gacha-copy"><small>STARKEEPER CALL</small><h2>별빛 소환</h2><p>100 골드로 아직 만나지 못한 별지기 한 명을 확정으로 맞이합니다.</p></div><section class="gacha-pool"><div class="gacha-pool-heading"><span>소환 후보</span><b>' +
    pool.length +
    " / " +
    GACHA_HERO_IDS.length +
    '</b></div><div class="gacha-pool-grid">' +
    poolCards +
    '</div></section><button class="gacha-draw ' +
    (!pool.length ? "complete" : !canAfford ? "insufficient" : "") +
    '" id="gachaDraw"' +
    (!pool.length ? " disabled" : "") +
    ">" +
    (!pool.length
      ? "모든 별지기를 만났어요"
      : canAfford
        ? hasFreeSummon()
          ? "무료로 소환하기"
          : "별빛 소환 · " + ECONOMY.gachaCost + " 골드"
        : "골드 부족 · " + ECONOMY.gachaCost + " 골드 필요") +
    "</button></section>";
  document.querySelectorAll("[data-gacha-hero]").forEach((portrait) => {
    setPortrait(portrait, heroes[portrait.dataset.gachaHero], 46);
  });
  document.querySelector("#gachaBack").onclick = () => {
    playSfx();
    showMeta();
  };
  document.querySelector("#gachaDraw").onclick = () => {
    const result = pullGachaHero();
    if (result.reason === "gold") {
      playSfx("fail");
      toast("골드가 부족합니다. 스테이지를 클리어해 보세요.");
      return;
    }
    if (result.reason === "complete") return;
    playSfx("unlock");
    const reveal = document.querySelector("#gachaReveal"),
      drawButton = document.querySelector("#gachaDraw");
    reveal.classList.add("rolling");
    drawButton.disabled = true;
    setTimeout(() => {
      if (!document.body.contains(reveal)) return;
      const h = heroes[result.id];
      reveal.className = "gacha-reveal revealed";
      reveal.innerHTML =
        '<span class="portrait" id="gachaHeroReveal"></span><small>새 별지기 해금</small><b>' +
        h.s +
        " · " +
        h.e +
        "</b>";
      setPortrait(document.querySelector("#gachaHeroReveal"), h, 96);
      drawButton.textContent = "소환 목록으로 돌아가기";
      drawButton.disabled = false;
      drawButton.onclick = () => showGacha();
    }, 920);
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
// Forward the resting point: dropping the argument here is what silently
// pinned every shot back to the launch stone while the in-game copy kept
// promising "다음 샷은 멈춘 자리에서".
startShot = function (restingPoint = null) {
  originalStartShot(restingPoint);
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
  impact(false);
  toast("공명 범퍼 · 운동량 상승");
  sync();
};
// Support characters use the full frame centre as their anchor.  The earlier
// sprite baseline was tuned for the boss and made small hero frames look cut.
// Replace the RAW renderer, not drawFrame itself: the drawFrame wrapper in
// game-core-render.js applies the equipped hero-skin hue filter around this,
// so overriding the wrapper silently dropped bought skins in battle.
drawFrameRaw = function (
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
// One list drives both the full map screen and the hub's inline map, so a
// stage unlock never has to be edited in two places.
// A campaign node counts as cleared once the run total has reached its index.
// 1-1 is the lesson, so it reads cleared from the onboarding flag instead.
// Progression is still one counter: clearing the campaign stage at index i
// opens index i+1.  Nothing new has to be saved for players already part way
// through, which is why the world rewrite needs no migration.
function isStageCleared(entry) {
  if (entry.onboarding) return hasOnboardingClear();
  if (entry.locked) return false;
  return (progress.clears || 0) > (entry.campaignIndex ?? 1);
}
// Which constellation the hub map is showing.  It follows the selected stage
// until the player pages to another world by hand.
let hubWorldId = null;
function activeWorld() {
  const chosen = WORLDS.find((world) => world.id === hubWorldId);
  if (chosen) return chosen;
  return worldOf(currentStage()) ?? WORLDS[0];
}
function setHubWorld(id) {
  hubWorldId = id;
  hubMapSelection = null;
}
function isWorldUnlocked(world) {
  const first = worldStages(world.id)[0];
  return !first || (progress.clears || 0) >= campaignIndexOf(first);
}
// A world's stars are its stages, positioned by the real constellation figure.
function constellationMapStages(worldId = activeWorld().id) {
  const world = WORLDS.find((entry) => entry.id === worldId) ?? WORLDS[0];
  return worldStages(world.id).map((stage, index) => {
    const campaignIndex = campaignIndexOf(stage),
      position = world.shape[index] ?? [50, 50];
    return {
      id: stage.id,
      name: stage.name,
      star: stage.star,
      note: stage.tutorial
        ? "온보딩 튜토리얼"
        : stageGimmickLabels(stage).join(" · ") || "별자리 전술",
      mark: stage.tutorial ? "✦" : "★",
      stage: stages.indexOf(stage),
      campaignIndex,
      onboarding: Boolean(stage.tutorial),
      locked: (progress.clears || 0) < campaignIndex,
      worldId: world.id,
      x: position[0],
      y: position[1],
    };
  });
}
// The figure drawn behind the nodes: solid up to the furthest star the player
// has opened, dashed beyond it.
function constellationRoute(entries) {
  const open = entries.filter((entry) => !entry.locked).length;
  const path = (from, to) =>
    entries
      .slice(from, to)
      .map(
        (entry, index) =>
          (index === 0 ? "M" : "L") +
          entry.x.toFixed(1) +
          " " +
          entry.y.toFixed(1),
      )
      .join(" ");
  const solid = open > 1 ? '<path d="' + path(0, open) + '"/>' : "";
  const future =
    open < entries.length
      ? '<path class="future" d="' + path(Math.max(0, open - 1)) + '"/>'
      : "";
  return solid + future;
}
function showStageSelect() {
  run = false;
  drag = null;
  setScene("meta");
  const mapStages = constellationMapStages();
  const nodes = mapStages
    .map(
      (stage, index) =>
        '<button class="constellation-node' +
        (stage.locked ? " locked" : "") +
        (stage.onboarding ? " active" : "") +
        '" style="left:' +
        stage.x +
        "%;top:" +
        stage.y +
        '%" ' +
        (stage.locked
          ? "disabled"
          : stage.onboarding
            ? 'data-onboarding="true"'
            : 'data-stage="' + stage.stage + '"') +
        '><span class="stage-star">' +
        stage.mark +
        '</span><span class="stage-copy"><small>' +
        (stage.star ? stage.star.bayer : "STAGE " + stage.id) +
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
    '<div class="constellation-map-shell"><div class="constellation-map-head"><div><div class="tag">' +
    activeWorld().bayer +
    "</div><h2>" +
    activeWorld().name +
    "</h2></div><p>" +
    activeWorld().lore +
    '</p></div><section class="constellation-map" aria-label="스테이지 별자리 지도"><svg class="constellation-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
    constellationRoute(mapStages) +
    "</svg>" +
    nodes +
    '</section><footer class="constellation-map-foot"><button class="constellation-training" id="replayOnboarding">튜토리얼 다시보기</button><button class="constellation-training" id="enterTraining">무한 훈련장</button><span>현재 플레이 가능: 1-1 · 1-2</span><button id="stageSelectBack">뒤로</button></footer></div>';
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
  // The training table sits outside the campaign order, so no map node points
  // at it and nothing else in the runtime sets its stage index.  Without this
  // button it is unreachable.
  document.querySelector("#enterTraining").onclick = () => {
    playSfx();
    stageIndex = stages.findIndex((stage) => stage.training);
    primeCombatTextures();
    showRoster();
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
  // The hub now carries the constellation map, so backing out of the party
  // step returns there instead of opening the standalone map screen.
  document.querySelector("#backMeta").onclick = showMeta;
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
    avatar =
      profileIconMarkup() ||
      (selected[0] ? '<img src="' + runeStone(selected[0]) + '" alt="">' : "◆"),
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
    stageArtFor().tile +
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

/* Starkeeper skins ---------------------------------------------------------
   Cosmetic only, and deliberately per hero: buying a colour for 가온 does not
   give it to 비연.  Ownership is a flat "hero:skin" list so the save stays a
   plain array. */
function ownedHeroSkinKeys() {
  const stored = Array.isArray(progress.heroSkins) ? progress.heroSkins : [];
  return stored.filter((key) => typeof key === "string");
}
function heroSkinKey(heroId, skinId) {
  return heroId + ":" + skinId;
}
function ownsHeroSkin(heroId, skinId) {
  return (
    skinId === DEFAULT_HERO_SKIN ||
    ownedHeroSkinKeys().includes(heroSkinKey(heroId, skinId))
  );
}
function equippedHeroSkinId(heroId) {
  const worn = progress.wornHeroSkins?.[heroId];
  return worn && ownsHeroSkin(heroId, worn) ? worn : DEFAULT_HERO_SKIN;
}
function equippedHeroSkin(heroId) {
  return (
    HERO_SKINS.find((skin) => skin.id === equippedHeroSkinId(heroId)) ??
    HERO_SKINS[0]
  );
}
function heroSkinPreviewFilter(skin) {
  return skin?.hue
    ? "hue-rotate(" + skin.hue + "deg) saturate(" + (skin.sat ?? 1) + ")"
    : "none";
}
function heroSkinFilter(heroId) {
  const skin = heroId ? equippedHeroSkin(heroId) : null;
  if (!skin || !skin.hue) return "none";
  return "hue-rotate(" + skin.hue + "deg) saturate(" + (skin.sat ?? 1) + ")";
}
function buyHeroSkin(heroId, skinId) {
  if (!heroes[heroId] || !HERO_SKINS.some((skin) => skin.id === skinId))
    return { reason: "missing" };
  if (ownsHeroSkin(heroId, skinId)) return { reason: "owned" };
  if (goldBalance() < ECONOMY.heroSkinCost) return { reason: "gold" };
  progress.gold = goldBalance() - ECONOMY.heroSkinCost;
  progress.heroSkins = [...ownedHeroSkinKeys(), heroSkinKey(heroId, skinId)];
  progress.wornHeroSkins = {
    ...(progress.wornHeroSkins ?? {}),
    [heroId]: skinId,
  };
  saveProgress();
  return { heroId, skinId, cost: ECONOMY.heroSkinCost };
}
function equipHeroSkin(heroId, skinId) {
  if (!ownsHeroSkin(heroId, skinId)) return false;
  progress.wornHeroSkins = {
    ...(progress.wornHeroSkins ?? {}),
    [heroId]: skinId,
  };
  saveProgress();
  return true;
}

/* Attendance ---------------------------------------------------------------
   One claim per local calendar day.  The streak resets when a day is missed,
   which is the only reason the previous day's key is stored at all. */
const ATTENDANCE_STORAGE = "stella-ball.attendance";
const ATTENDANCE_GOLD = [60, 70, 80, 90, 110, 140, 220];
function dayKey(date = new Date()) {
  return (
    date.getFullYear() +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0")
  );
}
function attendanceState() {
  return appStorage.readRecord(ATTENDANCE_STORAGE, {
    last: "",
    prev: "",
    streak: 0,
  });
}
function attendanceReady() {
  return attendanceState().last !== dayKey();
}
function attendanceStreak() {
  const state = attendanceState();
  if (!attendanceReady()) return state.streak || 1;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return state.last === dayKey(yesterday) ? (state.streak || 0) + 1 : 1;
}
function attendanceReward(streak = attendanceStreak()) {
  return ATTENDANCE_GOLD[Math.min(ATTENDANCE_GOLD.length, streak) - 1];
}
function claimAttendance() {
  if (!attendanceReady()) return 0;
  const streak = attendanceStreak(),
    gold = attendanceReward(streak),
    state = attendanceState();
  appStorage.writeRecord(ATTENDANCE_STORAGE, {
    last: dayKey(),
    prev: state.last,
    streak,
  });
  progress.gold = goldBalance() + gold;
  saveProgress();
  return gold;
}

/* Library ------------------------------------------------------------------
   The record shelf: which starkeepers the observatory holds, and the exact
   conditions that move the constellation multiplier.  The multiplier table is
   built from the same numbers the combat code uses, not retyped, so it cannot
   quietly go stale. */
const BLAZE_RULES = [
  { label: "유성이 보스를 직격", gain: "+1.0" },
  { label: "별지기가 보스를 직격", gain: "+0.5" },
  { label: "유성이 반사 벽에 튕김", gain: "+0.2" },
  { label: "파티 전원이 깨어남", gain: "+3.0" },
  { label: "흐린 발판을 지나감", gain: "−0.5", down: true },
];
function showLibrary() {
  run = false;
  drag = null;
  setScene("menu");
  const owned = ownedHeroIds(),
    cards = Object.entries(heroes)
      .map(([id, h]) => {
        const has = owned.includes(id),
          skin = equippedHeroSkin(id);
        return (
          '<article class="codex-card' +
          (has ? "" : " locked") +
          '" style="--unit:' +
          h.col +
          '"><span class="codex-portrait" data-codex="' +
          id +
          '"></span><div class="codex-copy"><small>' +
          (has ? h.e : "미보유") +
          "</small><b>" +
          h.n +
          "</b><p>" +
          h.d +
          '</p><em class="codex-lore">「' +
          h.lore +
          '」</em></div><span class="codex-skin">' +
          (has ? skin.name : "—") +
          "</span></article>"
        );
      })
      .join("");
  const blazeRows = BLAZE_RULES.map(
    (rule) =>
      '<tr class="' +
      (rule.down ? "down" : "") +
      '"><td>' +
      rule.label +
      "</td><td>" +
      rule.gain +
      "</td></tr>",
  ).join("");
  U.over.className = "overlay archive-scene library-scene";
  U.over.innerHTML =
    '<div class="meta-hub">' +
    metaHeader("LIBRARY") +
    '<section class="system-panel"><div class="archive-tabs"><button class="archive-tab on" id="tabLibrary">도서관</button><button class="archive-tab" id="tabAchievements">업적</button></div><h2>관측 도서관</h2><p>관측소가 확보한 별지기와, 점수 배율이 움직이는 조건입니다.</p><div class="codex-split"><div class="codex-list">' +
    cards +
    '</div><aside class="codex-side"><div class="panel-title"><small>CONSTELLATION</small><h3>점수 배율 조건</h3></div><table class="codex-table"><thead><tr><th>조건</th><th>배율</th></tr></thead><tbody>' +
    blazeRows +
    '</tbody></table><p class="codex-note">배율은 한 발사 안에서만 쌓이고, 최대 ×9.9까지 오릅니다. 1.0 아래로는 내려가지 않습니다.</p></aside></div><div class="settings-actions"><span></span><button id="libraryBack">' +
    tr("back") +
    "</button></div></section></div>";
  for (const slot of document.querySelectorAll("[data-codex]"))
    setPortrait(slot, heroes[slot.dataset.codex], 56);
  document.querySelector("#libraryBack").onclick = () => {
    playSfx();
    showMeta();
  };
  document.querySelector("#tabAchievements").onclick = () => {
    playSfx();
    showAchievements();
  };
  window.StellaPixelUI?.apply(U.over);
}

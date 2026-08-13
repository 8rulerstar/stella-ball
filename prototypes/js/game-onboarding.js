// Canonical story layer — presentation only; no physics or balance state is changed here.
const STORY_INTRO_STORAGE = "prism-breakers.story-intro.v1";
const STORY_CONSTELLATION_TOOLTIP =
  "별지기들이 멈춘 자리가 별자리를 이룹니다. 크게, 대담하게 그릴수록 강해집니다.";
const ONBOARDING_STORAGE = "stella-ball.onboarding.v1";
const ONBOARDING_CLEAR_STORAGE = "stella-ball.onboarding-clear.v1";
const PARTY_SLOT_STORAGE = "stella-ball.party-slots.v1";
let constellationReveal = null;
function markStoryIntroSeen() {
  appStorage.writeText(STORY_INTRO_STORAGE, "1");
}
function hasSeenStoryIntro() {
  return appStorage.readText(STORY_INTRO_STORAGE) === "1";
}
function markOnboardingSeen() {
  appStorage.writeText(ONBOARDING_STORAGE, "1");
}
function hasSeenOnboarding() {
  return appStorage.readText(ONBOARDING_STORAGE) === "1";
}
function hasOnboardingClear() {
  return appStorage.readText(ONBOARDING_CLEAR_STORAGE) === "1";
}
function hasThirdPartySlot() {
  return appStorage.readText(PARTY_SLOT_STORAGE) === "3";
}
function partySlotCount() {
  // The training table is the prototype bench and seats a fourth starkeeper so
  // the figure has five points once the meteor joins.  Campaign parties still
  // cap at the three the story unlocks.
  if (currentStage()?.training)
    return Math.min(4, Math.max(1, ownedHeroIds().length));
  return hasThirdPartySlot() ? 3 : 2;
}
function unlockThirdPartySlot() {
  appStorage.writeText(PARTY_SLOT_STORAGE, "3");
}
let onboarding = null;
function isOnboardingInputLocked() {
  return Boolean(onboarding && onboarding.panelVisible !== false);
}
function isOnboardingSessionActive() {
  return Boolean(onboarding);
}
// Lessons 1-5 teach against an immortal colossus.  Lesson 6 is the real kill,
// so the battle setup asks this before it decides the boss pool.
const ONBOARDING_FINAL_PHASE = 3;
function isOnboardingFinalLesson() {
  return Boolean(onboarding && onboarding.phase === ONBOARDING_FINAL_PHASE);
}
const onboardingLayouts = [
  {
    party: [],
    slots: [
      [360, 430],
      [360, 340],
      [360, 480],
    ],
  },
  {
    party: ["biyeon"],
    slots: [
      [360, 405],
      [360, 340],
      [360, 480],
    ],
  },
  {
    party: ["biyeon", "ria"],
    slots: [
      [210, 350],
      [360, 430],
      [360, 480],
    ],
  },
  {
    party: ["biyeon", "ria"],
    slots: [
      [474, 350],
      [246, 442],
      [360, 480],
    ],
  },
];
function setOnboardingPhase(phase, first = false) {
  const layout = onboardingLayouts[phase];
  if (!onboarding) return;
  stageIndex = 0;
  stages[0].slots = layout.slots.map((point) => [...point]);
  selected = [...layout.party];
  deployed = [...layout.party];
  // The closing lesson hands the table straight to the player, so its card is
  // never shown and combat input stays unlocked from the first frame.
  const finalLesson = phase === ONBOARDING_FINAL_PHASE;
  onboarding = {
    ...onboarding,
    phase,
    dialogue: 0,
    contacts: new Set(),
    attempts: 0,
    bossHit: false,
    bladeHit: false,
    launched: finalLesson,
    settled: false,
    transitioning: false,
    panelVisible: !finalLesson,
  };
  if (first || !battle) setupBattle();
  else setupBattle();
  msg = [
    "도우미 루나 · 유성을 보스에게 곧장 보내 보세요.",
    "도우미 루나 · 미리내를 굴려, 멈춘 자리의 거리 저격을 확인하세요.",
    "도우미 루나 · 윤슬을 빠르게 굴려 회전 칼날로 보스를 스쳐 보세요.",
    "실전 · 이제 거상은 쓰러집니다. 유성은 무제한이니 직접 무너뜨리세요.",
  ][phase];
  sync();
  renderOnboarding();
}
function beginOnboardingPractice() {
  if (!onboarding) return;
  onboarding.panelVisible = false;
  onboarding.launched = true;
  drag = null;
  renderOnboarding();
}
function continueOnboarding(action) {
  if (!onboarding) return;
  playSfx?.("confirm");
  if (action === "add-biyeon") return setOnboardingPhase(1);
  if (action === "add-pair") return setOnboardingPhase(2);
  if (action === "final-battle")
    return setOnboardingPhase(ONBOARDING_FINAL_PHASE);
  if (action === "practice") return beginOnboardingPractice();
  if (action === "complete") return completeOnboarding();
}
function staggerOnboardingCopy(text) {
  return text
    .split(" ")
    .map(
      (word, index) =>
        '<span class="onboarding-word" style="--word:' +
        index +
        '">' +
        word +
        "</span>",
    )
    .join(" ");
}
function renderOnboarding() {
  document.querySelector(".onboarding-card")?.remove();
  document.body.classList.toggle("onboarding-active", Boolean(onboarding));
  document.body.classList.toggle(
    "onboarding-locked",
    isOnboardingInputLocked(),
  );
  const dock = document.querySelector("#onboardingDock");
  if (!onboarding || onboarding.panelVisible === false) {
    dock?.setAttribute("aria-hidden", "true");
    return;
  }
  drag = null;
  dock?.setAttribute("aria-hidden", "false");
  const step = onboarding.phase,
    dialogue = onboarding.dialogue ?? 0;
  // Six cards, and every one of them waits for the player's button.  Gameplay
  // events only record what happened; they never swap the card being read.
  const retried = (onboarding.attempts ?? 0) >= 2;
  const lessons = [
    [
      {
        n: 1,
        title: "안녕하세요, 관측자님. 루나예요.",
        body: "화면 아래 가운데의 작은 빛이 유성이에요. 마우스로 잡고 아래로 끌었다가 놓으면, 당긴 방향의 반대인 위쪽으로 날아갑니다. 저 공허 거상에게 곧장 보내 보세요.",
        button: "유성 발사하기",
        action: "practice",
      },
      {
        n: 2,
        title: onboarding.bossHit ? "직격! 잘했어요." : "빗나갔네요. 괜찮아요.",
        body: onboarding.bossHit
          ? "빛나는 약점이 아니어도 거상은 피해를 받아요. 유성 자체가 무기예요. 하지만 훨씬 큰 공격은 잠든 별지기를 깨울 때 나옵니다."
          : "각도만 조금 바꾸면 돼요. 아래로 길게 끌수록 세게 날아갑니다. 한 번 더 해볼까요?",
        button: onboarding.bossHit
          ? "다음 · 미리내 만나기"
          : retried
            ? "괜찮아요, 다음으로"
            : "다시 시도",
        action: onboarding.bossHit || retried ? "add-biyeon" : "practice",
      },
    ],
    [
      {
        n: 3,
        title: "첫 별지기, 미리내예요.",
        body: "점선 끝의 붉은 원 안에 미리내가 잠들어 있어요. 유성을 미리내에게 부딪히면 둘 다 굴러갑니다. 모든 움직임이 멈추면 미리내가 그 자리에서 거상을 저격해요. 멀리 멈출수록 강합니다.",
        button: "미리내에게 발사하기",
        action: "practice",
      },
      {
        n: 4,
        title: onboarding.contacts.has("biyeon")
          ? "미리내가 깨어나 저격했어요."
          : "미리내에게 닿지 않았어요.",
        body: onboarding.contacts.has("biyeon")
          ? "이게 이 게임의 핵심이에요 — 부딪혀 깨우고, 멈추면 공격한다. 다음은 반대예요. 멈춘 뒤가 아니라 굴러가는 동안 공격하는 별지기를 만나 볼게요."
          : "유성을 미리내 쪽으로 조금 더 정확히 보내 보세요. 살짝만 스쳐도 깨어납니다.",
        button: onboarding.contacts.has("biyeon")
          ? "다음 · 윤슬 만나기"
          : retried
            ? "괜찮아요, 다음으로"
            : "다시 시도",
        action:
          onboarding.contacts.has("biyeon") || retried
            ? "add-pair"
            : "practice",
      },
    ],
    [
      {
        n: 5,
        title: "두 번째 별지기, 윤슬이에요.",
        body: "윤슬은 멈춘 뒤에 공격하지 않아요. 굴러가는 동안 거상을 그대로 관통하며 쌍칼을 돌립니다. 빠를수록 피해가 커져요. 윤슬을 세게 밀어 거상을 뚫고 지나가게 해보세요.",
        button: "윤슬을 강하게 밀기",
        action: "practice",
      },
      {
        n: 6,
        title: onboarding.bladeHit
          ? "회전 칼날이 적중했어요!"
          : "칼날이 거상까지 닿지 않았어요.",
        body: onboarding.bladeHit
          ? "미리내는 멈출 자리를 설계하고, 윤슬은 지나갈 길을 설계합니다. 이제 배운 걸 전부 써 볼 차례예요. 거상은 더 이상 불멸이 아닙니다. 유성은 무제한이니 직접 무너뜨리세요."
          : "윤슬을 더 세게, 거상 쪽으로 밀어야 해요. 다시 해볼까요?",
        button: onboarding.bladeHit
          ? "직접 잡아보기"
          : retried
            ? "괜찮아요, 실전으로"
            : "다시 시도",
        action: onboarding.bladeHit || retried ? "final-battle" : "practice",
      },
    ],
    [],
  ];
  const copy = lessons[step][Math.min(dialogue, lessons[step].length - 1)];
  const revealId = String((onboarding.revealId || 0) + 1);
  onboarding.revealId = Number(revealId);
  const revealDelay = Math.min(1900, 620 + copy.body.split(" ").length * 28);
  const card = document.createElement("section");
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-label", "관측 수업 안내");
  card.className =
    "onboarding-card onboarding-enter " +
    (onboarding.launched ? "waiting " : "") +
    (step === 3 ? "complete" : "");
  const bars = Array.from(
    { length: 6 },
    (_, i) => '<i class="' + (i < copy.n ? "active" : "") + '"></i>',
  ).join("");
  card.dataset.revealId = revealId;
  card.innerHTML =
    '<div class="onboarding-kicker"><span>관측 수업 · 1-1</span><b>' +
    copy.n +
    ' / 6</b></div><div class="onboarding-helper"><img src="' +
    metaArt.luna +
    '" alt=""><span><b>루나 · 관측 보조</b><small>LAST OBSERVATORY</small></span></div><h3>' +
    copy.title +
    '</h3><p class="onboarding-copy">' +
    staggerOnboardingCopy(copy.body) +
    '</p><div class="onboarding-progress">' +
    bars +
    "</div>" +
    (copy.button
      ? '<button id="onboardingContinue" data-reveal-id="' +
        revealId +
        '" style="--reveal-delay:' +
        revealDelay +
        'ms" disabled>' +
        copy.button +
        "</button>"
      : "");
  (dock || stageEl).append(card);
  if (copy.button) {
    const continueButton = document.querySelector("#onboardingContinue");
    continueButton.onclick = () => continueOnboarding(copy.action);
    setTimeout(() => {
      const revealedButton = document.querySelector("#onboardingContinue");
      if (revealedButton?.dataset.revealId !== revealId) return;
      revealedButton.disabled = false;
      revealedButton.focus({ preventScroll: true });
    }, revealDelay);
  }
}
function showOnboardingTutorial(replay = false) {
  const returnParty = selected.length ? [...selected] : ["biyeon", "ria"];
  resetBuild();
  onboarding = {
    phase: 0,
    dialogue: 0,
    replay,
    returnParty,
    contacts: new Set(),
    bossHit: false,
    bladeHit: false,
    launched: false,
    settled: false,
    transitioning: false,
    panelVisible: true,
  };
  setOnboardingPhase(0, true);
}
function completeOnboarding() {
  const firstClear = !hasOnboardingClear();
  markOnboardingSeen();
  unlockThirdPartySlot();
  if (firstClear) {
    try {
      appStorage.writeText(ONBOARDING_CLEAR_STORAGE, "1");
    } catch {}
    progress.clears++;
    grantFreeSummon(1);
    saveProgress();
  }
  selected =
    onboarding?.replay && onboarding.returnParty?.length
      ? [...onboarding.returnParty]
      : [...STARTER_HERO_IDS];
  deployed = [...selected];
  onboarding = null;
  run = false;
  drag = null;
  playSfx?.("unlock");
  document.body.classList.remove("onboarding-active");
  document.body.classList.remove("onboarding-locked");
  document.querySelector(".onboarding-card")?.remove();
  document
    .querySelector("#onboardingDock")
    ?.setAttribute("aria-hidden", "true");
  U.over.className = "overlay";
  U.over.innerHTML =
    '<div class="outcome-cut win"><div class="outcome-constellation" aria-hidden="true"><i>✦</i><i>✧</i><i>★</i><i>✧</i><i>✦</i></div><div class="tag">업적 해금</div><h2>첫 관측자의 증명</h2><p>세 번째 별지기 자리가 열렸습니다.<br>그 자리를 채울 <b>무료 소환권 1장</b>을 드릴게요.</p><button id="openOnboardingAchievement">무료로 소환하기</button><button id="openConstellationMap">나중에 하기</button></div>';
  U.over.classList.remove("hide");
  document.querySelector("#openOnboardingAchievement").onclick = () => {
    playSfx();
    showGacha();
  };
  document.querySelector("#openConstellationMap").onclick = () => {
    playSfx();
    showMeta();
  };
}
const baseOnboardingDamage = damage;
damage = function (weak = false) {
  baseOnboardingDamage(weak);
  // Record only.  The lesson card advances when the player presses the button.
  if (onboarding?.phase === 0) onboarding.bossHit = true;
};
const baseOnboardingTrackBlazeUnit = trackBlazeUnit;
trackBlazeUnit = function (g) {
  baseOnboardingTrackBlazeUnit(g);
  if (
    onboarding &&
    ((onboarding.phase === 1 && g.id === "biyeon") ||
      (onboarding.phase === 2 && g.id === "ria"))
  )
    onboarding.contacts.add(g.id);
};
const baseOnboardingWakeUnit = wakeUnit;
wakeUnit = function (g) {
  baseOnboardingWakeUnit(g);
  if (
    onboarding &&
    ((onboarding.phase === 1 && g.id === "biyeon") ||
      (onboarding.phase === 2 && g.id === "ria"))
  )
    onboarding.contacts.add(g.id);
};
const baseOnboardingBladeWheelHit = reportBladeWheelHit;
reportBladeWheelHit = function (g, target, amount) {
  baseOnboardingBladeWheelHit(g, target, amount);
  if (onboarding?.phase !== 2 || g.id !== "ria") return;
  onboarding.bladeHit = true;
};
// Killing the colossus in the closing lesson finishes the tutorial itself
// instead of opening the ordinary battle result screen.
const baseOnboardingWin = win;
win = function () {
  if (!onboarding || onboarding.phase !== ONBOARDING_FINAL_PHASE)
    return baseOnboardingWin();
  if (!battle) return;
  battle.victory = null;
  battleComplete = true;
  run = false;
  assistShots = [];
  completeOnboarding();
};
function showStoryIntro() {
  run = false;
  drag = null;
  setScene("title");
  U.over.className = "overlay story-intro-scene";
  U.over.innerHTML =
    '<section class="story-intro-card" aria-label="잊힌 별의 관측자 프롤로그"><small class="story-intro-kicker">THE LAST OBSERVATORY</small><h2>잊힌 별의 관측자</h2><div class="story-intro-lines"><p>어느 밤부터, 별이 하나씩 꺼졌다.</p><p>이야기가 잊힐 때마다 별이 지고, 그 자리에 공허가 고였다.</p><p>땅에 떨어져 잠든 별지기를 깨우는 방법은 단 하나 — 부딪히는 것.</p><p>관측자여, 유성을 굴려라. 별자리가 기억을 되찾을 것이다.</p></div><small class="story-intro-skip">클릭하여 계속</small></section>';
  const close = () => {
    // The overlay element is reused by every later screen, so this handler has
    // to be released.  Leaving it attached made any click on the hub, gacha,
    // achievements or settings restart the tutorial underneath them.
    U.over.onclick = null;
    markStoryIntroSeen();
    playSfx?.("confirm");
    showOnboardingTutorial();
  };
  U.over.onclick = close;
  addEventListener(
    "keydown",
    function skipStoryIntro() {
      if (document.querySelector(".story-intro-card")) close();
    },
    { once: true },
  );
}
showTitle = function () {
  run = false;
  drag = null;
  setScene("title");
  const enter = renderTitlePresentation();
  enter.onclick = () => {
    if (!hasSeenStoryIntro()) showStoryIntro();
    else if (!hasSeenOnboarding() || !hasThirdPartySlot()) {
      playSfx?.("confirm");
      showOnboardingTutorial();
    } else {
      playSfx?.("confirm");
      showMeta();
    }
  };
};
function storySkyStars(count) {
  return Array.from(
    { length: Math.min(30, count) },
    (_, i) =>
      '<i aria-hidden="true" style="left:' +
      (((i * 47 + 13) % 91) + 4) +
      "%;top:" +
      (((i * 29 + 17) % 82) + 7) +
      '%"></i>',
  ).join("");
}
// The hub map remembers which star the player inspected last.  Null means
// "the newest unlocked battle", which is stage 1-2 while 1-3+ stay locked.
let hubMapSelection = null;
function hubSelectedMapIndex(mapStages) {
  if (
    hubMapSelection !== null &&
    mapStages[hubMapSelection] &&
    !mapStages[hubMapSelection].locked
  )
    return hubMapSelection;
  for (let i = mapStages.length - 1; i >= 0; i--)
    if (!mapStages[i].locked && !mapStages[i].onboarding) return i;
  return 0;
}
showMeta = function () {
  run = false;
  drag = null;
  setScene("meta");
  const mapStages = constellationMapStages(),
    mapIndex = hubSelectedMapIndex(mapStages),
    mapStage = mapStages[mapIndex],
    world = activeWorld(),
    // Paging is only offered toward a world whose first star is already open,
    // so the arrows never lead to a dead map.
    worldNav = (() => {
      const at = WORLDS.indexOf(world);
      const step = (delta) => {
        const next = WORLDS[at + delta];
        return next && isWorldUnlocked(next) ? next.id : null;
      };
      return { prev: step(-1), next: step(1) };
    })(),
    stageData = mapStage.onboarding ? stages[0] : stages[mapStage.stage],
    // The player picks this in the profile tab; the lead starkeeper's rune
    // stone is only the fallback for a build without the pixel kit.
    avatar =
      profileIconMarkup?.() ||
      (selected[0] ? '<img src="' + runeStone(selected[0]) + '" alt="">' : "◆");
  const party = Array.from({ length: 3 }, (_, i) =>
    selected[i]
      ? '<span class="hub-party-slot"><img src="' +
        runeStone(selected[i]) +
        '" alt="' +
        heroes[selected[i]].s +
        '"></span>'
      : '<span class="hub-party-slot empty">+</span>',
  ).join("");
  const clear = progress.clears || 0,
    gold = goldBalance(),
    best = formatRunTime(progress.bestTime),
    gimmicks = stageData.gimmicks ?? {},
    stageRule = mapStage.onboarding
      ? "루나의 관측 수업"
      : stageGimmickLabels(stageData).join(" · ") || "별자리 전술";
  const nodes = mapStages
    .map((entry, index) => {
      const cleared = isStageCleared(entry);
      return (
        '<button class="constellation-node' +
        (entry.locked ? " locked" : "") +
        (cleared ? " cleared" : "") +
        (index === mapIndex ? " active" : "") +
        '" style="left:' +
        entry.x +
        "%;top:" +
        entry.y +
        '%" ' +
        (entry.locked ? "disabled" : 'data-map-index="' + index + '"') +
        '><span class="stage-star">' +
        entry.mark +
        '</span><span class="stage-copy"><small>' +
        (entry.star ? entry.star.bayer : "STAGE " + entry.id) +
        '</small><b class="marquee"><span>' +
        (entry.star ? entry.star.name : entry.name) +
        '</span></b><span class="marquee"><span>' +
        entry.note +
        '</span></span></span><em class="node-status">' +
        (entry.locked
          ? "잠김"
          : cleared
            ? "클리어"
            : index === mapIndex
              ? "선택됨"
              : "선택") +
        "</em>" +
        (cleared ? '<em class="stage-cleared-mark">★</em>' : "") +
        "</button>"
      );
    })
    .join("");
  U.over.className = "overlay meta-scene";
  U.over.innerHTML =
    '<div class="survivor-hub hub-map-mode"><div class="hub-night-sky" aria-hidden="true">' +
    storySkyStars(clear) +
    '</div><div class="hub-topbar"><div class="hub-player"><span class="hub-avatar">' +
    avatar +
    '</span><span>OBSERVATORY ID<b>PLAYER 01</b><small>오늘의 밤하늘 관측 중</small></span></div><div class="hub-resources"><button class="hub-resource hub-record-chip" id="hubRecordChip">업적<b>' +
    achievementList().filter((a) => a.done).length +
    " / " +
    achievementList().length +
    "</b>" +
    (claimCount()
      ? '<i class="claim-badge">수령 ' + claimCount() + "</i>"
      : "") +
    '</button><span class="hub-resource hub-gold">골드<b>' +
    gold +
    '</b></span><span class="hub-resource">최단 기록<b>' +
    best +
    '</b></span></div></div><div class="world-bar"><button class="world-step" id="worldPrev" aria-label="이전 별자리"' +
    (worldNav.prev ? "" : " disabled") +
    '>◀</button><div class="world-name"><small>' +
    world.bayer +
    "</small><b>" +
    world.name +
    "</b><span>" +
    world.lore +
    '</span></div><button class="world-step" id="worldNext" aria-label="다음 별자리"' +
    (worldNav.next ? "" : " disabled") +
    '>▶</button></div><section class="hub-map" aria-label="별자리 스테이지 지도"><svg class="constellation-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
    constellationRoute(mapStages) +
    "</svg>" +
    nodes +
    '</section><section class="hub-mission-bar"><div class="hub-mission-info"><small>' +
    (mapStage.star ? mapStage.star.bayer + " · " : "STAGE " + mapStage.id + " · ") +
    stageRule +
    '</small><b class="marquee"><span>' +
    mapStage.name +
    '</span></b><span class="hub-mission-hint">별지기는 관측 시작 후 고릅니다</span></div><button class="hub-training" id="hubTraining">무한<br>훈련장</button><button class="hub-battle-play" id="hubStartBattle"><img src="' +
    metaArt.play +
    '" alt="">' +
    (mapStage.onboarding ? "수업 다시 보기" : "게임 시작!") +
    '</button></section><nav class="hub-tabbar" aria-label="관측소 메뉴"><button class="hub-tab" id="hubProfile"><span aria-hidden="true">◎</span><b>프로필</b></button><button class="hub-tab" id="hubGacha"><span aria-hidden="true">☄</span><b>소환</b></button><button class="hub-tab center" id="hubBattleTab"><span aria-hidden="true">★</span><b>관측</b></button><button class="hub-tab" id="hubShop"><span aria-hidden="true">◈</span><b>상점</b></button><button class="hub-tab" id="hubSettings"><span aria-hidden="true">⚙</span><b>설정</b></button></nav></div>';
  applyMarquees(U.over);
  for (const node of document.querySelectorAll("[data-map-index]"))
    node.onclick = () => {
      hubMapSelection = Number(node.dataset.mapIndex);
      playSfx();
      showMeta();
    };
  for (const [id, target] of [
    ["#worldPrev", worldNav.prev],
    ["#worldNext", worldNav.next],
  ])
    if (target)
      document.querySelector(id).onclick = () => {
        setHubWorld(target);
        playSfx();
        showMeta();
      };
  const startObservation = () => {
    playSfx();
    if (mapStage.onboarding) return showOnboardingTutorial(true);
    stageIndex = mapStage.stage;
    primeCombatTextures();
    showRoster();
  };
  document.querySelector("#hubStartBattle").onclick = startObservation;
  // The training table sits outside the campaign order, so no map node points
  // at it and `showStageSelect()` — the other screen carrying this entry — is
  // not reachable from this hub.  Without this button it cannot be opened.
  document.querySelector("#hubTraining").onclick = () => {
    playSfx();
    stageIndex = stages.findIndex((stage) => stage.training);
    primeCombatTextures();
    showRoster();
  };
  document.querySelector("#hubBattleTab").onclick = startObservation;
  document.querySelector("#hubProfile").onclick = () => {
    playSfx();
    showProfile();
  };
  document.querySelector("#hubGacha").onclick = () => {
    playSfx();
    showGacha();
  };
  document.querySelector("#hubShop").onclick = () => {
    playSfx();
    showShop();
  };
  document.querySelector("#hubRecordChip").onclick = () => {
    playSfx();
    showAchievements();
  };
  document.querySelector("#hubSettings").onclick = () => {
    playSfx();
    showSettings();
  };
};
const baseStorySetupBattle = setupBattle;
setupBattle = function () {
  baseStorySetupBattle();
  const stage = currentStage();
  if (stage.tutorial) {
    battle.shots = 99;
    battle.shotMax = 99;
  }
  msg = battle.training
    ? "무한 훈련장 · 유성은 자동 보충됩니다. 충돌과 별자리 배율을 마음껏 시험하세요. R 키로 나가기."
    : stage.tutorial
      ? "1-1 · 루나의 안내를 따라 유성과 별지기의 첫 연계를 관측하세요."
      : stage.name + " · 별지기를 깨우고, 멈춘 자리로 별자리를 그리세요.";
  sync();
};
resultCard = function (shotsUsed, elapsedMs) {
  const medal =
      shotsUsed <= 1 ? "flawless" : shotsUsed <= 2 ? "sharp" : "clear",
    seconds = (elapsedMs / 1000).toFixed(1);
  return (
    '<div class="result-card"><img class="result-medal" src="' +
    libraryArt.result[medal] +
    '" alt="전투 메달"><div class="result-metrics"><span class="result-metric"><img src="' +
    libraryArt.result.time +
    '" alt=""><span>클리어<b>' +
    seconds +
    '초</b></span></span><span class="result-metric"><img src="' +
    libraryArt.result.shots +
    '" alt=""><span>사용 유성<b>' +
    shotsUsed +
    '개</b></span></span><span class="result-metric"><img src="' +
    libraryArt.result.damage +
    '" alt=""><span>처치 피해<b>' +
    boss.maxHp +
    "</b></span></span></div></div>"
  );
};
fail = function () {
  battleComplete = true;
  assistShots = [];
  U.over.className = "overlay";
  U.over.innerHTML =
    '<div class="outcome-cut fail"><div class="outcome-constellation" aria-hidden="true"><i>·</i><i>✧</i><i>·</i></div><div class="tag">관측 실패</div><h2>별빛이 닿지 않았습니다.</h2><p>다른 별지기와 다른 궤적으로 다시 관측하세요.</p><button onclick="showRoster()">다시 관측하기</button></div>';
  U.over.classList.remove("hide");
};
const baseStoryEndShot = endShot;
endShot = function () {
  baseStoryEndShot();
  if (run && battle && !battle.training) {
    msg = "다음 유성을 준비하세요. 남은 배치에서 별자리를 다시 설계하세요.";
    sync();
  }
};
const baseStorySettleParty = settleParty;
settleParty = function () {
  baseStorySettleParty();
  // The dashed "별자리 완성" triangle is the old three-gate reveal.  Where the
  // figure prototype is running it draws its own constellation over the same
  // points, so the two would trace competing shapes on the same beat.
  const figureOwnsSettle = typeof figureActive === "function" && figureActive();
  if (gates.length === 3 && !figureOwnsSettle) {
    constellationReveal = {
      points: gates.map((g) => ({ x: g.x, y: g.y })),
      endsAt: performance.now() + 800,
      mult: ball?.blaze?.mult || 1,
    };
  }
  if (!onboarding) return;
  onboarding.settled = true;
  // The closing lesson is a real fight, so no card interrupts it.
  if (onboarding.phase === ONBOARDING_FINAL_PHASE) return;
  // A practice shot resolved: bring back this lesson's result card and let the
  // player read it for as long as they want.
  onboarding.attempts = (onboarding.attempts ?? 0) + 1;
  onboarding.dialogue = 1;
  onboarding.launched = false;
  onboarding.panelVisible = true;
  setTimeout(renderOnboarding, 180);
};
function drawConstellationReveal() {
  if (!constellationReveal) return;
  const left = constellationReveal.endsAt - performance.now();
  if (left <= 0) {
    constellationReveal = null;
    return;
  }
  const p = left / 800,
    points = constellationReveal.points,
    cx = points.reduce((sum, v) => sum + v.x, 0) / points.length,
    cy = points.reduce((sum, v) => sum + v.y, 0) / points.length;
  x.save();
  x.globalAlpha = Math.min(1, p * 2.5);
  x.strokeStyle = "#f7d67c";
  x.shadowBlur = 10;
  x.shadowColor = "#e5ae52";
  x.lineWidth = 1.5;
  x.setLineDash([5, 5]);
  x.beginPath();
  x.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) x.lineTo(point.x, point.y);
  x.closePath();
  x.stroke();
  x.setLineDash([]);
  for (const point of points) {
    x.fillStyle = "#fff3bb";
    x.beginPath();
    x.arc(point.x, point.y, 3, 0, Math.PI * 2);
    x.fill();
  }
  x.textAlign = "center";
  x.font = "bold 13px Galmuri11, ui-monospace";
  x.fillStyle = "#fff0b4";
  x.fillText(
    "CONSTELLATION ×" + constellationReveal.mult.toFixed(1),
    cx,
    cy - 8,
  );
  x.font = "bold 8px Galmuri11, ui-monospace";
  x.fillStyle = "#e4c776";
  x.fillText("별자리 완성", cx, cy + 7);
  x.restore();
}
registerRuntimeHook("afterDraw", drawConstellationReveal);
function drawOnboardingGuide() {
  // The guide belongs to practice: it draws whenever the lesson card has
  // stepped aside, on the first attempt as well as on a retry.  The closing
  // lesson is a real fight, so no target ring is drawn there.
  if (
    !onboarding ||
    !battle ||
    !ball ||
    ball.moving ||
    onboarding.panelVisible !== false ||
    onboarding.phase === ONBOARDING_FINAL_PHASE
  )
    return;
  const phase = onboarding.phase;
  const target =
    phase === 0
      ? boss
      : phase === 1
        ? gates[0]
        : gates.find((gate) => gate.id === "ria");
  x.save();
  x.lineWidth = 1.5;
  x.setLineDash([5, 5]);
  x.strokeStyle = "#ffe6a1";
  x.shadowBlur = 11;
  x.shadowColor = "#ffd36f";
  if (target) {
    x.beginPath();
    x.moveTo(ball.x, ball.y);
    x.lineTo(target.x, target.y);
    x.stroke();
    x.setLineDash([]);
    x.strokeStyle = phase === 0 ? "#f2a48d" : target.col;
    x.lineWidth = 2;
    x.beginPath();
    x.arc(target.x, target.y, phase === 0 ? 72 : 35, 0, Math.PI * 2);
    x.stroke();
    x.fillStyle = "#fff0bd";
    x.font = "bold 10px Galmuri11, ui-monospace";
    x.textAlign = "center";
    x.fillText(
      phase === 0
        ? "직격 목표"
        : phase === 2
          ? "윤슬을 보스 쪽으로"
          : target.s + "을 향해",
      target.x,
      target.y - 44,
    );
    const distance = Math.hypot(target.x - ball.x, target.y - ball.y) || 1;
    const pullX = -(target.x - ball.x) / distance;
    const pullY = -(target.y - ball.y) / distance;
    const pulse = 7 + Math.sin(performance.now() / 210) * 5;
    const fingerX = ball.x + pullX * (62 + pulse);
    const fingerY = ball.y + pullY * (62 + pulse);
    x.strokeStyle = "#fff3c2";
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(ball.x + pullX * 20, ball.y + pullY * 20);
    x.lineTo(fingerX, fingerY);
    x.stroke();
    x.font = "24px sans-serif";
    x.textAlign = "center";
    x.lineWidth = 3;
    x.strokeStyle = "#15131c";
    x.strokeText("☝", fingerX, fingerY + 8);
    x.fillStyle = "#fff4cc";
    x.fillText("☝", fingerX, fingerY + 8);
    x.font = "bold 9px Galmuri11, ui-monospace";
    x.fillStyle = "#fff0bd";
    x.fillText("여기서 아래로 당기기", fingerX, fingerY + 28);
  }
  if (phase === 2 && gates.length === 2) {
    const ria = gates.find((gate) => gate.id === "ria");
    if (!ria) {
      x.restore();
      return;
    }
    x.beginPath();
    x.moveTo(ria.x, ria.y);
    x.lineTo(boss.x, boss.y);
    x.stroke();
    x.setLineDash([]);
  }
  x.restore();
}
registerRuntimeHook("afterDraw", drawOnboardingGuide);
// The lesson card yields to the table: while the meteor flies, starkeepers
// roll or wake-up bursts play, it steps down so the action stays in view.
function onboardingTableLive() {
  if (!onboarding || !run || !ball) return false;
  if (Math.hypot(ball.vx || 0, ball.vy || 0) > 40) return true;
  if (gates.some((g) => Math.hypot(g.vx || 0, g.vy || 0) > 40)) return true;
  if (typeof abilityBursts !== "undefined" && abilityBursts.length) return true;
  return Boolean(battle?.victory);
}
registerRuntimeHook("afterFeedbackUpdate", () => {
  document
    .querySelector(".onboarding-card")
    ?.classList.toggle("table-live", onboardingTableLive());
});
const baseStoryVictoryFx = drawVictoryFx;
drawVictoryFx = function () {
  baseStoryVictoryFx();
  const v = battle?.victory;
  if (!v || !boss) return;
  const p = Math.min(1, v.t / v.d),
    wx = boss.x + Math.cos(boss.a) * 84,
    wy = boss.y + Math.sin(boss.a) * 84,
    image = textures[feedbackArt.critStar];
  x.save();
  x.globalAlpha = Math.min(1, p / 0.18, 1 - p * 0.35);
  x.translate(wx, wy - p * (H * 0.58));
  x.rotate(p * 0.45);
  x.imageSmoothingEnabled = false;
  x.shadowBlur = 20;
  x.shadowColor = "#ffe38e";
  if (image?.complete && image.naturalWidth)
    x.drawImage(image, -19, -19, 38, 38);
  else {
    circle(0, 0, 10, "#fff1a5", 15);
    circle(0, 0, 4, "#fff", 2);
  }
  x.restore();
};
const baseStoryWin = win;
win = function () {
  const shouldRecord = Boolean(
      battle && battleComplete && battle.victory && !battle.storyRecorded,
    ),
    partyNames = deployed
      .map((id) => heroes[id]?.s)
      .filter(Boolean)
      .join(" · "),
    shotsUsed = battle ? battle.shotMax - battle.shots : 0,
    elapsedMs = battle?.victory?.elapsedMs ?? 0,
    goldEarned =
      shouldRecord && !battle?.training && !battle?.tutorial
        ? accrueGold(ECONOMY.clearGold)
        : 0;
  if (shouldRecord) {
    battle.storyRecorded = true;
    progress.clears++;
    progress.bestShots = Math.min(progress.bestShots, shotsUsed);
    progress.bestTime = !progress.bestTime
      ? elapsedMs
      : Math.min(progress.bestTime, elapsedMs);
    saveProgress();
  }
  baseStoryWin();
  if (goldEarned > 0)
    rewardToast(
      "관측 보상함에 적립",
      "+" + goldEarned + " 골드",
      "업적 탭에서 수령하세요",
    );
  if (shouldRecord) {
    U.over.className = "overlay";
    U.over.innerHTML =
      '<div class="outcome-cut win"><div class="outcome-constellation" aria-hidden="true"><i>✦</i><i>✧</i><i>★</i><i>✧</i><i>✦</i></div><div class="tag">별 해방</div><h2>별이 하늘로 돌아갔습니다.</h2>' +
      resultCard(shotsUsed, elapsedMs) +
      resultGoldReward(goldEarned) +
      "<p>밤하늘에 별이 하나 켜졌습니다 — 오늘의 별자리: " +
      partyNames +
      '</p><button onclick="showStageSelect()">다음 관측</button></div>';
    U.over.classList.remove("hide");
  }
};
const baseStoryRenderBlaze = renderBlaze;
renderBlaze = function (pulse = false) {
  baseStoryRenderBlaze(pulse);
  if (U.blazeCard) U.blazeCard.title = STORY_CONSTELLATION_TOOLTIP;
};
let observatoryGlowLayer = null,
  observatoryGlowBossX = -1,
  observatoryGlowBossY = -1;
function buildObservatoryGlowLayer() {
  if (
    observatoryGlowLayer &&
    observatoryGlowBossX === boss?.x &&
    observatoryGlowBossY === boss?.y
  )
    return observatoryGlowLayer;
  const layer = document.createElement("canvas");
  layer.width = W;
  layer.height = H;
  const layerX = layer.getContext("2d");
  layerX.globalCompositeOperation = "screen";
  if (boss) {
    const halo = layerX.createRadialGradient(
      boss.x,
      boss.y,
      14,
      boss.x,
      boss.y,
      172,
    );
    halo.addColorStop(0, "#c7d3ff20");
    halo.addColorStop(0.35, "#7e84e417");
    halo.addColorStop(1, "#00000000");
    layerX.fillStyle = halo;
    layerX.fillRect(boss.x - 180, boss.y - 180, 360, 360);
  }
  const launchGlow = layerX.createRadialGradient(
    W / 2,
    H - 86,
    4,
    W / 2,
    H - 86,
    148,
  );
  launchGlow.addColorStop(0, "#f0c97618");
  launchGlow.addColorStop(1, "#00000000");
  layerX.fillStyle = launchGlow;
  layerX.fillRect(W / 2 - 150, H - 236, 300, 230);
  observatoryGlowLayer = layer;
  observatoryGlowBossX = boss?.x ?? -1;
  observatoryGlowBossY = boss?.y ?? -1;
  return layer;
}
function drawObservatoryAtmosphere() {
  const now = performance.now() / 1000;
  x.save();
  x.globalCompositeOperation = "screen";
  x.drawImage(buildObservatoryGlowLayer(), 0, 0);
  for (let i = 0; i < 26; i++) {
    const px = 36 + ((i * 113) % 647),
      py = 48 + ((i * 79) % 742),
      twinkle = 0.2 + (Math.sin(now * (0.7 + i * 0.07) + i) * 0.5 + 0.5) * 0.42;
    if (Math.abs(px - W / 2) < 105 && py < 310) continue;
    x.globalAlpha = twinkle;
    x.fillStyle = i % 4 === 0 ? "#ffe9ab" : "#b9c9ff";
    x.fillRect(
      Math.round(px),
      Math.round(py),
      i % 5 === 0 ? 2 : 1,
      i % 5 === 0 ? 2 : 1,
    );
  }
  x.restore();
}
registerRuntimeHook("afterArenaDraw", drawObservatoryAtmosphere);

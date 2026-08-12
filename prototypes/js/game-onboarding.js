// Canonical story layer — presentation only; no physics or balance state is changed here.
const STORY_INTRO_STORAGE = "prism-breakers.story-intro.v1";
const STORY_CONSTELLATION_TOOLTIP =
  "별지기들이 멈춘 자리가 별자리를 이룹니다. 크게, 대담하게 그릴수록 강해집니다.";
const ONBOARDING_STORAGE = "stella-ball.onboarding.v1";
const ONBOARDING_CLEAR_STORAGE = "stella-ball.onboarding-clear.v1";
const PARTY_SLOT_STORAGE = "stella-ball.party-slots.v1";
let constellationReveal = null;
function markStoryIntroSeen() {
  try {
    localStorage.setItem(STORY_INTRO_STORAGE, "1");
  } catch {}
}
function hasSeenStoryIntro() {
  try {
    return localStorage.getItem(STORY_INTRO_STORAGE) === "1";
  } catch {
    return false;
  }
}
function markOnboardingSeen() {
  try {
    localStorage.setItem(ONBOARDING_STORAGE, "1");
  } catch {}
}
function hasSeenOnboarding() {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE) === "1";
  } catch {
    return false;
  }
}
function hasOnboardingClear() {
  try {
    return localStorage.getItem(ONBOARDING_CLEAR_STORAGE) === "1";
  } catch {
    return false;
  }
}
function hasThirdPartySlot() {
  try {
    return localStorage.getItem(PARTY_SLOT_STORAGE) === "3";
  } catch {
    return false;
  }
}
function partySlotCount() {
  return hasThirdPartySlot() ? 3 : 2;
}
function unlockThirdPartySlot() {
  try {
    localStorage.setItem(PARTY_SLOT_STORAGE, "3");
  } catch {}
}
let onboarding = null;
function isOnboardingInputLocked() {
  return Boolean(onboarding && onboarding.panelVisible !== false);
}
function isOnboardingSessionActive() {
  return Boolean(onboarding);
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
  onboarding = {
    ...onboarding,
    phase,
    dialogue: 0,
    contacts: new Set(),
    bossHit: false,
    bladeHit: false,
    launched: false,
    settled: false,
    transitioning: false,
    panelVisible: true,
  };
  if (first || !battle) setupBattle();
  else setupBattle();
  msg = [
    "도우미 루나 · 유성을 보스에게 곧장 보내 보세요.",
    "도우미 루나 · 비연을 굴려, 멈춘 자리의 거리 저격을 확인하세요.",
    "도우미 루나 · 리아를 빠르게 굴려 회전 칼날로 보스를 스쳐 보세요.",
    "도우미 루나 · 두 별지기가 준비됐어요. 이제 첫 관측을 마무리하세요.",
  ][phase];
  sync();
  renderOnboarding();
}
function setOnboardingDialogue(dialogue) {
  if (!onboarding) return;
  onboarding.dialogue = dialogue;
  onboarding.launched = false;
  onboarding.panelVisible = true;
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
  if (action === "direct-aim") return setOnboardingDialogue(1);
  if (action === "add-biyeon") return setOnboardingPhase(1);
  if (action === "biyeon-aim") return setOnboardingDialogue(1);
  if (action === "add-pair") return setOnboardingPhase(2);
  if (action === "pair-aim") return setOnboardingDialogue(1);
  if (action === "final-setup") return setOnboardingPhase(3);
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
  const lessons = [
    [
      {
        n: 1,
        title: "안녕, 관측자님.",
        body: "나는 루나예요. 급하게 하지 않아도 괜찮아요. 이 수업에서는 한 번에 딱 하나씩만 알려 줄게요. 지금 전장에는 유성 하나와 공허 거상 하나만 있어요.",
        button: "루나의 첫 설명 듣기",
        action: "direct-aim",
      },
      {
        n: 2,
        title: "먼저, 유성을 찾아볼까요?",
        body: "화면 아래 가운데의 작은 빛이 유성이에요. 유성을 마우스로 잡은 뒤 아래쪽으로 끌어 보세요. 손을 놓으면 당긴 방향의 반대로, 즉 위쪽으로 날아가요.",
        button: "유성 발사해 보기",
        action: "practice",
      },
      {
        n: 3,
        title: onboarding.bossHit
          ? "아주 잘했어요. 직격 성공!"
          : "유성이 날아가고 있어요.",
        body: onboarding.bossHit
          ? "보스 몸체에 닿자 피해 숫자가 떴죠? 빛나는 약점이 아니어도 보스는 피해를 받아요. 처음에는 몸체를 향하는 것만으로 충분해요."
          : "지금은 조작하지 말고 유성이 어디로 가는지 지켜보세요. 빗나가도 괜찮아요. 유성이 멈추면 같은 방법으로 다시 시도할 수 있어요.",
      },
      {
        n: 3,
        title: "첫 번째 규칙을 기억하세요.",
        body: "유성 자체도 보스에게 피해를 줄 수 있어요. 하지만 다음부터는 잠든 별지기를 깨워 더 큰 공격을 만들 거예요. 이제 첫 별지기를 불러올게요.",
        button: "다음: 비연 만나기",
        action: "add-biyeon",
      },
    ],
    [
      {
        n: 4,
        title: "첫 별지기는 비연이에요.",
        body: "비연은 유성과 부딪히면 굴러가요. 모든 움직임이 멈추면 마지막 자리에서 보스를 향해 화살을 쏩니다. 멀리 멈출수록 저격 피해가 강해져요.",
        button: "비연을 굴려 볼게요",
        action: "biyeon-aim",
      },
      {
        n: 5,
        title: "이번에는 보스가 아니라 비연이에요.",
        body: "점선 끝의 붉은 원이 비연이에요. 유성을 비연 쪽으로 보내 보세요. 유성과 비연이 닿으면 둘 다 움직이기 시작합니다.",
        button: "비연을 향해 발사하기",
        action: "practice",
      },
      {
        n: 6,
        title: "딩! 비연이 깨어났어요.",
        body: "비연이 움직였다는 뜻이에요. 아직은 공격하지 않아요. 모든 공이 완전히 멈출 때까지 기다린 뒤, 비연이 마지막 위치에서 보스를 저격해요.",
      },
      {
        n: 6,
        title: "비연의 각성 공격을 봤어요.",
        body: "핵심은 “부딪혀 깨운 뒤, 멈추면 공격한다”예요. 비연은 어디에 멈춰도 보스를 겨누므로 첫 각성 흐름을 익히기 좋아요. 이제 이동 중에만 공격하는 별지기를 추가할게요.",
        button: "다음: 리아 추가하기",
        action: "add-pair",
      },
    ],
    [
      {
        n: 7,
        title: "두 번째 별지기는 리아예요.",
        body: "리아는 따로 정산 공격을 하지 않아요. 대신 굴러가는 동안 보스를 그대로 관통하며 쌍칼을 선풍기처럼 돌려 주변을 베고, 빠를수록 피해와 칼날 반경이 커져요.",
        button: "리아의 회전 칼날 보기",
        action: "pair-aim",
      },
      {
        n: 8,
        title: "이번 목표는 리아를 빠르게 미는 것.",
        body: "아래쪽 리아의 중심을 향해 강하게 발사해 보세요. 리아가 보스를 뚫고 지나가는 동안 회전 칼날이 여러 번 피해를 줍니다.",
        button: "리아를 강하게 밀기",
        action: "practice",
      },
      {
        n: 9,
        title: onboarding.bladeHit
          ? "리아의 회전 칼날이 적중했어요!"
          : "리아가 회전하기 시작했어요.",
        body: onboarding.bladeHit
          ? "좋아요. 정산을 기다리지 않고 이동 중에 피해가 들어갔어요. 속도가 높을수록 칼날이 더 멀리 돌고 한 번의 이동에서 더 큰 피해를 냅니다."
          : "칼날은 돌기 시작했지만 보스까지 닿지 않았어요. 다음에는 리아를 더 강하게, 보스 쪽으로 밀어 보세요.",
      },
      {
        n: 10,
        title: "리아는 왜 정산 공격이 없을까요?",
        body: "리아의 보상은 멈춘 뒤가 아니라 움직이는 시간에 전부 들어가요. 비연은 멈춘 위치를 설계하고, 리아는 속도와 통과 경로를 설계합니다. 서로 다른 공격 타이밍을 조합하는 것이 핵심이에요.",
      },
      {
        n: 10,
        title: "마지막으로 전장을 정리할게요.",
        body: "이제 비연과 리아를 서로 다른 자리에 준비해 둘게요. 실제 전투에서는 세 번째 별지기까지 더해 정산형과 이동형을 섞을 수 있어요.",
        button: "마지막 정리 보기",
        action: "final-setup",
      },
    ],
    [
      {
        n: 11,
        title: "첫 관측 수업을 마쳤습니다.",
        body: "직접 맞히기, 별지기 깨우기, 둘을 연결해 별자리 배율 만들기까지 전부 해냈어요. 보상으로 세 번째 별지기 슬롯을 열어 드릴게요. 이제부터는 세 명의 조합을 직접 선택할 수 있어요.",
        button: "1-1 관측 완료",
        action: "complete",
      },
    ],
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
    { length: 11 },
    (_, i) => '<i class="' + (i < copy.n ? "active" : "") + '"></i>',
  ).join("");
  card.dataset.revealId = revealId;
  card.innerHTML =
    '<div class="onboarding-kicker"><span>관측 수업 · 1-1</span><b>' +
    copy.n +
    ' / 11</b></div><div class="onboarding-helper"><img src="' +
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
      localStorage.setItem(ONBOARDING_CLEAR_STORAGE, "1");
    } catch {}
    progress.clears++;
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
    '<div class="outcome-cut win"><div class="outcome-constellation" aria-hidden="true"><i>✦</i><i>✧</i><i>★</i><i>✧</i><i>✦</i></div><div class="tag">업적 해금</div><h2>첫 관측자의 증명</h2><p>별지기 파티 슬롯이 하나 열렸습니다. 이제 세 명의 별지기를 함께 관측할 수 있어요.</p><button id="openOnboardingAchievement">업적 도감 확인</button><button id="openConstellationMap">별자리 지도</button></div>';
  U.over.classList.remove("hide");
  document.querySelector("#openOnboardingAchievement").onclick = () => {
    playSfx();
    showAchievements();
  };
  document.querySelector("#openConstellationMap").onclick = () => {
    playSfx();
    showStageSelect();
  };
}
const baseOnboardingDamage = damage;
damage = function (weak = false) {
  baseOnboardingDamage(weak);
  if (onboarding?.phase === 0 && !onboarding.bossHit) {
    onboarding.bossHit = true;
    onboarding.dialogue = 2;
    onboarding.panelVisible = true;
    renderOnboarding();
  }
};
const baseOnboardingTrackBlazeUnit = trackBlazeUnit;
trackBlazeUnit = function (g) {
  baseOnboardingTrackBlazeUnit(g);
  if (
    onboarding &&
    ((onboarding.phase === 1 && g.id === "biyeon") ||
      (onboarding.phase === 2 && g.id === "ria")) &&
    !onboarding.contacts.has(g.id)
  ) {
    onboarding.contacts.add(g.id);
    onboarding.dialogue = 2;
    onboarding.panelVisible = true;
    renderOnboarding();
  }
};
const baseOnboardingWakeUnit = wakeUnit;
wakeUnit = function (g) {
  baseOnboardingWakeUnit(g);
  if (
    onboarding &&
    ((onboarding.phase === 1 && g.id === "biyeon") ||
      (onboarding.phase === 2 && g.id === "ria")) &&
    !onboarding.contacts.has(g.id)
  ) {
    onboarding.contacts.add(g.id);
    onboarding.dialogue = 2;
    onboarding.panelVisible = true;
    renderOnboarding();
  }
};
const baseOnboardingBladeWheelHit = reportBladeWheelHit;
reportBladeWheelHit = function (g, target, amount) {
  baseOnboardingBladeWheelHit(g, target, amount);
  if (onboarding?.phase !== 2 || g.id !== "ria" || onboarding.bladeHit) return;
  onboarding.bladeHit = true;
  onboarding.dialogue = 3;
  onboarding.panelVisible = true;
  renderOnboarding();
};
function showStoryIntro() {
  run = false;
  drag = null;
  setScene("title");
  U.over.className = "overlay story-intro-scene";
  U.over.innerHTML =
    '<section class="story-intro-card" aria-label="잊힌 별의 관측자 프롤로그"><small class="story-intro-kicker">THE LAST OBSERVATORY</small><h2>잊힌 별의 관측자</h2><div class="story-intro-lines"><p>어느 밤부터, 별이 하나씩 꺼졌다.</p><p>이야기가 잊힐 때마다 별이 지고, 그 자리에 공허가 고였다.</p><p>땅에 떨어져 잠든 별지기를 깨우는 방법은 단 하나 — 부딪히는 것.</p><p>관측자여, 유성을 굴려라. 별자리가 기억을 되찾을 것이다.</p></div><small class="story-intro-skip">클릭하여 계속</small></section>';
  const close = () => {
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
showMeta = function () {
  run = false;
  drag = null;
  setScene("meta");
  const stage = currentStage(),
    stageArt = libraryArt.stages[stageIndex],
    avatar = selected[0]
      ? '<img src="' + runeStone(selected[0]) + '" alt="">'
      : "◆";
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
    bumperCount = stage.bumpers?.length || 0,
    stageRule = bumperCount
      ? "공명 범퍼 × " + bumperCount
      : stage.tutorial
        ? "첫 관측 수업"
        : "별자리 전술";
  U.over.className = "overlay meta-scene";
  U.over.innerHTML =
    '<div class="survivor-hub"><div class="hub-night-sky" aria-hidden="true">' +
    storySkyStars(clear) +
    '</div><div class="hub-topbar"><div class="hub-player"><span class="hub-avatar">' +
    avatar +
    '</span><span>OBSERVATORY ID<b>PLAYER 01</b><small>오늘의 밤하늘 관측 중</small></span></div><div class="hub-resources"><span class="hub-resource">되찾은 별<b>' +
    clear +
    '</b></span><span class="hub-resource hub-gold">골드<b>' +
    gold +
    '</b></span><span class="hub-resource">최단 기록<b>' +
    best +
    '</b></span></div></div><section class="hub-battle-card" style="--stage-art:url(\'' +
    stageArt.tile +
    '\')"><div class="hub-battle-crest"><img src="' +
    stageArt.emblem +
    '" alt="' +
    stage.name +
    ' 스테이지 상징"><small>STAGE ' +
    stage.id +
    '</small></div><div class="hub-battle-copy"><small>오늘의 메인 관측</small><h2>' +
    stage.name +
    '</h2><p>' +
    stage.terrain +
    '</p><div class="hub-battle-tags"><span>유성 ' +
    RULES.shots +
    '발</span><span>' +
    stageRule +
    '</span></div></div><button class="hub-stage-change" id="hubStageSelect">스테이지 변경</button><button class="hub-battle-play" id="hubStartBattle"><img src="' +
    metaArt.play +
    '" alt="">관측 시작</button></section><section class="hub-party-panel"><div class="hub-party-heading"><span><small>전투 편성</small><b>별지기 ' +
    selected.length +
    ' / 3</b></span><button id="hubParty">편성</button></div><div class="hub-party-slots">' +
    party +
    '</div></section><section class="hub-utility-grid"><button class="hub-utility" id="hubGacha"><span class="hub-gacha-mark" aria-hidden="true">✦</span><span><strong>별빛 소환</strong><small>새 별지기 만나기</small></span></button><button class="hub-utility" id="hubTutorial"><img src="' +
    metaArt.help +
    '" alt=""><span><strong>튜토리얼</strong><small>조작법 다시 보기</small></span></button><button class="hub-utility" id="hubAchievements"><img src="../assets/library/event/achievement-unlocked.png" alt=""><span><strong>업적</strong><small>관측 기록 확인</small></span></button><button class="hub-utility" id="hubSettings"><img src="../assets/library/system/icon-settings.png" alt=""><span><strong>설정</strong><small>언어 · 사운드</small></span></button></section></div>';
  document.querySelector("#hubStageSelect").onclick = () => {
    playSfx();
    showStageSelect();
  };
  document.querySelector("#hubStartBattle").onclick = () => {
    playSfx();
    showRoster();
  };
  document.querySelector("#hubParty").onclick = () => {
    playSfx();
    showRoster();
  };
  document.querySelector("#hubGacha").onclick = () => {
    playSfx();
    showGacha();
  };
  document.querySelector("#hubTutorial").onclick = () => {
    playSfx();
    showOnboardingTutorial(true);
  };
  document.querySelector("#hubAchievements").onclick = () => {
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
  if (gates.length === 3) {
    constellationReveal = {
      points: gates.map((g) => ({ x: g.x, y: g.y })),
      endsAt: performance.now() + 800,
      mult: ball?.blaze?.mult || 1,
    };
  }
  if (!onboarding) return;
  onboarding.settled = true;
  if (onboarding.phase === 0 && onboarding.bossHit) onboarding.dialogue = 3;
  else if (onboarding.phase === 1 && onboarding.contacts.has("biyeon"))
    onboarding.dialogue = 3;
  else if (onboarding.phase === 2 && onboarding.contacts.has("ria"))
    onboarding.dialogue = 4;
  else onboarding.launched = false;
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
  if (
    !onboarding ||
    !battle ||
    !ball ||
    ball.moving ||
    onboarding.panelVisible !== false ||
    (onboarding.dialogue ?? 0) === 0
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
          ? "리아를 보스 쪽으로"
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
        ? grantGold(ECONOMY.clearGold)
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

// Canonical story and guided-practice layer. Tutorial-only layouts and event
// tracking live here; shared combat rules remain owned by the combat scripts.
const STORY_INTRO_STORAGE = "prism-breakers.story-intro.v1";
const STORY_CONSTELLATION_TOOLTIP =
  "별지기와 부딪히면 자동으로 공명해 별빛이 남습니다. 조준에 쓰지 않은 별빛 셋부터 별자리가 발동합니다.";
if (U.blazeCard) U.blazeCard.title = STORY_CONSTELLATION_TOOLTIP;
const ONBOARDING_STORAGE = "stella-ball.onboarding.v1";
const ONBOARDING_CLEAR_STORAGE = "stella-ball.onboarding-clear.v1";
const PARTY_SLOT_STORAGE = "stella-ball.party-slots.v1";
const onboardingStageSlots = stages[0].slots.map((point) => [...point]);
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
  // The board is the authority on how many seats exist: `setupBattle` reads
  // `stage.slots[i]` per deployed starkeeper, so a party wider than the board
  // has nowhere to sit.  Only two boards are drawn with four seats — the
  // training bench, which needs a fourth so the figure has five points once
  // the meteor joins, and 8-1, whose 1600 HP is balanced for four.  Both
  // declare that by their geometry, so read it there rather than naming the
  // stages.  The other thirty-four boards seat three and stay capped at what
  // the story has unlocked.
  const seats = currentStage()?.slots?.length ?? 3;
  if (seats > 3) return Math.min(seats, Math.max(1, ownedHeroIds().length));
  return hasThirdPartySlot() ? 3 : 2;
}
function unlockThirdPartySlot() {
  appStorage.writeText(PARTY_SLOT_STORAGE, "3");
}
let onboarding = null;
function isOnboardingInputLocked() {
  return Boolean(
    onboarding &&
      (onboarding.panelVisible !== false || onboarding.transitioning),
  );
}
/* 발사각이 «강제»된 수업에서는 항로를 바꾸는 입력도 막는다. 안내가 「저
   거상에게 곧장 간다」고 말해 놓고 플레이어가 클릭 한 번으로 그 항로를
   버릴 수 있으면, 약속한 것이 오지 않고 수업이 조용히 어긋난다.

   2026-08-21: 기준을 2단계에서 0단계로 옮겼다. 강제를 하는 곳이 옮겨졌기
   때문이다 — resolveBilliardAim 훅은 이제 0단계(끌어서 발사)만 보스로
   고정하고, 1·2단계는 플레이어가 찍은 노드의 무게중심으로 나간다. 그래서
   막아야 할 단계는 0단계 하나이고, 1·2단계는 조향이 열려 있어야 캠페인과
   같은 손이 된다. */
function isOnboardingSteerBlocked() {
  return Boolean(onboarding && onboarding.phase === 0);
}
function isOnboardingSessionActive() {
  return Boolean(onboarding);
}
/* 설명 카드가 화면의 주인인 동안인가. game-combat-physics.js의
   drawSteerPrompt가 이걸 묻고 물러난다.

   2026-08-21: 앞의 판정은 `isOnboardingSteerGuided` — 「조향 수업이 자기
   안내를 그리는 중인가」였다. 그 전제가 이미 거짓이다. 1단계는 조향 수업이
   아니라 노드 조준 수업이 됐고, 그 단계가 그리던 조향 안내는 지웠다. 그래서
   저 함수는 «아무도 안내하지 않는 동안» 일반 안내까지 막고 있었다 — 온보딩
   비행 내내 조향 안내가 어디에도 안 떴다.

   그렇다고 그냥 지우면 반대로 샌다. 1단계는 「셋을 찍어 Space」, 2단계는
   「Space 한 번」을 요구하는데 그 위에 「좌클릭 ↶ · 우클릭 ↷」이 얹히면
   지금 눌러야 할 것이 둘로 보인다. 수업 세 단계에서만 접고, 마지막 실전
   (ONBOARDING_FINAL_PHASE)에서는 판이 캠페인과 같아야 하므로 그대로 낸다. */
function isOnboardingLessonPhase() {
  return Boolean(onboarding && onboarding.phase !== ONBOARDING_FINAL_PHASE);
}

/* ── 수업용 정지 ───────────────────────────────────────────────────────
   조향과 패링은 「읽고 나서 누르는」 것이 아니라 「지금 눌러야 하는」 것이라,
   설명 카드를 읽은 뒤 실전에 들어가면 결정 순간이 이미 지나가 있다. 유성이
   결정 지점에 닿으면 판을 세우고, 요구한 입력이 올 때까지 기다린다.

   정지 중에도 기존 입력 핸들러는 그대로 산다. 여기서는 판을 다시 돌리는 일만
   하고, 조향·패링 자체는 평소와 같은 경로가 처리한다 — 수업에서만 통하는
   두 번째 입력 경로를 만들면 실전에서 배운 것이 달라진다. */
/* 어떤 이유로든 입력이 오지 않아도 판이 영영 멈추지는 않게 한다. 가르치는
   장치가 진행을 막는 벽이 되면 안 된다. 충분히 길게 두어 읽고 누를 시간은
   남기고, 그 뒤에는 조용히 풀어 원래 흐름으로 돌려보낸다. */
const TEACH_HOLD_GRACE_MS = 9000;
/* 2026-08-21: 문구 표(`TEACH_HOLD`)를 걷고 문구를 인자로 받는다. 표에 남아
   있던 두 항목이 전부 옛 규칙의 문장이었다 — "좌클릭 ↶ · 우클릭 ↷"(사라진
   조향 수업)와 "지금이에요 — Space로 발사"(핸드오프 §3-2가 지우라고 지목한
   문자열). 부르는 자리가 없는 표는 다음 수업에서 또 같은 방식으로 낡는다. */
function teachingHold() {
  return onboarding?.hold ?? null;
}
function isTeachingHold() {
  return Boolean(onboarding?.hold);
}
function beginTeachingHold(kind, hint) {
  if (!onboarding || onboarding.hold || onboarding.holdDone?.[kind]) return;
  /* 유예는 프레임으로 센다. setTimeout은 벽시계라 일시정지 중에도 흘렀고,
     정지 화면 뒤에서 수업이 조용히 만료됐다 — Escape를 눌러 10초 뒤 돌아오면
     유성이 결정 지점에서 그냥 출발해 조향을 끝내 배우지 못했다. 이 카운터는
     정지 브랜치에서만 줄어드는데, 루프가 `paused`를 그보다 먼저 반환하므로
     일시정지 중에는 저절로 멈춘다. */
  onboarding.hold = {
    kind: kind,
    hint: hint,
    graceLeft: TEACH_HOLD_GRACE_MS / 1000,
  };
  // 판이 서는 순간이 무음이면 「멈춘 버그」로 읽힌다. 시간이 멈춘 것을 귀로도
  // 말한다 — 그림 쪽은 이미 숨 쉬는 고리와 배너가 맡고 있다.
  playSfx("card");
  renderTeachingHold();
}
// 정지가 살아 있는 프레임마다 호출된다. 남은 유예를 다 쓰면 조용히 풀어 원래
// 흐름으로 돌려보낸다.
function tickTeachingHold(d) {
  const hold = teachingHold();
  if (!hold) return;
  hold.graceLeft -= d;
  if (hold.graceLeft <= 0) endTeachingHold();
}
function endTeachingHold() {
  if (!onboarding?.hold) return;
  const kind = onboarding.hold.kind;
  onboarding.holdDone = onboarding.holdDone || {};
  // 한 수업에 한 번만 세운다. 같은 샷에서 두 번 멈추면 가르치는 게 아니라
  // 조작을 막는 것이 된다.
  onboarding.holdDone[kind] = true;
  onboarding.hold = null;
  renderTeachingHold();
}
/* 정지 중에도 캔버스가 살아 있게 하는 벽시계 큐. 판이 멈춘 채 마지막 프레임에
   박제되면 「기다리는 중」이 아니라 「멈춘 버그」로 읽힌다 — 특히 패링 정지는
   약속된 접점 0.18초 앞에서 걸리므로 더 그렇다. 시뮬레이션 시간은 0인 채로,
   유성 둘레에 숨 쉬는 고리와 요구 입력을 그려 화면만 계속 움직인다. */
function drawTeachingHoldCue() {
  const hold = teachingHold();
  if (!hold || !ball) return;
  const t = performance.now();
  const pulse = 1 + Math.sin(t / 260) * 0.16;
  const breathe = 0.55 + Math.sin(t / 340) * 0.3;
  x.save();
  // 판 전체를 살짝 가라앉혀 「시간이 멈췄다」를 화면 언어로 말한다.
  x.fillStyle = "rgba(4, 8, 12, 0.28)";
  x.fillRect(0, 0, W, H);
  x.strokeStyle = "#ffe6a1";
  x.lineWidth = 2;
  x.globalAlpha = breathe;
  x.beginPath();
  x.arc(ball.x, ball.y, (ball.r + 30) * pulse, 0, Math.PI * 2);
  x.stroke();
  x.globalAlpha = 1;
  x.fillStyle = "#fff0bd";
  x.shadowBlur = combatFxBlur(12);
  x.shadowColor = "#ffd36f";
  x.textAlign = "center";
  x.font = "bold 13px Galmuri11, ui-monospace";
  x.fillText(
    "지금 Space",
    ball.x,
    ball.y - ball.r - 40 - Math.sin(t / 300) * 3,
  );
  x.restore();
}
function renderTeachingHold() {
  const dock = document.querySelector("#onboardingDock");
  if (!dock) return;
  let cue = dock.querySelector(".teach-hold");
  const hold = teachingHold();
  if (!hold) {
    if (cue) cue.remove();
    document.body.classList.remove("teaching-hold");
    return;
  }
  if (!cue) {
    cue = document.createElement("div");
    cue.className = "teach-hold";
    cue.setAttribute("role", "status");
    dock.appendChild(cue);
  }
  cue.innerHTML = "<span>" + hold.hint + "</span>";
  document.body.classList.add("teaching-hold");
}
/* 2026-08-21: 마지막 «비행 중 정지»를 걷었다. 지금 이 장치는 부르는 자리가
   없다 — 세 수업이 요구하는 입력(끌기·찍기·Space 발사)이 전부 유성이 멈춘
   뒤의 것이라 멈출 순간이 없기 때문이다. 기계 자체는 남긴다: 「지금 눌러야
   하는」 입력을 가르치는 유일한 도구이고, 전투가 확정되면 수업을 다시 짜기로
   되어 있다(CLAUDE.md). 다시 쓸 때는 beginTeachingHold(kind)를 부르고
   TEACH_HOLD에 그 kind의 문구를 넣으면 된다.

   걷어낸 것은 2단계의 접점 직전 정지였다. AUTO_PARRY가 켜지면서
   requestTrainingParry가 첫 줄에서 false로 돌아가 «누를 것»이 사라졌는데,
   정지만 남아 접점 0.18초 앞에서 판을 세우고 「지금이에요 — Space로 발사」를
   띄우고 있었다. 이미 날아가는 중인 유성 앞에서 발사를 요구하는 화면이다.
   핸드오프 §3-2가 지우라고 지목한 문자열이 정확히 이것이었다. */
// Lessons 1-3 teach against an immortal colossus. Lesson 4 is the real kill,
// so the battle setup asks this before it decides the boss pool.
const ONBOARDING_FINAL_PHASE = 3;
function isOnboardingFinalLesson() {
  return Boolean(onboarding && onboarding.phase === ONBOARDING_FINAL_PHASE);
}
/* 2026-08-21: 수업 1·2단계에 별지기를 세운다.

   새 문안(1f)은 「방금 별지기와 부딪힌 자리마다 별빛이 남은 것 보이나요?」와
   「별지기든 별빛이든 노드를 셋 이상 찍고」를 가르치는데, 이 표는 그 두
   단계를 party: []로 두고 있었다 — 판에 별지기가 없으니 부딪힐 것도 찍을
   것도 없다. 반입 패치가 문안만 바꾸고 배치를 안 바꾼 자리이고, 핸드오프
   §3-1의 「접점 별지기를 발사 항로 위에 두어 공명 1회를 보장」이 이것이다.

   다만 1단계는 비워 둔다. 별지기가 서면 노드가 셋이 되어 aimStarReady()가
   참이 되고, 그 순간 좌클릭이 «찍기»로 넘어가 드래그가 도달 불가능해진다 —
   1단계가 가르치는 것이 바로 그 드래그다. 드래그는 노드가 없을 때의 경로이고,
   수업은 그 순서를 그대로 따라간다: 1단계 드래그 -> 2단계부터 찍기.
   2단계는 셋을 벌려 세워 «넓게 찍으면 세다»가 손에 잡히게 한다. */
const onboardingLayouts = [
  {
    party: [],
    slots: [
      [360, 430],
      [360, 340],
      [360, 480],
    ],
  },
  /* 가운데(발사 항로 위) 자리는 가온이다(2026-08-21, 오너 지시). 파티 순서가
     슬롯 순서 그대로라, STARTER 순서를 쓰면 마지막의 윤슬(관통)이 가운데에
     섰다 — 첫 공명 시범을 받는 얼굴은 시작 검사 가온이어야 한다. 2단계는
     첫 슬롯이 가운데라 STARTER 순서 그대로 가온이 선다. */
  {
    party: ["ria", "biyeon", "gaon"],
    slots: [
      [230, 400],
      [490, 400],
      [360, 545],
    ],
  },
  {
    party: [...STARTER_HERO_IDS],
    slots: [
      [360, 405],
      [255, 500],
      [465, 500],
    ],
  },
  {
    party: ["ria", "biyeon", "gaon"],
    slots: [
      [270, 392],
      [450, 392],
      [360, 520],
    ],
  },
];
function setOnboardingPhase(phase) {
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
    // A live hold must not ride the spread into the next lesson. It would
    // freeze the new lesson on its first frame - the loop takes the hold
    // branch immediately - and it would be the wrong kind, e.g. a steer hold
    // released only by a left/right click sitting on top of the parry lesson.
    hold: null,
    phase,
    dialogue: 0,
    attempts: 0,
    bossHit: false,
    parrySuccess: false,
    aimed: false,
    figurePoints: 0,
    figureResolved: false,
    parriedHero: null,
    launched: finalLesson,
    settled: false,
    transitioning: false,
    panelVisible: !finalLesson,
  };
  setupBattle();
  // 별빛 경제 수업(phase 2)은 안내별 보정으로 «남긴 별빛» 양자리 한 번을
  // 보장한다 — 실전과 같은 규칙(자동 공명·별빛 경제)의 3점 도형이다.
  // 실전 수업(phase 3)은 보정 없이 캠페인과 같은 규칙으로 돈다.
  /* 안내별 «충전»은 쓰지 않는다(0). 충전 경로의 전시 판정은 아직 옛
     pentagram 수업의 것이라, 켜 두면 첫 공명에서 「별을 둘 얹어 뒀어요」
     같은, 이 수업이 가르치지 않는 두-별 서사가 독에 떠 한 화자가 두
     이야기를 하게 된다 — 안내별 셋은 아래에서 직접 깐다. */
  battle.guideStarCharges = 0;
  battle.guideFigure = phase === 2 ? "aries" : null;
  /* 별빛을 미리 깐다 — 이것이 문안이 말하는 「루나의 안내별」이다.

     노드 경제에서 별자리는 «이전 샷이 남긴» 별빛으로 발동한다
     (launchAimStarShot이 발사 직전에 안 고른 별빛을 태운다). 그런데 단계
     진입의 setupBattle이 별빛을 비우고 한 실습은 한 샷이므로, 깔아 두지
     않으면 이 수업은 «구조적으로» 별자리를 못 보여준다 — 첫 샷은 재료를
     만들 뿐이고 그것을 태울 둘째 샷이 없다.

     보스 둘레 삼각형으로 셋을 놓아, 별지기 셋만 찍고 쏘면(수업이 가르치는
     그 손) 남은 셋이 그대로 양자리가 되고 보스를 감싼다. 실전 규칙은 그대로다
     — 별빛을 «주는» 것이지 규칙을 바꾸는 것이 아니다. */
  if (phase === 2 && typeof dropAimStar === "function" && boss) {
    /* 세 번째 점은 [0, 165]였는데 그 좌표가 2단계 가온의 슬롯(360, 405)과
       정확히 겹쳤다 — 안내별이 별지기 머리 위에 앉아, 남길 것과 찍을 것이
       한 자리에 포개졌다. 위로 올려도 삼각형은 여전히 거상을 감싼다. */
    const ring = [
      [-150, -95],
      [155, -90],
      [0, 95],
    ];
    for (const [ox, oy] of ring)
      dropAimStar(
        clamp(boss.x + ox, 30, W - 30),
        clamp(boss.y + oy, 30, H - 30),
        "#ffd27f",
        "안내별",
      );
  }
  msg = [
    "도우미 루나 · 유성을 보스에게 곧장 보내 보세요.",
    "도우미 루나 · 별지기·별빛 노드를 셋 찍고 Space로 쏘세요.",
    "도우미 루나 · 조준에 쓰지 않은 별빛 셋이 별자리가 됩니다.",
    "실전 · 세 별지기를 깨우고 남긴 별빛으로 별자리를 엮어 거상을 무너뜨리세요.",
  ][phase];
  sync();
  renderOnboarding();
}
function beginOnboardingPractice() {
  if (!onboarding) return;
  /* 정지는 「한 샷에 한 번」이지 「한 수업에 한 번」이 아니다. 걸쇠를 시도마다
     비워야 재시도에서도 같은 자리에서 멈춘다 — 한 번만 멈추면 규칙이 아니라
     우연으로 읽힌다. 샷이 도는 중에는 비우지 않으므로 같은 샷에서 두 번
     멈추는 일은 여전히 없다. */
  onboarding.holdDone = null;
  onboarding.panelVisible = false;
  onboarding.launched = true;
  drag = null;
  renderOnboarding();
}
function continueOnboarding(action) {
  if (!onboarding) return;
  playSfx?.("confirm");
  if (action === "learn-aim") return setOnboardingPhase(1);
  if (action === "learn-parry") return setOnboardingPhase(2);
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
  // Six cards, and every one of them waits for the player's button. Gameplay
  // events only record what happened; they never swap the card being read.
  const retried = (onboarding.attempts ?? 0) >= 2;
  const lessons = [
    [
      {
        n: 1,
        title: "안녕하세요, 관측자님. 루나예요.",
        /* 0단계는 resolveBilliardAim이 항로를 거상으로 고정한다. 「당긴
           방향의 반대로 날아간다」라고만 써 두면 옆으로 끌어 본 사람에게
           문안이 거짓말이 된다 — 루나가 항로를 잡아 준다는 사실을 문안이
           직접 말해야 한다. */
        body: "아래의 작은 빛이 유성이에요. 잡고 아래로 끌었다 놓으면 위로 날아갑니다. 첫 발은 제가 항로를 잡아 둘게요.",
        button: "유성 발사하기",
        action: "practice",
      },
      {
        n: 2,
        title: onboarding.bossHit ? "직격! 잘했어요." : "빗나갔네요. 괜찮아요.",
        body: onboarding.bossHit
          ? "별지기를 거치지 않은 직격은 약해요. 다음 판에는 별지기가 섭니다 — 부딪히면 별빛이 남고, 공명은 자동이에요."
          : "각도만 조금 바꾸면 돼요. 아래로 길게 끌수록 세게 날아갑니다. 한 번 더 해볼까요?",
        button: onboarding.bossHit
          ? "다음 · 노드 조준"
          : retried
            ? "괜찮아요, 다음으로"
            : "다시 시도",
        action: onboarding.bossHit || retried ? "learn-aim" : "practice",
      },
    ],
    [
      {
        n: 3,
        title: "이제부터 조준은 «찍기»예요.",
        /* 이 판에는 아직 별빛이 없다(단계 진입의 setupBattle이 비운다).
           규칙은 «별지기든 별빛이든»이 맞지만, 문안이 판에 없는 것을 먼저
           말하면 플레이어는 별빛부터 찾는다 — 지금 판의 노드가 무엇인지를
           문안이 짚는다. */
        body: "밝게 남은 별지기 셋을 찍고 Space로 쏩니다. 유성은 고른 노드들의 가운데로 — 넓게 벌릴수록 세요. 다시 찍으면 무르기예요.",
        button: "셋 찍고 Space로 발사",
        action: "practice",
      },
      {
        n: 4,
        title: onboarding.aimed
          ? "노드 조준으로 쐈어요!"
          : "아직 노드를 셋 찍지 않았어요.",
        body: onboarding.aimed
          ? "빈 곳을 누르면 반대편으로도 쏠 수 있어요. 그런데 조준에 «쓰지 않은» 별빛은 어떻게 될까요?"
          : "유성이 멈춘 뒤 별지기나 별빛을 좌클릭으로 셋 찍으면 금색 길이 생겨요. 그때 Space를 누르면 됩니다.",
        button: onboarding.aimed
          ? "다음 · 별자리"
          : retried
            ? "괜찮아요, 다음으로"
            : "다시 시도",
        action: onboarding.aimed || retried ? "learn-parry" : "practice",
      },
    ],
    [
      {
        n: 5,
        title: "남긴 별빛이 별자리가 돼요.",
        /* 판에는 안내별이 «셋» 깔리고, 가르치는 손은 «별지기 셋만 찍기»다.
           예전 문안 「별빛 하나만 남기고」는 개수도 행동도 판과 달랐고
           6/6 실패 문안(「셋 이상 남긴 채로」)과도 모순이었다 — 깔린 것과
           할 일을 그대로 말한다. */
        body: "안 쓴 별빛이 셋 남으면 별자리로 타오릅니다. 보스 둘레에 안내별 셋을 띄워 뒀어요 — 별지기 셋만 찍고 쏘세요.",
        button: "별빛을 남기고 발사",
        action: "practice",
      },
      {
        n: 6,
        title: onboarding.figureResolved
          ? "첫 별자리가 현현했어요!"
          : "별빛이 별자리가 되지 못했어요.",
        body: onboarding.figureResolved
          ? "고른 별빛은 조준, 남긴 별빛은 별자리 — 한 선택이 두 결과를 냅니다. 별지기는 별자리로 타지 않아요. 이제 진짜로 잡아 볼까요?"
          : "부딪힌 자리의 별빛을 조준에 다 써버리면 별자리 재료가 남지 않아요. 셋 이상 남긴 채로 샷을 끝내 보세요.",
        button: onboarding.figureResolved ? "직접 잡아보기" : "다시 시도",
        // The showcase is the promise of the combat system. Do not let a
        // skipped practice advance before the player has actually seen it.
        action: onboarding.figureResolved ? "final-battle" : "practice",
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
  /* 오너가 이름을 대어 지적한 자리. 여섯 장의 수업 카드가 전부 소리 없이
     나타나고 있었다 — 첫 실행에서 플레이어가 가장 오래 보는 화면인데,
     화면이 바뀐 것을 눈으로만 알 수 있었다. */
  playSfx("card");
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
    bossHit: false,
    parrySuccess: false,
    figureResolved: false,
    parriedHero: null,
    launched: false,
    settled: false,
    transitioning: false,
    panelVisible: true,
  };
  setOnboardingPhase(0);
}
function restoreOnboardingStage() {
  stages[0].slots = onboardingStageSlots.map((point) => [...point]);
}
function clearOnboardingRuntime() {
  restoreOnboardingStage();
  if (onboarding) onboarding.hold = null;
  renderTeachingHold();
  onboarding = null;
  constellationReveal = null;
  run = false;
  drag = null;
  renderOnboarding();
}
function cancelOnboarding() {
  const returnParty = onboarding?.returnParty?.length
    ? [...onboarding.returnParty]
    : [...STARTER_HERO_IDS];
  selected = returnParty;
  deployed = [...returnParty];
  clearOnboardingRuntime();
}
function completeOnboarding() {
  const firstClear = !hasOnboardingClear();
  markOnboardingSeen();
  unlockThirdPartySlot();
  if (firstClear) {
    appStorage.writeText(ONBOARDING_CLEAR_STORAGE, "1");
    progress.clears++;
    grantFreeSummon(1);
    saveProgress();
    announceNewAchievements();
  }
  selected =
    onboarding?.replay && onboarding.returnParty?.length
      ? [...onboarding.returnParty]
      : [...STARTER_HERO_IDS];
  deployed = [...selected];
  clearOnboardingRuntime();
  playSfx?.("unlock");
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
registerRuntimeHook("afterDirectBossDamage", () => {
  // Record only.  The lesson card advances when the player presses the button.
  if (onboarding?.phase === 0) onboarding.bossHit = true;
});
registerRuntimeHook(
  "resolveBilliardAim",
  ({ dx, dy }) => {
    /* 항로를 그리는 수업은 항로를 보장한다. 2단계(패링)는 원래 미리내로
       고정했지만, 1단계(조향)는 「먼저 이 항로로 발사」라고 그려 놓고 강제하지
       않았다 — 조준 보정(billiardAim)이 보스 쪽으로 휘면 지정 항로를 벗어난
       채 수업이 진행됐다. 두 수업 모두 안내가 가리키는 점으로 고정한다. */
    /* 2026-08-21: 1·2단계의 강제를 걷는다.

       이 훅은 조향 수업 시절의 것이다 — 「먼저 이 항로로 발사」라고 그려 놓고
       조준 보정이 휘는 것을 막으려던 장치였다. 그런데 지금 1·2단계가
       가르치는 것은 «노드를 골라 그 가운데로 쏘는 일»이고, 노드 조준도
       fireMeteor -> billiardAim을 지난다. 그래서 플레이어가 셋을 찍어도
       방향이 여기서 통째로 덮여 고정 항로로 날아갔다 — 조준 수업이 조준을
       가르치지 않고 있었다.

       1단계(드래그)만 남긴다. 거기서는 아직 노드가 없어 드래그가 유일한
       조준이고, 「보스에게 곧장」이라는 문안이 항로를 약속한다. */
    const target = onboarding?.phase === 0 ? boss : null;
    if (target && ball) {
      const tx = target.x - ball.x,
        ty = target.y - ball.y,
        distance = Math.hypot(tx, ty) || 1;
      return {
        x: tx / distance,
        y: ty / distance,
        assisted: true,
        tutorialLocked: true,
      };
    }
    return undefined;
  },
  { priority: 100 },
);
/* 2026-08-21: assistParryRequest·afterParryRequest·consumeParryAssist의
   온보딩 쪽 훅을 걷었다. 셋 다 「수업 중에 누른 Space를 접점까지 기억한다」는
   보조였는데, requestTrainingParry가 autoParryOn()에서 즉시 false로 돌아가
   assistParryRequest가 아예 발화하지 않는다. 그래서 parryQueued는 영원히
   false였고 consumeParryAssist의 온보딩 응답도 항상 false였다 — 매 공명마다
   훅을 한 번씩 도는 값만 남아 있었다.
   afterParryContact는 남긴다. 자동 공명에서도 실제로 불리며, 「이 수업의
   공명이 일어났다」를 관찰하는 유일한 자리다(E2E가 읽는다). */
registerRuntimeHook("afterParryContact", ({ gate }) => {
  if (onboarding?.phase !== 2) return;
  onboarding.parrySuccess = true;
  onboarding.parriedHero = gate.id;
});
/* 노드 경제(2026-08-19)에서 별자리는 finishFigureShot이 아니라
   launchAimStarShot이 발사 직전에 태우는 «남긴 별빛»에서 나온다. 그쪽은
   resolveFigure를 직접 부르므로 afterFigureShot은 항상 resolved:false로
   불리고, 아래 훅만 두면 수업 3이 영원히 「별자리가 되지 못했어요」에
   머문다. 실제 발동을 듣는 훅은 이쪽이다. */
registerRuntimeHook("afterFigureResolve", ({ points }) => {
  if (!onboarding || !points || points.length < 3) return;
  onboarding.figureResolved = true;
  onboarding.figurePoints = points.length;
});
registerRuntimeHook("afterFigureShot", ({ missed, resolved }) => {
  if (onboarding?.phase === 2 && !missed && resolved)
    onboarding.figureResolved = true;
});
// Killing the colossus in the closing lesson finishes the tutorial itself
// instead of opening the ordinary battle result screen.
registerRuntimeHook(
  "beforeBattleWin",
  () => {
    if (!onboarding || onboarding.phase !== ONBOARDING_FINAL_PHASE || !battle)
      return false;
    battle.victory = null;
    battleComplete = true;
    run = false;
    assistShots = [];
    completeOnboarding();
    return true;
  },
  { priority: 100 },
);
function showStoryIntro() {
  run = false;
  drag = null;
  setScene("title");
  U.over.className = "overlay story-intro-scene";
  /* 프롤로그 (INTRO_REDESIGN_HANDOFF.md §2-3). 예전에는 네 줄을 한 카드에
     모두 띄우고 아무 데나 누르면 닫혔다 — 읽는 순서도 없고, 각 줄이 무엇을
     말하는지 하늘이 거들지도 않았다. 한 줄씩 4초, 줄마다 하늘이 한 가지씩
     한다. 문구는 규격이 못 박은 대로 기존 원문 그대로 두고 키워드만 칠한다.
     골드는 「되찾을 수 있는 것」(별·별지기·별자리), 마젠타는 「바깥에서 온
     것」(공허) — §1-1의 두 색 규칙이 그대로 문장에 걸린다. */
  const LINES = [
    ["어느 밤부터, <b>별</b>이 하나씩 꺼졌다.", "dim"],
    [
      '이야기가 잊힐 때마다 별이 지고,<br>그 자리에 <b class="void">공허</b>가 고였다.',
      "pool",
    ],
    [
      "땅에 떨어져 잠든 <b>별지기</b>를 깨우는 방법은<br>단 하나 — <b>부딪히는 것</b>.",
      "wake",
    ],
    [
      "관측자여, 유성을 굴려라.<br><b>별자리</b>가 기억을 되찾을 것이다.",
      "link",
    ],
  ];
  U.over.innerHTML =
    '<section class="pro-scene" aria-label="잊힌 별의 관측자 프롤로그">' +
    '<div class="pro-bar pro-bar-t" aria-hidden="true"></div>' +
    '<div class="pro-bar pro-bar-b" aria-hidden="true"></div>' +
    '<div class="pro-sky" aria-hidden="true"><span class="pro-pool"></span>' +
    '<span class="pro-meteor"></span><span class="pro-wake"></span>' +
    '<svg class="pro-links" viewBox="0 0 260 120"><line x1="40" y1="82" x2="130" y2="34"></line>' +
    '<line x1="130" y1="34" x2="222" y2="72"></line></svg></div>' +
    '<small class="pro-kicker">PROLOGUE</small>' +
    '<p class="pro-line" aria-live="polite"></p>' +
    '<small class="pro-hint">클릭하여 계속</small></section>';
  const scene = U.over.querySelector(".pro-scene");
  const lineEl = U.over.querySelector(".pro-line");
  const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  let step = -1;
  let hold = null;
  const advance = () => {
    clearTimeout(hold);
    step += 1;
    if (step >= LINES.length) return close();
    const [html, beat] = LINES[step];
    lineEl.innerHTML = html;
    lineEl.classList.add("pro-enter");
    void lineEl.offsetWidth;
    lineEl.classList.remove("pro-enter");
    // 하늘 비트는 «누적»이다. 별이 꺼진 자리에 공허가 고이고, 그 위로 유성이
    // 떨어진다 — 앞 줄을 지우면 문장들이 이어지지 않는다.
    scene.classList.add("pro-" + beat);
    if (!still) hold = setTimeout(advance, 4000);
  };
  // `once` tears the key listener down on the first KEYPRESS, not when the
  // prologue closes - so closing it with a click left the listener bound for
  // the rest of the session, and every showStoryIntro added another. Release
  // it from close() instead, whichever way the card was dismissed.
  // 키보드로도 한 줄씩 넘어간다 — 마지막 줄에서 누르면 닫힌다.
  const skipStoryIntro = () => {
    if (document.querySelector(".pro-scene")) advance();
  };
  const close = () => {
    // The overlay element is reused by every later screen, so this handler has
    // to be released.  Leaving it attached made any click on the hub, gacha,
    // achievements or settings restart the tutorial underneath them.
    clearTimeout(hold);
    U.over.onclick = null;
    removeEventListener("keydown", skipStoryIntro);
    markStoryIntroSeen();
    playSfx?.("confirm");
    showOnboardingTutorial();
  };
  /* Arm the dismiss handlers on the NEXT turn, not this one. The 게임 시작!
     button lives inside U.over, so the very click that opens the prologue is
     still bubbling when this runs - binding synchronously meant close() fired
     on that same click, the card was marked seen and the tutorial started
     before a single frame had been painted. The prologue was being built and
     destroyed by one press, which is why a first run never showed it. */
  setTimeout(() => {
    if (!document.querySelector(".pro-scene")) return;
    U.over.onclick = advance;
    addEventListener("keydown", skipStoryIntro);
    advance();
  }, 0);
}
function showTitle() {
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
}
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
function showMeta() {
  if (onboarding) cancelOnboarding();
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
    stageRule = mapStage.onboarding
      ? "루나의 관측 수업"
      : stageGimmickLabels(stageData).join(" · ") ||
        "무기믹 전장 · 거상 HP " + (stageData.bossHp ?? RULES.coreHp);
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
        /* 전체화면 지도와 같은 보스 초상을 허브 지도에도 얹는다(§3). 허브가
           「게임 시작」 뒤 처음 보이는 화면이므로, 여기가 비어 있으면 지도를
           고친 것이 플레이어에게 도달하지 않는다. */
        (stageSelectPortrait(entry)
          ? '<img src="' +
            stageSelectPortrait(entry) +
            '" alt="" draggable="false" data-crop-first>'
          : entry.mark) +
        '</span><span class="stage-copy"><small>' +
        (entry.star ? entry.star.bayer : "STAGE " + entry.id) +
        '</small><b class="stage-id">' +
        entry.id +
        '</b><strong class="marquee"><span>' +
        entry.name +
        '</span></strong><span class="marquee"><span>' +
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
    '<div class="survivor-hub hub-map-mode" style="' +
    (WORLD_HUES[world.id] === undefined
      ? "--wc:0;--wh:0"
      : "--wc:1;--wh:" + WORLD_HUES[world.id]) +
    '"><div class="hub-night-sky" aria-hidden="true">' +
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
    '</b></span></div></div><div class="world-band">' +
    WORLDS.filter((entry) => WORLD_HUES[entry.id] !== undefined)
      .map(
        (entry) =>
          '<i class="' +
          (entry.id === world.id
            ? "on"
            : isWorldUnlocked(entry)
              ? "open"
              : "") +
          '" style="--wh:' +
          WORLD_HUES[entry.id] +
          '" title="' +
          entry.name +
          '"></i>',
      )
      .join("") +
    '</div><div class="world-bar"><button class="world-step" id="worldPrev" aria-label="이전 별자리"' +
    (worldNav.prev ? "" : " disabled") +
    '>◀</button><div class="world-name"><small>' +
    world.bayer +
    "</small><b>" +
    world.name +
    "</b><span>" +
    world.lore +
    '</span></div><button class="world-step" id="worldNext" aria-label="다음 별자리"' +
    (worldNav.next ? "" : " disabled") +
    '>▶</button></div><section class="hub-map" aria-label="별자리 스테이지 지도" style="' +
    (worldFigureArt(world.id)
      ? "--figure:url('" + worldFigureArt(world.id) + "')"
      : "--figure:none") +
    '"><svg class="constellation-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
    constellationRoute(mapStages) +
    "</svg>" +
    nodes +
    '</section><section class="hub-mission-bar"><div class="hub-mission-info"><small>' +
    (mapStage.star
      ? mapStage.star.bayer + " · "
      : "STAGE " + mapStage.id + " · ") +
    stageRule +
    '</small><b class="marquee"><span>' +
    mapStage.name +
    '</span></b><span class="hub-mission-hint">별지기는 관측 시작 후 고릅니다</span></div><button class="hub-training" id="hubTraining">무한<br>훈련장</button><button class="hub-battle-play" id="hubStartBattle"><img src="' +
    metaArt.play +
    '" alt="">' +
    (mapStage.onboarding ? "수업 다시 보기" : "게임 시작!") +
    '</button></section><nav class="hub-tabbar" aria-label="관측소 메뉴"><button class="hub-tab" id="hubProfile"><span aria-hidden="true">◎</span><b>프로필</b></button><button class="hub-tab" id="hubGacha"><span aria-hidden="true">☄</span><b>소환</b></button><button class="hub-tab center" id="hubBattleTab"><span aria-hidden="true">★</span><b>관측</b></button><button class="hub-tab" id="hubShop"><span aria-hidden="true">◈</span><b>상점</b></button><button class="hub-tab" id="hubSettings"><span aria-hidden="true">⚙</span><b>설정</b></button></nav></div>';
  applyMarquees(U.over);
  window.StellaPixelUI?.cropSheets?.(".hub-map img[data-crop-first]");
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
}
registerRuntimeHook("afterBattleSetup", ({ stage, battle: activeBattle }) => {
  if (activeBattle.tutorial) {
    activeBattle.shots = 99;
    activeBattle.shotMax = 99;
  }
  msg = activeBattle.training
    ? "무한 훈련장 · 유성은 자동 보충됩니다. 충돌과 별자리 배율을 마음껏 시험하세요. R 키로 나가기."
    : activeBattle.tutorial
      ? "1-1 · 끌어서 발사, 노드 셋 찍고 Space, 남긴 별빛으로 별자리를 익히세요."
      : stage.name +
        " · 노드를 셋 찍어 Space로 쏘고, 남긴 별빛으로 별자리를 그리세요.";
  sync();
});
registerRuntimeHook("afterShotEnd", () => {
  // 수업(battle.tutorial)에서는 루나의 교습 문구가 HUD의 주인이다 —
  // 캠페인 안내가 실습 한 발마다 그 자리를 덮어쓰면 안 된다.
  if (run && battle && !battle.training && !battle.tutorial) {
    msg =
      "다음 유성을 준비하세요. 공명 접점과 남은 배치에서 항로를 다시 설계하세요.";
    sync();
  }
});
registerRuntimeHook("afterPartySettle", ({ figureActive }) => {
  // The dashed "별자리 완성" triangle is the old three-gate reveal.  Where the
  // figure prototype is running it draws its own constellation over the same
  // points, so the two would trace competing shapes on the same beat.
  if (gates.length === 3 && !figureActive) {
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
  // Let the first constellation complete its trace, correction and cast before
  // the result card covers the table. Input stays locked during this short beat.
  /* 노드 경제에서 별자리는 «발사 때» 현현한다(launchAimStarShot이 소각
     즉시 resolveFigure) — 정산 시점엔 캐스트가 비행 내내 끝난 지 오래다.
     예전의 castAt+0.35 대기는 그 옛 시계의 잔재로, 빈 판 위에서 카드만
     1.3초를 더 숨겼다. 정산 여운 한 박자만 남긴다. */
  const resultDelay =
    onboarding.phase === 2 && onboarding.figureResolved ? 420 : 180;
  const phase = onboarding.phase,
    battleId = battle?.id;
  onboarding.transitioning = true;
  onboarding.panelVisible = false;
  renderOnboarding();
  setTimeout(() => {
    if (!onboarding || onboarding.phase !== phase || battle?.id !== battleId)
      return;
    onboarding.transitioning = false;
    onboarding.panelVisible = true;
    renderOnboarding();
  }, resultDelay);
});
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
  x.shadowBlur = combatFxBlur(10);
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
/* 수업 실습의 안내는 «암전 + 손가락»이다(2026-08-21, 오너 지시).

   글씨와 장식을 얹는 대신 화면을 어둡게 내리고 만질 것만 빛 구멍으로
   남기며, 손가락이 그 자리에서 제스처를 반복 시연한다 — 읽는 안내가
   아니라 보는 안내다. 규칙은 카드가 이미 말했으므로 실습 화면에 남는
   글자는 키 이름 «SPACE» 하나뿐이다.

   어둠막은 오프스크린 캔버스에서 만든다. 본 캔버스에 destination-out을
   쓰면 판 자체가 지워진다 — 막을 따로 그려 구멍을 뚫고 한 장으로 얹는다. */
let lessonDimLayer = null;
function lessonDimContext() {
  if (!lessonDimLayer) {
    lessonDimLayer = document.createElement("canvas");
    lessonDimLayer.width = W;
    lessonDimLayer.height = H;
  }
  return lessonDimLayer.getContext("2d");
}
let lessonDimSignature = "";
function drawLessonDim(holes, strength) {
  /* 구멍이 그대로면 어둠막을 다시 굽지 않는다. 조준 대기 중 구멍은 픽
     수가 바뀔 때만 움직이므로, 매 프레임 720x900을 다시 채우는 대신 한
     장을 재사용한다 - 이 게임의 성능 병목은 늘 «래스터할 픽셀 양»이었고
     (PROJECT_CONTEXT 08-18), 가속 없는 기기에서 이 층이 그대로 비용이다. */
  const signature =
    strength +
    "|" +
    holes
      .map((hole) => (hole.x | 0) + "," + (hole.y | 0) + "," + hole.r)
      .join(";");
  if (signature === lessonDimSignature) {
    x.drawImage(lessonDimLayer, 0, 0);
    return;
  }
  lessonDimSignature = signature;
  const d = lessonDimContext();
  d.globalCompositeOperation = "source-over";
  d.clearRect(0, 0, W, H);
  d.globalAlpha = strength;
  d.fillStyle = "#050212";
  d.fillRect(0, 0, W, H);
  d.globalAlpha = 1;
  d.globalCompositeOperation = "destination-out";
  for (const hole of holes) {
    const g = d.createRadialGradient(
      hole.x,
      hole.y,
      hole.r * 0.5,
      hole.x,
      hole.y,
      hole.r,
    );
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    d.fillStyle = g;
    d.beginPath();
    d.arc(hole.x, hole.y, hole.r, 0, Math.PI * 2);
    d.fill();
  }
  x.drawImage(lessonDimLayer, 0, 0);
}
/* ☝ 글리프의 촉이 글자 위쪽에 있다. (tx, ty)를 두드리게 그리려면 몸통을
   목표 아래에 둔다. press는 0~1로, 목표 위 파문의 진행이다. */
function drawLessonFinger(tx, ty, lift, press, alpha = 1) {
  x.save();
  x.globalAlpha = alpha;
  /* 손가락을 도트 스프라이트로(2026-08-22 작화 납품 §1-9) — 판 위 유일한
     시스템 산세리프 글자가 이것으로 사라진다. 촉이 그림 위쪽에 있으므로
     몸통을 목표 아래에 둔다(원래 ☝와 같은 앉음새). 진동(lift)·파문(press)·
     알파는 기존 코드가 계속 맡는다. 그림이 안 온 프레임은 옛 글자 폴백. */
  const fingerSprite =
    typeof loadTexture === "function" && typeof staticArt === "object"
      ? loadTexture(staticArt.glyphHandTap)
      : null;
  if (fingerSprite?.complete && fingerSprite.naturalWidth) {
    x.drawImage(
      fingerSprite,
      Math.round(tx - 16),
      Math.round(ty + 4 + lift),
      32,
      32,
    );
  } else {
    x.font = "28px sans-serif";
    x.textAlign = "center";
    x.lineWidth = 4;
    x.strokeStyle = "#15131c";
    x.strokeText("☝", tx + 9, ty + 38 + lift);
    x.fillStyle = "#fff4cc";
    x.fillText("☝", tx + 9, ty + 38 + lift);
  }
  if (press > 0) {
    x.globalAlpha = alpha * 0.9 * (1 - press);
    x.strokeStyle = "#ffe6a1";
    x.lineWidth = 2.5;
    x.beginPath();
    x.arc(tx, ty, 5 + press * 19, 0, Math.PI * 2);
    x.stroke();
  }
  x.restore();
}
function drawLessonSpaceCue(cx, cy) {
  const pulse = 0.55 + 0.45 * Math.sin(frameClock / 210);
  x.save();
  x.globalAlpha = pulse;
  x.fillStyle = "#0f0a1e";
  x.strokeStyle = "#ffe09a";
  x.lineWidth = 2;
  x.fillRect(cx - 37, cy, 74, 24);
  x.strokeRect(cx - 37, cy, 74, 24);
  x.fillStyle = "#ffe09a";
  x.font = "700 12px Galmuri11, ui-monospace";
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText("SPACE", cx, cy + 13);
  x.textBaseline = "alphabetic";
  x.restore();
}
function onboardingLessonGuideActive() {
  return Boolean(
    onboarding &&
      battle &&
      onboarding.panelVisible === false &&
      onboarding.phase !== ONBOARDING_FINAL_PHASE,
  );
}
function drawOnboardingGuide() {
  if (!run || !onboardingLessonGuideActive() || !ball || ball.moving) return;
  /* 별자리 현현이 도는 동안(입력 잠금)은 가이드도 접는다. 2단계는 발사
     순간 양자리가 뜨는데, 어둠막이 그 위를 덮으면 수업이 약속한 보상이
     어둠 속에서 재생되고 손가락은 잠긴 클릭을 유도한다. */
  if (typeof isCombatInputLocked === "function" && isCombatInputLocked())
    return;
  const phase = onboarding.phase;
  x.save();
  if (phase === 0) {
    /* 끌기 수업: 유성과 거상만 빛에 남긴다. 손가락이 유성을 잡고 아래로
       끄는 시늉을 반복한다 — «여기서 아래로»를 글자 없이 몸으로 말한다. */
    const holes = [{ x: ball.x, y: ball.y, r: 96 }];
    if (boss) holes.push({ x: boss.x, y: boss.y, r: 106 });
    drawLessonDim(holes, 0.6);
    if (boss) {
      x.globalAlpha = 0.45;
      x.strokeStyle = "#ffe6a1";
      x.lineWidth = 1.5;
      x.setLineDash([4, 8]);
      x.beginPath();
      x.moveTo(ball.x, ball.y);
      x.lineTo(boss.x, boss.y);
      x.stroke();
      x.setLineDash([]);
      x.globalAlpha = 1;
    }
    const cycle = (frameClock % 1700) / 1700;
    const slide = cycle < 0.3 ? 0 : cycle < 0.78 ? (cycle - 0.3) / 0.48 : 1;
    const eased = slide * slide * (3 - 2 * slide);
    const fy = ball.y + eased * 118;
    const alpha =
      cycle < 0.08 ? cycle / 0.08 : cycle < 0.9 ? 1 : (1 - cycle) / 0.1;
    if (eased > 0.02) {
      x.globalAlpha = alpha * 0.8;
      x.strokeStyle = "#fff3c2";
      x.lineWidth = 2;
      x.beginPath();
      x.moveTo(ball.x, ball.y);
      x.lineTo(ball.x, fy);
      x.stroke();
      x.globalAlpha = 1;
    }
    const press = cycle > 0.14 && cycle < 0.3 ? (cycle - 0.14) / 0.16 : 0;
    drawLessonFinger(ball.x, fy, 0, press, alpha);
  } else {
    /* 찍기 수업(1·2단계): 노드만 빛에 남기고, 손가락이 아직 안 찍은
       별지기를 차례로 톡톡 두드린다. 셋을 채우면 어둠을 반쯤 걷고
       유성 아래에서 SPACE 키가 맥동한다. 2단계의 안내별은 작은 빛으로
       함께 남긴다 — 만지라는 뜻이 아니라 «남길 것»이라는 뜻이다. */
    const holes = [{ x: ball.x, y: ball.y, r: 88 }];
    for (const g of gates) holes.push({ x: g.x, y: g.y, r: 72 });
    /* 별빛 구멍은 2단계 전유물이 아니다 — 1단계 재시도 판에는 공명이 남긴
       별빛이 있고, 재시도 카드도 「별지기나 별빛을 셋 찍으면」이라고
       가르친다. 문안이 가리키는 것을 어둠이 숨기면 안 된다. */
    for (const s of aimStars) holes.push({ x: s.x, y: s.y, r: 46 });
    const ready = aimPick.length >= AIM_STAR.minPick;
    drawLessonDim(holes, ready ? 0.4 : 0.58);
    if (!ready) {
      let target = null;
      for (let i = 0; i < gates.length; i++)
        if (!aimPick.includes(i)) {
          target = gates[i];
          break;
        }
      if (target) {
        const cycle = (frameClock % 950) / 950;
        const down =
          cycle < 0.4
            ? cycle / 0.4
            : cycle < 0.55
              ? 1
              : 1 - (cycle - 0.55) / 0.45;
        const press = cycle > 0.4 && cycle < 0.7 ? (cycle - 0.4) / 0.3 : 0;
        drawLessonFinger(target.x, target.y, (1 - down) * 16, press);
      }
    } else {
      // 유성이 벽에 붙어 정지했을 때도 키 이름은 화면 안에서 읽혀야 한다.
      drawLessonSpaceCue(
        clamp(ball.x, 64, W - 64),
        ball.y + 76 > H - 8 ? ball.y - 82 : ball.y + 52,
      );
    }
  }
  x.restore();
}
registerRuntimeHook("afterDraw", drawOnboardingGuide);
/* 「카드가 판에 자리를 내준다」(table-live) 장치는 걷었다. 재작성 뒤
   카드는 panelVisible이 false인 순간 DOM에서 제거되므로, «카드가 떠 있는
   채로 판이 움직이는» 상태 자체가 없다 — 매 프레임 있지도 않은 카드를
   찾아 클래스를 토글하던 사문이었다. 카드가 판 위에 남는 설계가 돌아오면
   d99a6a5 이전 판을 참고해 다시 단다. */

registerRuntimeHook("afterSpecialDraw", () => {
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
  x.shadowBlur = combatFxBlur(20);
  x.shadowColor = "#ffe38e";
  if (image?.complete && image.naturalWidth)
    x.drawImage(image, -19, -19, 38, 38);
  else {
    circle(0, 0, 10, "#fff1a5", 15);
    circle(0, 0, 4, "#fff", 2);
  }
  x.restore();
});
registerRuntimeHook("beforeBattleWin", (context) => {
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
        ? accrueGold(ECONOMY.clearGold, currentStage().id + " 클리어 보상")
        : 0;
  if (shouldRecord) {
    battle.storyRecorded = true;
    progress.clears++;
    // Guard the write as well as the load: shotsUsed comes from
    // `battle.shotMax - battle.shots`, and Math.min with anything non-numeric
    // yields NaN, which JSON stores as null and readRecord will not repair
    // because the key exists.
    if (Number.isFinite(shotsUsed))
      progress.bestShots = Math.min(progress.bestShots, shotsUsed);
    progress.bestTime = !progress.bestTime
      ? elapsedMs
      : Math.min(progress.bestTime, elapsedMs);
    saveProgress();
  }
  context.story = {
    shouldRecord,
    partyNames,
    shotsUsed,
    elapsedMs,
    goldEarned,
  };
  return false;
});
registerRuntimeHook("afterBattleWin", (context) => {
  const { shouldRecord, partyNames, shotsUsed, elapsedMs, goldEarned } =
    context.story ?? {};
  if (goldEarned > 0)
    rewardToast(
      "관측 보상함에 적립",
      "+" + goldEarned + " 골드",
      "업적 탭에서 수령하세요",
    );
  // 8-1은 캠페인의 끝이라 win()이 전용 엔딩을 이미 그려 두었다. 이 훅은 win()
  // 다음에 돌면서 오버레이를 통째로 다시 쓰므로, 최종 스테이지에서는 그 카드를
  // 덮지 않는다. 보상 토스트와 업적 안내는 그대로 준다.
  if (shouldRecord && !isFinalStage()) {
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
  if (shouldRecord) announceNewAchievements();
});
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

const OnboardingModule = StellaRuntime.modules.register("onboarding", {
  isActive: isOnboardingSessionActive,
  isInputLocked: isOnboardingInputLocked,
  isLessonGuideActive: onboardingLessonGuideActive,
  isTeachingHold: isTeachingHold,
  blocksSteer: isOnboardingSteerBlocked,
  drawTeachingHoldCue: drawTeachingHoldCue,
  tickTeachingHold: tickTeachingHold,
  isFinalLesson: isOnboardingFinalLesson,
  hasClear: hasOnboardingClear,
  showTutorial: showOnboardingTutorial,
});

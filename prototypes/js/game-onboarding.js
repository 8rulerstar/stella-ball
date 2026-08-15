// Canonical story and guided-practice layer. Tutorial-only layouts and event
// tracking live here; shared combat rules remain owned by the combat scripts.
const STORY_INTRO_STORAGE = "prism-breakers.story-intro.v1";
const STORY_CONSTELLATION_TOOLTIP =
  "성공한 Space 패링 접점이 별빛 노드가 됩니다. 한 샷에 3개 이상 모으면 별자리가 발동합니다.";
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
function isOnboardingSessionActive() {
  return Boolean(onboarding);
}

/* ── 수업용 정지 ───────────────────────────────────────────────────────
   조향과 패링은 「읽고 나서 누르는」 것이 아니라 「지금 눌러야 하는」 것이라,
   설명 카드를 읽은 뒤 실전에 들어가면 결정 순간이 이미 지나가 있다. 유성이
   결정 지점에 닿으면 판을 세우고, 요구한 입력이 올 때까지 기다린다.

   정지 중에도 기존 입력 핸들러는 그대로 산다. 여기서는 판을 다시 돌리는 일만
   하고, 조향·패링 자체는 평소와 같은 경로가 처리한다 — 수업에서만 통하는
   두 번째 입력 경로를 만들면 실전에서 배운 것이 달라진다. */
// 접점까지 남은 시간이 이보다 짧아지면 세운다. 공명 창(0.4초)의 절반 이하라
// 정지 중 누른 Space가 접점까지 넉넉히 살아 있다.
const TEACH_PARRY_LEAD = 0.18;
/* 어떤 이유로든 입력이 오지 않아도 판이 영영 멈추지는 않게 한다. 가르치는
   장치가 진행을 막는 벽이 되면 안 된다. 충분히 길게 두어 읽고 누를 시간은
   남기고, 그 뒤에는 조용히 풀어 원래 흐름으로 돌려보낸다. */
const TEACH_HOLD_GRACE_MS = 9000;
/* 정지 지점을 「판 높이」가 아니라 「그려 준 항로의 진행률」로 잡는다. 예전
   기준 `ball.y < H - 380`은 520px 고정인데 지정 구역은 275px이라, 어떤 출력으로
   쏘든 항로의 48.6~52.5% 지점에서 멈췄다 — 가리킨 자리에 끝내 닿지 못한다는
   제보 그대로다. 두 값을 잇는 것이 아무것도 없어서 보스 좌표만 바뀌어도 둘이
   따로 놀았다. 이제 한쪽만 고치면 다른 쪽이 따라온다.
   그리고 값 자체도 뒤로 옮겼다. 기준을 항로에 묶기만 하고 0.48로 두면 예전과
   같은 자리(48%)라 제보가 그대로 남는다. 0.62면 표식에 눈에 띄게 가까워진
   뒤 멈추고, 꺾인 뒤를 보여 줄 항로가 아직 188px 남는다. */
const TEACH_STEER_ROUTE_FRACTION = 0.62;
const TEACH_HOLD = Object.freeze({
  steer: {
    phase: 1,
    hint: "지금이에요 — <b>좌클릭</b>은 왼쪽, <b>우클릭</b>은 오른쪽",
  },
  parry: { phase: 2, hint: "지금이에요 — <b>Space</b>" },
});
function teachingHold() {
  return onboarding?.hold ?? null;
}
function isTeachingHold() {
  return Boolean(onboarding?.hold);
}
function beginTeachingHold(kind) {
  if (!onboarding || onboarding.hold || onboarding.holdDone?.[kind]) return;
  /* 유예는 프레임으로 센다. setTimeout은 벽시계라 일시정지 중에도 흘렀고,
     정지 화면 뒤에서 수업이 조용히 만료됐다 — Escape를 눌러 10초 뒤 돌아오면
     유성이 결정 지점에서 그냥 출발해 조향을 끝내 배우지 못했다. 이 카운터는
     정지 브랜치에서만 줄어드는데, 루프가 `paused`를 그보다 먼저 반환하므로
     일시정지 중에는 저절로 멈춘다. */
  onboarding.hold = {
    kind: kind,
    hint: TEACH_HOLD[kind].hint,
    graceLeft: TEACH_HOLD_GRACE_MS / 1000,
  };
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
  x.shadowBlur = 12;
  x.shadowColor = "#ffd36f";
  x.textAlign = "center";
  x.font = "bold 13px Galmuri11, ui-monospace";
  x.fillText(
    hold.kind === "steer" ? "좌클릭 ↶ · 우클릭 ↷" : "지금 Space",
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
/* 정지에 걸릴 순간을 매 프레임 살핀다. 조향은 유성이 발사석을 충분히 벗어난
   뒤, 패링은 루나가 고정한 접점에 닿기 직전이다. */
registerRuntimeHook("afterFeedbackUpdate", () => {
  if (!onboarding || onboarding.hold || onboarding.panelVisible !== false)
    return;
  if (!ball?.moving || !run) return;
  if (onboarding.phase === TEACH_HOLD.steer.phase) {
    // 이미 꺾었으면 가르칠 것이 없다.
    if (ball.steerUsed || onboarding.steered) return;
    /* 발사석에서 곧장 세우면 아직 아무것도 안 일어난 화면이라 무엇을 꺾는
       건지 보이지 않는다. 항로의 절반쯤 올라와 궤도가 생기고, 그러면서도
       꺾인 뒤를 보여 줄 자리가 남는 지점에서 세운다. */
    const routeTarget = steerLessonRouteTarget();
    if (
      LAUNCH_Y - ball.y >
      (LAUNCH_Y - routeTarget.y) * TEACH_STEER_ROUTE_FRACTION
    )
      beginTeachingHold("steer");
    return;
  }
  if (onboarding.phase === TEACH_HOLD.parry.phase) {
    /* 이 수업의 문구는 「발사한 뒤 Space를 한 번 누르세요」라, 접점보다 먼저
       누르는 것이 정상 경로다. 그렇게 누른 사람에게 접점 직전에 또 판을
       세우면 이미 한 일을 다시 요구하게 되고, 두 번째 입력이 오지 않으면
       판이 영영 멈춘다. 눌러 둔 것이 있으면 세우지 않는다. */
    if (onboarding.parryQueued || onboarding.parrySuccess) return;
    const gate = gates?.[0];
    if (!gate || currentFigureShot?.()?.parry > 0) return;
    const dx = gate.x - ball.x,
      dy = gate.y - ball.y,
      distance = Math.hypot(dx, dy) || 1;
    const closing = (ball.vx * dx + ball.vy * dy) / distance;
    if (closing <= 0) return;
    /* 거리로 잡으면 안 된다. 공명 창은 0.4초인데 유성 속도는 750~1725px/s에
       마찰까지 붙어, 같은 거리라도 느린 샷은 창이 먼저 닫힌다 — 시킨 대로
       눌렀는데 실패하고 별빛까지 흩어진다. 접점까지 남은 시간으로 잡아
       어떤 속도에서도 누른 뒤가 창 안에 들어오게 한다. */
    const reach = Math.max(0, distance - (gate.r + ball.r));
    if (reach / closing < TEACH_PARRY_LEAD) beginTeachingHold("parry");
  }
});
// 요구한 입력이 오면 푼다. 입력 자체는 평소 핸들러가 처리하므로 여기서는
// 판을 다시 돌리기만 한다. 캡처 단계에서 먼저 받아 정지를 즉시 걷는다.
addEventListener(
  "pointerdown",
  (e) => {
    if (teachingHold()?.kind === "steer" && (e.button === 0 || e.button === 2))
      endTeachingHold();
  },
  true,
);
addEventListener(
  "keydown",
  (e) => {
    if (e.code === "Space" && !e.repeat && teachingHold()?.kind === "parry")
      endTeachingHold();
  },
  true,
);
// Lessons 1-3 teach against an immortal colossus. Lesson 4 is the real kill,
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
    party: [],
    slots: [
      [210, 405],
      [360, 340],
      [360, 480],
    ],
  },
  {
    party: ["biyeon"],
    slots: [
      [360, 405],
      [360, 430],
      [360, 480],
    ],
  },
  {
    party: [...STARTER_HERO_IDS],
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
    steered: false,
    parrySuccess: false,
    figureResolved: false,
    parriedHero: null,
    parryQueued: false,
    launched: finalLesson,
    settled: false,
    transitioning: false,
    panelVisible: !finalLesson,
  };
  setupBattle();
  // The parry lesson adds four non-physical guide stars so one genuine Space
  // parry demonstrates the loudest five-point reveal without faking a contact.
  // The final battle removes the aid and uses the same rules as the campaign.
  battle.guideStarCharges = phase === 2 ? 1 : 0;
  battle.guideFigure = phase === 2 ? "pentagram" : null;
  msg = [
    "도우미 루나 · 유성을 보스에게 곧장 보내 보세요.",
    "도우미 루나 · 유성이 움직일 때 좌·우 클릭 중 하나로 궤도를 한 번 꺾어 보세요.",
    "도우미 루나 · 미리내와 닿기 직전이나 접점 잔광 중 Space로 공명하세요.",
    "실전 · 세 별지기의 패링 각성과 별자리를 엮어 거상을 무너뜨리세요.",
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
  onboarding.parryQueued = false;
  drag = null;
  renderOnboarding();
}
function continueOnboarding(action) {
  if (!onboarding) return;
  playSfx?.("confirm");
  if (action === "learn-steer") return setOnboardingPhase(1);
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
        body: "화면 아래 가운데의 작은 빛이 유성이에요. 마우스로 잡고 아래로 끌었다가 놓으면, 당긴 방향의 반대인 위쪽으로 날아갑니다. 저 공허 거상에게 곧장 보내 보세요.",
        button: "유성 발사하기",
        action: "practice",
      },
      {
        n: 2,
        title: onboarding.bossHit ? "직격! 잘했어요." : "빗나갔네요. 괜찮아요.",
        body: onboarding.bossHit
          ? "유성 자체도 피해를 주지만, 별지기를 거치지 않은 직격은 약해요. 이제 발사 뒤에도 한 번 궤도를 고칠 수 있다는 걸 익혀 볼게요."
          : "각도만 조금 바꾸면 돼요. 아래로 길게 끌수록 세게 날아갑니다. 한 번 더 해볼까요?",
        button: onboarding.bossHit
          ? "다음 · 궤도 전환"
          : retried
            ? "괜찮아요, 다음으로"
            : "다시 시도",
        action: onboarding.bossHit || retried ? "learn-steer" : "practice",
      },
    ],
    [
      {
        n: 3,
        title: "날아가는 유성도 조종할 수 있어요.",
        body: "유성을 먼저 발사한 뒤, 움직이는 동안 좌클릭하면 진행 방향의 왼쪽, 우클릭하면 오른쪽으로 꺾입니다. 두 버튼은 한 발에 합쳐서 딱 한 번만 쓸 수 있어요.",
        button: "발사 후 한 번 꺾기",
        action: "practice",
      },
      {
        n: 4,
        title: onboarding.steered
          ? "궤도를 한 번 꺾었어요."
          : "아직 궤도 전환을 쓰지 않았어요.",
        body: onboarding.steered
          ? "전환은 속도를 조금 더하며 즉시 소모됩니다. 이제 핵심 입력인 Space 패링으로 별지기를 깨우고 고유 능력을 발동해 볼게요."
          : "유성이 움직이기 시작한 다음 캔버스를 좌클릭하거나 우클릭해 보세요. 드래그가 아니라 짧게 한 번 누르면 됩니다.",
        button: onboarding.steered
          ? "다음 · Space 패링"
          : retried
            ? "괜찮아요, 다음으로"
            : "다시 시도",
        action: onboarding.steered || retried ? "learn-parry" : "practice",
      },
    ],
    [
      {
        n: 5,
        title: "첫 공명 항로는 루나가 고정할게요.",
        body: "어느 방향으로 당겨도 이번 유성은 미리내에게 향해요. 발사한 뒤 Space를 한 번 누르세요. 접점에서 공명하면 미리내의 능력과 별빛 하나가 깨어나고, 안내별 넷이 최고의 첫 별자리를 완성합니다.",
        button: "Space로 첫 별자리 열기",
        action: "practice",
      },
      {
        n: 6,
        title:
          onboarding.parrySuccess && onboarding.figureResolved
            ? "공명과 오망성이 이어졌어요!"
            : onboarding.parrySuccess
              ? "패링은 성공했어요."
              : "일반 충돌로 지나갔어요.",
        body:
          onboarding.parrySuccess && onboarding.figureResolved
            ? "미리내의 거리 저격은 패링 순간 발동했고, 실제 접점 하나와 안내별 넷이 오망성을 현현시켰어요. 실전에서는 한 샷에 패링 접점 3개 이상을 직접 모아 여러 별자리를 발동합니다."
            : onboarding.parrySuccess
              ? "공명 각성은 성공했습니다. 별자리는 한 샷이 멈출 때 별빛 노드가 3개 이상이면 발동해요."
              : "그냥 부딪히면 물리 반동만 남아요. 충돌 직전 또는 접점 잔광이 보일 때 Space를 눌러 공명으로 바꿔 보세요.",
        button: onboarding.parrySuccess ? "직접 잡아보기" : "다시 시도",
        // The showcase is the promise of the combat system. Do not let a
        // skipped practice advance before the player has actually seen it.
        action: onboarding.parrySuccess ? "final-battle" : "practice",
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
    bossHit: false,
    steered: false,
    parrySuccess: false,
    figureResolved: false,
    parriedHero: null,
    parryQueued: false,
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
registerRuntimeHook("afterMeteorSteer", () => {
  if (onboarding?.phase === 1) onboarding.steered = true;
});
/* 조향 수업의 지정 항로. 보스에서 비켜난 점이라 꺾어야 의미가 생긴다. 안내
   오버레이와 발사 고정이 같은 점을 봐야 하므로 한 곳에서만 정의한다. */
function steerLessonRouteTarget() {
  return { x: boss.x + 145, y: boss.y + 85, r: 34, col: "#8ee7ff" };
}
registerRuntimeHook(
  "resolveBilliardAim",
  ({ dx, dy }) => {
    /* 항로를 그리는 수업은 항로를 보장한다. 2단계(패링)는 원래 미리내로
       고정했지만, 1단계(조향)는 「먼저 이 항로로 발사」라고 그려 놓고 강제하지
       않았다 — 조준 보정(billiardAim)이 보스 쪽으로 휘면 지정 항로를 벗어난
       채 수업이 진행됐다. 두 수업 모두 안내가 가리키는 점으로 고정한다. */
    const target =
      onboarding?.phase === 2
        ? gates[0]
        : onboarding?.phase === 1
          ? steerLessonRouteTarget()
          : null;
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
registerRuntimeHook("assistParryRequest", () => {
  if (onboarding?.phase !== 2 || !ball?.moving) return false;
  onboarding.parryQueued = true;
  return true;
});
registerRuntimeHook("afterParryRequest", () => {
  if (onboarding?.parrySuccess) onboarding.parryQueued = false;
});
function takeOnboardingParryAssist() {
  if (onboarding?.phase !== 2 || !onboarding.parryQueued) return false;
  onboarding.parryQueued = false;
  return true;
}
registerRuntimeHook("consumeParryAssist", takeOnboardingParryAssist);
registerRuntimeHook("afterParryContact", ({ gate }) => {
  if (onboarding?.phase !== 2) return;
  onboarding.parrySuccess = true;
  onboarding.parriedHero = gate.id;
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
  U.over.innerHTML =
    '<section class="story-intro-card" aria-label="잊힌 별의 관측자 프롤로그"><small class="story-intro-kicker">THE LAST OBSERVATORY</small><h2>잊힌 별의 관측자</h2><div class="story-intro-lines"><p>어느 밤부터, 별이 하나씩 꺼졌다.</p><p>이야기가 잊힐 때마다 별이 지고, 그 자리에 공허가 고였다.</p><p>땅에 떨어져 잠든 별지기를 깨우는 방법은 단 하나 — 부딪히는 것.</p><p>관측자여, 유성을 굴려라. 별자리가 기억을 되찾을 것이다.</p></div><small class="story-intro-skip">클릭하여 계속</small></section>';
  // `once` tears the key listener down on the first KEYPRESS, not when the
  // prologue closes - so closing it with a click left the listener bound for
  // the rest of the session, and every showStoryIntro added another. Release
  // it from close() instead, whichever way the card was dismissed.
  const skipStoryIntro = () => {
    if (document.querySelector(".story-intro-card")) close();
  };
  const close = () => {
    // The overlay element is reused by every later screen, so this handler has
    // to be released.  Leaving it attached made any click on the hub, gacha,
    // achievements or settings restart the tutorial underneath them.
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
    if (!document.querySelector(".story-intro-card")) return;
    U.over.onclick = close;
    addEventListener("keydown", skipStoryIntro);
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
        entry.mark +
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
      ? "1-1 · 드래그 발사, 1회 조향, Space 패링과 별빛 노드를 익히세요."
      : stage.name + " · Space 패링 접점을 모아 별자리를 그리세요.";
  sync();
});
registerRuntimeHook("afterShotEnd", () => {
  if (run && battle && !battle.training) {
    msg =
      "다음 유성을 준비하세요. 패링 접점과 남은 배치에서 항로를 다시 설계하세요.";
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
  const resultDelay =
    onboarding.phase === 2 && onboarding.figureResolved
      ? Math.ceil(
          (StellaRuntime.modules.require("figure").castAt + 0.35) * 1000,
        )
      : 180;
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
    onboarding.panelVisible !== false ||
    onboarding.phase === ONBOARDING_FINAL_PHASE
  )
    return;
  const phase = onboarding.phase;
  if (ball.moving) {
    if (phase === 1 && !ball.steerUsed) {
      /* 쏘라고 그려 준 항로 링이 발사되는 순간 사라졌다. 그래서 판이 멈춘
         시점에는 화면에 목표가 아예 없고, 「왜 여기서 멈췄지」만 남는다.
         비행 중에도 같은 점을 계속 보여 준다 — 정의는 한 곳(steerLessonRouteTarget)뿐이다. */
      const route = steerLessonRouteTarget();
      x.save();
      x.globalAlpha = 0.85;
      x.strokeStyle = route.col;
      x.shadowBlur = 11;
      x.shadowColor = route.col;
      x.lineWidth = 2;
      x.setLineDash([6, 5]);
      x.beginPath();
      x.arc(route.x, route.y, route.r + 1, 0, Math.PI * 2);
      x.stroke();
      x.restore();

      /* 좌·우 클릭이 무엇을 하는지 글자로만 말하고 있었다 — 눈에 띄지 않는다.
         실제 조향 계산(전진 170 + 옆 430)을 그대로 써서 두 방향을 미리 그린다.
         화살표 색은 조향이 남기는 잔광과 같은 색이라, 누른 뒤 나오는 빛과
         누르기 전 안내가 같은 말을 한다. */
      const sp = Math.hypot(ball.vx, ball.vy) || 1,
        ux = ball.vx / sp,
        uy = ball.vy / sp;
      for (const side of [-1, 1]) {
        const dx = ux * 170 + -uy * side * 430,
          dy = uy * 170 + ux * side * 430,
          dl = Math.hypot(dx, dy) || 1,
          tipX = ball.x + (dx / dl) * 62,
          tipY = ball.y + (dy / dl) * 62;
        x.save();
        x.strokeStyle = side < 0 ? "#8ee7ff" : "#ffd18d";
        x.fillStyle = side < 0 ? "#8ee7ff" : "#ffd18d";
        x.shadowBlur = 10;
        x.shadowColor = x.strokeStyle;
        x.lineWidth = 3;
        x.beginPath();
        x.moveTo(ball.x + (dx / dl) * 20, ball.y + (dy / dl) * 20);
        x.lineTo(tipX, tipY);
        x.stroke();
        x.translate(tipX, tipY);
        x.rotate(Math.atan2(dy, dx));
        x.beginPath();
        x.moveTo(9, 0);
        x.lineTo(-6, -6);
        x.lineTo(-6, 6);
        x.fill();
        x.restore();
      }

      x.save();
      x.strokeStyle = "#ffe6a1";
      x.fillStyle = "#fff0bd";
      x.shadowBlur = 11;
      x.shadowColor = "#ffd36f";
      x.lineWidth = 2;
      x.beginPath();
      x.arc(ball.x, ball.y, ball.r + 24, -Math.PI * 0.9, Math.PI * 0.7);
      x.stroke();
      x.textAlign = "center";
      x.font = "bold 10px Galmuri11, ui-monospace";
      x.fillText("좌클릭 ↶ · 우클릭 ↷ · 합산 1회", ball.x, ball.y - 45);
      x.restore();
    } else if (phase === 2 && !onboarding.parrySuccess) {
      const target = gates[0];
      if (target) {
        x.save();
        x.strokeStyle = target.col;
        x.fillStyle = "#fff0bd";
        x.shadowBlur = 11;
        x.shadowColor = target.col;
        x.lineWidth = 2;
        x.beginPath();
        x.arc(target.x, target.y, target.r + 12, 0, Math.PI * 2);
        x.stroke();
        x.textAlign = "center";
        x.font = "bold 10px Galmuri11, ui-monospace";
        x.fillText(
          "항로 고정 · 지금 Space",
          target.x,
          target.y - target.r - 20,
        );
        x.restore();
      }
    }
    return;
  }
  const target =
    phase === 0 ? boss : phase === 1 ? steerLessonRouteTarget() : gates[0];
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
    x.strokeStyle = phase === 0 ? "#f2a48d" : target.col || "#ffe6a1";
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
        : phase === 1
          ? "먼저 이 항로로 발사"
          : "항로 고정 · 발사 후 Space",
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
  x.shadowBlur = 20;
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
  isTeachingHold: isTeachingHold,
  drawTeachingHoldCue: drawTeachingHoldCue,
  tickTeachingHold: tickTeachingHold,
  isFinalLesson: isOnboardingFinalLesson,
  hasClear: hasOnboardingClear,
  showTutorial: showOnboardingTutorial,
});

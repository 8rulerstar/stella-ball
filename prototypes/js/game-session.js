function resetBuild() {
  build = {
    weakFlat: 0,
    chainStep: 0,
    extraShots: 0,
    bounceStep: 0,
    markMultiplier: 1.7,
  };
}
function setupBattle() {
  const s = currentStage(),
    onboardingApi = StellaRuntime.modules.optional("onboarding");
  const tutorial = Boolean(s.tutorial && onboardingApi?.isActive());
  setScene("game");
  clearToastQueue();
  battle = {
    id: ++battleSerial,
    shotMax: RULES.shots + build.extraShots,
    shots: RULES.shots + build.extraShots,
    startedAt: performance.now(),
    slow: 0,
    constel: 0,
    guideStarCharges: s.guideStarCharges ?? 0,
    training: Boolean(s.training),
    tutorial,
  };
  battleComplete = false;
  primeCombatTextures(s);
  // The tutorial keeps the colossus immortal while Luna is teaching, then
  // hands the player a real, winnable fight for the closing lesson.
  const finalLesson = tutorial && onboardingApi?.isFinalLesson();
  const immortal = Boolean(s.training || (tutorial && !finalLesson));
  const hp = immortal
    ? 999999999
    : finalLesson
      ? RULES.tutorialCoreHp
      : (s.bossHp ?? RULES.coreHp);
  boss = {
    ...s.boss,
    hp,
    maxHp: hp,
    immortal,
    a: 0,
    hitCooldown: 0,
  };
  bumpers = (s.bumpers || []).map(([x, y, r], index) => ({
    id: "bumper-" + index,
    x,
    y,
    r,
    on: 0,
  }));
  setupStageGimmicks(s);
  // 대기 상태는 전투마다 새로 시작한다. 남겨 두면 시선과 기울임이 이전 판의
  // 마지막 자세에서 이어져, 새 전투 첫 프레임에 눈이 엉뚱한 곳을 본다.
  resetOutsideBossIdle?.();
  // 포효 상태도 전투마다 비운다. 남으면 다음 판 첫 프레임에 파형이 지나간다.
  bossRoar = null;
  areaBursts = [];
  fieldFx = [];
  ball = null;
  assistShots = [];
  hitCombo = 0;
  comboTimer = 0;
  startShot();
  run = true;
  U.over.classList.add("hide");
  msg = s.training
    ? "무한 훈련장 · 유성은 자동 보충됩니다. 충돌과 별자리 배율을 마음껏 시험하세요. R 키로 나가기."
    : tutorial
      ? "1-1 · 유성을 아래로 끌어 미리내에게 부딪혀 보세요."
      : s.guideStarCharges
        ? s.name + " · 첫 패링이 안내별 둘을 밝혀 별자리를 돕습니다."
        : s.name + " · Space 패링 접점을 모아 별자리를 그리세요.";
  toast(
    s.training
      ? "훈련 시작 · " + bossDisplayName()
      : tutorial
        ? "1-1 · 첫 관측 시작"
        : s.guideStarCharges
          ? "관측 잔광 · 첫 패링으로 안내별을 밝히세요"
          : " " + s.id + " · " + s.name,
  );
  /* 입장 연출. 거상이 «먼저» 온다 — 판이 닫히고 그것이 내려앉은 뒤에 아군이
     맺힌다. 이 순서가 「이미 여기 있었고, 우리가 들어간다」를 말한다.
     첫 진입 1.5초, 재도전 0.6초로 같은 어휘를 압축한다. 어느 쪽이든 첫
     입력에 즉시 건너뛴다.
     온보딩 1-1은 통째로 건너뛴다 — 첫 수업은 이미 안내가 많고, 이 연출은
     두 번째 전투에서 처음 보는 편이 낫다. */
  battleIntro =
    tutorial || s.training
      ? null
      : {
          at: frameClock,
          /* 첫 입장을 2400ms로 늘렸다(§2-4). 캔버스 밴드(introBand 0.2~0.72)는
             그대로이고 늘어난 것은 그 밴드가 걸리는 시간이다 — 거상이 내려앉는
             동안 이름을 부르고 별지기를 소개할 자리가 필요했다.
             재도전 600ms는 그대로다. 같은 판을 다시 볼 때까지 4.9초를 강요하면
             연출이 아니라 벌이 된다. */
          span: introSeenStages.has(s.id) ? 600 : 2400,
        };
  /* 입장 오버레이의 시계. setTimeout으로 짜면 캔버스와 어긋난다 — 캔버스는
     frameClock으로 도는데 벽시계는 탭이 숨거나 프레임이 밀리면 따로 간다.
     오늘 승리 판정에서 같은 어긋남을 한 번 겪었다. 프레임마다 여기서 읽는다. */
  battleCine =
    battleIntro && !introSeenStages.has(s.id)
      ? { at: frameClock, done: 0 }
      : null;
  introSeenStages.add(s.id);
  // 판이 세워지는 소리. 거상의 «말»은 아래 setTimeout이 따로 낸다(speechBoss).
  if (battleIntro) combatSfx?.("battleIntro", 0.95);
  bossOutro = null;
  /* 거상이 판 상단 띠로 한 번 말한다(§5). 입장 연출이 끝날 즈음에 맞춰 띄워
     「이미 여기 있었다」가 말로도 한 번 온다. 수업은 안내가 이미 많아 건너뛴다. */
  if (battleIntro && !tutorial)
    setTimeout(
      () =>
        StellaRuntime.modules
          .optional("speech")
          ?.say("boss", bossDisplayName() + "이(가) 관측을 시작한다"),
      battleIntro.span * 0.55,
    );
  runRuntimeHooks("afterBattleSetup", { stage: s, battle });
  sync();
}
/* 이 스테이지를 이미 본 적이 있는가. 세션 동안만 기억하면 된다 — 재도전이
   잦은 게임이라 「두 번째부터 짧게」가 목적이고, 저장까지 할 값은 아니다. */
const introSeenStages = new Set();
let battleCine = null;
/* 전투 입장 오버레이 (§2-4). 캔버스가 그리는 강하·맺힘 위에 DOM으로 레터박스,
   착지 충격, 네임플레이트, 별지기 컷인, 조작 프롬프트를 얹는다.
   비트는 전부 frameClock 기준이라 캔버스와 절대 어긋나지 않는다. */
/* 비트 클래스는 `is-`로 시작한다. 요소 클래스와 같은 접두사를 쓰면 충돌한다 —
   실제로 비트 `cin-plate`가 요소 `.cin-plate`와 이름이 겹쳐, 그 비트가 켜지는
   순간 컨테이너에도 `.cin-plate { opacity: 0 }`이 걸려 연출 전체가 사라졌다. */
const CINE_BEATS = [
  [0, "is-bars"],
  [2178, "is-land"],
  [2438, "is-plate"],
  [2828, "is-cut1"],
  [3108, "is-cut2"],
  [3388, "is-cut3"],
  [4178, "is-open"],
];
function buildBattleCine() {
  document.querySelector(".cin")?.remove();
  const host = document.querySelector("main");
  if (!host) return null;
  const party = (typeof deployed !== "undefined" ? deployed : []).filter(
    Boolean,
  );
  const cut = party
    .slice(0, 3)
    .map(
      (id, i) =>
        '<span class="cin-portrait cin-p' +
        (i + 1) +
        '" style="--edge:' +
        (heroes[id]?.col || "#ffd98e") +
        '"><i style="background-image:url(' +
        (heroes[id]?.sprite || "") +
        ')"></i><b>' +
        (heroes[id]?.s || "") +
        "</b></span>",
    )
    .join("");
  const box = document.createElement("div");
  box.className = "cin";
  box.setAttribute("aria-hidden", "true");
  box.innerHTML =
    '<span class="cin-bar cin-bar-t"></span><span class="cin-bar cin-bar-b"></span>' +
    '<span class="cin-veil"></span><span class="cin-flash"></span>' +
    '<span class="cin-ring cin-ring-a"></span><span class="cin-ring cin-ring-b"></span>' +
    '<span class="cin-dust"></span>' +
    '<span class="cin-plate"><i class="cin-hair cin-hair-l"></i><b>' +
    bossDisplayName() +
    '</b><i class="cin-hair cin-hair-r"></i></span>' +
    '<span class="cin-cuts">' +
    cut +
    "</span>" +
    '<span class="cin-prompt">SPACE</span>';
  host.append(box);
  return box;
}
/* 프레임마다 경과를 재서 지나간 비트의 클래스를 «켜기만» 한다. 끄지 않으므로
   프레임이 밀려 한 비트를 건너뛰어도 상태가 빠지지 않는다. */
registerRuntimeHook("afterFeedbackUpdate", () => {
  if (!battleCine) return;
  const box = document.querySelector(".cin") || buildBattleCine();
  if (!box) return (battleCine = null);
  const t = frameClock - battleCine.at;
  for (const [ms, cls] of CINE_BEATS)
    if (t >= ms && !box.classList.contains(cls)) {
      box.classList.add(cls);
      if (cls === "is-land") {
        screenShake = Math.max(screenShake || 0, 26);
        for (let i = 0; i < 20; i++) {
          const bit = document.createElement("i"),
            a = (i / 20) * Math.PI * 2;
          bit.style.cssText =
            "--dx:" +
            Math.round(Math.cos(a) * (60 + i * 4)) +
            "px;--dy:" +
            Math.round(Math.sin(a) * (60 + i * 4)) +
            "px";
          box.querySelector(".cin-dust").append(bit);
        }
      }
    }
  if (t > 6000) {
    box.remove();
    battleCine = null;
  }
});
/* 입장 연출의 진행도(0~1). 없으면 1을 돌려주므로 호출자는 분기하지 않는다. */
function introProgress() {
  if (!battleIntro) return 1;
  const t = (frameClock - battleIntro.at) / battleIntro.span;
  if (t >= 1) {
    battleIntro = null;
    return 1;
  }
  return Math.max(0, t);
}
// 첫 입력에 건너뛴다. 재도전이 잦은 게임에서 연출은 기다림이 되면 안 된다.
function skipBattleIntro() {
  battleIntro = null;
}
function startShot(restingPoint = null) {
  const context = { restingPoint, handled: false };
  runRuntimeHooks("beforeShotStart", context);
  if (context.handled) {
    runRuntimeHooks("afterShotStart", context);
    return;
  }
  const s = currentStage();
  ball = {
    x: W / 2,
    y: LAUNCH_Y,
    vx: 0,
    vy: 0,
    r: 13,
    moving: false,
    trail: [],
    power: 0,
    bounces: 0,
    launchPower: 0.35,
    flipperCooldown: 0,
    flipperContact: 0,
  };
  gates = deployed.map((id, i) => ({
    id,
    ...heroes[id],
    x: s.slots[i][0],
    y: s.slots[i][1],
    r: 31,
    on: 0,
    zone: slotRole(i, s).id,
    slot: slotRole(i, s).name,
    hint: slotRole(i, s).hint,
  }));
  for (const bumper of bumpers) bumper.on = 0;
  chain = [];
  drag = null;
  /* 「판이 다시 내 것이 됐다」는 신호. 정산 대기가 렉으로 읽혔던 문제
     (AWAKEN_FX_REQUEST 7절)의 나머지 절반이다 — 언제 다시 쏠 수 있는지를
     눈으로만 알 수 있었다. 정산 소리들이 아직 울리는 중이면 내지 않는다
     (재생기의 정숙 조건). */
  combatSfx?.("shotReady", 0.5);
  runRuntimeHooks("afterShotStart", context);
}
let titleSequence = 0;
/* 타이틀 리빌의 «시간»은 전부 CSS animation-delay가 쥔다(§2-2 표 그대로).
   JS가 맡는 것은 CSS로 못 만드는 둘뿐이다 — 1프레임 플래시 컷과, 워드마크가
   내려앉는 순간 사방으로 튀는 먼지 24개. 타이머로 요소를 하나씩 켜는 방식은
   화면이 바뀌면 유령 타이머가 남으므로 쓰지 않는다. */
window.StellaTitleReveal = function () {
  igTitleReveal();
};
function igTitleReveal() {
  const wrap = document.querySelector(".ig-wm-wrap");
  if (!wrap) return;
  /* 「인트로 다시 보기」로 두 번째 들어올 때, CSS 애니메이션은 이미 끝나 있어
     저절로 다시 돌지 않는다. animation을 잠깐 none으로 덮고 리플로를 강제한
     뒤 되돌리면 지연(animation-delay)까지 처음부터 다시 걸린다.
     요소를 복제해 갈아 끼우는 방법도 있지만 그러면 버튼 핸들러가 함께
     날아간다 — 여기서는 스타일만 건드린다. */
  const animated = document.querySelectorAll(
    ".ig-map,.ig-chart,.ig-wm,.ig-kicker,.ig-cta,.ig-sub,.ig-credit,.ig-ring,.ig-ring2",
  );
  animated.forEach((n) => (n.style.animation = "none"));
  void wrap.offsetWidth;
  animated.forEach((n) => (n.style.animation = ""));
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    document.querySelector(".ig-title")?.classList.add("ig-still");
    return;
  }
  const flash = document.createElement("div");
  flash.className = "ig-flash";
  flash.setAttribute("aria-hidden", "true");
  document.querySelector(".ig-title")?.append(flash);
  setTimeout(() => flash.remove(), 260);
  const dust = wrap.querySelector(".ig-dust");
  const cols = ["#ffd98e", "#c94ff0", "#fff3d6", "#f2b35c"];
  setTimeout(() => {
    if (!dust.isConnected) return;
    for (let i = 0; i < 24; i++) {
      const bit = document.createElement("i"),
        a = (i / 24) * Math.PI * 2 + (i % 3) * 0.4,
        r = 50 + ((i * 37) % 120);
      bit.style.cssText =
        "--dx:" +
        Math.round(Math.cos(a) * r) +
        "px;--dy:" +
        Math.round(Math.sin(a) * r - 40) +
        "px;--dz:" +
        (2 + (i % 3)) +
        "px;background:" +
        cols[i % cols.length] +
        ";animation-duration:" +
        (0.5 + ((i * 13) % 60) / 100).toFixed(2) +
        "s";
      dust.append(bit);
    }
    setTimeout(() => (dust.textContent = ""), 1400);
  }, 360);
}
function renderTitlePresentation() {
  const sequence = ++titleSequence;
  const stars = Array.from(
    { length: 24 },
    (_, i) =>
      '<i style="left:' +
      (((i * 37 + 11) % 94) + 3) +
      "%;top:" +
      (((i * 53 + 7) % 72) + 3) +
      "%;--d:-" +
      ((i % 7) * 0.31).toFixed(2) +
      's"></i>',
  ).join("");
  /* 「별빛 점화」 타이틀 (INTRO_REDESIGN_HANDOFF.md §2-2).
     예전 마크업의 오리온 성도·별밭·돔 SVG를 전부 걷어냈다. 배경 하늘은 이미
     `#dawn-sky`가 그리고 있어 두 벌을 겹쳐 놓을 이유가 없었고, 시안은 하늘을
     비워 워드마크 하나에 시선을 모은다.
     성도는 시안처럼 양자리로 고정하지 않고 지금 서 있는 월드를 그린다 —
     WORLDS[].shape가 이미 월드마다 다른 점 배열을 갖고 있으므로, 고정하면
     여덟 월드가 같은 그림을 쓰게 된다. */
  const world = worldOf(currentStage()) ?? WORLDS[0];
  const pts = (world.shape || WORLDS[0].shape).map(([x, y]) => [
    12 + x * 2.36,
    14 + y * 0.92,
  ]);
  const mapSvg =
    '<svg class="ig-map" viewBox="0 0 260 120" aria-hidden="true">' +
    pts
      .slice(1)
      .map(
        (p, i) =>
          '<line x1="' +
          pts[i][0].toFixed(1) +
          '" y1="' +
          pts[i][1].toFixed(1) +
          '" x2="' +
          p[0].toFixed(1) +
          '" y2="' +
          p[1].toFixed(1) +
          '"></line>',
      )
      .join("") +
    pts
      .map(
        (p, i) =>
          '<circle cx="' +
          p[0].toFixed(1) +
          '" cy="' +
          p[1].toFixed(1) +
          '" r="' +
          (i === Math.floor(pts.length / 2) ? 6 : 4.6) +
          '"></circle>',
      )
      .join("") +
    '<circle class="ig-map-mark" cx="' +
    pts[Math.floor(pts.length / 2)][0].toFixed(1) +
    '" cy="' +
    pts[Math.floor(pts.length / 2)][1].toFixed(1) +
    '" r="12" fill="none" stroke-dasharray="3 4"></circle></svg>';
  U.over.className = "overlay title-scene";
  U.over.innerHTML =
    '<section class="title-sequence ig-title" aria-label="STELLA BALL 시작 화면"><img class="ig-keyart" src="' +
    metaArt.keyartObservatory +
    '" alt="" aria-hidden="true"><div class="ig-copy">' +
    mapSvg +
    '<div class="ig-chart" aria-hidden="true"><i></i><small>' +
    (world.bayer || "ARIES") +
    " · " +
    (world.name || "양자리") +
    ' 관측 항로</small><i></i></div><div class="ig-wm-wrap"><img class="ig-wm" src="' +
    metaArt.wordmarkDot +
    '" alt="STELLA BALL"><span class="ig-ring" aria-hidden="true"></span><span class="ig-ring2" aria-hidden="true"></span><span class="ig-dust" aria-hidden="true"></span></div><small class="ig-kicker">THE LAST OBSERVATORY · CONSTELLATION RESTORATION</small><button class="ig-cta" id="enterHub">관측 시작<i aria-hidden="true"></i></button><div class="ig-sub"><button class="ig-link" id="titleHelp">처음인가요? <b>1분 튜토리얼</b></button><button class="ig-link" id="titleReplayIntro">인트로 다시 보기</button></div><small class="ig-credit">MADE BY <b>8RULERSTAR</b></small></div></section>';
  /* 인트로가 화면을 잡고 있으면 리빌을 미룬다. 지금 돌리면 컷신 뒤에서
     혼자 슬램이 끝나 버려, 정작 타이틀이 드러날 때는 아무 일도 일어나지
     않는다. outer-observer가 releaseStart에서 불러 준다. */
  if (!document.body.classList.contains("oo-intro")) igTitleReveal();
  const enter = document.querySelector("#enterHub");
  /* 인트로 다시 보기(§10). 재생 표식을 첫 실행 단위(localStorage)로 옮기고
     나니 두 번째부터는 전체 연출을 볼 방법이 없어졌다 — 스테이지 지도의
     「튜토리얼 다시보기」와 같은 자리, 같은 어휘로 하나 둔다. */
  const replayIntro = document.querySelector("#titleReplayIntro");
  if (replayIntro)
    replayIntro.onclick = () => {
      playSfx?.("confirm");
      window.StellaIntroObserver?.play("v2");
    };
  document.querySelector("#titleHelp").onclick = () => {
    playSfx?.("confirm");
    if (typeof showOnboardingTutorial === "function")
      showOnboardingTutorial(true);
    else showMeta();
  };
  setTimeout(() => {
    if (
      sequence === titleSequence &&
      document.body.classList.contains("title-mode")
    )
      enter.classList.add("ready");
  }, 1080);
  return enter;
}
let rosterFocus = "gaon";
// One screen owns the whole squad decision.  The field map carries a marker
// per board slot, every owned starkeeper sits in a tray underneath, and the
// player drags one onto the other.  The old pick-then-place split made the
// roster step choose blind and forced the placement step to re-explain the
// same board, which is where the wall of copy came from.
//
// `deployed` is the placement itself: index = board slot, value = hero id, and
// `s.slots[i]` / `s.preview[i]` are that slot on the real table and on the map.
// `selected` stays a mirror of it because the hub and battle summary read it.
function showRoster() {
  run = false;
  setScene("menu");
  const s = currentStage(),
    slotCount = partySlotCount(),
    owned = ownedHeroIds();
  deployed = deployed.filter((id) => owned.includes(id)).slice(0, slotCount);
  for (const id of owned) {
    if (deployed.length >= slotCount) break;
    if (!deployed.includes(id)) deployed.push(id);
  }
  selected = [...deployed];
  if (!owned.includes(rosterFocus)) rosterFocus = deployed[0] || owned[0];
  placementPick = null;
  U.over.className = "overlay squad-scene";
  U.over.innerHTML =
    /* 부제는 제목 칸이 아니라 헤더 전체 폭을 쓴다. 예전에는 제목과 같은
       172px 칸에 갇혀 「STAGE 7-5 · 알리오트 · 기울어진 빛」이 두 줄로 끊기고
       마지막 글자만 홀로 떨어졌다. 폭을 나눠 갖지 않으면 그럴 일이 없다. */
    '<div class="squad-layout"><div class="squad-head"><small>STAGE ' +
    s.id +
    " · " +
    s.name +
    "</small><h2>별지기 " +
    slotCount +
    '명을 자리에 세우세요</h2><p>아래 별지기를 자리로 끌어 놓으세요. 위쪽 자리는 거상과 가깝고, 아래쪽 자리는 멉니다.</p></div><div class="squad-field"><div id="slotChoices" class="deployment-map" aria-label="전장 배치"><span class="map-boss" aria-label="보스">◆</span><span class="map-launch" aria-hidden="true">발사석</span></div><div id="squadDetail" class="squad-detail" aria-live="polite"></div></div><div class="squad-tray-shell"><div class="squad-tray-head"><small>보유 별지기</small><b>' +
    owned.length +
    '명</b></div><div id="squadTray" class="squad-tray" aria-label="보유 별지기"></div></div><div class="overlay-actions"><button id="backMeta">뒤로</button><button id="startTeam">시작</button></div></div>';
  const slotBox = document.querySelector("#slotChoices"),
    tray = document.querySelector("#squadTray"),
    detail = document.querySelector("#squadDetail");
  // The schematic used to pin the colossus with CSS that assumed every stage
  // keeps it at the top of the board.  The training table centres it, so the
  // marker is placed from the stage data the same way the slots below are.
  const bossMark = slotBox.querySelector(".map-boss");
  if (bossMark) {
    const place = (prop, value) =>
      bossMark.style.setProperty(prop, value, "important");
    place("left", (s.boss.x / W) * 100 + "%");
    place("top", (s.boss.y / H) * 100 + "%");
    place("right", "auto");
    place("bottom", "auto");
    place("transform", "translate(-50%, -50%)");
  }
  // Slot indices in the order they were last filled, oldest first.  This is
  // what makes a full party rotate: the next tap evicts whoever has been
  // standing there longest, so repeated taps cycle through the slots.
  let fillOrder = Array.from({ length: slotCount }, (_, i) => i);
  const oldestSlot = () => fillOrder[0] ?? 0;
  const touchSlot = (slot) => {
    fillOrder = [...fillOrder.filter((entry) => entry !== slot), slot];
  };
  /* 잘못 놓은 별지기를 되돌리는 길이 드래그밖에 없었다. 판 위의 말이나
     트레이의 배치된 칸을 더블클릭하면 그 자리를 비운다. 자리를 비우면 시작
     버튼이 인원 수 검사에 걸리므로, 빈 채로 전투에 들어갈 수는 없다. */
  const unplace = (slot) => {
    const id = deployed[slot];
    if (!id) return;
    deployed[slot] = null;
    touchSlot(slot);
    selected = [...deployed];
    rosterFocus = id;
    placementPick = null;
    playSfx?.("card");
    renderAll();
    // 이름 뒤에 조사를 붙이면 받침에 따라 「샛별을」과 「미리내를」이 갈린다.
    // 가운뎃점으로 끊어 조사 자체를 쓰지 않는다.
    toast(heroes[id].s + " · 자리에서 뺐습니다");
  };
  // Dropping a deployed hero swaps the two slots; dropping a benched one takes
  // the slot over and sends its previous occupant back to the tray.
  const place = (id, slot) => {
    if (!heroes[id] || !owned.includes(id)) return;
    const from = deployed.indexOf(id);
    if (from === slot) return;
    if (from >= 0) {
      [deployed[from], deployed[slot]] = [deployed[slot], deployed[from]];
      touchSlot(from);
    } else deployed[slot] = id;
    touchSlot(slot);
    selected = [...deployed];
    rosterFocus = id;
    placementPick = null;
    playSfx?.("confirm");
    renderAll();
  };
  const focus = (id) => {
    rosterFocus = id;
    renderDetail();
  };
  const renderDetail = () => {
    const h = heroes[rosterFocus];
    if (!h) {
      detail.innerHTML = "";
      return;
    }
    const at = deployed.indexOf(rosterFocus),
      zone = at >= 0 ? slotRole(at, s) : null;
    detail.innerHTML =
      '<span class="squad-detail-portrait" style="--unit:' +
      h.col +
      '"></span><div class="squad-detail-copy"><b style="color:' +
      h.col +
      '">' +
      h.n +
      "</b><small>" +
      h.e +
      "</small><p>" +
      h.d +
      '</p></div><span class="squad-detail-zone">' +
      (zone
        ? at + 1 + "번 자리 · " + zone.name + "<i>" + zone.hint + "</i>"
        : "대기 중<i>자리로 끌어 놓으세요</i>") +
      "</span>";
    /* 초상화는 6프레임 스프라이트 시트다. setPortrait에 넘기는 크기가 한
       프레임의 크기이므로, 요소의 실제 상자와 같아야 한다. 46을 넘기면서
       상자는 58px이라 오른쪽에 다음 프레임이 12px 새어 나와, 얼굴 옆에
       정체 모를 글리프가 붙어 보였다. 같은 화면의 다른 초상화 둘(64, 48)은
       상자와 정확히 맞아 새지 않는다. */
    setPortrait(detail.querySelector(".squad-detail-portrait"), h, 58);
  };
  const renderSlots = () => {
    for (const old of slotBox.querySelectorAll(".slot-card")) old.remove();
    for (let i = 0; i < slotCount; i++) {
      const id = deployed[i],
        h = heroes[id],
        zone = slotRole(i, s),
        slot = document.createElement("div");
      slot.className = "slot-card" + (h ? "" : " empty");
      slot.style.left = s.preview[i][0] + "%";
      slot.style.top = s.preview[i][1] + "%";
      if (h) slot.style.setProperty("--unit", h.col);
      slot.draggable = Boolean(h);
      slot.setAttribute(
        "aria-label",
        i +
          1 +
          "번 자리 · " +
          zone.name +
          " · " +
          (h ? h.s + " · 더블클릭하면 뺍니다" : "비어 있음"),
      );
      if (h) slot.title = "더블클릭하면 자리에서 뺍니다";
      slot.innerHTML =
        '<span class="slot-index">' +
        (i + 1) +
        '</span><span class="portrait"></span><b class="slot-name">' +
        (h ? h.s : "비어 있음") +
        '</b><small class="slot-zone">' +
        zone.name +
        "</small>";
      // CSS의 `--slot-portrait`과 같은 값이어야 한다. 어긋나면 스프라이트
      // 시트의 옆 프레임이 말 옆으로 새어 나온다.
      if (h) setPortrait(slot.querySelector(".portrait"), h, 48);
      slot.addEventListener("pointerenter", () => {
        if (h) focus(id);
      });
      slot.addEventListener("click", () => {
        if (placementPick) place(placementPick, i);
        else if (h) {
          placementPick = id;
          focus(id);
          renderTray();
        }
      });
      slot.addEventListener("dblclick", (e) => {
        e.preventDefault();
        unplace(i);
      });
      slot.addEventListener("dragstart", (e) => {
        if (!h) return e.preventDefault();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", id);
        slot.classList.add("dragging");
      });
      slot.addEventListener("dragend", () => slot.classList.remove("dragging"));
      slot.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        slot.classList.add("drop-ready");
      });
      slot.addEventListener("dragleave", () =>
        slot.classList.remove("drop-ready"),
      );
      slot.addEventListener("drop", (e) => {
        e.preventDefault();
        slot.classList.remove("drop-ready");
        place(e.dataTransfer.getData("text/plain"), i);
      });
      slotBox.append(slot);
    }
  };
  const renderTray = () => {
    tray.innerHTML = "";
    /* 별지기가 늘면 트레이가 가로로 잘렸다. 48px 초상화는 칸 하나에 58px을
       요구해서 여덟이면 464px이 필요한데 트레이는 436px뿐이다.
       원본 스프라이트는 192x192이라 48은 1/4, 32는 1/6 — 둘 다 정수 배율이라
       32로 줄여도 픽셀이 뭉개지지 않는다. 여섯까지는 48을 그대로 쓰고, 일곱
       부터만 32로 내려 전원이 한 줄에 들어오게 한다.
       크기를 CSS에만 적으면 setPortrait이 넘겨받는 프레임 크기와 어긋나
       옆 프레임이 새어 나온다(2026-08-18 상세 카드 건). 한 값으로 둘을
       함께 움직인다. */
    const portraitSize = owned.length > 6 ? 32 : 48;
    tray.style.setProperty("--tray-portrait", portraitSize + "px");
    for (const id of owned) {
      const h = heroes[id],
        at = deployed.indexOf(id),
        b = document.createElement("button");
      b.className =
        "squad-unit" +
        (at >= 0 ? " on" : "") +
        (placementPick === id ? " picked" : "");
      b.draggable = true;
      b.style.setProperty("--unit", h.col);
      b.setAttribute("aria-pressed", at >= 0);
      b.setAttribute(
        "aria-label",
        h.s + (at >= 0 ? " · " + (at + 1) + "번 자리" : " · 대기"),
      );
      b.innerHTML =
        '<span class="portrait"></span><b>' +
        h.s +
        "</b>" +
        (at >= 0 ? '<i class="squad-slot-mark">' + (at + 1) + "</i>" : "");
      setPortrait(b.querySelector(".portrait"), h, portraitSize);
      b.addEventListener("pointerenter", () => focus(id));
      b.addEventListener("click", () => {
        // Tapping a benched unit seats it with no second click: an empty slot
        // first, and once the party is full the slot that has been held the
        // longest gives way.  Keep tapping and the party rotates in tap order
        // instead of dead-ending on "파티가 가득 찼습니다".
        if (at < 0) {
          const free = deployed.findIndex((entry) => !entry);
          return place(id, free >= 0 ? free : oldestSlot());
        }
        placementPick = placementPick === id ? null : id;
        focus(id);
        renderTray();
      });
      b.addEventListener("dblclick", (e) => {
        if (at < 0) return;
        e.preventDefault();
        unplace(at);
      });
      b.addEventListener("dragstart", (e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", id);
        b.classList.add("dragging");
      });
      b.addEventListener("dragend", () => b.classList.remove("dragging"));
      tray.append(b);
    }
  };
  const renderAll = () => {
    renderSlots();
    renderTray();
    renderDetail();
  };
  renderAll();
  document.querySelector("#backMeta").onclick = showMeta;
  document.querySelector("#startTeam").onclick = () => {
    if (deployed.filter(Boolean).length !== slotCount)
      return toast(slotCount + "명을 모두 자리에 세워주세요.");
    selected = [...deployed];
    resetBuild();
    setupBattle();
  };
  U.over.classList.remove("hide");
  sync();
  runRuntimeHooks("afterRosterShown");
}
// The placement step now lives inside showRoster().  Keep the old entry point
// for any saved flow that still targets the former deployment screen.
function showDeployment() {
  showRoster();
}
function resultCard(shotsUsed, elapsedMs) {
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
}
/* 8-1은 캠페인의 끝이라 일반 승리 카드로 닫으면 안 된다. 「다른 파티로 더
   짧은 발사를 노려보세요」는 다음 판이 있을 때 할 말이고, 여기서는 다음 판이
   없다. 스펙의 금지선을 그대로 지킨다 — 이 개체에는 끝까지 이름을 주지 않고
   좌표로만 부르며, 살구빛은 되찾은 별자리에만 쓰고 존재 쪽에는 청록-잿빛만
   남긴다. 기록은 지우지 않고 관측 결과로 남긴다는 톤이다. */
const CAMPAIGN_COMPLETE_STORAGE = "stella-ball.campaign-clear.v1";
function isFinalStage() {
  return currentStage()?.world === "outside";
}
function hasCampaignComplete() {
  return appStorage.readText(CAMPAIGN_COMPLETE_STORAGE) === "1";
}
function markCampaignComplete() {
  appStorage.writeText(CAMPAIGN_COMPLETE_STORAGE, "1");
}
function endingCard(shotsUsed, elapsedMs) {
  const seconds = (elapsedMs / 1000).toFixed(1),
    worlds = WORLDS.filter((world) => world.id !== "outside").length,
    replay = hasCampaignComplete();
  return (
    '<div class="outcome-cut ending"><div class="tag">관측 종료</div><h2>' +
    (replay
      ? "다시, 그 점을 마주 보았습니다."
      : "관측되지 않은 점을 관측했습니다.") +
    "</h2>" +
    '<div class="ending-lines"><p>' +
    worlds +
    "개의 별자리가 제자리로 돌아갔습니다.</p>" +
    "<p>성도 밖에서 이쪽을 보고 있던 것은, 이제 성도 안에 기록되었습니다.</p>" +
    "<p>이름은 끝내 알 수 없었습니다. 좌표만 남깁니다 — <b>∅</b></p></div>" +
    '<div class="ending-metrics"><span>마지막 관측<b>' +
    seconds +
    "초</b></span><span>사용 유성<b>" +
    shotsUsed +
    "개</b></span><span>되찾은 별<b>" +
    (progress.clears || 0) +
    "</b></span></div>" +
    '<button onclick="showMeta()">관측소로 돌아가기</button></div>'
  );
}
// The colossus-specific line its caller composes is the useful half of this
// card - it names what survived and why. The parameter was missing, so that
// line was built and thrown away on every loss and the player read the same
// generic sentence whatever they had been fighting.
function fail(reason = "다른 별지기와 다른 궤적으로 다시 관측하세요.") {
  battleComplete = true;
  assistShots = [];
  // The win path clears these; the fail path left split meteors alive on a
  // board nobody is playing any more.
  cloneBalls = [];
  U.over.className = "overlay";
  U.over.innerHTML =
    '<div class="outcome-cut fail"><div class="outcome-constellation" aria-hidden="true"><i>·</i><i>✧</i><i>·</i></div><div class="tag">관측 실패</div><h2>별빛이 닿지 않았습니다.</h2><p>' +
    reason +
    '</p><button onclick="showRoster()">다시 관측하기</button></div>';
  U.over.classList.remove("hide");
}
function scheduleWin() {
  if (!battle || battleComplete || battle.victory) return;
  battleComplete = true;
  ball.moving = false;
  cloneBalls = [];
  assistShots = [];
  battle.victory = {
    t: 0,
    d: 2.55,
    elapsedMs: Math.round(performance.now() - battle.startedAt),
  };
  /* 퇴장(디자인 세션 §11). 지금까지는 값이 0이 되면 거상이 그냥 사라졌다 —
     죽음에 1.4초를 주는 것이 이 게임에서 가장 값싼 개선이다. 새 배관이 필요
     없고 fieldFx가 이미 파편을 그린다.
       0.00–0.18  히트스톱 · 화면이 멈추고 거상만 흰색으로 탄다
       0.18–0.62  금이 간다 — 균열이 약점에서 바깥으로 번진다
       0.62–0.78  파편이 되어 흩어진다 · 흔들림 34px
       0.78–1.40  별빛이 되어 위로 오른다 */
  bossOutro = { at: frameClock };
  // 1.4초짜리 죽음 연출이 통째로 무음이었다. victory는 그 뒤 결과 화면의 것이다.
  combatSfx?.("bossFall", 1.2);
  impactStop = Math.max(impactStop, 0.18);
  screenShake = Math.max(screenShake, 15);
  screenFlash = 1;
  areaBursts.push({
    x: boss.x,
    y: boss.y,
    r: 168,
    col: "#fff0a3",
    t: 0,
    d: 1.15,
  });
  fieldFx.push({
    type: "blaze",
    x: boss.x,
    y: boss.y,
    t: 0,
    d: 1.15,
    col: "#b6c2ff",
  });
  addPopup(boss.x, boss.y - 92, "STAR RETURN!", "#fff0a3", true);
  combatSfx?.("victory", 1.18);
  toast("별이 하늘로 돌아갑니다.");
  if (navigator.vibrate) navigator.vibrate([20, 38, 22, 38, 55]);
}
// The victory verdict rides the same clock as the victory presentation.
// `battle.victory.t` is advanced by the frame loop, which already stops for a
// pause, a menu and a hidden tab, so the cut and the verdict can never drift
// apart. A wall-clock timer used to own this and could resolve the win while
// the table was frozen; it also died outright in one headless environment,
// leaving a dead boss on an unfinished run.
registerRuntimeHook(
  "afterFeedbackUpdate",
  () => {
    const victory = battle?.victory;
    if (victory && victory.t >= victory.d) win();
  },
  { priority: -10 },
);
function resultGoldReward(amount) {
  if (!amount) return "";
  return (
    '<div class="result-gold" aria-label="골드 보상 ' +
    amount +
    '"><i aria-hidden="true"></i><span>클리어 보상</span><b>+' +
    amount +
    " 골드</b></div>"
  );
}
function win() {
  // The re-entrancy guard runs FIRST. It used to sit one line below the hook
  // dispatch, so a win() call this function then refused still fired every
  // beforeBattleWin listener - and those listeners are not observers: the
  // tutorial's final-lesson hook tears the session down, writes the clear
  // flag, increments progress.clears and grants a free summon, and the story
  // hook writes clears/bestShots/bestTime and accrues gold. Only some of that
  // is idempotent. Guarding first makes the hooks unreachable on a win that
  // will not be honoured.
  if (!battle || (battleComplete && !battle.victory)) return;
  const winContext = { battle };
  if (runtimeHookHandled("beforeBattleWin", winContext)) return;
  const victory = battle.victory;
  battleComplete = true;
  run = false;
  assistShots = [];
  const shotsUsed = battle.shotMax - battle.shots,
    elapsedMs =
      victory?.elapsedMs ?? Math.round(performance.now() - battle.startedAt);
  battle.victory = null;
  window.PrismHive?.submitRun({
    stage: currentStage().id,
    party: deployed,
    shotsUsed,
    totalDamage: boss.maxHp,
    elapsedMs,
    source: "browser",
  }).catch(() => {});
  U.over.className = "overlay";
  U.over.innerHTML = isFinalStage()
    ? endingCard(shotsUsed, elapsedMs)
    : '<div class="outcome-cut win"><div class="tag">코어 파괴</div><h2>' +
      bossDisplayName() +
      "을 무너뜨렸습니다.</h2>" +
      resultCard(shotsUsed, elapsedMs) +
      '<p>다른 파티 조합으로 더 짧은 발사를 노려보세요.</p><button onclick="showRoster()">다시 하기</button></div>';
  U.over.classList.remove("hide");
  if (isFinalStage()) markCampaignComplete();
  runRuntimeHooks("afterBattleWin", {
    ...winContext,
    shotsUsed,
    elapsedMs,
  });
}
// One collision can fire several mechanics at once, and the banner used to be
// a single element whose textContent the last one overwrote — so two of three
// messages simply never appeared.  Messages now queue and play in order, each
// held briefly while others wait so the whole chain stays readable.
const TOAST_SOLO_TIME = 2.2;
const TOAST_QUEUED_TIME = 0.9;
const toastQueue = [];
function toast(text) {
  if (!text) return;
  // The same line twice in a row is noise, not a second event.
  const last = toastQueue.length
    ? toastQueue[toastQueue.length - 1]
    : toastTimer > 0
      ? currentToastText
      : null;
  if (text === last) return;
  /* 알림이 «떴다»는 것 자체가 소리를 가진 적이 없다. 잦은 사건이라 가장
     조용한 큐를 쓰고, 재생기 쪽 간격표가 연속 알림을 묶는다. */
  if (typeof combatSfx === "function") combatSfx("toast", 0.42);
  toastQueue.push(text);
  if (toastTimer <= 0) return showNextToast();
  // Something arrived while a banner is still up.  Cut its hold short so the
  // burst plays as a sequence instead of the first line eating two seconds.
  toastTimer = Math.min(toastTimer, TOAST_QUEUED_TIME);
  paintToastBadge();
}
function paintToastBadge() {
  U.toast.querySelector(".toast-more")?.remove();
  if (!toastQueue.length) {
    U.toast.classList.remove("queued");
    return;
  }
  const more = document.createElement("i");
  more.className = "toast-more";
  more.textContent = "+" + toastQueue.length;
  U.toast.append(more);
  U.toast.classList.add("queued");
}
function showNextToast() {
  const next = toastQueue.shift();
  if (next === undefined) {
    currentToastText = "";
    U.toast.classList.remove("show", "queued");
    return;
  }
  currentToastText = next;
  U.toast.textContent = next;
  paintToastBadge();
  U.toast.classList.add("show");
  toastTimer = toastQueue.length ? TOAST_QUEUED_TIME : TOAST_SOLO_TIME;
}
/* 배너 카운트다운. 원래 update() 안에 인라인으로 있었는데, 수업의 teaching
   hold는 시뮬레이션을 통째로 멈추면서 화면은 계속 그린다 — 그래서 발사 직후
   뜬 배너가 정지 내내 그 자리에 굳어 있었다. 살아 있는 「지금 누르세요」 큐
   옆에서 멈춘 배너는 「기다리는 중」이 아니라 「멈춘 버그」로 읽힌다.
   정지 분기에서도 이것만 따로 돌린다. 정지 밖에서는 예전과 완전히 같다. */
function advanceToastQueue(d) {
  if (toastTimer <= 0) return;
  toastTimer -= d;
  if (toastTimer <= 0) showNextToast();
}
function clearToastQueue() {
  toastQueue.length = 0;
  currentToastText = "";
  toastTimer = 0;
  U.toast.classList.remove("show", "queued");
}
function damageAdd(a, amount, label, col) {
  if (a.down > 0) return;
  a.hitCooldown = Math.max(a.hitCooldown, 0.24);
  a.hp = Math.max(0, a.hp - amount);
  addPopup(a.x, a.y - 24, label + " " + amount, col, amount >= 18);
  if (a.hp <= 0) {
    a.down = 1.6;
    areaBursts.push({ x: a.x, y: a.y, r: 44, col, t: 0, d: 0.42 });
    toast("공허 잔재 처치!");
  }
}
function areaAttack(name, amount, col) {
  if (!boss || boss.hp <= 0 || battleComplete) return;
  const dealt = applyBossHit(amount);
  registerBossHit(false);
  impact(true);
  if (dealt > 0) addPopup(boss.x, boss.y - 80, name + " " + dealt, col, true);
  areaBursts.push({ x: boss.x, y: boss.y, r: 112, col, t: 0, d: 0.42 });
  for (const a of adds) damageAdd(a, amount, name, col);
  toast(name + " · 전 적 광역 피해");
  if (boss.hp <= 0) scheduleWin();
  sync();
}
function syncBossHealth() {
  const label = boss
    ? boss.immortal
      ? "체력 ∞"
      : "체력 " + Math.ceil(boss.hp)
    : "체력 —";
  const fill =
    "scaleX(" + (boss ? (boss.immortal ? 1 : boss.hp / boss.maxHp) : 0) + ")";
  if (hudState.bossLabel !== label) {
    U.hp.textContent = label;
    hudState.bossLabel = label;
  }
  // The name beside the bar used to be static markup, so every stage claimed
  // the void colossus. Stage 8-1 shows its coordinate instead.
  const name = bossDisplayName();
  if (U.bossName && hudState.bossName !== name) {
    U.bossName.textContent = name;
    hudState.bossName = name;
  }
  if (hudState.bossFill !== fill) {
    U.hpFill.style.transform = fill;
    hudState.bossFill = fill;
  }
}
const hudState = {
  bossLabel: null,
  bossName: null,
  bossFill: null,
  shots: null,
  phase: null,
  power: null,
  chain: null,
  tip: null,
  summary: null,
};
function sync() {
  const unlimitedShots = Boolean(
    battle && (battle.training || battle.tutorial),
  );
  const shotsText = battle
    ? unlimitedShots
      ? "∞ · 관측 유성"
      : battle.shots + " / " + battle.shotMax
    : "—";
  const shotsKey = battle
    ? unlimitedShots
      ? battle.training
        ? "training"
        : "tutorial"
      : battle.shots + "/" + battle.shotMax
    : "none";
  if (hudState.shots !== shotsKey) {
    U.shotsText.textContent = shotsText;
    U.shotDots.innerHTML = battle
      ? unlimitedShots
        ? "관측 유성 · 무제한"
        : Array.from(
            { length: battle.shotMax },
            (_, i) =>
              '<img class="shot-icon" src="../assets/library/ui/shot-dot-' +
              (i < battle.shots ? "on" : "off") +
              '.png" alt="' +
              (i < battle.shots ? "사용 가능" : "사용 완료") +
              '">',
          ).join("")
      : "—";
    hudState.shots = shotsKey;
  }
  const phase = battle
    ? battle.training
      ? "훈련 · " + bossDisplayName()
      : battle.tutorial
        ? "관측 수업 · " + bossDisplayName()
        : "전투 · " + bossDisplayName()
    : "전투 준비";
  if (hudState.phase !== phase) {
    U.phase.textContent = phase;
    hudState.phase = phase;
  }
  syncBossHealth();
  const power = RULES.baseDamage + build.weakFlat;
  if (hudState.power !== power) {
    U.power.textContent = power;
    hudState.power = power;
  }
  const chained = chain.length ? chain.join(" → ") : "—";
  if (hudState.chain !== chained) {
    U.chain.textContent = chained;
    hudState.chain = chained;
  }
  if (hudState.tip !== msg) {
    U.tip.textContent = msg;
    hudState.tip = msg;
  }
  const summaryKey =
    (currentStage()?.id ?? stageIndex) +
    "|" +
    deployed.map((id, index) => id + ":" + slotRole(index).id).join("|");
  if (hudState.summary !== summaryKey) {
    U.summary.innerHTML = deployed
      .map((id, i) => {
        const h = heroes[id],
          zone = slotRole(i);
        return (
          "<div><b>" +
          zone.name +
          "</b><br>" +
          h.n +
          " · " +
          zone.hint +
          "</div>"
        );
      })
      .join("");
    hudState.summary = summaryKey;
  }
}
function pointer(e) {
  const r = c.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) * W) / r.width,
    y: ((e.clientY - r.top) * H) / r.height,
  };
}
function isCombatInputLocked() {
  const onboardingApi = StellaRuntime.modules.optional("onboarding"),
    figureApi = StellaRuntime.modules.optional("figure");
  return (
    Boolean(onboardingApi?.isInputLocked()) ||
    Boolean(figureApi?.isResolutionPending())
  );
}
// Pause keeps the arena on screen and frozen: the scene stays "game" so the
// table still draws, and `run` alone stops the solver.  A lesson card already
// blocks play, so pausing on top of one is refused instead of stacking.
let paused = false;
function canPauseBattle() {
  return Boolean(
    battle && !battleComplete && isRuntimeScene("game") && !battle.victory,
  );
}
function showPauseMenu() {
  if (paused || !canPauseBattle() || isCombatInputLocked()) return;
  paused = true;
  run = false;
  drag = null;
  playSfx?.();
  U.over.className = "overlay pause-scene";
  U.over.innerHTML =
    '<section class="pause-card" role="dialog" aria-modal="true" aria-label="일시정지"><small class="pause-kicker">PAUSED</small><h2>관측을 잠시 멈췄습니다</h2><p>전장은 그대로 남아 있습니다. 준비되면 이어서 관측하세요.</p><div class="pause-actions"><button id="pauseResume" class="pause-primary">계속하기</button><button id="pauseSettings">설정</button><button id="pauseExit" class="pause-exit">관측소로 나가기</button></div><small class="pause-hint">ESC 키로도 열고 닫을 수 있습니다</small></section>';
  U.over.classList.remove("hide");
  document.querySelector("#pauseResume").onclick = resumeBattle;
  document.querySelector("#pauseSettings").onclick = () => {
    playSfx?.();
    // Settings returns here, not to the hub, so the battle is never dropped.
    showSettings(showPauseMenuFromSettings);
  };
  document.querySelector("#pauseExit").onclick = () => {
    playSfx?.();
    // Leaving means the battle is over. Without this the abandoned fight stayed
    // live behind every menu - `battle` non-null with battleComplete false -
    // and its toast banner kept its `show` class over the hub, the shop and the
    // summon screen, because the toast timer only ticks inside update() and the
    // frame loop stops running it once the scene is no longer the game.
    battleComplete = true;
    clearToastQueue();
    paused = false;
    showMeta();
  };
  document.querySelector("#pauseResume").focus({ preventScroll: true });
}
function showPauseMenuFromSettings() {
  /* Returning from settings has to re-open the pause card, and showPauseMenu
     refuses while `paused` is still set. The old order dropped the freeze flag
     and switched the body class back to game-mode BEFORE finding out whether
     the menu would actually open - if it refused, the battle was left
     unfrozen but not running with the settings markup still on screen. Ask
     first, and only give up the flag when the card is really going to appear;
     otherwise fall back to the hub rather than stranding the player. */
  // The scene has to go back first - canPauseBattle() checks it - but the
  // freeze flag must not be dropped until the card is certain to appear.
  setScene("game");
  if (!canPauseBattle() || isCombatInputLocked()) {
    paused = false;
    showMeta();
    return;
  }
  paused = false;
  showPauseMenu();
}
function resumeBattle() {
  if (!paused) return;
  paused = false;
  drag = null;
  playSfx?.();
  U.over.innerHTML = "";
  U.over.className = "overlay";
  U.over.classList.add("hide");
  run = true;
}
function togglePauseMenu() {
  // Settings can sit on top of a paused battle, so resuming is only allowed
  // from the arena itself.  Otherwise Escape would unfreeze combat behind a
  // menu the player is still reading.
  if (!isRuntimeScene("game")) return;
  if (paused) return resumeBattle();
  showPauseMenu();
}
// Aiming and launching belong to the billiards pass: `game-combat.js` binds
// pointerdown/move/up on this same canvas in the capture phase, which runs
// before any bubble listener here even though this file loads first.  The
// plunger-and-flipper handlers this file used to add were unreachable because
// of that, so they are gone; only the shared cancel guard stays.
c.addEventListener("pointercancel", () => {
  drag = null;
});
addEventListener("keydown", (e) => {
  // Escape is checked before the combat guards so it still works during a
  // tutorial practice shot, where the rest of the keyboard stays locked.
  if (e.key === "Escape") {
    e.preventDefault();
    return togglePauseMenu();
  }
  if (
    paused ||
    isCombatInputLocked() ||
    StellaRuntime.modules.optional("onboarding")?.isActive()
  )
    return;
  if (
    e.key.toLowerCase() === "r" &&
    !e.altKey &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.shiftKey &&
    isRuntimeScene("game") &&
    battle &&
    !battleComplete
  ) {
    e.preventDefault();
    showRoster();
  }
});
// Touch and mouse players never get a keyboard, so the same menu is one tap
// away from the arena.  The button lives beside the canvas, not in the HUD
// markup, so the document contract in the smoke test stays unchanged.
(() => {
  const button = document.createElement("button");
  button.type = "button";
  button.id = "pauseButton";
  button.className = "pause-button";
  button.setAttribute("aria-label", "일시정지");
  button.innerHTML = '<span aria-hidden="true">❚❚</span>';
  button.onclick = () => togglePauseMenu();
  stageEl?.append(button);
})();

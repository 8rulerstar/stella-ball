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
  const s = currentStage();
  setScene("game");
  clearToastQueue();
  battle = {
    id: ++battleSerial,
    shotMax: RULES.shots + build.extraShots,
    shots: RULES.shots + build.extraShots,
    startedAt: performance.now(),
    slow: 0,
    constel: 0,
    training: Boolean(s.training),
    tutorial: Boolean(s.tutorial),
  };
  battleComplete = false;
  primeCombatTextures();
  // The tutorial keeps the colossus immortal while Luna is teaching, then
  // hands the player a real, winnable fight for the closing lesson.
  const finalLesson =
    Boolean(s.tutorial) &&
    typeof isOnboardingFinalLesson === "function" &&
    isOnboardingFinalLesson();
  const immortal = Boolean(s.training || (s.tutorial && !finalLesson));
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
    : s.tutorial
      ? "1-1 · 유성을 아래로 끌어 미리내에게 부딪혀 보세요."
      : s.name + " · 별지기를 깨우고, 멈춘 자리로 별자리를 그리세요.";
  toast(
    s.training
      ? "훈련 시작 · 불멸의 거상"
      : s.tutorial
        ? "1-1 · 첫 관측 시작"
        : " " + s.id + " · " + s.name,
  );
  sync();
}
function startShot() {
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
}
let titleSequence = 0;
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
  U.over.className = "overlay title-scene";
  U.over.innerHTML =
    '<section class="title-sequence" aria-label="STELLA BALL 시작 화면"><div class="title-stars" aria-hidden="true">' +
    stars +
    '</div><div class="title-dawn" aria-hidden="true"></div><div class="title-constellation" aria-hidden="true"><svg class="title-sky-map" viewBox="0 0 720 410" preserveAspectRatio="xMidYMid meet"><defs><radialGradient id="titleNebula"><stop offset="0%" stop-color="#ffd9ea" stop-opacity=".5"></stop><stop offset="45%" stop-color="#9aa8ff" stop-opacity=".26"></stop><stop offset="100%" stop-color="#9aa8ff" stop-opacity="0"></stop></radialGradient><radialGradient id="titleSkyGlow"><stop offset="0%" stop-color="#8fa4ff" stop-opacity=".2"></stop><stop offset="100%" stop-color="#8fa4ff" stop-opacity="0"></stop></radialGradient></defs><ellipse class="title-sky-halo" cx="352" cy="212" rx="290" ry="200" fill="url(#titleSkyGlow)"></ellipse><g class="title-sky-dome"><path class="title-dome-arc" d="M16 126 Q360 -26 704 126"></path><g class="title-dome-ticks"><line x1="16.0" y1="126.0" x2="20.4" y2="136.1"></line><line x1="59.0" y1="108.2" x2="61.2" y2="113.8"></line><line x1="102.0" y1="92.8" x2="103.9" y2="98.4"></line><line x1="145.0" y1="79.7" x2="146.6" y2="85.5"></line><line x1="188.0" y1="69.0" x2="190.4" y2="79.7"></line><line x1="231.0" y1="60.7" x2="232.0" y2="66.6"></line><line x1="274.0" y1="54.8" x2="274.7" y2="60.7"></line><line x1="317.0" y1="51.2" x2="317.3" y2="57.2"></line><line x1="360.0" y1="50.0" x2="360.0" y2="61.0"></line><line x1="403.0" y1="51.2" x2="402.7" y2="57.2"></line><line x1="446.0" y1="54.8" x2="445.3" y2="60.7"></line><line x1="489.0" y1="60.7" x2="488.0" y2="66.6"></line><line x1="532.0" y1="69.0" x2="529.6" y2="79.7"></line><line x1="575.0" y1="79.7" x2="573.4" y2="85.5"></line><line x1="618.0" y1="92.8" x2="616.1" y2="98.4"></line><line x1="661.0" y1="108.2" x2="658.8" y2="113.8"></line><line x1="704.0" y1="126.0" x2="699.6" y2="136.1"></line></g></g><g class="title-sky-dust"><circle cx="42" cy="152" r="1.4" style="--td:0.00s"></circle><circle cx="86" cy="96" r="1.2" style="--td:0.29s"></circle><circle cx="148" cy="64" r="1.5" style="--td:0.58s"></circle><circle cx="212" cy="116" r="1.2" style="--td:0.87s"></circle><circle cx="252" cy="42" r="1.3" style="--td:1.16s"></circle><circle cx="300" cy="104" r="1.2" style="--td:1.45s"></circle><circle cx="330" cy="152" r="1.1" style="--td:1.74s"></circle><circle cx="404" cy="52" r="1.4" style="--td:2.03s"></circle><circle cx="430" cy="118" r="1.2" style="--td:2.32s"></circle><circle cx="476" cy="86" r="1.3" style="--td:2.61s"></circle><circle cx="524" cy="128" r="1.2" style="--td:2.90s"></circle><circle cx="580" cy="74" r="1.4" style="--td:3.19s"></circle><circle cx="622" cy="142" r="1.2" style="--td:0.28s"></circle><circle cx="664" cy="96" r="1.3" style="--td:0.57s"></circle><circle cx="688" cy="52" r="1.2" style="--td:0.86s"></circle><circle cx="112" cy="196" r="1.2" style="--td:1.15s"></circle><circle cx="600" cy="220" r="1.3" style="--td:1.44s"></circle><circle cx="62" cy="58" r="1.6" style="--td:0.00s"></circle><circle cx="124" cy="132" r="1.3" style="--td:0.37s"></circle><circle cx="92" cy="318" r="1.5" style="--td:0.74s"></circle><circle cx="168" cy="214" r="1.2" style="--td:1.11s"></circle><circle cx="318" cy="68" r="1.4" style="--td:1.48s"></circle><circle cx="286" cy="140" r="1.2" style="--td:1.85s"></circle><circle cx="398" cy="96" r="1.3" style="--td:2.22s"></circle><circle cx="452" cy="140" r="1.2" style="--td:2.59s"></circle><circle cx="560" cy="190" r="1.5" style="--td:2.96s"></circle><circle cx="608" cy="110" r="1.3" style="--td:3.33s"></circle><circle cx="636" cy="290" r="1.4" style="--td:0.30s"></circle><circle cx="542" cy="330" r="1.2" style="--td:0.67s"></circle><circle cx="398" cy="344" r="1.3" style="--td:1.04s"></circle><circle cx="160" cy="388" r="1.2" style="--td:1.41s"></circle><circle cx="672" cy="206" r="1.4" style="--td:1.78s"></circle></g><ellipse class="title-sky-nebula" cx="350" cy="296" rx="62" ry="44" fill="url(#titleNebula)"></ellipse><path class="title-constellation-line line-main" d="M236 352 L286 238 L360 226 L434 214 L488 366"></path><path class="title-constellation-line line-cross" d="M196 84 L286 238"></path><path class="title-constellation-line line-cross line-cross-b" d="M508 66 L434 214"></path><path class="title-constellation-line line-spine" d="M196 84 L508 66"></path><path class="title-constellation-line line-head" d="M196 84 L350 22 L508 66"></path><path class="title-constellation-line line-sword" d="M360 226 L352 282 L347 308 L343 330"></path><g class="title-constellation-nodes"><circle cx="350" cy="22" r="5" style="--sd:0.4s;--td:2.9s"></circle><circle cx="196" cy="84" r="9.5" style="--sd:0.5s;--td:2s"></circle><circle cx="508" cy="66" r="7" style="--sd:0.62s;--td:2.2s"></circle><circle cx="286" cy="238" r="7.5" style="--sd:0.86s;--td:2.4s"></circle><circle cx="360" cy="226" r="7.5" style="--sd:0.98s;--td:2.6s"></circle><circle cx="434" cy="214" r="6.5" style="--sd:1.1s;--td:2.8s"></circle><circle cx="236" cy="352" r="6" style="--sd:1.24s;--td:3s"></circle><circle cx="488" cy="366" r="9.5" style="--sd:1.36s;--td:2.1s"></circle><circle cx="352" cy="282" r="4" style="--sd:1.5s;--td:3.2s"></circle><circle cx="347" cy="308" r="3.4" style="--sd:1.58s;--td:3.4s"></circle><circle cx="343" cy="330" r="3" style="--sd:1.66s;--td:3.6s"></circle></g></svg><span class="title-shooting-star"></span>' +
    '</div><div class="title-copy"><div class="title-chart" aria-hidden="true"><i></i><small>ORION · 오리온</small><i></i></div><img class="title-wordmark" src="' +
    metaArt.wordmark +
    '" alt="STELLA BALL"><small class="title-kicker">CONSTELLATION RESTORATION PROJECT</small><button class="title-enter" id="enterHub"><img src="' +
    metaArt.play +
    '" alt="">게임 시작!</button><button class="title-help" id="titleHelp">처음인가요? <b>1분 튜토리얼</b></button></div></section>';
  const enter = document.querySelector("#enterHub");
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
// Superseded wholesale by the game-onboarding.js definition, which never calls back
// here.  The empty body keeps the binding explicit for that reassignment.
function showTitle() {}
// Superseded wholesale by the game-onboarding.js definition, which never calls back
// here.  The empty body keeps the binding explicit for that reassignment.
function showMeta() {}
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
    '<div class="squad-layout"><div class="squad-head"><div><small>STAGE ' +
    s.id +
    " · " +
    s.name +
    "</small><h2>별지기 " +
    slotCount +
    '명을 자리에 세우세요</h2></div><p>아래 별지기를 자리로 끌어 놓으세요. 위쪽 자리는 거상과 가깝고, 아래쪽 자리는 멉니다.</p></div><div class="squad-field"><div id="slotChoices" class="deployment-map" aria-label="전장 배치"><span class="map-boss" aria-label="보스">◆</span><span class="map-launch" aria-hidden="true">발사석</span></div><div id="squadDetail" class="squad-detail" aria-live="polite"></div></div><div class="squad-tray-shell"><div class="squad-tray-head"><small>보유 별지기</small><b>' +
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
    setPortrait(detail.querySelector(".squad-detail-portrait"), h, 46);
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
        i + 1 + "번 자리 · " + zone.name + " · " + (h ? h.s : "비어 있음"),
      );
      slot.innerHTML =
        '<span class="slot-index">' +
        (i + 1) +
        '</span><span class="portrait"></span><b class="slot-name">' +
        (h ? h.s : "비어 있음") +
        '</b><small class="slot-zone">' +
        zone.name +
        "</small>";
      if (h) setPortrait(slot.querySelector(".portrait"), h, 64);
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
      setPortrait(b.querySelector(".portrait"), h, 48);
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
}
// The placement step now lives inside showRoster().  Keep the old entry point
// for any saved flow that still targets the former deployment screen.
function showDeployment() {
  showRoster();
}
// Superseded wholesale by the game-combat.js definition, which never calls back
// here.  The empty body keeps the binding explicit for that reassignment.
function endShot() {}
// Superseded wholesale by the game-onboarding.js definition, which never calls back
// here.  The empty body keeps the binding explicit for that reassignment.
function fail(text) {}
function scheduleWin() {
  const id = battle?.id;
  if (!id || battleComplete || battle?.victory) return;
  battleComplete = true;
  ball.moving = false;
  cloneBalls = [];
  assistShots = [];
  battle.victory = {
    t: 0,
    d: 2.55,
    elapsedMs: Math.round(performance.now() - battle.startedAt),
  };
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
  setTimeout(() => {
    if (battle?.id === id && battle?.victory) win();
  }, 2550);
}
// Superseded wholesale by the game-onboarding.js definition, which never calls back
// here.  The empty body keeps the binding explicit for that reassignment.
function resultCard(shotsUsed, elapsedMs) {}
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
  if (!battle || (battleComplete && !battle.victory)) return;
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
  U.over.innerHTML =
    '<div class="outcome-cut win"><div class="tag">코어 파괴</div><h2>공허 거상을 무너뜨렸습니다.</h2>' +
    resultCard(shotsUsed, elapsedMs) +
    '<p>다른 파티 조합으로 더 짧은 발사를 노려보세요.</p><button onclick="showRoster()">다시 하기</button></div>';
  U.over.classList.remove("hide");
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
  if (hudState.bossFill !== fill) {
    U.hpFill.style.transform = fill;
    hudState.bossFill = fill;
  }
}
const hudState = {
  bossLabel: null,
  bossFill: null,
  shots: null,
  phase: null,
  power: null,
  chain: null,
  tip: null,
  summary: null,
};
function sync() {
  const shotsText = battle
    ? battle.training || battle.tutorial
      ? "∞ · 관측 유성"
      : battle.shots + " / " + battle.shotMax
    : "—";
  const shotsKey = battle
    ? battle.tutorial
      ? "tutorial"
      : battle.shots + "/" + battle.shotMax
    : "none";
  if (hudState.shots !== shotsKey) {
    U.shotsText.textContent = shotsText;
    U.shotDots.innerHTML = battle
      ? battle.tutorial
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
      ? "훈련 · 불멸의 거상"
      : battle.tutorial
        ? "관측 수업 · 공허 거상"
        : "전투 · 공허 거상"
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
  const summaryKey = deployed.join("|");
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
  return (
    typeof isOnboardingInputLocked === "function" && isOnboardingInputLocked()
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
    paused = false;
    showMeta();
  };
  document.querySelector("#pauseResume").focus({ preventScroll: true });
}
function showPauseMenuFromSettings() {
  paused = false;
  setScene("game");
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
    (typeof isOnboardingSessionActive === "function" &&
      isOnboardingSessionActive())
  )
    return;
  if (e.key.toLowerCase() === "r") showRoster();
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

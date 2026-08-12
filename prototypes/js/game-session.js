function resetBuild() {
  build = {
    weakFlat: 0,
    chainStep: 0,
    extraShots: 0,
    bounceStep: 0,
    markMultiplier: 1.7,
    names: [],
  };
}
function setupBattle() {
  const s = currentStage();
  setScene("game");
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
      : RULES.coreHp;
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
  barriers = [];
  seeds = [];
  ball = null;
  assistShots = [];
  hitCombo = 0;
  comboTimer = 0;
  flippers = { left: 0, right: 0 };
  startShot();
  run = true;
  U.over.classList.add("hide");
  msg = s.training
    ? "무한 훈련장 · 유성은 자동 보충됩니다. 충돌과 별자리 배율을 마음껏 시험하세요. R 키로 나가기."
    : s.tutorial
      ? "1-1 · 유성을 아래로 끌어 비연에게 부딪혀 보세요."
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
    zone: ZONE_RULES[i].id,
    slot: ZONE_RULES[i].name,
    hint: ZONE_RULES[i].hint,
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
  const guardians = [
    ["biyeon", "left"],
    ["ria", "center"],
    ["gaon", "right"],
  ]
    .map(([id, position], i) => {
      const h = heroes[id];
      return (
        '<div class="title-guardian title-guardian-' +
        position +
        '" style="--unit:' +
        h.col +
        ";--arrival:" +
        (0.52 + i * 0.12).toFixed(2) +
        's"><span class="title-guardian-art" data-hero="' +
        id +
        '"></span><b>' +
        h.s +
        "</b></div>"
      );
    })
    .join("");
  U.over.className = "overlay title-scene";
  U.over.innerHTML =
    '<section class="title-sequence" aria-label="STELLA BALL 시작 화면"><div class="title-stars" aria-hidden="true">' +
    stars +
    '</div><div class="title-dawn" aria-hidden="true"></div><div class="title-constellation" aria-hidden="true"><svg class="title-sky-map" viewBox="0 0 720 410" preserveAspectRatio="xMidYMid meet"><path class="title-constellation-line line-main" d="M92 265 L205 145 L360 78 L515 145 L628 265"></path><path class="title-constellation-line line-cross" d="M205 145 L360 250 L515 145"></path><path class="title-constellation-line line-spine" d="M360 78 L360 250"></path><g class="title-constellation-nodes"><circle cx="92" cy="265" r="5"></circle><circle cx="205" cy="145" r="6"></circle><circle cx="360" cy="78" r="8"></circle><circle cx="515" cy="145" r="6"></circle><circle cx="628" cy="265" r="5"></circle><circle cx="360" cy="250" r="7"></circle></g></svg><span class="title-shooting-star"></span><img class="title-orb" src="' +
    staticArt.orb +
    '" alt=""><div class="title-hope">별은 다시 이어진다</div>' +
    guardians +
    '<div class="title-route"><small>관측 항로</small><span class="done"><i>✓</i><b>1-1</b><em>첫 충돌</em></span><span class="current"><i>✦</i><b>1-2</b><em>균열 회랑</em></span><span class="locked"><i>?</i><b>1-3</b><em>미관측</em></span></div></div><div class="title-copy"><img class="title-wordmark" src="' +
    metaArt.wordmark +
    '" alt="STELLA BALL"><small class="title-kicker">CONSTELLATION RESTORATION PROJECT</small><section class="title-mission"><small>오늘의 관측</small><b>1-2 · 균열 회랑</b><span>공명 범퍼로 반사각을 만들고 잠든 별지기를 깨우세요.</span></section><div class="title-play-loop" aria-label="게임 방법"><span><i>1</i><b>유성을 끌어<br>발사</b></span><span><i>2</i><b>별지기를<br>깨우기</b></span><span><i>3</i><b>별자리를<br>완성</b></span></div><button class="title-enter" id="enterHub"><img src="' +
    metaArt.play +
    '" alt="">별자리 관측 시작</button><button class="title-help" id="titleHelp">처음인가요? <b>1분 튜토리얼</b></button></div></section>';
  document.querySelectorAll(".title-guardian-art").forEach((art) => {
    setPortrait(art, heroes[art.dataset.hero], 116);
  });
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
function showTitle() {
  run = false;
  drag = null;
  setScene("title");
  const enter = renderTitlePresentation();
  enter.onclick = () => {
    playSfx?.("confirm");
    showMeta();
  };
}
function showMeta() {
  run = false;
  drag = null;
  setScene("meta");
  const s = currentStage(),
    today = new Intl.DateTimeFormat("ko-KR", {
      month: "long",
      day: "numeric",
    }).format(new Date()),
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
    '<div class="meta-hub"><div class="meta-brand"><img src="' +
    metaArt.wordmark +
    '" alt="Prism Breakers"><span class="meta-profile">PRISM ID<b>PLAYER 01</b></span></div><section class="meta-daily"><img src="' +
    metaArt.daily +
    '" alt="오늘의 밤하늘"><div><small>' +
    today +
    " · 오늘의 밤하늘</small><h2>" +
    s.id +
    " · " +
    s.name +
    '</h2><p>위기의 별자리에 도전하세요.</p></div><button class="meta-launch" id="metaLaunch"><img src="' +
    metaArt.play +
    '" alt="">게임 시작</button></section><div class="meta-section-title"><span>현재 별지기</span><span>3 / 3</span></div><section class="meta-party">' +
    party +
    '</section><div class="meta-actions"><button id="metaRoster"><img src="' +
    metaArt.home +
    '" alt="">별지기 편성</button><button id="metaHelp"><img src="' +
    metaArt.help +
    '" alt="">조작법</button></div><p class="meta-note">오늘의 관측은 한 번의 궤적에서 더 큰 별자리를 완성하는 도전입니다.</p></div>';
  for (const el of document.querySelectorAll(".meta-rune-art")) {
    const id = el.dataset.hero;
    if (
      ![
        "gaon",
        "biyeon",
        "lumi",
        "haru",
        "sera",
        "taeo",
        "nyx",
        "rio",
      ].includes(id)
    )
      setPortrait(el, heroes[id], 58);
  }
  document.querySelector("#metaLaunch").onclick = showRoster;
  document.querySelector("#metaRoster").onclick = showRoster;
  document.querySelector("#metaHelp").onclick = showMetaHelp;
}
function showMetaHelp() {
  run = false;
  drag = null;
  setScene("meta");
  U.over.className = "overlay meta-scene";
  U.over.innerHTML =
    '<div class="meta-hub"><div class="meta-brand"><img src="' +
    metaArt.wordmark +
    '" alt="Prism Breakers"><span class="meta-profile">COMBAT GUIDE<b>INPUT</b></span></div><section class="help-panel"><h2>전투 조작</h2><p>유성을 반대 방향으로 끌어 별지기를 굴리세요. 움직인 별지기는 모든 공이 멈춘 뒤, 현재 위치에서 보스를 공격합니다.</p><div class="help-controls"><article class="help-control"><img src="' +
    metaArt.mouse +
    '" alt="마우스 드래그"><b>전략 샷</b><small>유성을 끌어 당겼다가 놓으면 반대 방향으로 발사됩니다.</small></article><article class="help-control"><img src="' +
    metaArt.touch +
    '" alt="터치 드래그"><b>굴림 예측</b><small>첫 별지기의 이동선까지 보고, 다음 샷의 배치를 설계하세요.</small></article><article class="help-control"><img src="' +
    metaArt.keyR +
    '" alt="R 키"><b>즉시 편성</b><small>R 키로 별지기·스테이지 편성으로 돌아갑니다.</small></article></div></section><button id="backMetaHelp">뒤로</button></div>';
  document.querySelector("#backMetaHelp").onclick = showMeta;
}
let rosterFocus = "gaon";
function showRoster() {
  run = false;
  setScene("menu");
  U.over.className = "overlay roster-scene";
  const s = currentStage(),
    slotCount = partySlotCount(),
    owned = ownedHeroIds();
  selected = selected.filter((id) => owned.includes(id)).slice(0, slotCount);
  if (!selected.length) selected = owned.slice(0, slotCount);
  if (!owned.includes(rosterFocus)) rosterFocus = selected[0] || owned[0];
  U.over.innerHTML =
    '<div class="tag">별지기 편성</div><h2>함께할 별지기 ' +
    slotCount +
    "명을 고르세요.</h2><p><b>" +
    s.id +
    " · " +
    s.name +
    "</b> — " +
    s.terrain +
    '</p><div id="stageChoices" class="choice-grid stage-grid" style="max-width:660px;margin-top:10px"></div><div class="roster-shell"><div id="partyStrip" class="party-strip"></div><div id="roster" class="roster-grid"></div><div id="rosterDetail" class="roster-detail"></div></div><div class="overlay-actions"><button id="backMeta">뒤로</button><button id="startTeam">다음</button></div>';
  const stageBox = document.querySelector("#stageChoices"),
    partyStrip = document.querySelector("#partyStrip"),
    box = document.querySelector("#roster"),
    detail = document.querySelector("#rosterDetail");
  for (const [i, st] of stages.entries()) {
    const b = document.createElement("button");
    b.className = "choice-card stage-card";
    b.style.cssText =
      "min-height:74px;text-align:left;border-color:" +
      (i === stageIndex ? "#edc66d" : "#527479");
    b.innerHTML =
      '<img class="stage-emblem" src="' +
      libraryArt.stages[i].emblem +
      '" alt=""><span><strong>' +
      st.id +
      " · " +
      st.name +
      "</strong><small>" +
      st.terrain +
      "</small></span>";
    b.onclick = () => {
      stageIndex = i;
      primeCombatTextures();
      showRoster();
    };
    stageBox.append(b);
  }
  const renderParty = () => {
    partyStrip.innerHTML = Array.from({ length: slotCount }, (_, i) => {
      const h = heroes[selected[i]];
      return h
        ? '<div class="party-chip" style="--unit:' +
            h.col +
            '"><span class="party-portrait" data-party-hero="' +
            selected[i] +
            '" aria-hidden="true"></span><span><small>선택 ' +
            (i + 1) +
            '</small><b style="color:' +
            h.col +
            '">' +
            h.s +
            "</b></span></div>"
        : '<div class="party-chip empty"><img class="slot-marker" src="../assets/library/ui/rune-slot-marker.png" alt=""><span><small>선택 ' +
            (i + 1) +
            "</small><b>비어 있음</b></span></div>";
    }).join("");
    partyStrip.querySelectorAll("[data-party-hero]").forEach((portrait) => {
      setPortrait(portrait, heroes[portrait.dataset.partyHero], 34);
    });
  };
  const renderDetail = () => {
    const h = heroes[rosterFocus];
    detail.innerHTML =
      '<span class="portrait"></span><div><h3>' +
      h.n +
      ' · <span style="color:' +
      h.col +
      '">' +
      h.e +
      "</span></h3><p>" +
      h.d +
      '</p><em class="hero-lore">「' +
      h.lore +
      '」</em></div><img class="detail-skill-icon" src="../assets/library/icons/skill-ready.png" alt="발동 효과">';
    setPortrait(detail.querySelector(".portrait"), h, 54);
  };
  const renderRoster = () => {
    box.innerHTML = "";
    Object.entries(heroes)
      .filter(([id]) => owned.includes(id))
      .forEach(([id, h]) => {
        const on = selected.includes(id),
          b = document.createElement("button");
        b.className = "roster-unit" + (on ? " active" : "");
        b.style.setProperty("--unit", h.col);
        b.setAttribute("aria-pressed", on);
        const icon = skillIcon(id);
        b.innerHTML =
          '<span class="portrait"></span><b>' +
          h.s +
          "</b>" +
          (icon
            ? '<img class="unit-skill" src="' + icon + '" alt="' + h.e + '">'
            : "");
        setPortrait(b.querySelector(".portrait"), h, 42);
        b.onpointerenter = () => {
          rosterFocus = id;
          renderDetail();
        };
        b.onclick = () => {
          if (on) selected = selected.filter((v) => v !== id);
          else if (selected.length < slotCount) selected.push(id);
          else {
            toast("파티는 " + slotCount + "명까지 선택할 수 있습니다.");
            rosterFocus = id;
            renderDetail();
            return;
          }
          rosterFocus = id;
          renderParty();
          renderRoster();
          renderDetail();
        };
        box.append(b);
      });
  };
  renderParty();
  renderRoster();
  renderDetail();
  document.querySelector("#backMeta").onclick = showMeta;
  document.querySelector("#startTeam").onclick = () => {
    if (selected.length !== slotCount)
      return alert(slotCount + "명을 선택해주세요.");
    deployed = [...selected];
    placementPick = deployed[0];
    showDeployment();
  };
  U.over.classList.remove("hide");
}
function showDeployment() {
  run = false;
  const s = currentStage(),
    placeUnit = (incoming, i) => {
      const from = deployed.indexOf(incoming);
      if (from >= 0 && from !== i)
        [deployed[from], deployed[i]] = [deployed[i], deployed[from]];
      placementPick = null;
      showDeployment();
    };
  U.over.className = "overlay deployment-scene";
  // The map mirrors the real 720x900 table, so a slot that looks close to the
  // colossus here is close to it in combat.  That is the whole decision.
  U.over.innerHTML =
    '<div class="deploy-layout"><div class="deploy-head"><small>STAGE ' +
    s.id +
    " · " +
    s.name +
    '</small><h2>어디에 세울지 정하세요</h2><p>별지기를 끌어 자리를 맞바꿉니다. 위쪽은 거상과 가까워 <b>가온의 근접 베기</b>가 닿고, 아래쪽은 멀어 <b>비연의 저격</b>이 강해집니다. 세 자리가 이루는 삼각형이 그대로 별자리 배율이 됩니다.</p></div><div class="deploy-body"><div id="deployHeroes" class="deploy-tray" aria-label="별지기"></div><div class="deploy-stage"><div id="slotChoices" class="deployment-map" aria-label="전장 배치"><span class="map-boss" aria-label="보스">◆</span><span class="map-launch" aria-hidden="true">발사석</span></div></div></div><div class="overlay-actions"><button id="backRoster">뒤로</button><button id="startBattle">시작</button></div></div>';
  const heroBox = document.querySelector("#deployHeroes"),
    slotBox = document.querySelector("#slotChoices");
  for (const id of selected) {
    const h = heroes[id],
      b = document.createElement("button");
    b.className = "deploy-unit";
    b.draggable = true;
    b.style.setProperty("--unit", h.col);
    b.setAttribute("aria-label", h.s);
    b.innerHTML = '<span class="portrait"></span>';
    setPortrait(b.querySelector(".portrait"), h, 52);
    b.addEventListener("pointerdown", () => {
      placementPick = id;
      b.classList.add("dragging");
    });
    b.addEventListener("pointerup", () => b.classList.remove("dragging"));
    b.addEventListener("dragstart", (e) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
      b.classList.add("dragging");
    });
    b.addEventListener("dragend", () => b.classList.remove("dragging"));
    heroBox.append(b);
  }
  for (let i = 0; i < 3; i++) {
    const id = deployed[i],
      h = heroes[id],
      slot = document.createElement("div");
    slot.className = "slot-card";
    slot.style.left = s.preview[i][0] + "%";
    slot.style.top = s.preview[i][1] + "%";
    slot.style.setProperty("--unit", h.col);
    slot.setAttribute("aria-label", i + 1 + "번 위치 · " + h.s);
    slot.innerHTML =
      '<span class="slot-index">' +
      (i + 1) +
      '</span><span class="portrait"></span>';
    setPortrait(slot.querySelector(".portrait"), h, 56);
    slot.addEventListener("pointerup", () => {
      if (placementPick) placeUnit(placementPick, i);
    });
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
      placeUnit(e.dataTransfer.getData("text/plain"), i);
    });
    slotBox.append(slot);
  }
  document.querySelector("#backRoster").onclick = showRoster;
  document.querySelector("#startBattle").onclick = () => {
    resetBuild();
    showDraft("강화 선택", "게임 시작 전 강화 하나를 고르세요.", setupBattle);
  };
  U.over.classList.remove("hide");
  sync();
}
function pickUpgrades() {
  return [...upgrades].sort(() => Math.random() - 0.5).slice(0, 3);
}
function showDraft(title, sub, next) {
  run = false;
  const picks = pickUpgrades();
  U.over.className = "overlay draft-scene";
  U.over.innerHTML =
    '<div class="tag">강화 선택</div><h2>' +
    title +
    "</h2><p>" +
    sub +
    '</p><div id="draft" class="choice-grid"></div><div class="overlay-actions"><button id="backDeployment">뒤로</button></div>';
  const box = document.querySelector("#draft");
  for (const up of picks) {
    const b = document.createElement("button");
    b.className = "choice-card draft-card";
    b.style.setProperty("--accent", up.accent);
    b.innerHTML =
      '<span class="accent"></span><img class="upgrade-icon" src="' +
      up.icon +
      '" alt=""><strong>' +
      up.title +
      "</strong><small>" +
      up.text +
      "</small><em>" +
      up.tag +
      " 강화</em>";
    b.onclick = () => {
      up.apply(build);
      build.names.push(up.title);
      toast(up.title + " 획득");
      next();
    };
    box.append(b);
  }
  document.querySelector("#backDeployment").onclick = showDeployment;
  U.over.classList.remove("hide");
}
function endShot() {
  if (ball.needle) {
    for (let i = -1; i <= 1; i++)
      assistShots.push({
        x: ball.x,
        y: ball.y,
        fromX: ball.x,
        fromY: ball.y,
        t: 0,
        dur: 0.25 + Math.abs(i) * 0.05,
        amount: 9,
        name: "도라 바늘",
        col: "#ffcf6d",
      });
    fieldFx.push({
      type: "needle",
      x: ball.x,
      y: ball.y,
      t: 0,
      d: 0.5,
      col: "#ffcf6d",
    });
    ball.needle = false;
  }
  ball.moving = false;
  ball.vx = ball.vy = 0;
  ball.trail = [];
  // Training and the tutorial advertise unlimited meteors in the HUD, so they
  // reload instead of ending the battle.  Nobody fails a lesson.
  if (battle.shots <= 0 && (battle.training || battle.tutorial))
    battle.shots = battle.shotMax;
  if (battle.shots <= 0) {
    run = false;
    if (boss.hp > 0) return fail("별빛이 닿지 않았습니다.");
  } else {
    startShot();
    msg = "다음 유성을 준비하세요. 남은 배치에서 별자리를 다시 설계하세요.";
    sync();
  }
}
function fail(text) {
  battleComplete = true;
  assistShots = [];
  combatSfx?.("fail", 0.9);
  U.over.className = "overlay";
  U.over.innerHTML =
    '<div class="outcome-cut fail"><div class="tag">전투 종료</div><h2>공허 거상이 버텼습니다.</h2><p>' +
    text +
    '</p><button onclick="showRoster()">다시 하기</button></div>';
  U.over.classList.remove("hide");
}
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
    "<p>선택한 강화: " +
    (build.names.join(" · ") || "없음") +
    '<br>다른 파티 조합으로 더 짧은 발사를 노려보세요.</p><button onclick="showRoster()">다시 하기</button></div>';
  U.over.classList.remove("hide");
}
function toast(text) {
  U.toast.textContent = text;
  U.toast.classList.add("show");
  toastTimer = 2.2;
}
function damageAdd(a, amount, label, col) {
  if (a.down > 0) return;
  a.hitCooldown = Math.max(a.hitCooldown, 0.24);
  a.hp = Math.max(0, a.hp - amount);
  addPopup(a.x, a.y - 24, label + " " + amount, col, amount >= 18);
  if (a.hp <= 0) {
    a.down = 1.6;
    areaBursts.push({ x: a.x, y: a.y, r: 44, col, t: 0, d: 0.42 });
    if (ball?.vortex) {
      ball.vortex = false;
      ball.gravity = { x: a.x, y: a.y, t: 2 };
      fieldFx.push({
        type: "vortex",
        x: a.x,
        y: a.y,
        t: 0,
        d: 2,
        col: "#a886ff",
      });
      toast("제로 흡수 포털 생성!");
    } else toast("공허 잔재 처치!");
  }
}
function areaAttack(name, amount, col) {
  if (!boss || boss.hp <= 0 || battleComplete) return;
  boss.hp = Math.max(0, boss.hp - amount);
  registerBossHit(false);
  impact(true);
  addPopup(boss.x, boss.y - 80, name + " " + amount, col, true);
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
          zone = ZONE_RULES[i];
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
function flipperKick(side) {
  const key = side < 0 ? "left" : "right";
  // Input only moves the physical flipper.  It never writes a launch vector
  // onto the ball: contact with the moving surface supplies the impulse.
  flippers[key + "Strike"] = PHYSICS.flipperRise;
  playSfx?.("flip");
  if (!ball?.moving) return;
  if (ball.orbitReady && !ball.orbitUsed) {
    beginOrbit();
    return;
  }
  if (ball.turnReady && !ball.turnUsed) {
    ball.turnUsed = true;
    ball.turnReady = false;
    ball.turnForce = 1;
    toast("리오 · 우회전 플리퍼 준비");
  } else if (ball.moon && !ball.moonUsed) {
    ball.moonUsed = true;
    ball.moon = false;
    ball.moonForce = 1;
    toast("시아 · 좌회전 플리퍼 준비");
  } else toast(side < 0 ? "좌 플리퍼" : "우 플리퍼");
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
c.addEventListener("pointerdown", (e) => {
  if (!run || isCombatInputLocked()) {
    drag = null;
    return;
  }
  const p = pointer(e);
  if (!ball?.moving) {
    if (p.y > H - 190) {
      drag = { x: p.x, y: p.y };
      c.setPointerCapture(e.pointerId);
    }
    return;
  }
  if (ball.relay) return;
  if (ball.orbit) {
    releaseOrbit();
    return;
  }
  flipperKick(p.x < W / 2 ? -1 : 1);
});
c.addEventListener("pointermove", (e) => {
  if (!drag || isCombatInputLocked()) return;
  const p = pointer(e);
  ball.launchPower = clamp(
    Math.hypot(p.x - drag.x, p.y - drag.y) / 145,
    0.25,
    1,
  );
});
c.addEventListener("pointerup", (e) => {
  if (!drag || ball.moving || isCombatInputLocked()) {
    drag = null;
    return;
  }
  const p = pointer(e),
    power = clamp(Math.hypot(p.x - drag.x, p.y - drag.y) / 145, 0.25, 1);
  drag = null;
  ball.launchPower = power;
  const speed = 650 + power * 530;
  ball.vx = (battle.shots % 2 ? 1 : -1) * (42 + power * 62);
  ball.vy = -speed;
  ball.moving = true;
  battle.shots--;
  chain = [];
  msg = "유성 발사! 별지기를 연계해 상단 보스를 공략하세요.";
  toast("플런저 발사 · 위력 " + Math.round(power * 100) + "%");
  sync();
});
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

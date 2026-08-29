/* Meta screens for settings, rewards, profile, shop, summon, maps, and library. */
// `onBack` lets the pause menu borrow this screen without losing the battle
// behind it.  Menu callers keep the default hub return.
function showSettings(onBack) {
  const back = typeof onBack === "function" ? onBack : showMeta;
  run = false;
  drag = null;
  setScene("meta");
  U.over.className = "overlay meta-scene settings-scene";
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
    '</button><button id="settingsFirstRun">' +
    tr("firstRun") +
    '</button><button id="settingsBack">' +
    tr("back") +
    "</button></div></section></div>";
  for (const button of document.querySelectorAll("[data-lang]"))
    button.onclick = () => {
      settings.language = button.dataset.lang;
      saveSettings();
      /* 데이터 표시 필드(별지기·자리 등)를 새 언어로 세운 뒤 다시 그린다.
         접근 지점은 그대로 두고 값만 바뀌므로, 재렌더만으로 화면이 따라온다. */
      if (typeof applyDataLanguage === "function")
        applyDataLanguage(settings.language);
      playSfx("confirm");
      showSettings(back);
    };
  for (const key of ["master", "bgm", "sfx"]) {
    const input = document.querySelector("#setting-" + key),
      output = document.querySelector("#setting-" + key + "-value");
    /* 끄는 동안에는 «들리게»만 하고, 저장은 놓을 때 한 번이다. 예전에는
       input마다 JSON.stringify + 동기 localStorage 쓰기와 AudioContext
       resume이 함께 돌아, 슬라이더를 끄는 내내 초당 수십 번의 저장이
       일어났다. 값과 표시는 즉시 따라가므로 손끝 감각은 그대로다. */
    input.oninput = () => {
      settings[key] = Number(input.value);
      output.textContent = Math.round(settings[key] * 100) + "%";
      /* 음량을 만졌다는 것은 «듣고 싶다»는 뜻이다. 음소거인 채로 슬라이더가
         움직이면 아무 일도 안 일어나 고장으로 읽힌다. */
      if (settings.muted && key === "master") {
        settings.muted = false;
        window.StellaMute?.refresh?.();
      }
      ensureAudio();
    };
    input.onchange = () => saveSettings();
  }
  /* 「기본값으로」는 음량·언어만 되돌린다. 이 버튼은 저장된 것을 전부 지워
     처음 켠 브라우저와 같은 상태로 만든다 — 프롤로그와 온보딩을 다시 보려면
     진행도뿐 아니라 온보딩 완료·세 번째 슬롯·인트로 세션 표식까지 함께
     지워져야 한다. 되돌릴 수 없으므로 확인을 받는다. */
  document.querySelector("#settingsFirstRun").onclick = () => {
    playSfx("confirm");
    showConfirm({
      kicker: tr("settings"),
      title: tr("firstRunTitle"),
      body: tr("firstRunBody"),
      confirmLabel: tr("firstRunYes"),
      onConfirm: resetToFirstRun,
      onCancel: () => showSettings(back),
    });
  };
  document.querySelector("#settingsReset").onclick = () => {
    /* 기본값은 DEFAULT_SETTINGS 한 곳에서만 나온다(2026-08-24). 여기 있던
       { language, master, bgm, sfx } 리터럴은 그것을 두 번째로 적어 둔
       벌이었고, 실제로 벌어졌다 — 음소거 스위치를 더한 날 이 줄만 그대로
       남아 「기본값으로」가 muted 를 지우지 않고 undefined 로 두었다. */
    settings = { ...DEFAULT_SETTINGS };
    saveSettings();
    window.StellaMute?.refresh?.();
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
  const pendingRewards = pendingRewardEntries(),
    pendingCard =
      '<section class="claim-banner' +
      (pendingRewards.length ? " ready" : "") +
      '"><div><small>관측 보상함</small><b>' +
      (pendingRewards.length
        ? settings.language === "en"
          ? pendingRewards.length + " to claim"
          : "수령 대기 " + pendingRewards.length + "건"
        : "쌓인 보상 없음") +
      "</b><span>" +
      (pendingRewards.length
        ? "보상은 항목마다 직접 수령합니다."
        : "스테이지를 클리어하면 보상이 여기에 쌓입니다.") +
      "</span></div></section>" +
      pendingRewards
        .map(
          (entry) =>
            '<section class="claim-banner ready pending-reward"><div><small>' +
            entry.title +
            "</small><b>+" +
            entry.gold +
            ' 골드</b><span>직접 수령할 보상</span></div><button data-claim-pending="' +
            entry.id +
            '\">수령하기</button></section>',
        )
        .join("");
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
  for (const button of document.querySelectorAll("[data-claim-pending]"))
    button.onclick = (event) => {
      const entry = claimPendingGold(button.dataset.claimPending);
      if (!entry) return;
      playClaimBurst(
        event.currentTarget.closest(".claim-banner"),
        entry.gold,
        () => {
          rewardToast(
            entry.title,
            "+" + entry.gold + " 골드",
            "보유 " + goldBalance(),
          );
          showAchievements();
        },
      );
    };
  for (const button of document.querySelectorAll("[data-claim]"))
    button.onclick = (event) => {
      const id = button.dataset.claim,
        card = event.currentTarget.closest(".achievement-card"),
        entry = claimAchievement(id);
      if (!entry) return;
      playClaimBurst(card, entry.gold, () => {
        rewardToast(
          (settings.language === "en"
            ? "Achievement Reward · "
            : "업적 보상 · ") + entry.name,
          "+" + entry.gold + (settings.language === "en" ? " Gold" : " 골드"),
          (settings.language === "en" ? "Held " : "보유 ") + goldBalance(),
        );
        showAchievements();
      });
    };
}
// Profile gathers identity, the record board and the mailbox in one tab.  The
// board is local-only, so nothing here claims a live connection.
const MAILBOX_STORAGE = "stella-ball.mailbox.v1";
function mailboxEntries() {
  const stored = appStorage.readRecord(MAILBOX_STORAGE, { items: [] });
  return Array.isArray(stored.items) ? stored.items : [];
}
function saveMailbox(items) {
  appStorage.writeRecord(MAILBOX_STORAGE, { items });
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
  safeVibrate([10, 26, 14]);
  /* The callbacks passed here re-render a whole screen. Without a liveness
     token a claim followed by an immediate 뒤로 (or a tab switch) had its
     620ms timer fire afterwards and put the archive back over the hub. Every
     other deferred re-render in this file already carries one - the summon
     sequence has alive(), the title has its sequence counter. */
  const scene = sceneSequence;
  setTimeout(() => {
    if (scene === sceneSequence) done?.();
  }, 620);
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
    '</b></div></div></section><section class="profile-panel"><div class="panel-title"><small>LEADERBOARD</small><h2>오늘의 밤하늘 순위</h2></div><table class="rank-table"><thead><tr><th>#</th><th>관측자</th><th>별</th><th>최단</th><th>최소</th></tr></thead><tbody>' +
    rows +
    '</tbody></table><p class="rank-note">' +
    (settings.language === "en"
      ? "These are <b>local records</b> saved in this browser."
      : "현재는 이 브라우저에 저장된 <b>로컬 기록</b>입니다.") +
    '</p></section><section class="profile-panel mail-panel"><div class="panel-title"><small>MAILBOX</small><h2>우편함' +
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
// --- summon presentation ---------------------------------------------------
// A compact six-beat ritual: long enough to make the unlock an event, short
// enough that a guaranteed pull does not hold the player on a nearly static
// menu for ten seconds. This
// is presentation only: `pullGachaHero()` has already picked the starkeeper,
// taken the gold and saved. Nothing here may imply a rarity or a roll — the
// summon is one guaranteed unlock for 100 gold, and hinting at a system the
// game does not have would be a lie told in animation.
const SUMMON = {
  full: [
    [0, "call", "부름"],
    [1200, "observe", "관측"],
    [3000, "answer", "응답"],
    [4200, "manifest", "현현"],
    [5300, "intro", null],
  ],
  fullEnd: 6800,
  short: [
    [0, "manifest", "현현"],
    [520, "intro", null],
  ],
  shortEnd: 1100,
  reduced: [
    [0, "manifest", null],
    [200, "intro", null],
  ],
  reducedEnd: 420,
};
// "First summon" used to gate the full sequence, but in practice that meant
// almost nobody ever saw it and there was no way to see it again — so the full
// sequence now plays on every summon and is always skippable.
function summonStageMarkup(cost) {
  const motes = Array.from(
    { length: 12 },
    (unused, i) => '<i style="--i:' + i + '"></i>',
  ).join("");
  return (
    '<div class="summon-stage" data-phase="call" aria-hidden="true">' +
    '<div class="summon-circle"></div>' +
    '<div class="summon-motes">' +
    motes +
    "</div>" +
    '<div class="summon-answer"></div>' +
    '<svg class="summon-lines" viewBox="0 0 200 200"><polyline points="100,28 158,70 136,142 64,142 42,70 100,28"></polyline></svg>' +
    (cost ? '<em class="summon-cost">−' + cost + " 골드</em>" : "") +
    '<b class="summon-caption">부름</b>' +
    '<small class="summon-skip"></small>' +
    "</div>"
  );
}
function runSummonSequence(ritual, reveal, drawButton, result) {
  const h = heroes[result.id],
    reduced = matchMedia("(prefers-reduced-motion: reduce)").matches,
    script = reduced ? SUMMON.reduced : SUMMON.full,
    endAt = reduced ? SUMMON.reducedEnd : SUMMON.fullEnd,
    timers = [];
  ritual.classList.add("summoning");
  ritual.insertAdjacentHTML("afterbegin", summonStageMarkup(result.cost));
  const stage = ritual.querySelector(".summon-stage"),
    caption = stage.querySelector(".summon-caption"),
    skipHint = stage.querySelector(".summon-skip");
  // Leaving the screen mid-sequence must not leave a half-built reveal behind,
  // so every step re-checks that the nodes it is about to touch are still live.
  const alive = () => document.body.contains(reveal) && stage.isConnected;
  let settled = false,
    skipping = false;
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  const stop = () => timers.splice(0).forEach(clearTimeout);
  const manifest = () => {
    if (!alive()) return;
    reveal.className = "gacha-reveal revealed";
    reveal.innerHTML =
      '<span class="portrait" id="gachaHeroReveal"></span><small>새 별지기 해금</small><b>' +
      h.s +
      " · " +
      h.e +
      "</b>";
    /* 96이었다. setPortrait 의 크기는 «CSS 상자와 같아야» 한다 — 그 값이
       스프라이트 시트의 한 칸 크기가 되기 때문이다. 상자는 72px 인데 칸을
       96px 로 깔아, 96칸의 왼쪽 위 72px 만 보였다. 인물은 칸 가운데에
       그려져 있으므로 오른쪽 아래 구석으로 밀려 지팡이와 몸이 잘렸다 —
       10초짜리 의식의 보상 화면인데 인물이 잘려 나왔다.
       저장소의 다른 호출은 전부 맞춰져 있다(편성 58/58, 도감 56/56,
       도색 44/44). `.gacha-reveal > span:first-child`도 이 초상에 별 아이콘
       규칙을 씌우고 있었으므로 CSS에서는 `.portrait`을 제외한다. */
    setPortrait(document.querySelector("#gachaHeroReveal"), h, 72);
    playSfx("unlock");
  };
  const intro = () => {
    if (!alive()) return;
    reveal.insertAdjacentHTML(
      "beforeend",
      '<i class="summon-lore">' + h.n + "<span>" + h.lore + "</span></i>",
    );
  };
  const finish = () => {
    if (settled) return;
    settled = true;
    stop();
    removeEventListener("keydown", onSkip);
    removeEventListener("pointerdown", onSkip);
    if (!alive()) return;
    // (the listener teardown above intentionally runs before the alive() bail)
    ritual.classList.remove("summoning");
    stage.remove();
    drawButton.textContent = "소환 목록으로 돌아가기";
    drawButton.disabled = false;
    drawButton.onclick = () => showGacha();
    /* 머리말은 화면을 세울 때 한 번 그려져, 소환으로 골드가 빠져도 그대로
       였다. 실측: 4000골드로 100골드짜리를 소환했는데 연출 내내, 그리고
       끝나고 13초 뒤에도 「보유 골드 4000」이었다.
       연출이 «끝나는» 이 자리에서만 고친다 — 도중에 고치면 아직 누가
       나올지 모르는 화면에서 잔고가 먼저 움직여 결과를 흘린다. */
    const headline = document.querySelector(".gacha-header b");
    if (headline) headline.textContent = "보유 골드 " + goldBalance();
  };
  let skipArmed = null;
  function onSkip(e) {
    /* The screen can be left while the sequence is still running - 뒤로 is
       never disabled - and until this returned, the skip handlers stayed bound
       to the window for the rest of that window, eating the first click or
       keypress made anywhere else in the app (hub, shop, pause). Releasing on
       a dead screen also stops a second summon from stacking another pair. */
    if (!alive()) {
      stop();
      removeEventListener("keydown", onSkip);
      removeEventListener("pointerdown", onSkip);
      return;
    }
    if (skipping || (e.type === "keydown" && (e.repeat || e.key === "Tab")))
      return;
    // 의식이 선 직후 0.4초는 받지 않는다 — 시작시킨 클릭의 두 번째 타가
    // 그대로 건너뛰기가 되는 것을 막는다(위 play() 주석).
    if (typeof skipArmed === "function" && !skipArmed()) return;
    skipping = true;
    stop();
    removeEventListener("keydown", onSkip);
    removeEventListener("pointerdown", onSkip);
    play(SUMMON.short, SUMMON.shortEnd, false);
  }
  function play(steps, end, allowSkip) {
    for (const [ms, phase, label] of steps)
      at(ms, () => {
        if (!alive()) return;
        stage.dataset.phase = phase;
        if (label) {
          caption.textContent = label;
          // Two dedicated cues instead of the same unlock blip on every beat:
          // the gathering phases draw inward, the manifestation opens out.
          if (phase === "manifest" || phase === "intro")
            combatSfx?.("summonReveal", 1);
          else if (phase !== "call") combatSfx?.("summonGather", 0.85);
        } else caption.textContent = "";
        if (phase === "manifest") manifest();
        if (phase === "intro") intro();
      });
    at(end, finish);
    if (allowSkip) {
      skipHint.textContent = "아무 키나 눌러 건너뛰기";
      /* 다음 차례에 단다. 이 함수는 「별빛 소환」을 누른 «그 클릭» 안에서
         도는데, 동기로 달면 더블클릭의 둘째 pointerdown(실측 90ms 뒤)이
         곧바로 건너뛰기를 먹여 방금 100골드로 산 의식이 사라졌다
         (실측: 더블클릭 0.6초 뒤 이미 revealed, 골드는 100 빠진 상태).
         프롤로그가 같은 이유로 이미 쓰는 수법이다 — game-onboarding.js 의
         「Arm the dismiss handlers on the NEXT turn」 주석 참고.
         한 차례 미루는 것만으로는 얇아서(더블클릭 간격이 더 길 수 있다)
         첫 0.4초는 건너뛰기를 받지 않는다. 일부러 건너뛰려는 사람은
         그 뒤로 아무 때나 누르면 된다. */
      const armAt = performance.now() + 400;
      skipArmed = () => performance.now() >= armAt;
      setTimeout(() => {
        if (!alive()) return;
        addEventListener("keydown", onSkip);
        addEventListener("pointerdown", onSkip);
      }, 0);
    }
  }
  play(script, endAt, !reduced);
}
// 소환 화면은 세 갈래다: 별지기 소환(hero)·무기 소환(weapon)·무기고(armory).
// 허브 탭을 늘리지 않으려고 한 화면 위 세그먼트로 묶었다. 기본은 hero 라
// 기존 진입과 프로브(#gachaDraw)가 그대로 열린다.
let armoryPick = null; // 무기고에서 지금 무기를 고르는 별지기 id(없으면 null)
let pendingWeaponReveal = null; // 방금 뽑은 무기 연출(1회 소비)
function gachaModeNav(mode) {
  return (
    '<nav class="gacha-modes" aria-label="소환 갈래">' +
    [
      ["hero", "별지기"],
      ["weapon", "무기"],
      ["armory", "무기고"],
    ]
      .map(
        ([key, label]) =>
          '<button type="button" data-gmode="' +
          key +
          '" class="' +
          (mode === key ? "on" : "") +
          '">' +
          label +
          "</button>",
      )
      .join("") +
    "</nav>"
  );
}
function wireGachaModes(current) {
  for (const button of document.querySelectorAll("[data-gmode]"))
    button.onclick = () => {
      if (button.dataset.gmode === current) return;
      playSfx();
      showGacha(button.dataset.gmode);
    };
}
function showGacha(mode = "hero") {
  if (mode === "weapon") return showWeaponGacha();
  if (mode === "armory") return showArmory();
  run = false;
  drag = null;
  setScene("menu");
  const owned = ownedHeroIds(),
    pool = GACHA_HERO_IDS.filter((id) => !owned.includes(id)),
    canAfford = goldBalance() >= ECONOMY.gachaCost,
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
    ("보유 골드 " + goldBalance()) +
    "</b></span></div>" +
    gachaModeNav("hero") +
    '<div class="gacha-ritual"><div class="gacha-orbit" aria-hidden="true"><i>✦</i><i>✧</i><i>✦</i></div><div class="gacha-reveal" id="gachaReveal"><span>✦</span><small>아직 만나지 못한 별지기를<br>관측하세요</small></div></div><div class="gacha-copy"><small>STARKEEPER CALL</small><h2>별빛 소환</h2><p>100 골드로 아직 만나지 못한 별지기 한 명을 확정으로 맞이합니다.</p></div><section class="gacha-pool"><div class="gacha-pool-heading"><span>소환 후보</span><b>' +
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
        ? "별빛 소환 · " + ECONOMY.gachaCost + " 골드"
        : "골드 부족 · " + ECONOMY.gachaCost + " 골드 필요") +
    "</button></section>";
  document.querySelectorAll("[data-gacha-hero]").forEach((portrait) => {
    // 같은 어긋남. .gacha-pool-unit .portrait 의 상자는 34px 이다.
    setPortrait(portrait, heroes[portrait.dataset.gachaHero], 34);
  });
  wireGachaModes("hero");
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
      ritual = document.querySelector(".gacha-ritual"),
      drawButton = document.querySelector("#gachaDraw");
    drawButton.disabled = true;
    runSummonSequence(ritual, reveal, drawButton, result);
  };
}
/* 무기 소환. 별지기 소환과 같은 껍데기(gacha-shell)를 쓰되, 확정 한 명이
   아니라 «등급을 굴려» 한 자루를 준다. 전용 무기는 낮은 확률이라 뽑히면
   금빛으로 크게 알린다. 중복은 값 절반을 돌려준다(보관함이 종류 기반). */
function weaponGradeLabel(grade) {
  return grade === "exclusive" ? "전용" : "일반";
}
function weaponRevealMarkup() {
  const reveal = pendingWeaponReveal;
  if (!reveal)
    return '<div class="gacha-reveal weapon-reveal" id="gachaReveal"><span>✦</span><small>별의 대장간에서<br>무기를 벼려 냅니다</small></div>';
  const w = WEAPONS[reveal.id],
    ex = w.grade === "exclusive";
  return (
    '<div class="gacha-reveal weapon-reveal shown ' +
    (ex ? "is-exclusive" : "is-common") +
    '" id="gachaReveal"><i class="weapon-ico grade-' +
    w.grade +
    '" data-weapon="' +
    w.id +
    '">' +
    w.icon +
    '</i><b class="weapon-reveal-name">' +
    w.n +
    '</b><em class="weapon-grade grade-' +
    w.grade +
    '">' +
    weaponGradeLabel(w.grade) +
    " 무기</em><small>" +
    (reveal.dup
      ? "이미 보유한 무기 · " + reveal.refund + " 골드 환급"
      : ex
        ? heroes[w.exclusiveTo].s + " 전용 · " + w.tag
        : w.tag) +
    "</small></div>"
  );
}
function showWeaponGacha() {
  run = false;
  drag = null;
  setScene("menu");
  const gold = goldBalance(),
    canAfford = gold >= ECONOMY.weaponCost,
    ownedCount = ownedWeaponIds().length,
    poolCards = WEAPON_IDS.map((id) => {
      const w = WEAPONS[id],
        have = ownsWeapon(id);
      return (
        '<article class="weapon-pool-unit grade-' +
        w.grade +
        (have ? " owned" : "") +
        '"><i class="weapon-ico grade-' +
        w.grade +
        '" data-weapon="' +
        id +
        '">' +
        w.icon +
        "</i><b>" +
        w.n +
        "</b><em>" +
        weaponGradeLabel(w.grade) +
        "</em><small>" +
        (have ? "보유 중" : w.tag) +
        "</small></article>"
      );
    }).join("");
  U.over.className = "overlay gacha-scene";
  U.over.innerHTML =
    '<section class="gacha-shell"><div class="gacha-header"><button id="gachaBack">뒤로</button><span><small>별의 대장간</small><b>보유 골드 ' +
    gold +
    "</b></span></div>" +
    gachaModeNav("weapon") +
    '<div class="gacha-ritual">' +
    weaponRevealMarkup() +
    '</div><div class="gacha-copy"><small>STARFORGE CALL</small><h2>무기 소환</h2><p>' +
    ECONOMY.weaponCost +
    " 골드로 별무기 한 자루를 벼립니다. 전용 무기는 낮은 확률(약 " +
    Math.round(WEAPON_EXCLUSIVE_RATE * 100) +
    '%)로 섞여 나옵니다.</p></div><section class="gacha-pool weapon-pool"><div class="gacha-pool-heading"><span>보유 무기</span><b>' +
    ownedCount +
    " / " +
    WEAPON_IDS.length +
    '</b></div><div class="gacha-pool-grid weapon-pool-grid">' +
    poolCards +
    '</div></section><button class="gacha-draw ' +
    (!canAfford ? "insufficient" : "") +
    '" id="weaponDraw">' +
    (canAfford
      ? "무기 소환 · " + ECONOMY.weaponCost + " 골드"
      : "골드 부족 · " + ECONOMY.weaponCost + " 골드 필요") +
    "</button></section>";
  pendingWeaponReveal = null; // 연출은 한 번만 보인다
  wireGachaModes("weapon");
  document.querySelector("#gachaBack").onclick = () => {
    playSfx();
    showMeta();
  };
  document.querySelector("#weaponDraw").onclick = () => {
    const result = pullGachaWeapon();
    if (result.reason === "gold") {
      playSfx("fail");
      toast("골드가 부족합니다. 스테이지를 클리어해 보세요.");
      return;
    }
    playSfx(result.dup ? "card" : "unlock");
    toast(
      result.dup
        ? "이미 보유한 무기 · " + result.refund + " 골드를 돌려받았어요"
        : WEAPONS[result.id].n +
            (result.grade === "exclusive" ? " · 전용 무기 획득!" : " 획득!"),
    );
    pendingWeaponReveal = result;
    showWeaponGacha();
  };
}
/* 무기고. 보유 별지기마다 지금 낀 무기를 보여 주고, 눌러 펼치면 보유 무기를
   골라 끼운다. 전용 무기가 임자에게 얹히면 «전용 발동»으로 크게 표시한다. */
function armoryHeroRow(heroId) {
  const equipId = equippedWeaponId(heroId),
    w = equipId ? WEAPONS[equipId] : null,
    matched = w && w.grade === "exclusive" && w.exclusiveTo === heroId,
    open = armoryPick === heroId,
    owned = ownedWeaponIds();
  const equippedChip = w
    ? '<span class="armory-equipped grade-' +
      w.grade +
      (matched ? " matched" : "") +
      '"><i class="weapon-ico grade-' +
      w.grade +
      '" data-weapon="' +
      w.id +
      '">' +
      w.icon +
      "</i><b>" +
      w.n +
      "</b><em>" +
      (matched ? "전용 발동 · " + w.tag.replace("+15%", "+70%") : w.tag) +
      "</em></span>"
    : '<span class="armory-equipped empty"><i class="weapon-ico">✧</i><b>무기 없음</b><em>탭해서 장착</em></span>';
  const picker = open
    ? '<div class="armory-picker">' +
      (owned.length
        ? owned
            .map((id) => {
              const pw = WEAPONS[id],
                isEx = pw.grade === "exclusive" && pw.exclusiveTo === heroId,
                isOn = id === equipId;
              return (
                '<button type="button" class="armory-pick grade-' +
                pw.grade +
                (isOn ? " on" : "") +
                (isEx ? " exclusive-here" : "") +
                '" data-equip="' +
                heroId +
                ":" +
                id +
                '"><i class="weapon-ico grade-' +
                pw.grade +
                '" data-weapon="' +
                id +
                '">' +
                pw.icon +
                "</i><b>" +
                pw.n +
                (isEx ? " ★" : "") +
                "</b><em>" +
                (isEx ? "이 별지기 전용 · +70%" : pw.tag) +
                "</em></button>"
              );
            })
            .join("")
        : '<p class="armory-empty">아직 무기가 없어요. «무기» 탭에서 별무기를 뽑아 보세요.</p>') +
      (w
        ? '<button type="button" class="armory-unequip" data-unequip="' +
          heroId +
          '">무기 해제</button>'
        : "") +
      "</div>"
    : "";
  return (
    '<section class="armory-hero' +
    (open ? " open" : "") +
    '"><button type="button" class="armory-hero-head" data-armory-hero="' +
    heroId +
    '"><span class="armory-portrait" data-armory-portrait="' +
    heroId +
    '"></span><span class="armory-hero-copy"><b>' +
    heroes[heroId].s +
    "</b><small>" +
    heroes[heroId].e +
    "</small></span>" +
    equippedChip +
    '<span class="armory-caret">' +
    (open ? "▲" : "▼") +
    "</span></button>" +
    picker +
    "</section>"
  );
}
function showArmory() {
  run = false;
  drag = null;
  setScene("menu");
  const owned = ownedHeroIds(),
    ownedW = ownedWeaponIds();
  U.over.className = "overlay gacha-scene";
  U.over.innerHTML =
    '<section class="gacha-shell armory-shell"><div class="gacha-header"><button id="gachaBack">뒤로</button><span><small>무기고</small><b>보유 무기 ' +
    ownedW.length +
    " / " +
    WEAPON_IDS.length +
    "</b></span></div>" +
    gachaModeNav("armory") +
    '<div class="gacha-copy armory-intro"><small>ARMORY</small><h2>별지기 무장</h2><p>별지기마다 무기를 끼워 정산 공격을 강화합니다. 전용 무기를 임자에게 끼우면 위력이 크게 오릅니다.</p></div><div class="armory-list">' +
    owned.map((id) => armoryHeroRow(id)).join("") +
    "</div></section>";
  wireGachaModes("armory");
  for (const el of document.querySelectorAll("[data-armory-portrait]"))
    setPortrait(el, heroes[el.dataset.armoryPortrait], 44);
  document.querySelector("#gachaBack").onclick = () => {
    playSfx();
    armoryPick = null;
    showMeta();
  };
  for (const button of document.querySelectorAll("[data-armory-hero]"))
    button.onclick = () => {
      const heroId = button.dataset.armoryHero;
      armoryPick = armoryPick === heroId ? null : heroId;
      playSfx("card");
      showArmory();
    };
  for (const button of document.querySelectorAll("[data-equip]"))
    button.onclick = () => {
      const [heroId, weaponId] = button.dataset.equip.split(":");
      if (equippedWeaponId(heroId) === weaponId) {
        unequipWeapon(heroId);
        playSfx("card");
      } else {
        equipWeapon(heroId, weaponId);
        const w = WEAPONS[weaponId],
          matched = w.grade === "exclusive" && w.exclusiveTo === heroId;
        playSfx(matched ? "unlock" : "confirm");
        toast(
          heroes[heroId].s + " · " + w.n + (matched ? " 전용 발동!" : " 장착"),
        );
      }
      armoryPick = null;
      showArmory();
    };
  for (const button of document.querySelectorAll("[data-unequip]"))
    button.onclick = () => {
      unequipWeapon(button.dataset.unequip);
      playSfx("card");
      armoryPick = null;
      showArmory();
    };
}
registerRuntimeHook("afterBossHitRegistered", () => {
  if (hitCombo > progress.bestCombo) {
    progress.bestCombo = hitCombo;
    saveProgress();
    announceNewAchievements();
  }
});
// A second afterShotStart listener used to sit here setting every starkeeper's
// collision radius to 23. It never had an effect: this file loads before
// game-combat.js, both listeners run at the default priority, so the listener
// there overwrote all of them with 34 in the same dispatch. Verified live -
// the radii read 34 after a shot starts. Removed rather than reconciled,
// because game-combat.js's write is the one the parry geometry is tuned
// against; leaving a dead write invites someone to "fix" the wrong one.
// Bumpers are deliberately sparse: they build momentum and invoke the bumper
// rule-slot. Damage belongs to the boss hit and the supporting unit, not to a
// pile of anonymous table objects.
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
  // The resting table used to swap in a small "cute" token and only reach for
  // the full sheet on an action state.  The unified roster sheets doubled as
  // that token, `cuteUnitArt` emptied, and nothing has set `cuteSprite` since,
  // so the branch is gone and the action sheet is always the one asked for.
  const unit = Boolean(spec.id),
    wanted = spec.animations?.[state];
  // Lazy-load action sheets (mid-battle deployments skip the battle prime)
  // and fall back to the still sprite until the sheet is actually ready.
  if (wanted && !textures[wanted]) loadTexture(wanted);
  const animTex = wanted ? textures[wanted] : null,
    animated = animTex?.complete && animTex.naturalWidth ? wanted : null,
    path = animated ?? spec.sprite,
    im = textures[path];
  if (!im?.complete || !im.naturalWidth) return false;
  const unitSize = spec.combatSize;
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
    sx = (safeFrame % spec.frames) * spec.fw,
    sy = 0;
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
// One list drives both the full map screen and the hub's inline map, so a
// stage unlock never has to be edited in two places.
// A campaign node counts as cleared once the run total has reached its index.
// 1-1 is the lesson, so it reads cleared from the onboarding flag instead.
// Progression is still one counter: clearing the campaign stage at index i
// opens index i+1.  Nothing new has to be saved for players already part way
// through, which is why the world rewrite needs no migration.
function isStageCleared(entry) {
  if (entry.onboarding)
    return Boolean(StellaRuntime.modules.optional("onboarding")?.hasClear());
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
        ? "루나와 함께 별빛 조준과 첫 별자리를 관측하세요."
        : /* 예전에는 `terrain ?? 기믹라벨` 이었다. 모든 캠페인 스테이지에
             terrain 문자열이 있어서 뒷항이 «한 번도 도달한 적이 없다» —
             기믹을 34판에 켠 지금, 플레이어는 스테이지를 고르는 화면에서
             그 판에 무엇이 있는지 어디서도 볼 수 없었다.
             둘은 다른 것을 말한다: terrain 은 「어떻게 치는가」(코칭),
             기믹 라벨은 「무엇이 있는가」(사실). 떨어뜨리지 말고 합친다. */
          [stage.terrain, stageGimmickLabels(stage).join(" · ")]
            .filter(Boolean)
            /* 줄바꿈 문자를 소스에 직접 넣으면 문자열이 깨진다 —
               이 저장소의 선례대로 코드로 쓴다(44a36ff). */
            .join(" · "),
      mark: stage.tutorial ? "✦" : "★",
      // 서랍이 보스 이름과 체력을 읽는다. 예전에는 note 문자열 안에 녹아
      // 있었는데, 그러면 표시 형식을 바꿀 때마다 문자열을 다시 파싱해야 한다.
      bossHp: stage.bossHp ?? RULES.coreHp,
      world: stage.world,
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
/* 지도에서 고른 스테이지. 노드를 한 번 누르면 고르고, 같은 노드를 다시 누르면
   출격한다 — 예전처럼 호버로 펼치지 않으므로 잘릴 카드 자체가 없다. */
let stageSelectPick = null;
/* 지도 뒤에 그 월드의 별자리 형상을 아주 옅게 깐다. 세션이 요구한 「배경에
   양자리 형상」이고, 파일은 이미 일곱 월드 전부 있다 — 별자리 인식 연출이
   쓰는 것과 같은 그림이라 판 위와 지도가 같은 형상을 말한다.
   월드 id와 파일명이 두 곳에서 어긋난다(cass·ursa). */
const WORLD_FIGURE_FILE = {
  aries: "aries",
  sagitta: "sagitta",
  corvus: "corvus",
  cass: "cassiopeia",
  cygnus: "cygnus",
  orion: "orion",
  ursa: "bigdipper",
};
function worldFigureArt(worldId) {
  const file = WORLD_FIGURE_FILE[worldId];
  return file ? "../assets/library/constellations/" + file + ".png" : null;
}
function stageSelectPortrait(stage) {
  if (stage.onboarding) return null;
  const slug = WORLD_BOSS[stage.world]?.slug;
  return slug ? "../assets/library/boss10/" + slug + ".png" : null;
}
function stageSelectLaunch(stage) {
  if (!stage || stage.locked) return;
  playSfx();
  if (stage.onboarding)
    return StellaRuntime.modules.require("onboarding").showTutorial(true);
  stageIndex = stage.stage;
  primeCombatTextures();
  showRoster();
}
/* 하단 서랍. 9px 설명문을 노드마다 흩어 놓는 대신 고른 하나만 10px로 펼친다.
   보스 이름·체력·설명이 여기 모이므로 노드는 그림과 번호만 지면 된다. */
function stageSelectDrawer(stage, currentEntry) {
  if (!stage) return "";
  const portrait = stageSelectPortrait(stage),
    bossName = stage.onboarding
      ? "첫 관측자"
      : (WORLD_BOSS[stage.world]?.name ?? "공허 거상"),
    hp = stage.onboarding ? null : (stage.bossHp ?? null),
    isCurrent = stage.id === currentEntry?.id;
  return (
    '<section class="stage-drawer' +
    (stage.locked ? " locked" : "") +
    '"><div class="stage-drawer-face">' +
    (portrait
      ? '<img src="' + portrait + '" alt="" draggable="false" data-crop-first>'
      : '<span class="stage-drawer-mark">✦</span>') +
    '</div><div class="stage-drawer-copy"><div class="stage-drawer-head"><b>' +
    stage.id +
    "</b><small>" +
    (stage.star ? stage.star.bayer : "STAGE " + stage.id) +
    "</small></div><strong>" +
    stage.name +
    "</strong><p>" +
    (stage.locked ? "앞선 관측을 마치면 열립니다." : stage.note) +
    '</p><div class="stage-drawer-meta"><span>' +
    bossName +
    "</span>" +
    (hp ? "<span>HP " + hp + "</span>" : "") +
    "</div></div>" +
    (stage.locked
      ? ""
      : '<button id="stageSelectGo" class="stage-drawer-go">' +
        (isCurrent ? "현재 출격 →" : "출격 →") +
        "</button>") +
    "</section>"
  );
}
function showStageSelect() {
  run = false;
  drag = null;
  setScene("meta");
  const world = activeWorld(),
    mapStages = constellationMapStages(),
    worldIndex = WORLDS.findIndex((entry) => entry.id === world.id);
  const currentEntry =
    mapStages.find((entry) => !entry.locked && !isStageCleared(entry)) ??
    mapStages.filter((entry) => !entry.locked).at(-1);
  /* 선택된 노드 하나만 아래 서랍에서 펼친다. 예전에는 노드마다 9px 설명문을
     60×17px 상자에 넣고 호버할 때만 184px로 «중심을 축으로» 넓혔는데, 그래서
     가장자리 노드는 카드 절반이 지도 밖으로 잘렸다. 펼침을 한 곳으로 모으면
     그 잘림이 구조적으로 사라지고, 글자도 10px로 키울 수 있다. */
  const selected =
    mapStages.find((entry) => entry.id === stageSelectPick) ??
    currentEntry ??
    mapStages[0];
  stageSelectPick = selected?.id ?? null;

  const nodes = mapStages
    .map((stage) => {
      const cleared = isStageCleared(stage),
        isCurrent = stage.id === currentEntry?.id,
        portrait = stageSelectPortrait(stage);
      return (
        '<button class="constellation-node' +
        (stage.locked ? " locked" : "") +
        (cleared ? " cleared" : "") +
        (isCurrent ? " current" : "") +
        (stage.id === selected?.id ? " picked" : "") +
        '" style="left:' +
        stage.x +
        "%;top:" +
        stage.y +
        '%" ' +
        (stage.locked ? "disabled " : "") +
        'data-pick="' +
        stage.id +
        '" aria-label="' +
        stage.id +
        " " +
        stage.name +
        '"><span class="stage-star">' +
        (portrait
          ? '<img src="' +
            portrait +
            '" alt="" draggable="false" data-crop-first>'
          : stage.mark) +
        /* 잠김·현재·클리어를 색이 아니라 «형태»로 가른다. 색으로만 가르면
           월드마다 팔레트가 달라지는 이 지도에서 같은 상태가 다른 색으로
           보이고, 색각 차이에서도 읽히지 않는다. */
        "</span>" +
        (stage.locked
          ? '<span class="stage-mark locked" aria-hidden="true">✕</span>'
          : cleared
            ? '<span class="stage-mark cleared" aria-hidden="true">◆</span>'
            : "") +
        '<b class="stage-id">' +
        stage.id +
        "</b></button>"
      );
    })
    .join("");

  // 상단 7칸 띠. 월드 진행과 팔레트를 한 줄로 동시에 알린다.
  const band = WORLDS.filter((entry) => WORLD_HUES[entry.id] !== undefined)
    .map(
      (entry, index) =>
        '<i class="' +
        (entry.id === world.id ? "on" : isWorldUnlocked(entry) ? "open" : "") +
        '" style="--wh:' +
        WORLD_HUES[entry.id] +
        '" title="' +
        entry.name +
        '"></i>',
    )
    .join("");

  const hue = WORLD_HUES[world.id];
  U.over.className = "overlay constellation-map-scene";
  U.over.innerHTML =
    '<div class="constellation-map-shell" style="' +
    (hue === undefined ? "--wc:0;--wh:0" : "--wc:1;--wh:" + hue) +
    '"><div class="constellation-map-head"><div class="world-band">' +
    band +
    '</div><div class="world-line"><div><div class="tag">' +
    world.bayer +
    (worldIndex >= 0 && hue !== undefined
      ? " · WORLD " + (worldIndex + 1) + "/7"
      : "") +
    "</div><h2>" +
    world.name +
    "</h2></div></div><p>" +
    world.lore +
    '</p></div><section class="constellation-map" aria-label="스테이지 별자리 지도" style="' +
    (worldFigureArt(world.id)
      ? "--figure:url('" + worldFigureArt(world.id) + "')"
      : "--figure:none") +
    '"><svg class="constellation-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
    constellationRoute(mapStages) +
    "</svg>" +
    nodes +
    "</section>" +
    stageSelectDrawer(selected, currentEntry) +
    '<footer class="constellation-map-foot"><button class="constellation-training" id="replayOnboarding">튜토리얼 다시보기</button><button class="constellation-training" id="enterTraining">무한 훈련장</button><button id="stageSelectBack">뒤로</button></footer></div>';

  for (const node of document.querySelectorAll("[data-pick]"))
    node.onclick = () => {
      if (stageSelectPick === node.dataset.pick)
        return stageSelectLaunch(selected);
      stageSelectPick = node.dataset.pick;
      playSfx();
      showStageSelect();
    };
  /* 지금 보스 아트는 384×384 단일 프레임이라(BOSS_PACK_SPEC.frames = 1)
     자를 것이 없고, cropSheets는 가로가 세로보다 크지 않으면 그냥 빠진다.
     그래도 걸어 두는 것은, 이 팩이 나중에 가로 시트로 바뀌면 초상이 네
     프레임 눌린 그림이 되기 때문이다 — 그때 여기서 알아서 첫 칸만 남는다. */
  window.StellaPixelUI?.cropSheets?.(
    ".constellation-map-scene img[data-crop-first]",
  );
  const go = document.querySelector("#stageSelectGo");
  if (go) go.onclick = () => stageSelectLaunch(selected);
  document.querySelector("#replayOnboarding").onclick = () => {
    playSfx();
    StellaRuntime.modules.require("onboarding").showTutorial(true);
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
registerRuntimeHook("afterRosterShown", () => {
  // A `#stageChoices` cleanup ran here for a screen that no longer exists -
  // no producer of that id survives anywhere in the tree, so the query could
  // never match. Removed 2026-08-23.
  // The hub now carries the constellation map, so backing out of the party
  // step returns there instead of opening the standalone map screen.
  document.querySelector("#backMeta").onclick = showMeta;
});
// During battle, rules are taught in deployment. Keep the table readable:
// only the launch instruction remains until the first ball is fired.
drawZoneRules = function () {};

/* Starkeeper skins ---------------------------------------------------------
   Cosmetic only, and deliberately per hero: buying a colour for 샛별 does not
   give it to 미리내.  Ownership is a flat "hero:skin" list so the save stays a
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
/* drawFrame asks for this once per starkeeper per frame, and the uncached path
   walked HERO_SKINS re-resolving the worn id inside the predicate, rebuilt the
   owned-key array and concatenated the filter string every time. Skins only
   change in the shop, so the answer is cached until something writes one.
   The cache itself lives in game-meta-state.js because that file loads first
   and owns the other half of the invalidation. */
function heroSkinFilter(heroId) {
  if (!heroId) return "none";
  const cached = heroSkinFilterCache.get(heroId);
  if (cached !== undefined) return cached;
  const skin = equippedHeroSkin(heroId);
  const filter =
    !skin || !skin.hue
      ? "none"
      : "hue-rotate(" + skin.hue + "deg) saturate(" + (skin.sat ?? 1) + ")";
  heroSkinFilterCache.set(heroId, filter);
  return filter;
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
  invalidateSkinCaches();
  saveProgress();
  return { heroId, skinId, cost: ECONOMY.heroSkinCost };
}
function equipHeroSkin(heroId, skinId) {
  if (!ownsHeroSkin(heroId, skinId)) return false;
  progress.wornHeroSkins = {
    ...(progress.wornHeroSkins ?? {}),
    [heroId]: skinId,
  };
  invalidateSkinCaches();
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
  /* 「오늘 받음」 표식이 «안 남으면» 골드도 주면 안 된다 — 저장이 막힌
     브라우저(시크릿·용량 초과)에서 표식 쓰기는 실패했는데 골드만 올리면
     attendanceReady() 가 계속 true 라 같은 날 무한 재수령된다(골드 수도꼭지).
     표식이 실제로 남은 것을 확인한 뒤에만 골드를 준다 — saveProgress 가
     progress 키에 이미 쓰는 방어와 같은 논리. */
  if (
    appStorage.writeRecord(ATTENDANCE_STORAGE, {
      last: dayKey(),
      prev: state.last,
      streak,
    }) === false
  )
    return 0;
  progress.gold = goldBalance() + gold;
  saveProgress();
  return gold;
}

/* Library ------------------------------------------------------------------
   The record shelf: which starkeepers the observatory holds, and the exact
   conditions that move the constellation multiplier. Keep these labels aligned
   with trackBlazeDirect, afterTableWall, trackBlazeUnit and loseBlaze. */
const BLAZE_RULES = [
  { label: "유성이 보스를 직격", gain: "+1.0" },
  { label: "유성이 벽·쿠션에 튕김 (최대 2회)", gain: "+0.2" },
  { label: "파티 전원이 공명", gain: "+3.0" },
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
    '<section class="system-panel"><div class="archive-tabs"><button class="archive-tab on" id="tabLibrary">도서관</button><button class="archive-tab" id="tabAchievements">업적</button></div><h2>관측 도서관</h2><p>관측소가 확보한 별지기와, 별자리 배율이 움직이는 조건입니다.</p><div class="codex-split"><div class="codex-list">' +
    cards +
    '</div><aside class="codex-side"><div class="panel-title"><small>CONSTELLATION</small><h3>별자리 배율 조건</h3></div><table class="codex-table"><thead><tr><th>조건</th><th>배율</th></tr></thead><tbody>' +
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

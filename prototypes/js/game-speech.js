/* 말풍선 체계 — 디자인 세션 §5.

   지금까지 캐릭터의 말은 전부 같은 창구로 나갔다. 유닛이 각성해도, 루나가
   수업을 안내해도, 거상이 등장해도 화면 오른쪽 위의 같은 11px 모노 상자에 한
   줄이 뜨고, `toastQueue`가 동시 발화를 한 줄씩 흘렸다. 화자는 글자 안의
   이름으로만 구분됐다 — 말이 아니라 로그다.

   화자 넷을 창구 넷으로 나눈다.

     별지기   판 위 · 캔버스   고유색 테두리 + 32px 초상 + 꼬리
     거상     판 상단 전면 띠  초상 없음 · 큰 서체 · 떨림
     루나     판 밖 하단 · DOM 64px 초상 + 보라 테두리
     내레이션 판 중앙 하단     테두리·초상 없음 · 이탤릭

   판 위는 캔버스에 그린다(§4-7 예산: 캔버스는 여유가 있고 DOM 레이어는 없다).
   루나만 DOM인 것은 그 자리가 판 밖이고 매 프레임 갱신되지 않기 때문이다 —
   수업 카드와 같은 어휘를 이어받는다.

   토스트는 남는다. 다만 «사람이 아닌 것»만 쓴다 — 정산, 골드, 해금 같은
   시스템 알림이다. */

const SPEECH = {
  // 판 위는 최대 둘까지 같이 뜬다. 판은 720×900이고 유닛 반경은 34px이라
  // 셋이 동시에 뜨면 유성 경로를 가린다.
  boardMax: 2,
  life: 2.6,
  fade: 0.34,
  portrait: 32,
};
let speechOnBoard = [];
let speechQueue = [];
let speechBanner = null;
let speechNarration = null;

/* 초상은 `*-idle.png` 시트의 첫 프레임을 그대로 잘라 쓴다(1152×192, 6프레임).
   새 그림이 필요하지 않다. 잘라 둔 결과는 캐시한다 — 말할 때마다 자르면
   말풍선 하나가 캔버스 하나를 만든다. */
const speechFaces = new Map();
function speechFace(path) {
  if (!path) return null;
  const hit = speechFaces.get(path);
  if (hit !== undefined) return hit;
  const image = textures[path];
  if (!image?.complete || !image.naturalWidth) return null;
  const side = image.naturalHeight,
    made = document.createElement("canvas");
  made.width = made.height = side;
  const g = made.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.drawImage(image, 0, 0, side, side, 0, 0, side, side);
  speechFaces.set(path, made);
  return made;
}

/* 말을 건다. 화자에 따라 창구가 갈린다.
     say("unit", text, { gate })    별지기 — 그 유닛 옆에 붙는다
     say("boss", text)              거상 — 판 상단 띠
     say("luna", text)              루나 — 판 밖 DOM
     say("narration", text)         내레이션 — 판 중앙 하단 */
/* 화자마다 다른 소리를 낸다. 창구를 넷으로 나눈 것과 같은 이유다 — 넷이 같은
   소리를 내면 눈을 떼고 있을 때 누가 말하는지 알 수 없다. 내레이션만 무음인
   것은 의도다: 아무도 말하고 있지 않기 때문이다. */
function say(who, text, opts = {}) {
  if (!text) return;
  if (who === "boss") {
    speechBanner = { text, t: 0, d: opts.d ?? 2.2 };
    combatSfx?.("speechBoss", 0.8);
    return;
  }
  if (who === "narration") {
    speechNarration = { text, t: 0, d: opts.d ?? 2.8 };
    return;
  }
  if (who === "luna") {
    combatSfx?.("speechLuna", 0.62);
    return sayLuna(text, opts);
  }
  const gate = opts.gate;
  if (!gate) return;
  combatSfx?.("speechUnit", 0.55);
  const bubble = {
    gate,
    text,
    col: gate.col || "#cfdad7",
    face: gate.sprite || null,
    t: 0,
    d: opts.d ?? SPEECH.life,
  };
  // 같은 화자가 겹쳐 말하면 앞의 것을 갈아끼운다 — 두 줄이 겹쳐 뜨는 것보다
  // 마지막 말이 보이는 편이 낫다.
  const seat = speechOnBoard.findIndex((b) => b.gate === gate);
  if (seat >= 0) return void (speechOnBoard[seat] = bubble);
  if (speechOnBoard.length < SPEECH.boardMax) speechOnBoard.push(bubble);
  else speechQueue.push(bubble);
}

/* 루나는 판 밖 아래에 선다. 이 자리는 매 프레임 갱신되지 않으므로 DOM이어도
   프레임 예산을 건드리지 않는다. */
let lunaTimer = 0;
function sayLuna(text, opts = {}) {
  const dock = document.querySelector("#lunaSpeech") ?? buildLunaDock();
  if (!dock) return;
  dock.querySelector(".luna-speech-text").textContent = text;
  dock.classList.add("show");
  clearTimeout(lunaTimer);
  lunaTimer = setTimeout(
    () => dock.classList.remove("show"),
    (opts.d ?? 4.2) * 1000,
  );
}
function buildLunaDock() {
  const host = document.querySelector(".stage")?.parentElement;
  if (!host) return null;
  const dock = document.createElement("div");
  dock.id = "lunaSpeech";
  dock.className = "luna-speech";
  dock.setAttribute("aria-live", "polite");
  dock.innerHTML =
    '<img class="luna-speech-face" src="../assets/library/guide/luna-portrait.png" alt="" aria-hidden="true">' +
    '<div class="luna-speech-body"><b>밤의 관측자 · 루나</b>' +
    '<p class="luna-speech-text"></p></div>';
  host.appendChild(dock);
  return dock;
}

function updateSpeech(d) {
  for (const b of speechOnBoard) b.t += d;
  speechOnBoard = speechOnBoard.filter((b) => b.t < b.d);
  while (speechOnBoard.length < SPEECH.boardMax && speechQueue.length)
    speechOnBoard.push(speechQueue.shift());
  if (speechBanner && (speechBanner.t += d) >= speechBanner.d)
    speechBanner = null;
  if (speechNarration && (speechNarration.t += d) >= speechNarration.d)
    speechNarration = null;
}
function clearSpeech() {
  speechOnBoard = [];
  speechQueue = [];
  speechBanner = null;
  speechNarration = null;
  document.querySelector("#lunaSpeech")?.classList.remove("show");
}

function speechAlpha(b) {
  const inT = Math.min(1, b.t / 0.14),
    outT = Math.min(1, (b.d - b.t) / SPEECH.fade);
  return Math.max(0, Math.min(inT, outT));
}

/* 판 위 말풍선. 유성 경로를 피해 유닛 위·아래 중 빈 쪽에 붙고, 꼬리가 화자를
   가리키므로 이름을 쓰지 않아도 누가 말하는지 읽힌다. */
function drawBoardSpeech() {
  for (const b of speechOnBoard) {
    const g = b.gate;
    if (!g) continue;
    const alpha = speechAlpha(b);
    if (alpha <= 0) continue;
    x.save();
    x.globalAlpha = alpha;
    x.font = "11px Galmuri11, ui-monospace";
    const pad = 7,
      face = speechFace(b.face),
      faceW = face ? SPEECH.portrait + 6 : 0,
      textW = Math.min(230, x.measureText(b.text).width),
      w = textW + faceW + pad * 2,
      h = Math.max(face ? SPEECH.portrait + 10 : 0, 26);
    /* 위·아래 중 빈 쪽. 유성이 위에 있으면 아래에 붙는다 — 말풍선이 경로를
       가리면 조작을 방해한다. */
    const above = !ball || ball.y > g.y,
      bx = Math.max(8, Math.min(W - w - 8, g.x - w / 2)),
      by = above ? g.y - g.r - 14 - h : g.y + g.r + 14;
    x.fillStyle = "#0b1417ee";
    x.strokeStyle = b.col;
    x.lineWidth = 1.5;
    x.beginPath();
    x.roundRect(bx, by, w, h, 6);
    x.fill();
    x.stroke();
    // 꼬리. 화자를 가리킨다.
    const tipY = above ? by + h : by;
    x.beginPath();
    x.moveTo(g.x - 6, tipY);
    x.lineTo(g.x + 6, tipY);
    x.lineTo(g.x, above ? tipY + 8 : tipY - 8);
    x.closePath();
    x.fillStyle = "#0b1417ee";
    x.fill();
    x.stroke();
    if (face)
      x.drawImage(
        face,
        bx + pad,
        by + (h - SPEECH.portrait) / 2,
        SPEECH.portrait,
        SPEECH.portrait,
      );
    x.fillStyle = "#e8eef0";
    x.textAlign = "left";
    x.textBaseline = "middle";
    x.fillText(b.text, bx + pad + faceW, by + h / 2, textW);
    x.restore();
  }
  x.textBaseline = "alphabetic";
}

/* 거상은 판 상단 전면 띠로 말한다. 초상이 없고, 서체가 크고, 자모가 떨린다 —
   사람이 아닌 것이 말하고 있다는 신호다. */
function drawBossSpeech() {
  if (!speechBanner) return;
  const alpha = speechAlpha(speechBanner);
  if (alpha <= 0) return;
  x.save();
  x.globalAlpha = alpha * 0.92;
  x.fillStyle = "#0a0f12e8";
  x.fillRect(0, 96, W, 52);
  x.strokeStyle = "#7cc6bb55";
  x.lineWidth = 1;
  x.beginPath();
  x.moveTo(0, 96);
  x.lineTo(W, 96);
  x.moveTo(0, 148);
  x.lineTo(W, 148);
  x.stroke();
  x.globalAlpha = alpha;
  x.fillStyle = "#dff3ea";
  x.font = "bold 19px Galmuri11, ui-monospace";
  x.textAlign = "center";
  // 자모 떨림. 글자마다 1px 어긋나 「목소리가 흔들린다」로 읽힌다.
  const chars = [...speechBanner.text];
  let total = 0;
  for (const ch of chars) total += x.measureText(ch).width;
  let cx = W / 2 - total / 2;
  for (let i = 0; i < chars.length; i++) {
    const wob = Math.sin(frameClock / 90 + i * 1.7) * 1.2;
    x.textAlign = "left";
    x.fillText(chars[i], cx, 128 + wob);
    cx += x.measureText(chars[i]).width;
  }
  x.restore();
}

// 내레이션. 테두리도 초상도 없고, 기울여 쓴다 — 아무도 말하고 있지 않다.
function drawNarration() {
  if (!speechNarration) return;
  const alpha = speechAlpha(speechNarration);
  if (alpha <= 0) return;
  x.save();
  x.globalAlpha = alpha * 0.85;
  x.fillStyle = "#c3cfd2";
  x.font = "italic 13px Galmuri11, ui-monospace";
  x.textAlign = "center";
  x.fillText(speechNarration.text, W / 2, H - 96);
  x.restore();
}

/* 조준 화면의 루나 한 줄(핸드오프 §2-6). 네 상태에 하나씩, 저장 슬롯마다
   한 번씩만 나온다.

   화자 쪽에 두는 이유는 기존 원칙 그대로다 — 전투 체인은 speech를 부르지
   않는다. game-combat.js는 `afterAimChanged`에 «무슨 일이 있었는지»만 싣고,
   무엇을 말할지는 여기서 정한다. 그래서 전투 규칙이 또 바뀌어도 문안은
   이 파일 한 곳에서 따라간다.

   수업 중에는 말하지 않는다. 온보딩은 루나 카드가 같은 목소리로 같은 것을
   가르치고 있어, 판 밖 독까지 동시에 뜨면 한 화자가 두 곳에서 다른 문장을
   말하는 화면이 된다. 핸드오프 §3-1도 이 멘트를 「수업 밖 첫 실전」의
   몫으로 지정했다. */

/* ── 대사 은행 (2026-08-22) ──────────────────────────────────────────────
   여기 오기 전까지 이 게임에서 «사람»이 말하는 자리는 셋뿐이었고, 별지기
   대사는 「깨어났다」·「공명했다」 두 줄이 전부였다. 화자 넷을 나누는 체계는
   위에 이미 서 있으니, 모자란 것은 말할 «내용»이다.

   세 가지 규칙으로 짓는다.

   1. 별지기는 각자 다르게 말한다. 여덟 명이 같은 말을 하면 이름표가
      바뀌는 것일 뿐 화자가 늘지 않는다. 능력이 곧 성격이다 —
      근접 베기는 앞으로 나가고, 거리 저격은 거리를 재고, 마지막 모사는
      뒤에서 본다.
   2. 난수를 쓰지 않는다. 봇 하니스는 「난수는 aimSigma 한 곳」이라는 전제
      위에 서 있다(bot/runtime-harness.mjs). 줄 고르기는 사건 횟수를 센
      «회전»이다 — 같은 판을 두 번 돌리면 같은 순서로 말한다.
   3. 조용할 때가 있어야 말이 들린다. 같은 화자가 연달아 말하지 않도록
      채널마다 쿨다운을 두고, 수업 중에는 판 위 대사를 내지 않는다 —
      루나 카드가 같은 목소리로 가르치는 중이다. */

/* 회전 카운터. 사건마다 하나씩 세어 줄을 고른다 — 난수 없음. */
const speechTurn = new Map();
function speechPick(bucket, lines) {
  if (!lines || !lines.length) return null;
  const n = speechTurn.get(bucket) ?? 0;
  speechTurn.set(bucket, n + 1);
  return lines[n % lines.length];
}
/* 채널별 쿨다운. 말이 겹치면 앞엣것이 즉시 지워져 «읽을 수 없는 대사»가
   된다 — 특히 루나 독은 하나뿐이라 덮어쓰기가 곧 소멸이다. */
const speechCool = { unit: 0, boss: 0, luna: 0, narration: 0 };
function speechReady(channel, gap) {
  const now = typeof frameClock === "number" ? frameClock : 0;
  if (now - (speechCool[channel] ?? 0) < gap) return false;
  speechCool[channel] = now;
  return true;
}
function speechQuiet() {
  // 수업 중에는 판 위가 조용해야 한다. 루나 카드가 이미 말하고 있다.
  return !!StellaRuntime.modules.optional("onboarding")?.isActive();
}

/* 별지기 여덟. 능력이 성격이다. */
const UNIT_VOICE = {
  gaon: {
    wake: ["앞은 내가 연다.", "베어 낼 자리가 보여.", "가까울수록 잘 든다."],
    echo: ["아직 서 있어.", "한 번 더 온다."],
    hit: ["끊었다!", "결이 갈라졌어."],
  },
  biyeon: {
    wake: ["거리, 좋아.", "멀수록 잘 보여.", "숨 참고 — 지금."],
    echo: ["각도 재는 중.", "조금만 더 벌려."],
    hit: ["관통.", "가운데 맞았어."],
  },
  lumi: {
    wake: ["둘로 갈게.", "혼자보다 둘이 낫지.", "나눠서 덮자."],
    echo: ["반쪽이 아직 남았어.", "다시 붙을 시간."],
    hit: ["양쪽 다 들어갔어!", "두 번 셌지?"],
  },
  haru: {
    wake: ["중계 잡았어.", "여기서 이어 줄게.", "길을 만들어 둘게."],
    echo: ["선이 끊겼어.", "다시 이어 볼게."],
    hit: ["연결 성공!", "그대로 흘러가."],
  },
  ria: {
    wake: ["바람 탄다.", "빠른 게 제일이야.", "따라올 수 있겠어?"],
    echo: ["아직 안 멈췄어.", "속도가 죽었네."],
    hit: ["스쳤는데 깊지?", "칼날 지나갔다."],
  },
  sera: {
    wake: ["방향을 바꾸자.", "여기서 틀면 돼.", "판이 달라 보이지."],
    echo: ["다시 읽어 볼게.", "각을 바꿔야 해."],
    hit: ["돌려세웠어.", "흐름이 넘어왔다."],
  },
  taeo: {
    wake: ["부딪히면 내 몫이지.", "단단한 건 자신 있어.", "정면으로 가."],
    echo: ["아직 버텨.", "한 번 더 박아 보자."],
    hit: ["울렸다!", "금 갔어, 봤지?"],
  },
  nyx: {
    wake: ["마지막은 내가 볼게.", "조용히 따라갈게.", "본 대로 따라 한다."],
    echo: ["기억해 뒀어.", "아직 안 끝났어."],
    hit: ["똑같이 돌려줬어.", "그대로 베꼈지."],
  },
};

/* 거상 여덟. 월드의 성격이다. */
const BOSS_VOICE = {
  aries: {
    enter: "뿔을 세운다. 지나갈 자리는 없다.",
    phase: "뿔이 하나 부러졌다 — 그래서?",
    low: "문은 아직 닫혀 있다.",
  },
  sagitta: {
    enter: "겨눈 것은 이쪽이다.",
    phase: "시위가 한 번 울었다.",
    low: "화살은 아직 손에 있다.",
  },
  corvus: {
    enter: "떼가 먼저 본다.",
    phase: "한 마리가 떨어졌을 뿐이다.",
    low: "그래도 하늘은 검다.",
  },
  cass: {
    enter: "왕좌는 기울어도 왕좌다.",
    phase: "껍질 하나. 아직 넷이 남았다.",
    low: "앉은 자리는 바뀌지 않는다.",
  },
  cygnus: {
    enter: "물결은 되돌아온다.",
    phase: "여울이 한 번 뒤집혔다.",
    low: "흐름은 멈추지 않는다.",
  },
  orion: {
    enter: "사냥은 이미 시작됐다.",
    phase: "띠가 한 칸 어긋났다.",
    low: "잔영은 사라지지 않는다.",
  },
  ursa: {
    enter: "국자를 끌어 내린 것이 나다.",
    phase: "포효 — 자리를 지워 주마.",
    low: "북쪽은 여전히 내 것이다.",
  },
  outside: {
    enter: "관측되지 않은 것이 관측한다.",
    phase: "너희가 세는 것을 나는 세지 않는다.",
    low: "여기서부터는 이름이 없다.",
  },
};

function unitVoice(gate, kind) {
  const id = gate?.id ?? gate?.hero ?? gate?.key;
  const bank = UNIT_VOICE[id];
  if (!bank) return null;
  return speechPick(id + ":" + kind, bank[kind]);
}
function bossVoice(kind) {
  const world = currentStage()?.world;
  return BOSS_VOICE[world]?.[kind] ?? null;
}

const AIM_LUNA_LINES = [
  {
    id: "luna-pick0",
    when: (a) => a.picks === 0 && (a.reason === "open" || a.reason === "clear"),
    text: "별지기든 별빛이든 — 셋을 찍어 봐.",
  },
  {
    id: "luna-pick2",
    when: (a) => a.picks === 2,
    text: "하나 더! 셋이 모여야 방향이 생겨.",
  },
  {
    id: "luna-flip",
    when: (a) => a.reason === "flip" && a.flipped,
    text: "반대편이야! 빈 곳을 다시 누르면 돌아와.",
  },
  {
    id: "luna-force",
    when: (a) => a.force > 0.75,
    text: "넓게 벌렸네 — 세게 나간다!",
  },
];
registerRuntimeHook("afterAimChanged", (aim) => {
  if (StellaRuntime.modules.optional("onboarding")?.isActive()) return;
  if (typeof markAimHintDone !== "function") return;
  for (const line of AIM_LUNA_LINES) {
    if (!line.when(aim)) continue;
    // 한 번의 상태 변화에 한 줄만. 아래 줄들은 다음 기회에 나온다 —
    // 두 줄이 겹치면 뒤엣것이 앞엣것을 즉시 갈아끼운다(sayLuna는 독 하나).
    if (markAimHintDone(line.id)) say("luna", line.text);
    return;
  }
});

/* ── 대사를 사건에 건다 ─────────────────────────────────────────────────
   새 배관을 만들지 않는다. 이 저장소는 이미 훅 27개를 내놓고 있고, 대사는
   그 위에 얹히는 «관찰자»다 — 규칙을 바꾸지 않으므로 어느 훅에 걸어도
   전투가 달라지지 않는다.

   쿨다운 값의 근거: 판 위 말풍선은 2.6초 산다(SPEECH.life). 그보다 짧게
   내면 앞엣것이 읽히기 전에 밀린다. 그래서 별지기는 3.2초, 거상 띠는
   더 큰 사건만 맡으므로 6초, 루나는 독이 하나뿐이라 5초를 둔다. */

// 거상 등장. 기존 한 줄을 월드별 목소리로 바꾼다.
registerRuntimeHook("afterBattleSetup", () => {
  speechTurn.clear();
  speechCool.unit =
    speechCool.boss =
    speechCool.luna =
    speechCool.narration =
      0;
});

// 별지기가 보스를 직접 때렸을 때. 큰 것만 말한다.
registerRuntimeHook("afterDirectBossDamage", (info) => {
  if (speechQuiet() || !info) return;
  const gate = info.gate ?? info.unit ?? null;
  if (!gate || !(info.amount >= 18)) return;
  if (!speechReady("unit", 3200)) return;
  const line = unitVoice(gate, "hit");
  if (line) say("unit", line, { gate });
});

// 벽에 튕겼을 때 — 뿔문 월드에서 판이 대꾸한다.
registerRuntimeHook("afterTableWall", () => {
  if (speechQuiet() || !stageWalls.length) return;
  if (!speechReady("narration", 5200)) return;
  say(
    "narration",
    speechPick("wall", [
      "판이 되받아쳤다.",
      "벽을 타고 각이 바뀐다.",
      "부딪힌 만큼 빨라졌다.",
    ]),
  );
});

// 별자리가 섰을 때.
registerRuntimeHook("afterFigureResolve", (info) => {
  if (speechQuiet()) return;
  if (!speechReady("narration", 4200)) return;
  const n = info?.points?.length ?? 0;
  say(
    "narration",
    speechPick("figure", [
      n >= 6 ? "여섯 점이 이어졌다 — 하늘이 밝다." : "선이 닫혔다.",
      "별자리가 판을 덮는다.",
      "그린 대로 내려온다.",
    ]),
  );
});

// 마지막 유성. 판마다 한 번만.
registerRuntimeHook("afterShotEnd", () => {
  if (speechQuiet() || !battle) return;
  if (battle.shots !== 1) return;
  if (!speechReady("luna", 5000)) return;
  say(
    "luna",
    speechPick("last", [
      "마지막 하나야. 넓게 벌려 봐.",
      "한 발 남았어 — 가운데로 모으지 마.",
      "여기서 끝내자.",
    ]),
  );
});

/* 거상이 단계를 넘길 때. runStagePhase 에 훅이 없으므로 체력 비율을
   프레임에서 읽어 «내려간 순간»만 잡는다. 값을 바꾸지 않는 관찰이다. */
let bossVoiceMark = 1;
registerRuntimeHook("afterFeedbackUpdate", () => {
  if (speechQuiet() || !boss || !battle || battleComplete) return;
  const ratio = boss.maxHp ? boss.hp / boss.maxHp : 1;
  if (ratio > bossVoiceMark) bossVoiceMark = ratio; // 새 판
  for (const mark of [0.66, 0.33]) {
    if (bossVoiceMark > mark && ratio <= mark) {
      bossVoiceMark = ratio;
      if (speechReady("boss", 6000)) {
        const line = bossVoice(mark === 0.33 ? "low" : "phase");
        if (line) say("boss", line);
      }
      return;
    }
  }
  bossVoiceMark = Math.min(bossVoiceMark, ratio);
});

/* ── 기믹 첫 만남 (2026-08-22) ───────────────────────────────────────────
   기믹을 34판에 켰지만 가르치는 자리가 없다. 1-1 수업은 조준만 가르치고
   끝나는데, 바로 다음 판인 1-2 에서 반사 벽을 처음 만난다.

   수업 카드를 늘리지 않는다. 오너가 온보딩에 대해 못 박은 것이 「글씨나
   연출 지저분하게 하지 말라」였고, 카드 하나는 판을 멈추는 값이 크다.
   대신 루나가 «처음 만나는 판에서 한 번만» 말한다.

   한 번만인 것은 markAimHintDone 이 보장한다 — 저장 슬롯 단위라 어제 배운
   사람에게 오늘 또 말하지 않는다. 조준 교습이 쓰는 것과 같은 예산이다.

   문장 규칙: 무엇인지 말하지 말고 «무엇을 하면 되는지» 말한다.
   「반사 벽입니다」가 아니라 「튕겨서 돌아가게 해 봐」. */
const GIMMICK_TEACH = [
  {
    id: "gim-walls",
    has: (g) => g.walls?.length,
    text: "판이 서 있어. 정면이 막히면 튕겨서 돌아가게 해 봐.",
  },
  {
    id: "gim-boost",
    has: (g) => g.boostPads?.length,
    text: "저 발판을 밟고 가면 빨라져 — 좁게 겨눠도 세게 나가.",
  },
  {
    id: "gim-drag",
    has: (g) => g.dragPads?.length,
    text: "흐린 자리는 별자리 배율을 깎아. 빠른 길이 꼭 싼 길은 아니야.",
  },
  {
    id: "gim-adds",
    has: (g) => g.adds?.length,
    text: "잔재가 길을 막고 있어. 먼저 치울지, 지나칠지는 네 선택이야.",
  },
  {
    id: "gim-orbits",
    has: (g) => g.orbits?.length,
    text: "방벽이 돌고 있어 — 틈이 열리는 때를 세어 봐.",
  },
  {
    id: "gim-shield",
    has: (g) => g.shield,
    text: "껍질이 몇 겹 있어. 처음 몇 대는 껍질이 먹을 거야.",
  },
  {
    id: "gim-phases",
    has: (g) => g.phases,
    text: "체력이 내려가면 거상이 판을 흔들어. 자리를 미리 믿지 마.",
  },
];
/* 판이 서고 잠깐 뒤에 말한다. 입장 연출이 도는 동안 말하면 레터박스에
   가려 아무도 못 읽는다 — 판이 열린 뒤가 첫 기회다. */
registerRuntimeHook("afterBattleSetup", () => {
  if (typeof markAimHintDone !== "function") return;
  if (StellaRuntime.modules.optional("onboarding")?.isActive()) return;
  const g = currentStage()?.gimmicks ?? {};
  const line = GIMMICK_TEACH.find((t) => t.has(g) && !aimHintDone(t.id));
  if (!line) return;
  setTimeout(() => {
    // 판이 그 사이 바뀌었으면 말하지 않는다.
    if (!battle || battleComplete) return;
    if (
      (currentStage()?.gimmicks ?? {}) !== g &&
      !line.has(currentStage()?.gimmicks ?? {})
    )
      return;
    if (markAimHintDone(line.id)) say("luna", line.text);
  }, 5200);
});

registerRuntimeHook("afterDraw", () => {
  drawBoardSpeech();
  drawBossSpeech();
  drawNarration();
});
registerRuntimeHook("afterFeedbackUpdate", (d) => updateSpeech(d));
registerRuntimeHook("afterBattleSetup", () => clearSpeech());

StellaRuntime.modules.register("speech", { say, clear: clearSpeech });

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

registerRuntimeHook("afterDraw", () => {
  drawBoardSpeech();
  drawBossSpeech();
  drawNarration();
});
registerRuntimeHook("afterFeedbackUpdate", (d) => updateSpeech(d));
registerRuntimeHook("afterBattleSetup", () => clearSpeech());

StellaRuntime.modules.register("speech", { say, clear: clearSpeech });

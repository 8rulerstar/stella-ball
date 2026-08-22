/**
 * 키보드«만»으로 전투를 할 수 있는가.
 *
 * 마우스 이벤트를 한 번도 보내지 않는다. 키만으로 노드를 고르고, 반대편을
 * 고르고, 쏘고, 보스를 잡는 데까지 간다. 중간마다 낭독 영역이 실제로
 * 무엇을 말하는지도 함께 읽는다.
 *
 * 이 프로브가 틀리는 법:
 * 1. `evaluate` 로 상태를 바꿔 놓고 「키가 먹혔다」고 읽으면 아무것도 검증
 *    하지 못한다. 상태를 바꾸는 것은 판을 세울 때뿐이고, 조준·발사는 전부
 *    Input.dispatchKeyEvent 로만 한다.
 * 2. 키 하나에 rawKeyDown 과 keyUp 을 «둘 다» 보내야 한다. keyDown 만
 *    보내면 repeat 판정과 브라우저 상태가 어긋난다.
 * 3. 캔버스는 포커스를 받지 않는다. 핸들러가 window 에 있으므로 포커스는
 *    필요 없지만, 그래서 「탭으로 캔버스에 갔는가」를 성공 조건으로 삼으면
 *    안 된다 — 이 프로브는 «키가 먹히는가»만 본다.
 * 4. 입장 시네마(4.2초) 중에는 첫 키가 컷신 건너뛰기로 소비된다. 판이
 *    열린 뒤에 세기 시작해야 한다.
 * 5. 「멈추지 않았다」만 보는 검사는 뜻이 없다. 초점이 body 였으면 당연히
 *    안 멈춘다 — 고쳤는지 안 고쳤는지 구별하지 못한다. 초점이 «정말 거기
 *    있었는가»를 함께 확인해야 한다. 실제로 그 구별이 없는 검사를 썼다가
 *    통과를 잘못 읽을 뻔했다.
 * 6. 별지기가 노드로 서므로 캠페인에서는 aimStarReady() 가 늘 참이지만,
 *    1-1 수업 1단계는 파티가 비어 있어 노드가 0개다. 거기서는 이 조준
 *    키들이 원리적으로 아무 일도 하지 않는다 — 그 판은 따로 본다.
 *
 *   node scripts/probe-keyboard-battle.mjs
 */
import { setTimeout as delay } from "node:timers/promises";
import { launchProbe } from "./lib/probe-harness.mjs";

const probe = await launchProbe({ windowSize: "1280,900" });
const { evaluate, waitFor, send, close, errors } = probe;

const KEYS = {
  ArrowRight: {
    code: "ArrowRight",
    key: "ArrowRight",
    windowsVirtualKeyCode: 39,
  },
  ArrowLeft: { code: "ArrowLeft", key: "ArrowLeft", windowsVirtualKeyCode: 37 },
  ArrowUp: { code: "ArrowUp", key: "ArrowUp", windowsVirtualKeyCode: 38 },
  ArrowDown: { code: "ArrowDown", key: "ArrowDown", windowsVirtualKeyCode: 40 },
  Enter: {
    code: "Enter",
    key: "Enter",
    text: String.fromCharCode(13),
    windowsVirtualKeyCode: 13,
  },
  KeyF: { code: "KeyF", key: "f", text: "f", windowsVirtualKeyCode: 70 },
  Backspace: { code: "Backspace", key: "Backspace", windowsVirtualKeyCode: 8 },
  Space: { code: "Space", key: " ", text: " ", windowsVirtualKeyCode: 32 },
};

/* 함정 2 — 누름과 뗌을 짝으로 보낸다. */
async function press(name) {
  const k = KEYS[name];
  /* 글자가 있는 키는 text 를 실은 keyDown 으로 보낸다. rawKeyDown 으로
     보내면 페이지의 keydown 리스너는 받지만 «브라우저 기본 동작»이 안
     일어난다 — 포커스된 버튼에 Enter 를 rawKeyDown 으로 보내면 눌리지
     않는다. 실제로 그것 때문에 수업이 안 열리는 것을 게임 버그로 볼
     뻔했다. 화살표처럼 글자가 없는 키는 rawKeyDown 이 맞다. */
  await send("Input.dispatchKeyEvent", {
    type: k.text ? "keyDown" : "rawKeyDown",
    ...k,
  });
  await send("Input.dispatchKeyEvent", { type: "keyUp", ...k });
  await delay(90);
}

const STATE = `JSON.stringify({
  cursor: typeof aimCursor !== "undefined" ? aimCursor : "없음",
  hover: aimHover,
  picks: aimPick.slice(),
  flip: aimFlip,
  shots: battle?.shots,
  hp: boss?.hp,
  moving: !!ball?.moving,
  said: (document.querySelector("#aimLive")?.textContent || "").trim(),
})`;

function show(label, raw) {
  const d = JSON.parse(raw);
  console.log(
    `  ${label.padEnd(22)} 커서 ${String(d.cursor).padStart(2)} · 고름 [${d.picks.join(",")}] · 반대편 ${d.flip ? "예" : "아니오"} · 유성 ${d.shots}`,
  );
  if (d.said) console.log(`     낭독: 「${d.said}」`);
  return d;
}

try {
  await waitFor("typeof setupBattle === 'function'", 30000);
  await evaluate("window.StellaIntroObserver?.stop(), 1");
  await evaluate(
    "deployed = selected = ['gaon','biyeon','ria'], stageIndex = 2, resetBuild(), setupBattle(), 1",
  );
  await waitFor("!battleCine", 12000).catch(() => {}); // 함정 4
  await delay(700);

  console.log("\n════ 1. 커서를 키로 옮긴다");
  const before = JSON.parse(await evaluate(STATE));
  await press("ArrowRight");
  const c1 = show("→ 한 번", await evaluate(STATE));
  await press("ArrowRight");
  const c2 = show("→ 두 번", await evaluate(STATE));
  await press("ArrowLeft");
  const c3 = show("← 한 번", await evaluate(STATE));
  const moved =
    c1.cursor !== before.cursor &&
    c2.cursor !== c1.cursor &&
    c3.cursor === c1.cursor;
  console.log(`  ${moved ? "정상" : "✗ 커서가 키를 따르지 않는다"}`);

  console.log("\n════ 2. 키로 셋을 찍는다");
  await press("Enter");
  show("Enter (1번째)", await evaluate(STATE));
  await press("ArrowRight");
  await press("Enter");
  show("Enter (2번째)", await evaluate(STATE));
  await press("ArrowRight");
  await press("Enter");
  const picked = show("Enter (3번째)", await evaluate(STATE));
  console.log(
    `  ${picked.picks.length === 3 ? "정상 — 셋" : "✗ " + picked.picks.length + "개"}`,
  );

  console.log("\n════ 3. 반대편을 키로 고른다");
  await press("KeyF");
  const flipped = show("F", await evaluate(STATE));
  await press("KeyF");
  const unflipped = show("F 다시", await evaluate(STATE));
  console.log(
    `  ${flipped.flip !== picked.flip && unflipped.flip === picked.flip ? "정상 — 왕복" : "✗ 반대편이 안 바뀐다"}`,
  );

  console.log("\n════ 4. 전부 무르기");
  await press("Backspace");
  const cleared = show("Backspace", await evaluate(STATE));
  console.log(
    `  ${cleared.picks.length === 0 ? "정상 — 비었다" : "✗ 안 지워졌다"}`,
  );

  console.log("\n════ 5. 키로 다시 찍고 쏜다");
  for (const seq of ["Enter", "ArrowRight", "Enter", "ArrowRight", "Enter"])
    await press(seq);
  const ready = show("셋 다시", await evaluate(STATE));
  await press("Space");
  await delay(400);
  const fired = JSON.parse(await evaluate(STATE));
  console.log(
    `  유성 ${ready.shots} -> ${fired.shots}, 구르는 중 ${fired.moving ? "예" : "아니오"}  ${fired.shots === ready.shots - 1 ? "정상 — 한 발 나갔다" : "✗ 발사 안 됨"}`,
  );

  console.log("\n════ 6. 키만으로 보스를 잡는다");
  await evaluate("boss.maxHp = boss.hp = 60, syncBossHealth?.(), 1");
  for (let shot = 0; shot < 6; shot += 1) {
    await waitFor("!ball?.moving", 15000).catch(() => {});
    await delay(500);
    const s = JSON.parse(await evaluate(STATE));
    if (s.hp <= 0 || battleDone(s)) break;
    for (const seq of ["Enter", "ArrowRight", "Enter", "ArrowRight", "Enter"])
      await press(seq);
    await press("Space");
    await delay(1200);
  }
  await delay(2500);
  const end = JSON.parse(
    await evaluate(
      "JSON.stringify({hp: boss?.hp, done: battleComplete, card: (document.querySelector('#overlay')?.textContent||'').trim().slice(0,40)})",
    ),
  );
  console.log(
    `  보스 체력 ${end.hp} · 판 종료 ${end.done ? "예" : "아니오"} · 화면 「${end.card}」`,
  );

  /* 아래 셋은 적대적 검토에서 확인된 결함의 회귀 검사다. 셋 다 «키가
     먹혔는가»가 아니라 «먹힌 뒤 다른 것이 함께 일어나는가»를 본다. */
  console.log("\n════ 7. 초점이 어디냐에 따라 Enter 의 주인이 바뀐다");
  await evaluate(
    "deployed = selected = ['gaon','biyeon','ria'], stageIndex = 2, resetBuild(), setupBattle(), 1",
  );
  await waitFor("!battleCine", 12000).catch(() => {});
  await delay(700);
  /* 이 검사는 «초점이 정말 버튼에 있었는가»를 함께 확인해야 뜻이 있다.
     초점이 body 였으면 「안 멈췄다」는 당연한 결과라, 고쳤는지 안 고쳤는지
     구별하지 못한다. 실제로 처음엔 그 구별이 없는 검사를 썼다. */
  const FOCUS = "JSON.stringify({id: document.activeElement?.id || '(없음)'})";
  const ST = "JSON.stringify({paused: !!paused, picks: aimPick.length})";

  /* 계약: 초점이 «판»에 있으면 Enter 는 조준의 것, 초점이 «버튼»에 있으면
     버튼의 것. 웹의 규칙이 그렇고, 그래야 키보드로 판을 멈출 수도 있다.
     둘 다 확인해야 한 쪽을 고치다 다른 쪽이 죽는 것을 잡는다. */
  await evaluate("document.getElementById('game')?.focus(), 1");
  const fc = JSON.parse(await evaluate(FOCUS));
  await press("ArrowRight");
  await press("Enter");
  const onCanvas = JSON.parse(await evaluate(ST));
  console.log(
    `  초점 ${fc.id} → 고름 ${onCanvas.picks}개 · 멈춤 ${onCanvas.paused}  ${fc.id === "game" && onCanvas.picks === 1 && !onCanvas.paused ? "정상 — 판에서는 조준이 가져간다" : "✗"}`,
  );
  await press("Backspace");

  await evaluate("document.querySelector('#pauseButton')?.focus(), 1");
  const fb = JSON.parse(await evaluate(FOCUS));
  await press("Enter");
  await delay(400);
  const onButton = JSON.parse(await evaluate(ST));
  console.log(
    `  초점 ${fb.id} → 고름 ${onButton.picks}개 · 멈춤 ${onButton.paused}  ${fb.id === "pauseButton" && onButton.paused && onButton.picks === 0 ? "정상 — 버튼에서는 버튼이 가져간다" : "✗"}`,
  );
  await evaluate("if (paused) togglePauseMenu(); 1");
  await delay(400);

  console.log("\n════ 8. 노드가 셋 미만인 판 (마우스는 드래그로 떨어진다)");
  await evaluate(
    "deployed = selected = ['gaon','biyeon'], stageIndex = 2, resetBuild(), setupBattle(), 1",
  );
  await waitFor("!battleCine", 12000).catch(() => {});
  await delay(700);
  const d0 = JSON.parse(
    await evaluate(
      "JSON.stringify({nodes: aimNodes().length, ready: aimStarReady(), pull: aimKeyPull, shots: battle?.shots})",
    ),
  );
  await press("ArrowRight");
  await press("ArrowRight");
  await press("ArrowUp");
  const d1 = JSON.parse(
    await evaluate(
      "JSON.stringify({pull: aimKeyPull && {a: Math.round(aimKeyPull.a*180/Math.PI), d: Math.round(aimKeyPull.d)}, said: (document.querySelector('#aimLive')?.textContent||'').trim()})",
    ),
  );
  console.log(`  노드 ${d0.nodes}개 · 조준 준비 ${d0.ready}`);
  console.log(`  화살표 뒤 겨눔: ${JSON.stringify(d1.pull)}`);
  if (d1.said) console.log(`  낭독: 「${d1.said}」`);
  await press("Space");
  await delay(600);
  const d2 = JSON.parse(
    await evaluate(
      "JSON.stringify({shots: battle?.shots, moving: !!ball?.moving})",
    ),
  );
  console.log(
    `  유성 ${d0.shots} -> ${d2.shots} · 구르는 중 ${d2.moving ? "예" : "아니오"}  ${d2.shots === d0.shots - 1 && d1.pull ? "정상 — 겨누고 쐈다" : "✗ 드래그 대응물이 없다"}`,
  );

  if (errors.length) console.log("\n콘솔 오류: " + errors.join(" | "));
  else console.log("\n콘솔 오류 없음");
} finally {
  close();
}

function battleDone(s) {
  return s.hp !== undefined && s.hp <= 0;
}

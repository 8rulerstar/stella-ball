/**
 * 키보드«만»으로 1-1 수업을 끝까지 통과할 수 있는가.
 *
 * 마우스 이벤트를 한 번도 보내지 않는다. 수업 카드의 버튼은 Tab 으로 찾아
 * Enter 로 누르고, 실습은 화살표·Enter·Space 로만 한다.
 *
 * 이것이 이 기능의 진짜 관문이다. 캠페인 전투가 키보드로 되더라도 수업에서
 * 막히면 키보드만 쓰는 사람은 캠페인에 도달하지 못한다. 실제로 수업 1단계는
 * 파티를 비워 두어 노드가 0개이고, 그래서 aimStarReady()가 거짓이라 Space 가
 * launchAimStarShot 에서 즉시 되돌아갔다 — 발사 경로가 드래그 하나뿐이었다.
 *
 * 이 프로브가 틀리는 법:
 * 1. `click()` 을 한 번이라도 쓰면 검증이 무너진다. 버튼은 반드시 Tab 으로
 *    포커스를 옮겨 Enter 로 누른다.
 * 2. Tab 은 문서 순서를 돈다. 찾는 버튼이 뒤에 있으면 여러 번 눌러야 하고,
 *    한 바퀴를 넘게 돌면 «없는 것»이다 — 무한 루프가 되지 않게 상한을 둔다.
 * 3. 카드가 뜨는 데 시간이 걸린다. Tab 을 돌리기 «전에» 그 문구가 화면에
 *    나타났는지부터 기다려야 한다.
 * 4. 실습 중에는 입력이 잠깐 잠긴다(isCombatInputLocked). 키가 안 먹은 것과
 *    아직 안 열린 것을 구별하려면 상태를 보고 기다려야 한다.
 *
 *   node scripts/probe-keyboard-onboarding.mjs
 */
import { setTimeout as delay } from "node:timers/promises";
import { launchProbe } from "./lib/probe-harness.mjs";

const probe = await launchProbe({ windowSize: "1280,900" });
const { evaluate, waitFor, send, close, errors } = probe;

const KEYS = {
  Tab: { code: "Tab", key: "Tab", windowsVirtualKeyCode: 9 },
  Enter: {
    code: "Enter",
    key: "Enter",
    text: String.fromCharCode(13),
    windowsVirtualKeyCode: 13,
  },
  ArrowRight: {
    code: "ArrowRight",
    key: "ArrowRight",
    windowsVirtualKeyCode: 39,
  },
  Space: { code: "Space", key: " ", text: " ", windowsVirtualKeyCode: 32 },
};

async function press(name, pause = 90) {
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
  await delay(pause);
}

/* 포커스가 없으면 activeElement 는 <body> 다. body 의 textContent 에는 화면
   전체 글자가 들어 있어서, 그것으로 「그 버튼에 닿았다」를 판정하면 아무
   데서나 참이 된다 — 실제로 그렇게 엉뚱한 자리에서 Enter 를 눌렀다.
   누를 수 있는 것(BUTTON)일 때만, 그 요소 «자신»의 글자를 본다. */
const focused = `(() => {
  const a = document.activeElement;
  if (!a || a.tagName !== "BUTTON") return "";
  return (a.textContent || a.getAttribute("aria-label") || "").trim().slice(0, 40);
})()`;

/* 함정 1·2·3 — 문구가 뜰 때까지 기다렸다가, Tab 으로 찾아 Enter 로 누른다. */
async function tabToAndPress(text, label) {
  await waitFor(
    `[...document.querySelectorAll("button")].some((b) => !b.disabled && b.textContent.includes(${JSON.stringify(text)}))`,
    15000,
  );
  for (let i = 0; i < 40; i += 1) {
    const now = await evaluate(focused);
    if (now.includes(text)) {
      await press("Enter", 700);
      console.log(`  Tab ${String(i).padStart(2)}회 → Enter  「${text}」`);
      return true;
    }
    await press("Tab", 60);
  }
  console.log(
    `  ✗ 「${text}」 에 Tab 으로 못 닿았다 (현재 포커스: ${await evaluate(focused)})`,
  );
  return false;
}

const S = `JSON.stringify({
  phase: typeof onboarding !== "undefined" ? onboarding?.phase : "없음",
  bossHit: typeof onboarding !== "undefined" ? !!onboarding?.bossHit : false,
  aimed: typeof onboarding !== "undefined" ? !!onboarding?.aimed : false,
  figure: typeof onboarding !== "undefined" ? !!onboarding?.figureResolved : false,
  nodes: typeof aimNodes === "function" ? aimNodes().length : -1,
  picks: typeof aimPick !== "undefined" ? aimPick.length : -1,
  shots: battle?.shots,
  locked: typeof isCombatInputLocked === "function" ? isCombatInputLocked() : "?",
  moving: !!ball?.moving,
})`;

/* 함정 4 — 판이 실제로 손에 들어올 때까지 기다린다. */
async function waitPlayable(ms = 20000) {
  await waitFor(
    "!!battle && !battleComplete && !isCombatInputLocked() && !ball?.moving && !battleCine",
    ms,
  ).catch(() => {});
  await delay(400);
}

async function aimAndFire(picks = 3) {
  await waitPlayable();
  const before = JSON.parse(await evaluate(S));
  if (before.nodes <= 0) {
    // 노드가 없는 판(수업 1단계) — 드래그의 키보드 대응물로 바로 쏜다.
    await press("Space", 900);
    return "노드 0개 · Space 로 바로 발사";
  }
  /* 커서가 없을 때의 첫 Enter 는 «커서를 세우는» 동작이다 — 어디를 찍을지
     들려주고 나서 찍게 하는 것이 설계다. 그래서 화살표로 커서를 먼저
     세우고 센다. 이걸 모르고 Enter 부터 세면 늘 하나가 모자란다. */
  await press("ArrowRight");
  for (let i = 0; i < picks; i += 1) {
    await press("Enter");
    if (i < picks - 1) await press("ArrowRight");
  }
  const mid = JSON.parse(await evaluate(S));
  await press("Space", 900);
  return `노드 ${before.nodes}개 · 찍기 ${mid.picks}개 · Space`;
}

try {
  await waitFor("typeof showTitle === 'function'", 30000);
  /* 프로필은 하니스가 매번 새로 만든다 — localStorage 를 손으로 지우고
     showTitle() 을 다시 부르면 오히려 상태가 어긋나 수업이 안 열린다.
     실제로 그렇게 해서 카드 1이 영영 안 떴다. 그냥 첫 화면을 기다린다. */
  await waitFor(
    '[...document.querySelectorAll("button")].some((b) => b.textContent.includes("1분 튜토리얼"))',
    20000,
  );
  await delay(1200);

  console.log("\n════ 타이틀에서 수업으로 (탭·엔터만)");
  if (!(await tabToAndPress("처음인가요? 1분 튜토리얼")))
    throw new Error("수업 진입 실패");
  await delay(2500);

  console.log("\n════ 1단계 — 드래그를 가르치는 판 (노드 0개)");
  if (!(await tabToAndPress("유성 발사하기")))
    throw new Error("1단계 카드 실패");
  console.log("  " + (await aimAndFire()));
  await waitFor("!!onboarding?.bossHit", 20000).catch(() => {});
  let s = JSON.parse(await evaluate(S));
  console.log(
    `  보스 명중 ${s.bossHit ? "예 — 잠김이 풀렸다" : "✗ 아니오 (여기서 갇힌다)"}`,
  );
  if (!s.bossHit) throw new Error("1단계에서 갇혔다");

  /* 카드 순서는 test-onboarding-e2e.mjs 의 여정과 같아야 한다. 안내 카드
     뒤에 실습을 «여는» 카드가 하나 더 있는데, 그것을 빠뜨리면 입력이 잠긴
     채로 키를 눌러 「찍기가 모자라다」로 보인다 — 실제로 그렇게 읽었다. */
  console.log("\n════ 2단계 — 노드 조준");
  if (!(await tabToAndPress("다음 · 노드 조준")))
    throw new Error("2단계 안내 카드 실패");
  if (!(await tabToAndPress("셋 찍고 Space로 발사")))
    throw new Error("2단계 실습 카드 실패");
  console.log("  " + (await aimAndFire(3)));
  await waitFor("!!onboarding?.aimed", 25000).catch(() => {});
  s = JSON.parse(await evaluate(S));
  console.log(`  노드 조준 완료 ${s.aimed ? "예" : "✗ 아니오"}`);
  if (!s.aimed) throw new Error("2단계에서 갇혔다");

  console.log("\n════ 3단계 — 별자리");
  if (!(await tabToAndPress("다음 · 별자리")))
    throw new Error("3단계 안내 카드 실패");
  if (!(await tabToAndPress("별빛을 남기고 발사")))
    throw new Error("3단계 실습 카드 실패");
  console.log("  " + (await aimAndFire(3)));
  await waitFor("!!onboarding?.figureResolved", 30000).catch(() => {});
  s = JSON.parse(await evaluate(S));
  console.log(
    `  별자리 성립 ${s.figure ? "예" : "✗ 아니오"} · 단계 ${s.phase}`,
  );

  console.log("\n════ 4단계 — 실전");
  await tabToAndPress("직접 잡아보기").catch(() => {});
  for (let shot = 0; shot < 8; shot += 1) {
    const now = JSON.parse(
      await evaluate("JSON.stringify({done: battleComplete, hp: boss?.hp})"),
    );
    if (now.done || now.hp <= 0) break;
    console.log("  " + (await aimAndFire(3)));
    await delay(1400);
  }
  await delay(3000);
  const end = JSON.parse(
    await evaluate(
      "JSON.stringify({hp: boss?.hp, done: battleComplete, card: (document.querySelector('#overlay')?.textContent||'').trim().slice(0,44)})",
    ),
  );
  console.log(
    `\n  보스 ${end.hp} · 종료 ${end.done ? "예" : "아니오"} · 「${end.card}」`,
  );

  console.log(
    errors.length ? "\n콘솔 오류: " + errors.join(" | ") : "\n콘솔 오류 없음",
  );
} finally {
  close();
}

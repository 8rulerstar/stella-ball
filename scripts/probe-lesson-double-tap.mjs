/**
 * 수업 첫 버튼 더블탭 — 결함 재현과 수정 확인.
 *
 * LESSON_DOUBLE_TAP_2026_08_23.md 의 결함이다: 첫 버튼을 45ms 간격으로 두 번
 * 두드리면 덮개가 그 클릭 안에서 사라지고 둘째 타가 판에 떨어져 «게임이 대신»
 * 유성을 쏜다. 플레이어는 드래그를 한 번도 하지 않았는데 수업이 스스로
 * 통과한다.
 *
 * 이 프로브는 진짜 입력을 쓴다 — CDP Input 도메인으로 버튼 좌표에 마우스
 * 누름·뗌을 두 번 보낸다. 합성 이벤트(dispatchEvent)로는 이 결함을 못 본다.
 *
 * 방패를 끈 상태와 켠 상태를 «한 실행 안에서» 비교한다. shieldLessonTap 을
 * 빈 함수로 덮으면 수정 이전 동작이 그대로 돌아온다 — 그래서 「고쳤다」가
 * 아니라 「고치지 않으면 재현된다」까지 같은 실행이 보여 준다.
 *
 * 과잉 수정은 이 프로브가 못 잡는다. 그쪽은 `npm run test:onboarding` 이
 * 판정한다 — 앞서 두 번의 실패가 정확히 그 자리에서 걸렸다.
 *
 *   node --experimental-websocket scripts/probe-lesson-double-tap.mjs
 */
import { launchProbe } from "./lib/probe-harness.mjs";

const GAP_MS = Number(
  (process.argv.indexOf("--gap") >= 0 &&
    process.argv[process.argv.indexOf("--gap") + 1]) ||
    45,
);

const probe = await launchProbe({ headless: true, windowSize: "1280,900" });
const ev = (e) => probe.evaluate(e);
const wait = (ms) => ev(`new Promise((r) => setTimeout(r, ${ms}))`);

async function openLesson() {
  await ev(`(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    document.querySelector(".oo2-skip")?.click();
    await w(1500);
    StellaRuntime.modules.require("onboarding").showTutorial(true);
    await w(1300);
    return 1;
  })()`);
  // 버튼은 revealDelay(최소 620ms) 뒤에 눌린다.
  await probe.waitFor(
    `(() => { const b = document.querySelector("#onboardingContinue");
      return b && !b.disabled; })()`,
    12000,
    "첫 버튼 활성화",
  );
}

const STATE = `(() => ({
  shots: battle?.shots ?? null,
  moving: Boolean(ball?.moving),
  bossHit: Boolean(onboarding?.bossHit),
  phase: onboarding?.phase ?? null,
  panelVisible: onboarding?.panelVisible ?? null,
}))()`;

async function buttonCentre() {
  return ev(`(() => {
    const b = document.querySelector("#onboardingContinue");
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
}

async function tap(pt) {
  for (const type of ["mousePressed", "mouseReleased"])
    await probe.send("Input.dispatchMouseEvent", {
      type,
      x: pt.x,
      y: pt.y,
      button: "left",
      clickCount: 1,
      buttons: type === "mousePressed" ? 1 : 0,
    });
}

async function run(label, disableShield) {
  await ev(
    `(() => { try { localStorage.clear(); } catch (e) {} return 1; })()`,
  );
  await ev(`location.reload()`).catch(() => {});
  await wait(400);
  await probe.ready();
  await openLesson();
  if (disableShield)
    await ev(`(() => { shieldLessonTap = () => {}; return "off"; })()`);
  const pt = await buttonCentre();
  const before = await ev(STATE);
  await tap(pt);
  await wait(GAP_MS);
  await tap(pt);
  await wait(700);
  const after = await ev(STATE);
  const fired = after.shots !== before.shots || after.moving || after.bossHit;
  console.log(
    `[${label}]`.padEnd(14),
    `유성 ${before.shots}→${after.shots}`,
    "| 움직임",
    after.moving ? "예" : "아니오",
    "| bossHit",
    after.bossHit ? "예" : "아니오",
    "| 판 드러남",
    after.panelVisible === false ? "예" : "아니오",
    fired ? " ← 게임이 대신 쐈다" : " ← 아무것도 안 쐈다",
  );
  return fired;
}

try {
  console.log(`더블탭 간격 ${GAP_MS}ms · 진짜 마우스 입력(CDP Input)\n`);
  const broken = await run("방패 끔", true);
  const fixed = await run("방패 켬", false);
  console.log(
    `\n판정: 재현 ${broken ? "O" : "X"} · 수정 ${!fixed ? "O" : "X"}`,
  );
  if (!broken)
    console.log(
      "  주의: 방패를 꺼도 재현되지 않았다 — 이 실행은 수정을 증명하지 못한다.",
    );
  console.log("errors:", JSON.stringify(probe.errors.slice(0, 4)));
} finally {
  probe.close();
}

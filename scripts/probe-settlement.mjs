/**
 * 승리와 패배 «화면»을 실기로 본다.
 *
 * 판이 끝나는 두 순간은 플레이어가 반드시 보는 화면인데 프로브가 하나도
 * 없었다. 여기서는 두 결말에 실제 경로로 도달해 스크린샷과 문안을 뽑고,
 * 배치가 깨졌는지(못 닿는 버튼·눌려 죽은 상자)를 판정한다.
 *
 * 이 프로브가 틀리는 법:
 * 1. `win()`·`fail()` 을 직접 부르면 «화면»은 뜨지만 그 전에 실제 경로가
 *    세우는 상태(정산 큐, 보상 적립, 콤보 정산)를 건너뛴다. 보상 칸이
 *    비어 보이는 것이 게임 탓인지 호출 탓인지 알 수 없게 된다. 승리는
 *    보스 체력을 1로 두고 «맞혀서», 패배는 남은 유성을 1로 두고 «빗맞혀서»
 *    도달한다.
 * 2. 패배 판정은 유성이 «멈춘 뒤»에 돈다(finalizeBilliardShot). 굴리자마자
 *    읽으면 아직 아무 일도 안 일어난 화면을 찍는다.
 * 3. 승리는 연출이 길다. 화면이 다 서기 전에 찍으면 절반만 나온다.
 * 4. 외부 관측자 인트로를 안 끄면 무엇을 찍어도 새까맣다.
 * 5. 한 브라우저에서 두 결말을 «이어서» 보면 안 된다. 승리가 남긴
 *    `battleComplete`·`run` 때문에 다음 판의 대기가 즉시 끝나고, 앞 결말의
 *    오버레이가 그대로 찍힌다 — 실제로 첫 실행에서 패배 화면이 「글줄 0,
 *    버튼은 승리의 것」으로 나왔다. 결말마다 브라우저를 새로 연다.
 * 6. 남은 유성은 fireMeteor() 안에서 줄어든다. 아래 SHOOT 주석 참고.
 *
 *   node scripts/probe-settlement.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { launchProbe } from "./lib/probe-harness.mjs";

const OUT = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : "artifacts/settlement";
mkdirSync(OUT, { recursive: true });

const SIZES = process.argv.includes("--sizes")
  ? process.argv
      .slice(process.argv.indexOf("--sizes") + 1)
      .filter((a) => /^\d+,\d+$/.test(a))
  : ["1280,900", "1280,760"];

const TEXT = `(() => {
  const root = document.querySelector("#overlay") || document.body;
  const vis = (el) => {
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden" && +cs.opacity > 0.05;
  };
  const lines = [];
  const walk = (el) => {
    if (!vis(el)) return;
    for (const n of el.childNodes) {
      if (n.nodeType === 3) {
        const t = n.textContent.trim();
        if (t) lines.push(t);
      } else if (n.nodeType === 1) walk(n);
    }
  };
  walk(root);
  return JSON.stringify({
    lines,
    buttons: [...root.querySelectorAll("button")].filter(vis).map((b) => b.textContent.trim().slice(0, 24)),
    offscreen: [...root.querySelectorAll("button")].filter(vis).filter((b) => {
      const r = b.getBoundingClientRect();
      return r.bottom > innerHeight + 1 || r.top < -1;
    }).map((b) => b.textContent.trim().slice(0, 16)),
    crushed: [...root.querySelectorAll("*")].filter(vis).filter((el) =>
      /auto|scroll/.test(getComputedStyle(el).overflowY) &&
      el.clientHeight < 8 && el.scrollHeight > 24,
    ).map((el) => String(el.className).split(" ")[0]),
  });
})()`;

const SETUP = `(() => {
  deployed = selected = ["gaon","biyeon","ria"];
  stageIndex = 2;
  resetBuild();
  setupBattle();
  return 1;
})()`;

/* 함정 1·6 — 반드시 fireMeteor() 로 쏜다. ball.vx/vy 에 직접 속도를 주면
   유성은 굴러가고 물리도 돌지만 «남은 유성이 줄지 않는다» — 감소가 발사
   함수 안에 있기 때문이다(game-combat.js:1180). 그래서 패배 판정이 영영
   서지 않는다. 실제로 그 단축 때문에 패배 화면이 안 뜨는 것을 게임 버그로
   볼 뻔했다. */
const SHOOT = `(() => {
  const t = window.__aimAt;
  fireMeteor(t.x - ball.x, t.y - ball.y, 1);
  return 1;
})()`;

for (const size of SIZES) {
  console.log(`\n████ 창 ${size}`);
  for (const ending of ["win", "lose"]) {
    /* 함정 5 — 결말마다 새 브라우저. */
    const probe = await launchProbe({ windowSize: size });
    const { evaluate, waitFor, send, close, errors } = probe;
    try {
      await waitFor("typeof setupBattle === 'function'", 30000);
      await evaluate("window.StellaIntroObserver?.stop(), 1"); // 함정 4
      await evaluate(SETUP);
      await waitFor("!battleCine", 12000).catch(() => {});
      await delay(500);
      if (ending === "win")
        await evaluate(
          "boss.hp = 1, syncBossHealth?.(), window.__aimAt = boss, 1",
        );
      else
        await evaluate(
          "battle.shots = 1, boss.maxHp = boss.hp = 999999, syncBossHealth?.(), window.__aimAt = { x: 40, y: 860 }, 1",
        );
      await evaluate(SHOOT);
      /* 함정 2·3 — 유성이 멈추고 화면이 다 설 때까지 기다린다. */
      await waitFor("battleComplete", 20000).catch(() => {});
      await delay(3200);
      const { data } = await send("Page.captureScreenshot", { format: "png" });
      writeFileSync(
        `${OUT}/${ending}-${size.replace(",", "x")}.png`,
        Buffer.from(data, "base64"),
      );
      const d = JSON.parse(await evaluate(TEXT));
      const bad = d.offscreen.length + d.crushed.length;
      console.log(
        `\n══ ${ending === "win" ? "승리" : "패배"}  글줄 ${d.lines.length} · 버튼 ${d.buttons.length}  ${bad ? "✗ 배치 문제 " + bad + "건" : "· 배치 정상"}`,
      );
      console.log("   " + d.lines.join(" / "));
      console.log("   버튼: " + (d.buttons.join(" | ") || "(없음)"));
      if (d.offscreen.length)
        console.log("   화면 밖: " + d.offscreen.join(", "));
      if (d.crushed.length)
        console.log("   눌려 죽음: " + d.crushed.join(", "));
      if (errors.length) console.log("   콘솔 오류: " + errors.join(" | "));
    } finally {
      close();
    }
  }
}
console.log(`\n스크린샷 -> ${OUT}/`);

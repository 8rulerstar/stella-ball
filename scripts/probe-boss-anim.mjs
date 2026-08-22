/**
 * 거상 시트 상태 프로브 (2026-08-22).
 *
 * 보스 팩은 idle/hit/attack/death 네 시트를 매핑하는데(슬러그당 4장,
 * 총 40장), 그리기가 실제로 네 상태를 다 부르는지 잰다. 이 프로브를
 * 만든 계기 — 수정 전에는 "hit":"idle" 둘만 골라 attack·death 20장
 * (293KB)이 한 번도 그려지지 않았다.
 *
 * 재는 법 — drawFrame을 감싸 보스 스펙으로 들어온 (state, frame) 쌍을
 * 모으고, 세 국면을 차례로 강제한다: ① 평상시 ② bossRoar 발동
 * ③ bossOutro 발동. requestAnimationFrame 몇 박자를 실제로 돌려
 * 프레임 진행(0→3, 마지막 장 유지)도 함께 확인한다.
 *
 * 함정 하나 — drawBossRoar가 t>0.95에서 bossRoar를 스스로 지우므로,
 * 국면 ②는 발동 «직후» 몇 프레임 안에 샘플링해야 한다. 그래서 국면마다
 * 수집을 먼저 켜고 신호를 세팅한다.
 *
 *   node scripts/probe-boss-anim.mjs
 */
import { setTimeout as delay } from "node:timers/promises";
import { launchProbe } from "./lib/probe-harness.mjs";
const probe = await launchProbe({ headless: true, profilePrefix: "banim-" });
try {
  const { evaluate, waitFor } = probe;
  await waitFor("typeof setupBattle === 'function'", 20000, "runtime");
  await evaluate(`(() => {
    stageIndex = stages.findIndex(s => s.id === "2-2");
    deployed = ["gaon","biyeon","ria"]; selected = [...deployed];
    resetBuild(); setupBattle(); settings.sfx = 0;
    if (typeof skipBattleIntro === "function") skipBattleIntro();
    window.__bossDraws = [];
    const real = drawFrame;
    drawFrame = function (spec, cx, cy, frame, scale, state) {
      if (spec && spec.slug) window.__bossDraws.push({ state, frame });
      return real.apply(this, arguments);
    };
    return currentStage().id;
  })()`);
  const sample = async (label, arm) => {
    await evaluate(`(() => { window.__bossDraws = []; ${arm}; return 1; })()`);
    await delay(900);
    const rows = await evaluate(`window.__bossDraws`);
    const states = {};
    for (const r of rows) (states[r.state] ??= new Set()).add(r.frame);
    const out = Object.fromEntries(
      Object.entries(states).map(([k, v]) => [k, [...v].sort((a, b) => a - b)]),
    );
    console.log(label, JSON.stringify(out));
    return out;
  };
  const idle = await sample("① 평상시   ", "");
  const roar = await sample(
    "② 포효     ",
    "bossRoar = { at: frameClock, until: frameClock + 460 }",
  );
  const death = await sample("③ 퇴장     ", "bossOutro = { at: frameClock }");
  const ok =
    Object.keys(idle).includes("idle") &&
    Object.keys(roar).includes("attack") &&
    Object.keys(death).includes("death");
  console.log(
    ok
      ? "\n판정: 네 상태 중 idle·attack·death 확인 — attack·death 시트가 살아났다."
      : "\n판정: 실패 — " +
          JSON.stringify({
            idle: Object.keys(idle),
            roar: Object.keys(roar),
            death: Object.keys(death),
          }),
  );
  process.exitCode = ok ? 0 : 1;
} finally {
  await probe.close();
}

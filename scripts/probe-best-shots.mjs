/**
 * 최고 기록 파괴 프로브 (2026-08-23).
 *
 * 되돌림 능력(북두칠성 polestarBoon)이 «죽이는 그 샷»에 붙으면
 * battle.shots 가 다시 shotMax 로 돌아가 shotsUsed 가 0이 된다. 0은
 * 기록이 아니라 고장이고, 로더(game-meta-state.js 의 bestShots 행)는
 * min 1 미만을 거부하며 99(기록 없음)로 되돌린다 — 즉 잘 친 판이
 * 플레이어의 진짜 최고 기록을 지웠다. 수정 전 실측: 기록 2 → 저장 0 →
 * 재기동 후 99.
 *
 * 재는 법 — 기록 2를 심고, 되돌림이 붙은 킬 상태(shots == shotMax)를
 * 만들어 승리시킨 뒤, 저장값과 «재기동 후» 값을 둘 다 읽는다. 메모리
 * 값만 보면 안 된다: 파괴는 로더가 하므로 새로고침 전에는 보이지 않는다.
 *
 * 대조군은 scripts/probe-best-shots.mjs 자체가 아니라 별도 확인으로 뒀다 —
 * 평범한 3샷 클리어가 3으로 남는지(과잉 수정 방지). 수정 후 실측:
 * 되돌림 킬 2→1(1로 유지), 정상 3샷 99→3.
 *
 *   node scripts/probe-best-shots.mjs
 */
import { setTimeout as delay } from "node:timers/promises";
import { launchProbe } from "./lib/probe-harness.mjs";
const probe = await launchProbe({ headless: true, profilePrefix: "bs-" });
try {
  const { evaluate } = probe;
  const before = await evaluate(`(() => {
    progress.clears = 3; progress.bestShots = 2; saveProgress();
    return { bestShots: progress.bestShots, raw: localStorage.getItem("prism-breakers.progress.v1") };
  })()`);
  console.log("기록 심기:", before.bestShots);
  const mid = await evaluate(`(() => {
    stageIndex = 2; deployed = ["gaon","biyeon","ria"]; selected = [...deployed];
    resetBuild(); setupBattle(); settings.sfx = 0;
    if (typeof skipBattleIntro === "function") skipBattleIntro();
    const shotMax = battle.shotMax;
    // 한 발 쏘고 그 샷이 되돌림을 받은 상태를 만든다 (북두칠성 polestarBoon)
    battle.shots = shotMax - 1;      // 한 발 썼다
    battle.shots += 1;               // 되돌림 +1  -> shots == shotMax
    const shotsUsed = battle.shotMax - battle.shots;
    return { shotMax, shots: battle.shots, shotsUsed };
  })()`);
  console.log("킬 직전 상태:", JSON.stringify(mid));
  const after = await evaluate(`(() => {
    boss.hp = 0; scheduleWin();
    return 1;
  })()`);
  await delay(4000);
  const res = await evaluate(`({
    inMemory: progress.bestShots,
    stored: (() => { try { return JSON.parse(localStorage.getItem("prism-breakers.progress.v1")).bestShots; } catch { return "?"; } })(),
  })`);
  console.log("승리 직후:", JSON.stringify(res));
  // 재기동 후 로더가 무엇을 하는가
  await evaluate(`location.reload(), 1`).catch(() => {});
  await delay(1500);
  await probe.ready();
  const reloaded = await evaluate(`({ bestShots: progress.bestShots })`);
  console.log("재기동 후:", JSON.stringify(reloaded));
  const destroyed = reloaded.bestShots === 99;
  console.log(
    destroyed
      ? "판정: 실패 — 기록이 사라지고 99(기록 없음)로 돌아갔다."
      : "판정: 기록이 살아남았다 (" +
          before.bestShots +
          " -> " +
          reloaded.bestShots +
          ")",
  );
  process.exitCode = destroyed ? 1 : 0;
} finally {
  await probe.close();
}

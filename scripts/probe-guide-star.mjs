/**
 * 관측 잔광(guideStarCharges) 소모 프로브 (2026-08-22).
 *
 * 스테이지 설명은 «첫 공명이 안내별 둘을 밝혀»라고 말하고, 데이터는
 * guideStarCharges: 1을 준다. 이 프로브는 그 «1»이 실제로 한 번 쓰이고
 * 사라지는지 센다.
 *
 * 재는 법 — addGuideStars를 감싸 성공 횟수를 세고, 샷 경계마다 실제
 * 코드와 같은 clearFigureShot()을 부른다(그 함수가 guideStarClaimed를
 * false로 되돌리는 유일한 곳이다). 잔광이 정말 «1회»라면 첫 샷에서만
 * 참이 나오고 그 뒤로는 전부 거짓이어야 한다.
 *
 * 함정 하나 — addGuideStars는 성공해도 side effect(노드 추가)를 남긴다.
 * 그래서 회차마다 nodes 길이도 같이 찍어 «세기»가 실제 노드 생성과
 * 어긋나지 않는지 교차 확인한다.
 *
 *   node scripts/probe-guide-star.mjs
 */
import { launchProbe } from "./lib/probe-harness.mjs";
const probe = await launchProbe({ headless: true, profilePrefix: "guide-" });
try {
  const { evaluate, waitFor } = probe;
  await waitFor("typeof setupBattle === 'function'", 20000, "runtime");
  const out = await evaluate(`(() => {
    stageIndex = stages.findIndex(s => s.id === "1-2");
    deployed = ["gaon","biyeon","ria"]; selected = [...deployed];
    resetBuild(); setupBattle(); settings.sfx = 0;
    if (typeof skipBattleIntro === "function") skipBattleIntro();
    const rows = [];
    const contact = { x: 360, y: 500, incoming: { x: 0.8, y: -0.6 } };
    for (let shot = 1; shot <= 5; shot++) {
      const state = currentFigureShot();
      const before = battle.guideStarCharges;
      const got = addGuideStars(state, contact);
      rows.push({
        shot,
        chargesBefore: before,
        granted: Boolean(got),
        nodes: state.nodes.length,
        chargesAfter: battle.guideStarCharges,
      });
      clearFigureShot();
    }
    return {
      stage: currentStage().id,
      label: currentStage().guideStarCharges,
      nodeEconomy: typeof nodeEconomyOn === "function" ? nodeEconomyOn() : null,
      rows,
      chargesAtEnd: battle.guideStarCharges,
    };
  })()`);
  console.log(JSON.stringify(out, null, 2));
  const granted = out.rows.filter((r) => r.granted).length;
  console.log(
    "\n안내별이 밝혀진 샷: " +
      granted +
      "/5 · 남은 잔광: " +
      out.chargesAtEnd +
      " (설명이 말하는 값: " +
      out.label +
      ")",
  );
  console.log(
    granted === 1
      ? "판정: 설명대로 «첫 공명» 한 번만 쓰인다."
      : "판정: 잔광이 소모되지 않는다 — 매 샷 다시 밝혀진다.",
  );
} finally {
  await probe.close();
}

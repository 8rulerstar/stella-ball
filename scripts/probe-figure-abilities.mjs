/**
 * 별자리 능력 회귀 프로브 (2026-08-22).
 *
 * 8종의 별자리가 각자 «자기» 능력을 내는지 확인한다. 각 도형의 뼈대
 * 좌표로 점을 만들어 resolveFigure를 직접 부르고, 캐스트가 돈 뒤 피해와
 * 상태(표식·비행·항로·유성 수·각성 인원)를 함께 찍는다.
 *
 * 두 함정이 있다 — 둘 다 이 프로브가 처음 쓸 때 걸렸다:
 *   - 정다각형으로 점을 만들면 같은 점 개수의 도형이 하나로 쏠린다
 *     (4점은 전부 화살자리, 5점은 전부 오망성으로 분류됐다). 반드시
 *     FIGURE_SHAPES의 뼈대 좌표를 쓴다.
 *   - 오망성만 points가 null이다. 오각형과 «같은 점»을 두 칸씩 이어
 *     별이 되는 설계라, 좌표 대신 정오각형을 만들어 넣어야 한다.
 *
 * 2026-08-22 기준선(2-2 · 보스 체력 고정):
 *   양자리 42 · 화살자리 112 · 까마귀 56(표식 O) · 카시오페이아 70 ·
 *   백조 70(비행 O) · 오망성 70(각성 3) · 오리온 219 ·
 *   북두칠성 98(유성 6 · 항로 O)
 *
 *   node scripts/probe-figure-abilities.mjs
 */
import { setTimeout as delay } from "node:timers/promises";
import { launchProbe } from "./lib/probe-harness.mjs";
const probe = await launchProbe({ headless: true, profilePrefix: "figs-" });
try {
  const { evaluate, waitFor } = probe;
  await waitFor("typeof setupBattle === 'function'", 20000, "runtime");
  const shapes = await evaluate(`Object.keys(FIGURE_ABILITIES)`);
  for (const id of shapes) {
    const r = await evaluate(`(() => {
      try {
        stageIndex = stages.findIndex(s => s.id === "2-2");
        deployed = ["gaon","biyeon","ria"]; selected = [...deployed];
        resetBuild(); setupBattle(); settings.sfx = 0;
        boss.hp = boss.maxHp = 99999;
        if (typeof skipBattleIntro === "function") skipBattleIntro();
        /* 정다각형으로 만들면 같은 점 개수의 도형이 하나로 쏠린다(4점은
           화살자리, 5점은 오망성). 각 도형의 «뼈대 좌표»를 그대로 써야
           그 도형으로 분류된다. */
        let shape = null;
        for (const list of Object.values(FIGURE_SHAPES || {})) {
          const hit = list.find(s => s.id === ${JSON.stringify(id)});
          if (hit) { shape = hit; break; }
        }
        if (!shape) return { id: ${JSON.stringify(id)}, err: "shape 없음" };
        /* 오망성은 points가 null이다 — 오각형과 «같은 점»을 두 칸씩 이어
           별이 되는 설계라, 좌표 대신 정오각형을 만들어 준다. */
        const base = shape.points ||
          Array.from({ length: 5 }, (_, k) => {
            const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
            return [Math.cos(a), Math.sin(a)];
          });
        const want = base.length;
        const pts = base.map(([px, py]) => ({
          x: clamp(boss.x + px * 150, 30, W - 30),
          y: clamp(boss.y + py * 150, 30, H - 30),
          col: "#ffd27f", label: "검증",
        }));
        const before = { hp: boss.hp, shots: battle.shots, mark: Boolean(ball.mark),
                         glide: ball.glide || 0, trueAim: Boolean(ball.trueAim),
                         awake: gates.filter(g => g.awake).length, shield: boss.shellLayers ?? null };
        resolveFigure(pts);
        return { id: ${JSON.stringify(id)}, want, points: pts.length,
                 figure: figureFx?.shape?.id ?? null, before };
      } catch (e) { return { id: ${JSON.stringify(id)}, crash: String(e).slice(0, 70) }; }
    })()`);
    // 캐스트가 도는 시간을 준다
    await delay(4500);
    const after = await evaluate(`({
      hp: boss.hp, dealt: boss.maxHp - boss.hp, shots: battle?.shots ?? null,
      mark: Boolean(ball.mark), glide: ball.glide || 0, trueAim: Boolean(ball.trueAim),
      awake: gates.filter(g => g.awake).length, boon: typeof figureBoon === "object" && figureBoon ? Object.keys(figureBoon).join("+") : null,
    })`);
    const tag = r.crash ? "CRASH " + r.crash : "";
    console.log(
      String(r.id).padEnd(12),
      (r.figure || "-").padEnd(11),
      "피해",
      String(after.dealt).padStart(4),
      "| 유성",
      after.shots,
      "| 표식",
      after.mark ? "O" : ".",
      "| 비행",
      after.glide ? "O" : ".",
      "| 항로",
      after.trueAim ? "O" : ".",
      "| 각성",
      after.awake,
      tag,
    );
  }
  console.log("errors:", JSON.stringify(probe.errors.slice(0, 5)));
} finally {
  probe.close();
}
process.exit(0);

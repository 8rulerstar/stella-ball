/**
 * 별지기 노드 + 최소 3픽 검증 프로브 (2026-08-20).
 *
 * 규칙 검증:
 *   - 별빛 0개에서도 aimStarReady()가 참인가(별지기 3이 바닥 보장)
 *   - 0~2픽 발사가 막히는가(shots 불변), 3픽이 나가는가
 *   - 방향 = 고른 노드 무게중심, 위력 = 벌림/250 인가
 *   - 별지기 노드는 별자리로 타지 않는가 — resolveFigure에 실제로 넘어간
 *     점 개수까지 세서, 별지기 래퍼가 섞이는 회귀도 잡는다
 *
 * 메뉴 측정(방향 자유도): 같은 판에서
 *   옛 규칙  별빛만, 1개 이상 아무 개수
 *   새 규칙  별지기+별빛, 3개 이상
 * 조합 수 / 10도 방향 칸 커버 / 보스 방향에서 최소 벗어남을 나란히 잰다.
 *
 *   node scripts/probe-aim-nodes.mjs
 */
import { setTimeout as delay } from "node:timers/promises";
import { launchProbe } from "./lib/probe-harness.mjs";

/* 페이지 안에 측정 도우미를 심는다. 조합 열거는 판의 노드가 13개 이하라
   부분집합 전수(8192)로 충분하다. */
const HELPERS = `
window.__aimMenu = function (minPick, includeUnits) {
  const nodes = [];
  if (includeUnits)
    for (const g of gates) nodes.push({ x: g.x, y: g.y });
  for (const s of aimStars) nodes.push({ x: s.x, y: s.y });
  const n = nodes.length,
    bins = new Set(),
    bossA = Math.atan2(boss.y - ball.y, boss.x - ball.x);
  let combos = 0,
    offBoss = Infinity,
    forces = [];
  for (let mask = 1; mask < 1 << n; mask++) {
    const picks = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) picks.push(nodes[i]);
    if (picks.length < minPick) continue;
    const cx = picks.reduce((a, p) => a + p.x, 0) / picks.length,
      cy = picks.reduce((a, p) => a + p.y, 0) / picks.length,
      dx = cx - ball.x,
      dy = cy - ball.y;
    if (Math.hypot(dx, dy) < 1) continue;
    combos++;
    const a = Math.atan2(dy, dx);
    bins.add(Math.floor(((a + Math.PI) / (Math.PI * 2)) * 36) % 36);
    const off = Math.abs(Math.atan2(Math.sin(a - bossA), Math.cos(a - bossA)));
    if (off < offBoss) offBoss = off;
    const radius =
      picks.reduce((a2, p) => a2 + Math.hypot(p.x - cx, p.y - cy), 0) /
      picks.length;
    forces.push(clamp(radius / AIM_STAR.fullRadius, 0.28, 1));
  }
  forces.sort((a, b) => a - b);
  return {
    combos,
    dirBins36: bins.size,
    minOffBossDeg: combos
      ? Math.round(((offBoss * 180) / Math.PI) * 10) / 10
      : null,
    forceMin: forces.length ? Math.round(forces[0] * 100) : null,
    forceMax: forces.length
      ? Math.round(forces[forces.length - 1] * 100)
      : null,
  };
};
window.__enterBattle = function (stageId) {
  const idx = stages.findIndex((s) => s.id === stageId);
  if (idx < 0) throw new Error("no stage " + stageId);
  stageIndex = idx;
  deployed = ["gaon", "biyeon", "ria"];
  selected = ["gaon", "biyeon", "ria"];
  resetBuild();
  setupBattle();
  boss.hp = boss.maxHp = 999999;
  settings.sfx = 0;
  return true;
};
true`;

const probe = await launchProbe({ profilePrefix: "aim-node-probe-" });
try {
  await probe.waitFor(
    "typeof setupBattle === 'function' && typeof gates !== 'undefined'",
    20000,
    "runtime ready",
  );
  const { evaluate, waitFor } = probe;
  await evaluate(HELPERS);
  const out = { rules: {}, menus: [] };

  /* ── 1. 규칙 검증 (2-2에서) ───────────────────────────────────── */
  await evaluate("__enterBattle('2-2')");
  await delay(2500); // 입장 연출
  out.rules.freshBoard = await evaluate(`({
    stars: aimStars.length,
    nodes: aimNodes().length,
    ready: aimStarReady(),
    economy: nodeEconomyOn(),
  })`);
  out.rules.launchGuards = await evaluate(`(() => {
    const shots0 = battle.shots;
    const deny0 = launchAimStarShot();
    aimPick = [0, 1];
    const deny2 = launchAimStarShot();
    return {
      deny0,
      deny2,
      shotsUnchanged: battle.shots === shots0,
      moving: Boolean(ball.moving),
    };
  })()`);
  out.rules.fire3Units = await evaluate(`(() => {
    aimPick = [0, 1, 2];
    const nodes = aimNodes(),
      p = [nodes[0], nodes[1], nodes[2]],
      cx = (p[0].x + p[1].x + p[2].x) / 3,
      cy = (p[0].y + p[1].y + p[2].y) / 3,
      radius =
        (Math.hypot(p[0].x - cx, p[0].y - cy) +
          Math.hypot(p[1].x - cx, p[1].y - cy) +
          Math.hypot(p[2].x - cx, p[2].y - cy)) /
        3,
      wantForce = clamp(radius / AIM_STAR.fullRadius, 0.28, 1),
      wantA = Math.atan2(cy - ball.y, cx - ball.x),
      shots0 = battle.shots,
      fired = launchAimStarShot(),
      gotA = Math.atan2(ball.vy, ball.vx);
    return {
      fired,
      shotSpent: battle.shots === shots0 - 1,
      moving: Boolean(ball.moving),
      angleErrDeg:
        Math.round(
          Math.abs(
            Math.atan2(Math.sin(gotA - wantA), Math.cos(gotA - wantA)),
          ) *
            (180 / Math.PI) *
            100,
        ) / 100,
      forceErr:
        Math.round(Math.abs(ball.launchPower - wantForce) * 1000) / 1000,
    };
  })()`);
  await waitFor("!ball.moving", 45000, "first shot settles");

  /* ── 2. 별빛 섞인 판: 별자리 소각 규칙 ───────────────────────── */
  await evaluate("dropWeakpointStars(5); sync(); true");
  out.rules.mixedBoard = await evaluate(`({
    stars: aimStars.length,
    nodes: aimNodes().length,
  })`);
  out.rules.unitsDontBurn = await evaluate(`(() => {
    /* resolveFigure에 «실제로 넘어간 점 개수»를 세야 별지기 래퍼가 재료에
       섞이는 회귀를 잡는다 — 별빛 수만 보면 그 회귀에서도 통과해 버린다. */
    const realResolve = resolveFigure;
    let figurePoints = -1;
    resolveFigure = (pts) => {
      figurePoints = pts.length;
      return realResolve(pts);
    };
    aimPick = [0, 1, 2]; // 별지기 셋만 조준 -> 별빛 전부가 별자리 재료
    const stars0 = aimStars.length,
      gates0 = gates.length,
      fired = launchAimStarShot();
    resolveFigure = realResolve;
    return {
      fired,
      starsBefore: stars0,
      starsAfter: aimStars.length,
      figurePoints,
      figureGotOnlyStars: figurePoints === stars0,
      gatesIntact: gates.length === gates0,
    };
  })()`);
  await waitFor("ball.moving", 20000, "deferred figure fire");
  await waitFor("!ball.moving", 45000, "second shot settles");

  /* ── 3. 메뉴 자유도: 옛 규칙 대 새 규칙 ─────────────────────── */
  for (const stage of ["1-1", "1-3", "2-2", "2-3"]) {
    await evaluate(`__enterBattle(${JSON.stringify(stage)})`);
    await delay(2200);
    // 실전 중반 상태를 흉내 낸다: 약점 별빛 4개 (2타 몫)
    await evaluate("dropWeakpointStars(4); sync(); true");
    const row = await evaluate(`({
      stage: ${JSON.stringify(stage)},
      stars: aimStars.length,
      old_starsOnly_min1: __aimMenu(1, false),
      new_unitsToo_min3: __aimMenu(3, true),
    })`);
    out.menus.push(row);
  }

  console.log(JSON.stringify(out, null, 2));
} finally {
  probe.close();
}
process.exit(0);

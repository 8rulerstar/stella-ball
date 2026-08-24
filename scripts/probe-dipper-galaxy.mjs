/**
 * 북두칠성 은하수의 실측 — 2026-08-24 디자인 세션 반입분.
 *
 * DIPPER_GALAXY_REQUEST_2026_08_24.md §7이 반입 조건으로 「정산 프레임 p95」를
 * 걸었다. 반입분이 별 개수를 340 → 1690~2244로, 그리고 프레임당 방사
 * 그러데이션을 1개 → 12개(바닥 물듦 1 + 성운 허즈 11)로 늘렸으므로 그 계약이
 * 실제로 걸리는 자리다. 이 프로브가 그 수치를 만든다.
 *
 * 비용을 둘로 나눠 잰다 — 섞으면 안 되는 서로 다른 질문이다.
 *
 *   1) 그리기 한 번의 «자기 시간». drawDipperGalaxy / drawDipperPour 를
 *      묶음으로 돌려 나눈다. performance.now()의 해상도가 0.1ms라 한 번
 *      호출은 잴 수 없다(probe-aim-polygon이 같은 함정을 이미 밟았다).
 *      이 값은 헤드리스에서도 정확하다 — 메인스레드가 실제로 도는 시간이다.
 *
 *   2) rAF 간격. 캐스트가 «도는 동안» 플레이어가 겪는 프레임 간격.
 *      헤드리스에는 vsync가 없어 의미가 없다 — --headed 로 창을 띄워야
 *      실기의 값이 나온다. 보고에 mode를 함께 찍는 이유다.
 *
 * 변형 셋(two·bold·dense)은 캐스트마다 Math.random으로 뽑히므로, 여기서는
 * 캐스트가 시작된 뒤 cine.dipper.variant 를 덮어써서 셋을 «같은 판»에서 잰다.
 *
 *   node --experimental-websocket scripts/probe-dipper-galaxy.mjs
 *   node --experimental-websocket scripts/probe-dipper-galaxy.mjs --headed
 */
import { launchProbe } from "./lib/probe-harness.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const STAGE = arg("stage", "2-2");
const PARTY = Number(arg("party", 3));
const HEADED = process.argv.includes("--headed");

const SETUP = (stage, party) => `(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  stageIndex = stages.findIndex((s) => s.id === ${JSON.stringify(stage)});
  const pool = ["gaon","biyeon","ria","lumi"]
    .slice(0, Math.min(${party}, stages[stageIndex].slots.length));
  deployed = [...pool]; selected = [...pool];
  resetBuild(); setupBattle();
  settings.sfx = 0;
  // 판이 끝나면 실행 컨텍스트가 승리 화면으로 넘어가 측정이 끊긴다.
  boss.maxHp = boss.hp = 999999; syncBossHealth();
  await wait(400);
  return { stage: stages[stageIndex].id, gates: gates.length, W, H };
})()`;

const HELPERS = `
  window.__dg = window.__dg || {};
  __dg.wait = (ms) => new Promise((r) => setTimeout(r, ms));
  __dg.gapStat = (a) => {
    if (!a.length) return null;
    const s = [...a].sort((x, y) => x - y);
    const at = (p) => +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(1);
    return { frames: s.length,
      fps: +(1000 / (s.reduce((x, y) => x + y, 0) / s.length)).toFixed(1),
      p50: at(0.5), p95: at(0.95), p99: at(0.99),
      worst: +s[s.length - 1].toFixed(1),
      over20ms: s.filter((v) => v > 20).length };
  };
  /* 묶음 측정. 워밍업 한 묶음은 버린다(서체·경로·그러데이션 캐시). */
  __dg.bench = (fn, rounds, batch) => {
    for (let i = 0; i < batch; i++) fn();
    const per = [];
    for (let r = 0; r < rounds; r++) {
      const t0 = performance.now();
      for (let i = 0; i < batch; i++) fn();
      per.push((performance.now() - t0) / batch);
    }
    per.sort((a, b) => a - b);
    const at = (p) => +per[Math.min(per.length - 1, Math.floor(per.length * p))].toFixed(4);
    return { calls: rounds * batch, p50: at(0.5), p95: at(0.95),
      worst: +per[per.length - 1].toFixed(4) };
  };
  __dg.sampleGaps = async (ms) => {
    const gaps = [];
    let last = performance.now(), stop = false;
    const tick = (now) => { gaps.push(now - last); last = now;
      if (!stop) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    await __dg.wait(ms);
    stop = true;
    return __dg.gapStat(gaps.slice(1));
  };
  /* 북두칠성 뼈대 그대로 일곱 점. 링(ringOf)으로도 7점 티어는 뜨지만,
     실제로 도는 것은 뼈대에 맞춰진 캐스트라 좌표가 다르면 국자 자리도
     다르다 — 재는 그림이 실제 그림과 같아야 한다. */
  __dg.dipperPoints = () => StellaRuntime.modules.require("figure")
    .templatePoints("bigdipper")
    .map((p) => ({ x: Math.max(30, Math.min(W - 30, boss.x + p.x * 175)),
                   y: Math.max(30, Math.min(H - 30, boss.y + p.y * 175)),
                   col: "#ffd27f", label: "실측" }));
  true;
`;

const CAST = (variant, sampleMs) => `(async () => {
  figureFx = null; cine = null;
  resolveFigure(__dg.dipperPoints());
  // 캐스트가 실제로 시작될 때까지. resolveFigure는 현현을 먼저 기다린다.
  const t0 = performance.now();
  while (!(cine && cine.id === "bigdipper") && performance.now() - t0 < 8000)
    await __dg.wait(30);
  if (!(cine && cine.id === "bigdipper"))
    return { variant: ${JSON.stringify(variant)}, error: "캐스트가 시작되지 않음" };
  cine.dipper.variant = ${JSON.stringify(variant)};
  const gaps = await __dg.sampleGaps(${sampleMs});
  const alive = Boolean(cine && cine.id === "bigdipper");
  return { variant: ${JSON.stringify(variant)}, gaps,
    // 표본 구간이 캐스트보다 길면 뒤쪽이 «판만 그리는» 프레임으로 희석된다.
    stillCasting: alive, t: cine ? +cine.t.toFixed(2) : null };
})()`;

/* 그리기 한 번의 자기 시간. 다 퍼진 순간(spread 1)이 가장 비싸다. */
const DRAW_BENCH = (variant) => `(() => {
  const st = { variant: ${JSON.stringify(variant)}, drain: -1, tip: 0.75, pour: 1.7 };
  const lip = { x: W * 0.5, y: H * 0.18 };
  const galaxy = __dg.bench(() => drawDipperGalaxy(W * 0.5, H * 0.44, 1, 1, st), 40, 12);
  // 붓는 중 = 은하수 + 튀김 + 줄기. 프레임에 실제로 얹히는 값이다.
  const pour = __dg.bench(() => drawDipperPour(lip, 1.22, 1.7, 1, st), 40, 12);
  const f = galaxyFieldFor(${JSON.stringify(variant)});
  return { variant: ${JSON.stringify(variant)}, galaxy, pour,
    stars: f.stars.length, beacons: f.beacons.length };
})()`;

const probe = await launchProbe({ headless: !HEADED });
try {
  const setup = await probe.evaluate(SETUP(STAGE, PARTY));
  await probe.evaluate(HELPERS);
  console.log(
    "mode:",
    HEADED ? "headed (vsync 있음 — rAF 값이 실기)" : "headless (rAF 값 무의미)",
    "| 판:",
    setup.stage,
    `${setup.W}x${setup.H}`,
    "| 별지기",
    setup.gates,
  );

  console.log("\n── 그리기 한 번의 자기 시간 (ms/call, spread=1) ──");
  console.log(
    "변형".padEnd(7),
    "별".padStart(5),
    "밝은별".padStart(6),
    "은하수 p50".padStart(11),
    "p95".padStart(8),
    "붓는중 p50".padStart(11),
    "p95".padStart(8),
  );
  const draw = {};
  for (const v of ["two", "bold", "dense"]) {
    const r = await probe.evaluate(DRAW_BENCH(v));
    draw[v] = r;
    console.log(
      v.padEnd(7),
      String(r.stars).padStart(5),
      String(r.beacons).padStart(6),
      String(r.galaxy.p50).padStart(11),
      String(r.galaxy.p95).padStart(8),
      String(r.pour.p50).padStart(11),
      String(r.pour.p95).padStart(8),
    );
  }

  console.log("\n── rAF 간격 (ms) ──");
  const idle = await probe.evaluate(`__dg.sampleGaps(1800)`);
  const row = (name, g, extra = "") =>
    console.log(
      name.padEnd(10),
      "프레임",
      String(g.frames).padStart(4),
      "| fps",
      String(g.fps).padStart(6),
      "| p50",
      String(g.p50).padStart(5),
      "| p95",
      String(g.p95).padStart(5),
      "| p99",
      String(g.p99).padStart(5),
      "| 최악",
      String(g.worst).padStart(6),
      "| >20ms",
      String(g.over20ms).padStart(3),
      extra,
    );
  row("기준선", idle, "(캐스트 없음)");
  for (const v of ["two", "bold", "dense"]) {
    const r = await probe.evaluate(CAST(v, 4200));
    if (r.error) {
      console.log(v.padEnd(10), "ERROR", r.error);
      continue;
    }
    row(v, r.gaps, r.stillCasting ? `(t=${r.t}, 아직 도는 중)` : "(캐스트 끝)");
    // 다음 캐스트 전에 앞 캐스트를 완전히 흘려 보낸다.
    await probe.evaluate(`(async () => { const t = performance.now();
      while (cine && performance.now() - t < 6000) await __dg.wait(60);
      return true; })()`);
  }
  console.log("\nerrors:", JSON.stringify(probe.errors.slice(0, 5)));
} finally {
  probe.close();
}

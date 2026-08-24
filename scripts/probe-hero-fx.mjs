/**
 * 별지기 전용 이펙트 시트 24장의 실측 — 2026-08-24 도트 반입.
 *
 * AWAKEN_FX_REQUEST_2026_08_24.md §6 이 반입 조건으로 「정산 프레임 p95,
 * 반입 전후 비교」를 걸었다. 시트가 프레임에 얹는 것은 drawImage 세 종류
 * (각성 인장 · 시전 · 정산 명중)이고 셋 다 shadowBlur 를 켠다 — 이 저장소에서
 * 흐림은 단일 최대 래스터 항목이었던 전력이 있으므로 그 계약이 실제로 걸리는
 * 자리다.
 *
 * «전후»를 한 실행 안에서 만든다. 시트를 되돌리는 대신 textures 에서 그
 * 항목만 지우면 준비 검사(naturalWidth === naturalHeight * 4)가 떨어져
 * 그리기가 건너뛰어진다 — 같은 판, 같은 배치, 같은 프레임에서 비교된다.
 * 순서는 OFF 를 먼저 잰다(다시 로드하는 쪽이 비동기라 뒤에 두면 경합한다).
 *
 * 배선도 함께 본다. 24장이 다 로드되는지, 버스트가 heroId 를 싣는지,
 * 그리고 윤슬(ria) — abilityFx 표에 없어서 회전 칼날이 버스트를 «한 번도»
 * 만들지 않았던 별지기 — 가 이제 자기 시트를 얻는지.
 *
 *   node --experimental-websocket scripts/probe-hero-fx.mjs
 *   node --experimental-websocket scripts/probe-hero-fx.mjs --headed
 */
import { launchProbe } from "./lib/probe-harness.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const STAGE = arg("stage", "2-2");
const HEADED = process.argv.includes("--headed");

const SETUP = `(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  stageIndex = stages.findIndex((s) => s.id === ${JSON.stringify(STAGE)});
  deployed = ["gaon", "biyeon", "ria"]; selected = [...deployed];
  resetBuild(); setupBattle();
  settings.sfx = 0;
  boss.maxHp = boss.hp = 999999; syncBossHealth();
  await wait(600);
  window.__hfx = {
    wait,
    gapStat: (a) => {
      if (!a.length) return null;
      const s = [...a].sort((x, y) => x - y);
      const at = (p) => +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(1);
      return { frames: s.length,
        fps: +(1000 / (s.reduce((x, y) => x + y, 0) / s.length)).toFixed(1),
        p50: at(0.5), p95: at(0.95), p99: at(0.99),
        worst: +s[s.length - 1].toFixed(1),
        over20ms: s.filter((v) => v > 20).length };
    },
  };
  __hfx.sampleGaps = async (ms) => {
    const gaps = [];
    let last = performance.now(), stop = false;
    const tick = (now) => { gaps.push(now - last); last = now;
      if (!stop) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    await wait(ms);
    stop = true;
    return __hfx.gapStat(gaps.slice(1));
  };
  /* 화면이 가장 붐비는 순간을 «계속» 만든다. 각성 인장 0.48초 · 시전 0.44초 ·
     정산 명중 0.36초는 전부 짧아서, 한 번 터뜨리고 재면 표본의 대부분이
     아무 일도 없는 프레임이다. 창 전체를 그 구간으로 채운다. */
  __hfx.storm = async (ms) => {
    let stop = false;
    const pump = () => {
      if (stop) return;
      gates.forEach((g) => { g.awake = false; wakeUnit(g); });
      abilityBursts.length = 0;
      gates.forEach((g) => emitAbilityFx(g, g.x, g.y, 128, 0.44, 0));
      finisherImpacts.length = 0;
      for (const g of gates)
        finisherImpacts.push({ sourceId: g.id, col: g.col, finisher: true, t: 0, d: 0.58 });
      if (finisherImpacts.length > 2) finisherImpacts.splice(0, finisherImpacts.length - 2);
      setTimeout(pump, 360);
    };
    pump();
    const r = await __hfx.sampleGaps(ms);
    stop = true;
    return r;
  };
  __hfx.sheetsOff = () => {
    let n = 0;
    for (const path of Object.values(heroFxSheets))
      if (textures[path]) { delete textures[path]; n++; }
    return n;
  };
  __hfx.sheetsOn = async () => {
    for (const path of Object.values(heroFxSheets)) loadTexture(path);
    // 로드는 비동기다. 24장이 전부 준비될 때까지 기다린다.
    for (let i = 0; i < 120; i++) {
      const ready = Object.values(heroFxSheets)
        .filter((p) => textures[p]?.complete && textures[p].naturalWidth > 0).length;
      if (ready === 24) return ready;
      await wait(50);
    }
    return Object.values(heroFxSheets)
      .filter((p) => textures[p]?.complete && textures[p].naturalWidth > 0).length;
  };
  return { stage: stages[stageIndex].id, gates: gates.map((g) => g.id) };
})()`;

const WIRING = `(() => {
  const bad = [], missing = [];
  for (const [key, path] of Object.entries(heroFxSheets)) {
    const t = textures[path];
    if (!t?.complete) { missing.push(key); continue; }
    if (!(t.naturalWidth > 0) || t.naturalWidth !== t.naturalHeight * 4)
      bad.push(key + ":" + t.naturalWidth + "x" + t.naturalHeight);
  }
  /* 버스트가 heroId 를 싣는가. 그리고 ria — abilityFx 표에 없는 유일한
     별지기 — 도 버스트를 얻는가. 예전에는 못 얻었다. */
  abilityBursts.length = 0;
  gates.forEach((g) => emitAbilityFx(g, g.x, g.y, 120, 0.44, 0));
  const bursts = abilityBursts.map((b) => ({ heroId: b.heroId, kind: b.kind }));
  return { sheets: Object.keys(heroFxSheets).length,
    notLoaded: missing, wrongSpec: bad, bursts,
    riaHasBurst: bursts.some((b) => b.heroId === "ria"),
    riaInAbilityFx: Boolean(abilityFx.ria) };
})()`;

const probe = await launchProbe({ headless: !HEADED });
try {
  const setup = await probe.evaluate(SETUP);
  console.log(
    "mode:",
    HEADED ? "headed (vsync 있음 — rAF 값이 실기)" : "headless (rAF 값 무의미)",
    "| 판:",
    setup.stage,
    "| 별지기:",
    setup.gates.join(" "),
  );

  const wiring = await probe.evaluate(WIRING);
  console.log("\n── 배선 ──");
  console.log(
    "시트",
    wiring.sheets,
    "장 | 미로드",
    wiring.notLoaded.length,
    "| 규격 불일치",
    wiring.wrongSpec.length,
  );
  if (wiring.notLoaded.length)
    console.log("  미로드:", wiring.notLoaded.join(" "));
  if (wiring.wrongSpec.length)
    console.log("  불일치:", wiring.wrongSpec.join(" "));
  console.log("버스트:", JSON.stringify(wiring.bursts));
  console.log(
    "윤슬 —",
    "abilityFx 표에 있나:",
    wiring.riaInAbilityFx ? "예" : "아니오",
    "| 버스트를 얻나:",
    wiring.riaHasBurst ? "예" : "아니오",
  );

  console.log("\n── rAF 간격, 시트 OFF vs ON (같은 판·같은 배치) ──");
  const off = await probe.evaluate(`(async () => {
    const removed = __hfx.sheetsOff();
    const gaps = await __hfx.storm(3600);
    return { removed, gaps };
  })()`);
  const on = await probe.evaluate(`(async () => {
    const ready = await __hfx.sheetsOn();
    const gaps = await __hfx.storm(3600);
    return { ready, gaps };
  })()`);
  const row = (name, g, extra) =>
    console.log(
      name.padEnd(12),
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
  row("OFF", off.gaps, `(텍스처 ${off.removed}장 제거)`);
  row("ON", on.gaps, `(${on.ready}/24 준비)`);
  const d = +(on.gaps.p95 - off.gaps.p95).toFixed(1);
  console.log(`\np95 차이: ${d >= 0 ? "+" : ""}${d}ms`);
  console.log("errors:", JSON.stringify(probe.errors.slice(0, 4)));
} finally {
  probe.close();
}

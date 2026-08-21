/**
 * 조준 화면의 실측 — 그리기 비용과 1e 배선.
 *
 * 2026-08-21 반입분(시안 1e)이 조준 화면에 «반투명 면적»을 새로 넣었다 —
 * 고른 노드들을 잇는 벌림 폴리곤(α 0.10~0.20)이다. 핸드오프가 그 자리에
 * 성능 계약을 걸었다: 「반투명 면적 신규이므로 perfwatch 실측 첨부」.
 * 이 프로브가 그 수치를 만들고, 같은 화면의 배선도 함께 확인한다.
 *
 * 비용은 둘로 나눠 잰다. 서로 다른 질문이라 한 표에 섞으면 안 된다.
 *
 *   1) drawAimStars의 JS 시간 — 「폴리곤이 프레임 예산을 얼마나 먹나」.
 *      0픽(폴리곤 없음) / 3픽 / 전부픽(가장 큰 폴리곤)을 같은 판에서 재고,
 *      폴리곤 채우기만 따로 한 번 더 잰다. 이 값은 헤드리스에서도 정확하다 —
 *      메인스레드가 실제로 그 코드를 도는 시간이기 때문이다.
 *
 *   2) rAF 간격 — 「플레이어가 겪는 프레임 간격」. 이쪽은 헤드리스에서
 *      의미가 없다(vsync가 없어 프레임을 최대한 빨리 만든다). --headed로
 *      창을 띄워야 실기의 값이 나온다. 보고에 mode를 함께 찍는 이유다.
 *
 * 배선 확인(features)은 자동 검사가 닿지 않는 자리만 본다. 루나 조준 멘트는
 * 수업 중에는 일부러 침묵하므로 온보딩 E2E가 볼 수 없고, 30px 대격 숫자는
 * 6·7점 별자리가 떠야만 나오므로 캠페인 한 판을 굴려야 확인된다.
 *
 * 조준 화면은 유성이 «멈춘 뒤»에만 열리므로, 한 발을 실제로 쏴서 별빛을
 * 만들고 정지한 판 위에서 잰다. 정산 구간은 별자리가 실제로 터지는 샷에서
 * 잡는다 — 화면이 가장 붐비는 순간이 그 자리다.
 *
 *   node --experimental-websocket scripts/probe-aim-polygon.mjs
 *   node --experimental-websocket scripts/probe-aim-polygon.mjs --headed
 *   node --experimental-websocket scripts/probe-aim-polygon.mjs --stage 2-2 --party 3
 */
import { launchProbe } from "./lib/probe-harness.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const STAGE = arg("stage", "2-2");
const PARTY = Number(arg("party", 3));
const HEADED = process.argv.includes("--headed");

const RUN = (stage, party) => `(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  stageIndex = stages.findIndex((s) => s.id === ${JSON.stringify(stage)});
  const pool = ["gaon","biyeon","ria","lumi"]
    .slice(0, Math.min(${party}, stages[stageIndex].slots.length));
  deployed = [...pool]; selected = [...pool];
  resetBuild(); setupBattle();
  settings.sfx = 0;
  // 판이 끝나면 실행 컨텍스트가 승리 화면으로 넘어가 측정이 끊긴다.
  boss.maxHp = boss.hp = 999999; syncBossHealth();

  /* 그리기 한 번의 «자기 시간». 프레임 전체가 아니라 이 함수만 돈다 —
     캔버스는 다음 프레임이 덮어쓰므로 화면에 남지 않는다. */
  const bench = (fn, rounds, batch) => {
    /* 한 번 호출을 재면 안 된다. performance.now()의 해상도가 0.1ms인데
       재려는 값이 그보다 작아, 첫 시도에서 0픽(폴리곤 없음)과 5픽(폴리곤
       있음)이 둘 다 0.1ms로 나왔다 — 「같다」가 아니라 「자가 굵다」였다.
       묶음으로 재서 나눈다. 워밍업 한 묶음은 버린다(서체·경로 캐시). */
    for (let i = 0; i < batch; i++) fn();
    const per = [];
    for (let r = 0; r < rounds; r++) {
      const t0 = performance.now();
      for (let i = 0; i < batch; i++) fn();
      per.push((performance.now() - t0) / batch);
    }
    per.sort((a, b) => a - b);
    const at = (p) => +per[Math.min(per.length - 1, Math.floor(per.length * p))].toFixed(4);
    return { calls: rounds * batch, msPerCall: { p50: at(0.5), p95: at(0.95),
      worst: +per[per.length - 1].toFixed(4) } };
  };
  const gapStat = (a) => {
    if (!a.length) return null;
    const s = [...a].sort((x, y) => x - y);
    const at = (p) => +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(1);
    return { frames: s.length,
      fps: +(1000 / (s.reduce((x, y) => x + y, 0) / s.length)).toFixed(1),
      p50: at(0.5), p95: at(0.95), p99: at(0.99),
      worst: +s[s.length - 1].toFixed(1),
      over20ms: s.filter((v) => v > 20).length };
  };
  const sampleGaps = async (ms) => {
    const gaps = [];
    let last = performance.now(), stop = false;
    const tick = (now) => { gaps.push(now - last); last = now;
      if (!stop) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    await wait(ms);
    stop = true;
    return gapStat(gaps.slice(1));
  };

  /* 한 발 쏜다. 조준 화면은 유성이 멈춘 뒤에만 열리고, 별빛은 굴러가며
     생기므로 «쏘지 않으면 잴 판이 없다». */
  const fire = () => {
    const dx = (boss.x - ball.x), dy = (boss.y - ball.y);
    const d = Math.hypot(dx, dy) || 1;
    fireMeteor(dx / d, dy / d, 0.9, null);
  };
  const settle = async (limit) => {
    const t0 = performance.now();
    while ((ball.moving || performance.now() - t0 < 400) &&
           performance.now() - t0 < limit) await wait(30);
    while (performance.now() - t0 < limit &&
           (assistShots.length || finisherFocus)) await wait(40);
  };
  fire();
  await settle(16000);
  await wait(400);

  const nodes = aimNodes();
  if (!aimStarReady()) return { error: "aim screen never opened",
    nodes: nodes.length };

  /* 세 상태를 «같은 판»에서 잰다. 판이 다르면 노드 수도 좌표도 달라져
     비교가 성립하지 않는다. */
  const states = {};
  const measure = async (name, picks) => {
    aimPick = picks.slice();
    aimHover = -1;
    /* 순서가 중요하다. bench는 2400번을 «동기로» 도는 블로킹 루프라, 먼저
       돌리면 그 뒤 첫 rAF 간격이 수백 ms로 찍혀 게임의 긴 프레임처럼
       보인다. 프레임 간격을 먼저 모으고 그 다음에 잰다. */
    const gaps = await sampleGaps(2200);
    states[name] = {
      picks: aimPick.length,
      gaps,
      drawMs: bench(() => drawAimStars(), 60, 40),
    };
  };
  const far = nodes
    .map((n, i) => ({ i, d: Math.hypot(n.x - ball.x, n.y - ball.y) }))
    .sort((a, b) => b.d - a.d)
    .map((e) => e.i);
  await measure("pick0", []);
  await measure("pick3", far.slice(0, 3));
  await measure("pickAll", far);

  /* 폴리곤 채우기만. drawAimStars 안의 그 블록과 같은 인자로, 가장 큰
     상태(전부픽)에서 낸다 — 이 값이 「새로 생긴 반투명 면적」의 값이다. */
  aimPick = far.slice();
  const p = aimPick.map((i) => nodes[i]);
  const polygonOnly = bench(() => {
    x.save();
    x.globalAlpha = 0.2;
    x.fillStyle = "#ffe09a";
    x.beginPath();
    p.forEach((n, i) => (i ? x.lineTo(n.x, n.y) : x.moveTo(n.x, n.y)));
    x.closePath();
    x.fill();
    x.restore();
  }, 60, 200);

  /* 폴리곤이 덮는 면적. 「비싸다/싸다」를 픽셀 수와 함께 읽어야 창이
     커졌을 때를 추론할 수 있다. */
  let area = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    area += a.x * b.y - b.x * a.y;
  }
  area = Math.abs(area) / 2;

  /* ── 1e 배선 확인 ─────────────────────────────────────────────────
     루나 조준 멘트는 수업 중 침묵이라 온보딩 E2E가 볼 수 없고, 30px
     대격 숫자는 6·7점이 떠야만 나온다. 둘 다 여기서만 확인된다. */
  const lunaText = () =>
    document.querySelector("#lunaSpeech .luna-speech-text")?.textContent ?? "";
  const lunaShown = () =>
    Boolean(document.querySelector("#lunaSpeech.show"));
  /* 이미 나온 줄인지 먼저 적어 둔다. 0픽 멘트는 «조준 화면이 열리는 순간»에
     붙어 있어 위쪽 첫 샷의 정산에서 이미 나갔을 수 있고, 그러면 여기서 다시
     불러도 (1회성이라) 조용하다 — 그때 독에 남은 옛 문장을 「지금 떴다」로
     읽으면 안 된다. 첫 시도에서 실제로 그렇게 잘못 읽었다. */
  const hintsBefore = (progress.aimHints || []).slice();
  const lunaCheck = async (id, emit) => {
    const already = hintsBefore.includes(id);
    emit();
    await wait(60);
    return { id, spokenEarlier: already, text: lunaText(),
      // 방금 떴는가. 이미 나온 줄이면 false가 정상이다.
      shownNow: !already && lunaShown(),
      recorded: (progress.aimHints || []).includes(id) };
  };
  aimPick = [];
  const luna0 = await lunaCheck("luna-pick0", () => emitAimChanged("open"));
  aimPick = far.slice(0, 2);
  const luna2 = await lunaCheck("luna-pick2", () => emitAimChanged("pick"));

  /* 30px 대격 숫자. 오리온(6점)·북두칠성(7점)의 정산이 실제로 huge를 다는지
     본다. 좌표는 상관없다 — 팝업 객체의 플래그가 결론이다. */
  popups.length = 0;
  const ringOf = (n) => Array.from({ length: n }, (_, i) => ({
    x: boss.x + Math.cos((i / n) * Math.PI * 2) * 90,
    y: boss.y + Math.sin((i / n) * Math.PI * 2) * 90 }));
  const tierPopups = {};
  for (const n of [3, 6, 7]) {
    popups.length = 0;
    figureFx = null;
    resolveFigure(ringOf(n));
    // resolveFigure는 현현을 기다린다. 캐스트를 즉시 흘려 숫자를 받는다.
    flushPendingFigure();
    tierPopups[n + "점"] = popups.map((q) => ({
      text: q.text, big: Boolean(q.big), huge: Boolean(q.huge) }));
  }
  figureFx = null;
  boss.hp = boss.maxHp;
  syncBossHealth();

  /* 정산 구간 — 검수 기준의 「정산 프레임 p95」. 화면이 가장 붐비는 순간을
     재야 하므로 «별자리가 실제로 터지는» 샷으로 잰다: 별지기 셋만 찍고
     쏘면 안 찍은 별빛이 전부 별자리 재료가 된다(노드 경제 규칙 그대로).
     재료가 셋 모일 때까지 평범한 샷을 먼저 굴린다. */
  aimPick = [];
  for (let i = 0; i < 6 && aimStars.length < 4; i++) {
    fire();
    await settle(16000);
    await wait(300);
  }
  const unitIdx = aimNodes()
    .map((n, i) => ({ i, unit: Boolean(n.unit) }))
    .filter((e) => e.unit)
    .map((e) => e.i);
  const leftover = aimStars.length;
  const settleGaps = [];
  let phase = "pre", last = performance.now(), stop = false;
  const tick = (now) => { if (phase === "settle") settleGaps.push(now - last);
    last = now; if (!stop) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  phase = "settle";
  const s0 = performance.now();
  aimPick = unitIdx.slice(0, 3);
  const launched = unitIdx.length >= 3 && Boolean(launchAimStarShot());
  if (!launched) { aimPick = []; fire(); }
  while (performance.now() - s0 < 20000 &&
         (ball.moving || assistShots.length || finisherFocus || figureFx))
    await wait(20);
  await wait(500);
  stop = true;

  return {
    viewport: innerWidth + "x" + innerHeight,
    board: W + "x" + H,
    dpr: devicePixelRatio,
    nodes: nodes.length,
    polygonAreaPx: Math.round(area),
    boardAreaPx: W * H,
    states,
    polygonOnly,
    features: {
      luna0pick: luna0,
      luna2pick: luna2,
      aimHints: (progress.aimHints || []).slice(),
      tierPopups,
    },
    settle: gapStat(settleGaps),
    settleSeconds: +((performance.now() - s0) / 1000).toFixed(2),
    // 별자리가 실제로 떴는가. false면 위 p95는 «가장 붐비는 정산»이 아니다.
    settleUsedFigure: launched,
    settleLeftoverStarlight: leftover,
  };
})()`;

let report;
const probe = await launchProbe({
  headless: !HEADED,
  profilePrefix: "aim-polygon-probe-",
});
try {
  await probe.waitFor(
    "document.readyState === 'complete' && typeof setupBattle === 'function'",
  );
  const alive = await probe.evaluate(
    "new Promise((r) => requestAnimationFrame(() => r(!document.hidden)))",
  );
  if (!alive) throw new Error("rAF not running - window is hidden");
  report = await probe.evaluate(RUN(STAGE, PARTY));
} finally {
  probe.close();
}

console.log(
  JSON.stringify(
    {
      /* 헤드리스에는 vsync가 없다. drawMs는 그대로 유효하지만 rAF 간격은
         구조 비교용일 뿐 실기의 프레임 간격이 아니다 — 섞어 읽지 말 것. */
      mode: HEADED ? "headed (vsync)" : "headless (no vsync)",
      gapsAreRealPacing: HEADED,
      ...report,
      // 하니스가 CDP 이벤트에서 실제로 모은 값이다 — 예전의 지역 배열은
      // 아무도 채우지 않아 항상 []를 «측정 결과»처럼 찍고 있었다.
      consoleErrors: probe.errors,
    },
    null,
    2,
  ),
);

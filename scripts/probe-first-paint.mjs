/**
 * 첫 화면까지 내려받는 바이트 — 심사자가 링크를 열 때 겪는 값.
 *
 * 저장소의 `assets/` 는 34MB 지만 그것은 배포 크기가 아니다. 브라우저는
 * 요청한 것만 받으므로 실제로 중요한 것은 «타이틀이 서기까지 완료된 바이트»
 * 하나다. 2026-08-24 첫 실측에서 그 값이 4.52MB 였고, 그중 1.67MB 가
 * `assets/library/fx` 넷(1254×1254 PNG 세 장)이었다 — 전투 이펙트가 타이틀
 * 보다 먼저 오고 있었다. 원인은 `game-data.js` 가 모듈 로드 시점에
 * `primeCombatTextures()` 를 부르는 것이었다.
 *
 * 이 프로브가 그 회귀를 잡는다. 새 에셋을 부팅 경로에 얹으면 여기 숫자가
 * 오른다 — 총량이 아니라 «타이틀 앞»의 숫자를 본다.
 *
 * 두 시점을 잰다.
 *   title  타이틀 마크업이 실제로 선 순간까지 «완료된» 리소스
 *   settle 그 뒤 4초 — 미룬 예열까지 끝난 총량
 *
 *   node --experimental-websocket scripts/probe-first-paint.mjs
 *   node --experimental-websocket scripts/probe-first-paint.mjs --detail
 */
import { launchProbe } from "./lib/probe-harness.mjs";

const DETAIL = process.argv.includes("--detail");

const COUNT = `(() => {
  const by = {};
  let n = 0, b = 0;
  const items = [];
  for (const e of performance.getEntriesByType("resource")) {
    const bytes = e.encodedBodySize || e.transferSize || 0;
    const u = new URL(e.name, location.href).pathname
      .replace(/^.*\\/prototypes\\//, "").replace(/^\\/+/, "");
    n++; b += bytes;
    items.push({ u, b: bytes });
    let g = "기타";
    if (/\\.(png|jpg|jpeg|gif|webp)$/i.test(u)) g = "이미지";
    else if (/\\.(wav|mp3|ogg)$/i.test(u)) g = "오디오";
    else if (/\\.js$/i.test(u)) g = "JS";
    else if (/\\.css$/i.test(u)) g = "CSS";
    else if (/\\.(ttf|otf|woff2?)$/i.test(u)) g = "폰트";
    by[g] = by[g] || { n: 0, b: 0 };
    by[g].n++; by[g].b += bytes;
  }
  items.sort((p, q) => q.b - p.b);
  return { n, b, by, top: items.slice(0, 12) };
})()`;

const probe = await launchProbe({
  headless: true,
  windowSize: "1280,900",
  waitReady: false,
});
const mb = (x) => (x / 1e6).toFixed(2) + "MB";
try {
  await probe.ready();
  /* 타이틀이 «섰다»의 기준은 마크업이다. 헤드리스에서는 document.hidden 이
     참이라 rAF 가 돌지 않으므로 페인트를 기다릴 수 없다 — 이 저장소가 이미
     한 번 밟은 함정이고, 그래서 프록시가 아니라 DOM 을 본다. */
  await probe.waitFor(
    `document.querySelector(".title-sequence, .ig-title, #titleScreen")`,
    20000,
    "타이틀 마크업",
  );
  const t = await probe.evaluate(COUNT);
  await probe.evaluate(`new Promise((r) => setTimeout(r, 4000))`);
  const s = await probe.evaluate(COUNT);

  const row = (label, r) => {
    console.log(`\n[${label}] 요청 ${r.n}건 · ${mb(r.b)}`);
    for (const [g, v] of Object.entries(r.by).sort((a, c) => c[1].b - a[1].b))
      console.log(
        `   ${g.padEnd(6)} ${String(v.n).padStart(4)}건 ${mb(v.b).padStart(9)}`,
      );
  };
  row("타이틀까지", t);
  row("+4초 (예열 끝)", s);
  console.log(
    `\n타이틀 앞에서 비켜난 양: ${mb(s.b - t.b)} · 요청 ${s.n - t.n}건`,
  );
  if (DETAIL) {
    console.log("\n타이틀까지의 개별 상위 12:");
    for (const e of t.top)
      console.log(`  ${(e.b / 1024).toFixed(0).padStart(6)}KB  ${e.u}`);
  }
} finally {
  probe.close();
}

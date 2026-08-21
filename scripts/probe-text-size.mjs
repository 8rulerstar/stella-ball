/**
 * 판에 그려지는 글자가 «화면에서 실제로 몇 px 인가»를 센다.
 *
 * 캔버스 백버퍼는 720x900 고정이고 판은 창에 맞춰 줄어든다 — 1280x900 창에서
 * 565x706(0.78배), 1024x680 창에서 389x486(0.54배)이다. 그래서 코드에 12px 로
 * 적힌 글자가 작은 창에서는 6.5px 로 그려진다. 이 프로브는 그 «실제 px»을
 * 잰다. 판정은 하지 않는다 — 몇 px 부터 안 읽히는지는 사람이 정한다.
 *
 * 이 프로브가 틀리는 법:
 * 1. 글꼴 문자열의 px 만 읽으면 틀린다. 이 코드베이스는 그리는 도중
 *    `ctx.scale()` 을 여럿 쓴다(별지기 등장, 피격 찌그러짐, 별자리 컷신…).
 *    그리는 «순간»의 변환 행렬을 함께 곱해야 한다.
 * 2. 변환의 세로 배율은 `m.d` 가 아니라 `hypot(m.b, m.d)` 다. 회전이 걸린
 *    글자에서 m.d 만 보면 0에 가까워진다.
 * 3. 한 프레임만 재면 상시 HUD 만 잡힌다. 정산·능력·별자리 글자는 그때만
 *    나오므로 실제로 한 발 굴리고 맞혀야 목록에 들어온다.
 * 4. 백버퍼 대비 CSS 크기는 창마다 다르다. 창 하나만 재고 결론 내지 말 것.
 *
 *   node scripts/probe-text-size.mjs
 *   node scripts/probe-text-size.mjs --sizes 1280,900 1024,680
 */
import { setTimeout as delay } from "node:timers/promises";
import { launchProbe } from "./lib/probe-harness.mjs";

const SIZES = process.argv.includes("--sizes")
  ? process.argv
      .slice(process.argv.indexOf("--sizes") + 1)
      .filter((a) => /^\d+,\d+$/.test(a))
  : ["1280,900", "1280,760", "1024,680"];

/* 그리는 순간을 가로챈다 — 함정 1·2. */
const HOOK = `(() => {
  const P = CanvasRenderingContext2D.prototype;
  if (P.__textProbe) return 1;
  P.__textProbe = 1;
  const seen = new Map();
  window.__textSeen = seen;
  const wrap = (name) => {
    const real = P[name];
    P[name] = function (t, x, y, mw) {
      try {
        if (this.canvas && this.canvas.id === "game") {
          const m = this.getTransform();
          const sy = Math.hypot(m.b, m.d) || 1;
          const hit = /(\\d*\\.?\\d+)px/.exec(this.font);
          const px = hit ? parseFloat(hit[1]) : 0;
          if (px) {
            /* 글꼴 «문자열»로 묶는다. ctx.scale 이 프레임마다 흔들려 실측
               px 로 묶으면 같은 글자가 수십 줄로 쪼개진다 — 대신 그 흔들림을
               최소·최대로 남긴다. */
            const eff = px * sy;
            const row = seen.get(this.font) || {
              font: this.font, code: px, n: 0, lo: eff, hi: eff, sample: "",
            };
            row.n += 1;
            if (eff < row.lo) row.lo = eff;
            if (eff > row.hi) row.hi = eff;
            if (!row.sample && String(t).trim()) row.sample = String(t).slice(0, 18);
            seen.set(this.font, row);
          }
        }
      } catch (e) {}
      return real.call(this, t, x, y, mw);
    };
  };
  wrap("fillText");
  wrap("strokeText");
  return 1;
})()`;

/* DOM 글자는 CSS px 이 곧 화면 px 이라 규칙(한글 10px 미만 금지)이 소스에서
   그대로 지켜진다. 캔버스만 다른지 확인하려면 둘을 같은 자리에서 재야 한다. */
const DOM = `(() => {
  const out = new Map();
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < 0.05) continue;
    let own = "";
    for (const n of el.childNodes)
      if (n.nodeType === 3 && n.textContent.trim()) own += n.textContent.trim();
    if (!own || !/[가-힣]/.test(own)) continue;
    const px = parseFloat(cs.fontSize);
    const row = out.get(px) || { px, n: 0, sample: "" };
    row.n += 1;
    if (!row.sample) row.sample = own.slice(0, 18);
    out.set(px, row);
  }
  return JSON.stringify([...out.values()].sort((a, b) => a.px - b.px).slice(0, 6));
})()`;

const READ = `(() => {
  const c = document.getElementById("game");
  const r = c.getBoundingClientRect();
  const k = r.height / c.height;
  const r1 = (n) => Math.round(n * 10) / 10;
  const rows = [...(window.__textSeen || new Map()).values()]
    .map((v) => ({ ...v, lo: r1(v.lo * k), hi: r1(v.hi * k) }))
    .sort((a, b) => a.lo - b.lo);
  return JSON.stringify({
    boardCss: Math.round(r.width) + "x" + Math.round(r.height),
    scale: Math.round(k * 100) / 100,
    rows,
  });
})()`;

for (const size of SIZES) {
  const probe = await launchProbe({ windowSize: size });
  const { evaluate, waitFor, close, errors } = probe;
  try {
    await waitFor("typeof setupBattle === 'function'", 30000);
    await evaluate("window.StellaIntroObserver?.stop(), 1");
    await evaluate(HOOK);
    await evaluate(
      "deployed=selected=['gaon','biyeon','ria'], stageIndex=4, resetBuild(), setupBattle(), 1",
    );
    await waitFor("!battleCine", 12000).catch(() => {});
    /* 함정 3 — 한 발 굴려야 정산·능력·콤보 글자가 나온다. */
    for (let i = 0; i < 3; i += 1) {
      await evaluate(`(() => {
        const t = gates[0] || { x: 360, y: 300 };
        const dx = t.x - ball.x, dy = t.y - ball.y, l = Math.hypot(dx, dy) || 1;
        ball.vx = dx / l * 1400; ball.vy = dy / l * 1400; ball.moving = true;
        return 1;
      })()`).catch(() => {});
      await delay(2600);
    }
    const d = JSON.parse(await evaluate(READ));
    console.log(`\n████ 창 ${size} — 판 ${d.boardCss} (백버퍼의 ${d.scale}배)`);
    console.log("   화면 px      코드   횟수   보기");
    for (const r of d.rows)
      console.log(
        `   ${(r.lo === r.hi ? String(r.lo) : r.lo + "~" + r.hi).padStart(10)}  ${String(r.code + "px").padStart(6)}  ${String(r.n).padStart(5)}   «${r.sample}»`,
      );
    /* 판정은 하지 않는다. 9px 은 «세어 보기 위한» 선일 뿐이다. */
    const tiny = d.rows.filter((r) => r.hi < 9);
    console.log(
      `   → 가장 클 때도 9px 미만인 종류 ${tiny.length}/${d.rows.length}` +
        (tiny.length
          ? ": " + tiny.map((t) => t.hi + "px «" + t.sample + "»").join(", ")
          : ""),
    );
    const dom = JSON.parse(await evaluate(DOM));
    console.log(
      "   DOM 한글 최소 " +
        dom
          .map((r) => r.px + "px «" + r.sample + "»")
          .slice(0, 3)
          .join(", "),
    );
    if (errors.length) console.log("   콘솔 오류: " + errors.join(" | "));
  } finally {
    close();
  }
}

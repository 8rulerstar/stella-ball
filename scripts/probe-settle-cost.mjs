/**
 * Settlement frame-cost probe.
 *
 * 각성을 다시 움직임에 묶은 뒤(2026-08-16) 한 샷이 깨우는 별지기가 0~1명에서
 * 3명으로 늘었다. 정산 피니셔는 한 명씩 초점을 잡고 1.62초 간격으로 줄을 서므로
 * 한 샷의 정산이 5초 가까이 이어진다. 「렉」 제보가 그 구간의 프레임 비용인지,
 * 아니면 샷 자체가 무거워진 것인지 나누어 잰다.
 *
 * 판을 세 구간으로 나눠 rAF 간격을 따로 모은다:
 *   idle    발사 전, 판만 그리는 상태 — 기준선
 *   flight  유성이 굴러가는 동안
 *   settle  유성이 멈춘 뒤 정산이 끝날 때까지
 *
 * 그리고 정산 구간만 CPU 프로파일을 떠서 함수 이름까지 남긴다. 「무겁다」는
 * 증상이고 파일:줄이 주소다.
 *
 *   node scripts/probe-settle-cost.mjs
 *   node scripts/probe-settle-cost.mjs --party 3 --stage 2-2
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const STAGE = arg("stage", "2-2");
const PARTY = Number(arg("party", 3));
const browser = [
  process.env.STELLA_BROWSER_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find((p) => p && existsSync(p));
if (!browser) throw new Error("set STELLA_BROWSER_PATH");

const port = await new Promise((res) => {
  const s = createServer();
  s.listen(0, "127.0.0.1", () => {
    const { port } = s.address();
    s.close(() => res(port));
  });
});
const server = spawn(process.execPath, ["scripts/serve.mjs"], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: "ignore",
});
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(`http://127.0.0.1:${port}/`)).ok) break;
  } catch {}
  await delay(120);
}
const profileDir = mkdtempSync(join(tmpdir(), "settle-probe-"));
const debugPort = port + 1;
/* 창을 실제로 띄운다. 헤드리스에는 vsync가 없어 프레임 «시간»이 실기와 다르고,
   숨은 창은 rAF 자체가 돌지 않아 아무것도 재지 못한다. Windows의 창 가림 감지는
   꺼야 백그라운드로 내려가도 계속 그린다. */
const chrome = spawn(
  browser,
  [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDir}`,
    "--window-position=0,0",
    "--window-size=1280,900",
    "--disable-features=CalculateNativeWinOcclusion",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-background-timer-throttling",
    "--no-first-run",
    "--disable-background-networking",
    `http://127.0.0.1:${port}/prototypes/prism-breakers.html`,
  ],
  { stdio: "ignore" },
);

let cdp,
  id = 0;
const pending = new Map();
async function connect() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (
        await fetch(`http://127.0.0.1:${debugPort}/json/list`)
      ).json();
      const target = list.find(
        (t) => t.type === "page" && t.url.includes("prism-breakers"),
      );
      if (target) {
        cdp = new WebSocket(target.webSocketDebuggerUrl);
        cdp.addEventListener("message", (e) => {
          const m = JSON.parse(String(e.data));
          const p = pending.get(m.id);
          if (!p) return;
          pending.delete(m.id);
          m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
        });
        await new Promise((r) =>
          cdp.addEventListener("open", r, { once: true }),
        );
        return;
      }
    } catch {}
    await delay(150);
  }
  throw new Error("no page target");
}
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const n = ++id;
    pending.set(n, { resolve: res, reject: rej });
    cdp.send(JSON.stringify({ id: n, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails)
    throw new Error(r.exceptionDetails.exception?.description ?? "eval failed");
  return r.result?.value;
};

/* "정산이 스크립트의 40%다"는 증상이고, 함수 이름과 줄 번호가 주소다. */
async function cpuProfile(ms, top = 16) {
  await send("Profiler.enable");
  await send("Profiler.setSamplingInterval", { interval: 150 });
  await send("Profiler.start");
  await delay(ms);
  const { profile } = await send("Profiler.stop");
  const self = new Map();
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  for (const n of profile.nodes) self.set(n.id, 0);
  for (const s of profile.samples || []) self.set(s, (self.get(s) || 0) + 1);
  const total = (profile.samples || []).length || 1;
  return [...self]
    .filter(([, hits]) => hits)
    .map(([nid, hits]) => {
      const f = byId.get(nid).callFrame;
      const file = (f.url || "").split("/").pop();
      return {
        fn: f.functionName || "(anonymous)",
        at: file ? `${file}:${f.lineNumber + 1}` : "(native)",
        pct: +((hits * 100) / total).toFixed(1),
      };
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, top);
}

// 판을 세우고 한 발 쏘는 동안 rAF 간격을 구간별로 모은다. 브라우저 안에서
// 한 번에 돌려야 구간 경계가 실제 게임 상태와 어긋나지 않는다.
const RUN_SHOT = (stage, party) => `(async () => {
  const pool = ["gaon","biyeon","ria","byeolha"].slice(0, ${party});
  stageIndex = stages.findIndex((s) => s.id === ${JSON.stringify(stage)});
  deployed = [...pool]; selected = [...pool];
  resetBuild(); settings.sfx = 0; setupBattle();
  /* 파티 전원이 각성하면 2-2의 200은 한 샷에 넘어가고, 승리 화면이 뜨면서
     실행 컨텍스트가 통째로 사라진다 — 측정이 아니라 크래시가 된다. 판을
     끝나지 않게 두고 프레임만 본다. */
  boss.maxHp = boss.hp = 999999; syncBossHealth();
  /* 정산이 끝나면 startShot이 g.awake·travel을 즉시 지운다. 끝난 뒤에 읽으면
     언제나 「아무도 안 깨어났다」로 나온다 — 정산 시점에 훅으로 받는다. */
  const settled = [];
  registerRuntimeHook("afterPartySettle", (ctx) =>
    settled.push(ctx.awakened.map((g) => g.s)));
  let queuedFinishers = 0;
  registerRuntimeHook("afterUnitAssistQueued", ({ shot }) => {
    if (shot && shot.finisher) queuedFinishers += 1;
  });
  const gaps = { idle: [], flight: [], settle: [] };
  let phase = "idle", last = performance.now(), stop = false;
  const tick = (now) => {
    gaps[phase].push(now - last); last = now;
    if (!stop) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  /* rAF 간격은 「무언가가 느리다」까지만 말한다. draw()를 직접 재면 그 무언가가
     그리기인지 아닌지가 갈리고, 초점이 떠 있는 프레임만 따로 모으면 피니셔
     오버레이 한 장의 값이 나온다. */
  /* 이 저장소에서 프레임을 실제로 떨어뜨린 것은 늘 캔버스가 아니라 DOM이었다
     (12Hz 토스트 펌프 → body의 MutationObserver 둘 → 강제 리플로우). 각성이
     흔해지면서 한 샷의 toast·sync·popup이 몇 배가 됐는지 세어 둔다. */
  const dom = { idle: {}, flight: {}, settle: {} };
  for (const k of Object.keys(dom)) dom[k] = { toast: 0, sync: 0, popup: 0 };
  for (const name of ["toast", "sync", "addPopup"]) {
    const real = globalThis[name];
    if (typeof real !== "function") continue;
    const key = name === "addPopup" ? "popup" : name;
    globalThis[name] = function () {
      dom[phase][key] += 1;
      return real.apply(this, arguments);
    };
  }
  const drawMs = { idle: [], flight: [], settle: [], focus: [] };
  const realDraw = draw;
  draw = function () {
    const t0 = performance.now();
    realDraw.apply(this, arguments);
    const cost = performance.now() - t0;
    drawMs[phase].push(cost);
    if (typeof finisherFocus !== "undefined" && finisherFocus)
      drawMs.focus.push(cost);
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await wait(1500);                       // idle 기준선

  phase = "flight";
  const t = gates[0];
  const dx = t.x - ball.x, dy = t.y - ball.y, l = Math.hypot(dx, dy) || 1;
  ball.vx = dx / l * 1500; ball.vy = dy / l * 1500;
  ball.moving = true; ball.steerUsed = false; ball.firstImpact = null;
  ball.starkeeperTouched = false; ball.openingBossContact = false;
  battle.shots -= 1; chain = [];
  /* 최악이 아니라 평균을 재면 「렉이 없다」가 나온다. 한 샷이 파티 전원을
     굴리는 판이 이 변경의 최대 부하이므로, 별지기 전부에 실제 충돌과 같은
     크기의 운동량을 준다 — 정산 피니셔가 인원수만큼 줄을 선다. */
  for (const g of gates) {
    const a = Math.atan2(boss.y - g.y, boss.x - g.x) + (g === t ? 0 : 0.7);
    g.vx = Math.cos(a) * 900; g.vy = Math.sin(a) * 900;
  }
  const flightStart = performance.now();
  while (ball.moving && performance.now() - flightStart < 12000) await wait(30);

  phase = "settle";
  const settleStart = performance.now();
  /* 플레이어가 실제로 기다리는 것은 프레임이 아니라 «판이 다시 내 것이 될
     때까지»다. 피니셔 큐가 비고 초점이 풀릴 때까지를 잰다. */
  while (performance.now() - settleStart < 16000) {
    if (!assistShots.length && !finisherFocus) break;
    await wait(40);
  }
  const busyMs = performance.now() - settleStart;
  await wait(600);
  stop = true;
  const stat = (a) => {
    if (!a.length) return null;
    const s = [...a].sort((x, y) => x - y);
    const at = (p) => +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(1);
    return {
      frames: s.length,
      fps: +(1000 / (s.reduce((x, y) => x + y, 0) / s.length)).toFixed(1),
      p50: at(0.5), p95: at(0.95), worst: +s[s.length - 1].toFixed(1),
      over33ms: s.filter((v) => v > 33).length,
      seconds: +(s.reduce((x, y) => x + y, 0) / 1000).toFixed(2),
    };
  };
  return {
    stage: ${JSON.stringify(stage)}, party: ${party},
    awakened: settled,
    queuedFinishers,
    // 유성이 멈춘 뒤 판이 다시 플레이어 것이 될 때까지 — 체감 「렉」의 후보 1번.
    boardBusySeconds: +(busyMs / 1000).toFixed(2),
    idle: stat(gaps.idle), flight: stat(gaps.flight), settle: stat(gaps.settle),
    drawMs: {
      idle: stat(drawMs.idle), flight: stat(drawMs.flight),
      settle: stat(drawMs.settle), duringFocus: stat(drawMs.focus),
    },
    domWrites: dom,
  };
})()`;

try {
  await connect();
  await send("Runtime.enable");
  for (let i = 0; i < 60; i++) {
    if (await evaluate("document.readyState === 'complete'")) break;
    await delay(100);
  }
  const alive = await evaluate(
    "new Promise((r) => requestAnimationFrame(() => r(!document.hidden)))",
  );
  if (!alive) throw new Error("rAF not running - window is hidden");
  await evaluate("document.querySelector('#titleHelp')?.click(), 1");
  await delay(600);

  const shot = await evaluate(RUN_SHOT(STAGE, PARTY));

  /* 정산 구간만 다시 한 발 쏘면서 CPU 프로파일을 뜬다. 위 측정과 같은 판이라
     비교가 성립한다. */
  await evaluate(`(() => {
    const t = gates[0];
    const dx = t.x - ball.x, dy = t.y - ball.y, l = Math.hypot(dx, dy) || 1;
    ball.vx = dx / l * 1500; ball.vy = dy / l * 1500; ball.moving = true;
    ball.steerUsed = false; battle.shots -= 1; chain = [];
    return 1;
  })()`);
  await delay(2200); // 유성이 멈추고 정산이 시작될 때까지
  const cpu = await cpuProfile(4000);

  console.log(JSON.stringify({ ...shot, cpuDuringSettle: cpu }, null, 2));
} finally {
  cdp?.close?.();
  chrome.kill();
  server.kill();
  try {
    rmSync(profileDir, { recursive: true, force: true });
  } catch {}
}

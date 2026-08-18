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
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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
const shotDir = arg("out", join(tmpdir(), "settle-shots"));
// 각성을 한 프레임에 몰 것인가, 유성이 차례로 때리듯 흩을 것인가.
const STAGGER = !process.argv.includes("--same-frame");
// 효과음을 끄고도 재 본다 — 첫 재생의 .wav 로드가 프레임을 떨어뜨리는지 가른다.
const MUTE = process.argv.includes("--mute");
/* 스크린샷은 전체 페이지 래스터를 강제한다 — 프레임을 재는 중에 찍으면 그
   프레임이 100ms를 넘고, 그걸 게임의 렉으로 착각하게 된다. 타이밍을 재는
   실행에서는 끈다. */
const NO_SHOTS = process.argv.includes("--no-shots");
/* 흐림만 꺼서 재 본다. draw()의 JS 시간은 그대로인데 rAF 간격이 줄면 그 값은
   메인스레드가 아니라 래스터에서 나온 것이다 — 이 저장소에서 shadowBlur는
   전에도 단일 최대 항목이었다. */
const NO_BLUR = process.argv.includes("--no-blur");
/* 창 크기. 별 캔버스가 창 너비를 그대로 쓰고(stella-ball-dawn.js) 여백 하늘도
   innerWidth로 배치되므로, 프로브의 1280x900만 재면 큰 창의 비용을 못 본다. */
const WIN = arg("window", "1280,900");
mkdirSync(shotDir, { recursive: true });
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
    "--window-size=" + WIN,
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

/* draw()가 싼데 프레임이 길면 남은 곳은 메인스레드의 DOM 작업이다. 이 저장소는
   전에도 그랬다 — 12Hz 토스트 펌프가 body의 MutationObserver 둘을 깨워 초당
   13회 강제 리플로우를 냈다. 스타일 재계산·레이아웃 횟수와 동시에 도는 CSS
   애니메이션 수를 함께 본다. */
async function domBudget(ms) {
  await send("Performance.enable");
  const read = async () => {
    const { metrics } = await send("Performance.getMetrics");
    return Object.fromEntries(metrics.map((m) => [m.name, m.value]));
  };
  const a = await read();
  await delay(ms);
  const b = await read();
  const per = (k) => Math.round(((b[k] - a[k]) * 1000) / ms);
  const pct = (k) => +(((b[k] - a[k]) * 100) / (ms / 1000)).toFixed(1);
  return {
    layoutsPerSec: per("LayoutCount"),
    styleRecalcsPerSec: per("RecalcStyleCount"),
    scriptPct: pct("ScriptDuration"),
    stylePct: pct("RecalcStyleDuration"),
    layoutPct: pct("LayoutDuration"),
    taskPct: pct("TaskDuration"),
  };
}

const RUN_SHOT = (stage, party, stagger, mute, noBlur) => `(async () => {
  const pool = ["gaon","biyeon","ria","byeolha"].slice(0, ${party});
  stageIndex = stages.findIndex((s) => s.id === ${JSON.stringify(stage)});
  deployed = [...pool]; selected = [...pool];
  resetBuild(); setupBattle();
  /* 소리를 켠 채로 잰다. 예전에는 꺼 두었는데, 그러면 playSampleSfx가
     첫 줄에서 false를 돌려주어 「어느 사건이 어느 큐를 부르는가」가
     통째로 0으로 나온다 — 조용한 것과 «끈 것»을 구분하지 못한다. */
  settings.sfx = ${mute ? 0 : 1};
  /* 파티 전원이 각성하면 2-2의 200은 한 샷에 넘어가고, 승리 화면이 뜨면서
     실행 컨텍스트가 통째로 사라진다 — 측정이 아니라 크래시가 된다. 판을
     끝나지 않게 두고 프레임만 본다. */
  boss.maxHp = boss.hp = 999999; syncBossHealth();
  /* 정산이 끝나면 startShot이 g.awake·travel을 즉시 지운다. 끝난 뒤에 읽으면
     언제나 「아무도 안 깨어났다」로 나온다 — 정산 시점에 훅으로 받는다. */
  /* 실험이 실제로 켜진 채 재고 있는지 보고한다. 꺼진 채 재면 「렉이 없다」가
     나오는데 그것은 다른 게임을 잰 것이다. */
  const experiments = {
    autoParry: typeof autoParryOn === "function" ? autoParryOn() : null,
    nodeEconomy: typeof nodeEconomyOn === "function" ? nodeEconomyOn() : null,
    aimAssist: typeof AIM_ASSIST_PULL !== "undefined" ? AIM_ASSIST_PULL : null,
    onboardingActive:
      typeof onboardingRunning === "function" ? onboardingRunning() : null,
  };
  const settled = [];
  registerRuntimeHook("afterPartySettle", (ctx) =>
    settled.push(ctx.awakened.map((g) => g.s)));
  let queuedFinishers = 0;
  registerRuntimeHook("afterUnitAssistQueued", ({ shot }) => {
    if (shot && shot.finisher) queuedFinishers += 1;
  });
  /* 어느 사건이 어느 효과음 큐를 부르는지 센다. 큐 이름이 하나만 어긋나도
     playSampleSfx가 조용히 false를 돌려주고 재생 실패는 catch가 먹는다. */
  const sfx = {};
  const realSample = playSampleSfx;
  playSampleSfx = function (kind) {
    const ok = realSample.apply(this, arguments);
    if (ok) sfx[kind] = (sfx[kind] || 0) + 1;
    return ok;
  };
  if (${noBlur ? "true" : "false"}) {
    const g = x, d = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(g), "shadowBlur");
    if (d && d.set) Object.defineProperty(g, "shadowBlur", {
      configurable: true, get: () => 0, set: () => {},
    });
  }
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
  /* 각성이 화면을 미는가(AWAKEN_FX_REQUEST §4-1: 그동안 0px이었다). 깨어나는
     프레임에만 값이 서므로 최고치를 구간별로 잡는다. */
  const react = { flight: {}, settle: {} };
  for (const k of Object.keys(react))
    react[k] = { shake: 0, push: 0, tilt: 0, ghost: 0, flash: 0, stop: 0 };
  /* 그동안 못 보고 있던 것. impactStop > 0 인 프레임은 update()가 아예 불리지
     않아 «판이 얼어 있다». rAF는 계속 4ms로 돌고 draw()도 0.5ms 그대로라,
     프레임 지표만 보면 완벽히 정상으로 나온다 — 그런데 플레이어에게는 그게
     정확히 「렉」이다. 얼어 있던 시간과 횟수를 따로 센다. */
  const frozen = { idle: 0, flight: 0, settle: 0 };
  const freezeRuns = [];
  let freezeRun = 0,
    freezePeak = 0,
    freezeCombo = 0;
  const drawMs = { idle: [], flight: [], settle: [], focus: [] };
  const realUpdate = update;
  let lastDrawAt = performance.now();
  const realDraw = draw;
  draw = function () {
    const t0 = performance.now();
    const gap = t0 - lastDrawAt;
    lastDrawAt = t0;
    if ((impactStop || 0) > 0) {
      frozen[phase] += gap;
      freezeRun += gap;
      /* 정지의 «주인»을 찾는다. impactStop에 배정되는 값이 곧 출처다 —
         0.018 각성 / 0.028 접촉 / 0.034~0.078 보통 타격 / 0.075~0.17 강타 /
         0.046~0.106 정산 명중 / 0.18 거상 퇴장. 최고치를 잡으면 그 구간을
         누가 세웠는지가 나온다. */
      freezePeak = Math.max(freezePeak, impactStop || 0);
      freezeCombo = Math.max(freezeCombo, hitCombo || 0);
    } else if (freezeRun > 0) {
      freezeRuns.push({
        ms: +freezeRun.toFixed(1),
        setTo: +freezePeak.toFixed(3),
        combo: freezeCombo,
      });
      freezeRun = 0;
      freezePeak = 0;
      freezeCombo = 0;
    }
    realDraw.apply(this, arguments);
    const cost = performance.now() - t0;
    drawMs[phase].push(cost);
    const r = react[phase];
    if (r) {
      r.shake = Math.max(r.shake, screenShake || 0);
      r.push = Math.max(r.push, Math.hypot(screenPushX || 0, screenPushY || 0));
      r.tilt = Math.max(r.tilt, Math.abs(screenTilt || 0));
      r.ghost = Math.max(r.ghost, screenGhost || 0);
      r.flash = Math.max(r.flash, screenFlash || 0);
      r.stop = Math.max(r.stop, impactStop || 0);
    }
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
  /* 별지기를 «서로 다른 프레임에» 깨운다. 전부 한 프레임에 밀면 히트스톱이
     impactStop = Math.max(...) 하나로 합쳐져, 실제 플레이보다 정지가 적게
     나온다 — 유성은 셋을 차례로 때리므로 정지도 셋으로 흩어진다. 이 지연이
     그 차례를 흉내 낸다. 지연 값은 프로브의 것이지 게임의 것이 아니다. */
  const STAGGER = ${JSON.stringify(String(stagger))} === "true";
  const kick = (g, extra) => {
    const a = Math.atan2(boss.y - g.y, boss.x - g.x) + extra;
    g.vx = Math.cos(a) * 900; g.vy = Math.sin(a) * 900;
  };
  kick(t, 0);
  (async () => {
    for (let i = 1; i < gates.length; i++) {
      if (STAGGER) await wait(430);
      kick(gates[i], 0.7);
    }
  })();
  const flightStart = performance.now();
  // 실제 손이 쏜 발이라 유성이 언제 멈출지 모른다. 멈출 때까지 기다린다.
  while (
    (ball.moving || performance.now() - flightStart < 400) &&
    performance.now() - flightStart < 16000
  )
    await wait(30);

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
    experiments,
    domWrites: dom,
    sfxByCue: sfx,
    // 「얼어 있던 시간」. 이것이 체감 렉의 후보 2번이다.
    frozenMs: {
      idle: Math.round(frozen.idle),
      flight: Math.round(frozen.flight),
      settle: Math.round(frozen.settle),
    },
    freezeRunsMs: freezeRuns.filter((v) => v.ms >= 8),
    screenReaction: {
      flight: Object.fromEntries(
        Object.entries(react.flight).map(([k, v]) => [k, +v.toFixed(4)]),
      ),
      settle: Object.fromEntries(
        Object.entries(react.settle).map(([k, v]) => [k, +v.toFixed(4)]),
      ),
    },
  };
})()`;

const consoleErrors = [];
try {
  await connect();
  /* 그리기 훅 안에서 던진 예외는 프레임을 죽이지만 evaluate 쪽에는 안 보인다.
     반입분처럼 남이 쓴 파일을 넣을 때는 이걸 켜 두지 않으면 「돌아간다」와
     「조용히 한 겹이 빠졌다」를 구분할 수 없다. */
  cdp.addEventListener("message", (e) => {
    const m = JSON.parse(String(e.data));
    if (m.method === "Log.entryAdded" && m.params?.entry?.level === "error")
      consoleErrors.push(m.params.entry.text);
    if (m.method === "Runtime.exceptionThrown")
      consoleErrors.push(
        m.params?.exceptionDetails?.exception?.description ??
          m.params?.exceptionDetails?.text ??
          "unknown exception",
      );
  });
  await send("Log.enable");
  await send("Runtime.enable");
  for (let i = 0; i < 60; i++) {
    if (await evaluate("document.readyState === 'complete'")) break;
    await delay(100);
  }
  const alive = await evaluate(
    "new Promise((r) => requestAnimationFrame(() => r(!document.hidden)))",
  );
  if (!alive) throw new Error("rAF not running - window is hidden");
  /* 수업으로 들어가면 안 된다. 2026-08-18 실험 셋(AUTO_PARRY·NODE_ECONOMY·
     조준 보정)이 전부 `onboardingRunning()`으로 수업 중에는 꺼지므로, 여기서
     #titleHelp를 누르면 캠페인에서 실제로 도는 코드를 한 줄도 재지 못한다.
     setupBattle이 setScene("game")까지 하므로 타이틀을 거칠 필요가 없다. */
  await delay(600);

  /* 수치만으로는 「연출이 붙었다」까지만 알 수 있다. 그림이 판을 가리지 않는지,
     여러 발이 겹칠 때 누가 쏘는지 읽히는지는 찍어 봐야 안다. */
  const shots = [];
  const capture = async (name) => {
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    const file = join(shotDir, name);
    writeFileSync(file, Buffer.from(data, "base64"));
    shots.push(file);
  };
  await send("Page.enable");
  const running = evaluate(RUN_SHOT(STAGE, PARTY, STAGGER, MUTE, NO_BLUR));
  await delay(1800); // idle 기준선이 다 모일 때까지

  /* 진짜 마우스로 쏜다. 발사만 코드로 넣으면 조준 보정도, 위력 곡선도,
     별지기를 하나씩 때리며 흩어지는 접촉도 전부 건너뛴다 — 그 흩어짐이
     바로 재려는 것이다. */
  const p = await evaluate(`(() => {
    const rect = document.querySelector("#game").getBoundingClientRect();
    // 세 별지기를 차례로 지나가도록 가장 가까운 하나를 겨눈다.
    let best = gates[0], bestD = Infinity;
    for (const g of gates) {
      const d = Math.hypot(g.x - ball.x, g.y - ball.y);
      if (d < bestD) { bestD = d; best = g; }
    }
    const dx = best.x - ball.x, dy = best.y - ball.y, l = Math.hypot(dx, dy) || 1;
    const cueX = ball.x - dx / l * 300, cueY = ball.y - dy / l * 300;
    const rawY = ball.y + (cueY > ball.y ? (cueY - ball.y) / 4.8 : cueY - ball.y);
    const css = (x, y) => ({ x: rect.left + x * rect.width / 720, y: rect.top + y * rect.height / 900 });
    return { from: css(ball.x, ball.y), to: css(cueX, rawY) };
  })()`);
  await send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    ...p.from,
    button: "none",
  });
  await send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    ...p.from,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });
  for (let i = 1; i <= 6; i++)
    await send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: p.from.x + (p.to.x - p.from.x) * (i / 6),
      y: p.from.y + (p.to.y - p.from.y) * (i / 6),
      button: "left",
      buttons: 1,
    });
  await send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    ...p.to,
    button: "left",
    buttons: 0,
    clickCount: 1,
  });
  await evaluate("window.__probeGo && window.__probeGo(), 1");
  /* 발사되지 않으면 그 뒤의 모든 수치가 「조용한 판」이라 렉이 없다고 거짓말을
     한다. 실제로 떴는지 여기서 확인하고, 아니면 왜 막혔는지를 남긴다. */
  let launched = false;
  for (let i = 0; i < 40 && !launched; i++) {
    launched = await evaluate("!!(ball && ball.moving)");
    if (!launched) await delay(50);
  }
  if (!launched)
    throw new Error(
      "meteor never launched | " +
        (await evaluate(`JSON.stringify({
          run: !!run, paused: !!paused, battleComplete: !!battleComplete,
          locked: typeof isCombatInputLocked === 'function' ? isCombatInputLocked() : 'n/a',
          onboarding: !!onboarding,
          rect: (() => { const r = document.querySelector('#game').getBoundingClientRect();
                         return Math.round(r.width) + 'x' + Math.round(r.height) + ' @' + Math.round(r.left) + ',' + Math.round(r.top) })(),
          drag: typeof drag !== 'undefined' ? !!drag : 'n/a',
        })`)),
    );

  for (const [ms, name] of NO_SHOTS
    ? []
    : [
        [900, "awaken.png"],
        [2200, "rolling.png"],
        [1800, "settle.png"],
        [700, "settle-late.png"],
      ]) {
    await delay(ms);
    await capture(name).catch(() => {});
  }
  const shot = await running;
  /* 유효성 관문. idle 구간은 아무 일도 없는 판이라 이 기계에서 p95가 5ms를
     넘을 이유가 없다 — 넘었다면 창이 뒤로 밀려 스로틀된 것이고, 그 실행의
     모든 수치는 게임이 아니라 포커스를 잰 것이다. 조용히 통과시키면 창 크기
     비교 같은 것이 통째로 거짓이 된다. */
  shot.valid = shot.idle && shot.idle.p95 <= 5;
  shot.screenshots = shots;

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

  /* 전투 «입장» 구간을 따로 잰다. 2026-08-18에 들어온 입장 컷신(.cin)은
     레터박스·베일·플래시·링 둘·먼지 20조각·네임플레이트·컷인 셋을 DOM으로
     얹고 6초를 산다. 이 저장소의 예산은 「캔버스는 여유, DOM은 없음」이라
     여기가 가장 유력하다. 판을 새로 세우고 그 4초를 그대로 본다. */
  await evaluate(`(() => {
    stageIndex = stages.findIndex((s) => s.id === ${JSON.stringify(STAGE)});
    introSeenStages.delete(stages[stageIndex].id);
    resetBuild(); setupBattle(); return 1;
  })()`).catch(() => {});
  /* 안전하지 않은 키프레임을 없앴는데도 레이아웃이 남으면, 남은 것은 JS가
     기하를 «읽어» 강제로 리플로우를 일으키는 경우다. 읽는 API를 감싸고 부른
     자리를 스택에서 뽑는다 — 「63회」는 증상이고 파일:줄이 주소다. */
  await evaluate(`(() => {
    window.__geo = {};
    const note = () => {
      const line = (new Error().stack || "").split("
")
        .find((l, i) => i > 2 && !l.includes("__geo") && l.includes(".js"));
      const key = (line || "(unknown)").trim().replace(/^at\s+/, "").slice(0, 96);
      window.__geo[key] = (window.__geo[key] || 0) + 1;
    };
    const rect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () { note(); return rect.apply(this, arguments); };
    for (const prop of ["offsetWidth","offsetHeight","offsetTop","offsetLeft",
                        "clientWidth","clientHeight","scrollWidth","scrollHeight"]) {
      const d = Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop)
             || Object.getOwnPropertyDescriptor(Element.prototype, prop);
      if (!d || !d.get) continue;
      const target = prop.startsWith("offset") ? HTMLElement.prototype : Element.prototype;
      Object.defineProperty(target, prop, {
        configurable: true,
        get() { note(); return d.get.call(this); },
      });
    }
    return 1;
  })()`).catch(() => {});
  const entryBudget = await domBudget(4000);
  const geo = await evaluate(
    "JSON.stringify(Object.fromEntries(Object.entries(window.__geo || {}).sort((a,b)=>b[1]-a[1]).slice(0,10)))",
  );
  /* 「39개가 돈다」는 증상이고, «무엇을 움직이는가»가 주소다. transform·opacity
     말고 다른 속성을 움직이는 키프레임은 컴포지터에 못 올라가 매 프레임 메인
     스레드를 스타일+레이아웃으로 끌고 간다. 키프레임 규칙을 읽어 이름별로
     그 속성을 붙인다. */
  const entryAnimations = await evaluate(`(() => {
    const props = {};
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules } catch { continue }
      for (const r of rules || []) {
        if (r.type !== CSSRule.KEYFRAMES_RULE) continue;
        const seen = new Set();
        for (const kf of r.cssRules)
          for (let i = 0; i < kf.style.length; i++) seen.add(kf.style[i]);
        props[r.name] = [...seen];
      }
    }
    const SAFE = new Set(["transform", "opacity"]);
    const out = {};
    for (const a of document.getAnimations()) {
      const name = a.animationName || "transition";
      const moved = props[name] || [];
      const key = name + " [" + moved.join(",") + "]";
      out[key] = out[key] || { count: 0, safe: moved.length > 0 && moved.every((p) => SAFE.has(p)) };
      out[key].count++;
    }
    return JSON.stringify({ total: document.getAnimations().length,
                            cinNodes: document.querySelectorAll(".cin *").length,
                            byName: out });
  })()`);
  const entryCpu = await cpuProfile(3000, 12);

  console.log(
    JSON.stringify(
      {
        ...shot,
        consoleErrors: consoleErrors.slice(0, 8),
        cpuDuringSettle: cpu,
        entryBudget,
        geometryReads: geo,
        entryAnimations,
        entryCpu,
      },
      null,
      2,
    ),
  );
} finally {
  cdp?.close?.();
  chrome.kill();
  server.kill();
  try {
    rmSync(profileDir, { recursive: true, force: true });
  } catch {}
}

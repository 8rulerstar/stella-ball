/**
 * Real frame-time profiler.
 *
 * The preview pane this project is usually inspected through reports
 * `document.hidden === true`, so requestAnimationFrame never fires there and
 * frame pacing cannot be measured at all - only proxies like "how many CSS
 * animations are running". Those proxies were what earlier performance passes
 * were tuned against, and they are not the thing the player feels.
 *
 * This drives a real Chromium over CDP the same way the onboarding E2E does,
 * lets the game run, and records the actual gap between animation frames. It
 * reports percentiles and long-frame counts per scene, and can attribute cost
 * by disabling one suspect at a time.
 *
 *   node scripts/profile-frames.mjs                 # title, hub, onboarding
 *   node scripts/profile-frames.mjs --ablate        # also re-measure with
 *                                                   # individual layers off
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/* A navigation invalidates every in-flight CDP call, and those rejections
   arrive asynchronously on the socket rather than at an await point we own.
   Swallow exactly that one so a reload cannot abort the profiling run. */
process.on("unhandledRejection", (reason) => {
  const text = String(reason?.message ?? reason);
  if (text.includes("Execution context was destroyed")) return;
  console.error(text);
  process.exitCode = 1;
});
const ABLATE = process.argv.includes("--ablate");
/* Headless Chromium has no vsync and composites in software: it reports 240fps
   for a page that stutters on a real machine, so it can rank compositing
   STRUCTURE but never frame pacing. --headed opens an actual window on this
   machine, where rAF is vsync-locked and the GPU does the compositing, which
   is the only way to see the thing a player feels. It shows a browser window
   for the duration of the run and closes it afterwards. */
const HEADED = process.argv.includes("--headed");
let browserProcess = null;
let serverProcess = null;
let profileDirectory = null;
let cdp = null;

async function freePort() {
  return new Promise((res, rej) => {
    const server = createServer();
    server.once("error", rej);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => res(address.port));
    });
  });
}

async function waitUntil(label, check, timeoutMs = 20000, intervalMs = 60) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await check();
    if (last) return last;
    await delay(intervalMs);
  }
  throw new Error(
    `${label} timed out (${timeoutMs}ms); last=${JSON.stringify(last)}`,
  );
}

function browserPath() {
  for (const key of ["STELLA_BROWSER_PATH", "CHROME_PATH"]) {
    const value = process.env[key];
    if (value && existsSync(value)) return value;
  }
  const candidates =
    process.platform === "win32"
      ? [
          "C:/Program Files/Google/Chrome/Application/chrome.exe",
          "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
          "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
          "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
        ]
      : process.platform === "darwin"
        ? [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
          ]
        : [
            "/usr/bin/google-chrome",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
          ];
  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error("No Chrome/Edge found; set STELLA_BROWSER_PATH");
  return found;
}

class CdpClient {
  constructor(url) {
    this.url = url;
    this.serial = 0;
    this.pending = new Map();
    this.listeners = new Map();
    this.socket = null;
  }
  on(method, listener) {
    const list = this.listeners.get(method) ?? [];
    list.push(listener);
    this.listeners.set(method, list);
  }
  async connect() {
    this.socket = new WebSocket(this.url);
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) {
        for (const listener of this.listeners.get(message.method) ?? [])
          listener(message.params ?? {});
        return;
      }
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result ?? {});
    });
    await new Promise((res, rej) => {
      this.socket.addEventListener("open", res, { once: true });
      this.socket.addEventListener("error", rej, { once: true });
    });
  }
  send(method, params = {}) {
    const id = ++this.serial;
    return new Promise((res, rej) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        rej(new Error(`CDP ${method} timed out`));
      }, 30000);
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timeout);
          res(v);
        },
        reject: (e) => {
          clearTimeout(timeout);
          rej(e);
        },
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  close() {
    this.socket?.close();
  }
}

async function evaluate(expression) {
  /* Any poll that straddles a navigation hits a destroyed context. That is
     expected during reloads, not a failure, so it reads as "no answer yet"
     and the caller's waitUntil keeps polling. */
  let response;
  try {
    response = await sendEvaluate(expression);
  } catch (error) {
    if (String(error?.message).includes("Execution context was destroyed"))
      return undefined;
    throw error;
  }
  if (response.exceptionDetails)
    throw new Error(
      response.exceptionDetails.exception?.description ??
        response.exceptionDetails.text ??
        "evaluation failed",
    );
  return response.result?.value;
}
async function sendEvaluate(expression) {
  const response = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (response.exceptionDetails)
    throw new Error(
      response.exceptionDetails.exception?.description ??
        response.exceptionDetails.text ??
        "evaluation failed",
    );
  return response;
}

/* Sampling runs inside the page: a plain rAF chain recording the delta between
   consecutive frames. Percentiles are computed here rather than shipping every
   sample back over CDP. */
async function sampleFrames(ms) {
  return evaluate(`new Promise((done) => {
    const gaps = [];
    let last = performance.now();
    const stopAt = last + ${ms};
    requestAnimationFrame(function tick(t) {
      gaps.push(t - last);
      last = t;
      if (t < stopAt) return requestAnimationFrame(tick);
      const sorted = gaps.slice(1).sort((a, b) => a - b);
      const at = (p) => sorted.length ? +sorted[Math.floor(sorted.length * p)].toFixed(1) : 0;
      done({
        frames: sorted.length,
        fps: sorted.length ? +(1000 / (sorted.reduce((s, v) => s + v, 0) / sorted.length)).toFixed(1) : 0,
        p50: at(0.5), p95: at(0.95), p99: at(0.99),
        worst: sorted.length ? +sorted[sorted.length - 1].toFixed(1) : 0,
        over20ms: sorted.filter((v) => v > 20).length,
        over33ms: sorted.filter((v) => v > 33).length,
      });
    });
  })`);
}

/* 저장소를 비우면 바깥 관측자 인트로가 «처음 보는 사람» 상태가 되어 원본
   길이로 재생되고, 그동안 시작 버튼이 잠긴다(7.7초, 안전장치 9.5초). 그래서
   이 프로파일러는 온보딩에 닿기 전에 20초 대기에서 죽고 있었다 — 측정 도구가
   측정하려는 게임의 첫 연출 때문에 못 돌던 셈이다.
   인트로 자체는 title 장면 측정에 이미 포함되므로, 여기서는 「이미 봤다」로
   표시해 온보딩까지 곧장 간다. */
const SEED_SAVE = `(() => {
  localStorage.clear(); sessionStorage.clear();
  localStorage.setItem("prism-breakers.story-intro.v1", "1");
  localStorage.setItem("stella-ball.outer-observer.played", "1");
  return true;
})()`;

async function gotoOnboarding() {
  await evaluate(SEED_SAVE);
  // The reload tears down the execution context, so this call always rejects
  // with "Execution context was destroyed" - that is the success case here.
  await evaluate("location.reload(); true").catch(() => {});
  await delay(1800);
  await waitUntil("title", async () =>
    evaluate("!!document.getElementById('enterHub')"),
  );
  await evaluate("document.getElementById('enterHub').click(); true");
  await waitUntil("onboarding", async () =>
    evaluate("document.body.classList.contains('game-mode')"),
  );
  // Dismiss the lesson card so the table is actually running.
  await evaluate(
    "if (typeof onboarding !== 'undefined' && onboarding) { onboarding.panelVisible = false; renderOnboarding && renderOnboarding(); } true",
  );
  await delay(600);
}

async function main() {
  const port = await freePort();
  serverProcess = spawn(process.execPath, ["scripts/serve.mjs"], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  await waitUntil(
    "server",
    async () => {
      try {
        return (await fetch(`http://127.0.0.1:${port}/`)).ok;
      } catch {
        return false;
      }
    },
    10000,
  );

  profileDirectory = mkdtempSync(join(tmpdir(), "stella-frame-profile-"));
  const url = `http://127.0.0.1:${port}/prototypes/prism-breakers.html`;
  browserProcess = spawn(
    browserPath(),
    [
      ...(HEADED ? [] : ["--headless=new"]),
      "--disable-background-networking",
      // Without these an occluded or unfocused window reports document.hidden
      // and throttles rAF, which is indistinguishable from "the game is fine".
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-background-timer-throttling",
      /* A fully occluded window on Windows flips document.visibilityState to
         hidden and stops rAF, which is why the first headed attempts looked
         like a dead page. This is the flag that turns that detection off. */
      ...(HEADED
        ? [
            "--window-position=0,0",
            "--window-size=1280,900",
            "--disable-features=CalculateNativeWinOcclusion",
          ]
        : []),
      "--disable-extensions",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-address=127.0.0.1",
      "--remote-debugging-port=0",
      `--user-data-dir=${profileDirectory}`,
      "--window-size=1280,720",
      url,
    ],
    { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  );

  const portFile = join(profileDirectory, "DevToolsActivePort");
  const debugPort = await waitUntil(
    "devtools port",
    async () => {
      if (!existsSync(portFile)) return false;
      const [line] = readFileSync(portFile, "utf8").split("\n");
      return line ? Number(line) : false;
    },
    15000,
  );

  const target = await waitUntil(
    "page target",
    async () => {
      try {
        const list = await (
          await fetch(`http://127.0.0.1:${debugPort}/json/list`)
        ).json();
        return list.find(
          (t) => t.type === "page" && t.url.includes("prism-breakers.html"),
        );
      } catch {
        return false;
      }
    },
    15000,
  );

  cdp = new CdpClient(target.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  await waitUntil("document ready", async () =>
    evaluate("document.readyState === 'complete'"),
  );

  if (HEADED) {
    // A window launched from a background process lands behind the terminal on
    // Windows, and an occluded window still reports document.hidden. Both of
    // these are best-effort; the rAF check below is what actually gates.
    await cdp.send("Page.bringToFront").catch(() => {});
    await cdp
      .send("Page.setWebLifecycleState", { state: "active" })
      .catch(() => {});
  }

  await cdp.send("Performance.enable", { timeDomain: "timeTicks" });
  /* Frame TIMES need vsync, but main-thread WORK does not: Performance
     .getMetrics returns cumulative seconds the renderer spent in script,
     style recalc, layout and paint. Sampling the delta over a window tells us
     how many milliseconds of real work each second of wall clock costs, and
     which of the four it is - which is the thing a fix has to target. */
  async function budget(ms, label) {
    const keys = [
      "ScriptDuration",
      "RecalcStyleDuration",
      "LayoutDuration",
      "TaskDuration",
      "LayoutCount",
      "RecalcStyleCount",
      "Timestamp",
    ];
    const read = async () => {
      const { metrics } = await cdp.send("Performance.getMetrics");
      const o = {};
      for (const m of metrics) if (keys.includes(m.name)) o[m.name] = m.value;
      return o;
    };
    const a = await read();
    await new Promise((r) => setTimeout(r, ms));
    const b = await read();
    const wall = (b.Timestamp - a.Timestamp) * 1000;
    const pct = (k) => +(((b[k] - a[k]) * 1000 * 100) / wall).toFixed(1);
    return {
      label,
      wallMs: Math.round(wall),
      scriptPct: pct("ScriptDuration"),
      stylePct: pct("RecalcStyleDuration"),
      layoutPct: pct("LayoutDuration"),
      taskPct: pct("TaskDuration"),
      layoutsPerSec: Math.round(
        ((b.LayoutCount - a.LayoutCount) * 1000) / wall,
      ),
      styleRecalcsPerSec: Math.round(
        ((b.RecalcStyleCount - a.RecalcStyleCount) * 1000) / wall,
      ),
    };
  }

  /* 129-239 style recalcs per second means something re-resolves CSS every
     frame. getAnimations() names every running animation and its element, and
     the keyframe rules say which properties it moves: anything other than
     transform/opacity/filter cannot run on the compositor, so it drags the
     main thread through style+layout on every single frame. */
  const animationCensus = () =>
    evaluate(`(() => {
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
      const SAFE = new Set(['transform','opacity']);
      const out = {};
      for (const a of document.getAnimations()) {
        const name = a.animationName || 'transition';
        const moved = props[name] || [];
        const key = name + ' [' + moved.join(',') + ']';
        out[key] = out[key] || { count: 0, compositorSafe: moved.length > 0 && moved.every((p) => SAFE.has(p)), sample: '' };
        out[key].count++;
        const el = a.effect && a.effect.target;
        if (el && !out[key].sample)
          out[key].sample = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '');
      }
      return JSON.stringify(out);
    })()`);

  /* "script is 14.5% of wall clock" is a symptom, not an address. A CPU
     profile names the functions and their file:line, so a fix targets the
     thing that is actually hot instead of the thing that looks expensive. */
  async function cpuProfile(ms, top = 14) {
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
    await cdp.send("Profiler.start");
    await new Promise((r) => setTimeout(r, ms));
    const { profile } = await cdp.send("Profiler.stop");
    const self = new Map();
    const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    for (const n of profile.nodes) self.set(n.id, 0);
    for (const id of profile.samples || [])
      self.set(id, (self.get(id) || 0) + 1);
    const total = (profile.samples || []).length || 1;
    const rows = [];
    for (const [id, hits] of self) {
      if (!hits) continue;
      const n = byId.get(id);
      const f = n.callFrame;
      const file = (f.url || "").split("/").pop();
      rows.push({
        fn: f.functionName || "(anonymous)",
        at: file ? `${file}:${f.lineNumber + 1}` : "(native)",
        pct: +((hits * 100) / total).toFixed(1),
      });
    }
    return rows.sort((a, b) => b.pct - a.pct).slice(0, top);
  }

  const report = { url, scenes: {}, ablation: {} };

  // rAF has to actually be running, or every number below is meaningless.
  const alive = await evaluate(
    "new Promise((r) => requestAnimationFrame(() => r(!document.hidden)))",
  );
  report.rafRunning = alive;
  report.visibility = await evaluate(
    "document.visibilityState + '/' + (document.hasFocus() ? 'focus' : 'blur')",
  );
  if (!alive && HEADED) {
    console.log(
      JSON.stringify({ error: "rAF not running - cannot profile" }, null, 2),
    );
    return report;
  }

  /* Headless Chromium has no vsync and composites in software, so the frame
     TIMES above are not comparable to a real machine. What does transfer is
     the structure of the compositing work: how many layers the page promotes
     and how much surface they cover. A layer count in the hundreds is a
     problem on any GPU. */
  async function layerStats() {
    await cdp.send("LayerTree.enable");
    const seen = await new Promise((res) => {
      const timer = setTimeout(() => res(null), 4000);
      cdp.on("LayerTree.layerTreeDidChange", (params) => {
        clearTimeout(timer);
        res(params.layers ?? []);
      });
      evaluate("document.body.getBoundingClientRect().width").catch(() => {});
      // Some builds only emit the tree after a forced update.
      cdp.send("LayerTree.enable").catch(() => {});
    });
    await cdp.send("LayerTree.disable");
    if (!seen) return { layers: null, note: "no layer tree event" };
    let area = 0;
    for (const l of seen) area += (l.width || 0) * (l.height || 0);
    return {
      layers: seen.length,
      totalLayerAreaMpx: +(area / 1e6).toFixed(2),
      largest: seen
        .map((l) => Math.round(((l.width || 0) * (l.height || 0)) / 1000))
        .sort((a, b) => b - a)
        .slice(0, 5),
    };
  }

  await delay(1200);
  report.animations = { title: await animationCensus() };
  report.budget = { title: await budget(3000, "title") };
  // Sampled again after the entrance animations have run out, so the number
  // reflects the screen a player sits on, not its first two seconds.
  report.budget.titleSettled = await budget(4000, "titleSettled");

  /* Instrumenting callers found no JS geometry reads, so the per-frame layout
     has to come from the animations themselves. Cancelling one group at a time
     and re-reading the layout counter is a direct causal test: whichever name
     takes layouts/s down with it is the one paying for the whole screen. */
  const names = JSON.parse(
    (await evaluate(
      "JSON.stringify([...new Set(document.getAnimations().map(a => a.animationName || 'transition'))])",
    )) || "[]",
  );
  report.animAblation = [];
  for (const name of names) {
    await evaluate(
      `document.getAnimations().filter(a => (a.animationName||'transition') === ${JSON.stringify(name)}).forEach(a => a.pause()), 1`,
    );
    const b = await budget(1400, name);
    report.animAblation.push({
      name,
      layoutsPerSec: b.layoutsPerSec,
      recalcsPerSec: b.styleRecalcsPerSec,
      stylePct: b.stylePct,
    });
    await evaluate(
      `document.getAnimations().filter(a => (a.animationName||'transition') === ${JSON.stringify(name)}).forEach(a => a.play()), 1`,
    );
  }
  report.scenes.title = await sampleFrames(3000);
  report.layersTitle = await layerStats();

  /* 별 반짝임은 부분 갱신으로 구현돼 있어 CSS 애니메이션 목록에 나타나지
     않는다. 캔버스 픽셀을 시간차로 두 번 읽어 실제로 변하는지 확인한다. */
  report.starTwinkle = await evaluate(`(async () => {
    const sky = document.getElementById('dawn-sky');
    const cv = sky && [...sky.children].find((e) => e.tagName === 'CANVAS');
    if (!cv) return { error: 'no star canvas' };
    const g = cv.getContext('2d');
    const snap = () => {
      const d = g.getImageData(0, 0, cv.width, cv.height).data;
      let lit = 0, sum = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) { lit++; sum += d[i]; }
      return { lit, sum };
    };
    const a = snap();
    await new Promise((r) => setTimeout(r, 500));
    const b = snap();
    await new Promise((r) => setTimeout(r, 500));
    const c = snap();
    return {
      litStars: a.lit,
      alphaSum: [a.sum, b.sum, c.sum],
      twinkling: !(a.sum === b.sum && b.sum === c.sum),
      hidden: document.hidden,
    };
  })()`);

  await gotoOnboarding();
  report.animations.onboarding = await animationCensus();
  report.budget = report.budget || {};
  report.budget.onboarding = await budget(4000, "onboarding");
  report.cpu = { onboarding: await cpuProfile(5000) };
  report.scenes.onboarding = await sampleFrames(HEADED ? 6000 : 4000);

  /* 패링 순간의 비용. 「패링할 때 렉이 걸리는 것 같다(연출일 수도 있고)」는
     제보를 가르기 위한 측정이다. 두 가지는 화면에서 똑같이 «멈춤»으로 보이지만
     원인이 정반대다.
       - 히트스톱: impactStop > 0인 프레임은 update()가 통째로 건너뛴다. 판이
         의도적으로 언 것이고, rAF는 정상 간격으로 계속 돈다.
       - 진짜 렉: rAF 간격 자체가 길어진 것. 이쪽만 고칠 대상이다.
     그래서 프레임마다 간격과 impactStop을 함께 적어 둘을 분리한다. 패링은
     전투가 실제로 부르는 자리와 같은 인자로 낸다(game-combat.js:417). */
  report.parry = await evaluate(`new Promise((done) => {
    const rows = [];
    let last = performance.now();
    const stopAt = last + 5000;
    let next = last + 300;
    requestAnimationFrame(function tick(t) {
      rows.push({ gap: t - last, stop: typeof impactStop === 'number' ? impactStop : 0 });
      last = t;
      if (t > next) {
        next = t + 300;
        try { impact(false, ball.x, ball.y, 'contact'); } catch (e) {}
      }
      if (t < stopAt) return requestAnimationFrame(tick);
      const gaps = rows.slice(1).map((r) => r.gap).sort((a, b) => a - b);
      const at = (p) => gaps.length ? +gaps[Math.floor(gaps.length * p)].toFixed(1) : 0;
      const frozen = rows.filter((r) => r.stop > 0).length;
      done({
        frames: gaps.length,
        parries: Math.floor(5000 / 300),
        p50: at(0.5), p95: at(0.95), p99: at(0.99),
        worst: gaps.length ? +gaps[gaps.length - 1].toFixed(1) : 0,
        over20ms: gaps.filter((v) => v > 20).length,
        over33ms: gaps.filter((v) => v > 33).length,
        frozenFrames: frozen,
        frozenPct: +(100 * frozen / rows.length).toFixed(1),
        maxStopMs: +(Math.max(...rows.map((r) => r.stop)) * 1000).toFixed(1),
      });
    });
  })`);
  /* 같은 조건에서 그림자 블러만 끄고 다시 잰다. 08-16 절제 실험에서 이 한
     값이 CPU 래스터 프레임을 46.34ms → 7.77ms로 바꿨다 — GPU에서는 싸고
     소프트웨어 래스터로 떨어지면 잔혹한 비용이라, 재현 안 되는 렉 제보의
     유력한 후보다. 여기서 차이가 없다면 이 기계는 GPU 경로다. */
  await evaluate(`(() => {
    const g = document.getElementById('game').getContext('2d');
    const d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'shadowBlur');
    window.__blurOff = d;
    Object.defineProperty(g, 'shadowBlur', { set() {}, get() { return 0; }, configurable: true });
    return true;
  })()`);
  report.parryNoBlur = await evaluate(`new Promise((done) => {
    const gaps = [];
    let last = performance.now();
    const stopAt = last + 5000;
    let next = last + 300;
    requestAnimationFrame(function tick(t) {
      gaps.push(t - last); last = t;
      if (t > next) { next = t + 300; try { impact(false, ball.x, ball.y, 'contact'); } catch (e) {} }
      if (t < stopAt) return requestAnimationFrame(tick);
      const s = gaps.slice(1).sort((a, b) => a - b);
      const at = (p) => s.length ? +s[Math.floor(s.length * p)].toFixed(1) : 0;
      done({ frames: s.length, p50: at(0.5), p95: at(0.95), p99: at(0.99),
             worst: s.length ? +s[s.length - 1].toFixed(1) : 0,
             over20ms: s.filter((v) => v > 20).length });
    });
  })`);
  report.headed = HEADED;
  report.layersOnboarding = await layerStats();

  if (ABLATE) {
    /* Attribute the cost: switch one layer off at a time and re-measure the
       same scene. Each is reversed before the next so the comparisons stay
       independent. */
    const cases = {
      noAmbienceLayer: `document.getElementById('sky-ambience').style.display='none'; true`,
      noGaugeRing: `document.getElementById('sky-gauge-ring').style.display='none'; true`,
      noSkyAnimations: `document.querySelectorAll('#dawn-sky *').forEach(e => e.style.animation = 'none'); true`,
      noSkyAtAll: `document.getElementById('dawn-sky').style.display = 'none'; true`,
      noCanvasDraw: `window.__realDraw = draw; window.draw = () => {}; true`,
    };
    const undo = {
      noAmbienceLayer: `document.getElementById('sky-ambience').style.display=''; true`,
      noGaugeRing: `document.getElementById('sky-gauge-ring').style.display=''; true`,
      noSkyAnimations: `location.reload(); true`,
      noSkyAtAll: `document.getElementById('dawn-sky').style.display = ''; true`,
      noCanvasDraw: `window.draw = window.__realDraw; true`,
    };
    for (const [name, apply] of Object.entries(cases)) {
      if (name === "noSkyAnimations") await gotoOnboarding();
      await evaluate(apply);
      await delay(500);
      report.ablation[name] = {
        frames: await sampleFrames(2000),
        layers: await layerStats(),
      };
      await evaluate(undo[name]);
      if (undo[name].includes("reload")) await gotoOnboarding();
      await delay(300);
    }
  }

  console.log(JSON.stringify(report, null, 2));
  return report;
}

main()
  .catch((error) => {
    console.error(String(error?.stack ?? error));
    process.exitCode = 1;
  })
  .finally(() => {
    cdp?.close();
    browserProcess?.kill();
    serverProcess?.kill();
    if (profileDirectory) {
      try {
        rmSync(profileDirectory, { recursive: true, force: true });
      } catch {}
    }
  });

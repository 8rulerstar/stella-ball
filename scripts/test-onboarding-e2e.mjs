import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const startedAt = Date.now();
const events = [];
const browserErrors = [];
let browserProcess = null;
let serverProcess = null;
let profileDirectory = null;
let cdp = null;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function record(name, detail = {}) {
  events.push({ name, atMs: Date.now() - startedAt, ...detail });
}

async function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolvePort(address.port));
    });
  });
}

async function waitUntil(label, check, timeoutMs = 20000, intervalMs = 50) {
  const deadline = Date.now() + timeoutMs;
  let lastValue;
  while (Date.now() < deadline) {
    lastValue = await check();
    if (lastValue) return lastValue;
    await delay(intervalMs);
  }
  throw new Error(
    `${label} timed out (${timeoutMs}ms); last=${JSON.stringify(lastValue)}`,
  );
}

function browserPath() {
  const configured = [
    process.env.STELLA_BROWSER_PATH,
    process.env.CHROME_PATH,
  ].filter(Boolean);
  const candidates = [
    ...configured,
    ...(process.platform === "win32"
      ? [
          "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
          "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        ]
      : process.platform === "darwin"
        ? [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
          ]
        : [
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
          ]),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(
      "Chrome/Edge executable not found. Set STELLA_BROWSER_PATH to a Chromium browser.",
    );
  }
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

  async connect() {
    this.socket = new WebSocket(this.url);
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result ?? {});
        return;
      }
      for (const listener of this.listeners.get(message.method) ?? [])
        listener(message.params ?? {});
    });
    await new Promise((resolveOpen, reject) => {
      this.socket.addEventListener("open", resolveOpen, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  send(method, params = {}) {
    const id = ++this.serial;
    return new Promise((resolveResult, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP ${method} timed out`));
      }, 10000);
      this.pending.set(id, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolveResult(result);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
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
  const response = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (response.exceptionDetails) {
    const detail = response.exceptionDetails;
    throw new Error(
      detail.exception?.description ??
        detail.text ??
        "Browser evaluation failed",
    );
  }
  return response.result?.value;
}

async function gameState() {
  return evaluate(`(() => ({
    phase: typeof onboarding === "undefined" ? null : onboarding?.phase ?? null,
    dialogue: typeof onboarding === "undefined" ? null : onboarding?.dialogue ?? null,
    panelVisible: typeof onboarding === "undefined" ? null : onboarding?.panelVisible ?? null,
    transitioning: typeof onboarding === "undefined" ? null : Boolean(onboarding?.transitioning),
    bossHit: typeof onboarding === "undefined" ? false : Boolean(onboarding?.bossHit),
    steered: typeof onboarding === "undefined" ? false : Boolean(onboarding?.steered),
    parrySuccess: typeof onboarding === "undefined" ? false : Boolean(onboarding?.parrySuccess),
    figureResolved: typeof onboarding === "undefined" ? false : Boolean(onboarding?.figureResolved),
    parriedHero: typeof onboarding === "undefined" ? null : onboarding?.parriedHero ?? null,
    figure: typeof figureFx === "undefined" ? null : figureFx?.shape?.id ?? null,
    figurePoints: typeof figureFx === "undefined" ? 0 : figureFx?.drawn?.length ?? 0,
    moving: typeof ball === "undefined" ? false : Boolean(ball?.moving),
    aimAssist: typeof ball === "undefined" ? false : Boolean(ball?.aimAssist),
    guideCharges: typeof battle === "undefined" ? 0 : battle?.guideStarCharges ?? 0,
    run: typeof run === "undefined" ? false : Boolean(run),
    bossHp: typeof boss === "undefined" ? null : boss?.hp ?? null,
    card: document.querySelector(".onboarding-kicker b")?.textContent?.trim() ?? null,
    cardTitle: document.querySelector(".onboarding-card h3")?.textContent?.trim() ?? null,
    outcome: document.querySelector(".outcome-cut h2")?.textContent?.trim() ?? null
  }))()`);
}

async function buttonPoint(text) {
  return evaluate(`(() => {
    const button = [...document.querySelectorAll("button")].find((entry) =>
      !entry.disabled && entry.textContent.includes(${JSON.stringify(text)}));
    if (!button) return null;
    button.scrollIntoView({ block: "center", inline: "center" });
    const rect = button.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2,
      text: button.textContent.trim() };
  })()`);
}

async function mouseClick(point, button = "left") {
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: point.x,
    y: point.y,
    button,
    buttons: button === "left" ? 1 : 2,
    clickCount: 1,
  });
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: point.x,
    y: point.y,
    button,
    buttons: 0,
    clickCount: 1,
  });
}

async function clickButton(text, timeoutMs = 5000) {
  const point = await waitUntil(
    `button ${text}`,
    () => buttonPoint(text),
    timeoutMs,
  );
  await mouseClick(point);
  record("button", { text: point.text });
}

async function shotPoints(targetOffsetX = 0) {
  return evaluate(`(() => {
    const canvas = document.querySelector("#game");
    canvas.scrollIntoView({ block: "center", inline: "center" });
    const rect = canvas.getBoundingClientRect();
    const target = { x: boss.x + ${Number(targetOffsetX)}, y: boss.y };
    const distance = Math.hypot(target.x - ball.x, target.y - ball.y) || 1;
    const ux = (target.x - ball.x) / distance;
    const uy = (target.y - ball.y) / distance;
    const cueX = ball.x - ux * 260;
    const cueY = ball.y - uy * 260;
    const rawY = ball.y + (cueY > ball.y ? (cueY - ball.y) / 4.8 : cueY - ball.y);
    const css = (x, y) => ({
      x: rect.left + x * rect.width / 720,
      y: rect.top + y * rect.height / 900
    });
    return { from: css(ball.x, ball.y), to: css(cueX, rawY) };
  })()`);
}

async function dragShot(targetOffsetX = 0) {
  const points = await shotPoints(targetOffsetX);
  assert(
    points?.from && points?.to,
    "Could not resolve meteor drag coordinates",
  );
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    ...points.from,
    button: "none",
  });
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    ...points.from,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });
  for (let index = 1; index <= 5; index += 1) {
    const ratio = index / 5;
    await cdp.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: points.from.x + (points.to.x - points.from.x) * ratio,
      y: points.from.y + (points.to.y - points.from.y) * ratio,
      button: "left",
      buttons: 1,
    });
  }
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    ...points.to,
    button: "left",
    buttons: 0,
    clickCount: 1,
  });
  await waitUntil(
    "meteor launch",
    async () => (await gameState()).moving,
    2000,
  );
  record("drag-shot", { targetOffsetX });
}

async function clickMovingMeteor() {
  const point = await evaluate(`(() => {
    const rect = document.querySelector("#game").getBoundingClientRect();
    return { x: rect.left + ball.x * rect.width / 720,
      y: rect.top + ball.y * rect.height / 900 };
  })()`);
  await mouseClick(point);
  record("steer-input", { side: "left" });
}

/* 노드 조준(2026-08-21). 유성이 멈춘 뒤 aimNodes()에서 좌표를 받아 n개를
   찍는다. 별지기는 항상 셋이 있으므로 별빛이 없어도 하한(minPick)을 채운다.
   `keep`을 주면 별빛을 그만큼 «남겨» 별자리 재료로 돌린다 — 수업 3이 그것을
   가르치므로 E2E도 같은 손을 따라가야 한다. */
async function pickNodes(count, { preferUnits = true } = {}) {
  const points = await evaluate(`(() => {
    if (typeof aimNodes !== "function") return null;
    const rect = document.querySelector("#game").getBoundingClientRect();
    const nodes = aimNodes().map((n, i) => ({ i, unit: !!n.unit, x: n.x, y: n.y }));
    const order = ${preferUnits ? "nodes.filter(n => n.unit).concat(nodes.filter(n => !n.unit))" : "nodes"};
    return order.slice(0, ${count}).map(n => ({
      i: n.i, unit: n.unit,
      x: rect.left + n.x * rect.width / 720,
      y: rect.top + n.y * rect.height / 900,
    }));
  })()`);
  assert(
    points && points.length === count,
    `Could not resolve ${count} aim nodes (got ${points ? points.length : "null"})`,
  );
  for (const point of points) await mouseClick(point);
  const picked = await evaluate("aimPick.length");
  assert(picked === count, `Expected ${count} picks, got ${picked}`);
  record("aim-pick", { count, units: points.filter((p) => p.unit).length });
  return points;
}

async function nodeShot(count = 3) {
  await waitUntil(
    "meteor at rest",
    async () => !(await gameState()).moving,
    8000,
  );
  await pickNodes(count);
  await pressSpace();
  await waitUntil(
    "node-aimed launch",
    async () => (await gameState()).moving,
    4000,
  );
  record("node-shot", { count });
}

async function pressSpace() {
  const key = {
    key: " ",
    code: "Space",
    windowsVirtualKeyCode: 32,
    nativeVirtualKeyCode: 32,
  };
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", ...key });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...key });
  record("key", { code: "Space" });
}

async function waitForLessonResult(phase, timeoutMs = 20000) {
  return waitUntil(
    `lesson ${phase} result card`,
    async () => {
      const state = await gameState();
      return state.phase === phase &&
        state.dialogue === 1 &&
        state.panelVisible === true &&
        !state.transitioning
        ? state
        : false;
    },
    timeoutMs,
  );
}

async function runOnboarding() {
  await evaluate(`(() => {
    return true;
  })()`);
  await waitUntil(
    "title screen",
    () => buttonPoint("처음인가요? 1분 튜토리얼"),
    10000,
  );
  await clickButton("처음인가요? 1분 튜토리얼");

  await waitUntil(
    "lesson card 1",
    async () => (await gameState()).card === "1 / 6",
  );
  await clickButton("유성 발사하기");
  await dragShot();
  const first = await waitForLessonResult(0);
  assert(first.bossHit, "Lesson 1 did not register the direct boss hit");
  assert(first.card === "2 / 6", `Expected card 2 / 6, got ${first.card}`);
  record("lesson-pass", { lesson: 1, assertion: "bossHit" });

  /* 2026-08-21: 수업이 «조향·Space 패링»에서 «노드 조준·자동 공명·별빛
     경제»로 바뀌었다. 여정도 그대로 따라간다 — 카드 문구와 통과 조건이
     game-onboarding.js의 lessons 표와 한 몸이므로, 그쪽을 고치면 여기도
     같은 커밋에서 고쳐야 한다. */
  await clickButton("다음 · 노드 조준");
  await waitUntil(
    "lesson card 3",
    async () => (await gameState()).card === "3 / 6",
  );
  await clickButton("셋 찍고 Space로 발사");
  await nodeShot(3);
  const second = await waitForLessonResult(1, 20000);
  assert(second.card === "4 / 6", `Expected card 4 / 6, got ${second.card}`);
  const aimed = await evaluate(
    "typeof onboarding === 'object' && onboarding ? !!onboarding.aimed : null",
  );
  assert(aimed === true, "Lesson 2 did not register a node-aimed shot");
  const teachShots = await evaluate(
    "typeof aimTeach === 'object' && aimTeach ? aimTeach.shots : null",
  );
  /* 수업 샷은 교습 예산을 소모하면 안 된다 — 범례가 lessonGuide로 접힌
     동안 카운터가 오르면 캠페인 첫 판에서 «첫 3샷» 안내를 영영 못 본다. */
  assert(
    teachShots === 0,
    `aimTeach.shots consumed during lessons (got ${teachShots})`,
  );
  record("lesson-pass", { lesson: 2, assertion: "nodeAimed" });

  await clickButton("다음 · 별자리");
  await waitUntil(
    "lesson card 5",
    async () => (await gameState()).card === "5 / 6",
  );
  await clickButton("별빛을 남기고 발사");
  /* 별빛을 남겨야 별자리가 뜬다. 별지기 셋만 찍으면 별빛은 하나도 안 쓰이고
     전부 별자리 재료로 남는다 — 수업이 가르치는 손이 정확히 이것이다.

     두 샷이 필요하다. 노드 경제에서 별자리는 «이전 샷이 남긴» 별빛으로
     발동하는데(launchAimStarShot이 발사 직전에 남은 별빛을 태운다),
     단계 진입 때 setupBattle이 별빛을 비우므로 첫 샷은 재료를 만드는 샷이고
     둘째 샷의 발사가 그것을 태운다. 수업 문안은 한 번에 되는 것처럼 읽히므로
     그쪽은 별도 항목으로 남긴다. */
  const seeded = await evaluate("aimStars.length");
  assert(seeded >= 3, `Lesson 3 needs pre-seeded starlight, got ${seeded}`);
  await nodeShot(3);
  const resonance = await waitUntil(
    "guided figure resolution",
    async () => {
      const state = await gameState();
      return state.figureResolved ? state : false;
    },
    25000,
  );
  assert(
    resonance.figurePoints >= 3,
    `Expected three or more starlight points, got ${resonance.figurePoints}`,
  );
  const third = await waitForLessonResult(2, 25000);
  assert(third.card === "6 / 6", `Expected card 6 / 6, got ${third.card}`);
  record("lesson-pass", {
    lesson: 3,
    assertion: "figure",
    figure: resonance.figure,
  });

  await clickButton("직접 잡아보기");
  const finalStart = await waitUntil("final battle", async () => {
    const state = await gameState();
    return state.phase === 3 && state.run && state.panelVisible === false
      ? state
      : false;
  });
  assert(
    finalStart.bossHp === 120,
    `Expected 120 HP final boss, got ${finalStart.bossHp}`,
  );
  const party = await evaluate("deployed.slice()");
  /* 순서까지 못 박는다 — 배치가 곧 수업 연출이다. 가운데(마지막 슬롯) 자리는
     가온이다(2026-08-21, 오너 지시). 스타터 셋이 전원 서 있는지와 함께 본다. */
  assert(
    JSON.stringify(party) === JSON.stringify(["ria", "biyeon", "gaon"]),
    `Unexpected final party: ${JSON.stringify(party)}`,
  );
  // This fixture shortens only the E2E duration. The next real drag/Space
  // input still has to reach the damage path and schedule the normal victory.
  await evaluate("boss.hp = boss.maxHp = 1; sync(); true");
  for (const offset of [0, 55, -55]) {
    if (await evaluate("hasOnboardingClear()")) break;
    // The retry offsets exist for a shot that MISSED. Once the colossus is
    // down the battle is complete and the launch path is closed for the whole
    // victory cutscene, so another drag here would wait forever - and used to
    // "work" only because launching during that window was itself a bug.
    if (await evaluate("battleComplete === true")) break;
    const ready = await waitUntil(
      "final meteor ready",
      async () => {
        const state = await gameState();
        return state.run && !state.moving ? state : false;
      },
      20000,
    );
    if (!ready.run) break;
    /* 실전(phase 3)에는 별지기 셋이 서 있으므로 노드 조준이 켜져 있고
       드래그는 도달 불가능하다 — 드래그는 노드가 없을 때의 경로다.
       수업 1만 드래그이고 그 뒤로는 전부 찍기다. */
    await nodeShot(3);
    void offset;
    await pressSpace();
    await waitUntil(
      "final shot resolution",
      async () => {
        const state = await gameState();
        return (await evaluate("hasOnboardingClear()")) || !state.moving;
      },
      20000,
    );
  }

  const reward = await waitUntil(
    "onboarding reward",
    async () => {
      const state = await gameState();
      return state.outcome === "첫 관측자의 증명" ? state : false;
    },
    15000,
  );
  const unlock = await evaluate(`({
    clear: hasOnboardingClear(),
    thirdSlot: hasThirdPartySlot(),
    freeSummons: Number(progress.freeSummons || 0),
    rewardButton: document.querySelector("#openOnboardingAchievement")?.textContent.trim()
  })`);
  assert(unlock.clear, "Onboarding clear flag was not stored");
  assert(unlock.thirdSlot, "Third party slot was not unlocked");
  assert(
    unlock.freeSummons === 1,
    `Expected one free summon, got ${unlock.freeSummons}`,
  );
  assert(unlock.rewardButton === "무료로 소환하기", "Reward CTA is missing");
  record("reward", { outcome: reward.outcome, ...unlock });
  return {
    unlock,
    contract: {
      // 조향 수업이 노드 조준 수업으로 바뀌며 조향은 이 여정에서 더는
      // 연습되지 않는다 — 있지도 않은 steerInputs를 계약에 적지 않는다.
      aimTeachShots: await evaluate(
        "typeof aimTeach === 'object' && aimTeach ? aimTeach.shots : null",
      ),
      /* 조향·유도 오망성 수업이 사라지면서 routeLocked·parriedHero·
         guideChargeConsumed도 함께 사라졌다. 남은 것은 「남긴 별빛이 실제로
         별자리가 됐는가」 하나이고, 그것이 수업 3이 증명하는 전부다. */
      figure: resonance.figure,
      figurePoints: resonance.figurePoints,
    },
  };
}

async function startServer(port) {
  serverProcess = spawn(process.execPath, ["scripts/serve.mjs"], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let stderr = "";
  serverProcess.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  await waitUntil(
    "local server",
    async () => {
      if (serverProcess.exitCode != null)
        throw new Error(`Local server exited early: ${stderr}`);
      try {
        return (await fetch(`http://127.0.0.1:${port}/`)).ok;
      } catch {
        return false;
      }
    },
    10000,
  );
}

async function startBrowser(executable, url) {
  profileDirectory = mkdtempSync(join(tmpdir(), "stella-onboarding-e2e-"));
  const args = [
    "--headless=new",
    "--disable-background-networking",
    "--disable-extensions",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=0",
    `--user-data-dir=${profileDirectory}`,
    "--window-size=1440,1200",
    url,
  ];
  if (process.platform !== "win32" && process.getuid?.() === 0)
    args.unshift("--no-sandbox");
  browserProcess = spawn(executable, args, {
    stdio: "ignore",
    windowsHide: true,
  });
  const portFile = join(profileDirectory, "DevToolsActivePort");
  const debugPort = await waitUntil(
    "browser debugging port",
    async () => {
      if (browserProcess.exitCode != null)
        throw new Error(`Browser exited early with ${browserProcess.exitCode}`);
      if (!existsSync(portFile)) return false;
      return Number(readFileSync(portFile, "utf8").split(/\r?\n/)[0]);
    },
    10000,
  );
  const target = await waitUntil(
    "game browser target",
    async () => {
      try {
        const targets = await (
          await fetch(`http://127.0.0.1:${debugPort}/json/list`)
        ).json();
        return targets.find(
          (entry) =>
            entry.type === "page" && entry.url.includes("prism-breakers.html"),
        );
      } catch {
        return false;
      }
    },
    10000,
  );
  cdp = new CdpClient(target.webSocketDebuggerUrl);
  await cdp.connect();
  cdp.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
    browserErrors.push(
      exceptionDetails?.exception?.description ??
        exceptionDetails?.text ??
        "Runtime exception",
    );
  });
  cdp.on("Runtime.consoleAPICalled", ({ type, args }) => {
    if (type !== "error") return;
    browserErrors.push(
      args.map((arg) => arg.value ?? arg.description).join(" "),
    );
  });
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  await waitUntil(
    "game document",
    () =>
      evaluate(
        'document.readyState === "complete" && document.title === "STELLA BALL"',
      ),
    10000,
  );
}

async function cleanup() {
  cdp?.close();
  if (browserProcess && browserProcess.exitCode == null) browserProcess.kill();
  if (serverProcess && serverProcess.exitCode == null) serverProcess.kill();
  await delay(150);
  if (profileDirectory)
    try {
      rmSync(profileDirectory, { recursive: true, force: true });
    } catch {
      // Windows can retain a short-lived singleton lock after process exit.
    }
}

try {
  const port = await freePort();
  const executable = browserPath();
  const url = `http://127.0.0.1:${port}/prototypes/prism-breakers.html`;
  await startServer(port);
  await startBrowser(executable, url);
  const journey = await runOnboarding();
  assert(
    browserErrors.length === 0,
    `Browser errors: ${browserErrors.join(" | ")}`,
  );
  console.log(
    JSON.stringify(
      {
        result: "passed",
        browser: basename(executable),
        durationMs: Date.now() - startedAt,
        cards: ["1 / 6", "2 / 6", "3 / 6", "4 / 6", "5 / 6", "6 / 6"],
        figure: "pentagram",
        ...journey,
        events,
      },
      null,
      2,
    ),
  );
} catch (error) {
  let state = null;
  try {
    state = cdp ? await gameState() : null;
  } catch {
    state = null;
  }
  console.error(
    JSON.stringify(
      {
        result: "failed",
        error: error instanceof Error ? error.stack : String(error),
        state,
        browserErrors,
        events,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  await cleanup();
}

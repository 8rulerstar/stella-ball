/**
 * 조향 수업 정지 지점 실화면 확인.
 *
 * 「구역 도착 전에 멈춘다」는 제보가 두 번 들어왔다. 좌표만 계산해서는
 * 「62%면 충분히 가까움」이라는 답이 나오는데, 화면에는 점선 링과 유성이
 * 같이 있으므로 «보이는 거리»가 실제 판정이다. 판이 멈춘 그 프레임을 그대로
 * 찍고, 같은 프레임의 좌표를 함께 남긴다.
 *
 *   node scripts/probe-steer-lesson.mjs
 *
 * 결과: stdout JSON + 스크린샷 네 장
 *   <out>/steer-aim.png     발사 전 — 무엇을 목표로 그려 주는가
 *   <out>/steer-flight.png  비행 중 — 멈출 자리 표식이 «미리» 보이는가
 *   <out>/steer-hold.png    정지한 순간의 전체 화면
 *   <out>/steer-board.png   같은 순간의 판만 잘라낸 것
 *
 * JSON의 `stoppedOnMarker`가 이 수정의 단언이다 — 유성이 표식에서 18px 안에
 * 멈추는가. 어긋나면 「도착 전에 멈춘다」가 그대로 되살아난다.
 */
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : join(tmpdir(), "steer-lesson-shots");
mkdirSync(outDir, { recursive: true });
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
const profileDir = mkdtempSync(join(tmpdir(), "steer-probe-"));
const debugPort = port + 1;
const chrome = spawn(
  browser,
  [
    "--headless=new",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDir}`,
    "--window-size=1280,900",
    "--hide-scrollbars",
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
async function waitFor(label, probe, ms = 12000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const v = await probe();
    if (v) return v;
    await delay(80);
  }
  // 무엇을 기다리다 실패했는지보다 «그때 화면에 무엇이 있었는지»가 고칠 거리다.
  const seen = await evaluate(`JSON.stringify({
    buttons: [...document.querySelectorAll("button")].map((b) => b.textContent.trim()).slice(0, 14),
    phase: typeof onboarding !== 'undefined' && onboarding ? onboarding.phase : null,
    panelVisible: typeof onboarding !== 'undefined' && onboarding ? onboarding.panelVisible : null,
    dialogue: typeof onboarding !== 'undefined' && onboarding ? onboarding.dialogue : null,
    moving: typeof ball !== 'undefined' && ball ? ball.moving : null,
  })`).catch(() => "(no state)");
  throw new Error("timed out waiting for " + label + " | " + seen);
}
async function clickButton(text) {
  const point = await waitFor("button " + text, () =>
    evaluate(`(() => {
      /* 수업 카드의 버튼은 disabled로 태어나 reveal 지연(최대 1.9초) 뒤에
         열린다. 열리기 전에 누르면 합성 클릭이 조용히 아무 일도 하지 않고,
         그 뒤의 모든 대기가 「아직 1교시」로 굳는다. 열린 것만 고른다. */
      const b = [...document.querySelectorAll("button")]
        .find((e) => !e.disabled && e.textContent.trim().includes(${JSON.stringify(text)}));
      if (!b) return null;
      b.scrollIntoView({ block: "center", inline: "center" });
      const r = b.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      /* 합성 클릭이 아무 일도 안 할 때 원인은 거의 언제나 「그 좌표의 맨 위
         요소가 이 버튼이 아니다」이다. 덮개가 있으면 여기서 드러난다. */
      const top = document.elementFromPoint(x, y);
      return { x, y, covered: top !== b && !b.contains(top),
               topEl: top ? top.tagName + '.' + (typeof top.className === 'string' ? top.className : '') : null };
    })()`),
  );
  if (point.covered)
    throw new Error(
      `button ${text} is covered by ${point.topEl} - a synthetic click cannot reach it`,
    );
  await send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: point.x,
    y: point.y,
    button: "none",
  });
  for (const type of ["mousePressed", "mouseReleased"])
    await send("Input.dispatchMouseEvent", {
      type,
      x: point.x,
      y: point.y,
      button: "left",
      buttons: type === "mousePressed" ? 1 : 0,
      clickCount: 1,
    });
  await delay(260);
}
// 실제 손과 같은 경로로 쏜다. 발사만 코드로 넣으면 조준 보정(billiardAim)과
// 수업의 항로 고정 훅을 건너뛰어, 재려는 그 상황이 아니게 된다.
async function dragShot(target) {
  const p = await evaluate(`(() => {
    const canvas = document.querySelector("#game");
    const rect = canvas.getBoundingClientRect();
    const t = ${target};
    const d = Math.hypot(t.x - ball.x, t.y - ball.y) || 1;
    const ux = (t.x - ball.x) / d, uy = (t.y - ball.y) / d;
    const cueX = ball.x - ux * 260, cueY = ball.y - uy * 260;
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
  for (let i = 1; i <= 5; i++)
    await send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: p.from.x + (p.to.x - p.from.x) * (i / 5),
      y: p.from.y + (p.to.y - p.from.y) * (i / 5),
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
}
async function shoot(name, clip) {
  const { data } = await send("Page.captureScreenshot", {
    format: "png",
    ...(clip ? { clip: { ...clip, scale: 1 } } : {}),
  });
  const file = join(outDir, name);
  writeFileSync(file, Buffer.from(data, "base64"));
  return file;
}

try {
  await connect();
  await send("Runtime.enable");
  await send("Page.enable");
  for (let i = 0; i < 60; i++) {
    if (await evaluate("document.readyState === 'complete'")) break;
    await delay(100);
  }
  await evaluate(
    "try { localStorage.clear() } catch {} ; location.reload(), 1",
  );
  await delay(1500);

  /* 효과음이 «실제로 울리는지»는 코드를 읽어서는 알 수 없다. 큐 이름이 하나만
     어긋나도 playSampleSfx가 조용히 false를 돌려주고, 재생 실패는 .catch(()=>{})가
     먹는다. 실제 재생 시도를 큐별로 센다. 헤드리스에는 사용자 제스처가 없어
     소리가 나지는 않지만, «어느 사건이 어느 큐를 불렀는가»는 그대로 보인다. */
  await evaluate(`(() => {
    window.__sfx = {};
    const realSample = playSampleSfx;
    playSampleSfx = function (kind, strength, heroId) {
      const ok = realSample.apply(this, arguments);
      if (ok) window.__sfx[kind] = (window.__sfx[kind] || 0) + 1;
      return ok;
    };
    return 1;
  })()`);

  await clickButton("처음인가요? 1분 튜토리얼");
  await waitFor("lesson 1", () =>
    evaluate("!!onboarding && onboarding.panelVisible !== false"),
  );
  await clickButton("유성 발사하기");
  await delay(300);
  /* 1교시는 보스 직격을 요구하고, 못 맞히면 결과 카드의 버튼이 「다시 시도」로
     바뀐다. 조준이 빗나갈 수 있으므로 어느 쪽이 떠도 진행되게 한다 — 여기서
     재려는 것은 1교시가 아니라 2교시의 정지 지점이다. */
  for (let attempt = 0; attempt < 4; attempt++) {
    /* 카드가 물러난 뒤에 끌어야 한다. 카드가 떠 있는 동안은 입력이 잠겨 있어
       («isOnboardingInputLocked») 드래그가 통째로 삼켜지고, 그 다음 대기가
       「카드가 보인다」로 즉시 참이 되어 실패가 성공처럼 지나간다. */
    await waitFor("practice board", () =>
      evaluate("onboarding && onboarding.panelVisible === false"),
    );
    await delay(250);
    await dragShot("{ x: boss.x, y: boss.y }");
    await waitFor("meteor launch", () => evaluate("ball && ball.moving"), 4000);
    await waitFor("lesson 1 result", () =>
      evaluate(
        "!!onboarding && onboarding.panelVisible !== false && !ball.moving",
      ),
    );
    const next = await evaluate(`(() => {
      const labels = [...document.querySelectorAll("button")].map((b) => b.textContent.trim());
      for (const want of ["다음 · 궤도 전환", "괜찮아요, 다음으로"])
        if (labels.some((l) => l.includes(want))) return want;
      return null;
    })()`);
    if (next) {
      await clickButton(next);
      break;
    }
    await clickButton("다시 시도");
  }
  await waitFor("lesson 3 card", () =>
    evaluate("onboarding && onboarding.phase === 1"),
  );
  await clickButton("발사 후 한 번 꺾기");
  await waitFor("practice board", () =>
    evaluate("onboarding && onboarding.panelVisible === false"),
  );
  await delay(250);

  // 발사 전 화면 — 「어디로 가라」고 그려 준 그림.
  const beforeGeom = await evaluate(`(() => {
    const r = steerLessonRouteTarget();
    return { ball: { x: Math.round(ball.x), y: Math.round(ball.y) },
             route: { x: Math.round(r.x), y: Math.round(r.y), r: r.r },
             boss: { x: Math.round(boss.x), y: Math.round(boss.y) },
             launchY: typeof LAUNCH_Y !== 'undefined' ? LAUNCH_Y : null,
             fraction: TEACH_STEER_ROUTE_FRACTION };
  })()`);
  const aimShot = await shoot("steer-aim.png");

  await dragShot("steerLessonRouteTarget()");
  /* 멈출 자리 표식이 «날아가는 동안» 보이는지가 이 수정의 전부다. 정지한
     프레임만 찍으면 표식이 그때 생긴 것인지 미리 있던 것인지 알 수 없다. */
  await waitFor(
    "mid flight",
    () =>
      evaluate(
        "!!(ball && ball.moving && ball.y > steerLessonHoldPoint().y + 90)",
      ),
    6000,
  );
  const midFlight = await evaluate(`(() => {
    const h = steerLessonHoldPoint();
    return { ball: { x: Math.round(ball.x), y: Math.round(ball.y) },
             holdPoint: { x: Math.round(h.x), y: Math.round(h.y) },
             toGoPx: Math.round(Math.hypot(h.x - ball.x, h.y - ball.y)) };
  })()`);
  const flightShot = await shoot("steer-flight.png");
  // 판이 실제로 멈춘 프레임을 잡는다.
  await waitFor(
    "teaching hold",
    () => evaluate("!!(onboarding && onboarding.hold)"),
    15000,
  );
  const held = await evaluate(`(() => {
    const r = steerLessonRouteTarget();
    const total = Math.hypot(r.x - 360, r.y - LAUNCH_Y);
    const gone = Math.hypot(ball.x - 360, ball.y - LAUNCH_Y);
    const rect = document.querySelector('#game').getBoundingClientRect();
    const toCss = (bx, by) => ({
      x: Math.round(rect.left + bx * rect.width / 720),
      y: Math.round(rect.top + by * rect.height / 900),
    });
    return {
      ball: { x: Math.round(ball.x), y: Math.round(ball.y) },
      route: { x: Math.round(r.x), y: Math.round(r.y), r: r.r },
      // 화면에서 «눈으로 보이는» 남은 거리. 판정은 y만 쓰지만 사람은 거리를 본다.
      remainingPx: Math.round(Math.hypot(r.x - ball.x, r.y - ball.y)),
      remainingRingRadii: +(Math.hypot(r.x - ball.x, r.y - ball.y) / r.r).toFixed(1),
      routeProgressPct: Math.round((gone / total) * 100),
      yProgressPct: Math.round(((LAUNCH_Y - ball.y) / (LAUNCH_Y - r.y)) * 100),
      canvasRect: { w: Math.round(rect.width), h: Math.round(rect.height),
                    left: Math.round(rect.left), top: Math.round(rect.top) },
      ballCss: toCss(ball.x, ball.y),
      routeCss: toCss(r.x, r.y),
      holdKind: onboarding.hold.kind,
    };
  })()`);
  const holdShot = await shoot("steer-hold.png");
  const boardShot = await shoot("steer-board.png", {
    x: held.canvasRect.left,
    y: held.canvasRect.top,
    width: held.canvasRect.w,
    height: held.canvasRect.h,
  });

  console.log(
    JSON.stringify(
      {
        beforeLaunch: beforeGeom,
        midFlight,
        atHold: held,
        sfxByCue: await evaluate(
          "JSON.parse(JSON.stringify(window.__sfx || {}))",
        ),
        // 표식과 정지 지점이 같은가. 이것이 어긋나면 「도착 전에 멈춤」이 다시 산다.
        stoppedOnMarker:
          Math.hypot(
            held.ball.x - midFlight.holdPoint.x,
            held.ball.y - midFlight.holdPoint.y,
          ) < 18,
        shots: { aimShot, flightShot, holdShot, boardShot },
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

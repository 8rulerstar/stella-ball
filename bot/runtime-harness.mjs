/**
 * Runtime balance harness for the current Stella Ball combat scripts.
 *
 * This is deliberately not another physics approximation. It loads the game's
 * own combat runtime - the same files, in the same order - in a VM with inert
 * DOM/canvas/audio substitutes, then advances `update`, `updateSpecial`, and
 * `updateFeedback` at a fixed step. Rendering and browser timing remain outside
 * its scope, and so do the screen, boot and presentation files; see the note on
 * `runtimeFiles` for which ones and why.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import vm from "node:vm";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
/* 이것은 HTML이 싣는 21개의 부분집합이다 — 화면·부팅·연출·계기만 빠진다.
 *
 *   빠진 것: game-onboarding / game-arena-carve / game-bootstrap (화면과 부팅),
 *            game-speech / game-awaken-fx (연출),
 *            game-perfwatch (손으로 켜는 계기 — 상태를 읽기만 하고 게임
 *            상태를 쓰지 않는다. ARCHITECTURE.md의 분류와 같다)
 *
 * 연출 둘은 훅으로만 붙고 이 목록의 어떤 파일도 그 이름을 부르지 않으므로
 * 빼도 오류가 나지 않는다. `game-awaken-fx`가 `impactStop`·`screenShake`를
 * 쓰기는 하지만, 그 둘을 소비하는 것은 `loop()`이고 하니스는 `loop()`를 거치지
 * 않고 고정 dt로 update 계열을 직접 부르므로 측정값이 달라지지 않는다.
 *
 * game-figure-cinematics도 뺀다 — 별자리 캐스트 연출이고 판정·피해는 전부
 * 기존 FIGURE_ABILITIES가 낸다. 더 중요한 이유가 있다: 그 파일은 파티클과
 * 별빛비에 Math.random을 스무 곳 넘게 쓰는데, 이 하니스의 시드 재현성은
 * 「난수를 aimSigma 한 곳에서만 쓴다」는 전제 위에 있다(BOT_REPORT 0-3·0-7).
 * 여기 넣으면 그 전제가 깨져 과거 리포트와 비교가 불가능해진다.
 * 그래서 그 파일의 CINE.orionKnock(유성을 실제로 밀어내는 유일한 항목)은
 * false로 반입했다. true로 켜려면 그 난수 문제를 먼저 풀어야 한다.
 *
 * 새 파일을 추가할 때 판단 기준: 피해·충돌·판정에 관여하면 여기 넣고,
 * 화면에만 관여하면 넣지 않는다. 넣지 않기로 했다면 그 이유를 여기 적는다. */
const runtimeFiles = [
  "prototypes/js/game-platform.js",
  "prototypes/js/game-runtime.js",
  "prototypes/js/game-data.js",
  "prototypes/js/game-ui.js",
  "prototypes/js/game-session.js",
  "prototypes/js/game-core-physics.js",
  "prototypes/js/game-core-render.js",
  "prototypes/js/game-meta-state.js",
  "prototypes/js/game-meta.js",
  "prototypes/js/game-combat.js",
  "prototypes/js/game-combat-physics.js",
  "prototypes/js/game-figure-recognition.js",
  "prototypes/js/game-figure.js",
  "prototypes/js/game-feedback.js",
];

const slots = [
  [188, 594],
  [522, 564],
  [188, 352],
  [522, 382],
];
const plainArena = Object.freeze({
  id: "BOT-PLAIN",
  name: "하니스 · 무기믹 전장",
  terrain: "하니스 전용. 기믹 없이 유성, 별지기, 거상만 측정한다.",
  slots,
  preview: slots.map(([x, y]) => [Number((x / 7.2).toFixed(1)), y / 9]),
  // Do not put the colossus above the launch stone: that geometry creates a
  // ceiling ping-pong exploit and would measure the shortcut, not the party.
  boss: { x: 456, y: 282 },
  labels: ["좌하", "우하", "좌상", "우상"],
  bumpers: [],
  gimmicks: {},
});

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function element() {
  const classes = new Set();
  return {
    style: {},
    dataset: {},
    className: "",
    textContent: "",
    innerHTML: "",
    disabled: false,
    children: [],
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
      toggle: (name, force) => {
        const on = force ?? !classes.has(name);
        if (on) classes.add(name);
        else classes.delete(name);
        return on;
      },
    },
    append(...children) {
      this.children.push(...children);
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    remove() {},
    replaceChildren(...children) {
      this.children = children;
    },
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    removeAttribute() {},
    querySelector: () => element(),
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 720, height: 900 }),
    focus() {},
  };
}

function createCanvas() {
  const canvas = element();
  canvas.width = 720;
  canvas.height = 900;
  const context = new Proxy(
    { canvas, imageSmoothingEnabled: false },
    {
      get(target, key) {
        if (key in target) return target[key];
        if (key === "measureText") return () => ({ width: 0 });
        if (key === "getImageData")
          return () => ({ data: new Uint8ClampedArray(4) });
        return () => {};
      },
    },
  );
  canvas.getContext = () => context;
  canvas.setPointerCapture = () => {};
  return canvas;
}

function createContext(seed) {
  const game = createCanvas();
  const nodes = new Map([["#game", game]]);
  const query = (selector) => {
    if (!nodes.has(selector)) nodes.set(selector, element());
    return nodes.get(selector);
  };
  class CanvasRenderingContext2D {}
  class Image {
    set src(value) {
      this._src = value;
    }
    get src() {
      return this._src;
    }
  }
  const random = mulberry32(seed);
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    Math: Object.assign(Object.create(Math), { random }),
    Date,
    JSON,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Array,
    Object,
    Number,
    String,
    Boolean,
    RegExp,
    Promise,
    Error,
    TypeError,
    Uint8ClampedArray,
    CanvasRenderingContext2D,
    Image,
    Audio: class {},
    AudioContext: class {},
    webkitAudioContext: class {},
    navigator: { vibrate() {} },
    performance: { now: () => sandbox.__botClock },
    localStorage: {
      getItem: () => null,
      setItem() {},
      removeItem() {},
    },
    document: {
      hidden: false,
      visibilityState: "visible",
      body: element(),
      fonts: { add() {}, ready: Promise.resolve() },
      querySelector: query,
      querySelectorAll: () => [],
      createElement: (tag) => (tag === "canvas" ? createCanvas() : element()),
      addEventListener() {},
    },
    addEventListener() {},
    removeEventListener() {},
    requestAnimationFrame: () => 0,
    cancelAnimationFrame() {},
    setTimeout: () => 0,
    clearTimeout() {},
    setInterval: () => 0,
    clearInterval() {},
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    URL: { createObjectURL: () => "", revokeObjectURL() {} },
    atob: (value) => Buffer.from(value, "base64").toString("binary"),
    btoa: (value) => Buffer.from(value, "binary").toString("base64"),
    __botClock: 0,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  return vm.createContext(sandbox);
}

const harnessRuntime = `
function __botStart(config) {
  const stage = {
    ...config.arena,
    slots: config.arena.slots.slice(0, config.party.length),
    preview: config.arena.preview.slice(0, config.party.length),
    labels: config.arena.labels.slice(0, config.party.length),
  };
  stages.push(stage);
  stageIndex = stages.length - 1;
  deployed = [...config.party];
  selected = [...config.party];
  resetBuild();
  settings.sfx = 0;
  RULES.coreHp = config.bossHp;
  setupBattle();
  __botMetrics = {
    parries: 0,
    lateParries: 0,
    constellations: 0,
    maxNodes: 0,
    directBossHits: 0,
    openingDirectHits: 0,
    unroutedBossHits: 0,
    directBossDamage: 0,
    steers: 0,
    guideStarsAtStart: battle.guideStarCharges || 0,
  };
  const originalResolve = resolveMeteorParryContact;
  resolveMeteorParryContact = function (g, contact) {
    if (contact && currentFigureShot().contact === null) __botMetrics.parries += 1;
    return originalResolve(g, contact);
  };
  const originalFigure = resolveFigure;
  resolveFigure = function (points) {
    __botMetrics.constellations += 1;
    return originalFigure(points);
  };
  const originalDamage = damage;
  damage = function (weak) {
    const opening = ball.openingBossContact;
    const unrouted = !ball.starkeeperTouched;
    const before = boss.hp;
    __botMetrics.directBossHits += 1;
    if (opening) __botMetrics.openingDirectHits += 1;
    if (unrouted) __botMetrics.unroutedBossHits += 1;
    const result = originalDamage(weak);
    __botMetrics.directBossDamage += Math.max(0, before - boss.hp);
    return result;
  };
}
// 이 봇은 오랫동안 billiardAim을 한 번도 부르지 않았다. 각도를 그대로 속도로
// 바꿔 언제나 최대 위력 1725로만 쐈으므로, 조준 보정도 위력 곡선도 하니스에
// 한 번도 걸린 적이 없다 - 그 두 가지를 바꾼 뒤 스윕이 그대로라는 사실은
// 「밸런스가 안 변했다」가 아니라 「측정되지 않았다」는 뜻이었다.
// aimPath를 켜면 사람이 끄는 것과 같은 경로(보정 포함)를 타고, launchForce로
// 위력을 고를 수 있다. 기본값은 예전 그대로라 과거 리포트와 비교가 유지된다.
// (VM 템플릿 문자열 안이라 백틱을 쓰지 않는다.)
function __botLaunch(angle, config) {
  let ux = Math.cos(angle), uy = Math.sin(angle);
  if (config && config.aimPath) {
    const aim = billiardAim(ux, uy);
    ux = aim.x;
    uy = aim.y;
  }
  const force = config && typeof config.launchForce === "number" ? config.launchForce : 1;
  const speed = 750 + force * 975;
  ball.vx = ux * speed;
  ball.vy = uy * speed;
  ball.moving = true;
  ball.steerUsed = false;
  ball.steerFlash = 0;
  ball.firstImpact = null;
  ball.starkeeperTouched = false;
  ball.openingBossContact = false;
  battle.shots -= 1;
  chain = [];
}
function __botAngle(mode, shot, spread) {
  if (mode === "chain") return __botChainAngle(spread);
  const targets = mode === "direct" ? [boss] : gates;
  const target = targets[shot % targets.length] || boss;
  return Math.atan2(target.y - ball.y, target.x - ball.x) + spread;
}
/* 'contact'는 게이트 하나를 직선으로 노리고 끝이라 한 샷에 접점이 2개를
   넘지 못한다. 별자리는 3개가 있어야 발동하므로 그 정책으로는 이 게임의
   간판 기믹이 한 번도 측정되지 않는다.

   'chain'은 후보 각도를 훑어 별지기를 가장 많이 스치는 방향을 고른다.
   물리를 다시 풀지 않고 직선 경로와 각 별지기의 최단 거리만 본다 —
   벽 반사 뒤의 경로는 무시하므로 상한이 아니라 하한이다. */
function __botChainAngle(spread) {
  const reach = ball.r + 26;
  let best = null;
  for (let step = 0; step < 96; step++) {
    const angle = (step / 96) * Math.PI * 2;
    const dx = Math.cos(angle),
      dy = Math.sin(angle);
    let grazed = 0,
      nearest = Infinity;
    for (const gate of gates) {
      const gx = gate.x - ball.x,
        gy = gate.y - ball.y;
      const along = gx * dx + gy * dy;
      if (along <= 0) continue; // 뒤쪽은 세지 않는다
      const offset = Math.abs(gx * dy - gy * dx);
      if (offset < gate.r + reach) {
        grazed += 1;
        nearest = Math.min(nearest, along);
      }
    }
    // 스치는 별지기가 많은 쪽이 우선, 같으면 첫 접점이 가까운 쪽
    if (
      !best ||
      grazed > best.grazed ||
      (grazed === best.grazed && nearest < best.nearest)
    )
      best = { angle, grazed, nearest };
  }
  return (best ? best.angle : Math.atan2(boss.y - ball.y, boss.x - ball.x)) + spread;
}
/* noParry는 «조준만으로 얼마나 되는가»를 재기 위한 것이다. direct 정책도
   패링을 안 하지만 그쪽은 보스를 직접 겨누므로 별지기 조준 실력과 무관하다.
   조준은 chain/contact 그대로 두고 패링만 끈다. */
function __botTryParry(mode, config) {
  const state = currentFigureShot();
  __botMetrics.maxNodes = Math.max(__botMetrics.maxNodes, state.nodes.length);
  if (mode === "direct" || (config && config.noParry)) return;
  if (state.contact && state.contact.t > 0) {
    if (requestTrainingParry()) __botMetrics.lateParries += 1;
    return;
  }
  if (state.parry > 0 || state.cooldown > 0 || state.nearMiss > 0) return;
  for (const gate of gates) {
    const dx = gate.x - ball.x, dy = gate.y - ball.y;
    const distance = Math.hypot(dx, dy);
    const closing = (ball.vx * dx + ball.vy * dy) / Math.max(distance, 1);
    if (closing > 0 && distance < gate.r + ball.r + 112) {
      requestTrainingParry();
      return;
    }
  }
}
function __botRun(config) {
  __botStart(config);
  const duration = [];
  let shot = 0, frames = 0, shotFrames = 0, longestShotFrames = 0;
  // 샷을 다 썼다는 이유로 루프를 끊으면 마지막 발이 발사 직후 한 프레임만 돌고
  // 버려진다 — 피해도 별자리도 정산되지 않고 그 발의 체공 시간도 기록되지 않아,
  // shots: 5가 실제로는 4발이 된다. 마지막 유성이 멈춘 뒤에 끝낸다.
  // (이 함수는 VM으로 넘기는 템플릿 문자열 안이라 주석에도 백틱을 쓰지 않는다.)
  while (run && !battleComplete && frames < config.frameLimit) {
    if (!ball.moving) {
      if (shot >= config.shots) break;
      // 조준 오차. aimSigma가 있으면 시드된 난수로 매 발 새로 뽑는다 - 고정
      // spread 배열은 (스테이지, 정책)마다 결정론적 경로 하나만 재서 시드를
      // 늘려도 분포가 생기지 않았고, 더 큰 오차가 우연히 더 잘 맞는 비단조도
      // 나왔다. 시그마를 주면 시드마다 다른 손떨림이 되어 클리어율이 실제
      // 난이도 곡선이 된다. spread는 옛 스윕 호환으로 남긴다.
      const jitter =
        typeof config.aimSigma === "number"
          ? (Math.random() * 2 - 1) * config.aimSigma
          : config.spread[shot % config.spread.length];
      // aimOffset은 잡음이 아니라 결정적인 각도 이동이다. 정책이 고른 각을
      // 기준으로 삼고 그 둘레를 훑어 「피해가 각도에 따라 어떻게 변하는가」를
      // 그리는 데 쓴다. 0이면 아무 영향이 없으므로 기존 측정은 그대로다.
      const offset = typeof config.aimOffset === "number" ? config.aimOffset : 0;
      __botLaunch(__botAngle(config.policy, shot, jitter + offset), config);
      shot += 1;
      shotFrames = 0;
    }
    __botTryParry(config.policy, config);
    if (config.steer && ball.moving && !ball.steerUsed && shotFrames === config.steerAt) {
      if (steerMeteor(shot % 2 ? -1 : 1)) __botMetrics.steers += 1;
    }
    update(1 / 60);
    updateSpecial(1 / 60);
    updateFeedback(1 / 60);
    shotFrames += 1;
    frames += 1;
    if (shotFrames > longestShotFrames) longestShotFrames = shotFrames;
    if (!ball.moving && shotFrames) duration.push(shotFrames / 60);
  }
  // frameLimit에 걸려 빠져나온 것과 정상 종료를 구분한다. 예전에는 둘 다
  // 같은 모양의 결과로 나왔고, duration은 유성이 멈춘 프레임에만 쌓이므로
  // 끝나지 않은 샷은 shotDuration에 아예 기록되지 않았다 — 영원히 도는 샷이
  // 지표상으로는 그냥 「클리어 실패」로 보였다.
  // (이 주석도 VM 템플릿 문자열 안이라 백틱을 쓰지 않는다.)
  const stalled = frames >= config.frameLimit && run && !battleComplete;
  return {
    stalled: stalled,
    longestShotSeconds: longestShotFrames / 60,
    framesUsed: frames,
    cleared: boss.hp <= 0,
    remainingHp: Math.round(boss.hp),
    shotsUsed: shot,
    shotDuration: duration,
    maxShotDuration: Math.max(0, ...duration),
    averageShotDuration: duration.length
      ? duration.reduce((sum, value) => sum + value, 0) / duration.length
      : 0,
    guideStarsRemaining: battle.guideStarCharges || 0,
    ...__botMetrics,
  };
}
function __botCampaignRun(config) {
  if (typeof config.guideStarOverride === "number") {
    var src = stages[config.campaignIndex];
    if (src) src.guideStarCharges = config.guideStarOverride;
  }
  const source = stages[config.campaignIndex];
  if (!source || source.training) throw new Error("campaign stage is unavailable");
  // 체력 덮어쓰기는 밸런스 측정용이다. 실제 체력으로 재면 피해가 체력에서
  // 잘려 「몇 대 때릴 수 있었는가」를 알 수 없다 - 클리어한 판은 전부 피해 =
  // 체력으로 보인다. 아주 큰 값을 주면 그 배치에서 5발이 실제로 낼 수 있는
  // 피해 용량이 나오고, 그것이 체력을 정하는 근거가 된다.
  const bossHp = config.bossHpOverride ?? source.bossHp;
  // 리포트가 스스로를 설명하게 스테이지 정체를 함께 돌려준다. 인덱스만으로는
  // 나중에 스테이지가 추가·재배열되면 과거 리포트를 읽을 수 없다.
  return {
    stageId: source.id,
    bossHp,
    ...__botRun({
      ...config,
      arena: { ...source, tutorial: false, bossHp },
      bossHp,
    }),
  };
}
function __botIndividualClaimProbe() {
  progress = {
    ...progress,
    gold: 0,
    pendingGold: 0,
    pendingRewards: [],
    pendingRewardSerial: 0,
  };
  accrueGold(100, "1-2 클리어 보상");
  accrueGold(100, "1-3 클리어 보상");
  const before = pendingRewardEntries();
  const claimed = claimPendingGold(before[0].id);
  const afterOne = pendingRewardEntries();
  progress.pendingGold = 60;
  const legacy = pendingRewardEntries().find(
    (entry) => entry.id === "legacy-pending-gold",
  );
  const legacyClaim = claimPendingGold(legacy.id);
  return {
    before,
    claimed,
    afterOne,
    legacyClaim,
    finalEntries: pendingRewardEntries(),
    gold: progress.gold,
  };
}
function __botArchiveClaimCountProbe() {
  progress = {
    ...progress,
    clears: 0,
    bestCombo: 0,
    bestShots: 99,
    claimedAchievements: [],
    pendingGold: 0,
    pendingRewards: [],
  };
  return {
    archiveClaims: claimCount(),
    attendanceReady: attendanceReady(),
  };
}
function __botSteerProbe(config, side) {
  __botStart(config);
  ball.vx = 1000;
  ball.vy = 0;
  ball.moving = true;
  ball.steerUsed = false;
  const firstUse = steerMeteor(side);
  const lateralVelocity = ball.vy;
  const secondUse = steerMeteor(-side);
  return { firstUse, secondUse, lateralVelocity };
}
// 조준 전달 함수를 실제 런타임에서 잰다. 마우스 x를 한 픽셀씩 쓸면서 실제
// cuePull + billiardAim이 내놓는 발사각을 기록한다 - 재구현하면 보정 원뿔과
// 4.8배 세로 과장이 미묘하게 어긋나므로 반드시 진짜 함수를 부른다.
// (VM 템플릿 문자열 안이라 백틱을 쓰지 않는다.)
/* 「패링할 때 렉이 걸린다」 제보를 가르는 계측. impactStop > 0인 프레임은
   update()가 통째로 건너뛰므로 판이 실제로 언다 — 화면에서는 렉과 구별되지
   않지만 원인은 정반대다(연출이지 성능이 아니다).
   impact()가 실제로 적는 값을 전투 내내 모아, 한 번에 몇 ms를 세우는지와
   한 판에서 언 시간이 총 얼마인지를 낸다. 프로파일러가 브라우저에서 잰
   것은 합성 접촉 한 종류뿐이라, 연타·페이즈 배수가 얹힌 실제 값은 여기서만
   보인다. (VM 템플릿 문자열 안이라 백틱을 쓰지 않는다.)
*/
/* 「운의 띠」를 좁히는 후보를 게임 코드를 고치기 전에 재기 위한 실험대다.
   p90/p10 비율은 배수에 대해 불변이므로, 배수를 올리거나 내려서는 띠가
   움직이지 않는다. 비율을 움직이는 것은 둘뿐이다 — 바닥을 가산으로 올리거나
   천장을 상한으로 자르거나.
     - cap: 단일 타격의 피해를 C로 자른다. p90을 내린다.
     - floor: 한 발이 F보다 적게 넣었으면 그 차이를 채운다. p10을 올린다.
   보스 피해는 전부 applyBossHit 한 곳을 지나므로 그 통로만 감싸면 된다.
   (VM 템플릿 문자열 안이라 백틱을 쓰지 않는다.) */
var __botFloorAudit = [];
function __botBandRun(config) {
  __botFloorAudit = [];
  var cap = config.leverCap > 0 ? config.leverCap : 0;
  var floor = config.leverFloor > 0 ? config.leverFloor : 0;
  var origHit = applyBossHit;
  if (cap > 0) {
    applyBossHit = function (amount) {
      return origHit(amount > cap ? cap : amount);
    };
  }
  var offs = [];
  var atLaunch = 0;
  /* afterMeteorLaunch는 사람의 드래그 경로(billiardPointerUp)에서만 발화한다.
     봇은 __botLaunch로 속도를 직접 넣으므로 그 훅에 걸리지 않는다 — 처음에
     그걸 놓쳐 스냅샷이 0으로 남았고, 차액이 보스 체력만큼 벌어져 한 발에
     판이 끝났다. 봇의 발사 지점을 직접 감싼다. */
  var origLaunch = __botLaunch;
  /* ball.starkeeperTouched는 정산 중(game-combat.js:1452)에 false로 돌아가므로
     afterShotEnd에서 읽으면 언제나 「안 닿았다」로 나온다 — 처음 이렇게 재서
     접촉 조건이 아무 효과도 없는 것처럼 보였다. 프레임마다 걸어 둔다. */
  var latched = false;
  var origUpdateB = update;
  if (floor > 0) {
    update = function () {
      var out = origUpdateB.apply(null, arguments);
      if (ball && (ball.starkeeperTouched || ball.openingBossContact)) latched = true;
      return out;
    };
    __botLaunch = function () {
      atLaunch = boss ? boss.hp : 0;
      latched = false;
      return origLaunch.apply(null, arguments);
    };
    offs.push(
      registerRuntimeHook('afterShotEnd', function () {
        if (!boss || battleComplete || !atLaunch) return;
        /* 헛발까지 채우면 빗나감이 빗나감이 아니게 된다. needsContact를 켜면
           별지기를 스쳤거나 보스에 닿은 발만 채운다 — 「연결은 됐는데 운이
           나빴던 발」만 구제하고, 아무것도 못 맞힌 발은 그대로 둔다. */
        var touched = latched;
        __botFloorAudit.push({ touched: !!touched, dealt: atLaunch - boss.hp });
        if (config.leverFloorNeedsContact && !touched) {
          atLaunch = 0;
          return;
        }
        var dealt = atLaunch - boss.hp;
        if (dealt < floor) origHit(floor - dealt);
        atLaunch = 0;
      }),
    );
  }
  var run = __botCampaignRun(config);
  run.floorAudit = __botFloorAudit.slice();
  applyBossHit = origHit;
  __botLaunch = origLaunch;
  update = origUpdateB;
  for (var i = 0; i < offs.length; i++)
    if (typeof offs[i] === 'function') offs[i]();
  return run;
}
/* 「패링을 유닛마다 다른 키에 배정하면 칠 수 있는가」를 재는 계측.
   키를 고르려면 «어느 별지기가 다음인지 알아본 뒤 누를» 시간이 필요하다.
   패링 가능 구간에 들어오는 순간들을 프레임으로 적어, 연속한 두 기회 사이가
   얼마나 벌어지는지 낸다. 간격이 짧으면 키 선택은 반사가 아니라 운이 된다.
   (VM 템플릿 문자열 안이라 백틱을 쓰지 않는다.) */
function __botParryWindowProbe(config) {
  var events = [];
  var inRange = {};
  var frame = 0;
  var origUpdate = update;
  update = function () {
    var out = origUpdate.apply(null, arguments);
    frame += 1;
    if (ball && ball.moving)
      for (var i = 0; i < gates.length; i++) {
        var g = gates[i];
        var dx = g.x - ball.x, dy = g.y - ball.y;
        var d = Math.hypot(dx, dy);
        var closing = (ball.vx * dx + ball.vy * dy) / Math.max(d, 1);
        var near = closing > 0 && d < g.r + ball.r + 112;
        if (near && !inRange[i]) events.push({ slot: i, frame: frame });
        inRange[i] = near;
      }
    return out;
  };
  var run = __botCampaignRun(config);
  update = origUpdate;
  var gaps = [];
  var sameSlot = 0;
  for (var k = 1; k < events.length; k++) {
    gaps.push(events[k].frame - events[k - 1].frame);
    if (events[k].slot === events[k - 1].slot) sameSlot += 1;
  }
  return {
    stageId: run.stageId,
    기회수: events.length,
    간격프레임: gaps,
    직전과_같은_별지기: sameSlot,
  };
}
/* 「닿고도 일을 못 한 발」의 원인을 가른다. 저조한 발이 헛발이 아니라는 것은
   이미 알고 있다(피해 100 미만의 78%가 접촉). 그렇다면 닿은 «뒤»에 무슨 일이
   있었는지가 남는다 — 속도를 잃었는가, 아니면 살아 있는데도 아무것도 못
   만났는가. 앞이면 관성이 원인이고 뒤면 배치가 원인이다.
   샷마다 첫 접촉 직후 속도와 그 뒤의 접촉 횟수를 적는다.
   (VM 템플릿 문자열 안이라 백틱을 쓰지 않는다.) */
function __botWeakShotProbe(config) {
  var shots = [];
  var cur = null;
  var origLaunch = __botLaunch;
  var origUpdate = update;
  var touching = {};
  __botLaunch = function () {
    if (cur) shots.push(cur);
    cur = { hpAt: boss ? boss.hp : 0, contacts: 0, speedAfterFirst: null, firstAt: 0, frames: 0 };
    return origLaunch.apply(null, arguments);
  };
  update = function () {
    var out = origUpdate.apply(null, arguments);
    if (!cur || !ball) return out;
    cur.frames += 1;
    for (var i = 0; i < gates.length; i++) {
      var g = gates[i];
      var d = Math.hypot(g.x - ball.x, g.y - ball.y);
      var near = d < g.r + ball.r + 4;
      if (near && !touching[i]) {
        cur.contacts += 1;
        if (cur.speedAfterFirst === null) {
          cur.speedAfterFirst = Math.round(Math.hypot(ball.vx, ball.vy));
          cur.firstAt = cur.frames;
        }
      }
      touching[i] = near;
    }
    return out;
  };
  var run = __botCampaignRun(config);
  if (cur) shots.push(cur);
  __botLaunch = origLaunch;
  update = origUpdate;
  for (var k = 0; k < shots.length; k++)
    shots[k].dealt = Math.max(0, shots[k].hpAt - (boss ? boss.hp : 0));
  return { stageId: run.stageId, shots: shots };
}
/* 「너무 많이 튕겨서 조종이 불가능한 것 아닌가」를 세는 계측.
   조준이 결과를 정하려면 발사와 결과 사이에 놓인 사건 수가 적어야 한다 —
   벽 반사가 세 번을 넘어가면 초기 각도의 오차가 기하급수로 벌어져, 조준이
   아무리 정확해도 도착점이 달라진다. 샷마다 벽 반사·별지기 접촉 수와
   비행 시간을 적는다. (VM 템플릿 문자열 안이라 백틱을 쓰지 않는다.) */
function __botBounceProbe(config) {
  var shots = [];
  var cur = null;
  var origLaunch = __botLaunch;
  var origUpdate = update;
  var prevVx = 0, prevVy = 0, touching = {};
  __botLaunch = function () {
    if (cur) shots.push(cur);
    cur = { walls: 0, units: 0, frames: 0 };
    prevVx = 0; prevVy = 0;
    return origLaunch.apply(null, arguments);
  };
  update = function () {
    var out = origUpdate.apply(null, arguments);
    if (!cur || !ball) return out;
    if (ball.moving) {
      cur.frames += 1;
      // 벽 반사는 속도 성분의 «부호»가 뒤집히는 것으로 잡는다.
      if (prevVx !== 0 && Math.sign(ball.vx) !== Math.sign(prevVx) && Math.abs(ball.vx) > 40) cur.walls += 1;
      if (prevVy !== 0 && Math.sign(ball.vy) !== Math.sign(prevVy) && Math.abs(ball.vy) > 40) cur.walls += 1;
      prevVx = ball.vx; prevVy = ball.vy;
      for (var i = 0; i < gates.length; i++) {
        var g = gates[i];
        var near = Math.hypot(g.x - ball.x, g.y - ball.y) < g.r + ball.r + 4;
        if (near && !touching[i]) cur.units += 1;
        touching[i] = near;
      }
    }
    return out;
  };
  var run = __botCampaignRun(config);
  if (cur) shots.push(cur);
  __botLaunch = origLaunch;
  update = origUpdate;
  return { stageId: run.stageId, shots: shots };
}
/* 「어느 별지기와 패링했는지의 순열」이 실제로 어떤 모양인지 본다.
   a-b-a-a-c처럼 섞이면 외우는 재미가 되지만, a-a-a처럼 한 명만 반복되면
   외울 것이 없고, 길이가 2 이하면 애초에 문제가 성립하지 않는다.
   샷마다 접촉한 별지기의 인덱스를 순서대로 적는다.
   (VM 템플릿 문자열 안이라 백틱을 쓰지 않는다.) */
function __botSeqProbe(config) {
  var seqs = [];
  var cur = null;
  var origLaunch = __botLaunch;
  var origUpdate = update;
  var touching = {};
  __botLaunch = function () {
    if (cur) seqs.push(cur);
    cur = [];
    return origLaunch.apply(null, arguments);
  };
  update = function () {
    var out = origUpdate.apply(null, arguments);
    if (!cur || !ball || !ball.moving) return out;
    for (var i = 0; i < gates.length; i++) {
      var g = gates[i];
      var near = Math.hypot(g.x - ball.x, g.y - ball.y) < g.r + ball.r + 4;
      if (near && !touching[i]) cur.push(i);
      touching[i] = near;
    }
    return out;
  };
  var run = __botCampaignRun(config);
  if (cur) seqs.push(cur);
  __botLaunch = origLaunch;
  update = origUpdate;
  return { stageId: run.stageId, seqs: seqs };
}
/* 「첫 접촉을 조준으로 고를 수 있는가」. 이것이 참이라야 판이 패링 기회
   생성기로 축소되지 않는다 — 어느 별지기를 «먼저» 칠지가 공간적 선택으로
   남기 때문이다. 조준각을 조금씩 돌리며 첫 접촉 상대가 누구인지 적는다.
   같은 상대가 넓은 각도 구간에서 이어지면 고를 수 있는 것이고, 한 도씩
   바뀌면 고를 수 없는 것이다. (VM 템플릿이라 백틱을 쓰지 않는다.) */
function __botFirstHitProbe(config) {
  var first = -1;
  var origUpdate = update;
  var touching = {};
  update = function () {
    var out = origUpdate.apply(null, arguments);
    if (first < 0 && ball && ball.moving)
      for (var i = 0; i < gates.length; i++) {
        var near = Math.hypot(gates[i].x - ball.x, gates[i].y - ball.y) < gates[i].r + ball.r + 4;
        if (near && !touching[i]) { first = i; break; }
        touching[i] = near;
      }
    return out;
  };
  var run = __botCampaignRun(config);
  update = origUpdate;
  return { first: first, stageId: run.stageId };
}
/* 「두께」를 조절할 수 있는가. 당구의 실력은 어느 공을 치느냐가 아니라
   얼마나 두껍게 맞히느냐인데, 이 게임은 지금 접촉 여부만 본다.
   첫 접촉 순간에 별지기 중심에서 진행선까지의 수직 거리(충돌 매개변수)를
   잰다. 조준을 조금 돌렸을 때 이 값이 «부드럽게» 옮겨가면 두께를 조절할
   수 있는 것이고, 계단처럼 튀거나 늘 0에 붙으면 조절할 수 없는 것이다.
   조준 보정은 aimPath로 켜고 끈다 — 보정이 두께를 뭉개는지 함께 본다.
   (VM 템플릿이라 백틱을 쓰지 않는다.) */
function __botThicknessProbe(config) {
  var res = { slot: -1, offset: null, radius: 0 };
  var origUpdate = update;
  var touching = {};
  update = function () {
    var out = origUpdate.apply(null, arguments);
    if (res.offset === null && ball && ball.moving)
      for (var i = 0; i < gates.length; i++) {
        var g = gates[i];
        var d = Math.hypot(g.x - ball.x, g.y - ball.y);
        var near = d < g.r + ball.r + 4;
        if (near && !touching[i]) {
          var sp = Math.hypot(ball.vx, ball.vy) || 1;
          var ux = ball.vx / sp, uy = ball.vy / sp;
          var gx = g.x - ball.x, gy = g.y - ball.y;
          // 진행 방향에 대한 수직 성분 = 충돌 매개변수(부호 포함)
          res.offset = Math.round(gx * uy - gy * ux);
          res.slot = i;
          res.radius = Math.round(g.r + ball.r);
          break;
        }
        touching[i] = near;
      }
    return out;
  };
  __botCampaignRun(config);
  update = origUpdate;
  return res;
}
var __botStopFrame = 0;
function __botStopProbe(config) {
  var stops = [];
  /* 정지가 «몇 프레임 간격으로» 오는지도 같이 본다. 피니셔는 이미 발수로
     나누는데 heavy는 안 나눈다 — 만약 heavy도 몰려서 온다면 같은 처방이
     필요하고, 흩어져서 온다면 나눌 이유가 없다. 프레임 번호를 함께 적어
     연속한 두 정지의 간격을 낸다. */
  var origUpdate = update;
  update = function () {
    __botStopFrame += 1;
    return origUpdate.apply(null, arguments);
  };
  var origImpact = impact;
  impact = function () {
    var before = typeof impactStop === 'number' ? impactStop : 0;
    var out = origImpact.apply(null, arguments);
    var after = typeof impactStop === 'number' ? impactStop : 0;
    if (after > before) stops.push({ ms: +(after * 1000).toFixed(1), profile: arguments[3] || 'default', frame: __botStopFrame });
    return out;
  };
  var run = __botCampaignRun(config);
  impact = origImpact;
  update = origUpdate;
  var gaps = [];
  for (var i = 1; i < stops.length; i++) gaps.push(stops[i].frame - stops[i - 1].frame);
  var ms = stops.map(function (s) { return s.ms; }).sort(function (a, b) { return a - b; });
  var byProfile = {};
  stops.forEach(function (s) {
    byProfile[s.profile] = byProfile[s.profile] || { n: 0, total: 0, max: 0 };
    byProfile[s.profile].n += 1;
    byProfile[s.profile].total += s.ms;
    byProfile[s.profile].max = Math.max(byProfile[s.profile].max, s.ms);
  });
  return {
    stageId: run.stageId,
    cleared: run.cleared,
    battleSeconds: +(run.framesUsed / 60).toFixed(1),
    events: ms.length,
    medianMs: ms.length ? ms[Math.floor(ms.length / 2)] : 0,
    p90Ms: ms.length ? ms[Math.floor(ms.length * 0.9)] : 0,
    maxMs: ms.length ? ms[ms.length - 1] : 0,
    frozenTotalMs: +ms.reduce(function (a, b) { return a + b; }, 0).toFixed(0),
    // 연속한 두 정지 사이의 프레임 수. 6프레임(0.1초) 이내면 «몰려서 온다».
    gapFrames: gaps,
    clustered: gaps.filter(function (g) { return g <= 6; }).length,
    byProfile: byProfile,
  };
}
function __botAimProbe(config, pullDown) {
  const source = stages[config.campaignIndex];
  if (!source || source.training) throw new Error("campaign stage is unavailable");
  __botStart({
    ...config,
    arena: { ...source, tutorial: false, bossHp: source.bossHp },
    bossHp: source.bossHp,
  });
  const samples = [];
  const originX = ball.x, originY = ball.y;
  for (let px = originX - 340; px <= originX + 340; px += 1) {
    const raw = { x: px, y: originY + pullDown };
    const pull = cuePull(raw);
    const dx = originX - pull.x, dy = originY - pull.y;
    const len = Math.hypot(dx, dy);
    if (len < 18) continue;
    const aim = billiardAim(dx, dy);
    // 위력은 발사 경로와 같은 식이어야 한다 - 끈 거리 기준이다.
    const pullLength = Math.hypot(originX - raw.x, originY - raw.y);
    samples.push({
      px: px - originX,
      deg: Math.atan2(aim.y, aim.x) * 180 / Math.PI,
      assisted: Boolean(aim.assisted),
      force: Math.min(1, Math.max(0.28, pullLength / 220)),
    });
  }
  return {
    pullDown,
    ballX: originX,
    ballY: originY,
    gateCount: gates.length,
    bumperCount: bumpers.length,
    samples,
  };
}
// 정확한 수직 발사가 축퇴 루프로 굳는지 본다. 튜토리얼 패링 수업이 실제로
// 만드는 상황(발사석과 목표의 x가 같음)을 그대로 재현한다.
// (VM 템플릿 문자열 안이라 백틱을 쓰지 않는다.)
function __botAxisLockProbe(config) {
  const source = stages[config.campaignIndex];
  __botStart({
    ...config,
    arena: { ...source, tutorial: false, bossHp: 999999999 },
    bossHp: 999999999,
  });
  ball.vx = 0;
  ball.vy = -1725;
  ball.moving = true;
  ball.steerUsed = false;
  let frames = 0, everOffAxis = false, firstOffAxisFrame = -1, maxRatio = 0;
  while (ball.moving && frames < 3600) {
    update(1 / 60);
    frames += 1;
    const speed = Math.hypot(ball.vx, ball.vy) || 1;
    const ratio = Math.abs(ball.vx) / speed;
    if (ratio > maxRatio) maxRatio = ratio;
    if (ratio > 0.02 && !everOffAxis) {
      everOffAxis = true;
      firstOffAxisFrame = frames;
    }
  }
  return {
    shotSeconds: frames / 60,
    endedNaturally: !ball.moving,
    everOffAxis,
    firstOffAxisSeconds: firstOffAxisFrame < 0 ? null : firstOffAxisFrame / 60,
    maxLateralRatio: maxRatio,
  };
}
function __botRuntimeModuleProbe() {
  const priorityOrder = [];
  const removeLow = registerRuntimeHook(
    "afterBattleSetup",
    () => priorityOrder.push("low"),
    { priority: 0 },
  );
  const removeHigh = registerRuntimeHook(
    "afterBattleSetup",
    () => priorityOrder.push("high"),
    { priority: 100 },
  );
  runRuntimeHooks("afterBattleSetup", {});
  removeLow();
  removeHigh();

  let unknownHookRejected = false;
  try {
    registerRuntimeHook("not-a-runtime-hook", () => {});
  } catch {
    unknownHookRejected = true;
  }

  let duplicateModuleRejected = false;
  try {
    StellaRuntime.modules.register("combat", {});
  } catch {
    duplicateModuleRejected = true;
  }

  return {
    version: StellaRuntime.version,
    modules: StellaRuntime.modules.list(),
    combatApiFrozen: Object.isFrozen(StellaRuntime.modules.require("combat")),
    figureApiFrozen: Object.isFrozen(StellaRuntime.modules.require("figure")),
    renderApiFrozen: Object.isFrozen(StellaRuntime.modules.require("render")),
    priorityOrder,
    unknownHookRejected,
    duplicateModuleRejected,
  };
}
function __botDeferredFigureProbe(config) {
  __botStart(config);
  battle.shots = 0;
  ball.moving = true;
  figureFx = {
    battle,
    ring: [{}, {}, {}],
    rune: false,
    cast: function () {
      if (config.outcome === "kill") {
        boss.hp = 0;
        scheduleWin();
      } else if (config.outcome === "refund") battle.shots += 1;
    },
    t: FIGURE_CAST_AT,
  };
  endShot();
  const beforeCast = {
    run,
    battleComplete,
    pending: isFigureResolutionPending(),
    deferred: typeof figureFx?.afterCast === "function",
    shots: battle.shots,
  };
  runRuntimeHooks("afterFeedbackUpdate", 0);
  return {
    beforeCast,
    afterCast: {
      run,
      battleComplete,
      pending: isFigureResolutionPending(),
      shots: battle.shots,
      moving: ball.moving,
    },
  };
}
// 한 샷 안에서 궤적이 «언제» 갈라지는가. 같은 판, 같은 정책각에 angleOffset만
// 아주 작게 얹어 두 번 돌리고 프레임별 위치를 그대로 돌려준다. 발산 계산은
// Node 쪽에서 한다 — VM 호출 하나가 한 궤적이라 상태가 섞이지 않는다.
// 접촉 수를 함께 싣는다. 벽/범퍼는 ball.bounces가 세고, 별지기 접촉은
// afterMobilePairCollision 훅으로 센다(mobilePair가 실제로 임펄스를 준
// 경우에만 불린다).
// 별지기와의 충돌이 «읽을 수 있는» 것인가. 당구가 예측 가능한 이유는 맞는
// 공이 «서 있기» 때문이다 — 서 있는 공은 접점 기하만 보면 튀는 방향이 정해진다.
// 여기서는 별지기가 물리 몸이라 스스로 속도를 가질 수 있고, 그 속도는 화면에서
// 읽히지 않는다. 접촉마다 별지기 속도 / 유성 속도를 기록해 「보이지 않는 값이
// 결과에 얼마나 섞이는가」를 잰다. 유성 속도도 함께 싣는다 — 너무 빠르면
// 결정론이어도 사람이 못 쫓는다.
// 별지기에 «질량»을 준다. 지금 mobilePair는 두 몸을 같은 질량으로 놓고
// 법선 성분을 통째로 넘긴다(impulse = along * 0.98) — 그래서 정통으로 맞출수록
// 유성이 서 버린다. k=1이면 현재 식과 완전히 같다(검증: 아래 heroMass 1 행).
//   J = (1 + e) * mu * along,  mu = k / (1 + k),  e = 0.96
//   k=1 -> dv_ball = -0.98 * along * n   (현재 코드와 동일)
// 이 함수는 프로브 전용이다. 런타임 물리에는 넣지 않았다.
function __botInstallHeroMass(k) {
  if (!k || k === 1) return;
  var originalPair = mobilePair;
  mobilePair = function (a, ar, b, br, onHit, kind, massB) {
    var isBallHero =
      (a === ball && gates.indexOf(b) >= 0) || (b === ball && gates.indexOf(a) >= 0);
    if (!isBallHero) return originalPair(a, ar, b, br, onHit, kind, massB);
    var dx = b.x - a.x, dy = b.y - a.y;
    var d = Math.hypot(dx, dy) || 1, reach = ar + br;
    if (d >= reach) return false;
    var nx = dx / d, ny = dy / d, overlap = reach - d;
    a.x -= nx * (overlap * 0.5 + 0.12);
    a.y -= ny * (overlap * 0.5 + 0.12);
    b.x += nx * (overlap * 0.5 + 0.12);
    b.y += ny * (overlap * 0.5 + 0.12);
    var along = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
    if (along <= 0) return true;
    var incoming = { x: a.vx, y: a.vy };
    var mu = k / (1 + k), J = 1.96 * mu * along;
    var heavyIsB = b !== ball;
    var lightImpulse = J, heavyImpulse = J / k;
    if (heavyIsB) {
      a.vx -= lightImpulse * nx; a.vy -= lightImpulse * ny;
      b.vx += heavyImpulse * nx; b.vy += heavyImpulse * ny;
    } else {
      a.vx -= heavyImpulse * nx; a.vy -= heavyImpulse * ny;
      b.vx += lightImpulse * nx; b.vy += lightImpulse * ny;
    }
    onHit && onHit(nx, ny, along, incoming);
    runRuntimeHooks("afterMobilePairCollision", { a: a, b: b, nx: nx, ny: ny, along: along, kind: kind });
    return true;
  };
}
// 조준 가이드가 «진짜»인가. billiardPredict가 그리는 첫 접촉 뒤의 선과,
// 같은 각으로 실제로 쐈을 때 유성이 가는 방향을 비교한다. 물리에 질량을 넣고
// 가이드를 안 고치면 여기가 벌어진다 — 예측 가능하게 만들려던 변경이 오히려
// 가이드를 거짓말로 만드는지 확인하는 자리다.
function __botGuideTruthProbe(config) {
  var source = stages[config.campaignIndex];
  if (!source || source.training) throw new Error("campaign stage is unavailable");
  __botStart({
    ...config,
    arena: { ...source, tutorial: false, bossHp: source.bossHp },
    bossHp: source.bossHp,
  });
  var angle = __botAngle(config.policy, 0, 0) + (config.angleOffset || 0);
  // 가이드는 «당김 벡터»를 받는다. 발사 방향의 반대다.
  var guide = billiardPredict(Math.cos(angle), Math.sin(angle));
  if (!guide.hits.length) return { hit: false };
  var p = guide.points;
  var gx = p[p.length - 1].x - p[p.length - 2].x;
  var gy = p[p.length - 1].y - p[p.length - 2].y;
  // 충돌 «직후» 속도를 훅에서 바로 잡는다. 예전에는 5프레임 뒤를 봤는데,
  // 질량을 올리면 유성이 더 빨라서 그 5프레임 안에 다른 것을 또 맞는다 —
  // 가이드가 나빠진 것처럼 보이던 값의 정체가 그것이었다.
  var contacted = false, vx = 0, vy = 0, hitTarget = null;
  registerRuntimeHook("afterMobilePairCollision", function (payload) {
    if (contacted || !payload) return;
    if (payload.a !== ball && payload.b !== ball) return;
    contacted = true;
    vx = ball.vx;
    vy = ball.vy;
    hitTarget = payload.a === ball ? payload.b : payload.a;
  });
  __botLaunch(angle, config);
  for (var f = 0; f < 900 && ball.moving && !contacted; f++) {
    update(1 / 60);
    updateSpecial(1 / 60);
    updateFeedback(1 / 60);
  }
  if (!contacted) return { hit: false };
  var lg = Math.hypot(gx, gy) || 1, lv = Math.hypot(vx, vy) || 1;
  var dot = (gx * vx + gy * vy) / (lg * lv);
  return {
    hit: true,
    sameTarget: hitTarget === guide.hits[0].target,
    errorDeg: (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI,
  };
}
function __botLegibilityProbe(config) {
  var source = stages[config.campaignIndex];
  if (!source || source.training) throw new Error("campaign stage is unavailable");
  var hits = [];
  var shotNo = 0, inShot = 0;
  __botInstallHeroMass(config.heroMass);
  // 각성 조건은 g.moved && g.travel > 10 이다 — 무거운 별지기는 덜 밀리므로
  // 질량을 올리면 각성이 죽을 수 있다. 샷마다 몇 명이 깼는지 센다.
  var awakened = [];
  registerRuntimeHook("beforePartySettle", function (ctx) {
    awakened.push(ctx.awakened.length);
  });
  // mobilePair를 감싼다. 훅(afterMobilePairCollision)은 임펄스가 «끝난 뒤»에
  // 불리므로 별지기의 충돌 전 속도를 읽을 수 없다 — 처음엔 그걸 재고 있었다.
  var originalPair = mobilePair;
  mobilePair = function (a, ar, b, br, onHit, kind, massB) {
    var other = a === ball ? b : b === ball ? a : null;
    var pre = null;
    if (other) {
      var dx = b.x - a.x, dy = b.y - a.y;
      var d = Math.hypot(dx, dy) || 1;
      if (d < ar + br) {
        var nx = dx / d, ny = dy / d;
        var along = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (along > 0)
          pre = {
            heroSpeed: Math.hypot(other.vx, other.vy),
            ballSpeed: Math.hypot(ball.vx, ball.vy),
            heroNormal: Math.abs(other.vx * nx + other.vy * ny),
            ballNormal: Math.abs(ball.vx * nx + ball.vy * ny),
          };
      }
    }
    var res = originalPair(a, ar, b, br, onHit, kind, massB);
    if (pre) {
      inShot += 1;
      hits.push({
        shot: shotNo,
        nth: inShot,
        heroSpeed: pre.heroSpeed,
        ballSpeed: pre.ballSpeed,
        heroNormal: pre.heroNormal,
        ballNormal: pre.ballNormal,
      });
    }
    return res;
  };
  var originalLaunch = __botLaunch;
  __botLaunch = function (angle, cfg) {
    shotNo += 1;
    inShot = 0;
    return originalLaunch(angle, cfg);
  };
  var hp = config.bossHpOverride != null ? config.bossHpOverride : source.bossHp;
  var result = __botRun({
    ...config,
    arena: { ...source, tutorial: false, bossHp: hp },
    bossHp: hp,
  });
  result.bossHpUsed = hp;
  return { stageId: source.id, hits: hits, awakened: awakened, run: result };
}
function __botTrajectoryProbe(config) {
  var source = stages[config.campaignIndex];
  if (!source || source.training) throw new Error("campaign stage is unavailable");
  __botStart({
    ...config,
    arena: { ...source, tutorial: false, bossHp: source.bossHp },
    bossHp: source.bossHp,
  });
  var heroHits = 0;
  __botInstallHeroMass(config.heroMass);
  registerRuntimeHook("afterMobilePairCollision", function (payload) {
    if (payload && (payload.a === ball || payload.b === ball)) heroHits += 1;
  });
  var angle = __botAngle(config.policy, 0, 0) + (config.angleOffset || 0);
  __botLaunch(angle, config);
  var path = [];
  var frames = 0;
  /* 최댓값으로 잡는다. 마지막 프레임에서 읽으면 안 된다 — 유성이 멈추면
     simulatePhysics가 endShot -> startShot을 부르고 그때 ball.bounces가
     «다음 샷» 기준으로 리셋되므로, 접촉을 7회 한 샷이 2로 돌아온다.
     그 리셋된 값이 경로의 마지막 칸에도 그대로 들어간다. */
  var maxContacts = 0;
  var limit = config.traceFrames || 1800;
  while (ball.moving && frames < limit) {
    if (config.traceParry) __botTryParry(config.policy);
    update(1 / 60);
    updateSpecial(1 / 60);
    updateFeedback(1 / 60);
    var c = (ball.bounces || 0) + heroHits;
    if (c > maxContacts) maxContacts = c;
    path.push([ball.x, ball.y, c, ball.vx, ball.vy]);
    frames += 1;
  }
  return {
    angle: angle,
    frames: frames,
    radius: ball.r,
    /* 마지막 프레임에서 읽으면 안 된다. 유성이 멈추면 simulatePhysics가
       endShot -> startShot을 부르고 그때 ball.bounces가 «다음 샷» 기준으로
       리셋된다 — 접촉을 7회 한 샷이 2로 돌아왔다. 경로에 찍힌 값이 맞다. */
    contacts: maxContacts,
    path: path,
  };
}
`;

function runInRuntime(config, entryPoint = "__botRun") {
  const context = createContext(config.seed);
  for (const file of runtimeFiles) {
    vm.runInContext(readFileSync(resolve(root, file), "utf8"), context, {
      filename: file,
    });
  }
  vm.runInContext(harnessRuntime, context, { filename: "bot-runtime" });
  context.__botConfig = config;
  return vm.runInContext(`${entryPoint}(__botConfig)`, context);
}

export const PARTY_POOLS = Object.freeze({
  2: ["gaon", "biyeon"],
  3: ["gaon", "biyeon", "ria"],
  4: ["gaon", "biyeon", "ria", "taeo"],
});

export function runPlainArena({
  partySize = 3,
  bossHp = 260,
  policy = "contact",
  seed = 1,
  steer = false,
} = {}) {
  const party = PARTY_POOLS[partySize];
  if (!party) throw new Error("partySize must be 2, 3, or 4");
  return runInRuntime({
    arena: plainArena,
    party,
    bossHp,
    policy,
    seed,
    steer,
    shots: 5,
    steerAt: 26,
    frameLimit: 7200,
    spread: [-0.1, -0.04, 0.04, 0.1],
  });
}

export function probeAimSkill({
  campaignIndex = 0,
  policy = "chain",
  seed = 1,
  aimSigma = 0,
  noParry = true,
  bossHpOverride = 999999,
} = {}) {
  return runInRuntime(
    {
      campaignIndex,
      party: PARTY_POOLS[3],
      policy,
      seed,
      steer: false,
      shots: 5,
      steerAt: 26,
      frameLimit: 7200,
      aimSigma,
      spread: [0, 0, 0, 0],
      noParry,
      bossHpOverride,
    },
    "__botCampaignRun.bind(null, __botConfig)",
  );
}

export function probeGuideTruth({
  campaignIndex = 0,
  policy = "chain",
  seed = 1,
  angleOffset = 0,
} = {}) {
  return runInRuntime(
    {
      campaignIndex,
      party: PARTY_POOLS[3],
      policy,
      seed,
      steer: false,
      shots: 1,
      steerAt: 26,
      frameLimit: 7200,
      spread: [0, 0, 0, 0],
      angleOffset,
    },
    "__botGuideTruthProbe.bind(null, __botConfig)",
  );
}

export function probeLegibility({
  campaignIndex = 0,
  policy = "chain",
  seed = 1,
  heroMass = 1,
  aimSigma = 0.08,
  angleOffset = 0,
  noParry = false,
  bossHpOverride = null,
  launchForce = 1,
} = {}) {
  return runInRuntime(
    {
      campaignIndex,
      party: PARTY_POOLS[3],
      policy,
      seed,
      steer: false,
      shots: 5,
      steerAt: 26,
      frameLimit: 7200,
      aimSigma,
      spread: [0, 0, 0, 0],
      heroMass,
      /* __botRun이 읽는 이름은 aimOffset이다. angleOffset으로 넘기면 조용히
         무시돼 「각도를 훑었는데 전부 같은 값」이 나온다. */
      aimOffset: angleOffset,
      noParry,
      bossHpOverride,
      launchForce,
    },
    "__botLegibilityProbe.bind(null, __botConfig)",
  );
}

export function probeTrajectory({
  campaignIndex = 0,
  policy = "chain",
  seed = 1,
  angleOffset = 0,
  traceFrames = 1800,
  traceParry = false,
  heroMass = 1,
} = {}) {
  return runInRuntime(
    {
      campaignIndex,
      party: PARTY_POOLS[3],
      policy,
      seed,
      steer: false,
      shots: 1,
      steerAt: 26,
      frameLimit: 7200,
      spread: [0, 0, 0, 0],
      angleOffset,
      traceFrames,
      traceParry,
      heroMass,
    },
    "__botTrajectoryProbe.bind(null, __botConfig)",
  );
}

export function probeSteerDirection(side) {
  if (side !== -1 && side !== 1) throw new Error("side must be -1 or 1");
  return runInRuntime(
    {
      arena: plainArena,
      party: PARTY_POOLS[2],
      bossHp: 260,
      policy: "direct",
      seed: 1,
      steer: false,
      shots: 1,
      steerAt: 0,
      frameLimit: 1,
      spread: [0],
    },
    `__botSteerProbe.bind(null, __botConfig, ${side})`,
  );
}

/* 조준 해상도 측정. pullDown은 유성 아래로 끈 픽셀 수다. 반환값은 마우스
   가로 위치 1px당 발사각이 어떻게 변하는지의 전체 곡선이라, 불연속(보정
   원뿔 경계에서의 각도 점프)과 도달 가능한 각도 범위를 함께 볼 수 있다. */
export function probeAimTransfer({ campaignIndex = 0, pullDown = 60 } = {}) {
  return runInRuntime(
    {
      campaignIndex,
      party: PARTY_POOLS[3],
      policy: "contact",
      seed: 1,
      steer: false,
      shots: 5,
      steerAt: 26,
      frameLimit: 1,
      aimSigma: 0,
      spread: [0, 0, 0, 0],
    },
    "__botAimProbe.bind(null, __botConfig, " + pullDown + ")",
  );
}

export function probeThickness({
  campaignIndex = 0,
  aimOffset = 0,
  aimPath = false,
} = {}) {
  return runInRuntime(
    {
      campaignIndex,
      party: PARTY_POOLS[3],
      policy: "contact",
      seed: 1,
      steer: false,
      shots: 1,
      steerAt: 26,
      frameLimit: 3600,
      aimSigma: 0,
      aimOffset,
      aimPath,
      spread: [0, 0, 0, 0],
    },
    "__botThicknessProbe.bind(null, __botConfig)",
  );
}

export function probeFirstHit({ campaignIndex = 0, aimOffset = 0 } = {}) {
  return runInRuntime(
    {
      campaignIndex,
      party: PARTY_POOLS[3],
      policy: "contact",
      seed: 1,
      steer: false,
      shots: 1,
      steerAt: 26,
      frameLimit: 3600,
      aimSigma: 0,
      aimOffset,
      spread: [0, 0, 0, 0],
    },
    "__botFirstHitProbe.bind(null, __botConfig)",
  );
}

export function probeSequences({
  campaignIndex = 0,
  policy = "chain",
  aim = "loose",
  seed = 1,
  guideStarCharges = null,
} = {}) {
  return runInRuntime(
    {
      campaignIndex,
      party: PARTY_POOLS[3],
      policy,
      seed,
      steer: false,
      shots: 5,
      steerAt: 26,
      frameLimit: 7200,
      aimSigma: AIM_LADDER[aim],
      spread: [0, 0, 0, 0],
      guideStarOverride: guideStarCharges,
    },
    "__botSeqProbe.bind(null, __botConfig)",
  );
}

export function probeBounces({
  campaignIndex = 0,
  policy = "chain",
  aim = "loose",
  seed = 1,
} = {}) {
  return runInRuntime(
    {
      campaignIndex,
      party: PARTY_POOLS[3],
      policy,
      seed,
      steer: false,
      shots: 5,
      steerAt: 26,
      frameLimit: 7200,
      aimSigma: AIM_LADDER[aim],
      spread: [0, 0, 0, 0],
    },
    "__botBounceProbe.bind(null, __botConfig)",
  );
}

export function probeWeakShots({
  campaignIndex = 0,
  policy = "chain",
  aim = "loose",
  seed = 1,
  bossHpOverride = 999999,
} = {}) {
  return runInRuntime(
    {
      campaignIndex,
      party: PARTY_POOLS[3],
      policy,
      seed,
      steer: false,
      shots: 5,
      steerAt: 26,
      frameLimit: 7200,
      aimSigma: AIM_LADDER[aim],
      spread: [0, 0, 0, 0],
      bossHpOverride,
    },
    "__botWeakShotProbe.bind(null, __botConfig)",
  );
}

export function probeParryWindow({
  campaignIndex = 0,
  policy = "chain",
  aim = "loose",
  seed = 1,
} = {}) {
  return runInRuntime(
    {
      campaignIndex,
      party: PARTY_POOLS[3],
      policy,
      seed,
      steer: false,
      shots: 5,
      steerAt: 26,
      frameLimit: 7200,
      aimSigma: AIM_LADDER[aim],
      spread: [0, 0, 0, 0],
    },
    "__botParryWindowProbe.bind(null, __botConfig)",
  );
}

export function probeBandLever({
  campaignIndex = 0,
  policy = "chain",
  aim = "loose",
  seed = 1,
  leverCap = 0,
  leverFloor = 0,
  leverFloorNeedsContact = false,
  bossHpOverride = null,
} = {}) {
  return runInRuntime(
    {
      campaignIndex,
      party: PARTY_POOLS[3],
      policy,
      seed,
      steer: false,
      shots: 5,
      steerAt: 26,
      frameLimit: 7200,
      aimSigma: AIM_LADDER[aim],
      spread: [0, 0, 0, 0],
      bossHpOverride,
      leverCap,
      leverFloor,
      leverFloorNeedsContact,
    },
    "__botBandRun.bind(null, __botConfig)",
  );
}

export function probeImpactStops({
  campaignIndex = 0,
  policy = "chain",
  aim = "loose",
  seed = 1,
} = {}) {
  return runInRuntime(
    {
      campaignIndex,
      party: PARTY_POOLS[3],
      policy,
      seed,
      steer: false,
      shots: 5,
      steerAt: 26,
      frameLimit: 7200,
      aimSigma: AIM_LADDER[aim],
      spread: [0, 0, 0, 0],
    },
    "__botStopProbe.bind(null, __botConfig)",
  );
}

export function probeAxisLock({ campaignIndex = 0 } = {}) {
  return runInRuntime(
    {
      campaignIndex,
      party: PARTY_POOLS[3],
      policy: "contact",
      seed: 1,
      steer: false,
      shots: 5,
      steerAt: 26,
      frameLimit: 3600,
      aimSigma: 0,
      spread: [0, 0, 0, 0],
    },
    "__botAxisLockProbe.bind(null, __botConfig)",
  );
}

export function probeRuntimeModules() {
  return runInRuntime({ seed: 1 }, "__botRuntimeModuleProbe");
}

/* 조준 정확도 사다리. `spread`는 발사 각도에 더해지는 라디안 오프셋이라, 이
   폭을 키우면 「겨눈 곳에서 빗나가는 사람」을 모사할 수 있다. 시드는 크리티컬
   확률에만 쓰여 변량을 거의 만들지 못하므로(35스테이지 중 33개가 4시드 전부
   같은 결과), 난이도 축으로는 시드가 아니라 이쪽을 쓴다. */
export const AIM_LADDER = Object.freeze({
  precise: 0,
  steady: 0.04,
  loose: 0.1,
  wild: 0.22,
});
export function runCampaignStage({
  campaignIndex = 0,
  partySize = 3,
  policy = "contact",
  seed = 1,
  steer = false,
  aim = "loose",
  bossHpOverride = null,
  aimPath = false,
  launchForce = 1,
  aimOffset = 0,
  shots = 5,
  /* 안내별 충전 수를 덮어쓴다. 스테이지 선언값(대부분 0, 1-2·1-3만 1)을
     바꿔 가며 「패링 한 번이 접점 3개를 만드는 일」을 얼마나 흔하게 둘지
     재기 위한 손잡이다. null이면 스테이지 값을 그대로 쓴다. */
  guideStarCharges = null,
} = {}) {
  const party = PARTY_POOLS[partySize];
  if (!party) throw new Error("partySize must be 2, 3, or 4");
  const aimSigma = AIM_LADDER[aim];
  if (aimSigma === undefined)
    throw new Error("aim must be one of " + Object.keys(AIM_LADDER));
  return runInRuntime(
    {
      campaignIndex,
      party,
      policy,
      seed,
      steer,
      shots,
      steerAt: 26,
      frameLimit: 7200,
      aimSigma,
      bossHpOverride,
      aimPath,
      launchForce,
      aimOffset,
      guideStarOverride: guideStarCharges,
      spread: [0, 0, 0, 0],
    },
    "__botCampaignRun",
  );
}
/* 실제 캠페인 스윕. 무기믹 기준선(sweepPlainArena)이 포화된 뒤로 난이도 신호를
   내는 것은 이쪽뿐이다 — 같은 날 측정에서 기준선은 contact 91.7% / chain 100%인
   반면 실제 35스테이지는 contact 64.3% / chain 77.1%였다. 스테이지마다 진짜
   보스 체력·배치·기믹을 쓰고, 조준 사다리를 축으로 돌려 「어느 정확도부터
   무너지는가」를 스테이지별로 남긴다. */
export function sweepCampaign({
  stageCount = 35,
  policies = ["contact", "chain"],
  aims = ["precise", "steady", "loose", "wild"],
  seeds = [11, 47],
  partySizeFor = (index) => (index === 34 ? 4 : 3),
} = {}) {
  const report = [];
  for (let campaignIndex = 0; campaignIndex < stageCount; campaignIndex++) {
    const partySize = partySizeFor(campaignIndex);
    for (const policy of policies)
      for (const aim of aims)
        for (const seed of seeds)
          report.push({
            campaignIndex,
            partySize,
            policy,
            aim,
            seed,
            ...runCampaignStage({
              campaignIndex,
              partySize,
              policy,
              seed,
              aim,
            }),
          });
  }
  return report;
}

export function probeIndividualClaims() {
  return runInRuntime({ seed: 1 }, "__botIndividualClaimProbe");
}

export function probeArchiveClaimCount() {
  return runInRuntime({ seed: 1 }, "__botArchiveClaimCountProbe");
}

export function probeDeferredFigureResolution(outcome) {
  if (!["kill", "refund", "fail"].includes(outcome))
    throw new Error("outcome must be kill, refund, or fail");
  return runInRuntime(
    {
      arena: plainArena,
      party: PARTY_POOLS[3],
      bossHp: 260,
      policy: "contact",
      seed: 1,
      steer: false,
      shots: 1,
      steerAt: 0,
      frameLimit: 1,
      spread: [0],
      outcome,
    },
    "__botDeferredFigureProbe",
  );
}

export function sweepPlainArena({
  partySizes = [2, 3, 4],
  bossHp = [180, 260, 340, 420],
  seeds = [11, 29, 47, 83],
  // `chain`은 별자리를 실제로 발동시키는 유일한 정책이다. 이게 없으면 이
  // 스윕은 당구 접촉 피해만 재고, 게임의 간판 기믹은 한 번도 타지 않는다.
  policies = ["direct", "contact", "chain"],
  steer = false,
} = {}) {
  const report = [];
  for (const partySize of partySizes)
    for (const hp of bossHp)
      for (const policy of policies)
        for (const seed of seeds)
          report.push({
            partySize,
            bossHp: hp,
            policy,
            steer,
            seed,
            ...runPlainArena({ partySize, bossHp: hp, policy, seed, steer }),
          });
  return report;
}

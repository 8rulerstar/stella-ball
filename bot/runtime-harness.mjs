/**
 * Runtime balance harness for the current Stella Ball combat scripts.
 *
 * This is deliberately not another physics approximation. It loads the same
 * ordered classic-script combat runtime in a VM with inert DOM/canvas/audio
 * substitutes, then advances `update`, `updateSpecial`, and `updateFeedback`
 * at a fixed step. Rendering and browser timing remain outside its scope.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import vm from "node:vm";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
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
function __botLaunch(angle) {
  const speed = 1725;
  ball.vx = Math.cos(angle) * speed;
  ball.vy = Math.sin(angle) * speed;
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
function __botTryParry(mode) {
  const state = currentFigureShot();
  __botMetrics.maxNodes = Math.max(__botMetrics.maxNodes, state.nodes.length);
  if (mode === "direct") return;
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
  let shot = 0, frames = 0, shotFrames = 0;
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
      __botLaunch(__botAngle(config.policy, shot, jitter));
      shot += 1;
      shotFrames = 0;
    }
    __botTryParry(config.policy);
    if (config.steer && ball.moving && !ball.steerUsed && shotFrames === config.steerAt) {
      if (steerMeteor(shot % 2 ? -1 : 1)) __botMetrics.steers += 1;
    }
    update(1 / 60);
    updateSpecial(1 / 60);
    updateFeedback(1 / 60);
    shotFrames += 1;
    frames += 1;
    if (!ball.moving && shotFrames) duration.push(shotFrames / 60);
  }
  return {
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
      shots: 5,
      steerAt: 26,
      frameLimit: 7200,
      aimSigma,
      bossHpOverride,
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

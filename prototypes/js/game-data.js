/**
 * @typedef {{ id: number, shots: number, shotMax: number, startedAt: number, training: boolean, tutorial: boolean, victory?: { t: number, d: number, elapsedMs: number } }} BattleState
 * @typedef {{ x: number, y: number, vx: number, vy: number, r: number, moving: boolean, power: number, trail: Array<{x: number, y: number}> }} MeteorState
 * @typedef {{ phase: number, dialogue: number, contacts: Set<string>, bossHit: boolean, launched: boolean, replay: boolean }} OnboardingState
 */

const c = document.querySelector("#game"),
  x = c.getContext("2d"),
  W = c.width,
  H = c.height;
const LAUNCH_Y = H - 152;
x.imageSmoothingEnabled = false;
const canvasFontDescriptor = Object.getOwnPropertyDescriptor(
  CanvasRenderingContext2D.prototype,
  "font",
);
if (canvasFontDescriptor?.get && canvasFontDescriptor?.set)
  Object.defineProperty(CanvasRenderingContext2D.prototype, "font", {
    configurable: true,
    enumerable: canvasFontDescriptor.enumerable,
    get() {
      return canvasFontDescriptor.get.call(this);
    },
    set(value) {
      canvasFontDescriptor.set.call(
        this,
        String(value).replace(/\bui-monospace\b/g, "Galmuri11"),
      );
    },
  });
const U = {
  shotsText: document.querySelector("#shotsText"),
  shotDots: document.querySelector("#shotDots"),
  phase: document.querySelector("#phaseText"),
  hp: document.querySelector("#hpText"),
  hpFill: document.querySelector("#hpFill"),
  power: document.querySelector("#powerText"),
  chain: document.querySelector("#chainText"),
  tip: document.querySelector("#tip"),
  over: document.querySelector("#overlay"),
  toast: document.querySelector("#toast"),
  summary: document.querySelector("#runeSummary"),
  momentum: document.querySelector("#momentumText"),
  flash: document.querySelector("#impactFlash"),
  blaze: document.querySelector("#blazeValue"),
  blazeDetail: document.querySelector("#blazeDetail"),
  blazeCard: document.querySelector("#blazeCard"),
};
const stageEl = document.querySelector(".stage");
U.combo = document.querySelector("#comboText");
const RULES = {
  baseDamage: 24,
  chainStep: 0.55,
  shots: 5,
  coreHp: 260,
  // The last onboarding lesson is a real kill, so the colossus stops being
  // immortal there.  Half the campaign pool keeps it a two or three shot win.
  tutorialCoreHp: 120,
};
const ECONOMY = { clearGold: 100, gachaCost: 100, skinCost: 500 };
// Meteor skins are cosmetic only: they repaint the existing prism orb with a
// hue rotation and swap the trail/glow palette, so no new art is shipped and
// no skin can change damage, speed or any physics value.
const METEOR_SKINS = [
  {
    id: "prism",
    name: "프리즘 원석",
    note: "관측소 지급 기본 유성",
    hue: 0,
    moving: "#d3e7cf",
    rest: "#e0b45a",
    core: "#f6fdff",
    idle: "#a6f5ff",
  },
  {
    id: "ember",
    name: "잔불의 유성",
    note: "꺼지지 않은 별의 마지막 온기",
    hue: 128,
    moving: "#f2b184",
    rest: "#e07a3c",
    core: "#fff0dd",
    idle: "#ffc79a",
  },
  {
    id: "abyss",
    name: "심연의 유성",
    note: "공허를 삼키고 돌아온 빛",
    hue: 300,
    moving: "#9aa6f0",
    rest: "#6f63c8",
    core: "#eae6ff",
    idle: "#b0a8ff",
  },
  {
    id: "verdant",
    name: "이끼별 유성",
    note: "오래 잠든 자리에 돋아난 색",
    hue: 200,
    moving: "#a9dd94",
    rest: "#6aa457",
    core: "#effbe6",
    idle: "#c2f0ab",
  },
];
const DEFAULT_METEOR_SKIN = METEOR_SKINS[0].id;
// Pinball is simulated in small, fixed slices.  Keeping all contacts on the
// same solver makes a flipper, bumper and wall feel like parts of one table.
const PHYSICS = {
  gravity: 720,
  step: 1 / 120,
  maxSlices: 4,
  wallRestitution: 0.92,
  bumperRestitution: 1.04,
  flipperRestitution: 0.28,
  flipperFriction: 0.025,
  flipperRadius: 17,
  flipperRise: 0.085,
  flipperFall: 0.13,
};
const ZONE_RULES = [
  { id: "route", name: "경유 별지기", hint: "유성 충돌 시 직접 공격" },
  { id: "bumper", name: "공명 별지기", hint: "범퍼 충돌 시 연계 발동" },
  { id: "boss", name: "마무리 별지기", hint: "보스 명중 시 연계 발동" },
];
const heroes = {
  gaon: {
    n: "성벽 기사 가온",
    s: "가온",
    e: "근접 베기",
    d: "멈춘 자리에서 가까운 보스를 강하게 베어냅니다. 사거리는 짧습니다.",
    lore: "성문이 무너진 뒤에도 홀로 약속을 지킨, 문지기의 별.",
    fx: "slash",
    col: "#f2c56b",
    sprite: "../assets/characters/gaon-warrior-idle.png",
    fw: 192,
    fh: 192,
    frames: 8,
    scale: 0.38,
  },
  biyeon: {
    n: "추적 사수 비연",
    s: "비연",
    e: "거리 저격",
    d: "멈춘 자리에서 보스에게 화살을 쏩니다. 멀수록 피해가 커집니다.",
    lore: "마지막 화살로 어둠을 겨눈, 이름이 지워진 사수의 별.",
    fx: "longshot",
    col: "#ef718d",
    sprite: "../assets/characters/biyeon-archer-idle.png",
    fw: 192,
    fh: 192,
    frames: 6,
    scale: 0.38,
  },
  lumi: {
    n: "항로 마녀 루미",
    s: "루미",
    e: "이중 분열",
    d: "유성에 닿으면 이번 발사 동안 한 번, 공을 둘로 복제합니다.",
    lore: "바다가 마른 뒤 비출 곳을 잃은, 등대의 별.",
    fx: "split",
    col: "#70dce1",
    sprite: "../assets/characters/lumi-shaman-idle.png",
    fw: 192,
    fh: 192,
    frames: 8,
    scale: 0.38,
  },
  haru: {
    n: "연쇄 전령 하루",
    s: "하루",
    e: "강제 중계",
    d: "유성에 닿으면 가장 가까운 다른 별지기에게 즉시 재발사합니다.",
    lore: "전할 사람이 사라진 뒤에도 달리기를 멈추지 않은, 전령의 별.",
    fx: "seek",
    col: "#9ee477",
    sprite: "../assets/characters/haru-lancer-idle.png",
    fw: 320,
    fh: 320,
    frames: 12,
    scale: 0.25,
  },
  ria: {
    n: "회전 검사 리아",
    s: "리아",
    e: "질풍 칼날",
    d: "정산 공격이 없습니다. 이동 중 보스를 관통하며, 속도에 비례해 회전 칼날로 주변 적을 벱니다.",
    lore: "멈추는 순간 패배한다고 믿는, 바람개비 검술의 별.",
    fx: "bladewheel",
    col: "#5fe0cf",
    sprite: "../assets/characters/ria-bladewheel-idle.png",
    fw: 256,
    fh: 256,
    frames: 1,
    // The generated source has more transparent padding than the legacy
    // sheets. Keep the collision radius unchanged, but normalize both the
    // arena and UI portrait scale to the other starkeepers.
    scale: 0.64,
    portraitScale: 1.34,
  },
  sera: {
    n: "궤도 사제 세라",
    s: "세라",
    e: "전환 명령",
    d: "유성에 닿으면 클릭 한 번으로 90도 전환하며 에너지를 얻습니다.",
    lore: "궤도를 다 돈 뒤에도 춤을 멈추지 않은, 고리의 별.",
    fx: "turn",
    col: "#bca7ff",
    sprite: "../assets/characters/sera-monk-idle.png",
    fw: 192,
    fh: 192,
    frames: 6,
    scale: 0.38,
  },
  taeo: {
    n: "폭파 광부 태오",
    s: "태오",
    e: "충돌 충격파",
    d: "모든 충돌 수에 비례해 멈춘 자리 주변에 강한 충격파를 일으킵니다.",
    lore: "꺼진 화로에 마지막 불씨를 묻어둔, 대장장이의 별.",
    fx: "shockwave",
    col: "#ffac67",
    sprite: "../assets/characters/taeo-miner-idle.png",
    fw: 192,
    fh: 192,
    frames: 8,
    scale: 0.38,
  },
  nyx: {
    n: "성위 관측자 닉스",
    s: "닉스",
    e: "마지막 모사",
    d: "마지막으로 부딪힌 아군의 능력을 이번 샷에 그대로 복제합니다.",
    lore: "모두가 하늘을 잊었을 때 홀로 기록을 계속한, 관측자의 별.",
    fx: "copycat",
    col: "#9f83ff",
    sprite: "../assets/characters/nyx-oracle-idle.png",
    fw: 192,
    fh: 192,
    frames: 8,
    scale: 0.38,
  },
};
const STARTER_HERO_IDS = Object.freeze(["gaon", "biyeon", "ria"]);
const GACHA_HERO_IDS = Object.freeze(
  Object.keys(heroes).filter((id) => !STARTER_HERO_IDS.includes(id)),
);
const abilityFx = {
  gaon: "../assets/library/restyle/fx/gaon-slash.png",
  biyeon: "../assets/library/restyle/fx/biyeon-volley.png",
  lumi: "../assets/library/restyle/fx/lumi-wave.png",
  haru: "../assets/library/restyle/fx/haru-dash.png",
  sera: "../assets/library/restyle/fx/rio-turn.png",
  taeo: "../assets/library/restyle/fx/taeo-quake.png",
  nyx: "../assets/library/restyle/fx/nyx-lock.png",
};
// 4-frame burst sheets keyed by ability kind; they play over the vector
// accents so a landed ability reads as one big signature flash.
const abilityFxSheets = {
  slash: "../assets/library/anim/fx/fx-slash-burst.png",
  longshot: "../assets/library/anim/fx/fx-longshot-burst.png",
  split: "../assets/library/anim/fx/fx-split-burst.png",
  seek: "../assets/library/anim/fx/fx-seek-burst.png",
  turn: "../assets/library/anim/fx/fx-turn-burst.png",
  shockwave: "../assets/library/anim/fx/fx-shockwave-burst.png",
  copycat: "../assets/library/anim/fx/fx-copycat-burst.png",
};
// Combat deliberately uses smaller, toy-like token art.  The full sprites
// remain available for the roster, while the table stays legible at a glance.
const combatUnitSize = {
  gaon: 108,
  biyeon: 109,
  lumi: 117,
  haru: 96,
  ria: 116,
  sera: 96,
  taeo: 111,
  nyx: 93,
};
for (const [id, size] of Object.entries(combatUnitSize))
  heroes[id].combatSize = size;
const cuteUnitArt = {
  haru: { sprite: "../assets/characters/cute/haru-cute.png" },
  ria: { sprite: "../assets/characters/ria-bladewheel-idle.png" },
  sera: { sprite: "../assets/characters/cute/sera-cute.png" },
  taeo: { sprite: "../assets/characters/cute/taeo-cute.png" },
  nyx: { sprite: "../assets/characters/cute/nyx-cute.png" },
};
for (const [id, art] of Object.entries(cuteUnitArt))
  Object.assign(heroes[id], { cuteSprite: art.sprite });
// Action sheets recoloured from the same source frames as each hero: the
// tumbling roll plays while a starkeeper is knocked around, the attack sheet
// replaces the cute token for the wake-up strike itself.
const heroAnimArt = {
  gaon: "gaon",
  biyeon: "biyeon",
  lumi: "lumi",
  haru: "haru",
  sera: "sera",
  taeo: "taeo",
  nyx: "nyx",
};
for (const id of Object.keys(heroAnimArt))
  Object.assign(heroes[id], {
    sheetFrame: heroes[id].fw,
    animations: {
      move: "../assets/characters/anim/" + id + "-roll.png",
      attack: "../assets/characters/anim/" + id + "-attack.png",
    },
  });
const stages = [
  {
    id: "1-1",
    name: "별빛의 첫 충돌",
    terrain:
      "루나의 안내를 따라 직격, 근접 각성, 별자리 배율을 차례로 관측하세요.",
    slots: [
      [182, 542],
      [538, 542],
      [360, 470],
    ],
    preview: [
      [25, 65],
      [75, 65],
      [50, 56],
    ],
    boss: { x: 360, y: 190 },
    labels: ["왼쪽 별지기", "오른쪽 별지기", "첫 관측점"],
    bumpers: [],
    tutorial: true,
  },
  {
    id: "1-2",
    name: "균열 회랑",
    terrain: "두 공명 범퍼를 오가며 속도를 만들고, 범퍼 충돌 연계를 익히세요.",
    slots: [
      [160, 518],
      [560, 518],
      [360, 438],
    ],
    preview: [
      [22, 63],
      [78, 63],
      [50, 53],
    ],
    boss: { x: 360, y: 192 },
    labels: ["좌측 중계점", "우측 중계점", "중앙 귀환점"],
    bumpers: [
      [246, 322, 27],
      [474, 322, 27],
    ],
  },
  {
    id: "1-3",
    name: "침식의 계단",
    terrain: "좌우 공명 범퍼를 잇는 각도에서 강한 반사와 연계를 노리세요.",
    slots: [
      [170, 446],
      [550, 358],
      [360, 550],
    ],
    preview: [
      [24, 53],
      [76, 43],
      [50, 67],
    ],
    boss: { x: 360, y: 190 },
    labels: ["좌측 계단", "우측 계단", "하단 귀환점"],
    bumpers: [
      [205, 338, 27],
      [515, 338, 27],
    ],
  },
  {
    id: "2-1",
    name: "원심 정원",
    terrain: "세 공명 범퍼가 보스 주변에 작은 고리 길을 만듭니다.",
    slots: [
      [180, 390],
      [540, 390],
      [360, 538],
    ],
    preview: [
      [26, 46],
      [74, 46],
      [50, 65],
    ],
    boss: { x: 360, y: 202 },
    labels: ["좌측 고리", "우측 고리", "하단 고리"],
    bumpers: [
      [258, 302, 25],
      [462, 302, 25],
      [360, 372, 27],
    ],
  },
  {
    id: "T",
    name: "무한 훈련장",
    terrain:
      "불멸의 거상과 자동 보충 유성으로 충돌·분열·배율을 제한 없이 시험합니다.",
    slots: [
      [154, 526],
      [566, 526],
      [360, 348],
    ],
    preview: [
      [21, 64],
      [79, 64],
      [50, 40],
    ],
    boss: { x: 360, y: 194 },
    labels: ["좌측 훈련 별지기", "우측 훈련 별지기", "중앙 훈련 별지기"],
    bumpers: [
      [224, 320, 27],
      [496, 320, 27],
      [360, 420, 25],
    ],
    // The training table is the only place where the next-stage gimmick
    // modules are enabled before a campaign stage is designed around one.
    gimmicks: {
      walls: [
        { x: 156, y: 398, w: 104, h: 18 },
        { x: 564, y: 398, w: 104, h: 18 },
      ],
      boostPads: [{ x: 360, y: 504, w: 156, h: 38, boost: 300 }],
      adds: [{ x: 360, y: 306, r: 23, hp: 56 }],
    },
    training: true,
  },
];

function setupStageGimmicks(stage) {
  const gimmicks = stage.gimmicks ?? {};
  stageWalls = (gimmicks.walls ?? []).map((wall, index) => ({
    id: wall.id ?? "wall-" + index,
    x: wall.x,
    y: wall.y,
    w: wall.w ?? 96,
    h: wall.h ?? 18,
    restitution: wall.restitution ?? 1.01,
    on: 0,
  }));
  boostPads = (gimmicks.boostPads ?? []).map((pad, index) => ({
    id: pad.id ?? "boost-" + index,
    x: pad.x,
    y: pad.y,
    w: pad.w ?? 140,
    h: pad.h ?? 34,
    boost: pad.boost ?? 260,
    maxSpeed: pad.maxSpeed ?? 1900,
    on: 0,
  }));
  adds = (gimmicks.adds ?? []).map((add, index) => {
    const hp = add.hp ?? 48;
    return {
      id: add.id ?? "add-" + index,
      x: add.x,
      y: add.y,
      r: add.r ?? 23,
      hp,
      maxHp: hp,
      down: 0,
      frozen: 0,
      hitCooldown: 0,
    };
  });
}
const bossArt = {
  sprite: "../assets/library/boss2/void-colossus.png",
  fw: 384,
  fh: 384,
  frames: 1,
  scale: 0.48,
  sheetFrame: 384,
  animations: {
    idle: "../assets/library/anim/boss2/void-colossus-idle.png",
    hit: "../assets/library/anim/boss2/void-colossus-hit.png",
  },
};
const staticArt = {
  orb: "../assets/original/prism-orb.svg",
  weak: "../assets/library/boss2/void-colossus-weakgem.png",
  rock1: "../assets/terrain/rock-01.png",
  rock4: "../assets/terrain/rock-04.png",
  wispIdle: "../assets/enemies/void-wisp-idle.png",
  wispHit: "../assets/enemies/void-wisp-hit.png",
};
// Existing pixel FX are intentionally reused in the combat pass.  They give
// high-value events a recognizable silhouette instead of another coloured ring.
const feedbackArt = {
  impact: "../assets/library/fx/prism-impact.png",
  shockwave: "../assets/library/fx/rune-shockwave.png",
  comet: "../assets/library/fx/prism-comet.png",
  electric: "../assets/fx/electric-ring.png",
  burst: "../assets/library/fx/prism-impact.png",
  corebreak: "../assets/library/fx/core-break-signature-512.png",
  critStar: "../assets/library/restyle/fx/crit-star.png",
};
const libraryArt = {
  stages: [
    {
      tile: "../assets/library/stages/tile-corridor.png",
      emblem: "../assets/library/stages/emblem-corridor.png",
      frame: [
        "../assets/library/arena-frames/corridor-edge-h.png",
        "../assets/library/arena-frames/corridor-edge-v.png",
        "../assets/library/arena-frames/corridor-corner.png",
      ],
      props: [
        ["../assets/library/props/rune-pillar.png", 82, 642, 58],
        ["../assets/library/props/void-lantern.png", 638, 570, 40],
      ],
    },
    {
      tile: "../assets/library/stages/tile-corridor.png",
      emblem: "../assets/library/stages/emblem-corridor.png",
      frame: [
        "../assets/library/arena-frames/corridor-edge-h.png",
        "../assets/library/arena-frames/corridor-edge-v.png",
        "../assets/library/arena-frames/corridor-corner.png",
      ],
      props: [
        ["../assets/library/props/rune-pillar.png", 82, 642, 58],
        ["../assets/library/props/void-lantern.png", 638, 570, 40],
      ],
    },
    {
      tile: "../assets/library/stages/tile-stairs.png",
      emblem: "../assets/library/stages/emblem-stairs.png",
      frame: [
        "../assets/library/arena-frames/stairs-edge-h.png",
        "../assets/library/arena-frames/stairs-edge-v.png",
        "../assets/library/arena-frames/stairs-corner.png",
      ],
      props: [
        ["../assets/library/props/void-lantern.png", 94, 540, 42],
        ["../assets/library/props/crystal-spire.png", 622, 388, 56],
      ],
    },
    {
      tile: "../assets/library/stages/tile-garden.png",
      emblem: "../assets/library/stages/emblem-garden.png",
      frame: [
        "../assets/library/arena-frames/garden-edge-h.png",
        "../assets/library/arena-frames/garden-edge-v.png",
        "../assets/library/arena-frames/garden-corner.png",
      ],
      props: [
        ["../assets/library/props/crystal-spire.png", 104, 420, 56],
        ["../assets/library/props/void-portal.png", 616, 538, 58],
      ],
    },
    {
      tile: "../assets/library/stages/tile-corridor.png",
      emblem: "../assets/library/stages/emblem-corridor.png",
      frame: [
        "../assets/library/arena-frames/corridor-edge-h.png",
        "../assets/library/arena-frames/corridor-edge-v.png",
        "../assets/library/arena-frames/corridor-corner.png",
      ],
      props: [
        ["../assets/library/props/void-lantern.png", 84, 616, 44],
        ["../assets/library/props/crystal-spire.png", 636, 456, 50],
      ],
    },
  ],
  tutorial: {
    drag: "../assets/library/tutorial/hint-drag-shot.png",
    gaugeFrame: "../assets/library/tutorial/power-gauge-frame.png",
    gaugeFill: "../assets/library/tutorial/power-gauge-fill.png",
  },
  projectile: {
    charged: "../assets/library/projectiles/charged-orb.png",
    homing: "../assets/library/projectiles/homing-orb.png",
    marked: "../assets/library/projectiles/marked-orb.png",
    support: "../assets/library/projectiles/support-bolt.png",
  },
  result: {
    clear: "../assets/library/results/medal-clear.png",
    sharp: "../assets/library/results/medal-sharp.png",
    flawless: "../assets/library/results/medal-flawless.png",
    time: "../assets/library/results/metric-time.png",
    shots: "../assets/library/results/metric-shots.png",
    damage: "../assets/library/results/metric-damage.png",
  },
  cutin: {
    win: "../assets/library/cutin/win-backplate.png",
    fail: "../assets/library/cutin/fail-backplate.png",
  },
};
const metaArt = {
  wordmark: "../assets/original/stella-ball-wordmark.svg",
  luna: "../assets/library/guide/luna-portrait.png",
  daily: "../assets/library/record/daily-challenge-badge.png",
  play: "../assets/library/system/icon-play.png",
  home: "../assets/library/system/icon-home.png",
  help: "../assets/library/system/icon-help.png",
  mouse: "../assets/library/input/mouse-left.png",
  touch: "../assets/library/input/touch-drag.png",
  keyR: "../assets/library/input/keycap-r.png",
};
const runeStone = (id) =>
  ["gaon", "biyeon", "lumi", "haru", "sera", "taeo", "nyx"].includes(id)
    ? "../assets/library/runes/rune-stone-" + id + ".png"
    : heroes[id].sprite;
const skillIcon = (id) =>
  ["gaon", "biyeon", "lumi", "haru", "sera", "taeo", "nyx"].includes(id)
    ? "../assets/library/skills/skill-" + id + ".png"
    : id === "ria"
      ? "../assets/library/icons/skill-ready.png"
      : "";
const textures = {};
function loadTexture(path) {
  if (!path) return null;
  if (!textures[path]) {
    const im = new Image();
    im.decoding = "async";
    im.src = path;
    textures[path] = im;
  }
  return textures[path];
}
function loadSpec(spec) {
  loadTexture(spec.sprite);
  loadTexture(spec.cuteSprite);
  for (const path of Object.values(spec.animations ?? {})) loadTexture(path);
}
function primeCombatTextures() {
  loadSpec(bossArt);
  for (const path of [
    ...Object.values(staticArt),
    ...Object.values(feedbackArt),
  ])
    loadTexture(path);
  for (const path of Object.values(abilityFx)) loadTexture(path);
  for (const path of Object.values(abilityFxSheets)) loadTexture(path);
  const stageArt = libraryArt.stages[stageIndex];
  for (const path of [
    stageArt.tile,
    ...stageArt.frame,
    ...stageArt.props.map((prop) => prop[0]),
    ...Object.values(libraryArt.tutorial),
    ...Object.values(libraryArt.projectile),
  ])
    loadTexture(path);
  for (const id of deployed) loadSpec(heroes[id]);
}
const upgrades = [
  {
    id: "lens",
    tag: "약점",
    title: "균열 렌즈",
    text: "약점 피해가 +7 증가합니다.",
    accent: "#ffd36d",
    icon: "../assets/library/icons/upgrade-lens.png",
    apply: (b) => (b.weakFlat += 7),
  },
  {
    id: "chorus",
    tag: "연계",
    title: "공명 코일",
    text: "별지기 한 명당 연계 배율이 +16% 증가합니다.",
    accent: "#83e8f5",
    icon: "../assets/library/icons/upgrade-chorus.png",
    apply: (b) => (b.chainStep += 0.16),
  },
  {
    id: "reserve",
    tag: "발사",
    title: "예비 탄창",
    text: "이후 단계의 발사 횟수가 +1 증가합니다.",
    accent: "#f6a6ce",
    icon: "../assets/library/icons/upgrade-reserve.png",
    apply: (b) => (b.extraShots += 1),
  },
  {
    id: "kinetic",
    tag: "반사",
    title: "운동량 프레임",
    text: "벽 반사마다 피해가 +8% 증가합니다.",
    accent: "#9ee477",
    icon: "../assets/library/icons/upgrade-kinetic.png",
    apply: (b) => (b.bounceStep += 0.08),
  },
  {
    id: "mark",
    tag: "표식",
    title: "사냥꾼의 눈",
    text: "표식 룬의 약점 피해 배율이 1.38 → 1.70이 됩니다.",
    accent: "#ef718d",
    icon: "../assets/library/icons/upgrade-mark.png",
    apply: (b) => (b.markMultiplier = 1.7),
  },
  {
    id: "battery",
    tag: "공명",
    title: "위상 공명기",
    text: "모든 보스 피해가 +9 증가합니다.",
    accent: "#bca7ff",
    icon: "../assets/library/icons/upgrade-battery.png",
    apply: (b) => (b.weakFlat += 9),
  },
];
let selected = [],
  deployed = [],
  stageIndex = 0,
  placementPick = null;
let build,
  ball,
  boss,
  gates = [],
  bumpers = [],
  stageWalls = [],
  boostPads = [],
  adds = [],
  areaBursts = [],
  battle,
  drag = null,
  run = false,
  chain = [],
  popups = [],
  assistShots = [],
  fieldFx = [],
  barriers = [],
  seeds = [],
  frameClock = 0,
  last = 0,
  toastTimer = 0,
  impactStop = 0,
  screenShake = 0,
  screenFlash = 0,
  hitCombo = 0,
  comboTimer = 0,
  comboPulse = 0,
  battleSerial = 0,
  battleComplete = false,
  msg = "파티를 편성하세요.",
  flippers = { left: 0, right: 0 };

const runtimeHooks = {
  afterArenaDraw: [],
  afterDraw: [],
  afterFeedbackUpdate: [],
  afterSpecialDraw: [],
};

function registerRuntimeHook(name, callback) {
  const hooks = runtimeHooks[name];
  if (!hooks) throw new Error(`Unknown runtime hook: ${name}`);
  if (hooks.includes(callback)) return () => {};
  hooks.push(callback);
  return () => {
    const index = hooks.indexOf(callback);
    if (index >= 0) hooks.splice(index, 1);
  };
}

function runRuntimeHooks(name, ...args) {
  // Snapshot the list so a hook may unregister itself without skipping the
  // next extension in the same frame.
  for (const callback of [...runtimeHooks[name]]) callback(...args);
}

// Short-lived combat arrays are updated every frame. Compacting them in place
// avoids new arrays and garbage-collection hitches during busy combos.
function advanceTimed(items, delta) {
  let write = 0;
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    item.t += delta;
    if (item.t < item.d) items[write++] = item;
  }
  items.length = write;
}
function tickTimed(items, delta) {
  let write = 0;
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    item.t -= delta;
    if (item.t > 0) items[write++] = item;
  }
  items.length = write;
}

primeCombatTextures();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const currentStage = () => stages[stageIndex];

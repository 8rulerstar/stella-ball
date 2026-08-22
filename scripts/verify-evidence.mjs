import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const demoPath = resolve(root, "prototypes/prism-breakers.html");
const source = readFileSync(demoPath, "utf8");
const gameFiles = [
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
  "prototypes/js/game-onboarding.js",
  "prototypes/js/game-arena-carve.js",
  "prototypes/js/game-bootstrap.js",
];
const gameSource = gameFiles
  .map((file) => readFileSync(resolve(root, file), "utf8"))
  .join("\n");
const styleFiles = [
  "prototypes/prism-breakers-foundation.css",
  "prototypes/prism-breakers-interface.css",
  "prototypes/prism-breakers-combat.css",
  "prototypes/prism-breakers-story.css",
  "prototypes/prism-breakers-polish.css",
];
const styleSource = styleFiles
  .map((file) => readFileSync(resolve(root, file), "utf8"))
  .join("\n");
const combinedSource = `${source}\n${gameSource}\n${styleSource}`;

const requiredRuntimeReferences = [
  ...styleFiles.map((file) => `./${file.replace("prototypes/", "")}`),
  "../hive/prism-hive-client.js",
  ...gameFiles.map((file) => `./${file.replace("prototypes/", "")}`),
];
const missingRuntimeReferences = requiredRuntimeReferences.filter(
  (reference) => !source.includes(reference),
);
if (missingRuntimeReferences.length > 0) {
  throw new Error(
    `HTML runtime references are missing: ${missingRuntimeReferences.join(", ")}`,
  );
}

const requiredMarkers = [
  "STELLA BALL",
  "별지기 편성",
  "drag",
  "gaon",
  "biyeon",
  "lumi",
  "nyx",
  "const RULES = {",
  "function damage",
];

const requiredGimmickMarkers = [
  "setupStageGimmicks",
  "applyStageGimmicks",
  "mobileRect",
  "boostPads",
];

const missingMarkers = requiredMarkers.filter(
  (marker) => !combinedSource.includes(marker),
);
if (missingMarkers.length > 0) {
  throw new Error(
    `핵심 기능 표식을 찾지 못했습니다: ${missingMarkers.join(", ")}`,
  );
}

const missingGimmickMarkers = requiredGimmickMarkers.filter(
  (marker) => !gameSource.includes(marker),
);
if (missingGimmickMarkers.length > 0) {
  throw new Error(
    `스테이지 기믹 기반 표식을 찾지 못했습니다: ${missingGimmickMarkers.join(", ")}`,
  );
}

const requiredAssetReferences = [
  "../assets/characters/gaon-warrior-idle.png",
  "../assets/library/boss2/void-colossus.png",
  "../assets/library/anim/boss2/void-colossus-idle.png",
  "../assets/library/anim/boss2/void-colossus-hit.png",
  "../assets/library/boss2/void-colossus-weakgem.png",
  "../assets/enemies/void-wisp-idle.png",
  "../assets/enemies/void-wisp-hit.png",
  "../assets/original/prism-orb.svg",
  "../assets/library/constellations/aries.png",
  "../assets/library/constellations/sagitta.png",
  "../assets/library/constellations/corvus.png",
  "../assets/library/constellations/cassiopeia.png",
  "../assets/library/constellations/cygnus.png",
  "../assets/library/constellations/orion.png",
  "../assets/library/constellations/bigdipper.png",
];
const missingAssetReferences = requiredAssetReferences.filter(
  (asset) => !combinedSource.includes(asset),
);
if (missingAssetReferences.length > 0) {
  throw new Error(
    `프로토타입에서 참조하지 않는 핵심 에셋이 있습니다: ${missingAssetReferences.join(", ")}`,
  );
}

const manifest = JSON.parse(
  readFileSync(resolve(root, "assets/ASSET_MANIFEST.json"), "utf8"),
);
const assetFiles = [
  ...Object.values(manifest.characters).map((asset) => asset.file),
  ...Object.values(manifest.expandedRoster ?? {}).map((asset) => asset.file),
  ...Object.values(manifest.boss).map((asset) => asset.file),
  ...Object.values(manifest.enemies ?? {}).map((asset) => asset.file),
  ...Object.values(manifest.effects).map((asset) => asset.file),
  ...Object.values(manifest.terrain).map((asset) => asset.file),
  ...Object.values(manifest.original),
  ...Object.values(manifest.combat ?? {}),
  ...Object.values(manifest.constellations?.files ?? {}),
  // 2026-08-22 작화 납품 여섯 섹션(지시서 §7-4). files 맵이 곧 실재 검사 대상.
  ...Object.values(manifest.gimmickIcons?.files ?? {}),
  ...Object.values(manifest.wispDeath?.files ?? {}),
  ...Object.values(manifest.orbitGate?.files ?? {}),
  ...Object.values(manifest.roarArrival?.files ?? {}),
  ...Object.values(manifest.shieldShards?.files ?? {}),
  ...Object.values(manifest.boardGlyphs?.files ?? {}),
  ...Object.values(manifest.starLadder?.files ?? {}),
];
const missingAssets = assetFiles.filter(
  (asset) => !existsSync(resolve(root, "assets", asset)),
);
if (missingAssets.length > 0) {
  throw new Error(
    `에셋 매니페스트의 파일을 찾지 못했습니다: ${missingAssets.join(", ")}`,
  );
}

const expandedAnimationManifest = JSON.parse(
  readFileSync(
    resolve(root, "assets", manifest.expandedRosterAnimations.manifest),
    "utf8",
  ),
);
const expectedExpandedAnimationCount =
  manifest.expandedRosterAnimations.unitCount *
  manifest.expandedRosterAnimations.states.length;
if (
  expandedAnimationManifest.animations.length !== expectedExpandedAnimationCount
) {
  throw new Error(
    `확장 룬 애니메이션 수가 맞지 않습니다: ${expandedAnimationManifest.animations.length}/${expectedExpandedAnimationCount}`,
  );
}
const missingExpandedAnimations = expandedAnimationManifest.animations
  .map((animation) => animation.file)
  .filter((asset) => !existsSync(resolve(root, "assets", asset)));
if (missingExpandedAnimations.length > 0) {
  throw new Error(
    `확장 룬 애니메이션 파일을 찾지 못했습니다: ${missingExpandedAnimations.join(", ")}`,
  );
}

/* 한글 범위 표기가 취소선으로 바뀌는 것을 잡는다.
   `10~11px` 처럼 쓴 물결표 두 개가 한 줄에 있으면 GFM 은 그 사이를
   취소선으로 읽는다. 그리고 prettier 3.9.6 은 그 «해석»을 파일에 굳혀
   `10~~11px` 로 바꿔 쓴다 — package.json 은 3.5.3 을 고정하지만, 고정을
   빼고 `npx prettier --write .` 를 돌리면 최신판이 실행되어 문서 여러 개가
   한꺼번에 상한다. 실제로 그렇게 24곳이 상했고, 표 안에서는 사이에 낀
   `**굵게**` 까지 같이 깨졌다.
   의도한 취소선(`~~지난 계획~~`)은 양옆이 공백이라 걸리지 않는다. */
const RANGE_STRIKE = /(?<=[^\s~])~~(?=[^\s~])/;
/* 이 둘은 오너가 관리하는 기록 파일이라 이 검사가 고치지 않는다.
   경고만 하고 통과시킨다 — 손대지 않기로 한 파일을 게이트가 막으면
   게이트를 끄게 된다. */
const OWNER_OWNED = new Set(["DEVLOG.md", "CODEX_COLLABORATION.md"]);
const trackedDocs = execFileSync("git", ["ls-files", "*.md"], {
  cwd: root,
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean);
/* GFM 은 코드 스팬 안에서 취소선을 적용하지 않는다. 그러니 검사도 빼야
   한다 — 안 그러면 이 규칙을 «설명하는» 문서가 자기 예시에 걸린다. */
const withoutCode = (line) => line.replace(/`[^`]*`/g, "");
const strikeHits = [];
const ownerHits = [];
for (const doc of trackedDocs) {
  const lines = readFileSync(resolve(root, doc), "utf8").split("\n");
  lines.forEach((line, i) => {
    if (!RANGE_STRIKE.test(withoutCode(line))) return;
    (OWNER_OWNED.has(doc.split("/").pop()) ? ownerHits : strikeHits).push(
      `${doc}:${i + 1}`,
    );
  });
}
if (ownerHits.length)
  console.warn(
    `주의 — 범위 표기가 취소선으로 굳은 자리(오너 파일이라 두었다): ${ownerHits.join(", ")}`,
  );
if (strikeHits.length)
  throw new Error(
    `범위 표기가 취소선이 됐습니다(«3~5» 가 «3~~5» 로): ${strikeHits.join(", ")}\n` +
      `물결표를 하나로 되돌리고, 포맷은 반드시 고정 버전으로 — npm run format`,
  );

try {
  execFileSync("git", ["diff", "--check"], { cwd: root, stdio: "pipe" });
} catch (error) {
  throw new Error(
    `공백 또는 충돌 표식 검사 실패:\n${error.stdout?.toString() ?? ""}`,
  );
}

execFileSync(
  process.execPath,
  [resolve(root, "scripts", "check-portability.mjs")],
  {
    cwd: root,
    stdio: "inherit",
  },
);

const demoSha256 = createHash("sha256").update(source).digest("hex");
const bundleSha256 = createHash("sha256").update(combinedSource).digest("hex");
const report = {
  schemaVersion: 1,
  verifiedAtUtc: new Date().toISOString(),
  commitSha: process.env.GITHUB_SHA ?? "local-uncommitted-check",
  workflowRunId: process.env.GITHUB_RUN_ID ?? "local",
  demo: "prototypes/prism-breakers.html",
  demoSha256,
  bundleSha256,
  runtimeFiles: ["prototypes/prism-breakers.html", ...styleFiles, ...gameFiles],
  requiredMarkers,
  requiredAssetReferences,
  assetFiles,
  result: "passed",
};

mkdirSync(resolve(root, "artifacts"), { recursive: true });
writeFileSync(
  resolve(root, "artifacts", "verification.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));

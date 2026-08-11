import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const demoPath = resolve(root, "prototypes/prism-breakers.html");
const source = readFileSync(demoPath, "utf8");

const requiredMarkers = [
  "STELLA BALL",
  "별지기 편성",
  "drag",
  "gaon",
  "biyeon",
  "lumi",
  "nyx",
  "RULES={baseDamage:24,chainStep:.55,shots:5,coreHp:260}",
  "function damage",
];

const missingMarkers = requiredMarkers.filter((marker) => !source.includes(marker));
if (missingMarkers.length > 0) {
  throw new Error(`핵심 기능 표식을 찾지 못했습니다: ${missingMarkers.join(", ")}`);
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
];
const missingAssetReferences = requiredAssetReferences.filter((asset) => !source.includes(asset));
if (missingAssetReferences.length > 0) {
  throw new Error(`프로토타입에서 참조하지 않는 핵심 에셋이 있습니다: ${missingAssetReferences.join(", ")}`);
}

const manifest = JSON.parse(readFileSync(resolve(root, "assets/ASSET_MANIFEST.json"), "utf8"));
const assetFiles = [
  ...Object.values(manifest.characters).map((asset) => asset.file),
  ...Object.values(manifest.expandedRoster ?? {}).map((asset) => asset.file),
  ...Object.values(manifest.boss).map((asset) => asset.file),
  ...Object.values(manifest.enemies ?? {}).map((asset) => asset.file),
  ...Object.values(manifest.effects).map((asset) => asset.file),
  ...Object.values(manifest.terrain).map((asset) => asset.file),
  ...Object.values(manifest.original),
  ...Object.values(manifest.combat ?? {}),
];
const missingAssets = assetFiles.filter((asset) => !existsSync(resolve(root, "assets", asset)));
if (missingAssets.length > 0) {
  throw new Error(`에셋 매니페스트의 파일을 찾지 못했습니다: ${missingAssets.join(", ")}`);
}

const expandedAnimationManifest = JSON.parse(
  readFileSync(resolve(root, "assets", manifest.expandedRosterAnimations.manifest), "utf8"),
);
const expectedExpandedAnimationCount = manifest.expandedRosterAnimations.unitCount * manifest.expandedRosterAnimations.states.length;
if (expandedAnimationManifest.animations.length !== expectedExpandedAnimationCount) {
  throw new Error(`확장 룬 애니메이션 수가 맞지 않습니다: ${expandedAnimationManifest.animations.length}/${expectedExpandedAnimationCount}`);
}
const missingExpandedAnimations = expandedAnimationManifest.animations
  .map((animation) => animation.file)
  .filter((asset) => !existsSync(resolve(root, "assets", asset)));
if (missingExpandedAnimations.length > 0) {
  throw new Error(`확장 룬 애니메이션 파일을 찾지 못했습니다: ${missingExpandedAnimations.join(", ")}`);
}

try {
  execFileSync("git", ["diff", "--check"], { cwd: root, stdio: "pipe" });
} catch (error) {
  throw new Error(`공백 또는 충돌 표식 검사 실패:\n${error.stdout?.toString() ?? ""}`);
}

execFileSync(process.execPath, [resolve(root, "scripts", "check-portability.mjs")], {
  cwd: root,
  stdio: "inherit",
});

const sha256 = createHash("sha256").update(source).digest("hex");
const report = {
  schemaVersion: 1,
  verifiedAtUtc: new Date().toISOString(),
  commitSha: process.env.GITHUB_SHA ?? "local-uncommitted-check",
  workflowRunId: process.env.GITHUB_RUN_ID ?? "local",
  demo: "prototypes/prism-breakers.html",
  demoSha256: sha256,
  requiredMarkers,
  requiredAssetReferences,
  assetFiles,
  result: "passed",
};

mkdirSync(resolve(root, "artifacts"), { recursive: true });
writeFileSync(resolve(root, "artifacts", "verification.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

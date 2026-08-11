import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root })
  .toString("utf8")
  .split("\0")
  .filter(Boolean);
const trackedSet = new Set(tracked);
// Validate only the submitted game and its runtime bridge.  Older prototypes
// and vendored third-party bundles are archival material, not the deploy path.
const runtimeFiles = [
  "prototypes/prism-breakers.html",
  "prototypes/prism-breakers-foundation.css",
  "prototypes/prism-breakers-interface.css",
  "prototypes/prism-breakers-combat.css",
  "prototypes/prism-breakers-story.css",
  "prototypes/prism-breakers-polish.css",
  "prototypes/js/game-data.js",
  "prototypes/js/game-session.js",
  "prototypes/js/game-core-physics.js",
  "prototypes/js/game-core-render.js",
  "prototypes/js/game-meta.js",
  "prototypes/js/game-combat.js",
  "prototypes/js/game-feedback.js",
  "prototypes/js/game-onboarding.js",
  "prototypes/js/game-bootstrap.js",
  ...tracked.filter((file) => /^hive\/.+\.(?:js|mjs)$/i.test(file)),
];
const failures = [];

const absolutePath = /(?:\/Users\/|\/Volumes\/|file:\/\/|[A-Za-z]:[\\/])/;
const assetReference =
  /(?:\.\.\/assets\/|assets\/)[A-Za-z0-9_./-]+\.(?:png|jpe?g|webp|gif|svg|woff2|mp3|ogg)/g;

for (const file of runtimeFiles) {
  const contents = readFileSync(resolve(root, file), "utf8");
  // URLs created by JavaScript are resolved by the browser document, not by
  // the script file location. Runtime modules live under prototypes/js/ while
  // their asset paths intentionally remain relative to prism-breakers.html.
  const referenceBase = file.startsWith("prototypes/js/")
    ? resolve(root, "prototypes")
    : dirname(resolve(root, file));
  if (absolutePath.test(contents)) {
    failures.push(`${file}: 운영체제 절대 경로를 포함합니다.`);
  }
  for (const match of contents.matchAll(assetReference)) {
    const reference = match[0];
    const path = relative(root, resolve(referenceBase, reference))
      .split(sep)
      .join("/");
    if (!path.startsWith("assets/") || !existsSync(resolve(root, path))) {
      failures.push(`${file}: 에셋 경로가 유효하지 않습니다 (${reference}).`);
    } else if (!trackedSet.has(path)) {
      failures.push(`${file}: Git에 없는 에셋을 참조합니다 (${path}).`);
    }
  }
}

const lowerCasePaths = new Map();
for (const file of tracked) {
  const lower = file.toLowerCase();
  const existing = lowerCasePaths.get(lower);
  if (existing && existing !== file) {
    failures.push(`Windows 대소문자 충돌: ${existing} <=> ${file}`);
  }
  lowerCasePaths.set(lower, file);
  for (const part of file.split("/")) {
    if (
      /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(part) ||
      /[. ]$/.test(part)
    ) {
      failures.push(`Windows에서 사용할 수 없는 파일명: ${file}`);
    }
  }
}

if (failures.length > 0) {
  throw new Error(`크로스플랫폼 호환성 검사 실패:\n${failures.join("\n")}`);
}

console.log(
  JSON.stringify(
    {
      result: "passed",
      runtimeFiles: runtimeFiles.length,
      trackedFiles: tracked.length,
    },
    null,
    2,
  ),
);

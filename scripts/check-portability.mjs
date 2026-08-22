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

/* 문자열 연결로 만들어지는 경로는 위 정규식이 통째로 놓친다 — 템플릿의
   ${}에서 매치가 끊겨 확장자에 못 닿는다(보스 시트 60장, 액션 시트 16장,
   룬 7장, sfx50 wav들, 별자리 실루엣 — 실측 ~135파일이 게이트 밖이었다).
   예측 목록을 여기 복사하는 대신, 봇 하니스의 VM 컨텍스트에서 런타임이
   «실제로 만들 수 있는» 경로 전부를 열거해 같은 검사를 돌린다. 열거가
   비면 그것 자체가 실패다 — 코드 쪽 패턴이 바뀌어 열거가 낡았다는 뜻이라
   조용히 지나가면 안 된다. */
try {
  const { enumerateDynamicAssetPaths } = await import(
    "../bot/runtime-harness.mjs"
  );
  const dynamicPaths = enumerateDynamicAssetPaths();
  if (dynamicPaths.length < 80) {
    failures.push(
      `동적 에셋 열거가 너무 작습니다 (${dynamicPaths.length}개) — ` +
        "런타임 쪽 경로 조립이 바뀌어 열거가 낡았는지 확인하세요.",
    );
  }
  for (const reference of dynamicPaths) {
    const path = relative(root, resolve(root, "prototypes", reference))
      .split(sep)
      .join("/");
    if (!path.startsWith("assets/") || !existsSync(resolve(root, path))) {
      failures.push(`동적 에셋 경로가 유효하지 않습니다 (${reference}).`);
    } else if (!trackedSet.has(path)) {
      failures.push(`Git에 없는 에셋을 동적 경로가 참조합니다 (${path}).`);
    }
  }
} catch (error) {
  failures.push(`동적 에셋 열거 실패: ${error.message}`);
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

/* 문서가 가리키는 실행 파일이 실제로 있어야 한다. 2026-08-21에
   RUN_STELLA_BALL.bat을 지우며 안내만 PLAY_WINDOWS.cmd로 바꾸고 파일을
   만들지 않아, 윈도우에서 게임이 «시작도 안 되는» 상태가 게이트를 통과했다.
   README·CROSS_PLATFORM·AGENTS가 이름을 바꾸면 이 목록도 함께 바꾼다. */
for (const launcher of ["PLAY_WINDOWS.cmd", "RUN_STELLA_BALL.command"]) {
  if (!trackedSet.has(launcher))
    failures.push(`문서가 안내하는 실행 파일이 저장소에 없습니다: ${launcher}`);
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

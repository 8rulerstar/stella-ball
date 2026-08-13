import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(
  resolve(root, "prototypes/prism-breakers.html"),
  "utf8",
);
const expectedStyles = [
  "./prism-breakers-foundation.css",
  "./prism-breakers-interface.css",
  "./prism-breakers-combat.css",
  "./prism-breakers-story.css",
  "./prism-breakers-polish.css",
  "./stella-ball-theme.css",
  "./stella-ball-dawn.css",
];
const expectedScripts = [
  "../hive/prism-hive-client.js",
  "./js/game-platform.js",
  "./js/game-data.js",
  "./js/game-ui.js",
  "./js/game-session.js",
  "./js/game-core-physics.js",
  "./js/game-core-render.js",
  "./js/game-meta.js",
  "./js/game-combat.js",
  "./js/game-figure.js",
  "./js/game-feedback.js",
  "./js/game-onboarding.js",
  "./js/game-bootstrap.js",
  "./stella-ball-pixel-ui.js",
  "./stella-ball-dawn.js",
];
const actualScripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(
  (match) => match[1],
);
const actualStyles = [
  ...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g),
].map((match) => match[1]);

if (actualStyles.join("|") !== expectedStyles.join("|")) {
  throw new Error(`Unexpected stylesheet order: ${actualStyles.join(", ")}`);
}

if (actualScripts.join("|") !== expectedScripts.join("|")) {
  throw new Error(`Unexpected runtime order: ${actualScripts.join(", ")}`);
}

const missingFiles = expectedScripts
  .filter((script) => !script.startsWith("../hive/"))
  .map((script) => resolve(root, "prototypes", script))
  .filter((file) => !existsSync(file));
if (missingFiles.length > 0) {
  throw new Error(`Missing runtime files: ${missingFiles.join(", ")}`);
}

const missingStyles = expectedStyles
  .map((style) => resolve(root, "prototypes", style))
  .filter((file) => !existsSync(file));
if (missingStyles.length > 0) {
  throw new Error(`Missing stylesheets: ${missingStyles.join(", ")}`);
}

const runtimeSource = expectedScripts
  .filter((script) => !script.startsWith("../hive/"))
  .map((script) => readFileSync(resolve(root, "prototypes", script), "utf8"))
  .join("\n");
new Script(runtimeSource, { filename: "stella-ball-runtime.js" });

// The runtime layers behaviour by reassigning globals from later scripts. That
// only works when the new definition captures the old one first — otherwise the
// predecessor becomes unreachable, and every reader who looks at it is reading
// code that never runs. Three separate bugs in August 2026 came from exactly
// that: a settle mute that covered one layer of four, a skin tint dropped by a
// `drawFrame` reassignment, and a button added to a `showMeta` that no longer
// ran. An empty body is fine — that is the house style for a forward
// declaration another file fills in.
const scriptPaths = expectedScripts.filter(
  (script) => !script.startsWith("../hive/"),
);
const definitions = new Map();
for (const script of scriptPaths) {
  const body = readFileSync(resolve(root, "prototypes", script), "utf8");
  body.split("\n").forEach((line, index) => {
    const match =
      /^([A-Za-z_$][\w$]*)\s*=\s*function/.exec(line) ??
      /^function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(line);
    if (!match) return;
    const list = definitions.get(match[1]) ?? [];
    list.push({
      script,
      line: index + 1,
      empty: /\{\}\s*;?\s*$/.test(line),
    });
    definitions.set(match[1], list);
  });
}
const strandedDefinitions = [];
for (const [name, sites] of definitions) {
  if (sites.length < 2) continue;
  const aliases = [
    ...runtimeSource.matchAll(
      new RegExp(`(?:const|let|var)\\s+([\\w$]+)\\s*=\\s*${name}\\s*;`, "g"),
    ),
  ]
    .map((alias) => alias[1])
    .filter((alias) => new RegExp(`\\b${alias}\\s*\\(`).test(runtimeSource));
  const reachable = 1 + aliases.length;
  for (const site of sites.slice(0, Math.max(0, sites.length - reachable))) {
    if (site.empty) continue;
    strandedDefinitions.push(`${name} at ${site.script}:${site.line}`);
  }
}
if (strandedDefinitions.length > 0) {
  throw new Error(
    "Overridden without capturing the predecessor, so these definitions are " +
      `unreachable:\n  ${strandedDefinitions.join("\n  ")}\n` +
      "Capture it (`const baseX = x;`) and call it, empty the body, or delete it.",
  );
}

const onboarding = readFileSync(
  resolve(root, "prototypes/js/game-onboarding.js"),
  "utf8",
);
if (
  !html.includes('id="onboardingDock"') ||
  !onboarding.includes("#onboardingDock")
) {
  throw new Error(
    "Onboarding must render outside the canvas through #onboardingDock.",
  );
}

console.log(
  JSON.stringify(
    {
      result: "passed",
      runtimeScripts: actualScripts.length,
      overriddenGlobals: [...definitions.values()].filter((s) => s.length > 1)
        .length,
      stylesheets: actualStyles.length,
    },
    null,
    2,
  ),
);

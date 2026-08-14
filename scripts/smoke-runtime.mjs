import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";
import {
  probeDeferredFigureResolution,
  probeRuntimeModules,
} from "../bot/runtime-harness.mjs";

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
  "./js/game-runtime.js",
  "./js/game-data.js",
  "./js/game-ui.js",
  "./js/game-session.js",
  "./js/game-core-physics.js",
  "./js/game-core-render.js",
  "./js/game-meta-state.js",
  "./js/game-meta.js",
  "./js/game-combat.js",
  "./js/game-combat-physics.js",
  "./js/game-figure-recognition.js",
  "./js/game-figure.js",
  "./js/game-feedback.js",
  "./js/game-onboarding.js",
  "./js/game-arena-carve.js",
  "./js/game-bootstrap.js",
  "./boss-art.js",
  "./stella-ball-pixel-ui.js",
  "./stella-ball-dawn.js",
  "./outer-observer.js",
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

// Every runtime function has one definition. Cross-file behavior belongs in
// StellaRuntime hooks or a registered module strategy instead of a global
// replacement whose effective implementation depends on script order.
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
const overriddenNames = [...definitions]
  .filter(([, sites]) => sites.length > 1)
  .map(([name]) => name);
if (overriddenNames.length) {
  throw new Error(
    `Global function replacements are forbidden: ${overriddenNames.join(", ")}`,
  );
}
const functionNames = new Set(definitions.keys());
const functionAliasAssignments = [];
for (const script of scriptPaths) {
  const body = readFileSync(resolve(root, "prototypes", script), "utf8");
  body.split("\n").forEach((line, index) => {
    const match = /^([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\s*;/.exec(line);
    if (match && functionNames.has(match[2]))
      functionAliasAssignments.push(
        `${match[1]} = ${match[2]} at ${script}:${index + 1}`,
      );
  });
}
if (functionAliasAssignments.length) {
  throw new Error(
    "Global function alias replacements are forbidden:\n  " +
      functionAliasAssignments.join("\n  "),
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

const deferredFigureCases = {
  kill: probeDeferredFigureResolution("kill"),
  refund: probeDeferredFigureResolution("refund"),
  fail: probeDeferredFigureResolution("fail"),
};
for (const [outcome, probe] of Object.entries(deferredFigureCases)) {
  if (!probe.beforeCast.run || !probe.beforeCast.pending)
    throw new Error(`${outcome}: final-shot verdict was not deferred.`);
}
if (!deferredFigureCases.kill.afterCast.battleComplete)
  throw new Error("kill: constellation kill did not win the battle.");
if (
  !deferredFigureCases.refund.afterCast.run ||
  deferredFigureCases.refund.afterCast.shots !== 1
)
  throw new Error("refund: constellation refund did not continue the battle.");
if (deferredFigureCases.fail.afterCast.run)
  throw new Error("fail: unresolved final shot did not end the battle.");

const moduleProbe = probeRuntimeModules();
if (
  moduleProbe.version !== 1 ||
  !moduleProbe.modules.includes("combat") ||
  !moduleProbe.modules.includes("figure") ||
  !moduleProbe.modules.includes("render") ||
  !moduleProbe.combatApiFrozen ||
  !moduleProbe.figureApiFrozen ||
  !moduleProbe.renderApiFrozen
) {
  throw new Error("Runtime module APIs are missing or mutable.");
}
if (moduleProbe.priorityOrder.join(",") !== "high,low")
  throw new Error("Runtime hook priority order is unstable.");
if (!moduleProbe.unknownHookRejected || !moduleProbe.duplicateModuleRejected)
  throw new Error("Runtime registry accepted an invalid contract.");

console.log(
  JSON.stringify(
    {
      result: "passed",
      runtimeScripts: actualScripts.length,
      overriddenGlobals: overriddenNames.length,
      stylesheets: actualStyles.length,
    },
    null,
    2,
  ),
);

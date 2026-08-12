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
      stylesheets: actualStyles.length,
    },
    null,
    2,
  ),
);

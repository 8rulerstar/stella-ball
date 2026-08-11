#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const readJson = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const withoutShield = (files) =>
  files.filter((file) => !file.includes("shield"));
const pack50 = withoutShield(
  readJson("assets/library/PACK50_MANIFEST.json").assets.map(
    (item) => item.file,
  ),
);
const restyleAssets = withoutShield(
  readJson("assets/library/RESTYLE_MANIFEST.json")
    .assets.map((item) => item.file)
    .filter((file) => !file.includes("/fx/")),
);
const static50 = [...pack50, ...restyleAssets].slice(0, 50);
const animation50 = withoutShield(
  readJson("assets/library/ANIM100_MANIFEST.json").sheets.map(
    (item) => item.file,
  ),
).slice(0, 50);
const restyleFx = readdirSync(join(root, "assets/library/restyle/fx"))
  .filter((name) => name.endsWith(".png"))
  .map((name) => `library/restyle/fx/${name}`);
const baseFx = readdirSync(join(root, "assets/library/fx"))
  .filter(
    (name) => name.endsWith(".png") && !name.startsWith("core-break-signature"),
  )
  .map((name) => `library/fx/${name}`);
const animatedFx = readdirSync(join(root, "assets/library/anim/fx"))
  .filter((name) => name.endsWith(".png"))
  .map((name) => `library/anim/fx/${name}`);
const visual50 = withoutShield([...animatedFx, ...baseFx, ...restyleFx])
  .sort()
  .slice(0, 49)
  .concat("library/fx/core-break-signature-512.png");
const sfx50 = readJson("assets/audio/SFX50_MANIFEST.json").cues.map(
  (item) => item.file,
);
const groups = {
  assets: static50,
  animations: animation50,
  visualEffects: visual50,
  sfx: sfx50,
};
for (const [name, files] of Object.entries(groups)) {
  if (files.length !== 50)
    throw new Error(`${name} expected 50, received ${files.length}`);
  for (const file of files)
    if (!existsSync(join(root, "assets", file)))
      throw new Error(`Missing ${name} file: assets/${file}`);
}
const manifest = {
  name: "Prism Breakers Production Library 50×4",
  intent:
    "Reusable, reviewed asset candidates. Only curated runtime cues are imported by the vertical slice.",
  counts: Object.fromEntries(
    Object.entries(groups).map(([name, files]) => [name, files.length]),
  ),
  groups,
  runtimeSelection: {
    vfx: [
      "library/fx/prism-impact.png",
      "library/fx/rune-shockwave.png",
      "library/fx/prism-comet.png",
      "library/fx/core-break-signature-512.png",
    ],
    sfx: [
      "audio/sfx50/wall-03.wav",
      "audio/sfx50/unit-03.wav",
      "audio/sfx50/weak-03.wav",
      "audio/sfx50/riposte-03.wav",
      "audio/sfx50/ability-05.wav",
      "audio/sfx50/mult-03.wav",
    ],
  },
};
writeFileSync(
  join(root, "assets/library/PRODUCTION_50X4_MANIFEST.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  JSON.stringify({ result: "passed", counts: manifest.counts }, null, 2),
);

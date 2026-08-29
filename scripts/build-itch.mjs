import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const output = resolve(
  process.argv[2] || join(root, "dist", "stella-ball-itch.zip"),
);
const stage = mkdtempSync(join(tmpdir(), "stella-ball-itch-"));

try {
  mkdirSync(dirname(output), { recursive: true });
  cpSync(join(root, "prototypes"), join(stage, "prototypes"), {
    recursive: true,
  });
  cpSync(join(root, "assets"), join(stage, "assets"), { recursive: true });

  const gameHtml = readFileSync(
    join(root, "prototypes", "prism-breakers.html"),
    "utf8",
  );
  const indexHtml = gameHtml.replace(
    '<meta charset="utf-8" />',
    '<meta charset="utf-8" />\n  <base href="./prototypes/" />',
  );
  if (indexHtml === gameHtml) {
    throw new Error(
      "Could not inject the itch base URL into the game document.",
    );
  }
  writeFileSync(join(stage, "index.html"), indexHtml);

  rmSync(output, { force: true });
  const archive = spawnSync(
    "tar",
    [
      "-a",
      "-c",
      "-f",
      output,
      "-C",
      stage,
      "index.html",
      "prototypes",
      "assets",
    ],
    { encoding: "utf8" },
  );
  if (archive.status !== 0) {
    throw new Error(archive.stderr || "tar failed to create the itch archive.");
  }

  console.log(output);
} finally {
  rmSync(stage, { recursive: true, force: true });
}

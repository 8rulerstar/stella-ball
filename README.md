# Stella Ball

English · [한국어](README.ko.md)

A browser action-strategy prototype. On a top-down billiards battlefield you roll a meteor
together with three starkeepers to make starlight, and every shot you choose whether that
starlight goes into **this aim** or stays behind as a **constellation** — while you work your
way through the void colossi.

> **About this public repository** — this is the public build of Stella Ball. The code is MIT
> (`LICENSE`); the art and music under `assets/` keep their own terms (`assets/ATTRIBUTION.md`).
> Files from third-party asset packs that do not permit redistribution were removed from both
> the working tree and the git history. The runtime never referenced them, so the game still
> runs as it did.

## Play

No login, no install — it runs straight from GitHub Pages:

`https://8rulerstar.github.io/stella-ball/prototypes/prism-breakers.html`

1. The main screen shows your current mission and constellation progress. Press
   `별자리 관측 시작` (Start observing) to begin.
2. Form a party from the starting starkeepers — Saetbyeol, Mirinae and Yunseul. Gold from
   clearing a normal stage pays for `별빛 소환` (starlight summon), which unlocks one of the
   remaining starkeepers outright. The `무기` (weapon) tab of the same screen summons weapons
   with gold: generic ones fit any starkeeper, and rarer signature weapons drop at a low rate.
   Equip them per starkeeper in the `무기고` (armoury) tab to raise settle-attack damage.
   **A signature weapon on its rightful owner is far stronger.**
3. **Aiming** — **the first shot of every battle is a pull-and-release of the meteor downward.**
   After that, once the meteor stops, left-click **three or more** of the starkeepers on the
   board and the starlight left on it, then fire with `Space` or the fire button under the
   power gauge on the right. Direction is the centroid of the nodes you picked and power is how
   far apart they are, so **the wider you spread your picks, the harder the shot.** Clicking an
   empty spot fires the opposite way; right-click or `Backspace` clears the selection. On boards
   with fewer than three pickable lights, it falls back to drag-firing. Power is shown by the
   vertical gauge on the right, not by a number on the board.
4. **Resonance and awakening** — when the meteor hits a starkeeper it resonates **automatically**
   and leaves starlight at that spot. A starkeeper that actually rolled wakes up and performs its
   own settle attack where it came to rest. During flight, left/right clicks bend the trajectory
   once per shot in total.
5. **Constellations** — if three or more pieces of starlight are left **unused** by your aim, they
   form a 3–7 point constellation at the end of the shot and trigger one of eight abilities:
   splash damage, piercing, weak-point marking, shell breaking, flight, awaken-everyone,
   triple-strike, or meteor +1. Picked starlight becomes aim, left starlight becomes a
   constellation — one choice, two outcomes.
6. During battle, `ESC` or the pause button at the top left stops the game and opens settings.

**The whole game is playable without a mouse**: arrow keys move between nodes, `Enter` picks or
cancels one, `F` fires the opposite way, `Backspace` clears everything, and `Space` fires.

On a first run, Luna's observation lesson (13 cards) opens first. Every card waits for a button
press, each rule is explained before it can first trigger, and the last card states a goal rather
than a rule ("Let's go put the colossus down") — what follows is the real fight. The lesson
opponent is a training-ground dummy, not the final boss.

## Development process and verification records

These documents are written in Korean.

- [Documentation index / reading order](DOCUMENTATION_INDEX.md)
- [Game direction](GAME_DIRECTION.md)
- [Art asset plan](ASSET_PLAN.md)
- [Design and asset production backlog](ASSET_BACKLOG.md)
- [Asset manifest](assets/ASSET_MANIFEST.json)
- [Asset attribution](assets/ATTRIBUTION.md)
- [Running handover notes](PROJECT_CONTEXT.md)
- [Latest progress report / next-session handover](PROGRESS_REPORT.md)
- [Runtime architecture and where to change what](prototypes/ARCHITECTURE.md)
- [Dawn Observatory UI kit (current theme)](UI_KIT_DAWN.md)
- [Codex collaboration log / submission original](CODEX_COLLABORATION.md)
- [Daily devlog](DEVLOG.md)
- [Development history and verification rules](EVIDENCE_PROTOCOL.md)

On every push to `main`, GitHub Actions runs the static checks and the feature-marker checks, and
keeps a verification report — carrying the commit SHA and a UTC timestamp — as an Actions
artifact. The GitHub Pages deploy runs from the same commit.

## One-click run

- **macOS**: double-click `RUN_STELLA_BALL.command`.
- **Windows**: double-click `PLAY_WINDOWS.cmd`.

Both open Stella Ball in your default browser with no install and no server to start. The
`index.html` at the repository root also jumps straight to the same game.

## Local development

You need Node.js 20 or newer on macOS or Windows. The project has no external npm dependencies,
so `npm install` is not needed.

```sh
git pull --ff-only
npm run check
npm run serve
```

Then open `http://127.0.0.1:4173/`. `npm run check` runs the static checks together with the
runtime contract checks. `npm run format:check` checks formatting and `npm run format` applies it.

For the rules on continuing the same repository across Windows, macOS and Linux — and the
per-OS start commands — follow the [cross-platform guide](CROSS_PLATFORM.md).

## Scope

This is a core-play prototype. The campaign runs from Aries (3 points) to the Big Dipper
(7 points) — seven constellation worlds, 34 stages in total — and each world opens from its
leftmost node onward, with a final `8-1` after them. `1-1` is the first-run onboarding, and
Aries' `1-2` / `1-3` add two guide stars to the first resonance so that one 3-point constellation
is guaranteed. Every other battle builds difficulty out of boss HP, starting layout and gimmicks.
The party is three from the start; clearing a normal stage always pays 100 gold, and
`별빛 소환` spends 100 gold to unlock one starkeeper you do not own yet. Paid currency, gacha
duplicates and real-time multiplayer are not implemented. The `무한 훈련장` (endless training
ground) is a QA battlefield for physics and abilities, not a score board: enter it from the
button under the hub map, and it puts the colossus dead centre on an empty board with a party
of four.

# Asset attribution

This project ships only the selected game-ready files listed in `ASSET_MANIFEST.json`, not the source packs.

## Third-party pixel art

- **brackeys_vfx_bundle / predrawn** — CC0. Pixel VFX spritesheets used for impact, electric ring, and star explosion.

### Removed from this public repository

This repository is the public build of the project. Files from two purchased/downloaded packs
were removed from the working tree **and from the whole git history**, because both licences
allow shipping the art inside a game build but forbid redistributing the asset files
themselves — crediting does not lift that:

- **Tiny Swords (Free Pack / Enemy Pack)** — Pixel Frog. Previously used for one unused boss
  still, two unused terrain rocks, and a staging folder (`assets/import/**`) that the game
  never loaded. None of them were referenced by the runtime, so the game builds and plays
  without them.
- **Tiny RPG Character Asset Pack (Free Soldier & Orc)** — Zerie. Covered
  `characters/cute/taeo-orc-token.png` only, which the runtime no longer referenced either.
  The eight playable starkeeper sheets are the project owner's own art (see below).

## Original project assets

- `assets/original/prism-orb.svg`
- `assets/original/rune-glyphs.svg`
- `assets/original/weakpoint.svg`
- `assets/original/sky/constellation-reaction-overlay.png` — OpenAI image generation, project-owner-approved transparent pixel overlay (2026-08-23). Generated for this project and locally resized with nearest-neighbour sampling.
- `assets/enemies/void-wisp.png` and `assets/library/**` — OpenAI image generation, chroma-key background removed locally.
- `assets/library/constellations/*.png` — project-owner-commissioned procedural generation (2026-08-13, the 6- and 7-point pair on the same order). It is used only by the training-table constellation reveal. The 6- and 7-point sheets regenerate from `scripts/generate_constellation_art_6_7.mjs`. The project owner retains the original-asset rights; third-party redistribution terms are 미정.
- **The eight starkeeper sheets and their action sheets** — created by the project owner, 2026-08-13. Covers `characters/gaon-warrior-idle.png`, `biyeon-archer-idle.png`, `lumi-shaman-idle.png`, `haru-lancer-idle.png`, `ria-bladewheel-idle.png`, `sera-monk-idle.png`, `taeo-orc-idle.png`, `nyx-oracle-idle.png` and all sixteen `characters/anim/*-roll.png` / `*-attack.png`. No third-party pack terms apply to these; the filenames keep their old class words only because the hero ids never changed.

- `assets/library/boss10/*.png` and `assets/library/anim/boss10/*.png` — project-owner-commissioned procedural generation (2026-08-13). Ten colossi, each with a still, a weak-point gem and four 4-frame state sheets. All sixty files rebuild from `scripts/generate_boss_pack_10.mjs`, whose dot definitions live in `scripts/boss-pack-core.js`; the art is not hand-edited. The project owner retains the original-asset rights; third-party redistribution terms are 미정.
- `assets/audio/sfx50/*.wav` — the `sfx50-*` / non-prefixed files are synthesised from scratch by two scripts in this repository and contain no recorded or sampled material: `scripts/generate_sfx_pack50.py` for the original fifty, and `scripts/generate_sfx_parry.py` (2026-08-13) for the eleven parry, starlight, constellation and summon cues. Both are deterministic and use only the Python standard library, so every synthesised file here can be rebuilt from source. **Exception — the eight `wcf-*.wav` files** (`wcf-shoot`, `wcf-parry`, `wcf-hit-boss`, `wcf-hit-player`, `wcf-levelup`, `wcf-pickup`, `wcf-click`, `wcf-upgrade`, added 2026-08-24) are the project owner's own SFX imported from their `D:\Work\WCF` game at the owner's direction and confirmed as owner-held; they are not repo-synthesised.
- **BGM files (2026-08-24).** `assets/audio/bgm/` now holds real tracks played by `prototypes/js/game-bgm.js` per scene (title→`title.ogg`, hub/menu→`hub.ogg`, battle→`battle.ogg`); the Web-Audio observatory score (`startObservatoryScore`) remains as a ducked ambient bed. `hub.ogg` (=WCF `bgm_boss1`) and `battle.ogg` (=WCF `bgm_wave1`) are the owner's own assets from `D:\Work\WCF`, imported at the owner's direction and confirmed as owner-held. `title.ogg` is `Week 10 - Mischief MELODY` from Tallbeard Studios' [Music Loop Bundle](https://tallbeard.itch.io/music-loop-bundle), composed by **Abstraction**. That bundle is released under **CC-0**, which permits commercial use and redistribution of the audio files; the credit here is the courtesy attribution the author asks for. `title-ambient.mp3` (TaleSurviver "Traveling the Sky") is no longer scene-assigned and remains only as a runtime fallback.

These files were created for Prism Breakers and may be modified with the game.

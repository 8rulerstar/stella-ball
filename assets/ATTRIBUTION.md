# Asset attribution

This project ships only the selected game-ready files listed in `ASSET_MANIFEST.json`, not the source packs.

## Third-party pixel art

- **Tiny Swords (Free Pack / Enemy Pack)** — Pixel Frog. Boss and terrain selections. The project owner supplied these packs; preserve the applicable source-pack terms before commercial release or redistribution beyond this game build.
  - The eight playable starkeeper sheets used to come from here too. They were replaced on 2026-08-13 by the project owner's own art — see "Original project assets" below.
  - `assets/import/**` is a staging area of additional Tiny Swords selections (bosses, avatars, UI, props, FX) not yet wired into the game. Same terms as above; see `assets/import/IMPORT_NOTES.md` for the per-file source map.
- **brackeys_vfx_bundle / predrawn** — CC0. Pixel VFX spritesheets used for impact, electric ring, and star explosion.
- **Tiny RPG Character Asset Pack (Free Soldier & Orc)** — Zerie. Orc frames only, recoloured to bronze and re-celled. Now covers `characters/cute/taeo-orc-token.png` alone: the three sheets this entry also used to list (`characters/taeo-orc-idle.png`, `characters/anim/taeo-roll.png`, `characters/anim/taeo-attack.png`) were overwritten by the 2026-08-13 roster patch, and the `-orc-` in the first filename is now only a leftover. The project owner supplied the pack; preserve the source-pack terms before redistribution beyond this game build.

## Original project assets

- `assets/original/prism-orb.svg`
- `assets/original/rune-glyphs.svg`
- `assets/original/weakpoint.svg`
- `assets/enemies/void-wisp.png` and `assets/library/**` — OpenAI image generation, chroma-key background removed locally.
- `assets/library/constellations/*.png` — project-owner-commissioned procedural generation (2026-08-13). It is used only by the training-table constellation reveal. The project owner retains the original-asset rights; third-party redistribution terms are 미정.
- **The eight starkeeper sheets and their action sheets** — created by the project owner, 2026-08-13. Covers `characters/gaon-warrior-idle.png`, `biyeon-archer-idle.png`, `lumi-shaman-idle.png`, `haru-lancer-idle.png`, `ria-bladewheel-idle.png`, `sera-monk-idle.png`, `taeo-orc-idle.png`, `nyx-oracle-idle.png` and all sixteen `characters/anim/*-roll.png` / `*-attack.png`. No third-party pack terms apply to these; the filenames keep their old class words only because the hero ids never changed.

These files were created for Prism Breakers and may be modified with the game.

# Asset attribution

This project ships only the selected game-ready files listed in `ASSET_MANIFEST.json`, not the source packs.

## Third-party pixel art

- **Tiny Swords (Free Pack / Enemy Pack)** — Pixel Frog. Boss and terrain selections. The project owner supplied these packs; preserve the applicable source-pack terms before commercial release or redistribution beyond this game build.
  - The eight playable starkeeper sheets used to come from here too. They were replaced wholesale on 2026-08-13 — see "Unconfirmed provenance" below.
  - `assets/import/**` is a staging area of additional Tiny Swords selections (bosses, avatars, UI, props, FX) not yet wired into the game. Same terms as above; see `assets/import/IMPORT_NOTES.md` for the per-file source map.
- **brackeys_vfx_bundle / predrawn** — CC0. Pixel VFX spritesheets used for impact, electric ring, and star explosion.
- **Tiny RPG Character Asset Pack (Free Soldier & Orc)** — Zerie. Orc frames only, recoloured to bronze and re-celled. Now covers `characters/cute/taeo-orc-token.png` alone: the three sheets this entry also used to list (`characters/taeo-orc-idle.png`, `characters/anim/taeo-roll.png`, `characters/anim/taeo-attack.png`) were overwritten by the 2026-08-13 roster patch, and the `-orc-` in the first filename is now only a leftover. The project owner supplied the pack; preserve the source-pack terms before redistribution beyond this game build.

## Unconfirmed provenance

The 2026-08-13 starkeeper roster patch replaced all 24 character sheets — eight
`characters/*-idle.png` and sixteen `characters/anim/*-roll.png` / `*-attack.png`
— and recorded no source. The files carry no metadata, and the patch's own
APPLY.md does not name an author, pack or licence.

**These files are shipped without an attribution basis.** Establish where they
came from before any release or redistribution, then move them into the section
above.

## Original project assets

- `assets/original/prism-orb.svg`
- `assets/original/rune-glyphs.svg`
- `assets/original/weakpoint.svg`
- `assets/enemies/void-wisp.png` and `assets/library/**` — OpenAI image generation, chroma-key background removed locally.

These files were created for Prism Breakers and may be modified with the game.

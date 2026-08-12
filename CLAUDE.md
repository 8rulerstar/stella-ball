# Stella Ball session note

Read `AGENTS.md` first; it is the authoritative runtime and verification guide.

## Ink & Brass UI theme

- The active theme is `prototypes/stella-ball-theme.css`.
- It must remain the final stylesheet imported by `prototypes/prism-breakers.html`.
- Its design rationale, palette, UI colors, and follow-up recipes are in `UI_REDESIGN_HANDOFF.md`.
- Preserve `heroes[].col` for canvas/gameplay readability. Use the `--sb-*` variables only for UI surfaces.
- Do not revive `prism-breakers-themed.html`; it was an old single-file reference and would duplicate the maintained modular runtime.

Before handing off, run `npm run verify` and `npm run smoke`.

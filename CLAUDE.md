# Stella Ball session note

Read `AGENTS.md` first; it is the authoritative runtime and verification guide.

## Documentation order

- Read `DOCUMENTATION_INDEX.md` before editing project records.
- `PROJECT_CONTEXT.md` is the current gameplay/status source of truth; `PROGRESS_REPORT.md` is the concise handoff.
- Update `CODEX_COLLABORATION.md` only for facts that are actually implemented and verified. Keep Hive Console and the current-physics bot marked unfinished until their real gates pass.
- Keep historical wording in `DEVLOG.md`; record new work as a dated entry instead of rewriting old decisions.

## Deferred art intake

- `ASSET_BACKLOG.md` is the single source of truth for visual asset, animation, icon, and SFX needs found during feature work.
- Do not create or import a new visual asset during ordinary implementation. Add a scoped backlog entry, use an existing asset or temporary code/CSS representation, and wait for a batch-art instruction.
- When a batch is approved, promote only `제작 준비` entries and update `ASSET_PLAN.md` plus `assets/ASSET_MANIFEST.json` when assets are actually added.

## Ink & Brass UI theme

- The active theme is `prototypes/stella-ball-theme.css`.
- It must remain the final stylesheet imported by `prototypes/prism-breakers.html`.
- Its design rationale, palette, UI colors, and follow-up recipes are in `UI_REDESIGN_HANDOFF.md`.
- Preserve `heroes[].col` for canvas/gameplay readability. Use the `--sb-*` variables only for UI surfaces.
- Do not revive `prism-breakers-themed.html`; it was an old single-file reference and would duplicate the maintained modular runtime.

Before handing off, run `npm run verify` and `npm run smoke`.

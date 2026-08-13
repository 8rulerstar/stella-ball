# Stella Ball technical-debt register

> Updated: 2026-08-13. Priority is `(impact + risk) × (6 - effort)` on a 1–5 scale. Higher scores are handled first; effort 5 intentionally lowers the score of disruptive rewrites.

## Current priorities

| Priority | Debt                                                                                          | Type              | Impact | Risk | Effort | Why it matters                                                                                     | Remediation alongside feature work                                                                                                     |
| -------: | --------------------------------------------------------------------------------------------- | ----------------- | -----: | ---: | -----: | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
|       30 | Browser automation does not yet cover the full six-step onboarding and guaranteed pentagram   | Test              |      5 |    5 |      3 | The highest-value first-session presentation still relies on manual regression checks              | Add one deterministic browser path when the onboarding flow next changes; keep the runtime harness for physics branches                |
|       24 | Hook payload shapes are conventions rather than checked schemas                               | Architecture/Test |      4 |    4 |      3 | A renamed payload field can silently break a distant reaction even though hook names are validated | Add focused payload assertions to the harness when each hook is touched; introduce schema helpers only after repeated shapes emerge    |
|       24 | There is no recorded frame-time or allocation budget in CI                                    | Test/Performance  |      4 |    4 |      3 | Functional tests cannot catch a gradual return of per-frame allocation or expensive canvas work    | Add deterministic counters first; add timing thresholds only on a stable runner to avoid flaky checks                                  |
|       24 | Current facts are repeated across context, progress, collaboration, and maintenance documents | Documentation     |      3 |    3 |      2 | Rule changes can leave plausible but stale descriptions in secondary documents                     | Treat `PROJECT_CONTEXT.md` and `ARCHITECTURE.md` as sources, and update secondary documents only when their stated purpose requires it |
|        4 | Native ES modules and static import analysis are unavailable                                  | Architecture      |      2 |    2 |      5 | The classic-script facade cannot provide build-time dependency checks                              | Reconsider only if direct-file Windows launch is intentionally replaced by a build-and-serve distribution                              |

## Completed in the 2026-08-13 maintenance passes

| Resolved debt                            | Result                                                                                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Global function replacement chains       | Reduced from 37 names to 0; `npm run smoke` now rejects every duplicate definition and function-alias replacement       |
| Per-dispatch hook-list copies            | Hooks now use immutable copy-on-write snapshots, so frame dispatch performs no callback-list copy                       |
| Clone-ball cleanup allocation            | Physics compacts `cloneBalls` in place and uses squared settle comparisons                                              |
| Cross-file arena replacement             | `game-arena-carve.js` installs an owner-controlled `render` strategy                                                    |
| Hidden Figure/combat/onboarding coupling | Replaced with frozen minimal APIs and validated lifecycle hooks                                                         |
| 1,700–2,300-line mixed owner files       | Extracted meta state, combat physics, and figure recognition into ordered sub-owner files with smoke-checked load order |

## Phased remediation rule

1. **Every feature change:** add or update the smallest harness assertion for the owner and its hook payload; do not add global replacements.
2. **When an owner file is already being changed:** extract one stable sub-owner only if the change crosses that boundary. Update script order, architecture, portability, and smoke contracts together.
3. **Before a release:** run `npm run check`, formatting, whitespace, the runtime sweep, and the browser onboarding path. Record performance numbers only when the runner and scenario are identical.
4. **Only after distribution changes:** evaluate native ES modules or bundling. Do not pay that migration cost while direct-file launch remains a product requirement.

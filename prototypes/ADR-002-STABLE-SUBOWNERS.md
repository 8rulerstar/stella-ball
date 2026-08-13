# ADR-002: Stable sub-owner files for large classic-script domains

**Status:** Accepted
**Date:** 2026-08-13
**Deciders:** Product owner and runtime maintainer

## Context

ADR-001 removed global replacement chains and established validated hooks, but three domain owners still mixed multiple reasons to change in files of roughly 1,700–2,300 lines. Meta persistence and economy lived beside screen markup, combat input and abilities lived beside the collision solver, and constellation recognition math lived beside outcomes and presentation. Those mixtures made navigation, focused review, and future tests unnecessarily expensive.

The product must still support direct-file Windows launch. A build step, native-module migration, or broad state rewrite is outside the current distribution contract.

## Decision drivers

- Reduce the size and responsibility count of the largest runtime files.
- Preserve behavior, save data, global names, and direct-file launch.
- Make the dependency order explicit and mechanically verified.
- Split only at boundaries that already have distinct reasons to change.
- Avoid speculative micro-files that would increase load-order coupling.

## Options considered

| Option                                   | Benefits                                          | Costs and risks                                                             |
| ---------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------- |
| Keep the owner files intact              | No script-order changes                           | Large mixed files remain difficult to navigate and test                     |
| Convert the runtime to native ES modules | Static imports and stronger encapsulation         | Breaks the current direct-file contract and requires a broad migration      |
| Split every feature into a small script  | Very small files                                  | Excessive global-scope and ordering edges; ownership becomes fragmented     |
| Extract three stable sub-owners          | Smaller coherent files with limited order changes | Classic scripts still share one global scope and require order verification |

## Decision

Extract three paired sub-owner boundaries while retaining ordered classic scripts:

1. `game-meta-state.js` owns persistence, progress, economy, rewards, audio, and achievement state; `game-meta.js` owns the screens that present and mutate that state.
2. `game-combat.js` owns combat input, scoring, abilities, clone behavior, and awakening presentation; `game-combat-physics.js` owns collision rules, stage gimmicks, shot settlement, solver, and prediction.
3. `game-figure-recognition.js` owns parry traces, templates, normalization, matching, and classification; `game-figure.js` owns outcomes, deferral, and presentation.

The pairs load state/definition before consumer and remain adjacent in `prism-breakers.html`. The smoke test, verifier, portability checker, and runtime harness all carry the same ordered list. No new public mutable state or global function replacement is introduced.

## Consequences

### Positive

- The former 1,700–2,300-line files are reduced to focused owners of roughly 550–1,400 lines.
- Persistence rules, collision math, and recognition algorithms can be reviewed without unrelated screen or presentation code.
- Script-order drift or an omitted sub-owner fails automated verification.
- Existing URLs, saves, runtime APIs, hooks, and launch paths are unchanged.

### Negative

- The split files still share global lexical bindings because the runtime remains classic-script based.
- Some calls intentionally resolve functions declared in the adjacent later script at runtime, so the documented order remains a hard contract.
- Isolated unit loading still needs a harness that supplies the preceding classic-script owners.

## Follow-up actions

- [x] Add all three sub-owner files to the HTML, verifier, smoke test, portability checker, and runtime harness.
- [x] Update contributor, architecture, maintenance, asset-connection, and technical-debt documentation.
- [x] Keep zero duplicate global definitions and replacements in the combined runtime.
- [ ] Add focused tests for recognition geometry and collision helpers when those rules next change.
- [ ] Reassess native modules only if direct-file launch is intentionally retired.

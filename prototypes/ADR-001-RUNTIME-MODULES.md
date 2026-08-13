# ADR-001: Classic-script runtime modules and lifecycle hooks

**Status:** Accepted
**Date:** 2026-08-13
**Deciders:** Product owner and runtime maintainer

## Context

Stella Ball must continue to run by opening the repository entry point directly on Windows. The browser runtime therefore uses ordered classic scripts and one shared global scope rather than a bundler. That constraint kept distribution simple, but later files accumulated chains that replaced functions owned by earlier files. Before this change, 37 global names had multiple definitions or wrappers. The effective behavior depended on load order, private state leaked across owners, and a missed predecessor call could silently disable an earlier feature.

The runtime needs explicit maintenance boundaries without breaking direct-file launch, saved data, or the established script order.

## Decision drivers

- Preserve direct-file Windows launch and the existing no-build distribution.
- Make cross-file dependencies discoverable and fail fast on misspelled contracts.
- Keep mutable battle state under its existing owner during incremental migration.
- Preserve deterministic ordering for feedback and onboarding reactions.
- Allow gradual migration instead of requiring a risky whole-runtime rewrite.

## Options considered

| Option                                   | Complexity | Benefits                                                                                                     | Costs and risks                                                                                             |
| ---------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Native ES modules plus a bundler         | High       | Strong import/export boundaries and mature tooling                                                           | Changes launch and release workflows, requires a build artifact, and makes a broad migration a prerequisite |
| Per-file global namespaces only          | Low        | Small mechanical change and direct-file compatibility                                                        | Does not solve reaction ordering, mutable exports, or silent wrapper chains                                 |
| Classic-script registry plus named hooks | Medium     | Direct-file compatible, explicit frozen APIs, validated events, deterministic ordering, incremental adoption | Retains one global runtime facade and requires temporary legacy compatibility                               |

## Decision

Adopt a classic-script-compatible `StellaRuntime` facade in `game-runtime.js`, loaded immediately after `game-platform.js`.

1. A file may register one small public API with `StellaRuntime.modules.register()`. The registry copies and freezes the API. Duplicate names and missing required modules throw immediately.
2. Cross-cutting reactions use a closed set of named hooks. Broadcast, first-answer, and consumed-action semantics are separate operations (`emit`, `query`, and `handled`). Priorities are explicit and stable.
3. Module APIs expose behavior or immutable timing values, never mutable owner state. At present, `combat`, `figure`, and `onboarding` are the public module boundaries.
4. Cross-file work may not replace a global function. The runtime smoke test fails on every duplicate function definition.
5. The ordered classic scripts remain the deployment unit. Native modules can be reconsidered only if direct-file launch is intentionally replaced by a build step.

## Consequences

### Positive

- Combat, Figure, onboarding, feedback, and session reactions no longer depend on long wrapper chains for their main lifecycle integration.
- Contract typos, duplicate module registration, mutable public APIs, and unstable hook order now fail in automated smoke tests.
- Owners can change private implementations without requiring callers to know local variables or wrapper order.
- The migration is compatible with existing saves, assets, URLs, and the Windows launcher.

### Negative

- `StellaRuntime` is still a global facade because classic scripts have no native import graph.
- The runtime still uses one shared global scope, so unqualified mutable state remains possible inside owner files even though function replacement is forbidden.
- Hook payloads are runtime-checked by tests and naming discipline rather than a static type checker.

## Follow-up actions

- [x] Add the registry before shared game data.
- [x] Migrate battle, shot, damage, wall, parry, Figure, assist, victory, and onboarding wrapper chains to named hooks.
- [x] Publish minimal frozen APIs for combat, Figure, and onboarding.
- [x] Add registry, ordering, immutability, and override-debt smoke checks.
- [x] Move render extensions to named draw hooks or the owner-controlled `render` strategy.
- [x] Remove the remaining physics, render, feedback, and menu forward declarations and replacements.
- [ ] Reassess native ES modules only if the product adopts a build-and-serve-only launch contract.

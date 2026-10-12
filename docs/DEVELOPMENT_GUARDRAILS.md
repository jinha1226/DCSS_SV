# DEVELOPMENT_GUARDRAILS.md — mandatory implementation protocol

> **MUST READ before every code change.** This document overrides speed-driven implementation shortcuts. A successful GitHub commit is NOT proof of a working feature.

## 0. Required start of every task
1. Read this file, docs/IMPLEMENTATION_2RUNE.md, package.json, and current HEAD.
2. Inspect the complete implementation and direct callers, consumers, tests and data files. Search references before editing types, World, stairs, timers, packs or rendering.
3. Write a brief impact map: changed interfaces, dependent modules, migration needs, likely regressions.
4. State an observable acceptance criterion and add regression tests before claiming completion.

## 1. Invariants (do not silently change)
- Stationary-only SUPERHOT pause, automatic basic attacks, manual abilities/consumables.
- Stable seed reproducibility and no duplication of XP, monsters, items, or floor rewards.
- Existing WorldOptions and public World/SimEvent interfaces remain compatible with callers; additions must be integrated with every consumer.
- Dungeon branches must use unique (branch, floor) identities. Do not overload linear depth for combat scaling or UI without explicit mapping.
- Floor revisits retain time, exploration, enemies, items, spawn pressure and stair identities; no instant stair bounce.
- Pursuers grant no XP, kill-heal or item drops. Deadline should use simulation time, not wall time.
- Zot is gated by two distinct runes, not merely depth; no victory from entering final floor.
- Do not introduce a feature that depends on assets/tiles not present in the repository.

## 2. Mandatory workflow (each stage)
A. Baseline: run npm ci; npm run check; npm run build and record existing failures.
B. Scope: list files and interfaces; examine actual runtime tick gating, rendering, item-drop and XP paths.
C. Implement: small coherent changes, no broad string replacement without reviewing resulting code; prefer isolated modules with tests.
D. Tests: unit tests for graph and deterministic seeds; integration tests for stair traversal, save/restore, timer, rewards; regression tests for previous behavior.
E. Verify: npm run check; npm run build; if game/UI affected, smoke test in browser/mobile viewport.
F. Commit only after passing checks, or explicitly mark UNVERIFIED with error details; never report completion based on commit alone.
G. Update docs/IMPLEMENTATION_2RUNE.md with evidence, test command/results, commit and remaining risks.

## 3. Required regression scenarios
- Stay on arrival stair for >2 seconds: never auto-bounce. Leave and re-enter: traversal works.
- Multiple down stairs: each mapped to a stable destination; return to matching source stair.
- Travel 1→2→1→2 repeatedly: identical monsters, dropped items, seen tiles, floorTime and no duplicate rewards.
- Seed A/B: deterministic mutually exclusive Snake/Spider and Swamp/Shoals; every mandatory node reachable.
- Stationary pause, skill-choice pause and explicit action time behavior; deadline boundary 179.9/180.0/180.1 seconds.
- Pursuer kills: zero XP, zero kill-heal, zero drops; normal monster kills retain rewards.
- All existing WorldOptions and direct makeWorld/stepWorld tests still work.
- UI correctly displays branch/depth, rune progress and stair destination.

## 4. Blockers and reporting
If tools cannot execute tests, do NOT claim tests passed or functionality complete. Keep work in a branch or report precisely what was committed and unverified. Do not proceed with dependent stage while a known critical regression remains. User design review is deferred until full implementation, but engineering verification is mandatory at every stage.

## 5. Stage sign-off template
- Scope and impact map:
- Baseline checks:
- New tests and result:
- Full check/build result:
- Manual smoke result:
- Commit:
- Known limitations:
- Status: VERIFIED / UNVERIFIED / BLOCKED

# DEVELOPMENT_GUARDRAILS.md — mandatory implementation protocol

> **MUST READ before every code change.** This document overrides speed-driven implementation shortcuts. A successful GitHub commit is NOT proof of a working feature.

## 0. Required start of every task
1. Read this file, docs/IMPLEMENTATION_2RUNE.md, docs/SKILL_TRAINING.md, package.json, and current HEAD. docs/README.md lists which documents are current and which are past records.
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

## 6. Standing project rules (carried over from CODEX_PROMPT.md §2)
- DCSS is a reference only. Tiles are the only copied assets; never copy DCSS code, vault files or description text. Design numbers and generation ourselves.
- Every added tile is checked against `TILES_UNDER_UNKNOWN_LICENSE.md` in <https://github.com/crawl/tiles>, recorded in docs/TILES.md, then packed with `npm run tiles`. `assets/tiles` holds original DCSS PNGs only.
- Structure: `src/sim` is rules only and never touches DOM or canvas. Numbers live in `src/data` (JSON); behaviour lives in code and is linked by name. Drawing in `src/view`, input in `src/input`, DOM UI in `src/ui`, entry point in `src/app`.
- Files stay under 500 lines (ESLint enforces). Do not cram code onto one line; run `npm run format` before every push. Never disable the format check or add sources to `.prettierignore`.
- Push one commit at a time; consecutive pushes cancel each other's deploy runs. Confirm the Actions run afterwards.
- No eye-straining effects: no full-screen flashes or shakes, no additive blending. Only the hit target flashes and shows a number.
- Keep browser page-zoom prevention intact (`src/input/guards.ts`, viewport meta, CSS `touch-action`). New buttons must not trigger double-tap or pinch page zoom. In-game camera zoom handled by our own code is a separate thing.
- Brainstorming ("what if ...") is a request for opinion, not an order to build. Build only when asked.
- `npm run bench` stays out of CI. Keep fast criteria in `tests/unit`.
- Reply to the user in plain, friendly Korean: conclusion first, short. Say plainly when something (e.g. real-phone feel) was not checked.

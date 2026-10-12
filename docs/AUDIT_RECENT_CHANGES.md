# AUDIT_RECENT_CHANGES.md — inspection of stages 2 and 3

> **지난 기록.** 2·3단계 점검 기록이다. 지적 사항은 PR #2와 이후 단계에서 해결됐다([IMPLEMENTATION_2RUNE.md](IMPLEMENTATION_2RUNE.md)). 문서 목록은 [README.md](README.md).

Date: 2026-10-12. Static source inspection only; no local install, tests, build or browser run. Status is **UNVERIFIED**.

## Stage 2: floor persistence / ascending stairs — commit 7d0caba
**Observed:** World.floorStates stores grid, rooms, seen, monsters, groundItems, floorTime, nextBand. Up stairs are traversable, and new floors are generated using floorSeed(seed, depth).

**Critical defects / risks:**
1. **Automatic stair bounce:** traverse() enters a new floor at its StairsUp tile, sets descending=0, but stairsUnderfoot() immediately starts counting while standing on StairsUp. After DUNGEON.descend (0.7s), the player returns to the prior floor without input. No cooldown or leave-to-rearm check exists.
2. **No stable per-stair destination mapping:** only depth +/- 1 and one mutable returnX/returnY per floor. Multiple stairs cannot round-trip to their exact counterparts; branch entrances cannot be safely added on this foundation.
3. **Floor state lifecycle:** snapshot is captured on exit; while active, stored state is stale. It is overwritten on exit, which may be acceptable, but no invariant or regression test establishes this. Runtime projectiles/clouds are discarded at each transition and monster source references are not persisted.
4. **Global RNG:** w.rng is shared across all floors; revisit order affects future random encounters. A reproducibility policy is needed before graph expansion.
5. **World and event consumer compatibility:** new required World fields were added without proof that all tests, mocks, UI and serializations compile.

**Required before sign-off:** arrival stair rearm/cooldown, explicit stair edge IDs, round-trip tests, full check/build, UI smoke test.

## Stage 3: branch graph / Dungeon 9
**Observed:** prior attempt to add branchGraph.ts and update dungeon.json/world.ts was blocked before commit. Current dungeon.json still sets floors=3; current world.ts still uses linear depth. Thus **not implemented**.

**Design risks to resolve first:**
- A generated floor has three identical StairsDown; graph routing requires deterministic, visually distinguishable links and matching return points.
- packs.json is validated against DUNGEON.floors=3 and pickPack() uses numeric w.depth; increasing floor count alone would leave most new floors without appropriate encounter progression.
- spawnMonster() scales HP using w.depth; numeric branch IDs would make stats explode.
- floorSeed(), floorStates and UI events currently assume numeric depth; branch identity and depth display need a migration plan.
- Zot requires two distinct runes, and final descent must not trigger automatic victory.

**Next safe sequence:** fix and test stage 2, implement graph as isolated pure module with graph tests, migrate World identity and stairs with UI compatibility, then add branch-specific content and rune gate. No stage 3 completion claim until integrated tests/build pass.

## Stage 2 follow-up: verified code fix (2026-10-12)

The original findings above describe the state **before** pull request #2 and are preserved as the historical audit.

- Arrival stairs are disarmed until the player leaves their tile; the SUPERHOT UI permits deliberate stair-hold progression.
- Traversal records the most recently used parent stair for the single up stair on the child floor.
- Per-floor random streams and Last Stand use state now survive re-entry.
- Added 100x round-trip, monster/item/seen/timer, RNG and paused-time regression tests.
- GitHub Actions Verify passed on commit `da75f2f9d4ff75540147692746d3fb4ff5b687f5`: 27 files / 209 tests, ESLint, Prettier, TypeScript, and production build.
- Existing three down stairs still share one child floor; distinct branch links belong to stage 3.
- No interactive mobile/browser smoke test has been performed.

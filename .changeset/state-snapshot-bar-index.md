---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-compiler": patch
---

`StateSnapshot` carries an explicit `barIndex`; wire version bumped to 2

`StateSnapshot` gains a required `barIndex` — the absolute index of the last
bar folded into the snapshot, or `-1` when none — so a restored runner knows
exactly which bar it stands on. The cursor was previously derived from the
snapshot stream's `filled` count, which is exact only until the ring wraps;
`captureStateSnapshot` now stamps `barIndex` and `restoreStateSnapshot`
resumes at `barIndex + 1`, exact for saturated rings too.

`snapshotVersion` moves 1 → 2 and the runtime validator rejects version-1
payloads (they predate the field). There is no migration: a rejected snapshot
means a full replay, which is what a rejected snapshot has always meant. The
compiler's ambient script-facing mirror of the type is updated to match.

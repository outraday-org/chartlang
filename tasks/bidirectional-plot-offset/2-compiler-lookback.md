# Task 2 — Compiler: lookback adjustment + changeset cleanup

> **Status: TODO**

## Goal

Align the compiler with the Option-A display-shift model: a presentation
x-shift does not read a deeper buffer slot, so `offset` no longer
contributes to `maxLookback`. Delete the stale changeset for the old
value-read mechanism and document that the ambient core shim is unchanged:
Task 1's `PlotEmission.xShift` field lives in adapter-kit and is not
script-facing.

## Prerequisites

Task 1 (model + core types final).

## Current Behavior

- `packages/compiler/src/analysis/extractMaxLookback.ts` —
  `readCallOffset` counts a **positive** literal `opts.offset` toward
  `maxLookback` (the output ring buffer is `maxLookback + 1`, so a
  value-read offset needs the extra depth). `collectSeriesVarOffsets`
  threads the offset onto identifier-bound series so `shifted[N]` reads
  `buf.at(N + offset)`. Negative/non-literal offsets contribute `0`.
- `packages/compiler/CLAUDE.md` documents "`extractMaxLookback` counts the
  universal `opts.offset` as lookback depth".
- An **unreleased, staged** changeset
  `.changeset/compiler-offset-maxlookback.md` (compiler `patch`) describes
  exactly that behavior ("Count `opts.offset` toward `maxLookback` so
  offset-shifted series render"). This feature **reverts** that mechanism,
  so the changeset is now stale and would produce incoherent release notes
  (add-then-revert in one release).
- `packages/compiler/src/program.ts` carries the ambient core `.d.ts`
  shim. It declares the script-facing surface (`PlotOpts`, `HLineOpts`,
  `plot`, `hline`, `Bar`, etc.) — it does **not** declare `PlotEmission`,
  which is an internal emission type, not script-reachable.

## Desired Behavior (Option A)

- `offset` (any sign) contributes **0** to `maxLookback` — it is a render
  shift, not a buffer read. `readCallOffset` + `collectSeriesVarOffsets`
  are retired (or reduced to a no-op) and the `shifted[N]` stacking is
  removed.
- The compiler's `extractMaxLookback` offset note in `CLAUDE.md` is
  removed; the `bar.point` negative-literal lookback note **stays**
  (unrelated — that is a real historical buffer read).
- The stale `.changeset/compiler-offset-maxlookback.md` is **deleted**
  (`git rm`); the bidirectional changeset (Task 6) covers the compiler's
  net role.
- `program.ts` is **unchanged**: A-stay adds no script-facing type, and
  `PlotEmission.xShift` is not declared in the shim.

## Requirements

1. Remove the offset→`maxLookback` contribution (Option A): delete
   `readCallOffset`'s positive-offset return and `collectSeriesVarOffsets`,
   and the `offsetFor` stacking in the element-access walk. Keep the
   `bar.point` negative-literal path (`readBarPointLookback`) untouched.
2. Update `extractMaxLookback.test.ts`: the "counts a positive opts.offset
   on a ta.* call as lookback depth", "stacks opts.offset with a literal
   index", and "stacks opts.offset on an inline ta.* call element access"
   cases now expect `0`; keep all `bar.point` cases. Preserve 100%
   coverage (prune now-dead branches).
3. `git rm .changeset/compiler-offset-maxlookback.md` — it describes the
   now-reverted value-read mechanism.
4. Update `packages/compiler/CLAUDE.md` (remove the offset-lookback
   invariant; leave the `bar.point` one).

> `program.ts` needs no change — it never declared `PlotEmission`, and
> A-stay introduces no new script-facing type. Do not add a shim edit.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/compiler/src/analysis/extractMaxLookback.ts` | Modify | drop offset depth (Option A) |
| `packages/compiler/src/analysis/extractMaxLookback.test.ts` | Modify | offset cases now expect 0 |
| `.changeset/compiler-offset-maxlookback.md` | Delete (`git rm`) | stale — reverted mechanism |
| `packages/compiler/CLAUDE.md` | Modify | remove offset-lookback note |

## Gates

- `pnpm typecheck`, `pnpm -F @invinite-org/chartlang-compiler test` (100%
  coverage, determinism + golden tests green)

## Changeset

Rides `.changeset/bidirectional-plot-offset.md` — compiler `minor`. The
stale `compiler-offset-maxlookback.md` is removed (req 3).

## Acceptance Criteria

- `offset` contributes 0 to `maxLookback` (Option A); `bar.point` lookback
  unchanged.
- `compiler-offset-maxlookback.md` is gone; `pnpm changeset status` no
  longer lists the reverted patch.
- `program.ts` is untouched; scripts still type-check.
- Compiler suite + coverage + determinism green; CLAUDE.md updated.

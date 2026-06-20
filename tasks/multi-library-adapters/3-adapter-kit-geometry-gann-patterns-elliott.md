# adapter-kit geometry: gann, pitchforks, patterns, elliott, cycles, containers, table

> **Status: TODO**

## Goal

Complete `decomposeDrawing` with the final 23 drawing kinds — Gann,
pitchforks, harmonic patterns, Elliott waves, cycles, containers, and the
`table` viewport overlay — then replace the placeholder `default` arm
with a `never` exhaustiveness guard so all 63 `DrawingKind`s
are provably covered.

## Prerequisites

- Task 1 (foundation), Task 2 (curves/channels/fib).

## Current Behavior

After Task 2, `decomposeDrawing` covers 40 of 63 kinds (20 from Task 1 +
20 from Task 2); the remaining 23 return `[]` via the placeholder
`default`.

## Desired Behavior

All 63 kinds decompose to `DrawPrimitive[]`; the dispatcher is
exhaustive at compile time.

## Requirements

### 1. Gann — `geometry/kinds/gann.ts` (4 kinds)

`gann-box`, `gann-square-fixed`, `gann-square`, `gann-fan`. Port from
`{gannBox,gannSquareFixed,gannSquare,gannFan}.ts`. Move the
`GANN_FAN_RATIOS` / level table from
`examples/canvas2d-adapter/src/render/draw/gannLevels.ts` into
`geometry/_lib/gannLevels.ts`. Each fan ray → a `polyline`; boxes →
grid `polyline`s; reuse `_lib/fibLevels` where the source did.

### 2. Pitchforks — `geometry/kinds/pitchforks.ts` (2 kinds)

`pitchfork`, `pitchfan`. Port from `{pitchfork,pitchfan}.ts`. Move the
shared median-line geometry from
`examples/canvas2d-adapter/src/render/draw/pitchforkGeom.ts` into
`geometry/_lib/pitchforkGeom.ts`. Honor the `pitchfork` variant
(`standard | schiff | modifiedSchiff | inside`). Each tine → a
`polyline`.

### 3. Harmonic patterns — `geometry/kinds/patterns.ts` (6 kinds)

`xabcd-pattern`, `cypher-pattern`, `head-and-shoulders`, `abcd-pattern`,
`triangle-pattern`, `three-drives-pattern`. Port from the 6 pattern
renderers. Each is a `namedPolyline` (the leg polyline + per-vertex
`text` labels) — reuse `_lib/namedPolyline` from Task 1, plus any
filled region the source draws (`fill`).

### 4. Elliott waves — `geometry/kinds/elliott.ts` (5 kinds)

`elliott-impulse-wave`, `elliott-correction-wave`,
`elliott-triangle-wave`, `elliott-double-combo`, `elliott-triple-combo`.
Port from the 5 elliott renderers — each delegates to
`_lib/namedPolyline` with its default label set (e.g. impulse
`["1","2","3","4","5"]`) overridden by `state.labels` when present and
length-matching, exactly as `elliottImpulseWave.ts` does.

### 5. Cycles — `geometry/kinds/cycles.ts` (3 kinds)

`cyclic-lines`, `time-cycles`, `sine-line`. Port from
`{cyclicLines,timeCycles,sineLine}.ts`. `sine-line` → sampled
`polyline`; `time-cycles`/`cyclic-lines` → repeated vertical/arc
`polyline`s.

### 6. Containers + table — `geometry/kinds/containers.ts` (3 kinds)

- `group` → `[]` (no-op; container only, per Phase-3 contract).
- `frame` → border `polyline` + optional label `text` + optional
  `bgColor` fill. Port from `frame.ts`.
- `table` → port from `table.ts`: the viewport-anchored grid. `table`
  positions in **pixel/viewport** space, not world space — keep its
  pixel layout logic in the decomposer (it already takes the viewport),
  emitting `polyline` (cell borders) + `text` (cell contents) + optional
  cell `fill`.

### 7. Make the dispatcher exhaustive

Replace the placeholder `default` in `geometry/decompose.ts` with:

```ts
default: {
    const _exhaustive: never = e.drawingKind;
    void _exhaustive;
    return [];
}
```

This now typechecks only because every one of the 63 `DrawingKind`
literals has a `case`. A future kind added to core will fail
`pnpm typecheck` here until a decomposer is added — the intended guard.
Mirror canvas2d's existing `drawingDispatch.ts` default arm exactly
(it uses the identical `const _exhaustive: never` pattern and already
satisfies the 100% coverage gate); replicate any coverage pragma it
carries so the unreachable `default` does not drop adapter-kit below
100%.

### Edge cases

- `group` emits nothing (verify it returns `[]`, not `undefined`).
- `table` with zero rows/cols → empty/degenerate grid without throwing.
- Elliott/pattern label-count mismatch falls back to defaults (match source).
- Pitchfork variant switch must cover all four variants exhaustively.
- Gann fan zero-magnitude ray → `continue` (skip), mirroring source.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/adapter-kit/src/geometry/kinds/{gann,pitchforks,patterns,elliott,cycles,containers}.ts` (+tests) | Create | 23 decomposers |
| `packages/adapter-kit/src/geometry/_lib/{gannLevels,pitchforkGeom}.ts` (+tests) | Create | moved shared geometry |
| `packages/adapter-kit/src/geometry/decompose.ts` (+test) | Modify | add 23 arms; `satisfies never` guard |

## Gates

- `pnpm typecheck` (exhaustiveness guard must compile)
- `pnpm lint`
- `pnpm test` (adapter-kit 100% coverage)
- `pnpm docs:check`

## Changeset

`.changeset/adapter-kit-geometry-complete.md` — **minor** for
`@invinite-org/chartlang-adapter-kit` (completes the 63-kind decomposer).

## Acceptance Criteria

- All 63 `DrawingKind`s decompose to `DrawPrimitive[]`; per-kind unit
  tests cover Gann/pitchfork/pattern/elliott/cycle/container/table.
- The dispatcher's `never` exhaustiveness guard compiles, proving full coverage.
- All shared geometry (`gannLevels`, `pitchforkGeom`, `fibLevels`,
  `namedPolyline`, `bezier`) lives once in `_lib`.
- 100% coverage; JSDoc + README gates green; changeset committed (minor).

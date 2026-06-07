---
"@invinite-org/chartlang-adapter-kit": minor
"@invinite-org/chartlang-runtime": minor
"chartlang-example-canvas2d-adapter": minor
"@invinite-org/chartlang-conformance": minor
---

Phase 3 Task 12 — Fibonacci B (`fibSpeedFan` / `fibSpeedArcs` /
`fibSpiral` / `fibCircles` / `fibTrendTime`).

- **adapter-kit** — 5 new per-kind validators
  (`validateFibSpeedFanState`, `validateFibSpeedArcsState`,
  `validateFibSpiralState`, `validateFibCirclesState`,
  `validateFibTrendTimeState`), reusing Task-11's `validateFibOpts`
  style helper. The permissive-default test fixture moves from
  `fib-speed-fan` to `gann-box` (Task 13's first kind, still
  unported).
- **runtime** — 5 new emit functions under
  `packages/runtime/src/emit/draw/fibB/` wired into the
  `DRAW_NAMESPACE` `KIND_IMPLS` map as flat methods. Four use the
  4-arg form `(slotId, a, b, opts?)`; `fibTrendTime` uses the 3-arg
  `(slotId, anchors, opts?)`. Fall-through-stub fixture in
  `namespace.test.ts` / `primitives.test.ts` /
  `buildComputeContext.test.ts` moves from `fibSpeedFan` to
  `gannBox`.
- **canvas2d-adapter** — 5 new renderers reusing Task-4's
  `FIB_LEVELS` + `formatLevel`. `fibSpiral` additionally reuses
  `sampleCubic` for the chained quarter-Bezier approximation of the
  golden spiral. Default colour `"#facc15"` per invinite's fib-tool
  palette.
- **conformance** — 5 new per-kind scenarios + 1 bundle
  (`drawFibAll.scenario.ts` covering all 10 fib kinds, superseding
  Task 11's `drawFibA.scenario.ts` which is deleted). Conformance +
  scenarios test-capability fixtures switch from the explicit
  fib-A kebab list to `capabilities.allFibDrawings()` (covers all
  10 kinds). All 6 hashes pinned against the deterministic-run
  actuals.

Divergences flagged in `tasks/phase-3-drawing-parity/12-fibonacci-b.plan.md`:

- `fibSpiral` is clockwise-only — invinite's `counterClockwise`
  flag is deferred (Task-1 reshape follow-up; landed `FibSpiralState`
  + `FibOpts` don't carry the field).
- `fibSpeedArcs` is full-circle only — invinite's half-disk variant
  is deferred (Phase-3-deferred UX nuance).
- `fibCircles` + `fibTrendTime` use the ratio array (`FIB_LEVELS`),
  NOT the integer Fibonacci sequence. Same precedent as Task-11's
  `fib-time-zone`.
- `gen-docs` regeneration for the 5 new kinds deferred to Task 21
  (the existing `chartlang docs` command only walks `ta.*`; the
  `draw.*` walker extension is an explicit Task-21 deliverable).
- Per-kind property / golden test files deferred to the pragmatic
  1-file-per-emit + 1-file-per-renderer set, mirroring Tasks 5–11.

See `tasks/phase-3-drawing-parity/12-fibonacci-b.plan.md` for the
full audit + divergence list.

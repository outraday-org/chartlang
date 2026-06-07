---
"@invinite-org/chartlang-adapter-kit": minor
"@invinite-org/chartlang-runtime": minor
"chartlang-example-canvas2d-adapter": minor
"@invinite-org/chartlang-conformance": minor
---

Phase 3 Task 17 — Cycles (`cyclicLines` / `timeCycles` / `sineLine`).
All 3 kinds map to the `other` bucket and ship as flat methods
(`draw.<kind>(a, b, opts?)`) per the Task-11 Option-C decision.

- **adapter-kit** — 3 new per-kind validators
  (`validateCyclicLinesState`, `validateTimeCyclesState`,
  `validateSineLineState`). All 3 reuse Task-2's `validateAnchorPair`
  + Task-5's `validateLineDrawStyle`; no new helpers needed (cycle
  states carry no `labels` field, so Task-16's
  `validateOptionalLabels` is not consumed). The permissive-default
  test fixture moves from `cyclic-lines` → `group` (Task 18's first
  kind, still unported).
- **runtime** — 3 new emit functions under
  `packages/runtime/src/emit/draw/cycles/` wired into the
  `DRAW_NAMESPACE` `KIND_IMPLS` map as flat methods. Each uses the
  4-arg dual-overload form `(slotId, a, b, opts?)` mirroring `line`
  (the script-author surface is the 3-arg `(a, b, opts?)`; the
  compiler injects the leading slot id). State is assembled as
  `anchors: [a, b]`. Fall-through-stub fixture in
  `namespace.test.ts` / `primitives.test.ts` /
  `buildComputeContext.test.ts` moves from `cyclicLines` to `group`.
- **canvas2d-adapter** — 3 new renderers reusing Task-4's
  `worldPointToCanvas` + Phase-1 `dashPattern`. Default colour
  `#0ea5e9` (sky blue — free palette slot distinct from
  blue/yellow/purple/pink/amber/teal/green/red used by prior port
  tasks). Per-kind geometry:
  - `cyclicLines` — repeated full-height vertical strokes at
    `fromX + n * periodPx` for n ∈ [0, viewport+overscan/periodPx],
    capped at 256 iterations. Skips silently on degenerate period.
  - `timeCycles` — concentric upper-half arcs centred at the
    midpoint of `(from, to)` on the `from.price` baseline, radius =
    `|toX − fromX| / 2`. Arcs tile across the viewport at multiples
    of the diameter (64 per side). Skips silently on degenerate
    diameter.
  - `sineLine` — sampled sinusoidal polyline. Half-period =
    `|toX − fromX|` (full period doubled). Baseline = midpoint of
    `(fromY, toY)`. Amplitude = `|fromY − toY| / 2`. 32 samples per
    full period; wave starts at the `from` extreme (peak vs trough
    flipped by `fromPx.y < toPx.y` — mirrors invinite's
    `extremeIsPeak` flag). Skips silently on degenerate half-period.

  Dispatch test's describe labels bump from "Tasks 5–15 shipped" to
  "Tasks 5–17 shipped" and "Task-17+ stubs" to "Task-18+ stubs".
- **conformance** — 3 new per-kind scenarios + 1 bundle
  (`drawCyclesAll.scenario.ts` covering all 3 kinds = 3 emissions).
  Conformance + scenarios + index test-capability fixtures widen
  `drawings` with `capabilities.allCycleDrawings()`. All 4 hashes
  pinned against the deterministic-run actuals:
  `drawCyclicLines` = `975166fe…aae16`,
  `drawTimeCycles` = `1bdaca36…d88c0`,
  `drawSineLine` = `9f88b689…3ba8`,
  `drawCyclesAll` = `ef46754f…cc80b`.

Divergences flagged in
`tasks/phase-3-drawing-parity/17-cycles.plan.md`:

- **`SineLineState.period: number` field NOT on landed state**
  (Task 1's `SineLineState` carries only `anchors` + `style` —
  the renderer derives the half-period from `|to.time − from.time|`,
  matching invinite's tool source). The explicit `period: number`
  field is dropped from Phase 3; flagged as a Task-1 reshape
  follow-up.
- **`TimeCyclesState.style.fill` / `fillAlpha` NOT on landed state**
  (Task 1's `TimeCyclesState` uses `LineDrawStyle`, not
  `ShapeStyle`). The renderer strokes the arcs only — invinite's
  tool source DOES fill the half-circles. Flagged as a Task-1
  reshape follow-up.
- **`to.time > from.time` reject NOT enforced** — Phase-3 renderer
  no-ops silently on degenerate input, matching every other Phase-3
  drawing port (gann / fib / elliott all silently no-op on
  collapsed anchors). The validator accepts reversed anchors per
  `validateAnchorPair`'s finite-only contract.
- `gen-docs` regeneration for the 3 new kinds deferred to Task 21
  (the existing `chartlang docs` command only walks `ta.*`; the
  `draw.*` walker extension is an explicit Task-21 deliverable).
- Per-kind property / golden test files deferred to the pragmatic
  1-file-per-emit + 1-file-per-renderer set, mirroring Tasks 5–16.

See `tasks/phase-3-drawing-parity/17-cycles.plan.md` for the full
audit + divergence list.

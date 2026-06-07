---
"@invinite-org/chartlang-adapter-kit": minor
"@invinite-org/chartlang-runtime": minor
"chartlang-example-canvas2d-adapter": minor
"@invinite-org/chartlang-conformance": minor
---

Phase 3 Task 14 — Pitchforks (`pitchfork` / `pitchfan`). The
`pitchfork` kind collapses the four invinite tools (`standard` /
`schiff` / `modifiedSchiff` / `inside`) into one kind with a
`variant` discriminator per PLAN.md §3.1.

- **adapter-kit** — 2 new per-kind validators
  (`validatePitchforkState`, `validatePitchfanState`), reusing
  Task-2's `validateAnchorTriple` + Task-5's `validateLineDrawStyle`
  helpers. `validatePitchforkState` also pins the 4-entry variant
  enum (`standard | schiff | modifiedSchiff | inside`). The
  permissive-default test fixture moves from `pitchfork` to
  `xabcd-pattern` (Task 15's first kind, still unported).
- **runtime** — 2 new emit functions under
  `packages/runtime/src/emit/draw/pitchforks/` wired into the
  `DRAW_NAMESPACE` `KIND_IMPLS` map as flat methods. Both use the
  3-arg form `(slotId, anchors, opts?)`. `pitchfork` accepts
  `opts: LineDrawStyle & { variant? }` — the impl destructures
  `variant` (defaulting to `"standard"`), strips it from the
  style payload, and builds the `PitchforkState`. Fall-through-stub
  fixture in `namespace.test.ts` / `primitives.test.ts` /
  `buildComputeContext.test.ts` moves from `pitchfork` to
  `xabcdPattern`.
- **canvas2d-adapter** — 2 new renderers + a shared
  `pitchforkGeom.ts` helper exporting `medianOriginFor(variant, a,
  b, c)` and `medianTargetFor(variant, a, b, c)` (per-variant
  median-rail endpoints in canvas space). Default colour
  `"#ec4899"` (pink/magenta, mirroring invinite's pitchfork-tool
  palette family). The pitchfork renderer emits 3 strokes per
  emission (median + 2 parallel handles through `b` and `c`); the
  pitchfan renderer emits 3 rays from `a` through `b`, `mid(b, c)`,
  `c`.
- **conformance** — 2 new per-kind scenarios + 1 bundle
  (`drawPitchforksAll.scenario.ts` covering 4 pitchfork variants +
  1 pitchfan = 5 emissions). Conformance + scenarios + index
  test-capability fixtures widen `drawings` with
  `capabilities.allPitchforkDrawings()`. All 3 hashes pinned
  against the deterministic-run actuals.

Divergences flagged in
`tasks/phase-3-drawing-parity/14-pitchforks.plan.md`:

- `extendLeft` / `extendRight` flags from invinite's
  `PitchforkDrawing` not on landed `PitchforkState`. Phase-3 pins
  the default extend-forward behaviour for each rail (Task-1
  reshape follow-up).
- Per-instance `levels` array not on landed state. Phase-3 renders
  the median + 2 parallel-handle pattern only — no per-level
  offsets (Task-1 reshape follow-up).
- `medianColor` / `medianLineStyle` / `medianStrokeWidthPx` not on
  landed state. Phase-3 paints the median with the same
  `LineDrawStyle` as the handles (Task-1 reshape follow-up).
- `gen-docs` regeneration for the 2 new kinds deferred to Task 21
  (the existing `chartlang docs` command only walks `ta.*`; the
  `draw.*` walker extension is an explicit Task-21 deliverable).
- Per-kind property / golden test files deferred to the pragmatic
  1-file-per-emit + 1-file-per-renderer set, mirroring Tasks 5–13.

See `tasks/phase-3-drawing-parity/14-pitchforks.plan.md` for the
full audit + divergence list.

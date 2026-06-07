---
"@invinite-org/chartlang-adapter-kit": minor
"@invinite-org/chartlang-runtime": minor
"chartlang-example-canvas2d-adapter": minor
"@invinite-org/chartlang-conformance": minor
---

Phase 3 Task 16 — Elliott Waves (`elliottImpulseWave` /
`elliottCorrectionWave` / `elliottTriangleWave` / `elliottDoubleCombo`
/ `elliottTripleCombo`). All 5 kinds map to the `polylines` bucket
and ship as flat methods (`draw.<kind>(...)`) per the Task-11
Option-C decision.

- **adapter-kit** — 5 new per-kind validators
  (`validateElliottImpulseWaveState`,
  `validateElliottCorrectionWaveState`,
  `validateElliottTriangleWaveState`,
  `validateElliottDoubleComboState`,
  `validateElliottTripleComboState`) plus a new
  `validateOptionalLabels(v, path, expectedCount)` helper that
  validates the optional script-author `state.labels` override
  (when present: array of strings whose length exactly matches the
  per-kind anchor count). All 5 validators reuse Task-5's
  `validateLineDrawStyle` and Task-2/15's
  `validateAnchorTriple` / `validateAnchorQuint` /
  `validateAnchorHept`. The permissive-default test fixture moves
  from `elliott-impulse-wave` → `cyclic-lines` (Task 17's first
  kind, still unported).
- **runtime** — 5 new emit functions under
  `packages/runtime/src/emit/draw/elliott/` wired into the
  `DRAW_NAMESPACE` `KIND_IMPLS` map as flat methods. Each uses the
  3-arg form `(slotId, anchors, opts?)` with the dual-overload
  pattern. The runtime widens `opts` to
  `LineDrawStyle & { labels?: ReadonlyArray<string> }` — the impl
  destructures `labels` from `opts`, strips it from the style
  payload, and stores it on `state.labels` only when present
  (preserving the optional field's `undefined` state when omitted
  so emission hashes stay stable). Fall-through-stub fixture in
  `namespace.test.ts` / `primitives.test.ts` /
  `buildComputeContext.test.ts` moves from `elliottImpulseWave` to
  `cyclicLines`.
- **canvas2d-adapter** — 5 new renderers reusing Task-15's
  `renderNamedPolyline` helper. Default colour `#14b8a6` (teal —
  free palette slot distinct from blue/yellow/purple/pink/amber).
  Each renderer honours the optional `state.labels` override when
  present and its length matches the anchor count (defensive
  fallback to the per-kind default `LABELS` constant). Per-kind
  default labels: impulse `["1","2","3","4","5"]`, correction
  `["A","B","C"]`, triangle `["a","b","c","d","e"]`, double-combo
  `["S","W","x1","X","x2","Yi","Y"]`, triple-combo
  `["S","W","X1","Y","X2","Zi","Z"]`. Dispatch test's describe
  label bumps from "Task-16+ stubs" to "Task-17+ stubs".
- **conformance** — 5 new per-kind scenarios + 1 bundle
  (`drawElliottAll.scenario.ts` covering all 5 kinds = 5
  emissions). Conformance + scenarios + index test-capability
  fixtures widen `drawings` with `capabilities.allElliottDrawings()`.
  All 6 hashes pinned against the deterministic-run actuals.

Divergences flagged in
`tasks/phase-3-drawing-parity/16-elliott.plan.md`:

- **`WaveDegree` enum + label-decoration helper NOT on landed state**
  (Task 1's `Elliott*State` shapes carry no `degree` field — they
  carry an optional `labels?: ReadonlyArray<string>` field instead,
  letting the script author override the per-kind default labels
  directly). The 9-level `WaveDegree` enum + the
  `elliottLabels.ts` decoration helper are dropped from Phase 3.
  Flagged as a Task-1 reshape follow-up.
- **`elliottImpulseWave` is 5-anchor on the landed state** (Task 1's
  `ElliottImpulseWaveState.anchors: AnchorQuint`), not the 6-anchor
  invinite shape. The renderer treats the 5 anchors as the wave1End
  → wave5End pivots and strokes 4 connecting legs. Same precedent
  for `elliottCorrectionWave` (landed 3-anchor vs invinite 4),
  `elliottTriangleWave` (landed 5-anchor vs invinite 6), and
  `elliottTripleCombo` (landed 7-anchor vs invinite 10). All
  flagged as Task-1 reshape follow-ups.
- `gen-docs` regeneration for the 5 new kinds deferred to Task 21
  (the existing `chartlang docs` command only walks `ta.*`; the
  `draw.*` walker extension is an explicit Task-21 deliverable).
- Per-kind property / golden test files deferred to the pragmatic
  1-file-per-emit + 1-file-per-renderer set, mirroring Tasks 5–15.

See `tasks/phase-3-drawing-parity/16-elliott.plan.md` for the full
audit + divergence list.

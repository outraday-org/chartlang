---
"@invinite-org/chartlang-adapter-kit": minor
"@invinite-org/chartlang-runtime": minor
"chartlang-example-canvas2d-adapter": minor
"@invinite-org/chartlang-conformance": minor
---

Phase 3 Task 13 — Gann (`gannBox` / `gannSquareFixed` / `gannSquare` /
`gannFan`).

- **adapter-kit** — 4 new per-kind validators
  (`validateGannBoxState`, `validateGannSquareFixedState`,
  `validateGannSquareState`, `validateGannFanState`), reusing
  Task-5's `validateLineDrawStyle` style helper. The
  permissive-default test fixture moves from `gann-box` to
  `pitchfork` (Task 14's first kind, still unported).
- **runtime** — 4 new emit functions under
  `packages/runtime/src/emit/draw/gann/` wired into the
  `DRAW_NAMESPACE` `KIND_IMPLS` map as flat methods. Three use the
  4-arg form `(slotId, a, b, opts?)`; `gannSquareFixed` uses the
  3-arg `(slotId, anchor, opts?)`. Fall-through-stub fixture in
  `namespace.test.ts` / `primitives.test.ts` /
  `buildComputeContext.test.ts` moves from `gannBox` to `pitchfork`.
- **canvas2d-adapter** — 4 new renderers + a shared `gannLevels.ts`
  helper exporting `GANN_LEVELS` (`[0, 0.25, 0.5, 0.75, 1]`),
  `GANN_FAN_RATIOS` (9-entry tuple covering 1×1, 1×2, …, 8×1),
  `GANN_FAN_LABELS`, and `formatGannRatio`. Default colour
  `"#a855f7"` (purple/violet, mirroring invinite's gann-tool
  palette).
- **conformance** — 4 new per-kind scenarios + 1 bundle
  (`drawGannAll.scenario.ts` covering all 4 gann kinds).
  Conformance + scenarios test-capability fixtures widen
  `drawings` with `capabilities.allGannDrawings()`. All 5 hashes
  pinned against the deterministic-run actuals.

Divergences flagged in `tasks/phase-3-drawing-parity/13-gann.plan.md`:

- `gannBox.levels` custom override deferred — landed `GannBoxState`
  carries only `style: LineDrawStyle`. Renderer uses the shared
  `GANN_LEVELS` constant only (Task-1 reshape follow-up).
- `gannSquareFixed.sizePrice` custom override deferred — landed
  `GannSquareFixedState` carries only `anchor + style`. Renderer
  uses a fixed `80px` side (Task-1 reshape follow-up).
- `gannSquare.ratio` custom override deferred — landed
  `GannSquareState` carries only `anchors + style`. Renderer uses
  canvas-space `max(|dx|, |dy|)` (1×1 default, Task-1 reshape
  follow-up).
- `gannFan.showLabels` flag deferred — `LineDrawStyle` has no
  `showLabels` field. Phase-3 pins unlabeled rays (Task-1 reshape
  follow-up).
- `gen-docs` regeneration for the 4 new kinds deferred to Task 21
  (the existing `chartlang docs` command only walks `ta.*`; the
  `draw.*` walker extension is an explicit Task-21 deliverable).
- Per-kind property / golden test files deferred to the pragmatic
  1-file-per-emit + 1-file-per-renderer set, mirroring Tasks 5–12.

See `tasks/phase-3-drawing-parity/13-gann.plan.md` for the full
audit + divergence list.

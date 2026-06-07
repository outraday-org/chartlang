---
"@invinite-org/chartlang-conformance": minor
---

Phase 3 Task 19 — `fib-retracement.chart.ts` example script + Task-19
smoke / budget / capability-gating companion scenarios.

- **examples** — new `examples/scripts/fib-retracement.chart.ts`, the
  4th curated `.chart.ts` example deferred from Phase 1 alongside
  the `draw.*` namespace. Multi-emit "stage-an-impulse" script:
  `draw.fibRetracement(swingLow, swingHigh)` + `draw.fibTrendExtension(
  [swingLow, swingHigh, retest])` + a hand-placed `draw.text(...)`
  label. Declares `maxDrawings: { labels: 5, other: 5 }` per the
  Task-1 `DrawingCounts` shape. Style mirrors the three Phase-1
  demos. The new script is appended to
  `packages/cli/src/e2e.test.ts:EXAMPLE_SCRIPTS` so the CLI
  end-to-end compile-test covers it.
- **conformance** — three new scenarios:
  - `DRAW_ALL_61_SCENARIO` — smoke scenario emitting ONE of every
    `DrawingKind` (61 total) in a single script on the first bar.
    Asserts pinned `drawing-hash`, plus
    `diagnostic-code-absent` for both `unsupported-drawing-kind`
    and `drawing-budget-exceeded`. The `pitchfork` call carries
    `variant: "schiff"` per spec.
  - `DRAW_BUDGET_OVERFLOW_SCENARIO` — emits 150 distinct
    `draw.line(...)` callsites, overflowing the conformance
    suite's `TEST_CAPABILITIES.maxDrawingsPerScript.lines: 100`
    cap. Asserts `drawing-budget-exceeded` is present + pins a
    `drawing-hash` over the budget-respecting 100-line subset.
    Callsites are unrolled at module-init time so each emission
    gets a distinct compiler-injected handle id.
  - `DRAW_UNSUPPORTED_KIND_SCENARIO` — emits one supported
    `draw.line(...)` and one unsupported `draw.rectangle(...)`.
    EXPORTED but NOT added to `ALL_SCENARIOS` — the bundled
    `TEST_CAPABILITIES` advertises every Phase-3 kind, so the
    diagnostic cannot fire there. A dedicated narrow-adapter test
    row in `scenarios.test.ts` drives the scenario through
    `runConformanceSuite` against an inline adapter with
    `capabilities.drawings = new Set(["line"])`. Adapter authors
    with a narrow capability bag can opt in by passing the
    constant to `runConformanceSuite(adapter, { scenarios: [...] })`.

  Scenario cardinality at end of Task 19: **61 per-kind + 12
  task-bundles + 3 (smoke + budget + capability) = 76**, of which
  75 are in `ALL_SCENARIOS` (drawUnsupportedKind opt-in only).

  Pinned `drawing-hash` values:
  - `draw-all-61` (61 emissions):
    `c2e924592962d7dc2be5529b687b97683c5b07d9a0d9927d2c8850ce86ef4d73`
  - `draw-budget-overflow` (100 surviving emissions / 50 dropped):
    `2daf386a41b8bd8da29cb48c5eb315452c4de4468c3b67c41f6f602b908f67d4`
  - `draw-unsupported-kind` (1 surviving emission):
    `53f0d41b6063ace798e16f5e350188011bff7c45d17dd6ead4e9edc774aaf188`

### Divergences from spec (`tasks/phase-3-drawing-parity/19-example-script-and-smoke.md`)

1. **Spec § Requirements §1 says the example script uses
   `ta.highest` / `ta.lowest` + `handle.update`.** Per team-lead
   reframe the script ships as a 3-emission "stage-an-impulse" demo
   (hand-picked anchors + hand-placed label) — the swing-detection
   + cross-bar `update` flow is exercised by the per-kind
   conformance scenarios (Tasks 11 + 18) and `defineDrawing`
   in Task 20. The simpler shape matches the three Phase-1 demos
   (~30 lines each).
2. **Spec § Requirements §4 hints at adding a
   `Scenario.capabilitiesOverride?: Capabilities` field to the
   runner.** Resolved (decision option d) — the runner API is
   unchanged. `drawUnsupportedKind` is exported as an opt-in
   constant and run against a narrow adapter via the existing
   `scenarios` opts override. A `capabilitiesOverride` field
   on `Scenario` is a Phase-4 follow-up if other companion
   scenarios accumulate.
3. **Spec § Tests mentions extending
   `examples/canvas2d-adapter/src/integration.test.ts` to
   include the new script in its smoke set.** Reading the test
   shows it does NOT iterate any `examples/scripts/*.chart.ts`
   source — it hand-builds an inline `EMA_CROSS_MODULE_SOURCE`.
   No edit required.
4. **Spec § Tests mentions a new
   `runConformanceSuite.test.ts` row covering drawAll61 +
   drawBudgetOverflow end-to-end.** The existing
   `runConformanceSuite iterates ALL_SCENARIOS exactly` row in
   `scenarios.test.ts` already drives every bundled scenario
   through a real (non-mocked) `runConformanceSuite` invocation.
   Both new scenarios are covered there.
5. **Spec § Files mentions `examples/README.md` + `docs/examples/`.**
   Neither file exists in the repo. Per task-text instruction these
   defer to the Phase-4 doc-site work.
6. **`canvas2d-adapter`, `cli`, and `examples` carry no version
   bump.** The canvas2d adapter is unchanged; the CLI test list
   append is internal plumbing; `examples/scripts/` is not a
   published package.

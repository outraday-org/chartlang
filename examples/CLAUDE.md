# examples/

Reference / demo artefacts that ship alongside the published
`@invinite-org/chartlang-*` packages but are **not themselves
published to npm**.

## Layout

- `examples/canvas2d-adapter/` — `chartlang-example-canvas2d-adapter`,
  the Phase-1 reference adapter. Private package
  (`"private": true`); intended to be copied as the starting point
  for a consumer-repo adapter. Exposes a default export that the
  Task-12 conformance suite consumes (capabilities-only;
  `candles`/`onEmissions`/`dispose` are no-ops).
- `examples/scripts/` — three Phase-1 example `.chart.ts` files
  (`ema-cross.chart.ts`, `bollinger-bands.chart.ts`,
  `rsi-divergence-alert.chart.ts`). Author-style sources, compiled
  end-to-end by `packages/cli/src/e2e.test.ts` and driven through
  the runtime by `packages/conformance/src/scenarios/`.

## Phase-1 scope

- The three scripts under `scripts/` are the Phase-1 conformance
  seed. Each one exercises a stateful primitive that Task 12's
  scenario pins against the 10 000-bar `goldenBars.json` fixture.
- `examples/canvas2d-adapter`'s default export is exactly what
  `scripts/run-conformance.ts` auto-imports — the adapter's
  `capabilities` field is the test surface, not its renderer.

## Deferred (Phase 3+)

- `examples/scripts/fib-retracement.chart.ts` — deferred to Phase 3
  alongside the `draw.*` namespace and 61-entry `DrawingKind` union.
  The Phase-1 example surface intentionally ships three scripts only;
  the fib script would require drawing primitives that don't land
  until Phase 3.

## Convention notes

- **Scripts must use top-level imports AND destructured params
  together.** The pattern is:
  ```ts
  import { defineIndicator, ta, plot, alert } from "@invinite-org/chartlang-core";
  export default defineIndicator({
      apiVersion: 1,
      compute({ bar, ta, plot, alert }) { /* destructured impls */ },
  });
  ```
  The top-level imports give the compiler's `extractCapabilities`
  pass the named-import signal it needs; the destructured params
  give the runtime its slot-aware implementations (per the runtime's
  `buildComputeContext.ts`). The compiler's `resolveCallee` matches
  destructured params whose type comes from core's `ComputeContext`
  — see `packages/compiler/src/transformers/resolveCallee.ts`.

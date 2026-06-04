# packages/conformance/

`@invinite-org/chartlang-conformance` — adapter conformance suite.
Drives every Phase-1 example script through the compiler + runtime
against a target adapter's declared `capabilities` and asserts pinned
plot hashes, alert counts, and diagnostic codes.

## Invariants

- **`fixtures/goldenBars.json` lives OUTSIDE `src/`.** The 10 000-bar
  JSON would otherwise count as uncovered "code" against the §16.1
  100% coverage thresholds. The fixture is shipped as a sibling of
  `src/` (and the package's `files` array carries it) so consumers
  installing the package via `dist/` still get the canonical bars.
  Per-package `vitest.config.ts` explicitly excludes `fixtures/**` in
  addition to the §16.1 defaults.
- **Bundle execution goes through a tmp file under `.cache/`, not a
  `data:` URL.** The compiler's `bundle.ts` emits ESM with
  `import { defineIndicator } from "@invinite-org/chartlang-core"`
  retained; a `data:` URL cannot resolve workspace bare specifiers.
  `runConformanceSuite` writes the bundle to
  `packages/conformance/.cache/<scenarioId>-<rand>.mjs`, dynamically
  `import()`s it via `file://`, and `rm`s the file in a `finally`
  block. Do not "optimise" this into a `data:` URL — the test
  fixtures would silently break for any script that exercises a
  workspace primitive.
- **`plot-hash` SHA-256 covers `{ bar, value }` tuples in JSON-
  stringified emission order.** Adding fields to the tuple (e.g.
  `time`, `color`) would invalidate every pinned hash. The hash is
  deterministic across runs because §6.4 pins runtime emission order
  per bar.
- **Scenario assertion arrays are pinned via the first deterministic
  run.** The runner returns `expected` vs `actual` in every failure
  message — re-pin by copying the `actual` hash into the scenario
  constant when the math intentionally changes (gate behind a
  `BREAKING:` changeset per §16.6). The pinning workflow does not
  need a separate "regenerate" script; the failure-message text
  suffices.
- **`runConformanceSuite` reads `adapter.capabilities` only.** It
  does not drive `adapter.candles` or call `adapter.onEmissions`.
  The runner owns the candle iteration + emission buffer so the
  test surface is exactly the runtime ↔ capability-bag contract,
  not the rendering pipeline. The canvas2d default export is a
  no-op `Adapter` for the same reason — spinning up a Worker host
  + canvas renderer would be wasted work for an emission-contract
  test.
- **The `unsupported-pane` diagnostic is NOT asserted on the
  RSI-divergence scenario.** Phase 1's `paneResolver` only emits the
  diagnostic when a `plot(..., { pane: "new" })` call explicitly
  requests a non-overlay pane; the RSI script's `overlay: false`
  flag on `defineIndicator` does NOT translate to a per-emission
  `pane: "new"`. Phase 4 reshapes the `overlay` flag into a routing
  signal — until then this assertion would always fail. The
  runConformanceSuite test suite still exercises the
  `diagnostic-code-present` path via a synthetic script that
  passes `pane: "new"` explicitly.
- **`assertions: ReadonlyArray<ScenarioAssertion>` is declared
  ABOVE each `Scenario` literal, not inlined.** TypeScript's literal
  narrowing of `Object.freeze([...])` produces a tuple type that
  fails to widen to `ReadonlyArray<ScenarioAssertion>` because the
  `code` literals lose their `DiagnosticCode` bondage. The
  top-of-file `const ASSERTIONS: ReadonlyArray<ScenarioAssertion>`
  binding gives TS the right context to flow each element to the
  union — keeping the `Scenario.assertions: ASSERTIONS` line a
  trivial reference.

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
- **Pane routing is exercised by the `rsi-subpane-routing`
  scenario.** Scripts declaring `defineIndicator({ overlay: false })`
  emit on the script-level default pane key (`script:<sanitised-name>`);
  the scenario asserts every `PlotEmission.pane` equals that key (via the
  `all-plots-on-pane` variant) and **no** `unsupported-pane` diagnostic
  is pushed against an adapter declaring `subPanes >= 1` (the canvas2d
  reference). Adapters declaring `subPanes: 0` instead see the
  `unsupported-pane` warning + the overlay fold — exercised by
  `runConformanceSuite.test.ts` against a synthetic `pane: "new"` script
  under a `subPanes: 0` capability bag.
- **`assertions: ReadonlyArray<ScenarioAssertion>` is declared
  ABOVE each `Scenario` literal, not inlined.** TypeScript's literal
  narrowing of `Object.freeze([...])` produces a tuple type that
  fails to widen to `ReadonlyArray<ScenarioAssertion>` because the
  `code` literals lose their `DiagnosticCode` bondage. The
  top-of-file `const ASSERTIONS: ReadonlyArray<ScenarioAssertion>`
  binding gives TS the right context to flow each element to the
  union — keeping the `Scenario.assertions: ASSERTIONS` line a
  trivial reference.

## Phase-2 invariants

- **`Scenario` carries either `scriptPath` or `inlineSource`, never
  both, never neither.** `runConformanceSuite`'s `resolveSource`
  enforces the mutual-exclusion contract; both-set throws "cannot
  define both", neither-set throws "must define either". Phase-1
  scenarios continue to use `scriptPath` against curated files in
  `examples/scripts/`; Phase-2 ports inline their 6-line
  `defineIndicator` source into their `*.scenario.ts` file so the
  curated example set stays at three scripts.
- **Inline-source `sourcePath` is the virtual
  `<inline:${scenario.id}>.chart.ts` literal.** This is the
  `sourcePath` the runner passes to the compiler so callsite-id
  injection produces a stable, pinnable slot-id
  prefix — assertions can pin
  `slotId: "<inline:ta-wma>.chart.ts:7:13#0"`. Do not change the
  literal format without updating every Phase-2 scenario's pinned
  slotIds.

## Phase-7 invariants

- **`Scenario.additionalSources` requires `inlineSource`.** When set,
  the runner writes the consumer's inline source AND every
  `additionalSources` entry into a per-scenario tmp directory under
  `.cache/<scenarioId>-<rand>/` so the compiler's default file-walking
  producer resolver can resolve `./X.chart` siblings. The consumer's
  `sourcePath` becomes the absolute path of the on-disk `inline.chart.ts`.
  Cleanup `rm -rf`s the directory in the `finally` block. The
  mutual-exclusion guard (`additionalSources` without `inlineSource`)
  throws at `resolveSource`.
- **Dep-family scenarios pin emission hashes + `dep-*` diagnostic
  codes.** The five `dep-*` scenarios in `ALL_SCENARIOS`
  (`dep-private-single-file`, `dep-multi-export`, `dep-diamond`,
  `dep-error-halts-parent`, `dep-cross-file`) run the full
  compile→bundle→runtime pipe against the canvas2d capability bag.
  `dep-cross-file` uses `additionalSources` so the compiler resolves
  an imported sibling `.chart.ts` producer on disk. Re-pin via the
  runner's "expected vs actual" failure message exactly like every
  other scenario.

## Phase-8 invariants

- **The suite drives the RUNTIME directly, NOT the hosts.**
  `runConformanceSuite` compiles each scenario and runs it through
  `createScriptRunner` (the runtime's `ScriptRunner`); it never imports
  `host-worker` / `host-quickjs`, and the package depends on
  adapter-kit / compiler / core / runtime ONLY. Do not add a host
  dependency here to "run scenarios through both hosts" — that inverts
  the dependency graph. **Cross-host byte-identical parity** (incl. the
  plot-override wire) lives in
  `packages/host-quickjs/src/integration.test.ts`, which boots both
  hosts and diffs the drained JSON. The "determinism / parity" wording
  elsewhere refers to the runtime emission-order contract, not a
  host-driving harness.
- **Plot overrides are keyed by `manifest.plots` ORDINAL, never a
  literal slotId.** `PLOT_STYLE_OVERRIDES_SCENARIO` declares
  `plotOverrides` (mount) + `overrideEvents` (live `setPlotOverrides`)
  whose `slotIndex` the runner resolves to the real `slotId` from the
  compiled `manifest.plots` at run time — so the scenario survives
  slotId-format changes. An out-of-range `slotIndex` resolves to no
  entry (keeps the suite robust under a stubbed compiler that emits no
  `manifest.plots`); a genuinely mis-authored override then surfaces as
  a failing `plot-field` assertion rather than a throw.
- **The `plot-field` assertion inspects override-baked presentation
  fields.** `plot-hash` deliberately hashes only `{ bar, value }`
  (color/width are excluded so existing hashes stay stable), so
  `plot-field` exists to assert `visible` / `color` / `style.lineWidth`
  on the emission for a `(slotIndex, bar)` pair. `expected: undefined`
  asserts an omitted field — a visible plot carries no `visible` flag,
  and a non-line-family style carries no `lineWidth`. The empty-override
  parity guarantee is pinned by re-using `plot-hash` on the recolored
  slot (its numeric series is byte-identical to the no-override run).

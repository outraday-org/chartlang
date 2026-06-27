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
- **Six bundled example adapters total** — `canvas2d-adapter` (the
  coverage-gated reference), the four library adapters
  (`lightweight-charts-adapter`, `uplot-adapter`, `echarts-adapter`,
  `konva-adapter`), and `webgl-adapter`
  (`chartlang-example-webgl-adapter`), a zero-dependency raw WebGL2 GPU
  renderer like canvas2d. All six are baked into the CLI bundle
  (`scripts/adapters/registry.ts` SSOT), wired into the react-starter
  seam + create-chartlang installer + apps/site demo, and run through the
  shared conformance suite. Only `canvas2d-adapter` is in the 100%
  coverage gate; the other five have tests but no coverage gate.
- `examples/scripts/` — author-style example `.chart.ts` files,
  compiled end-to-end by `packages/cli/src/e2e.test.ts` and driven
  through the runtime by `packages/conformance/src/scenarios/` and
  `examples/canvas2d-adapter/src/integration.test.ts`. The Phase-1
  seed is `ema-cross.chart.ts`, `bollinger-bands.chart.ts`, and
  `rsi-divergence-alert.chart.ts`; later phases add the `draw.*`,
  Pine-port, composition, and multi-timeframe samples. The MTF sample
  `htf-trend-filter.chart.ts` overlays a current-timeframe EMA plus a
  true weekly trend via the `request.security` **expression form**
  (`request.security({ interval: "1W" }, (bar) => ta.ema(bar.close, 20))`,
  so the EMA runs on the weekly clock) — its runtime test feeds a synthetic
  1W secondary stream via `createMultiStreamCandlePump`. The single-timeframe `sma-offset
  .chart.ts` sample overlays an unshifted `ta.sma(bar.close, 20)` line
  plus a `+5` copy displaced right and a `−5` copy displaced left via the
  universal `ta` `offset` option — a presentation-only display shift
  (`xShift` on the emission; the values stay unshifted). The `pivot-high-ray.chart.ts` sample tracks the
  latest `ta.pivotsHighLow` swing high in `state.*` slots and draws one
  reused `draw.horizontalRay` from it, anchoring the pivot's timestamp
  with `bar.point(-5, …)`. The `fill-between-band.chart.ts` sample
  accumulates a fast/slow EMA pair into two persistent edge arrays and
  re-emits one `draw.fillBetween(edgeA, edgeB, …)` per bar — the native
  filled ribbon (Pine `linefill`/`fill()` equivalent). The
  `anchored-line.chart.ts` sample composes both X-axis anchor styles in one
  `draw.line` — an absolute-time start (first bar's `bar.time`/`bar.close`
  pinned in `state.*`) to a bar-index end (`bar.point(0, …)`). The
  `z-layering.chart.ts` sample demonstrates the presentation-only `z`
  render-order key: a `draw.fillBetween` band given `z: -1` so it renders
  **behind** the price `plot` (a drawing beneath a plot, which the default
  group stack forbids), plus an SMA at `z: 1` on top. The
  `bgcolor-barcolor.chart.ts` sample demonstrates the Pine-ergonomic
  `barcolor` / `bgcolor` emitters: `barcolor` tints each candle by its own
  up/down direction and `bgcolor` washes the pane background by trend regime
  (price vs `ta.ema(bar.close, 50)`) with a `transp` transparency — both lower
  to the same emission as the verbose
  `plot(NaN, { style: { kind: "bar-color" | "bg-color" } })` form.

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

## Catalogue, generators & coverage gate

- **`examples/catalogue.ts` is the author-facing example registry** — a pure
  type + data module (no React, no Node imports) so the `apps/site` client
  bundle, the `scripts/` generators, AND `packages/cli` can all import it. It
  exports the shared taxonomy (`ExampleCategory` + `CATEGORY_LABELS` /
  `CATEGORY_ORDER`), the `ExampleMeta` shape (`{ id, label, description,
  category, primitives }`), and the assembled `EXAMPLE_CATALOGUE`. `id` matches
  the `examples/scripts/<id>.chart.ts` basename.
- **Fragment convention.** The barrel only *spreads* per-task fragment modules
  under `examples/catalogue/<slug>.ts`, each default-exporting a
  `ReadonlyArray<ExampleMeta>`, so the population tasks (3–21) each own a
  disjoint file and run in parallel without colliding on the barrel. Task 1
  owns `complex.ts` (the 32 migrated entries); its **filename is historical** —
  each entry's `category` **field**, not the file, drives grouping.
  `examples/catalogue.test.ts` asserts the barrel spreads every fragment (no
  orphan file, no missing spread).
- **`primitives` crediting (the coverage signal).** A `default` (single-
  primitive) entry credits **exactly one** primitive id and takes that
  primitive's family `category`. A `complex` composite credits only a primitive
  with no cleaner single-primitive default and **may credit none** (the
  `(omit)` rows — the default owns the coverage). The catalogue test therefore
  enforces non-empty `primitives` only for non-`complex` entries.
- **Two outputs are GENERATED from the catalogue + `.chart.ts` sources** by
  `pnpm examples:generate` (`scripts/gen-demo-scripts.ts`, folded into
  `scripts/gen-examples-docs.ts`): `apps/site/src/components/demo/scripts.ts`
  (`DEMO_SCRIPTS`, now AUTO-GENERATED, `DemoScript` carries `category`) and
  `examples/catalogue.json` (the machine-readable artifact). A THIRD generated
  output, `packages/examples/src/catalogue.generated.ts`, is the self-contained
  data module the published **`@invinite-org/chartlang-examples`** package
  exposes (Task 23 — same payload, inlined into a typed TS source; see
  `packages/examples/CLAUDE.md`). All three, plus `docs/examples/**`, are
  byte-diffed by `pnpm examples:gate`. A catalogue id
  with no `.chart.ts`, or a stray `.chart.ts` with no catalogue entry, is a
  hard error. Never hand-edit `scripts.ts` / `catalogue.json` — re-run
  `pnpm examples:generate`. (`examples/catalogue.json` is Biome-ignored;
  `examples:gate` is its formatting authority.)
- **Language idioms are a SEPARATE, orthogonal coverage axis.** The
  `language` category (`CATEGORY_LABELS` "Core · Language Idioms") holds
  single-concept examples of language *idioms* — the "how you express X"
  surface under `docs/language/**` (series indexing, `ta` `offset`, warmup
  gaps, bounded-loop windows, `bar.point`, indicator composition, pane
  routing, version pinning, the four `define*` script kinds) — which have
  **no `docs/primitives/**` page**, so the per-primitive `examples:coverage`
  gate structurally can't require them. They credit **no** primitive
  (`primitives: []`) and instead set the optional `idioms?:
  ReadonlyArray<string>` field on `ExampleMeta` (the only category that may).
  Their target set is the committed **`examples/idiom-manifest.json`**
  (`{ idioms: { id, page }[], unrepresentedPages: { page, reason }[] }`), NOT
  a doc-tree walk. `pnpm examples:idioms` (`scripts/examples-idioms.ts`) fails
  on MISSING (a manifest idiom with no covering example), UNKNOWN (a catalogue
  `idioms` id absent from the manifest), or UNREPRESENTED_PAGE (a
  `docs/language/*.md` page neither paired with a manifest idiom nor in the
  manifest's `unrepresentedPages` allow-list — e.g. `forbidden-constructs`,
  the negative surface, and the narrative companions of primitive families
  the per-primitive gate already owns). Idioms are **NOT** in
  `coverage-allowlist.json`; adding a `language` example must not change the
  per-primitive coverage counts. `examples/catalogue.test.ts` asserts every
  `language` entry has a non-empty `idioms` and no other category sets it.
  Idiom examples MAY be a non-indicator script kind (`defineDrawing` /
  `defineAlert` / `defineAlertCondition`), so the CLI e2e compile loop asserts
  against the actual `manifest.kind`, not a hardcoded `"indicator"`.
- **The coverage gate is fully enforcing — no allowlist.** `pnpm
  examples:coverage` (`scripts/examples-coverage.ts`) enumerates the canonical
  primitive id set from the `docs/primitives/**` page tree (no hardcoded list)
  and asserts `target ⊆ covered` exactly: it fails if any id is not credited by
  some `EXAMPLE_CATALOGUE` entry's `primitives` (MISSING) or if a credit has no
  page (UNKNOWN). The catalogue covers **every** primitive (200 pages, 200
  covered), so `examples/coverage-allowlist.json` was drained to empty and
  **deleted** by Task 22 — any future uncovered primitive page is now a hard CI
  failure, with no allowlist to soften it. (Historically the allowlist was
  seeded full and shrunk per population task; that scaffolding is gone.)
  `state.map` is intentionally absent (no `docs/primitives/state/map.md` yet) —
  it is neither a target nor covered until the `tasks/state-map` doc page
  lands; `volume-by-level` credits `state.array` until then.
- **Final coverage counts.** The catalogue ships **229 entries** (227 +
  the `crossover-signal` / `crossunder-signal` defaults Task 22 added to close
  `ta.crossover` / `ta.crossunder`), covering all **200** primitive pages, plus
  **15** language idioms keyed to `examples/idiom-manifest.json` (the orthogonal
  `examples:idioms` gate). These numbers are not hardcoded anywhere that
  matters — the gates derive them — but are recorded here as the at-a-glance
  shape.

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

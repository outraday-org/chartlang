---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-adapter-kit": minor
"@invinite-org/chartlang-host-worker": minor
"@invinite-org/chartlang-host-quickjs": minor
"@invinite-org/chartlang-language-service": minor
"@invinite-org/chartlang-conformance": minor
"@invinite-org/chartlang-cli": minor
"@invinite-org/chartlang-editor": patch
"chartlang-example-canvas2d-adapter": patch
---

Indicator composition (Phase 7 closeout): one chartlang indicator can
read another indicator's titled plot output as a typed `Series<number>`.

- Compose via local `const` binding plus `<binding>.output("title")` —
  no new public API beyond the chainable `.output` / `.withInputs`
  accessors on `CompiledScriptObject`.
- A single `.chart.ts` MAY declare a default export plus any number of
  named exports plus any number of private `const` deps. Export form
  determines render policy: drawn exports render with the
  `export:<exportName>/` slot-id prefix; private `const` deps are data
  feeds only and their visuals are dropped.
- Cross-file `import baseTrend from "./base-trend.chart"` resolves
  recursively; shared producers inline exactly once per consumer.
- Additive within `apiVersion: 1.x`. The 172-entry
  `STATEFUL_PRIMITIVES` set is unchanged. `DiagnosticCode` widens to 32
  with the new `dep-*` codes (`dep-error`, `dep-cycle`,
  `dep-unknown-output`, `dep-invalid-input-override`, `dep-dynamic`,
  `dep-output-not-titled`).
- Five conformance scenarios in `@invinite-org/chartlang-conformance`
  pin the runtime contract end-to-end (`dep-private-single-file`,
  `dep-multi-export`, `dep-cross-file`, `dep-diamond`,
  `dep-error-halts-parent`). `Scenario.additionalSources` lets
  cross-file scenarios ship producer + consumer side-by-side.
- Two new example scripts in `examples/scripts/`:
  `base-trend.chart.ts` (producer) + `trend-confirmation.chart.ts`
  (multi-export consumer). React-demo gains a fifth catalogue entry
  exercising the feature end-to-end in the browser.
- Docs: `docs/language/indicator-composition.md` narrative guide,
  `docs/spec/manifest.md` + `docs/spec/semantics.md` +
  `docs/spec/versioning.md` updates, five new glossary entries.

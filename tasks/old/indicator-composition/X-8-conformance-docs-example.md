# Task 8 — Conformance scenarios, docs, example scripts, changeset closeout

> **Status: DONE**

## Goal

Close the feature out: land five end-to-end conformance scenarios,
write the narrative + spec documentation, ship the two example
`.chart.ts` files that demonstrate the feature, update the root
`README.md`, and assemble the final aggregate changeset that ties
everything together.

After this task lands, the feature is reviewable end-to-end: an
external contributor can read
`docs/language/indicator-composition.md`, see the worked example
in `examples/scripts/`, and run `pnpm conformance` to verify the
behaviour holds.

## Prerequisites

- Tasks 1–7 — every piece of the implementation must be in
  place. This task only adds tests, docs, examples, and the
  closing changeset.

## Current Behavior

- `packages/conformance/src/scenarios/` contains the Phase-1 +
  Phase-2 scenarios; none exercise indicator composition.
- `docs/language/` covers `series-and-indexing`,
  `forbidden-constructs`, `inputs`, `alerts`, `overview`,
  `version-pinning`. No `indicator-composition` page.
- `docs/spec/` covers `versioning`, `manifest`, `grammar`,
  `semantics`, `emissions`, `pine-migration`. No composition
  semantics.
- `docs/reference/glossary.md` has no dep-related terms.
- `examples/scripts/` ships the eight Phase-1/4 example scripts;
  no multi-export script.
- Root `README.md` is at ~273 lines.

## Desired Behavior

- Five new conformance scenarios run through the full pipeline
  (compile → bundle → runner → emission filter) and pin
  emission hashes + diagnostic codes.
- `docs/language/indicator-composition.md` lands as a
  hand-authored narrative page explaining the feature.
- `docs/spec/manifest.md` documents the additive
  `dependencies` / `outputs` / `exportName` / `siblings` /
  `isDrawn` fields.
- `docs/spec/semantics.md` documents the deterministic execution
  order, emission policy, and slot-id prefixing.
- `docs/spec/versioning.md` clarifies that composition is
  additive within `apiVersion: 1.x`.
- `docs/reference/glossary.md` adds five terms.
- Two example scripts in `examples/scripts/` demonstrate the
  feature; both compile via the CLI's e2e test.
- The react-demo's script catalogue
  (`examples/react-demo/src/scripts.ts`) gains a
  `trend-composition` entry: a single-file source with three
  indicators — one private dep (data-only reference), one named
  export (drawn), and one default export consuming both.
- Root `README.md` gains a single-line link to the
  composition docs.
- One aggregate changeset records the feature surface in one
  place for the release notes.

## Requirements

### 1. Conformance scenarios

Each scenario lives in
`packages/conformance/src/scenarios/<id>.scenario.ts` and uses
`Scenario.inlineSource` to keep its `.chart.ts` source inline.

**Scenario 1 — `dep-private-single-file`.** One file with one
non-exported `const` dep + one default-export consumer.
Asserts:
- Consumer's plot hash matches a pinned SHA-256.
- No dep plots appear in `runner.drain().plots`.
- Diagnostic count = 0.

**Scenario 2 — `dep-multi-export`.** One file with three
indicators: one private dep + one named export + one default
export. The default export consumes both the private dep and the
named export (testing drawn-binding-as-data-source).
Asserts:
- Default + named exports' plots both surface, prefixed
  (`export:<name>/...` slot ids).
- Private dep plots dropped.
- All emissions pin-matched.

**Scenario 3 — `dep-cross-file`.** Two files —
`base-trend.chart.ts` + `trend-confirmation.chart.ts`. Uses
`Scenario.inlineSource` for the consumer + an `additionalSources`
extension on `Scenario` (see §1.1) for the producer.
Asserts:
- Producer compiled and inlined by the bundler.
- Consumer's emissions pin-matched.

**Scenario 4 — `dep-diamond`.** One file with two private dep
bindings (`fastTrend` + `slowTrend`) — both `baseTrend.withInputs({...})`
chained — and one default-export consumer that reads both. The
producer's compiled module is shared (cache hit in
`createProducerResolver`).
Asserts:
- Both deps run per bar.
- Each gets its own state slot section in the snapshot
  (verifies Task 5 prefixing).

**Scenario 5 — `dep-error-halts-parent`.** The dep's compute
throws on bar index 5. Consumer drops its own emissions for that
bar; subsequent bars resume normally.
Asserts:
- `dep-error` diagnostic surfaces with the inner message.
- Consumer plots for bar 5 are absent.
- Consumer plots for bar 6 are present.

### 1.1 `Scenario.additionalSources`

To support cross-file scenarios, extend `Scenario` (in
`packages/conformance/src/runConformanceSuite.ts`):

```ts
export type Scenario = {
    // ... existing fields ...
    /**
     * Additional `.chart.ts` source files written next to the
     * inline source under `.cache/` so the consumer can
     * `import "./producer.chart"`. Map key is the relative path
     * (`"./producer.chart"`); value is the source text. Phase-7
     * indicator-composition scenarios use this for cross-file
     * dep tests. `@since 0.7`.
     */
    readonly additionalSources?: Readonly<Record<string, string>>;
};
```

`runConformanceSuite` writes each entry into the `.cache/` dir
under the scenario's tmp root and `import()`s the compiled
result through the existing `file://` URL path. Cleanup in the
`finally` block extends to remove the additional files.

### 2. Conformance test wiring

`packages/conformance/src/scenarios/index.ts` re-exports the
five new scenarios.

`packages/conformance/src/runConformanceSuite.test.ts` extended
with one assertion per new scenario (re-running them through
the runner and confirming the per-bar emission hash matches).

`packages/conformance/CLAUDE.md` updated to describe
`additionalSources` semantics and the `dep-*` scenario family.

### 3. Docs — narrative page

New file `docs/language/indicator-composition.md` (~250 lines):

- Frontmatter with `title`, `since: "0.7"`, `status: "stable"`.
- Overview of the feature with a worked example.
- "Producer vs consumer" diagram explaining export-status
  semantics.
- `.withInputs(...)` semantics + the `dep-invalid-input-override`
  diagnostic.
- `.output(...)` semantics + the `dep-unknown-output` and
  `dep-output-not-titled` diagnostics.
- Multi-export files.
- Cross-file imports.
- Cycle detection.
- Dep error handling (parent halts).
- State / persistence isolation (link to spec/semantics).
- What's NOT supported in this release (cross-package imports,
  dynamic resolution, opt-in emission forwarding).

The page passes `pnpm docs:snippets` — every fenced ts block
compiles. Tag blocks with `no-gate` when they include
deliberate-error examples.

### 4. Docs — spec updates

`docs/spec/manifest.md` — new section "Indicator dependencies".
Lists the five new optional `ScriptManifest` fields with their
JSON shapes. Single-script manifests stay byte-identical.

`docs/spec/semantics.md` — new section "Dependency execution
order". Documents:
- Deterministic per-bar order: deps (topological) → siblings →
  primary.
- Slot-id prefixing: `dep:<localId>/`, `export:<exportName>/`,
  empty for primary.
- Emission policy: private dep visuals dropped; sibling visuals
  forwarded with prefix; diagnostics always forwarded.
- Dep error → parent's bar emissions dropped.

`docs/spec/versioning.md` — clarification section: every change
in this folder is additive within `apiVersion: 1.x`. The 172-entry
`STATEFUL_PRIMITIVES` set is unchanged. `DiagnosticCode` extended
with six additive entries per the "Emission Wire Schemas"
clause.

`docs/reference/glossary.md` — add entries: "drawn indicator",
"private dep", "consumer", "producer", "dep local id", "output
title".

### 5. Example scripts

`examples/scripts/base-trend.chart.ts`:

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, input, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Base Trend",
    apiVersion: 1,
    overlay: true,
    inputs: { length: input.int(50, { min: 2, max: 250 }) },
    compute({ bar, ta, inputs, plot }) {
        plot(ta.ema(bar.close, inputs.length as number), {
            title: "line",
            color: "#3b82f6",
        });
    },
});
```

`examples/scripts/trend-confirmation.chart.ts`:

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";
import baseTrend from "./base-trend.chart";

// Private dep — not drawn:
const fastTrend = baseTrend.withInputs({ length: 20 });

// Drawn sibling — exported:
export const slowTrend = baseTrend.withInputs({ length: 100 });

export default defineIndicator({
    name: "Trend Confirmation",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        const fast = fastTrend.output("line");
        const slow = slowTrend.output("line");
        if (ta.crossover(fast, slow).current) {
            plot(bar.close, { title: "Confirmed cross" });
        }
    },
});
```

Update `packages/cli/src/e2e.test.ts` to include both new files
in its path list — confirms both compile and the artefact
sidecars match the expected union manifest shape (single object
for `base-trend`; array for `trend-confirmation`).

### 5.1 React-demo catalogue script

`examples/react-demo/src/scripts.ts` holds the demo's inline
script catalogue (`DEMO_SCRIPTS: ReadonlyArray<DemoScript>`,
currently 4 entries). Add a fifth entry — `id:
"trend-composition"`, `label: "Trend Composition"` — whose
inline source demonstrates the feature **inside one file** with
three `defineIndicator(...)` results:

1. A **private dep** — `const baseTrend = defineIndicator({...})`,
   not exported. Plots `ta.ema(bar.close, 20)` with
   `title: "line"`. Used only as a data reference; never drawn.
2. A **named export** — `export const slowTrend =
   baseTrend.withInputs({ length: 50 })` (drawn sibling; its
   plot renders with the `export:slowTrend/` slot-id prefix).
3. The **default export** — consumes both via
   `baseTrend.output("line")` and `slowTrend.output("line")`
   and plots a crossover marker.

Notes:

- For variant 1 to be overridable via `.withInputs({ length })`,
  the private `baseTrend` declares
  `inputs: { length: input.int(20, { min: 2, max: 250 }) }` —
  same shape as the `base-trend.chart.ts` example in §5.
- Follow the catalogue's existing conventions: two-line MIT
  header inside the template string, top-level imports +
  destructured compute params (per `examples/CLAUDE.md`).
- The demo's existing compile-and-mount path picks the new
  entry up automatically once Tasks 3–6 land — this section
  only adds the catalogue entry; no `App.tsx` / `ChartPane.tsx`
  changes are expected.

### 6. Root README

Add one line to the relevant section of
`/Users/julianwaibel/Documents/GitHub/chartlang/README.md`:

```md
- **Compose indicators.** Bind one indicator to a `const`, read
  its outputs from another's `compute`. See [Indicator
  composition](./docs/language/indicator-composition.md).
```

Confirm the file stays ≤ 300 lines via `pnpm readme:check`.

### 7. Aggregate changeset

`.changeset/indicator-composition-release.md`:

- Bumps: **minor** for `chartlang-core`, `chartlang-compiler`,
  `chartlang-runtime`, `chartlang-adapter-kit`,
  `chartlang-host-worker`, `chartlang-host-quickjs`,
  `chartlang-language-service`, `chartlang-conformance`,
  `chartlang-cli`. **Patch** for `chartlang-editor` and the
  `canvas2d-adapter` example.
- Reason summary in the body:
  - Compose indicators via `const` binding + `.output("title")`.
  - Multi-export `.chart.ts` files (default + named exports).
  - Private (non-exported) deps act as data feeds only.
  - Additive within `apiVersion: 1`; no `STATEFUL_PRIMITIVES`
    change.
  - Cross-file `import X from "./Y.chart"` resolves
    recursively.

The aggregate changeset coexists with the per-task changesets —
the version bump output rolls them up.

### 8. CLI scaffold (optional)

`packages/cli/src/` — confirm `chartlang compile` handles the
new artefact shape (Task 3 already wired it). Add one CLI smoke
test driving the multi-export example through `chartlang compile`
to assert the array sidecar lands.

### 9. Test layers

- `conformance/src/scenarios/dep-*.scenario.ts` — five files.
- `conformance/src/runConformanceSuite.test.ts` — five
  assertions.
- `conformance/src/runConformanceSuite.ts` — `additionalSources`
  wiring.
- `cli/src/e2e.test.ts` — bundle compilation.
- `examples/canvas2d-adapter/src/integration.test.ts` — already
  extended in Task 6; verify the new example scripts work.
- `docs/` linter — `pnpm docs:snippets` confirms every fenced
  block compiles.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/conformance/src/scenarios/dep-private-single-file.scenario.ts` | create | Scenario 1. |
| `packages/conformance/src/scenarios/dep-multi-export.scenario.ts` | create | Scenario 2. |
| `packages/conformance/src/scenarios/dep-cross-file.scenario.ts` | create | Scenario 3. |
| `packages/conformance/src/scenarios/dep-diamond.scenario.ts` | create | Scenario 4. |
| `packages/conformance/src/scenarios/dep-error-halts-parent.scenario.ts` | create | Scenario 5. |
| `packages/conformance/src/scenarios/index.ts` | modify | Re-export new scenarios. |
| `packages/conformance/src/runConformanceSuite.ts` | modify | `additionalSources` field + cleanup. |
| `packages/conformance/src/runConformanceSuite.test.ts` | modify | Per-scenario assertions. |
| `packages/conformance/CLAUDE.md` | modify | Document `additionalSources` + dep family. |
| `docs/language/indicator-composition.md` | create | Narrative guide. |
| `docs/spec/manifest.md` | modify | Manifest field docs. |
| `docs/spec/semantics.md` | modify | Execution order + emission policy docs. |
| `docs/spec/versioning.md` | modify | Additive-within-1.x clarification. |
| `docs/reference/glossary.md` | modify | Five new terms. |
| `examples/scripts/base-trend.chart.ts` | create | Producer example. |
| `examples/scripts/trend-confirmation.chart.ts` | create | Consumer example. |
| `examples/scripts/CLAUDE.md` | modify | Note the new examples. |
| `examples/react-demo/src/scripts.ts` | modify | Fifth catalogue entry `trend-composition`: one file, 3 indicators (private dep + named export + default consumer). |
| `packages/cli/src/e2e.test.ts` | modify | Bundle compile + sidecar shape. |
| `README.md` (root) | modify | One-line link to composition docs. Stay ≤ 300 lines. |
| `.changeset/indicator-composition-release.md` | create | Aggregate changeset. |

## Gates

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm docs:check`,
  `pnpm docs:snippets`, `pnpm readme:check`, `pnpm conformance`,
  `pnpm bench:ci` — green.
- 100% coverage holds across every touched package.
- All five new conformance scenarios pin against their first
  deterministic run.
- Root README ≤ 300 lines.
- Existing scenarios pin-hashes unchanged.

## Changeset

Aggregate `.changeset/indicator-composition-release.md` as
described in §7 above.

## Acceptance Criteria

- [ ] Five new conformance scenarios pass with pinned plot
      hashes + diagnostic-code assertions.
- [ ] `Scenario.additionalSources` lets cross-file scenarios
      ship producer + consumer in one scenario file.
- [ ] `docs/language/indicator-composition.md` lands and every
      fenced ts block passes `pnpm docs:snippets`.
- [ ] `docs/spec/manifest.md`, `docs/spec/semantics.md`,
      `docs/spec/versioning.md` cover the new shapes.
- [ ] `docs/reference/glossary.md` gains five terms.
- [ ] Two new example `.chart.ts` files compile through the
      CLI's e2e test.
- [ ] React-demo catalogue gains the `trend-composition` entry —
      one file with three indicators (private dep, named export,
      default consumer); the named export and the default both
      render, the private dep does not.
- [ ] Root README stays ≤ 300 lines.
- [ ] Aggregate changeset committed.
- [ ] `pnpm conformance` end-to-end green on a clean checkout.
- [ ] Phase-1 and Phase-2 scenarios remain unchanged.

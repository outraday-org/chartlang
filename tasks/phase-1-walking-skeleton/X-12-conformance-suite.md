# Task 12 — Conformance Suite: `runConformanceSuite` + Golden Fixtures

> **Status: TODO**

## Goal

Seed `@invinite-org/chartlang-conformance` with the
`runConformanceSuite(adapter)` runner, the shared `goldenBars.json`
fixture (10 000 bars across 4 synthetic regimes), and one
conformance scenario per Phase-1 example script. Closes the
Phase-0 `scripts/run-conformance.ts` short-circuit (which exits
"0 scenarios, 0 failures" today) — Phase 1's CI gate runs real
scenarios against the canvas2d adapter end-to-end.

## Prerequisites

- Task 10 (canvas2d reference adapter — the default adapter the
  conformance suite drives).
- Task 11 (example scripts compile via the CLI; their compiled
  outputs are the scenario inputs).
- Task 7 (golden hashes for `ta.*` outputs reference this fixture).
- Task 4 (adapter-kit shapes: `Adapter`, `RunnerEmissions`,
  `validateEmission`).

## Desired Behavior

After this task:

- `import { runConformanceSuite } from
  "@invinite-org/chartlang-conformance"` is callable from any
  consumer-repo adapter test.
- `runConformanceSuite(adapter)` returns a `ConformanceReport`
  with `passed`, `failed`, and per-scenario diffs.
- `pnpm conformance` (the Phase-0 wrapper) drives the suite
  against `examples/canvas2d-adapter`'s adapter and exits non-zero
  on any failure.
- The shared `goldenBars.json` is reproducible (a TypeScript
  generator script lives alongside it; running it produces a
  byte-identical fixture).
- Every Phase-1 `ta.*` primitive has at least one scenario
  exercising it (the §16.6 conformance entry of the five-file
  set).
- 100% coverage on the runner + every scenario module.

## Requirements

### 1. Golden bars fixture generator

```ts
// packages/conformance/src/fixtures/generateGoldenBars.ts
import { writeFileSync } from "node:fs";

export type GoldenBars = ReadonlyArray<Bar>;

export function generateGoldenBars(): GoldenBars;

// CLI:
// $ pnpm tsx packages/conformance/src/fixtures/generateGoldenBars.ts
```

Generates 10 000 bars at `1D` interval across four 2 500-bar
segments:

1. **Trend (0-2499):** linear drift `+0.1%`/bar with sin-wave
   noise. Volatility low.
2. **Range (2500-4999):** mean-reverting around a flat baseline.
   Volatility moderate.
3. **High-vol (5000-7499):** σ = 4× segment 1's σ. No drift.
4. **Low-vol (7500-9999):** σ = 0.25× segment 1's σ. Slight drift.

Use a deterministic PRNG with seed `0xC0DE` (Mulberry32 — tiny,
deterministic, no dep). Volume = `base * (1 + |return|*10)` so
volume correlates with absolute returns.

Output: `packages/conformance/fixtures/goldenBars.json`
(top-level `fixtures/`, NOT under `src/`). Pretty-printed (4-space
indent), trailing newline. Extend the package's
`vitest.config.ts` `exclude` list with `fixtures/**` so the JSON
isn't counted as uncovered "code".

The generator is a one-shot run, but checked in. A unit test
re-runs the generator in-memory and asserts the on-disk file's
SHA-256 matches the generator's output — catches accidental
edits to `goldenBars.json`.

### 2. `runConformanceSuite` (`src/runConformanceSuite.ts`)

```ts
export type Scenario = {
    readonly id: string;
    readonly title: string;
    readonly scriptPath: string;            // resolved relative to repo root
    readonly intervalCount: number;
    readonly assertions: ReadonlyArray<ScenarioAssertion>;
};

export type ScenarioAssertion =
    | { kind: "plot-hash"; slotId?: string; sha256: string }
    | { kind: "alert-count"; count: number }
    | { kind: "alert-message-contains"; pattern: string; min: number }
    | { kind: "diagnostic-code-absent"; code: DiagnosticCode };

export type ConformanceFailure = {
    readonly scenarioId: string;
    readonly assertionKind: ScenarioAssertion["kind"];
    readonly message: string;
};

export type ConformanceReport = {
    readonly passed: number;
    readonly failed: number;
    readonly failures: ReadonlyArray<ConformanceFailure>;
};

export function runConformanceSuite(
    adapter: Adapter,
    opts?: {
        scenarios?: ReadonlyArray<Scenario>;        // default: all bundled scenarios
        candles?: GoldenBars;                       // default: bundled goldenBars.json
        compile?: typeof compile;                   // injection for tests
    },
): Promise<ConformanceReport>;
```

Runner flow per scenario:

1. Read the scenario's script via `compileFile`.
2. Build a `ScriptRunner` directly (not via `host-worker`) using
   `createScriptRunner({ compiled, capabilities: adapter.capabilities })`.
   This sidesteps Worker-boundary noise — the adapter under test
   must be a pure-function `Adapter`, and the scenarios only
   exercise the emission contract.
3. Iterate `goldenBars` and call `onBarClose` per bar.
4. Periodically call `drain()` and feed into `adapter.onEmissions`.
5. Buffer emissions via a `BufferingAdapter`-like wrapper so
   assertions can inspect the full series.
6. Evaluate each assertion against the buffered emissions.

`plot-hash` assertion: SHA-256 of the JSON-stringified array of
`{ bar, value }` tuples for that slotId. Stable across runs
because emission order is deterministic (§6.4).

### 3. Scenarios (`src/scenarios/`)

One file per Phase-1 example script. Each exports a
`Scenario` constant.

**`scenarios/emaCross.scenario.ts`:**

```ts
export const EMA_CROSS_SCENARIO: Scenario = Object.freeze({
    id: "ema-cross",
    title: "EMA(12)/EMA(26) crossover alerts",
    scriptPath: "examples/scripts/ema-cross.chart.ts",
    intervalCount: 1,
    assertions: [
        { kind: "plot-hash", sha256: "<TBD — pinned on first run>" },
        { kind: "alert-count", count: 42 },           // pinned crossovers on goldenBars
        { kind: "alert-message-contains", pattern: "crossed above", min: 20 },
        { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    ],
});
```

The first run records actual hashes/counts; subsequent runs
verify byte-identity. A `scripts/regenerate-golden-conformance.ts`
helper writes the assertion values back to the scenario file when
the math intentionally changes (gated behind a `BREAKING:`
changeset per §16.6).

**`scenarios/bollingerBands.scenario.ts`:** three `plot-hash`
assertions (one per BB band) + zero alerts + no
`unsupported-plot-kind` diagnostic.

**`scenarios/rsiDivergenceAlert.scenario.ts`:** one `plot-hash`
for RSI + two `hline` emissions + pinned alert count + asserts the
`unsupported-pane` diagnostic IS present (the script declares
`overlay: false` against a `subPanes: 0` adapter).

### 4. `src/index.ts` — public surface

```ts
export { runConformanceSuite } from "./runConformanceSuite";
export type { Scenario, ScenarioAssertion, ConformanceReport,
              ConformanceFailure } from "./runConformanceSuite";
export { EMA_CROSS_SCENARIO } from "./scenarios/emaCross.scenario";
export { BOLLINGER_BANDS_SCENARIO } from "./scenarios/bollingerBands.scenario";
export { RSI_DIVERGENCE_SCENARIO } from "./scenarios/rsiDivergenceAlert.scenario";
export { PHASE_1_SCENARIOS } from "./scenarios";    // frozen array of all three
export { generateGoldenBars } from "./fixtures/generateGoldenBars";
```

### 5. `scripts/run-conformance.ts` already detects the export

The Phase-0 wrapper at `scripts/run-conformance.ts` lazy-imports
`@invinite-org/chartlang-conformance` and exits 0 if the
`runConformanceSuite` function is missing. Once Task 12 lands, the
wrapper:

1. Imports `runConformanceSuite` + the canvas2d adapter's default
   export.
2. Builds an adapter via `createCanvas2dAdapter` with a no-op
   canvas (a `MockCanvas2DContext` from Task 10's `./testing`
   sub-path export) — the suite tests the emission contract, not
   rendering.
3. Calls `runConformanceSuite(adapter)`.
4. Prints `conformance: <passed> scenarios passed, <failed>
   failures.`. Exits 1 if any failure.

**No edit to `run-conformance.ts` is needed** — the wrapper
already calls into the runner. But the canvas2d adapter's
**default export** must be the constructed `Adapter`. Update
`examples/canvas2d-adapter/src/index.ts` to export a default
adapter built against the `MockCanvas2DContext` from Task 10's
`./testing` sub-path:

```ts
import { MockCanvas2DContext } from "./testing";

export default createCanvas2dAdapter({
    canvas: new MockCanvas2DContext() as unknown as OffscreenCanvas,
    candleSource: emptySource(),
});
```

The `./testing` import is package-internal (same package), so no
sub-path resolution is required here — Task 12's harness imports
it across packages via
`chartlang-example-canvas2d-adapter/testing`, which is what
required the public `exports` entry from Task 10.

Actual `scripts/run-conformance.ts` edit (small):

```ts
// Already detects runConformanceSuite. Add adapter resolution:
const adapter = adapterMod?.default ?? null;
if (!adapter) {
    console.error("conformance: canvas2d adapter has no default export");
    process.exit(1);
}
const report = await conformanceMod.runConformanceSuite(adapter);
console.log(`conformance: ${report.passed} scenarios passed, ${report.failed} failures.`);
process.exit(report.failed > 0 ? 1 : 0);
```

### 6. Tests

§16.3 row: unit + type. Conformance tests THEMSELVES live in the
runner — the runner tests prove the runner's contract.

- `runConformanceSuite.test.ts`:
  - A passing scenario fixture → report with `failed: 0`.
  - A failing scenario fixture (wrong hash, wrong alert count) →
    report with the expected failure entries.
  - `validateEmission`-failing emissions get reported (this
    shouldn't happen in the wild — runtime drops malformed
    emissions — but the test asserts the runner doesn't crash if
    one slips through).
- `generateGoldenBars.test.ts`:
  - Length === 10 000.
  - Four segments each have the expected statistical properties
    (mean drift / σ).
  - Re-generating produces byte-identical JSON to the on-disk
    file.
- Per-scenario tests: import each scenario, run against a tiny
  PassThroughAdapter with capabilities matching canvas2d's set,
  assert all assertions pass.
- Type tests: `expect-type` over `runConformanceSuite`'s return.

100% coverage. The scenario files (constants) need each property
exercised — accomplished by the runner's scenario-walking tests.

### 7. Codecov / coverage merge

`scripts/coverage-merge.ts` (Phase 0) walks `packages/*/coverage/`
and `examples/canvas2d-adapter/coverage/`. The conformance
package's coverage rolls in for free — no edit.

### 8. JSDoc + README

- `runConformanceSuite` has `@since 0.1` + `@example` showing a
  consumer-repo adapter wiring.
- Each scenario constant has a one-line description in its JSDoc.
- `packages/conformance/README.md` ≤ 100 lines, §17.1 structure.
  Section "Public surface" lists `runConformanceSuite` and the
  three phase-1 scenarios.

### 9. Remove `PACKAGE_VERSION`

Delete the placeholder + Task-3 JSDoc shim from
`packages/conformance/src/index.ts`.

### 10. Mark `examples/scripts/` as Phase-1-complete

Update the parent `examples/CLAUDE.md` (or create one) to list
the three scripts as the Phase-1 conformance seed; deferred
scripts (e.g. the Phase-3 `fib-retracement.chart.ts`) are
documented as TBD.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/conformance/src/fixtures/generateGoldenBars.ts` | Create | Deterministic 10 000-bar generator. Writes to `../../fixtures/goldenBars.json` (i.e. `packages/conformance/fixtures/goldenBars.json`, outside `src/`). |
| `packages/conformance/fixtures/goldenBars.json` | Create | Generated fixture. Top-level `fixtures/` directory, not under `src/`. |
| `packages/conformance/vitest.config.ts` | Modify | Extend the §16.1 default `exclude` list with `"fixtures/**"` so the JSON isn't counted as code. |
| `packages/conformance/src/runConformanceSuite.ts` | Create | Runner. |
| `packages/conformance/src/scenarios/emaCross.scenario.ts` | Create | Phase-1 scenario. |
| `packages/conformance/src/scenarios/bollingerBands.scenario.ts` | Create | Phase-1 scenario. |
| `packages/conformance/src/scenarios/rsiDivergenceAlert.scenario.ts` | Create | Phase-1 scenario. |
| `packages/conformance/src/scenarios/index.ts` | Create | `PHASE_1_SCENARIOS` array. |
| `packages/conformance/src/index.ts` | Modify | Public surface (remove placeholder). |
| `packages/conformance/src/*.test.ts` | Create | Per-module tests. |
| `packages/conformance/package.json` | Modify | Workspace deps on core, compiler, runtime, adapter-kit. |
| `packages/conformance/README.md` | Modify | Replace placeholder. |
| `examples/canvas2d-adapter/src/index.ts` | Modify | Add default export wired for headless conformance use. |
| `scripts/run-conformance.ts` | Modify | Replace early-exit with real runner invocation. |
| `examples/CLAUDE.md` | Create / Modify | Document the three Phase-1 scripts + deferred entries. |

## Acceptance Criteria

- `pnpm -F @invinite-org/chartlang-conformance typecheck && pnpm
  -F @invinite-org/chartlang-conformance test` pass with 100%
  coverage.
- `pnpm conformance` exits 0 with the three Phase-1 scenarios
  passing against `examples/canvas2d-adapter`'s default adapter:
  `conformance: 3 scenarios passed, 0 failures.`
- Each Phase-1 example script's scenario passes every assertion:
  `plot-hash` matches the pinned hash, `alert-count` matches the
  pinned crossover count, and the `unsupported-pane` diagnostic
  appears exactly where expected.
- Re-running `pnpm tsx packages/conformance/src/fixtures/generateGoldenBars.ts`
  produces a byte-identical `goldenBars.json`.
- The fixture-determinism test (re-generate + SHA-256-compare)
  passes.
- The Phase-1 README's "Done criteria" — "Open
  `examples/canvas2d-adapter/` in a browser; EMA-cross script
  renders the EMA line and fires alerts on crossovers" — is
  manually verifiable via the playground from Task 10.
- `pnpm test` exits 0 across the entire workspace at 100%
  coverage.
- `pnpm conformance && pnpm bench:ci && pnpm docs:check && pnpm
  readme:check && pnpm coverage:report` all pass.
- Every primitive shipped (the 12 stateful entries in
  `STATEFUL_PRIMITIVES`) has its §16.6 five-file set complete —
  the conformance entry is fulfilled by being exercised inside at
  least one of the three Phase-1 scenarios.
- Phase 1 closes: ready to start Phase 2 (full indicator parity).

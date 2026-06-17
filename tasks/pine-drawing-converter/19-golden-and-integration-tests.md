# Task 19 — Golden + integration tests (Pine → TS → compile → emit)

> **Status: TODO**

## Goal

Ship the end-to-end test suite that proves the converter actually
works: a corpus of Pine v6 fixture scripts, their expected chartlang
TS outputs (snapshotted), and three integration scenarios in
`packages/conformance` that ingest a Pine fixture, run the converter,
compile the output via `@invinite-org/chartlang-compiler`, run it
through the runtime against a canned bar stream, and assert the
emitted drawing stream matches a golden trace. This task is what gives
the converter a credibility-by-evidence contract: each fixture
demonstrates a specific Pine→chartlang mapping survives all the way
through to bytes-on-emission.

## Prerequisites

Task 18 (CLI + API complete).

## Current Behavior

Unit/property tests for each pass exist (Tasks 2–17). No end-to-end
integration tests. No fixture corpus.

## Desired Behavior

- `packages/pine-converter/fixtures/` — a corpus of Pine source files
  covering Camp A, Camp B, Camp C heuristic, Camp C reject, tables,
  polylines, linefill, strategy downgrade.
- `packages/pine-converter/fixtures/<name>.expected.chart.ts` — the
  expected chartlang TS output for each fixture.
- `packages/pine-converter/fixtures/<name>.expected.diagnostics.json`
  — the expected diagnostic list.
- `packages/pine-converter/src/tests/golden.test.ts` — drives the
  fixture corpus: `convert(fixture.pine)`, compare to
  `<name>.expected.chart.ts` (byte-exact), compare diagnostic list
  (structural).
- `packages/conformance/src/scenarios/pineConverterRoundTrip*.scenario.ts`
  — three round-trip scenarios.

## Requirements

### 1. Fixture corpus (`packages/pine-converter/fixtures/`)

Each fixture is a triple: `<name>.pine`, `<name>.expected.chart.ts`,
`<name>.expected.diagnostics.json`. Minimum corpus:

| Fixture | Demonstrates |
|---|---|
| `01-empty-indicator.pine` | Bare `indicator("Empty")` declaration. |
| `02-camp-a-single-line.pine` | `var line lvl = na` + `barstate.islast` + 2 setters. |
| `03-camp-a-label.pine` | `var label lbl = na` + style + text. |
| `04-camp-a-box.pine` | `var box bx = na` + corner setters + bg color. |
| `05-camp-a-delete.pine` | Camp A handle deleted after use. |
| `06-camp-b-pivot-lines.pine` | Pivot-detection script: `var array<line>` + push + size-gate + shift. |
| `07-camp-b-zone-boxes.pine` | Order-block style: `var array<box>` + push + literal-bounded update loop. |
| `08-camp-c-heuristic-implicit-cap.pine` | Push without eviction + `max_lines_count=30` → H1 heuristic. |
| `09-camp-c-reject-unbounded.pine` | Push with no cap → hard reject. |
| `10-camp-c-reject-linefill.pine` | Cross-collection linefill → hard reject. |
| `11-table-dashboard.pine` | 2-col × 5-row dashboard table. |
| `12-table-merged-header.pine` | Table with `merge_cells` row. |
| `13-polyline-literal.pine` | 3-anchor curved polyline. |
| `14-polyline-rebuild.pine` | `var array<chart.point>` literal-bound rebuild. |
| `15-linefill-two-line.pine` | Top-level two-line linefill. |
| `16-bar-index-future.pine` | `line.new(bar_index, …, bar_index + 10, …)` — future anchor. |
| `17-strategy-downgrade.pine` | `strategy("S")` with `strategy.entry` → indicator + alert. |
| `18-input-int-and-source.pine` | `input.int` and `input.source`. |
| `19-input-timeframe.pine` | `input.timeframe("60")` → `input.interval("1h")`. |
| `20-real-world-sr.pine` | A real-world support/resistance script combining inputs + pivot detection + box drawing + table dashboard. |

Each `<name>.pine` is short (≤30 lines) and isolates one feature
(except `20-real-world-sr.pine`, which is a longer integration
fixture).

### 2. Golden snapshot drive (`golden.test.ts`)

```ts
describe("converter goldens", () => {
    const fixtures = readdirSync(FIXTURES_DIR).filter(f => f.endsWith(".pine"));
    for (const fix of fixtures) {
        it(fix, async () => {
            const source = readFileSync(join(FIXTURES_DIR, fix), "utf-8");
            const result = convert(source, {
                barInterval: 60_000,
                barIndexOrigin: 1_700_000_000_000,
            });
            const expectedTs = readFileSync(join(FIXTURES_DIR, fix.replace(".pine", ".expected.chart.ts")), "utf-8");
            const expectedDiag = JSON.parse(readFileSync(join(FIXTURES_DIR, fix.replace(".pine", ".expected.diagnostics.json")), "utf-8"));
            expect(result.output).toBe(expectedTs);
            expect(diagnosticsForSnapshot(result.diagnostics)).toEqual(expectedDiag);
        });
    }
});
```

`diagnosticsForSnapshot` normalizes spans (line+col only, no
character offsets) and codes for stable comparison.

A snapshot-update mode is enabled via `UPDATE_FIXTURES=1` env var so a
maintainer can regenerate after intentional changes.

### 3. Conformance round-trip scenarios

Three scenarios in `packages/conformance/src/scenarios/`. The
conformance harness (`packages/conformance/src/runConformanceSuite.ts`)
takes **plain typed object literals** typed as `Scenario` — there is
no `defineScenario(...)` builder. Scenarios declare `id`, `title`,
`inlineSource`, `intervalCount`, and an
`assertions: ReadonlyArray<ScenarioAssertion>` list; the harness
compiles + runs the script and matches the
assertions. Pre-bake the converter output at scenario-definition time
so the scenario's `INLINE_SOURCE` is a static string the harness
compiles via `runConformanceSuite`.

`pineConverterRoundTripCampA.scenario.ts`:

```ts
import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";
import { convert } from "@invinite-org/chartlang-pine-converter";
import { readFileSync } from "node:fs";

const PINE_SOURCE = readFileSync(
    new URL("../../../pine-converter/fixtures/02-camp-a-single-line.pine", import.meta.url),
    "utf-8",
);
const CONVERTED = convert(PINE_SOURCE, { barInterval: 60_000 });
if (CONVERTED.output === null) {
    throw new Error("Pine converter failed during scenario module load");
}
const INLINE_SOURCE = CONVERTED.output;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "<pinned after first run>",   // pin via UPDATE_FIXTURES=1
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * Pine→chartlang Camp A round-trip: converts a Pine var-line script,
 * runs the emitted chartlang, asserts the drawing emission hash
 * matches the pinned trace.
 * @since 0.1
 * @experimental
 */
export const pineConverterRoundTripCampA: Scenario = {
    id: "pine-converter-round-trip-camp-a",
    title: "Pine converter round-trip Camp A",
    inlineSource: INLINE_SOURCE,
    // Drawing scenarios MUST run enough bars for the lifecycle to fire:
    // Camp A scripts gate on `barstate.islast`; Camp B scripts need
    // multiple pivot detections to populate the ring. Pick ~100 bars by
    // default; bump per-scenario when the fixture's pivot frequency or
    // table-rebuild cadence demands more.
    intervalCount: 100,
    assertions: ASSERTIONS,
};
```

The harness owns lifecycle (`createScriptRunner` + `onBarClose` +
`runner.drain()`); the scenario only supplies `inlineSource`,
`intervalCount`, optional capability overrides, and assertions.
**Do not** import `createScriptRunner` or `compile` into the scenario
module — that's the harness's job and breaks the conformance contract.

`pineConverterRoundTripCampB.scenario.ts` — same shape with the pivot
fixture; assertions include a `drawing-hash` plus runtime diagnostic
absence assertions (`unsupported-drawing-kind`,
`drawing-budget-exceeded`). Converter diagnostics such as
`ring-eviction-implicit` are asserted in the golden diagnostics JSON,
not in conformance, because the conformance harness only sees compiled
chartlang runtime diagnostics.

`pineConverterRoundTripTable.scenario.ts` — same shape with the
dashboard table fixture; assertions cover the rebuilt-per-bar table
emission stream.

Register all three by exporting the constants from each scenario
module and adding them to the `ALL_SCENARIOS` aggregator in
`packages/conformance/src/scenarios/index.ts`.

**Available `ScenarioAssertion.kind` values** (from
`runConformanceSuite.ts` — 11 total): `"plot-hash"`, `"plot-field"`,
`"alert-count"`, `"alert-message-contains"`, `"log-emission-count"`,
`"diagnostic-code-absent"`, `"diagnostic-code-present"`,
`"alert-condition-fired-at-bar"`, `"drawing-hash"`,
`"all-plots-on-pane"`. There is no `"emissions"` assertion kind —
use `drawing-hash` (optionally scoped via `handleId`) to pin the full
emission stream for a handle. Note: converter-emitted diagnostics
(e.g. `ring-eviction-implicit`, `camp-c-heuristic-applied`) are
asserted in the per-fixture `*.expected.diagnostics.json` file, NOT
in these scenarios — the conformance harness only observes runtime
diagnostics from the compiled chartlang script.

### 4. Determinism check

Add a property test in `golden.test.ts` that runs every fixture twice
and asserts byte-equality:

```ts
it("determinism: convert is byte-stable across 2 invocations", () => {
    for (const fix of fixtures) {
        const r1 = convert(source);
        const r2 = convert(source);
        expect(r1.output).toBe(r2.output);
        expect(r1.diagnostics).toEqual(r2.diagnostics);
    }
});
```

### 5. Coverage / failure modes

For every Camp C reject fixture, the test asserts:
- `output` is non-null in default mode (with reject comments).
- `output` is `null` when re-run with `strictMode: true`.
- The expected reject code is present in the diagnostics array.

### 6. Real-world integration fixture

`20-real-world-sr.pine` is a ~60-line Pine v6 script doing:
- An input panel (3 inputs).
- A pivot detection routine.
- A Camp B ring of horizontal lines for confirmed S/R levels.
- A Camp A label per line showing the price.
- A Camp A dashboard table showing stats (count of S/R levels, last
  pivot price).

The expected output exercises the full converter pipeline. This
fixture is the "does the converter actually work on something
realistic" gate.

### 7. Tests (§16.3)

| File | Purpose |
|------|---------|
| `golden.test.ts` | The fixture-driven snapshot loop. |
| `golden.determinism.test.ts` | Per-fixture byte-stability assertion. |
| `golden.strict.test.ts` | Per-Camp-C-reject fixture: strict mode produces `output: null`. |
| `pineConverterRoundTripCampA.scenario.ts` | Round-trip Camp A. |
| `pineConverterRoundTripCampB.scenario.ts` | Round-trip Camp B. |
| `pineConverterRoundTripTable.scenario.ts` | Round-trip table. |

Coverage 100% on `packages/pine-converter` after this task (all paths
exercised by the fixtures).

### 8. JSDoc

The new scenarios export entries (`pineConverterRoundTripCampA`,
etc.) carry `@since 0.1`, `@experimental`, and an `@example`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/fixtures/*.pine` | Create | 20 fixture Pine scripts. |
| `packages/pine-converter/fixtures/*.expected.chart.ts` | Create | 20 expected outputs. |
| `packages/pine-converter/fixtures/*.expected.diagnostics.json` | Create | 20 expected diagnostic lists. |
| `packages/pine-converter/src/tests/golden.test.ts` | Create | Snapshot-driver test. |
| `packages/pine-converter/src/tests/golden.determinism.test.ts` | Create | Determinism test. |
| `packages/pine-converter/src/tests/golden.strict.test.ts` | Create | Strict-mode test. |
| `packages/conformance/src/scenarios/pineConverterRoundTripCampA.scenario.ts` | Create | Round-trip Camp A scenario. |
| `packages/conformance/src/scenarios/pineConverterRoundTripCampB.scenario.ts` | Create | Round-trip Camp B scenario. |
| `packages/conformance/src/scenarios/pineConverterRoundTripTable.scenario.ts` | Create | Round-trip table scenario. |
| `packages/conformance/src/scenarios/index.ts` | Modify | Register three new scenarios. |
| `packages/conformance/package.json` | Modify | Add `@invinite-org/chartlang-pine-converter` dep (devDep for tests). |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% coverage on pine-converter)
- `pnpm conformance` (the three new scenarios pass against the
  reference adapter)
- `pnpm docs:check`

## Changeset

`.changeset/pine-converter-tests.md` — patch bump for
`@invinite-org/chartlang-pine-converter` and
`@invinite-org/chartlang-conformance` (new scenarios add to that
package's public surface).

## Acceptance Criteria

- All 20 fixture goldens pass.
- Determinism test passes (byte-stable across 2 invocations per
  fixture).
- Strict-mode test passes (every reject fixture produces null output
  in strict mode).
- The three round-trip conformance scenarios pass against the
  canvas2d reference adapter.
- 100% coverage on `packages/pine-converter`.
- JSDoc + lint + typecheck gates green.
- Changeset committed.

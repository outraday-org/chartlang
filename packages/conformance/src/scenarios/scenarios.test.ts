// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Adapter, CandleEvent, Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { capabilities as capBuilders } from "@invinite-org/chartlang-adapter-kit";
import type { compile as CompileFn, CompiledScript } from "@invinite-org/chartlang-compiler";
import type { Bar, ScriptManifest } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import {
    type Scenario,
    type ScenarioAssertion,
    runConformanceSuite,
} from "../runConformanceSuite.js";
import {
    ALL_SCENARIOS,
    BOLLINGER_BANDS_SCENARIO,
    DRAW_BUDGET_OVERFLOW_SCENARIO,
    DRAW_UNSUPPORTED_KIND_SCENARIO,
    EMA_CROSS_SCENARIO,
    PLOT_KIND_COVERAGE_SCENARIO,
    RSI_DIVERGENCE_SCENARIO,
} from "./index.js";
import * as scenarioRegistry from "./index.js";

const TEST_CAPABILITIES: Capabilities = {
    plots: capBuilders.union(capBuilders.line(), capBuilders.horizontalLine()),
    // Phase-3 Tasks 5–15 widen the conformance-suite-side cap surface
    // so the new line + box + curve + freehand + annotation + channel +
    // fib + gann + pitchfork + pattern scenarios reach `pushDrawing`'s
    // happy path. The `marker` and the 5 annotation kinds live in the
    // `labels` bucket; curve + freehand + channel + pitchfork +
    // harmonic-pattern kinds map to `polylines`; all 10 fib + 4 gann
    // kinds map to `other`. Tasks 16–18 grow this further as their
    // kinds ship.
    drawings: new Set([
        ...capBuilders.allLineDrawings(),
        ...capBuilders.allBoxDrawings(),
        ...capBuilders.allCurveDrawings(),
        ...capBuilders.allFreehandDrawings(),
        ...capBuilders.allAnnotationDrawings(),
        ...capBuilders.allChannelDrawings(),
        ...capBuilders.allFibDrawings(),
        ...capBuilders.allGannDrawings(),
        ...capBuilders.allPitchforkDrawings(),
        ...capBuilders.allPatternDrawings(),
        ...capBuilders.allElliottDrawings(),
        ...capBuilders.allCycleDrawings(),
        ...capBuilders.allContainerDrawings(),
    ]),
    alerts: capBuilders.alerts("log", "toast"),
    alertConditions: false,
    logs: false,
    inputs: new Set(["interval"]),
    intervals: [
        { value: "1m", label: "1 minute", group: "minute" },
        { value: "1D", label: "1 day", group: "daily" },
    ],
    multiTimeframe: false,
    subPanes: 0,
    symInfoFields: new Set(["ticker", "type", "mintick"]),
    maxDrawingsPerScript: { lines: 100, labels: 100, boxes: 100, polylines: 100, other: 100 },
    maxLookback: 1000,
    maxTickHz: 30,
};

function makeTestAdapter(): Adapter {
    return {
        id: "test",
        name: "Iteration-parity adapter",
        capabilities: TEST_CAPABILITIES,
        symInfo: {
            ticker: "TEST",
            type: "equity",
            mintick: 0.01,
        },
        resolveInputs(): Readonly<Record<string, unknown>> {
            return {};
        },
        candles(): AsyncIterable<CandleEvent> {
            return {
                async *[Symbol.asyncIterator](): AsyncIterator<CandleEvent> {
                    /* empty */
                },
            };
        },
        onEmissions(): void {
            /* no-op */
        },
        dispose(): void {
            /* no-op */
        },
    };
}

const OPT_IN_EXPORTED_SCENARIO_IDS = new Set([
    DRAW_BUDGET_OVERFLOW_SCENARIO.id,
    DRAW_UNSUPPORTED_KIND_SCENARIO.id,
]);

function isScenario(value: unknown): value is Scenario {
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as Readonly<Record<string, unknown>>;
    return (
        typeof candidate.id === "string" &&
        typeof candidate.title === "string" &&
        typeof candidate.intervalCount === "number" &&
        Array.isArray(candidate.assertions)
    );
}

function scenarioIds(scenarios: ReadonlyArray<Scenario>): ReadonlyArray<string> {
    return scenarios.map((scenario) => scenario.id);
}

function scenarioSourcePath(scenario: Scenario): string {
    if (scenario.additionalSources !== undefined) {
        // Cross-file scenarios receive an absolute `inline.chart.ts`
        // path under the runner's per-scenario tmp directory. The path
        // is random per run, so we compare on a prefix-match instead.
        return "__cross_file__";
    }
    if (scenario.inlineSource !== undefined) return `<inline:${scenario.id}>.chart.ts`;
    if (scenario.scriptPath !== undefined) return scenario.scriptPath;
    throw new Error(`Scenario "${scenario.id}" must define either scriptPath or inlineSource`);
}

const SINGLE_BAR: Bar = Object.freeze({
    time: 1_700_000_000_000,
    open: 100,
    high: 101,
    low: 99,
    close: 100,
    volume: 1_000,
    symbol: "TEST",
    interval: "1m",
    hl2: 100,
    hlc3: 100,
    ohlc4: 100,
    hlcc4: 100,
});

describe("bundled scenario constants", () => {
    it("ALL_SCENARIOS is frozen", () => {
        expect(Object.isFrozen(ALL_SCENARIOS)).toBe(true);
    });

    it("ALL_SCENARIOS lists each bundled exported scenario exactly once", () => {
        const allScenarioIds = scenarioIds(ALL_SCENARIOS);
        const exportedBundledScenarioIds = Object.values(scenarioRegistry)
            .filter(isScenario)
            .map((scenario) => scenario.id)
            .filter((id) => !OPT_IN_EXPORTED_SCENARIO_IDS.has(id))
            .sort();

        expect(allScenarioIds).toEqual([...new Set(allScenarioIds)]);
        expect(new Set(ALL_SCENARIOS).size).toBe(ALL_SCENARIOS.length);
        expect([...allScenarioIds].sort()).toEqual(exportedBundledScenarioIds);
    });

    it("runConformanceSuite defaults to ALL_SCENARIOS exactly (no silent skips)", async () => {
        const visitedSourcePaths: string[] = [];
        const compile: typeof CompileFn = async (_source, opts): Promise<CompiledScript> => {
            visitedSourcePaths.push(opts.sourcePath);
            const manifest: ScriptManifest = Object.freeze({
                apiVersion: 1,
                kind: "indicator",
                name: "noop",
                inputs: Object.freeze({}),
                capabilities: Object.freeze(["indicators"]),
                requestedIntervals: Object.freeze([]),
                userPickableInterval: false,
                seriesCapacities: Object.freeze({}),
                maxLookback: 0,
            });
            return Object.freeze({
                manifest,
                // Real compiler output carries the manifest on `default` AND
                // the `__manifest` sidecar; the shared loader merges the
                // sidecar and throws on a stub default with no sidecar.
                moduleSource:
                    "export default Object.freeze({ manifest: Object.freeze({ apiVersion: 1, kind: 'indicator', name: 'noop', inputs: Object.freeze({}), capabilities: Object.freeze(['indicators']), requestedIntervals: Object.freeze([]), userPickableInterval: false, seriesCapacities: Object.freeze({}), maxLookback: 0 }), compute() {} });\nexport const __manifest = { apiVersion: 1, kind: 'indicator', name: 'noop', inputs: {}, capabilities: ['indicators'], requestedIntervals: [], userPickableInterval: false, seriesCapacities: {}, maxLookback: 0 };",
                types: "",
            });
        };

        const report = await runConformanceSuite(makeTestAdapter(), {
            candles: [SINGLE_BAR],
            compile,
        });

        expect(report.passed + report.failed).toBe(ALL_SCENARIOS.length);
        const normalised = visitedSourcePaths.map((path, index) =>
            ALL_SCENARIOS[index].additionalSources === undefined ? path : "__cross_file__",
        );
        expect(normalised).toEqual(ALL_SCENARIOS.map(scenarioSourcePath));
    });

    it.each([
        { name: "ema-cross", scenario: EMA_CROSS_SCENARIO },
        { name: "bollinger-bands", scenario: BOLLINGER_BANDS_SCENARIO },
        { name: "rsi-divergence-alert", scenario: RSI_DIVERGENCE_SCENARIO },
    ])("$name carries a non-empty assertions array + script path", ({ scenario }) => {
        expect(scenario.id).not.toBe("");
        expect(scenario.title).not.toBe("");
        expect(scenario.scriptPath).toMatch(/^examples\/scripts\/.+\.chart\.ts$/);
        expect(scenario.intervalCount).toBe(1);
        expect(scenario.assertions.length).toBeGreaterThan(0);
        expect(Object.isFrozen(scenario)).toBe(true);
        expect(Object.isFrozen(scenario.assertions)).toBe(true);
    });

    it("every TA scenario carries an inlineSource and no scriptPath", () => {
        const taScenarios = ALL_SCENARIOS.filter((scenario) => scenario.id.startsWith("ta-"));
        expect(taScenarios.length).toBeGreaterThan(0);

        for (const scenario of taScenarios) {
            expect(scenario.title).not.toBe("");
            expect(scenario.scriptPath).toBeUndefined();
            expect(scenario.inlineSource).toMatch(/defineIndicator/);
            expect(scenario.intervalCount).toBe(1);
            expect(scenario.assertions.length).toBeGreaterThan(0);
            expect(Object.isFrozen(scenario)).toBe(true);
            expect(Object.isFrozen(scenario.assertions)).toBe(true);
        }
    });

    it("plot-kind-coverage carries an inlineSource and no scriptPath", () => {
        expect(PLOT_KIND_COVERAGE_SCENARIO.id).toBe("plot-kind-coverage");
        expect(PLOT_KIND_COVERAGE_SCENARIO.scriptPath).toBeUndefined();
        expect(PLOT_KIND_COVERAGE_SCENARIO.inlineSource).toMatch(/defineIndicator/);
        expect(PLOT_KIND_COVERAGE_SCENARIO.intervalCount).toBe(1);
        expect(PLOT_KIND_COVERAGE_SCENARIO.assertions.length).toBeGreaterThan(0);
        expect(Object.isFrozen(PLOT_KIND_COVERAGE_SCENARIO)).toBe(true);
        expect(Object.isFrozen(PLOT_KIND_COVERAGE_SCENARIO.assertions)).toBe(true);
    });

    it("every assertion declares a valid kind", () => {
        const valid: ReadonlySet<ScenarioAssertion["kind"]> = new Set([
            "plot-hash",
            "plot-field",
            "alert-count",
            "alert-message-contains",
            "log-emission-count",
            "diagnostic-code-absent",
            "diagnostic-code-present",
            "alert-condition-fired-at-bar",
            "drawing-hash",
            "all-plots-on-pane",
        ]);
        for (const scenario of ALL_SCENARIOS) {
            for (const assertion of scenario.assertions) {
                expect(valid.has(assertion.kind)).toBe(true);
            }
        }
    });

    // Phase 3 Task 19 — `DRAW_UNSUPPORTED_KIND_SCENARIO` is exported
    // but excluded from `ALL_SCENARIOS` because `TEST_CAPABILITIES`
    // advertises every Phase-3 kind and the diagnostic cannot fire.
    // This row pins the scenario against a narrow synthetic adapter
    // whose `capabilities.drawings = new Set(["line"])` so the
    // `unsupported-drawing-kind` path is exercised end-to-end.
    it("DRAW_UNSUPPORTED_KIND_SCENARIO fires unsupported-drawing-kind against a {line}-only adapter", async () => {
        const narrow: Adapter = {
            id: "narrow",
            name: "narrow-line-only",
            capabilities: {
                ...TEST_CAPABILITIES,
                drawings: new Set(["line"] as const),
            },
            candles(): AsyncIterable<CandleEvent> {
                return {
                    async *[Symbol.asyncIterator](): AsyncIterator<CandleEvent> {
                        /* empty */
                    },
                };
            },
            onEmissions(): void {
                /* no-op */
            },
            dispose(): void {
                /* no-op */
            },
        };
        const report = await runConformanceSuite(narrow, {
            scenarios: [DRAW_UNSUPPORTED_KIND_SCENARIO],
        });
        expect(report.failed).toBe(0);
        expect(report.passed).toBe(1);
    }, 60_000);

    // Phase 3 Task 19 / Task 22 closeout — `DRAW_BUDGET_OVERFLOW_SCENARIO`
    // is exported but excluded from `ALL_SCENARIOS` because the bundled
    // canvas2d adapter sizes `lines: 200`, and the scenario emits 150
    // lines against a 100-cap design. This row exercises it directly
    // against `TEST_CAPABILITIES` (lines: 100) so the
    // `drawing-budget-exceeded` path stays covered end-to-end.
    it("DRAW_BUDGET_OVERFLOW_SCENARIO fires drawing-budget-exceeded against a 100-cap adapter", async () => {
        const report = await runConformanceSuite(makeTestAdapter(), {
            scenarios: [DRAW_BUDGET_OVERFLOW_SCENARIO],
        });
        expect(report.failed).toBe(0);
        expect(report.passed).toBe(1);
    }, 60_000);
});

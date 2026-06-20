// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { createHash } from "node:crypto";

import type { Adapter, CandleEvent, Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { capabilities as capBuilders } from "@invinite-org/chartlang-adapter-kit";
import type { compile as CompileFn, CompiledScript } from "@invinite-org/chartlang-compiler";
import type { Bar, ScriptManifest } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { generateGoldenBars } from "./fixtures/generateGoldenBars.js";
import {
    type Scenario,
    type ScenarioAssertion,
    runConformanceSuite,
} from "./runConformanceSuite.js";
import {
    ALL_SCENARIOS,
    BARSTATE_CONFIRMED_SCENARIO,
    DEFINE_ALERT_CONDITION_FIRES_SCENARIO,
    DEFINE_ALERT_CONDITION_GATED_SCENARIO,
    DEFINE_ALERT_CONDITION_UNKNOWN_SCENARIO,
    DEP_CROSS_FILE_SCENARIO,
    DEP_DIAMOND_SCENARIO,
    DEP_ERROR_HALTS_PARENT_SCENARIO,
    DEP_MULTI_EXPORT_SCENARIO,
    DEP_PRIVATE_SINGLE_FILE_SCENARIO,
    DRAW_TABLE_GATED_SCENARIO,
    DRAW_TABLE_HAPPY_SCENARIO,
    EMA_CROSS_SCENARIO,
    INPUT_INTERVAL_SCENARIO,
    MTF_SECURITY_EXPRESSION_EMA_SCENARIO,
    MTF_SECURITY_EXPRESSION_NAN_FALLBACK_SCENARIO,
    PLOT_OFFSET_XSHIFT_SCENARIO,
    PLOT_STYLE_OVERRIDES_SCENARIO,
    REQUEST_SECURITY_NAN_FALLBACK_SCENARIO,
    RSI_SUBPANE_ROUTING_SCENARIO,
    RUNTIME_ERROR_SCENARIO,
    RUNTIME_LOG_BUDGET_SCENARIO,
    RUNTIME_LOG_GATED_SCENARIO,
    RUNTIME_LOG_INFO_SCENARIO,
    STATE_SESSION_HIGH_SCENARIO,
    STATE_TICK_COUNTER_SCENARIO,
    SYMINFO_MINTICK_SCENARIO,
    TIMEFRAME_ISDAILY_SCENARIO,
    UNSUPPORTED_INTERVAL_SCENARIO,
} from "./scenarios/index.js";

const TEST_CAPABILITIES: Capabilities = {
    plots: capBuilders.union(capBuilders.line(), capBuilders.horizontalLine()),
    // Phase-3 Tasks 5–15 widen the cap surface so the new line + box
    // (A + B) + curve + freehand + annotation + channel + fib (A + B)
    // + gann + pitchfork + pattern scenarios reach `pushDrawing`'s
    // happy path. The `marker` kind and Task 9's 5 annotation kinds
    // live in the `labels` bucket (already sized at 100); curve +
    // freehand + channel + pitchfork + harmonic-pattern kinds map to
    // `polylines`; all 10 fib + 4 gann kinds map to `other`.
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
        "table",
    ]),
    alerts: capBuilders.alerts("log", "toast"),
    alertConditions: true,
    logs: true,
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

function makeAdapter(): Adapter {
    return {
        id: "test",
        name: "Test adapter",
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

const SMALL_BARS: ReadonlyArray<Bar> = generateGoldenBars().slice(0, 200);
const SINGLE_BAR: ReadonlyArray<Bar> = SMALL_BARS.slice(0, 1);
const NOOP_MANIFEST: ScriptManifest = Object.freeze({
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
const NOOP_MODULE_SOURCE =
    "export default Object.freeze({ manifest: Object.freeze({ apiVersion: 1, kind: 'indicator', name: 'noop', inputs: Object.freeze({}), capabilities: Object.freeze(['indicators']), requestedIntervals: Object.freeze([]), userPickableInterval: false, seriesCapacities: Object.freeze({}), maxLookback: 0 }), compute() {} });";

function makeNoopCompile(visitedSourcePaths?: string[]): typeof CompileFn {
    return async (_source, opts): Promise<CompiledScript> => {
        visitedSourcePaths?.push(opts.sourcePath);
        return Object.freeze({
            manifest: NOOP_MANIFEST,
            moduleSource: NOOP_MODULE_SOURCE,
            types: "",
        });
    };
}

function scenarioSourcePath(scenario: Scenario): string {
    if (scenario.additionalSources !== undefined) return "__cross_file__";
    if (scenario.inlineSource !== undefined) return `<inline:${scenario.id}>.chart.ts`;
    if (scenario.scriptPath !== undefined) return scenario.scriptPath;
    throw new Error(`Scenario "${scenario.id}" must define either scriptPath or inlineSource`);
}

const PHASE_4_SCENARIOS: ReadonlyArray<Scenario> = Object.freeze([
    BARSTATE_CONFIRMED_SCENARIO,
    INPUT_INTERVAL_SCENARIO,
    REQUEST_SECURITY_NAN_FALLBACK_SCENARIO,
    MTF_SECURITY_EXPRESSION_EMA_SCENARIO,
    MTF_SECURITY_EXPRESSION_NAN_FALLBACK_SCENARIO,
    STATE_SESSION_HIGH_SCENARIO,
    STATE_TICK_COUNTER_SCENARIO,
    SYMINFO_MINTICK_SCENARIO,
    TIMEFRAME_ISDAILY_SCENARIO,
    UNSUPPORTED_INTERVAL_SCENARIO,
]);
const PHASE_5_ALERT_CONDITION_SCENARIOS: ReadonlyArray<Scenario> = Object.freeze([
    DEFINE_ALERT_CONDITION_FIRES_SCENARIO,
    DEFINE_ALERT_CONDITION_GATED_SCENARIO,
    DEFINE_ALERT_CONDITION_UNKNOWN_SCENARIO,
]);

const PHASE_5_RUNTIME_LOG_SCENARIOS: ReadonlyArray<Scenario> = Object.freeze([
    RUNTIME_LOG_INFO_SCENARIO,
    RUNTIME_LOG_GATED_SCENARIO,
    RUNTIME_LOG_BUDGET_SCENARIO,
    RUNTIME_ERROR_SCENARIO,
]);

const PHASE_5_DRAW_TABLE_SCENARIOS: ReadonlyArray<Scenario> = Object.freeze([
    DRAW_TABLE_HAPPY_SCENARIO,
    DRAW_TABLE_GATED_SCENARIO,
]);

const PHASE_7_DEP_SCENARIOS: ReadonlyArray<Scenario> = Object.freeze([
    DEP_PRIVATE_SINGLE_FILE_SCENARIO,
    DEP_MULTI_EXPORT_SCENARIO,
    DEP_DIAMOND_SCENARIO,
    DEP_ERROR_HALTS_PARENT_SCENARIO,
    DEP_CROSS_FILE_SCENARIO,
]);

describe("runConformanceSuite", () => {
    it("defaults to every bundled scenario without running the full conformance gate", async () => {
        const visitedSourcePaths: string[] = [];
        const report = await runConformanceSuite(makeAdapter(), {
            candles: SINGLE_BAR,
            compile: makeNoopCompile(visitedSourcePaths),
        });
        expect(report.passed + report.failed).toBe(ALL_SCENARIOS.length);
        expect(report.scenarios).toHaveLength(ALL_SCENARIOS.length);
        expect(Object.isFrozen(report.scenarios)).toBe(true);
        expect(report.scenarios.map((scenario) => scenario.id)).toEqual(
            ALL_SCENARIOS.map((scenario) => scenario.id),
        );
        expect(report.scenarios.every((scenario) => Object.isFrozen(scenario.failures))).toBe(true);
        const normalised = visitedSourcePaths.map((path, index) =>
            ALL_SCENARIOS[index].additionalSources === undefined ? path : "__cross_file__",
        );
        expect(normalised).toEqual(ALL_SCENARIOS.map(scenarioSourcePath));
    });

    it("runs every Phase-4 scenario end-to-end", async () => {
        const report = await runConformanceSuite(makeAdapter(), {
            scenarios: PHASE_4_SCENARIOS,
        });
        expect(report.failed).toBe(0);
        expect(report.passed).toBe(PHASE_4_SCENARIOS.length);
        expect(report.failures).toEqual([]);
        expect(report.scenarios.map((scenario) => scenario.status)).toEqual(
            PHASE_4_SCENARIOS.map(() => "pass"),
        );
    }, 60_000);

    it("runs Phase-5 alert-condition scenarios end-to-end", async () => {
        const report = await runConformanceSuite(makeAdapter(), {
            scenarios: PHASE_5_ALERT_CONDITION_SCENARIOS,
            candles: SMALL_BARS,
        });
        expect(report.failed).toBe(0);
        expect(report.passed).toBe(PHASE_5_ALERT_CONDITION_SCENARIOS.length);
        expect(report.failures).toEqual([]);
    }, 60_000);

    it("runs Phase-5 runtime.log/runtime.error scenarios end-to-end", async () => {
        const report = await runConformanceSuite(makeAdapter(), {
            scenarios: PHASE_5_RUNTIME_LOG_SCENARIOS,
            candles: SMALL_BARS,
        });
        expect(report.failed).toBe(0);
        expect(report.passed).toBe(PHASE_5_RUNTIME_LOG_SCENARIOS.length);
        expect(report.failures).toEqual([]);
    }, 60_000);

    it("runs Phase-5 draw.table scenarios end-to-end", async () => {
        const report = await runConformanceSuite(makeAdapter(), {
            scenarios: PHASE_5_DRAW_TABLE_SCENARIOS,
            candles: SMALL_BARS,
        });
        expect(report.failed).toBe(0);
        expect(report.passed).toBe(PHASE_5_DRAW_TABLE_SCENARIOS.length);
        expect(report.failures).toEqual([]);
    }, 60_000);

    it("runs Phase-7 indicator-composition scenarios end-to-end", async () => {
        const report = await runConformanceSuite(makeAdapter(), {
            scenarios: PHASE_7_DEP_SCENARIOS,
            candles: SMALL_BARS,
        });
        expect(report.failed).toBe(0);
        expect(report.passed).toBe(PHASE_7_DEP_SCENARIOS.length);
        expect(report.failures).toEqual([]);
    }, 60_000);

    it("runs the plot-style-overrides scenario end-to-end (mount + live overrides)", async () => {
        // Exercises the mount-time `plotOverrides` arg, the mid-stream
        // `setPlotOverrides` event routing, and the `plot-field` assertion
        // happy path (visible / color / lineWidth + the live-cleared visible).
        const report = await runConformanceSuite(makeAdapter(), {
            scenarios: [PLOT_STYLE_OVERRIDES_SCENARIO],
            candles: SMALL_BARS,
        });
        expect(report.failed).toBe(0);
        expect(report.failures).toEqual([]);
    }, 30_000);

    it("runs the plot-offset-xshift scenario end-to-end (signed xShift + unshifted value)", async () => {
        // Exercises the `plot-field: "xShift"` evaluator arm in both
        // directions (slot 1 → +3, slot 2 → −3), the omitted-field branch
        // (slot 0 carries no `xShift`), and the unshifted-value `plot-hash`.
        const report = await runConformanceSuite(makeAdapter(), {
            scenarios: [PLOT_OFFSET_XSHIFT_SCENARIO],
            candles: SMALL_BARS,
        });
        expect(report.failed).toBe(0);
        expect(report.failures).toEqual([]);
    }, 30_000);

    it("plot-field reports a missing slot ordinal, a missing emission, and a value mismatch", async () => {
        const scenario: Scenario = Object.freeze({
            id: "plot-field-failures",
            title: "plot-field failure branches",
            inlineSource:
                'import { defineIndicator } from "@invinite-org/chartlang-core";\n' +
                'export default defineIndicator({ name: "pf", apiVersion: 1, overlay: true,\n' +
                "  compute({ bar, plot }) {\n" +
                '    plot(bar.close, { title: "c" });\n' +
                '    plot(bar.volume, { title: "v", style: { kind: "histogram", baseline: 0 } });\n' +
                "  } });\n",
            intervalCount: 1,
            candleLimit: 2,
            capabilitiesOverride: {
                plots: new Set([
                    ...capBuilders.line(),
                    ...capBuilders.horizontalLine(),
                    ...capBuilders.histogram(),
                ]),
            },
            assertions: Object.freeze([
                // slot 5 does not exist (only two plot slots in the manifest).
                { kind: "plot-field", slotIndex: 5, bar: 0, field: "visible", expected: false },
                // slot 0 exists but never emits at bar 99.
                { kind: "plot-field", slotIndex: 0, bar: 99, field: "color", expected: "#fff" },
                // slot 0 emits at bar 0 but with no color (mismatch vs "#fff").
                { kind: "plot-field", slotIndex: 0, bar: 0, field: "color", expected: "#fff" },
                // slot 1 is a histogram — its style carries no `lineWidth`, so
                // reading lineWidth yields undefined (matches expected here).
                {
                    kind: "plot-field",
                    slotIndex: 1,
                    bar: 0,
                    field: "lineWidth",
                    expected: undefined,
                },
            ] as ReadonlyArray<ScenarioAssertion>),
        });
        const report = await runConformanceSuite(makeAdapter(), {
            scenarios: [scenario],
            candles: SMALL_BARS.slice(0, 2),
        });
        expect(report.failed).toBe(1);
        const messages = report.failures.map((f) => f.message);
        expect(messages.some((m) => m.includes("no plot slot at that ordinal"))).toBe(true);
        expect(messages.some((m) => m.includes("no plot emission for that slot and bar"))).toBe(
            true,
        );
        expect(messages.some((m) => /\.color: expected #fff, actual/.test(m))).toBe(true);
    }, 30_000);

    it("rejects a scenario that defines additionalSources without inlineSource", async () => {
        const scenario: Scenario = Object.freeze({
            id: "needs-inline",
            title: "additionalSources without inlineSource",
            scriptPath: "examples/scripts/ema-cross.chart.ts",
            additionalSources: Object.freeze({ "./extra.chart.ts": "/* extra */" }),
            intervalCount: 1,
            assertions: Object.freeze([] as ReadonlyArray<ScenarioAssertion>),
        });
        await expect(
            runConformanceSuite(makeAdapter(), {
                scenarios: [scenario],
                candles: SMALL_BARS.slice(0, 1),
            }),
        ).rejects.toThrow(/additionalSources requires inlineSource/);
    });

    it("cleans up the cross-file workspace on compile failure", async () => {
        const scenario: Scenario = Object.freeze({
            id: "cross-file-bad",
            title: "cross-file workspace cleanup",
            inlineSource: "this is not valid TS @@@",
            additionalSources: Object.freeze({
                "./producer.chart.ts": "// noop",
            }),
            intervalCount: 1,
            assertions: Object.freeze([] as ReadonlyArray<ScenarioAssertion>),
        });
        await expect(
            runConformanceSuite(makeAdapter(), {
                scenarios: [scenario],
                candles: SMALL_BARS.slice(0, 1),
            }),
        ).rejects.toThrow();
    });

    it("DEP_CROSS_FILE_SCENARIO ships additionalSources for the cross-file affordance", () => {
        expect(DEP_CROSS_FILE_SCENARIO.additionalSources).toBeDefined();
        expect(Object.keys(DEP_CROSS_FILE_SCENARIO.additionalSources ?? {})).toContain(
            "./base-trend.chart.ts",
        );
        expect(DEP_CROSS_FILE_SCENARIO.inlineSource).toMatch(/import baseTrend from/);
    });

    it("Scenario.additionalSources success path cleans up the workspace after the run", async () => {
        // Synthetic same-file scenario that uses additionalSources to
        // exercise the runner's workspace-dir success cleanup branch.
        // The extra file is a sibling module the consumer never imports.
        const scenario: Scenario = Object.freeze({
            id: "addl-sources-success",
            title: "additionalSources success path",
            inlineSource:
                'import { defineIndicator } from "@invinite-org/chartlang-core";\n' +
                "export default defineIndicator({\n" +
                '    name: "addl",\n' +
                "    apiVersion: 1,\n" +
                "    compute({ bar, plot }) {\n" +
                "        plot(bar.close);\n" +
                "    },\n" +
                "});\n",
            additionalSources: Object.freeze({
                "./sibling.chart.ts": "// unused producer\nexport const noop = 1;\n",
            }),
            intervalCount: 1,
            candleLimit: 2,
            assertions: Object.freeze([
                { kind: "alert-count", count: 0 },
            ] as ReadonlyArray<ScenarioAssertion>),
        });
        const report = await runConformanceSuite(makeAdapter(), {
            scenarios: [scenario],
            candles: SMALL_BARS,
        });
        expect(report.failed).toBe(0);
        expect(report.passed).toBe(1);
    });

    it("extracts the input-interval scenario manifest contract", async () => {
        const { compile } = await import("@invinite-org/chartlang-compiler");
        const result = await compile(INPUT_INTERVAL_SCENARIO.inlineSource ?? "", {
            apiVersion: 1,
            sourcePath: "<inline:input-interval>.chart.ts",
        });
        expect(result.manifest.userPickableInterval).toBe(true);
        expect(result.manifest.inputs.tf).toEqual({ kind: "interval", defaultValue: "1D" });
    });

    it("merges per-scenario capabilities over adapter capabilities", async () => {
        const scenario: Scenario = Object.freeze({
            ...REQUEST_SECURITY_NAN_FALLBACK_SCENARIO,
            assertions: Object.freeze([
                {
                    kind: "diagnostic-code-present",
                    code: "multi-timeframe-not-supported",
                },
                { kind: "diagnostic-code-absent", code: "unsupported-interval" },
            ] as ReadonlyArray<ScenarioAssertion>),
        });
        const adapter: Adapter = {
            ...makeAdapter(),
            capabilities: Object.freeze({
                ...TEST_CAPABILITIES,
                intervals: [],
                multiTimeframe: true,
            }),
        };
        const report = await runConformanceSuite(adapter, {
            scenarios: [scenario],
            candles: SMALL_BARS,
        });
        expect(report.failed).toBe(0);
    });

    it("reports plot-hash failures with expected and actual hashes in the message", async () => {
        const adapter = makeAdapter();
        const tamperedScenario: Scenario = Object.freeze({
            ...EMA_CROSS_SCENARIO,
            assertions: Object.freeze([
                {
                    kind: "plot-hash",
                    slotId: "examples/scripts/ema-cross.chart.ts:14:9#0",
                    sha256: "deadbeef".repeat(8),
                },
            ] as ReadonlyArray<ScenarioAssertion>),
        });
        const report = await runConformanceSuite(adapter, {
            scenarios: [tamperedScenario],
            candles: SMALL_BARS,
        });
        expect(report.failed).toBe(1);
        expect(report.passed).toBe(0);
        expect(report.failures).toHaveLength(1);
        expect(report.scenarios).toEqual([
            {
                id: EMA_CROSS_SCENARIO.id,
                title: EMA_CROSS_SCENARIO.title,
                status: "fail",
                failures: report.failures,
            },
        ]);
        const [failure] = report.failures;
        expect(failure.assertionKind).toBe("plot-hash");
        expect(failure.message).toContain("expected deadbeef");
        expect(failure.message).toContain("actual ");
    });

    it("reports alert-count mismatches", async () => {
        const adapter = makeAdapter();
        const scenario: Scenario = Object.freeze({
            ...EMA_CROSS_SCENARIO,
            assertions: Object.freeze([
                { kind: "alert-count", count: 99_999 },
            ] as ReadonlyArray<ScenarioAssertion>),
        });
        const report = await runConformanceSuite(adapter, {
            scenarios: [scenario],
            candles: SMALL_BARS,
        });
        const [failure] = report.failures;
        expect(failure.assertionKind).toBe("alert-count");
        expect(failure.message).toContain("expected 99999");
    });

    it("reports alert-message-contains shortfalls", async () => {
        const adapter = makeAdapter();
        const scenario: Scenario = Object.freeze({
            ...EMA_CROSS_SCENARIO,
            assertions: Object.freeze([
                {
                    kind: "alert-message-contains",
                    pattern: "definitely-not-present",
                    min: 1,
                },
            ] as ReadonlyArray<ScenarioAssertion>),
        });
        const report = await runConformanceSuite(adapter, {
            scenarios: [scenario],
            candles: SMALL_BARS,
        });
        const [failure] = report.failures;
        expect(failure.assertionKind).toBe("alert-message-contains");
        expect(failure.message).toContain("definitely-not-present");
    });

    it("passes alert-message-contains when enough matching alerts emit", async () => {
        const { compile } = await import("@invinite-org/chartlang-compiler");
        const SCRIPT = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "alert contains pass",
    apiVersion: 1,
    compute({ alert }) {
        alert("needle matched");
    },
});
`;
        const scenario: Scenario = Object.freeze({
            id: "alert-contains-pass",
            title: "Synthetic alert-message-contains pass",
            scriptPath: "examples/scripts/ema-cross.chart.ts",
            intervalCount: 1,
            assertions: Object.freeze([
                { kind: "alert-message-contains", pattern: "needle", min: 1 },
            ] as ReadonlyArray<ScenarioAssertion>),
        });
        const report = await runConformanceSuite(makeAdapter(), {
            scenarios: [scenario],
            candles: SMALL_BARS.slice(0, 1),
            compile: async (_src, opts) => compile(SCRIPT, opts),
        });
        expect(report.failed).toBe(0);
    });

    it("reports diagnostic-code-present misses + diagnostic-code-absent hits", async () => {
        const adapter = makeAdapter();
        const scenario: Scenario = Object.freeze({
            ...EMA_CROSS_SCENARIO,
            assertions: Object.freeze([
                { kind: "diagnostic-code-present", code: "malformed-emission" },
            ] as ReadonlyArray<ScenarioAssertion>),
        });
        const report = await runConformanceSuite(adapter, {
            scenarios: [scenario],
            candles: SMALL_BARS,
        });
        const [failure] = report.failures;
        expect(failure.assertionKind).toBe("diagnostic-code-present");
        expect(failure.message).toContain("malformed-emission");
    });

    it("accepts an injected compile function (seam)", async () => {
        const adapter = makeAdapter();
        let invocations = 0;
        const result = await runConformanceSuite(adapter, {
            scenarios: [EMA_CROSS_SCENARIO],
            candles: SMALL_BARS,
            compile: async (source, opts) => {
                invocations += 1;
                const { compile } = await import("@invinite-org/chartlang-compiler");
                return compile(source, opts);
            },
        });
        expect(invocations).toBe(1);
        // The small-bar slice changes the hashes — assertion should fail.
        expect(result.failed).toBe(1);
    });

    it("plot-hash without slotId hashes ALL plots together", async () => {
        const adapter = makeAdapter();
        // Pre-compute the SHA-256 of an empty-bar run's plot-tuple stream.
        const empty: ReadonlyArray<Bar> = [];
        const tuples = JSON.stringify([]);
        const hash = createHash("sha256").update(tuples).digest("hex");
        const scenario: Scenario = Object.freeze({
            ...EMA_CROSS_SCENARIO,
            assertions: Object.freeze([
                { kind: "plot-hash", sha256: hash },
            ] as ReadonlyArray<ScenarioAssertion>),
        });
        const report = await runConformanceSuite(adapter, {
            scenarios: [scenario],
            candles: empty,
        });
        expect(report.failed).toBe(0);
    });

    it("diagnostic-code-absent passes when the code is never emitted", async () => {
        const adapter = makeAdapter();
        const scenario: Scenario = Object.freeze({
            ...EMA_CROSS_SCENARIO,
            assertions: Object.freeze([
                { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
            ] as ReadonlyArray<ScenarioAssertion>),
        });
        const report = await runConformanceSuite(adapter, {
            scenarios: [scenario],
            candles: SMALL_BARS,
        });
        expect(report.failed).toBe(0);
    });

    it("diagnostic-code-absent fails when the code IS emitted", async () => {
        const { compile } = await import("@invinite-org/chartlang-compiler");
        const SCRIPT = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "pane",
    apiVersion: 1,
    compute({ bar, plot }) {
        plot(bar.close, { pane: "new" });
    },
});
`;
        const scenario: Scenario = Object.freeze({
            id: "pane-diag-absent",
            title: "Synthetic — assert unsupported-pane is absent (should fail)",
            scriptPath: "examples/scripts/ema-cross.chart.ts",
            intervalCount: 1,
            assertions: Object.freeze([
                { kind: "diagnostic-code-absent", code: "unsupported-pane" },
            ] as ReadonlyArray<ScenarioAssertion>),
        });
        const report = await runConformanceSuite(makeAdapter(), {
            scenarios: [scenario],
            candles: SMALL_BARS.slice(0, 5),
            compile: async (_src, opts) => compile(SCRIPT, opts),
        });
        expect(report.failed).toBe(1);
        const [failure] = report.failures;
        expect(failure.assertionKind).toBe("diagnostic-code-absent");
        expect(failure.message).toContain("unsupported-pane");
    });

    it("plot-hash without slotId reports actual hash on failure", async () => {
        const adapter = makeAdapter();
        const scenario: Scenario = Object.freeze({
            ...EMA_CROSS_SCENARIO,
            assertions: Object.freeze([
                { kind: "plot-hash", sha256: "deadbeef".repeat(8) },
            ] as ReadonlyArray<ScenarioAssertion>),
        });
        const report = await runConformanceSuite(adapter, {
            scenarios: [scenario],
            candles: SMALL_BARS.slice(0, 5),
        });
        expect(report.failed).toBe(1);
        const [failure] = report.failures;
        expect(failure.message).toContain("[<all>]");
    });

    it("resolves absolute scriptPath without re-rooting under repo", async () => {
        const { fileURLToPath } = await import("node:url");
        const { resolve: resolvePath } = await import("node:path");
        const absolutePath = resolvePath(
            fileURLToPath(new URL("../../../examples/scripts/ema-cross.chart.ts", import.meta.url)),
        );
        const scenario: Scenario = Object.freeze({
            id: "abs-path",
            title: "absolute scriptPath",
            scriptPath: absolutePath,
            intervalCount: 1,
            assertions: Object.freeze([
                { kind: "alert-count", count: 0 },
            ] as ReadonlyArray<ScenarioAssertion>),
        });
        const report = await runConformanceSuite(makeAdapter(), {
            scenarios: [scenario],
            candles: SMALL_BARS.slice(0, 5),
        });
        // Empty alert count over 5 bars is correct.
        expect(report.failed).toBe(0);
    });

    it("loads default golden bars when called twice (cache hit)", async () => {
        const first = await runConformanceSuite(makeAdapter(), {
            scenarios: [EMA_CROSS_SCENARIO],
            compile: makeNoopCompile(),
        });
        const second = await runConformanceSuite(makeAdapter(), {
            scenarios: [EMA_CROSS_SCENARIO],
            compile: makeNoopCompile(),
        });
        expect(first.passed + first.failed).toBe(1);
        expect(second.passed + second.failed).toBe(1);
    });

    it("inline-source happy path — runs end-to-end without reading scriptPath", async () => {
        const INLINE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "inline-demo",
    apiVersion: 1,
    compute({ bar, plot }) {
        plot(bar.close);
    },
});
`;
        const scenario: Scenario = Object.freeze({
            id: "inline-happy",
            title: "inline-source happy path",
            inlineSource: INLINE,
            intervalCount: 1,
            assertions: Object.freeze([
                { kind: "alert-count", count: 0 },
                { kind: "diagnostic-code-absent", code: "unsupported-plot-kind" },
            ] as ReadonlyArray<ScenarioAssertion>),
        });
        const report = await runConformanceSuite(makeAdapter(), {
            scenarios: [scenario],
            candles: SMALL_BARS.slice(0, 10),
        });
        expect(report.failed).toBe(0);
        expect(report.passed).toBe(1);
    });

    it("inline-source compile error — the runner surfaces it via the compile seam", async () => {
        const scenario: Scenario = Object.freeze({
            id: "inline-bad",
            title: "inline-source compile error",
            inlineSource: "this is not valid TS @@@",
            intervalCount: 1,
            assertions: Object.freeze([] as ReadonlyArray<ScenarioAssertion>),
        });
        await expect(
            runConformanceSuite(makeAdapter(), {
                scenarios: [scenario],
                candles: SMALL_BARS.slice(0, 5),
            }),
        ).rejects.toThrow();
    });

    it("rejects a scenario that defines both scriptPath and inlineSource", async () => {
        const scenario: Scenario = Object.freeze({
            id: "both",
            title: "both fields",
            scriptPath: "examples/scripts/ema-cross.chart.ts",
            inlineSource: "// noop",
            intervalCount: 1,
            assertions: Object.freeze([] as ReadonlyArray<ScenarioAssertion>),
        });
        await expect(
            runConformanceSuite(makeAdapter(), {
                scenarios: [scenario],
                candles: SMALL_BARS.slice(0, 5),
            }),
        ).rejects.toThrow(/cannot define both/);
    });

    it("rejects a scenario that defines neither scriptPath nor inlineSource", async () => {
        const scenario: Scenario = Object.freeze({
            id: "neither",
            title: "neither field",
            intervalCount: 1,
            assertions: Object.freeze([] as ReadonlyArray<ScenarioAssertion>),
        });
        await expect(
            runConformanceSuite(makeAdapter(), {
                scenarios: [scenario],
                candles: SMALL_BARS.slice(0, 5),
            }),
        ).rejects.toThrow(/must define either/);
    });

    it("drawing-hash passes when no drawings are emitted (empty-array hash)", async () => {
        // Phase-3 Task 3 ships the assertion arm; per-kind `draw.*`
        // runtime impls land in Tasks 5–18. Until then, scripts can't
        // actually emit drawings — but the assertion arm must still
        // correctly hash the empty-drawings array. The pinned SHA-256
        // for `JSON.stringify([])` is computed once and re-used.
        const emptyHash = createHash("sha256").update(JSON.stringify([])).digest("hex");
        const INLINE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "no-draw",
    apiVersion: 1,
    compute({ bar, plot }) {
        plot(bar.close);
    },
});
`;
        const scenario: Scenario = Object.freeze({
            id: "drawing-hash-empty",
            title: "drawing-hash matches the empty-array hash when nothing was drawn",
            inlineSource: INLINE,
            intervalCount: 1,
            assertions: Object.freeze([
                { kind: "drawing-hash", sha256: emptyHash },
            ] as ReadonlyArray<ScenarioAssertion>),
        });
        const report = await runConformanceSuite(makeAdapter(), {
            scenarios: [scenario],
            candles: SMALL_BARS.slice(0, 3),
        });
        expect(report.failed).toBe(0);
        expect(report.passed).toBe(1);
    });

    it("drawing-hash failure message carries the handleId label + actual hash + emission count", async () => {
        const INLINE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "no-draw-2",
    apiVersion: 1,
    compute({ bar, plot }) {
        plot(bar.close);
    },
});
`;
        const scenario: Scenario = Object.freeze({
            id: "drawing-hash-fail",
            title: "drawing-hash failure format",
            inlineSource: INLINE,
            intervalCount: 1,
            assertions: Object.freeze([
                {
                    kind: "drawing-hash",
                    handleId: "demo#0",
                    sha256: "deadbeef".repeat(8),
                },
            ] as ReadonlyArray<ScenarioAssertion>),
        });
        const report = await runConformanceSuite(makeAdapter(), {
            scenarios: [scenario],
            candles: SMALL_BARS.slice(0, 3),
        });
        expect(report.failed).toBe(1);
        const [f] = report.failures;
        expect(f.assertionKind).toBe("drawing-hash");
        expect(f.message).toContain("drawing-hash[demo#0]");
        expect(f.message).toContain("expected deadbeef");
        expect(f.message).toContain("actual ");
        expect(f.message).toContain("0 emissions");
    });

    it("drawing-hash pins a non-empty drawings sequence emitted via pushDrawing directly", async () => {
        // The script-facing `draw.*` namespace is still a throwing
        // stub until per-kind tasks 5–18 land their runtime impls. To
        // exercise the non-empty drawing-hash assertion path, we wire
        // an injected compile that produces a bundle whose `compute`
        // calls the runtime's `pushDrawing` directly against the
        // ambient context — the same low-level API every per-kind
        // task will route through.
        const adapter: Adapter = {
            id: "draw-direct",
            name: "Direct drawing-emission adapter",
            capabilities: {
                ...TEST_CAPABILITIES,
                drawings: capBuilders.allLineDrawings(),
                maxDrawingsPerScript: {
                    lines: 1000,
                    labels: 0,
                    boxes: 0,
                    polylines: 0,
                    other: 0,
                },
            },
            candles(): AsyncIterable<CandleEvent> {
                return {
                    async *[Symbol.asyncIterator](): AsyncIterator<CandleEvent> {
                        /* empty */
                    },
                };
            },
            onEmissions(): void {},
            dispose(): void {},
        };

        const moduleSource = `
import { ACTIVE_RUNTIME_CONTEXT, pushDrawing } from "@invinite-org/chartlang-runtime";

export default {
    manifest: {
        apiVersion: 1,
        kind: "indicator",
        name: "drawing-hash-direct",
        inputs: {},
        capabilities: ["indicators", "drawings"],
        requestedIntervals: [],
        userPickableInterval: false,
        seriesCapacities: {},
        maxLookback: 0,
    },
    compute({ bar }) {
        const ctx = ACTIVE_RUNTIME_CONTEXT.current;
        if (ctx === null) return;
        pushDrawing(ctx, {
            kind: "drawing",
            handleId: "demo#0",
            drawingKind: "line",
            op: "create",
            state: {
                kind: "line",
                anchors: [
                    { time: bar.time, price: bar.close.current },
                    { time: bar.time + 1, price: bar.close.current + 1 },
                ],
                style: {},
            },
            bar: 0,
            time: bar.time,
        });
    },
};
`;
        const probe: Scenario = Object.freeze({
            id: "drawing-hash-probe",
            title: "drawing-hash probe — compute the actual hash",
            inlineSource: "// placeholder",
            intervalCount: 1,
            assertions: Object.freeze([
                { kind: "drawing-hash", sha256: "deadbeef".repeat(8) },
            ] as ReadonlyArray<ScenarioAssertion>),
        });
        const injectedCompile: typeof import("@invinite-org/chartlang-compiler").compile =
            async () =>
                Object.freeze({
                    manifest: {
                        apiVersion: 1 as const,
                        kind: "indicator" as const,
                        name: "drawing-hash-direct",
                        inputs: {},
                        capabilities: ["indicators", "drawings"],
                        requestedIntervals: [],
                        userPickableInterval: false,
                        seriesCapacities: {},
                        maxLookback: 0,
                    },
                    moduleSource,
                    types: "",
                });
        const probeReport = await runConformanceSuite(adapter, {
            scenarios: [probe],
            candles: SMALL_BARS.slice(0, 1),
            compile: injectedCompile,
        });
        expect(probeReport.failed).toBe(1);
        const probeFailure = probeReport.failures[0];
        expect(probeFailure.assertionKind).toBe("drawing-hash");
        const actualMatch = probeFailure.message.match(/actual ([0-9a-f]{64})/);
        if (actualMatch === null) throw new Error("failed to parse actual hash");
        const actual = actualMatch[1];
        expect(probeFailure.message).toContain("1 emissions");

        const pinned: Scenario = Object.freeze({
            id: "drawing-hash-pinned",
            title: "drawing-hash pinned — should pass",
            inlineSource: "// placeholder",
            intervalCount: 1,
            assertions: Object.freeze([
                { kind: "drawing-hash", handleId: "demo#0", sha256: actual },
            ] as ReadonlyArray<ScenarioAssertion>),
        });
        const report = await runConformanceSuite(adapter, {
            scenarios: [pinned],
            candles: SMALL_BARS.slice(0, 1),
            compile: injectedCompile,
        });
        expect(report.failed).toBe(0);
        expect(report.passed).toBe(1);
    });

    it("drawing-hash without handleId labels the failure with `<all>`", async () => {
        const INLINE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "no-draw-3",
    apiVersion: 1,
    compute({ bar, plot }) {
        plot(bar.close);
    },
});
`;
        const scenario: Scenario = Object.freeze({
            id: "drawing-hash-all-label",
            title: "drawing-hash without handleId",
            inlineSource: INLINE,
            intervalCount: 1,
            assertions: Object.freeze([
                { kind: "drawing-hash", sha256: "deadbeef".repeat(8) },
            ] as ReadonlyArray<ScenarioAssertion>),
        });
        const report = await runConformanceSuite(makeAdapter(), {
            scenarios: [scenario],
            candles: SMALL_BARS.slice(0, 3),
        });
        expect(report.failed).toBe(1);
        const [f] = report.failures;
        expect(f.message).toContain("[<all>]");
    });

    it("diagnostic-code-present succeeds when the diagnostic IS emitted", async () => {
        // Build a synthetic scenario from a script that explicitly
        // requests a non-overlay pane — the runtime's `paneResolver`
        // pushes a `unsupported-pane` diagnostic for any non-overlay
        // request against a `subPanes: 0` adapter.
        const { compile } = await import("@invinite-org/chartlang-compiler");
        const SCRIPT = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "pane",
    apiVersion: 1,
    compute({ bar, plot }) {
        plot(bar.close, { pane: "new" });
    },
});
`;
        const injectedCompile: typeof compile = async (_src, opts) => compile(SCRIPT, opts);

        const scenario: Scenario = Object.freeze({
            id: "pane-diag",
            title: "Synthetic scenario asserting unsupported-pane is present",
            scriptPath: "examples/scripts/ema-cross.chart.ts",
            intervalCount: 1,
            assertions: Object.freeze([
                { kind: "diagnostic-code-present", code: "unsupported-pane" },
            ] as ReadonlyArray<ScenarioAssertion>),
        });
        const report = await runConformanceSuite(makeAdapter(), {
            scenarios: [scenario],
            candles: SMALL_BARS.slice(0, 10),
            compile: injectedCompile,
        });
        expect(report.failed).toBe(0);
        expect(report.passed).toBe(1);
    });

    it("all-plots-on-pane passes when every plot lands on the asserted pane", async () => {
        // `overlay: false` routes every plot to `script:<name>`; the
        // adapter must advertise sub-panes or the pane folds to overlay.
        const subPaneAdapter: Adapter = {
            ...makeAdapter(),
            capabilities: { ...TEST_CAPABILITIES, subPanes: Number.MAX_SAFE_INTEGER },
        };
        const report = await runConformanceSuite(subPaneAdapter, {
            scenarios: [RSI_SUBPANE_ROUTING_SCENARIO],
            candles: SMALL_BARS,
        });
        expect(report.failures).toEqual([]);
        expect(report.failed).toBe(0);
        expect(report.passed).toBe(1);
    }, 30_000);

    it("all-plots-on-pane fails with expected + actual when a plot is off-pane", async () => {
        // An `overlay: true` script emits on `"overlay"`, so asserting a
        // non-overlay pane key surfaces the divergence with the first
        // divergent slotId + actual pane.
        const scenario: Scenario = Object.freeze({
            id: "all-plots-on-pane-fail",
            title: "all-plots-on-pane mismatch",
            inlineSource:
                'import { defineIndicator } from "@invinite-org/chartlang-core";\n' +
                'export default defineIndicator({ name: "op", apiVersion: 1, overlay: true,\n' +
                '  compute({ bar, plot }) { plot(bar.close, { title: "c" }); } });\n',
            intervalCount: 1,
            candleLimit: 2,
            assertions: Object.freeze([
                { kind: "all-plots-on-pane", pane: "script:nope" },
            ] as ReadonlyArray<ScenarioAssertion>),
        });
        const report = await runConformanceSuite(makeAdapter(), {
            scenarios: [scenario],
            candles: SMALL_BARS.slice(0, 2),
        });
        expect(report.failed).toBe(1);
        const [failure] = report.failures;
        expect(failure.assertionKind).toBe("all-plots-on-pane");
        expect(failure.message).toContain('expected every plot.pane === "script:nope"');
        expect(failure.message).toContain('pane="overlay"');
        expect(failure.message).toContain("slotId=");
    }, 30_000);

    it("all-plots-on-pane fails when the script emits zero plots (no vacuous pass)", async () => {
        // A script that never calls plot() — the assertion would otherwise
        // vacuously pass because `wrong.length === 0`. The empty-plots guard
        // surfaces this as a real failure so a future regression that
        // silences emissions does not slip past the contract.
        const scenario: Scenario = Object.freeze({
            id: "all-plots-on-pane-empty",
            title: "all-plots-on-pane empty emissions",
            inlineSource:
                'import { defineIndicator } from "@invinite-org/chartlang-core";\n' +
                'export default defineIndicator({ name: "op", apiVersion: 1,\n' +
                "  compute() { /* deliberately emit nothing */ } });\n",
            intervalCount: 1,
            candleLimit: 2,
            assertions: Object.freeze([
                { kind: "all-plots-on-pane", pane: "script:op" },
            ] as ReadonlyArray<ScenarioAssertion>),
        });
        const report = await runConformanceSuite(makeAdapter(), {
            scenarios: [scenario],
            candles: SMALL_BARS.slice(0, 2),
        });
        expect(report.failed).toBe(1);
        const [failure] = report.failures;
        expect(failure.assertionKind).toBe("all-plots-on-pane");
        expect(failure.message).toContain("no plots were emitted");
    }, 30_000);
});

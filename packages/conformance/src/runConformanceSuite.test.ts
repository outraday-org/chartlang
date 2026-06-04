// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { createHash } from "node:crypto";

import type { Adapter, CandleEvent, Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { capabilities as capBuilders } from "@invinite-org/chartlang-adapter-kit";
import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { generateGoldenBars } from "./fixtures/generateGoldenBars";
import { PHASE_1_SCENARIOS, EMA_CROSS_SCENARIO } from "./scenarios";
import { runConformanceSuite, type Scenario, type ScenarioAssertion } from "./runConformanceSuite";

const TEST_CAPABILITIES: Capabilities = {
    plots: capBuilders.union(capBuilders.line(), capBuilders.horizontalLine()),
    drawings: new Set(),
    alerts: capBuilders.alerts("log", "toast"),
    alertConditions: false,
    logs: false,
    inputs: new Set(),
    intervals: [],
    multiTimeframe: false,
    subPanes: 0,
    symInfoFields: new Set(),
    maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
    maxLookback: 1000,
    maxTickHz: 30,
};

function makeAdapter(): Adapter {
    return {
        id: "test",
        name: "Test adapter",
        capabilities: TEST_CAPABILITIES,
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

describe("runConformanceSuite", () => {
    it("returns passed=3/failed=0 for the bundled Phase-1 scenarios against canvas2d caps", async () => {
        const adapter = makeAdapter();
        const report = await runConformanceSuite(adapter);
        expect(report.failed).toBe(0);
        expect(report.passed).toBe(PHASE_1_SCENARIOS.length);
        expect(report.failures).toEqual([]);
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

    it("loads bundled scenarios + default golden bars when called twice (cache hit)", async () => {
        const adapter = makeAdapter();
        const first = await runConformanceSuite(adapter);
        const second = await runConformanceSuite(adapter);
        expect(first.failed).toBe(0);
        expect(second.failed).toBe(0);
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
});

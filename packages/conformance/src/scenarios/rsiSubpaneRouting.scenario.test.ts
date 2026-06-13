// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    Adapter,
    CandleEvent,
    Capabilities,
    InputKind,
} from "@invinite-org/chartlang-adapter-kit";
import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import { describe, expect, it } from "vitest";

import { runConformanceSuite } from "../runConformanceSuite.js";
import { RSI_SUBPANE_ROUTING_SCENARIO } from "./rsiSubpaneRouting.scenario.js";

// The scenario asserts every emission lands on the `script:` subpane key
// and that no `unsupported-pane` diagnostic fires — both only hold when
// the adapter advertises sub-panes, so the cap bag declares the unlimited
// sentinel (mirroring the canvas2d reference adapter).
const TEST_CAPABILITIES: Capabilities = {
    plots: capabilities.union(capabilities.line(), capabilities.horizontalLine()),
    drawings: new Set(),
    alerts: new Set(),
    alertConditions: false,
    logs: false,
    inputs: new Set<InputKind>(["interval", "time"]),
    intervals: [{ value: "1m", label: "1 minute", group: "minute" }],
    multiTimeframe: false,
    subPanes: Number.MAX_SAFE_INTEGER,
    symInfoFields: new Set(["ticker", "type", "mintick"]),
    maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
    maxLookback: 1000,
    maxTickHz: 30,
};

function adapter(): Adapter {
    return {
        id: "test",
        name: "RSI subpane routing test adapter",
        capabilities: TEST_CAPABILITIES,
        symInfo: {
            ticker: "TEST",
            type: "equity",
            mintick: 0.01,
        },
        resolveInputs(): Readonly<Record<string, unknown>> {
            return {};
        },
        // `runConformanceSuite` reads `adapter.capabilities` only — it
        // owns candle iteration via the `RunConformanceSuiteOpts.candles`
        // option (default: golden bars, clipped to `scenario.candleLimit`).
        // This stub satisfies the `Adapter` shape and is never observed.
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

describe("RSI_SUBPANE_ROUTING_SCENARIO", () => {
    it("routes every plot + hline to the script-level subpane with no unsupported-pane", async () => {
        const report = await runConformanceSuite(adapter(), {
            scenarios: [RSI_SUBPANE_ROUTING_SCENARIO],
        });
        expect(report.failures).toEqual([]);
        expect(report.failed).toBe(0);
        expect(report.passed).toBe(1);
    }, 30_000);
});

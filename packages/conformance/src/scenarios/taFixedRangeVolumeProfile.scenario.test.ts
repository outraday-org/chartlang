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
import { TA_FIXED_RANGE_VOLUME_PROFILE_SCENARIO } from "./taFixedRangeVolumeProfile.scenario.js";
import { TA_FIXED_RANGE_VOLUME_PROFILE_INVERTED_SCENARIO } from "./taFixedRangeVolumeProfileInverted.scenario.js";

const TEST_CAPABILITIES: Capabilities = {
    plots: capabilities.allPhase5Plots(),
    drawings: new Set(),
    alerts: new Set(),
    alertConditions: false,
    logs: false,
    inputs: new Set<InputKind>(["interval", "time"]),
    intervals: [{ value: "1m", label: "1 minute", group: "minute" }],
    multiTimeframe: false,
    subPanes: 0,
    symInfoFields: new Set(["ticker", "type", "mintick"]),
    maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
    maxLookback: 1000,
    maxTickHz: 30,
};

function adapter(): Adapter {
    return {
        id: "test",
        name: "Fixed Range VP test adapter",
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

describe("TA_FIXED_RANGE_VOLUME_PROFILE_SCENARIO", () => {
    it("passes happy and inverted fixed-range scenarios", async () => {
        const report = await runConformanceSuite(adapter(), {
            scenarios: [
                TA_FIXED_RANGE_VOLUME_PROFILE_SCENARIO,
                TA_FIXED_RANGE_VOLUME_PROFILE_INVERTED_SCENARIO,
            ],
        });
        expect(report.failures).toEqual([]);
        expect(report.failed).toBe(0);
        expect(report.passed).toBe(2);
    }, 30_000);
});

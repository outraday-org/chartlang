// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Adapter, CandleEvent, Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import { describe, expect, it } from "vitest";

import { runConformanceSuite } from "../runConformanceSuite.js";
import { TA_SESSION_VOLUME_PROFILE_SCENARIO } from "./taSessionVolumeProfile.scenario.js";
import { TA_SESSION_VOLUME_PROFILE_NO_SESSION_SCENARIO } from "./taSessionVolumeProfileNoSession.scenario.js";

const TEST_CAPABILITIES: Capabilities = {
    plots: capabilities.allPhase5Plots(),
    drawings: new Set(),
    alerts: new Set(),
    alertConditions: false,
    logs: false,
    inputs: new Set(),
    intervals: [{ value: "1m", label: "1 minute", group: "minute" }],
    multiTimeframe: false,
    subPanes: 0,
    symInfoFields: new Set(["ticker", "type", "mintick", "session"]),
    maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
    maxLookback: 1000,
    maxTickHz: 30,
};

function adapter(): Adapter {
    return {
        id: "test",
        name: "Session VP test adapter",
        capabilities: TEST_CAPABILITIES,
        symInfo: {
            ticker: "TEST",
            type: "equity",
            mintick: 0.01,
            session: "0930-1600",
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

describe("TA_SESSION_VOLUME_PROFILE_SCENARIO", () => {
    it("passes both session metadata and fallback scenarios", async () => {
        const report = await runConformanceSuite(adapter(), {
            scenarios: [
                TA_SESSION_VOLUME_PROFILE_SCENARIO,
                TA_SESSION_VOLUME_PROFILE_NO_SESSION_SCENARIO,
            ],
        });
        expect(report.failures).toEqual([]);
        expect(report.failed).toBe(0);
        expect(report.passed).toBe(2);
    }, 30_000);
});

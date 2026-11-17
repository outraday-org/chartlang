// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import * as publicSurface from "./index.js";

describe("public surface", () => {
    it("exports the runtime values", () => {
        expect(Object.keys(publicSurface).sort()).toEqual([
            "AlertRunnerError",
            "DEFAULT_ALERT_RUNNER_LIMITS",
            "DEFAULT_ALERT_RUNNER_MAX_LOOKBACK",
            "DEFAULT_MIN_WARM_UP_BARS",
            "alertRunnerCapabilities",
            "createAlertRunner",
            "createBarAggregator",
            "createFrequencyGate",
            "createSeriesRunner",
            "intervalMs",
            "requiredHistoryFor",
            "snapshotFidelityOf",
            "validateAlertInputs",
        ]);
        expect(publicSurface.DEFAULT_ALERT_RUNNER_LIMITS).toEqual({
            maxHeapBytes: 32 * 1024 * 1024,
            maxStepMs: 250,
            maxSteps: 5_000_000,
            maxLoadTimeoutMs: 30_000,
        });
        expect(Object.isFrozen(publicSurface.DEFAULT_ALERT_RUNNER_LIMITS)).toBe(true);
    });
});

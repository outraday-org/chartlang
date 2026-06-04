// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { PassThroughAdapter } from "./passThroughAdapter";
import { capabilities } from "../capabilities";
import { mockCandleSource } from "../mocks";
import type { Capabilities, RunnerEmissions } from "../types";

const caps: Capabilities = {
    plots: capabilities.line(),
    drawings: new Set(),
    alerts: new Set(),
    alertConditions: false,
    logs: false,
    inputs: new Set(),
    intervals: [],
    multiTimeframe: false,
    subPanes: 0,
    symInfoFields: new Set(),
    maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
    maxLookback: 5000,
    maxTickHz: 10,
};

const emptyEmissions: RunnerEmissions = {
    plots: [],
    drawings: [],
    alerts: [],
    diagnostics: [],
    fromBar: 0,
    toBar: 0,
};

describe("PassThroughAdapter", () => {
    it("exposes the supplied id, name, and capabilities", () => {
        const a = new PassThroughAdapter("p", "Pass", caps, mockCandleSource([]));
        expect(a.id).toBe("p");
        expect(a.name).toBe("Pass");
        expect(a.capabilities).toBe(caps);
    });

    it("candles() forwards the supplied source by reference", () => {
        const source = mockCandleSource([]);
        const a = new PassThroughAdapter("p", "Pass", caps, source);
        expect(a.candles()).toBe(source);
    });

    it("onEmissions is a no-op", () => {
        const a = new PassThroughAdapter("p", "Pass", caps, mockCandleSource([]));
        expect(() => a.onEmissions(emptyEmissions)).not.toThrow();
    });

    it("dispose is a no-op", () => {
        const a = new PassThroughAdapter("p", "Pass", caps, mockCandleSource([]));
        expect(() => a.dispose()).not.toThrow();
    });
});

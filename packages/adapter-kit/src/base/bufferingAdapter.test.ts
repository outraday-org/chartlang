// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { BufferingAdapter } from "./bufferingAdapter.js";
import { capabilities } from "../capabilities/index.js";
import { mockCandleSource } from "../mocks/index.js";
import type { Capabilities, RunnerEmissions } from "../types.js";

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

function batch(fromBar: number, toBar: number): RunnerEmissions {
    return {
        plots: [],
        drawings: [],
        alerts: [],
        alertConditions: [],
        logs: [],
        diagnostics: [],
        fromBar,
        toBar,
    };
}

describe("BufferingAdapter", () => {
    it("exposes the supplied id, name, and capabilities", () => {
        const a = new BufferingAdapter("b", "Buf", caps, mockCandleSource([]));
        expect(a.id).toBe("b");
        expect(a.name).toBe("Buf");
        expect(a.capabilities).toBe(caps);
    });

    it("candles() forwards the supplied source by reference", () => {
        const source = mockCandleSource([]);
        const a = new BufferingAdapter("b", "Buf", caps, source);
        expect(a.candles()).toBe(source);
    });

    it("accumulates emissions across multiple onEmissions calls", () => {
        const a = new BufferingAdapter("b", "Buf", caps, mockCandleSource([]));
        a.onEmissions(batch(0, 9));
        a.onEmissions(batch(10, 19));
        const drained = a.drain();
        expect(drained).toHaveLength(2);
        expect(drained[0]?.fromBar).toBe(0);
        expect(drained[1]?.fromBar).toBe(10);
    });

    it("drain() resets the buffer so a subsequent drain returns []", () => {
        const a = new BufferingAdapter("b", "Buf", caps, mockCandleSource([]));
        a.onEmissions(batch(0, 9));
        a.drain();
        expect(a.drain()).toEqual([]);
    });

    it("dispose() clears the buffer", () => {
        const a = new BufferingAdapter("b", "Buf", caps, mockCandleSource([]));
        a.onEmissions(batch(0, 9));
        a.dispose();
        expect(a.drain()).toEqual([]);
    });
});

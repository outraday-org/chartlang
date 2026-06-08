// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";

import {
    ACTIVE_RUNTIME_CONTEXT,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../runtimeContext";
import { createStreamState } from "../streamState";
import { inMemoryStateStore } from "../stateStore";
import { hline } from "./hline";

function makeCaps(): Capabilities {
    return {
        plots: capabilities.allLines(),
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
}

function makeCtx(barIndex: number): {
    ctx: RuntimeContext;
    emissions: MutableRunnerEmissions;
} {
    const emissions: MutableRunnerEmissions = {
        plots: [],
        drawings: [],
        alerts: [],
        diagnostics: [],
        fromBar: 0,
        toBar: 0,
    };
    const stream = createStreamState({ interval: "", capacity: 4, symbol: "" });
    stream.bar.time = 1_700_000_000_000;
    const ctx: RuntimeContext = {
        stream,
        stateStore: inMemoryStateStore(),
        capabilities: makeCaps(),
        emissions,
        barIndex: () => barIndex,
        isTick: false,
        drawingSlots: new Map(),
        drawingSubIdCounters: new Map(),
        drawingBucketCounters: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        scriptMaxDrawings: null,
        stateSlots: new Map(),
    };
    return { ctx, emissions };
}

afterEach(() => {
    ACTIVE_RUNTIME_CONTEXT.current = null;
});

describe("hline — properties", () => {
    it("two hlines on same (slotId, bar) leave exactly one entry", () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 16 }),
                fc.nat({ max: 1000 }),
                fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e6, max: 1e6 }),
                fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e6, max: 1e6 }),
                (slotId, bar, p1, p2) => {
                    const { ctx, emissions } = makeCtx(bar);
                    ACTIVE_RUNTIME_CONTEXT.current = ctx;
                    hline(slotId, p1);
                    hline(slotId, p2);
                    expect(emissions.plots).toHaveLength(1);
                    expect(emissions.plots[0].value).toBe(p2);
                },
            ),
        );
    });

    it("kind is always 'horizontal-line'", () => {
        fc.assert(
            fc.property(
                fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e6, max: 1e6 }),
                (price) => {
                    const { ctx, emissions } = makeCtx(0);
                    ACTIVE_RUNTIME_CONTEXT.current = ctx;
                    hline("a:1:1#0", price);
                    expect(emissions.plots[0].style.kind).toBe("horizontal-line");
                },
            ),
        );
    });
});

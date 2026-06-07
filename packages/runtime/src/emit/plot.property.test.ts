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
import { plot } from "./plot";

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
    };
    return { ctx, emissions };
}

afterEach(() => {
    ACTIVE_RUNTIME_CONTEXT.current = null;
});

describe("plot — properties", () => {
    it("two plots on same (slotId, bar) leave exactly one entry", () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 16 }),
                fc.nat({ max: 1000 }),
                fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e6, max: 1e6 }),
                fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e6, max: 1e6 }),
                (slotId, bar, v1, v2) => {
                    const { ctx, emissions } = makeCtx(bar);
                    ACTIVE_RUNTIME_CONTEXT.current = ctx;
                    plot(slotId, v1);
                    plot(slotId, v2);
                    expect(emissions.plots).toHaveLength(1);
                    expect(emissions.plots[0].value).toBe(v2);
                },
            ),
        );
    });

    it("non-finite numeric inputs always result in value: null", () => {
        fc.assert(
            fc.property(
                fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY),
                (v) => {
                    const { ctx, emissions } = makeCtx(0);
                    ACTIVE_RUNTIME_CONTEXT.current = ctx;
                    plot("a:1:1#0", v);
                    expect(emissions.plots[0].value).toBeNull();
                },
            ),
        );
    });

    it("finite numeric inputs flow through verbatim", () => {
        fc.assert(
            fc.property(
                fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e9, max: 1e9 }),
                (v) => {
                    const { ctx, emissions } = makeCtx(0);
                    ACTIVE_RUNTIME_CONTEXT.current = ctx;
                    plot("a:1:1#0", v);
                    expect(emissions.plots[0].value).toBe(v);
                },
            ),
        );
    });
});

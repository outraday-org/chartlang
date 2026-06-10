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
} from "../runtimeContext.js";
import { createStreamState } from "../streamState.js";
import { inMemoryStateStore } from "../stateStore.js";
import { alert } from "./alert.js";

function makeCaps(): Capabilities {
    return {
        plots: capabilities.allLines(),
        drawings: new Set(),
        alerts: capabilities.alerts("toast"),
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

describe("alert — properties", () => {
    it("two alerts on same (slotId, bar) leave exactly one entry", () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 16 }),
                fc.nat({ max: 1000 }),
                fc.string({ minLength: 1, maxLength: 32 }),
                fc.string({ minLength: 1, maxLength: 32 }),
                (slotId, bar, m1, m2) => {
                    const { ctx, emissions } = makeCtx(bar);
                    ACTIVE_RUNTIME_CONTEXT.current = ctx;
                    alert(slotId, m1);
                    alert(slotId, m2);
                    expect(emissions.alerts).toHaveLength(1);
                    expect(emissions.alerts[0].message).toBe(m2);
                },
            ),
        );
    });

    it("computeDedupeKey is deterministic: identical args → identical key", () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 16 }),
                fc.nat({ max: 1000 }),
                fc.string({ minLength: 1, maxLength: 32 }),
                (slotId, bar, message) => {
                    const { ctx: ctx1, emissions: e1 } = makeCtx(bar);
                    const { ctx: ctx2, emissions: e2 } = makeCtx(bar);
                    ACTIVE_RUNTIME_CONTEXT.current = ctx1;
                    alert(slotId, message);
                    ACTIVE_RUNTIME_CONTEXT.current = ctx2;
                    alert(slotId, message);
                    expect(e1.alerts[0].dedupeKey).toBe(e2.alerts[0].dedupeKey);
                },
            ),
        );
    });

    it("dedupeKey has the expected ${slotId}::${bar}::<hash> shape", () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 16 }),
                fc.nat({ max: 1000 }),
                fc.string({ minLength: 1, maxLength: 32 }),
                (slotId, bar, message) => {
                    const { ctx, emissions } = makeCtx(bar);
                    ACTIVE_RUNTIME_CONTEXT.current = ctx;
                    alert(slotId, message);
                    const key = emissions.alerts[0].dedupeKey;
                    const prefix = `${slotId}::${bar}::`;
                    expect(key.startsWith(prefix)).toBe(true);
                    // 32-bit FNV-1a hex tail = 8 chars
                    expect(key.slice(prefix.length)).toMatch(/^[0-9a-f]{8}$/);
                },
            ),
        );
    });
});

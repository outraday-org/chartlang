// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { MutableSlot } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";

import {
    ACTIVE_RUNTIME_CONTEXT,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../runtimeContext.js";
import type { StateStore } from "../stateStore.js";
import { createStreamState } from "../streamState.js";
import { commitStateSlots, flushStateSlots, resetTentativeStateSlots } from "./lifecycle.js";
import { buildStateNamespace } from "./stateNamespace.js";

type RuntimeStateNamespace = {
    readonly float: (slotId: string, init: number) => MutableSlot<number>;
    readonly tick: {
        readonly float: (slotId: string, init: number) => MutableSlot<number>;
    };
};

type Step = {
    readonly mode: "close" | "tick";
    readonly value: number;
};

function mapStore(seed?: ReadonlyMap<string, unknown>): StateStore & {
    readonly snapshot: () => Map<string, unknown>;
} {
    const values = new Map(seed);
    return {
        get<T>(slotId: string): T | undefined {
            return values.get(slotId) as T | undefined;
        },
        set<T>(slotId: string, value: T): void {
            values.set(slotId, value);
        },
        has(slotId: string): boolean {
            return values.has(slotId);
        },
        clear(): void {
            values.clear();
        },
        snapshot(): Map<string, unknown> {
            return new Map(values);
        },
    };
}

function makeCapabilities(): Capabilities {
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
        maxDrawingsPerScript: {
            lines: 0,
            labels: 0,
            boxes: 0,
            polylines: 0,
            other: 0,
        },
        maxLookback: 5000,
        maxTickHz: 10,
    };
}

function makeEmissions(): MutableRunnerEmissions {
    return {
        plots: [],
        drawings: [],
        alerts: [],
        diagnostics: [],
        fromBar: 0,
        toBar: 0,
    };
}

function makeContext(stateStore: StateStore): RuntimeContext {
    const stream = createStreamState({ interval: "", capacity: 5, symbol: "" });
    return {
        stream,
        stateStore,
        capabilities: makeCapabilities(),
        emissions: makeEmissions(),
        barIndex: () => 0,
        isTick: false,
        drawingSlots: new Map(),
        drawingSubIdCounters: new Map(),
        drawingBucketCounters: {
            lines: 0,
            labels: 0,
            boxes: 0,
            polylines: 0,
            other: 0,
        },
        scriptMaxDrawings: null,
        stateSlots: new Map(),
    };
}

function runtimeState(): RuntimeStateNamespace {
    return buildStateNamespace() as unknown as RuntimeStateNamespace;
}

function runSteps(ctx: RuntimeContext, steps: readonly Step[]): number[] {
    ACTIVE_RUNTIME_CONTEXT.current = ctx;
    const state = runtimeState();
    const persistent = state.float("slot#0", 0);
    const tick = state.tick.float("slot#1", 0);
    const observed: number[] = [];

    for (const step of steps) {
        if (step.mode === "tick") {
            resetTentativeStateSlots(ctx);
            persistent.value = step.value;
            tick.value = tick.value + 1;
            observed.push(persistent.value, tick.value);
        } else {
            persistent.value = step.value;
            tick.value = tick.value + 1;
            commitStateSlots(ctx);
            flushStateSlots(ctx);
            observed.push(persistent.value, tick.value);
        }
    }

    return observed;
}

describe("state namespace property invariants", () => {
    afterEach(() => {
        ACTIVE_RUNTIME_CONTEXT.current = null;
    });

    it("warm-restore continuation matches continued cold execution", () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        mode: fc.constantFrom("close" as const, "tick" as const),
                        value: fc.integer({ min: -1_000, max: 1_000 }),
                    }),
                    { minLength: 2, maxLength: 50 },
                ),
                fc.integer({ min: 1, max: 49 }),
                (steps, requestedSplit) => {
                    const split = Math.min(requestedSplit, steps.length - 1);
                    const prefix = steps.slice(0, split);
                    const suffix = steps.slice(split);

                    const coldStore = mapStore();
                    const coldCtx = makeContext(coldStore);
                    runSteps(coldCtx, prefix);
                    flushStateSlots(coldCtx);
                    const snapshot = coldStore.snapshot();
                    const continued = runSteps(coldCtx, suffix);

                    const warmCtx = makeContext(mapStore(snapshot));
                    const warm = runSteps(warmCtx, suffix);

                    expect(warm).toEqual(continued);
                },
            ),
            { seed: 42, numRuns: 50 },
        );
    });
});

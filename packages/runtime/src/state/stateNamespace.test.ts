// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { MutableSlot } from "@invinite-org/chartlang-core";
import { afterEach, describe, expect, it } from "vitest";

import {
    ACTIVE_RUNTIME_CONTEXT,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../runtimeContext";
import { inMemoryStateStore, type StateStore } from "../stateStore";
import { createStreamState } from "../streamState";
import { commitStateSlots, flushStateSlots, resetTentativeStateSlots } from "./lifecycle";
import { buildStateNamespace } from "./stateNamespace";

type RuntimeStateNamespace = {
    readonly float: (slotId: string, init: number) => MutableSlot<number>;
    readonly int: (slotId: string, init: number) => MutableSlot<number>;
    readonly bool: (slotId: string, init: boolean) => MutableSlot<boolean>;
    readonly string: (slotId: string, init: string) => MutableSlot<string>;
    readonly tick: {
        readonly float: (slotId: string, init: number) => MutableSlot<number>;
        readonly int: (slotId: string, init: number) => MutableSlot<number>;
        readonly bool: (slotId: string, init: boolean) => MutableSlot<boolean>;
        readonly string: (slotId: string, init: string) => MutableSlot<string>;
    };
};

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

function makeContext(stateStore: StateStore = inMemoryStateStore()): RuntimeContext {
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

describe("buildStateNamespace", () => {
    afterEach(() => {
        ACTIVE_RUNTIME_CONTEXT.current = null;
    });

    it("throws the runtime sentinel outside an active script step", () => {
        const state = runtimeState();
        expect(() => state.float("slot#0", 0)).toThrow(
            "state.float called outside an active script step",
        );
        expect(() => state.tick.bool("slot#1", false)).toThrow(
            "state.tick.bool called outside an active script step",
        );
    });

    it("allocates on first call and reuses the existing slot for later init values", () => {
        const ctx = makeContext();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const state = runtimeState();

        const first = state.float("slot#0", 1);
        first.value = 5;
        const second = state.float("slot#0", 99);

        expect(second.value).toBe(5);
        expect(ctx.stateSlots.size).toBe(1);
    });

    it("restores committed and tentative values from StateStore", () => {
        const store = inMemoryStateStore();
        store.set("slot#0:state", { committed: 7, tentative: 9 });
        const ctx = makeContext(store);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;

        const slot = runtimeState().int("slot#0", 1);

        expect(slot.value).toBe(9);
        resetTentativeStateSlots(ctx);
        expect(slot.value).toBe(7);
    });

    it("resets tentative writes on tick and commits them on close", () => {
        const ctx = makeContext();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const slot = runtimeState().string("slot#0", "a");

        slot.value = "b";
        resetTentativeStateSlots(ctx);
        expect(slot.value).toBe("a");

        slot.value = "c";
        commitStateSlots(ctx);
        flushStateSlots(ctx);
        expect(slot.value).toBe("c");
        expect(ctx.stateStore.get("slot#0:state")).toEqual({
            committed: "c",
            tentative: "c",
        });
    });

    it("commits tick namespace writes immediately", () => {
        const ctx = makeContext();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const state = runtimeState();
        const slot = state.tick.bool("slot#0", false);
        const tickInt = state.tick.int("slot#1", 1);
        const tickString = state.tick.string("slot#2", "a");
        const bool = state.bool("slot#3", false);

        slot.value = true;
        tickInt.value = 2;
        tickString.value = "b";
        bool.value = true;
        resetTentativeStateSlots(ctx);
        flushStateSlots(ctx);

        expect(slot.value).toBe(true);
        expect(tickInt.value).toBe(2);
        expect(tickString.value).toBe("b");
        expect(bool.value).toBe(false);
        expect(ctx.stateStore.get("slot#0:state")).toEqual({
            committed: true,
            tentative: false,
        });
        expect(ctx.stateStore.get("slot#1:state")).toEqual({
            committed: 2,
            tentative: 1,
        });
        expect(ctx.stateStore.get("slot#2:state")).toEqual({
            committed: "b",
            tentative: "a",
        });
    });
});

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { LineState } from "@invinite-org/chartlang-core";
import { afterEach, describe, expect, it } from "vitest";

import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../../runtimeContext.js";
import { createStreamState } from "../../streamState.js";
import { inMemoryStateStore } from "../../stateStore.js";
import { createDrawingHandle } from "./handle.js";

function makeCaps(): Capabilities {
    return {
        plots: capabilities.allLines(),
        drawings: capabilities.allLineDrawings(),
        alerts: new Set(),
        alertConditions: false,
        logs: false,
        inputs: new Set(),
        intervals: [],
        multiTimeframe: false,
        subPanes: 0,
        symInfoFields: new Set(),
        maxDrawingsPerScript: { lines: 100, labels: 0, boxes: 0, polylines: 0, other: 0 },
        maxLookback: 5000,
        maxTickHz: 10,
    };
}

function makeCtx(barTime = 1_700_000_000_000, barIndex = 0): RuntimeContext {
    const stream = createStreamState({ interval: "", capacity: 4, symbol: "" });
    stream.bar.time = barTime;
    return {
        stream,
        stateStore: inMemoryStateStore(),
        capabilities: makeCaps(),
        emissions: {
            plots: [],
            drawings: [],
            alerts: [],
            diagnostics: [],
            fromBar: 0,
            toBar: 0,
        },
        barIndex: () => barIndex,
        isTick: false,
        drawingSlots: new Map(),
        drawingSubIdCounters: new Map(),
        drawingBucketCounters: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        scriptMaxDrawings: null,
        stateSlots: new Map(),
    };
}

function lineState(price0: number, price1: number): LineState {
    return {
        kind: "line",
        anchors: [
            { time: 1, price: price0 },
            { time: 2, price: price1 },
        ],
        style: {},
    };
}

afterEach(() => {
    ACTIVE_RUNTIME_CONTEXT.current = null;
});

describe("createDrawingHandle — create", () => {
    it("throws the sentinel when called outside an active script step", () => {
        expect(() => createDrawingHandle("a", 0, "line", lineState(100, 110))).toThrow(
            "draw called outside an active script step",
        );
    });

    it("emits op: create on first call and allocates the slot", () => {
        const ctx = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const handle = createDrawingHandle("x.chart.ts:5:13#0", 0, "line", lineState(100, 110));
        expect(handle.id).toBe("x.chart.ts:5:13#0#0");
        expect(ctx.emissions.drawings).toHaveLength(1);
        const [e] = ctx.emissions.drawings;
        expect(e.op).toBe("create");
        expect(e.handleId).toBe("x.chart.ts:5:13#0#0");
        expect(e.drawingKind).toBe("line");
        expect(ctx.drawingSlots.size).toBe(1);
    });
});

describe("createDrawingHandle — update", () => {
    it("merges the patch and re-emits the FULL merged state under op: update", () => {
        // Create on bar 0; advance the bar then update so the
        // per-bar `(handleId, bar)` dedup does not collapse the
        // pair into a single in-place replace.
        let bar = 0;
        const ctx = makeCtx();
        const dynamic: RuntimeContext = { ...ctx, barIndex: () => bar };
        ACTIVE_RUNTIME_CONTEXT.current = dynamic;
        const handle = createDrawingHandle("x", 0, "line", lineState(100, 110));
        bar = 1;
        handle.update({ style: { color: "#3b82f6" } });
        expect(dynamic.emissions.drawings).toHaveLength(2);
        const [, updated] = dynamic.emissions.drawings;
        expect(updated.op).toBe("update");
        expect(updated.state).toMatchObject({
            kind: "line",
            anchors: [
                { time: 1, price: 100 },
                { time: 2, price: 110 },
            ],
            style: { color: "#3b82f6" },
        });
    });

    it("forces state.kind back to the slot's discriminant even if patch carries a different kind", () => {
        let bar = 0;
        const ctx = makeCtx();
        const dynamic: RuntimeContext = { ...ctx, barIndex: () => bar };
        ACTIVE_RUNTIME_CONTEXT.current = dynamic;
        const handle = createDrawingHandle("x", 0, "line", lineState(100, 110));
        bar = 1;
        // Type-system rejects this, but the runtime defends anyway —
        // `state.kind` must remain "line".
        handle.update({ kind: "horizontal-line" } as never);
        const [, updated] = dynamic.emissions.drawings;
        expect(updated.state.kind).toBe("line");
    });

    it("is a no-op when called outside an active script step", () => {
        const ctx = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const handle = createDrawingHandle("x", 0, "line", lineState(100, 110));
        ACTIVE_RUNTIME_CONTEXT.current = null;
        handle.update({ style: { color: "#fff" } });
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        expect(ctx.emissions.drawings).toHaveLength(1);
    });
});

describe("createDrawingHandle — remove", () => {
    it("emits one final op: remove and ignores subsequent update / remove calls", () => {
        let bar = 0;
        const ctx = makeCtx();
        const dynamic: RuntimeContext = { ...ctx, barIndex: () => bar };
        ACTIVE_RUNTIME_CONTEXT.current = dynamic;
        const handle = createDrawingHandle("x", 0, "line", lineState(100, 110));
        bar = 1;
        handle.remove();
        handle.update({ style: { color: "#fff" } });
        handle.remove();
        expect(dynamic.emissions.drawings).toHaveLength(2);
        expect(dynamic.emissions.drawings[1].op).toBe("remove");
    });

    it("is a no-op when called outside an active script step", () => {
        const ctx = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const handle = createDrawingHandle("x", 0, "line", lineState(100, 110));
        ACTIVE_RUNTIME_CONTEXT.current = null;
        handle.remove();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        expect(ctx.emissions.drawings).toHaveLength(1);
    });
});

describe("createDrawingHandle — cross-bar persistence", () => {
    it("re-calling with the same slotId+subId in a new bar finds the existing slot and emits op: update", () => {
        const ctx = makeCtx(1_700_000_060_000, 1);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        // Simulate a pre-existing slot from the previous bar.
        ctx.drawingSlots.set("x#0", {
            handleId: "x#0",
            kind: "line",
            state: lineState(100, 110),
            removed: false,
        });
        const handle = createDrawingHandle("x", 0, "line", lineState(200, 210));
        expect(handle.id).toBe("x#0");
        const [e] = ctx.emissions.drawings;
        expect(e.op).toBe("update");
        expect(e.state).toMatchObject({
            anchors: [
                { time: 1, price: 200 },
                { time: 2, price: 210 },
            ],
        });
    });

    it("resurrects a previously-removed slot — `removed: true` flips back to `false` on re-create", () => {
        const ctx = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        ctx.drawingSlots.set("x#0", {
            handleId: "x#0",
            kind: "line",
            state: lineState(100, 110),
            removed: true,
        });
        createDrawingHandle("x", 0, "line", lineState(200, 210));
        const slot = ctx.drawingSlots.get("x#0");
        expect(slot?.removed).toBe(false);
    });
});

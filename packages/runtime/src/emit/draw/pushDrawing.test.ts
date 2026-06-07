// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities, DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { DrawingCounts, LineState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { RuntimeContext } from "../../runtimeContext";
import { createStreamState } from "../../streamState";
import { inMemoryStateStore } from "../../stateStore";
import { pushDrawing } from "./pushDrawing";

function makeCaps(overrides: Partial<Capabilities> = {}): Capabilities {
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
        maxDrawingsPerScript: { lines: 100, labels: 100, boxes: 100, polylines: 100, other: 100 },
        maxLookback: 5000,
        maxTickHz: 10,
        ...overrides,
    };
}

function makeCtx(opts: {
    caps?: Capabilities;
    scriptMaxDrawings?: DrawingCounts | null;
} = {}): RuntimeContext {
    return {
        stream: createStreamState({ interval: "", capacity: 4, symbol: "" }),
        stateStore: inMemoryStateStore(),
        capabilities: opts.caps ?? makeCaps(),
        emissions: {
            plots: [],
            drawings: [],
            alerts: [],
            diagnostics: [],
            fromBar: 0,
            toBar: 0,
        },
        barIndex: () => 0,
        isTick: false,
        drawingSlots: new Map(),
        drawingSubIdCounters: new Map(),
        drawingBucketCounters: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        scriptMaxDrawings: opts.scriptMaxDrawings ?? null,
    };
}

function makeLineState(): LineState {
    return {
        kind: "line",
        anchors: [
            { time: 1, price: 100 },
            { time: 2, price: 110 },
        ],
        style: {},
    };
}

function makeLineEmission(
    overrides: Partial<DrawingEmission> = {},
): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "x.chart.ts:1:1#0",
        drawingKind: "line",
        op: "create",
        state: makeLineState(),
        bar: 0,
        time: 1_700_000_000_000,
        ...overrides,
    };
}

describe("pushDrawing — capability gate", () => {
    it("drops + diagnoses unsupported-drawing-kind when kind is missing", () => {
        const ctx = makeCtx({ caps: makeCaps({ drawings: new Set() }) });
        pushDrawing(ctx, makeLineEmission());
        expect(ctx.emissions.drawings).toEqual([]);
        expect(ctx.emissions.diagnostics).toHaveLength(1);
        expect(ctx.emissions.diagnostics[0].code).toBe("unsupported-drawing-kind");
        expect(ctx.emissions.diagnostics[0].slotId).toBe("x.chart.ts:1:1#0");
    });
});

describe("pushDrawing — validation", () => {
    it("drops + diagnoses malformed-emission when state.kind diverges from drawingKind", () => {
        const ctx = makeCtx();
        const e = makeLineEmission({
            state: { ...makeLineState(), kind: "horizontal-line" } as unknown as LineState,
        });
        pushDrawing(ctx, e);
        expect(ctx.emissions.drawings).toEqual([]);
        expect(ctx.emissions.diagnostics[0].code).toBe("malformed-emission");
    });

    it("drops a malformed line state (non-finite anchor price)", () => {
        const ctx = makeCtx();
        const broken: LineState = {
            kind: "line",
            anchors: [
                { time: 1, price: Number.NaN },
                { time: 2, price: 110 },
            ],
            style: {},
        };
        pushDrawing(ctx, makeLineEmission({ state: broken }));
        expect(ctx.emissions.drawings).toEqual([]);
        expect(ctx.emissions.diagnostics[0].code).toBe("malformed-emission");
    });
});

describe("pushDrawing — happy path", () => {
    it("appends a well-formed line emission", () => {
        const ctx = makeCtx();
        const e = makeLineEmission();
        pushDrawing(ctx, e);
        expect(ctx.emissions.drawings).toEqual([e]);
        expect(ctx.emissions.diagnostics).toEqual([]);
        expect(ctx.drawingBucketCounters.lines).toBe(1);
    });
});

describe("pushDrawing — bucket budget", () => {
    it("drops + diagnoses drawing-budget-exceeded when the lines bucket is full", () => {
        const ctx = makeCtx({
            caps: makeCaps({
                maxDrawingsPerScript: { lines: 2, labels: 0, boxes: 0, polylines: 0, other: 0 },
            }),
        });
        pushDrawing(ctx, makeLineEmission({ handleId: "h0" }));
        pushDrawing(ctx, makeLineEmission({ handleId: "h1" }));
        pushDrawing(ctx, makeLineEmission({ handleId: "h2" }));
        expect(ctx.emissions.drawings).toHaveLength(2);
        expect(ctx.emissions.diagnostics).toHaveLength(1);
        expect(ctx.emissions.diagnostics[0].code).toBe("drawing-budget-exceeded");
    });

    it("uses min(scriptMaxDrawings, adapter cap) — scriptMax wins when lower", () => {
        const ctx = makeCtx({
            caps: makeCaps({
                maxDrawingsPerScript: { lines: 100, labels: 0, boxes: 0, polylines: 0, other: 0 },
            }),
            scriptMaxDrawings: { lines: 1, labels: 0, boxes: 0, polylines: 0, other: 0 },
        });
        pushDrawing(ctx, makeLineEmission({ handleId: "h0" }));
        pushDrawing(ctx, makeLineEmission({ handleId: "h1" }));
        expect(ctx.emissions.drawings).toHaveLength(1);
        expect(ctx.emissions.diagnostics).toHaveLength(1);
    });

    it("does not count `op: update` against the bucket", () => {
        const ctx = makeCtx();
        pushDrawing(ctx, makeLineEmission({ handleId: "h0", op: "create" }));
        pushDrawing(ctx, makeLineEmission({ handleId: "h0", op: "update", bar: 1 }));
        pushDrawing(ctx, makeLineEmission({ handleId: "h0", op: "update", bar: 2 }));
        expect(ctx.drawingBucketCounters.lines).toBe(1);
    });

    it("decrements on `op: remove` and clamps at zero on a spurious extra remove", () => {
        const ctx = makeCtx();
        pushDrawing(ctx, makeLineEmission({ handleId: "h0", op: "create" }));
        expect(ctx.drawingBucketCounters.lines).toBe(1);
        pushDrawing(ctx, makeLineEmission({ handleId: "h0", op: "remove", bar: 1 }));
        expect(ctx.drawingBucketCounters.lines).toBe(0);
        // Spurious remove — the handle impl wouldn't fire one, but the
        // wire-level enforcer must clamp.
        pushDrawing(ctx, makeLineEmission({ handleId: "h0", op: "remove", bar: 2 }));
        expect(ctx.drawingBucketCounters.lines).toBe(0);
    });
});

describe("pushDrawing — dedup", () => {
    it("collapses two emissions on the same (handleId, bar) — last write wins", () => {
        const ctx = makeCtx();
        const first = makeLineEmission({ handleId: "h0", op: "create" });
        const second = makeLineEmission({ handleId: "h0", op: "update" });
        pushDrawing(ctx, first);
        pushDrawing(ctx, second);
        expect(ctx.emissions.drawings).toEqual([second]);
    });

    it("does not collapse across different handleIds on the same bar", () => {
        const ctx = makeCtx();
        const a = makeLineEmission({ handleId: "h0" });
        const b = makeLineEmission({ handleId: "h1" });
        pushDrawing(ctx, a);
        pushDrawing(ctx, b);
        expect(ctx.emissions.drawings).toEqual([a, b]);
    });

    it("does not collapse across bars on the same handleId", () => {
        const ctx = makeCtx();
        const bar0 = makeLineEmission({ handleId: "h0", bar: 0 });
        const bar1 = makeLineEmission({ handleId: "h0", op: "update", bar: 1 });
        pushDrawing(ctx, bar0);
        pushDrawing(ctx, bar1);
        expect(ctx.emissions.drawings).toEqual([bar0, bar1]);
    });
});

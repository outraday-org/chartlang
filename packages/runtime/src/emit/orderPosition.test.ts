// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type {
    Capabilities,
    OrderEmission,
    PlotEmission,
} from "@invinite-org/chartlang-adapter-kit";
import type { Bar, OrderAction } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import {
    FLAT_ORDER_POSITION,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../runtimeContext.js";
import { inMemoryStateStore } from "../stateStore.js";
import { appendBarToStream, createStreamState } from "../streamState.js";
import {
    ORDER_LABEL_SLOT_SUFFIX,
    ORDER_MARKER_SLOT_SUFFIX,
    applyOrderToPosition,
    foldConfirmedOrders,
} from "./orderPosition.js";

const MARKER_PLOTS: ReadonlySet<string> = new Set(["arrow", "label"]);

function makeCaps(plots: ReadonlySet<string>): Capabilities {
    return {
        plots: plots as Capabilities["plots"],
        drawings: new Set(),
        alerts: capabilities.alerts("toast"),
        alertConditions: false,
        logs: false,
        orders: true,
        inputs: new Set(),
        intervals: [],
        multiTimeframe: false,
        multiSymbol: false,
        subPanes: 0,
        symInfoFields: new Set(),
        maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        maxLookback: 5000,
        maxTickHz: 10,
    };
}

function makeBar(close: number, low = close - 1, high = close + 1): Bar {
    return {
        time: 1_700_000_000_000,
        open: close,
        high,
        low,
        close,
        volume: 1,
        symbol: "X",
        interval: "1m",
        hl2: (high + low) / 2,
        hlc3: (high + low + close) / 3,
        ohlc4: (close + high + low + close) / 4,
        hlcc4: (high + low + close + close) / 4,
    };
}

function makeCtx(opts: { bar?: Bar; plots?: ReadonlySet<string>; barIndex?: number } = {}): {
    ctx: RuntimeContext;
    emissions: MutableRunnerEmissions;
} {
    const emissions: MutableRunnerEmissions = {
        plots: [],
        drawings: [],
        alerts: [],
        alertConditions: [],
        orders: [],
        logs: [],
        diagnostics: [],
        fromBar: 0,
        toBar: 0,
    };
    const stream = createStreamState({ interval: "", capacity: 4, symbol: "" });
    appendBarToStream(stream, opts.bar ?? makeBar(100));
    const ctx: RuntimeContext = {
        stream,
        stateStore: inMemoryStateStore(),
        lastPersistTime: 0,
        capabilities: makeCaps(opts.plots ?? MARKER_PLOTS),
        emissions,
        barIndex: () => opts.barIndex ?? 5,
        isTick: false,
        drawingSlots: new Map(),
        drawingSubIdCounters: new Map(),
        drawingBucketCounters: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        scriptMaxDrawings: null,
        stateSlots: new Map(),
        seriesSlots: new Map(),
        objectSeriesSlots: new Map(),
        arraySlots: new Map(),
        mapSlots: new Map(),
        chartSymbol: "",
        secondaryStreams: new Map(),
        requestSecurityBars: new Map(),
        requestSecurityAlignments: new Map(),
        requestSecurityAscendingBars: new Map(),
        requestLowerTfViews: new Map(),
        diagnosedRequestKeys: new Set(),
        diagnosedTzKeys: new Set(),
        diagnosedOrderSlots: new Set(),
        pendingOrders: [],
        orderPosition: FLAT_ORDER_POSITION,
        logBudget: 0,
        logBudgetExceededDiagnosed: false,
        resolvedInputs: Object.freeze({}),
        externalSeriesFeeds: Object.freeze({}),
        externalSeriesSlots: new Map(),
        defaultPane: "overlay",
        scriptPane: "script:demo",
        plotOverrides: Object.freeze({}),
        diagnosedInputKeys: new Set(),
        views: { barstate: undefined, syminfo: undefined, timeframe: undefined },
    } as unknown as RuntimeContext;
    return { ctx, emissions };
}

function makeOrder(
    action: OrderAction,
    over: Partial<Pick<OrderEmission, "qty" | "label" | "slotId">> = {},
): OrderEmission {
    return {
        kind: "order",
        slotId: over.slotId ?? "s.chart.ts:3:5#0",
        action,
        qty: over.qty ?? null,
        label: over.label ?? "",
        bar: 5,
        time: 1_700_000_000_000,
        meta: {},
        dedupeKey: "k",
    };
}

describe("applyOrderToPosition — fold arithmetic", () => {
    it("opens a long from flat at the signal bar's close", () => {
        const next = applyOrderToPosition(FLAT_ORDER_POSITION, makeOrder("buy"), 7, 100);
        expect(next).toEqual({ size: 1, avgPrice: 100, entryBar: 7 });
    });

    it("opens a short from flat with a symmetric negative size", () => {
        const next = applyOrderToPosition(
            FLAT_ORDER_POSITION,
            makeOrder("sell", { qty: 3 }),
            7,
            100,
        );
        expect(next).toEqual({ size: -3, avgPrice: 100, entryBar: 7 });
    });

    it("treats an absent qty as one nominal unit", () => {
        const next = applyOrderToPosition(FLAT_ORDER_POSITION, makeOrder("buy"), 0, 50);
        expect(next.size).toBe(1);
    });

    it("volume-weights the nominal prices when adding to an existing long", () => {
        const first = applyOrderToPosition(
            FLAT_ORDER_POSITION,
            makeOrder("buy", { qty: 1 }),
            2,
            100,
        );
        const second = applyOrderToPosition(first, makeOrder("buy", { qty: 3 }), 6, 200);
        // (100 * 1 + 200 * 3) / 4 = 175; the entry bar does NOT move on an add.
        expect(second).toEqual({ size: 4, avgPrice: 175, entryBar: 2 });
    });

    it("volume-weights symmetrically on the short side", () => {
        const first = applyOrderToPosition(
            FLAT_ORDER_POSITION,
            makeOrder("sell", { qty: 2 }),
            1,
            10,
        );
        const second = applyOrderToPosition(first, makeOrder("sell", { qty: 2 }), 4, 20);
        expect(second).toEqual({ size: -4, avgPrice: 15, entryBar: 1 });
    });

    it("keeps avgPrice and entryBar through a partial reduce", () => {
        const long = applyOrderToPosition(
            FLAT_ORDER_POSITION,
            makeOrder("buy", { qty: 3 }),
            2,
            100,
        );
        const reduced = applyOrderToPosition(long, makeOrder("sell", { qty: 1 }), 9, 500);
        expect(reduced).toEqual({ size: 2, avgPrice: 100, entryBar: 2 });
    });

    it("goes flat when a fold lands exactly on zero", () => {
        const long = applyOrderToPosition(
            FLAT_ORDER_POSITION,
            makeOrder("buy", { qty: 2 }),
            2,
            100,
        );
        const flat = applyOrderToPosition(long, makeOrder("sell", { qty: 2 }), 9, 500);
        expect(flat).toEqual({ size: 0, avgPrice: null, entryBar: null });
    });

    it("reverses through zero and restarts entryBar / avgPrice", () => {
        const long = applyOrderToPosition(
            FLAT_ORDER_POSITION,
            makeOrder("buy", { qty: 1 }),
            2,
            100,
        );
        const short = applyOrderToPosition(long, makeOrder("sell", { qty: 3 }), 9, 250);
        expect(short).toEqual({ size: -2, avgPrice: 250, entryBar: 9 });
    });

    it("close goes fully flat and ignores a partial-close qty", () => {
        const long = applyOrderToPosition(
            FLAT_ORDER_POSITION,
            makeOrder("buy", { qty: 5 }),
            2,
            100,
        );
        const closed = applyOrderToPosition(long, makeOrder("close", { qty: 1 }), 9, 250);
        expect(closed).toEqual({ size: 0, avgPrice: null, entryBar: null });
        expect(closed).toBe(FLAT_ORDER_POSITION);
    });

    it("stores avgPrice null when the signal bar's close is not finite", () => {
        const next = applyOrderToPosition(FLAT_ORDER_POSITION, makeOrder("buy"), 3, Number.NaN);
        expect(next).toEqual({ size: 1, avgPrice: null, entryBar: 3 });
    });

    it("keeps an unknown avgPrice unknown when adding to that position", () => {
        const unpriced = applyOrderToPosition(FLAT_ORDER_POSITION, makeOrder("buy"), 3, Number.NaN);
        const added = applyOrderToPosition(unpriced, makeOrder("buy"), 4, 100);
        expect(added).toEqual({ size: 2, avgPrice: null, entryBar: 3 });
    });

    it("collapses a non-finite weighted average to null", () => {
        const priced = applyOrderToPosition(FLAT_ORDER_POSITION, makeOrder("buy"), 3, 100);
        const added = applyOrderToPosition(priced, makeOrder("buy"), 4, Number.NaN);
        expect(added).toEqual({ size: 2, avgPrice: null, entryBar: 3 });
    });

    it("freezes every folded position", () => {
        const next = applyOrderToPosition(FLAT_ORDER_POSITION, makeOrder("buy"), 1, 10);
        expect(Object.isFrozen(next)).toBe(true);
    });
});

describe("foldConfirmedOrders — position", () => {
    it("is a no-op with no pending orders", () => {
        const { ctx, emissions } = makeCtx();
        foldConfirmedOrders(ctx);
        expect(ctx.orderPosition).toBe(FLAT_ORDER_POSITION);
        expect(emissions.plots).toEqual([]);
    });

    it("folds every pending order in emission order at the bar's close", () => {
        const { ctx } = makeCtx({ bar: makeBar(100), barIndex: 4 });
        ctx.pendingOrders = [
            { emission: makeOrder("buy", { qty: 1 }), marker: false },
            { emission: makeOrder("buy", { qty: 1 }), marker: false },
        ];
        foldConfirmedOrders(ctx);
        expect(ctx.orderPosition).toEqual({ size: 2, avgPrice: 100, entryBar: 4 });
    });

    it("replaces the position object rather than mutating the previous one", () => {
        const { ctx } = makeCtx();
        const before = ctx.orderPosition;
        ctx.pendingOrders = [{ emission: makeOrder("buy"), marker: false }];
        foldConfirmedOrders(ctx);
        expect(ctx.orderPosition).not.toBe(before);
        expect(before).toEqual({ size: 0, avgPrice: null, entryBar: null });
    });
});

describe("foldConfirmedOrders — auto-markers", () => {
    function plotAt(emissions: MutableRunnerEmissions, slotId: string): PlotEmission | undefined {
        return emissions.plots.find((p) => p.slotId === slotId);
    }

    it("renders an up arrow anchored at the bar low for a buy", () => {
        const { ctx, emissions } = makeCtx({ bar: makeBar(100, 95, 105), barIndex: 4 });
        ctx.pendingOrders = [{ emission: makeOrder("buy"), marker: true }];

        foldConfirmedOrders(ctx);

        const arrow = plotAt(emissions, `s.chart.ts:3:5#0${ORDER_MARKER_SLOT_SUFFIX}`);
        expect(arrow).toBeDefined();
        expect(arrow?.style).toEqual({ kind: "arrow", direction: "up", size: 12 });
        expect(arrow?.value).toBe(95);
        expect(arrow?.color).toBe("#26a69a");
        expect(arrow?.title).toBe("Order");
        expect(arrow?.pane).toBe("overlay");
        expect(arrow?.bar).toBe(4);
    });

    it("renders a down arrow anchored at the bar high for a sell", () => {
        const { ctx, emissions } = makeCtx({ bar: makeBar(100, 95, 105) });
        ctx.pendingOrders = [{ emission: makeOrder("sell"), marker: true }];

        foldConfirmedOrders(ctx);

        const arrow = plotAt(emissions, `s.chart.ts:3:5#0${ORDER_MARKER_SLOT_SUFFIX}`);
        expect(arrow?.style).toEqual({ kind: "arrow", direction: "down", size: 12 });
        expect(arrow?.value).toBe(105);
        expect(arrow?.color).toBe("#ef5350");
    });

    it("renders a close marker on the sell side", () => {
        const { ctx, emissions } = makeCtx({ bar: makeBar(100, 95, 105) });
        ctx.pendingOrders = [{ emission: makeOrder("close"), marker: true }];

        foldConfirmedOrders(ctx);

        const arrow = plotAt(emissions, `s.chart.ts:3:5#0${ORDER_MARKER_SLOT_SUFFIX}`);
        expect(arrow?.style).toEqual({ kind: "arrow", direction: "down", size: 12 });
        expect(arrow?.color).toBe("#ef5350");
    });

    it("adds a label plot at the same anchor when the order is labelled", () => {
        const { ctx, emissions } = makeCtx({ bar: makeBar(100, 95, 105) });
        ctx.pendingOrders = [{ emission: makeOrder("buy", { label: "Long" }), marker: true }];

        foldConfirmedOrders(ctx);

        const label = plotAt(emissions, `s.chart.ts:3:5#0${ORDER_LABEL_SLOT_SUFFIX}`);
        expect(label?.style).toEqual({ kind: "label", text: "Long", position: "below" });
        expect(label?.value).toBe(95);
        expect(label?.color).toBe("#26a69a");
    });

    it("puts a sell label above the bar", () => {
        const { ctx, emissions } = makeCtx({ bar: makeBar(100, 95, 105) });
        ctx.pendingOrders = [{ emission: makeOrder("sell", { label: "Exit" }), marker: true }];

        foldConfirmedOrders(ctx);

        const label = plotAt(emissions, `s.chart.ts:3:5#0${ORDER_LABEL_SLOT_SUFFIX}`);
        expect(label?.style).toEqual({ kind: "label", text: "Exit", position: "above" });
    });

    it("emits no label plot for an unlabelled order", () => {
        const { ctx, emissions } = makeCtx();
        ctx.pendingOrders = [{ emission: makeOrder("buy"), marker: true }];

        foldConfirmedOrders(ctx);

        expect(emissions.plots.map((p) => p.slotId)).toEqual([
            `s.chart.ts:3:5#0${ORDER_MARKER_SLOT_SUFFIX}`,
        ]);
    });

    it("marker: false suppresses both plots but still folds the position", () => {
        const { ctx, emissions } = makeCtx();
        ctx.pendingOrders = [{ emission: makeOrder("buy", { label: "Long" }), marker: false }];

        foldConfirmedOrders(ctx);

        expect(emissions.plots).toEqual([]);
        expect(ctx.orderPosition.size).toBe(1);
    });

    it("skips SILENTLY when the adapter cannot render an arrow", () => {
        // The `orders` channel is the source of truth; markers are a courtesy,
        // so a withheld plot kind is not a broken promise and gets no
        // diagnostic (which is why the gate cannot live inside `emitPlot`).
        const { ctx, emissions } = makeCtx({ plots: capabilities.allLines() });
        ctx.pendingOrders = [{ emission: makeOrder("buy", { label: "Long" }), marker: true }];

        foldConfirmedOrders(ctx);

        expect(emissions.plots).toEqual([]);
        expect(emissions.diagnostics).toEqual([]);
        expect(ctx.orderPosition.size).toBe(1);
    });

    it("renders the arrow alone when only `label` is withheld", () => {
        const { ctx, emissions } = makeCtx({ plots: new Set(["arrow"]) });
        ctx.pendingOrders = [{ emission: makeOrder("buy", { label: "Long" }), marker: true }];

        foldConfirmedOrders(ctx);

        expect(emissions.plots.map((p) => p.style.kind)).toEqual(["arrow"]);
        expect(emissions.diagnostics).toEqual([]);
    });

    it("uses a synthetic slot-id namespace the compiler can never issue", () => {
        // Compiler ids end in `#<digits>`; the suffixes append a second `#`
        // followed by letters, so the two spaces cannot collide.
        for (const suffix of [ORDER_MARKER_SLOT_SUFFIX, ORDER_LABEL_SLOT_SUFFIX]) {
            expect(suffix.startsWith("#")).toBe(true);
            expect(/^#[a-z]+$/.test(suffix)).toBe(true);
            expect(/#\d+$/.test(`s.chart.ts:3:5#0${suffix}`)).toBe(false);
        }
    });

    it("collapses a repeated same-bar fold to one plot per synthetic slot", () => {
        // Marker plots ride the ordinary plot queue's `(slotId, bar)`
        // last-write-wins dedup: the EVENT must not be lost (append-only
        // `orders`), the PICTURE of it must not be doubled.
        const { ctx, emissions } = makeCtx();
        ctx.pendingOrders = [
            { emission: makeOrder("buy", { label: "a" }), marker: true },
            { emission: makeOrder("buy", { label: "b" }), marker: true },
        ];

        foldConfirmedOrders(ctx);

        expect(emissions.plots).toHaveLength(2);
        const label = plotAt(emissions, `s.chart.ts:3:5#0${ORDER_LABEL_SLOT_SUFFIX}`);
        expect(label?.style).toEqual({ kind: "label", text: "b", position: "below" });
        expect(ctx.orderPosition.size).toBe(2);
    });

    it("keeps distinct callsites on distinct synthetic slots", () => {
        const { ctx, emissions } = makeCtx();
        ctx.pendingOrders = [
            { emission: makeOrder("buy", { slotId: "s.chart.ts:1:1#0" }), marker: true },
            { emission: makeOrder("sell", { slotId: "s.chart.ts:2:1#0" }), marker: true },
        ];

        foldConfirmedOrders(ctx);

        expect(emissions.plots.map((p) => p.slotId)).toEqual([
            `s.chart.ts:1:1#0${ORDER_MARKER_SLOT_SUFFIX}`,
            `s.chart.ts:2:1#0${ORDER_MARKER_SLOT_SUFFIX}`,
        ]);
    });
});

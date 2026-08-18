// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { OrderOpts } from "@invinite-org/chartlang-core";
import { afterEach, describe, expect, it } from "vitest";

import {
    ACTIVE_RUNTIME_CONTEXT,
    FLAT_ORDER_POSITION,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../runtimeContext.js";
import { inMemoryStateStore } from "../stateStore.js";
import { createStreamState } from "../streamState.js";
import { hashStringStable } from "./hash.js";
import { ORDER_NAMESPACE } from "./order.js";

// The compiler injects a leading slot id into every `order.buy` / `sell` /
// `close` callsite (`order.position` is `slot: false` and gets none), so the
// tests drive the compiler-injected overload. The script-facing type hides the
// extra argument, hence the local alias.
type InjectedEmitter = (slotId: string, opts?: OrderOpts) => void;

const buy = ORDER_NAMESPACE.buy as unknown as InjectedEmitter;
const sell = ORDER_NAMESPACE.sell as unknown as InjectedEmitter;
const closeOrder = ORDER_NAMESPACE.close as unknown as InjectedEmitter;

function makeCaps(overrides: Partial<Capabilities> = {}): Capabilities {
    return {
        plots: capabilities.allLines(),
        drawings: new Set(),
        alerts: capabilities.alerts("toast"),
        alertConditions: false,
        logs: false,
        orders: true,
        inputs: new Set(),
        intervals: [],
        multiTimeframe: false,
        subPanes: 0,
        symInfoFields: new Set(),
        maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        maxLookback: 5000,
        maxTickHz: 10,
        ...overrides,
    };
}

function makeCtx(opts: { caps?: Capabilities; barIndex?: number; barTime?: number } = {}): {
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
    stream.bar.time = opts.barTime ?? 1_700_000_000_000;
    const ctx: RuntimeContext = {
        stream,
        stateStore: inMemoryStateStore(),
        lastPersistTime: 0,
        capabilities: opts.caps ?? makeCaps(),
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

afterEach(() => {
    ACTIVE_RUNTIME_CONTEXT.current = null;
});

describe("order — capability gate", () => {
    it("drops the order and diagnoses once per slot per mount", () => {
        const { ctx, emissions } = makeCtx({ caps: makeCaps({ orders: false }) });
        ACTIVE_RUNTIME_CONTEXT.current = ctx;

        buy("o:1:1#0");
        buy("o:1:1#0", { label: "again" });

        expect(emissions.orders).toEqual([]);
        expect(ctx.pendingOrders).toEqual([]);
        expect(emissions.diagnostics).toHaveLength(1);
        const diag = emissions.diagnostics[0];
        expect(diag.code).toBe("unsupported-orders");
        expect(diag.severity).toBe("warning");
        expect(diag.message).toBe("Adapter does not support order emissions.");
        expect(diag.slotId).toBe("o:1:1#0");
        expect(diag.bar).toBe(5);
    });

    it("diagnoses each declining slot separately", () => {
        const { ctx, emissions } = makeCtx({ caps: makeCaps({ orders: false }) });
        ACTIVE_RUNTIME_CONTEXT.current = ctx;

        buy("o:1:1#0");
        sell("o:2:1#0");
        closeOrder("o:3:1#0");

        expect(emissions.diagnostics.map((d) => d.slotId)).toEqual([
            "o:1:1#0",
            "o:2:1#0",
            "o:3:1#0",
        ]);
    });

    it("treats an absent orders capability as declined", () => {
        // Adapters predating the channel have no `orders` key at all; the gate
        // is `!== true`, so absence declines rather than throwing.
        const caps = makeCaps();
        const { ctx, emissions } = makeCtx({
            caps: { ...caps, orders: undefined } as unknown as Capabilities,
        });
        ACTIVE_RUNTIME_CONTEXT.current = ctx;

        buy("o:1:1#0");

        expect(emissions.orders).toEqual([]);
        expect(emissions.diagnostics.map((d) => d.code)).toEqual(["unsupported-orders"]);
    });
});

describe("order — happy path", () => {
    it("pushes one OrderEmission with the full spine", () => {
        const { ctx, emissions } = makeCtx({ barIndex: 3, barTime: 1_700_000_060_000 });
        ACTIVE_RUNTIME_CONTEXT.current = ctx;

        buy("o:1:1#0", { qty: 2, label: "Long", meta: { reason: "cross" } });

        expect(emissions.orders).toHaveLength(1);
        const e = emissions.orders[0];
        expect(e.kind).toBe("order");
        expect(e.slotId).toBe("o:1:1#0");
        expect(e.action).toBe("buy");
        expect(e.qty).toBe(2);
        expect(e.label).toBe("Long");
        expect(e.bar).toBe(3);
        expect(e.time).toBe(1_700_000_060_000);
        expect(e.meta).toEqual({ reason: "cross" });
        expect(emissions.diagnostics).toEqual([]);
    });

    it("defaults qty to null and label to the empty string", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;

        sell("o:1:1#0");

        expect(emissions.orders[0].qty).toBeNull();
        expect(emissions.orders[0].label).toBe("");
        expect(emissions.orders[0].meta).toEqual({});
        expect(emissions.orders[0].action).toBe("sell");
    });

    it("carries the close action", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;

        closeOrder("o:1:1#0", { label: "Exit" });

        expect(emissions.orders[0].action).toBe("close");
        expect(emissions.orders[0].label).toBe("Exit");
    });

    it("snapshots meta at emission time and freezes it", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const meta: Record<string, number> = { strength: 1 };
        const pair = Proxy.revocable({ ok: true }, {});

        buy("o:1:1#0", { meta: { ...meta, pair: pair.proxy, legs: [1, 2] } });
        meta.strength = 99;
        pair.revoke();

        const emitted = emissions.orders[0].meta;
        expect(emitted).toEqual({ strength: 1, pair: { ok: true }, legs: [1, 2] });
        expect(Object.isFrozen(emitted)).toBe(true);
        expect(Object.isFrozen((emitted as { legs: number[] }).legs)).toBe(true);
    });

    it("computes a deterministic dedupeKey over slot / bar / payload", () => {
        const { ctx, emissions } = makeCtx({ barIndex: 7 });
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const meta = { reason: "crossover" };

        buy("o:9:3#0", { qty: 1, label: "L", meta });

        const expected = hashStringStable(`buy${String(1)}L${JSON.stringify(meta)}`);
        expect(emissions.orders[0].dedupeKey).toBe(`o:9:3#0::7::${expected}`);
    });

    it("produces the same dedupeKey across two identical runs (FNV determinism)", () => {
        const first = makeCtx({ barIndex: 4 });
        ACTIVE_RUNTIME_CONTEXT.current = first.ctx;
        buy("o:1:1#0", { qty: 3, label: "L", meta: { a: 1 } });

        const second = makeCtx({ barIndex: 4 });
        ACTIVE_RUNTIME_CONTEXT.current = second.ctx;
        buy("o:1:1#0", { qty: 3, label: "L", meta: { a: 1 } });

        expect(second.emissions.orders[0].dedupeKey).toBe(first.emissions.orders[0].dedupeKey);
    });

    it("is append-only: two same-slot same-bar orders both survive", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;

        buy("o:1:1#0", { label: "first" });
        buy("o:1:1#0", { label: "second" });

        expect(emissions.orders.map((e) => e.label)).toEqual(["first", "second"]);
        expect(ctx.pendingOrders).toHaveLength(2);
    });
});

describe("order — pending records", () => {
    it("records the accepted order with marker defaulting to true", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;

        buy("o:1:1#0", { label: "Long" });

        expect(ctx.pendingOrders).toHaveLength(1);
        expect(ctx.pendingOrders[0].marker).toBe(true);
        expect(ctx.pendingOrders[0].emission).toBe(emissions.orders[0]);
    });

    it("honours marker: false without putting it on the wire emission", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;

        buy("o:1:1#0", { marker: false });

        expect(ctx.pendingOrders[0].marker).toBe(false);
        expect("marker" in emissions.orders[0]).toBe(false);
    });

    it("treats marker: true explicitly the same as an absent marker", () => {
        const { ctx } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;

        buy("o:1:1#0", { marker: true });

        expect(ctx.pendingOrders[0].marker).toBe(true);
    });
});

describe("order — malformed opts", () => {
    for (const qty of [0, Number.NaN, -1, Number.POSITIVE_INFINITY]) {
        it(`rejects qty ${String(qty)} with malformed-emission and queues nothing`, () => {
            const { ctx, emissions } = makeCtx();
            ACTIVE_RUNTIME_CONTEXT.current = ctx;

            buy("o:1:1#0", { qty });

            expect(emissions.orders).toEqual([]);
            // A rejected intent must not reach the position tracker either.
            expect(ctx.pendingOrders).toEqual([]);
            expect(emissions.diagnostics).toHaveLength(1);
            expect(emissions.diagnostics[0].code).toBe("malformed-emission");
            expect(emissions.diagnostics[0].slotId).toBe("o:1:1#0");
            expect(emissions.diagnostics[0].bar).toBe(5);
        });
    }

    it("never clamps a malformed qty into range", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;

        buy("o:1:1#0", { qty: -5 });

        expect(emissions.orders).toEqual([]);
        expect(emissions.diagnostics[0].message).toContain("order.qty");
    });

    it("rejects a non-JSON meta payload", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;

        buy("o:1:1#0", {
            meta: { fn: (() => 1) as unknown } as Record<string, never>,
        });

        expect(emissions.orders).toEqual([]);
        expect(ctx.pendingOrders).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("malformed-emission");
    });
});

describe("order — position placeholder", () => {
    it("reads the flat placeholder off the context", () => {
        const { ctx } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;

        expect(ORDER_NAMESPACE.position()).toEqual({ size: 0, avgPrice: null, entryBar: null });
    });

    it("reflects whatever the context currently holds", () => {
        const { ctx } = makeCtx();
        ctx.orderPosition = { size: -2, avgPrice: 101.5, entryBar: 4 };
        ACTIVE_RUNTIME_CONTEXT.current = ctx;

        expect(ORDER_NAMESPACE.position()).toEqual({ size: -2, avgPrice: 101.5, entryBar: 4 });
    });
});

describe("order — outside-context sentinels", () => {
    it("throws for the bare script-facing emitter form", () => {
        const { ctx } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        expect(() => ORDER_NAMESPACE.buy()).toThrow(
            "order.buy called outside an active script step",
        );
        expect(() => ORDER_NAMESPACE.sell({ qty: 1 })).toThrow(
            "order.sell called outside an active script step",
        );
        expect(() => ORDER_NAMESPACE.close()).toThrow(
            "order.close called outside an active script step",
        );
    });

    it("throws for an injected emitter with no active context", () => {
        ACTIVE_RUNTIME_CONTEXT.current = null;
        expect(() => buy("o:1:1#0")).toThrow("order.buy called outside an active script step");
        expect(() => sell("o:1:1#0")).toThrow("order.sell called outside an active script step");
        expect(() => closeOrder("o:1:1#0")).toThrow(
            "order.close called outside an active script step",
        );
    });

    it("throws for position() with no active context", () => {
        ACTIVE_RUNTIME_CONTEXT.current = null;
        expect(() => ORDER_NAMESPACE.position()).toThrow(
            "order.position called outside an active script step",
        );
    });

    it("is frozen", () => {
        expect(Object.isFrozen(ORDER_NAMESPACE)).toBe(true);
    });
});

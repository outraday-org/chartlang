// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { defineIndicator } from "@invinite-org/chartlang-core";
import type { Bar, OrderOpts, OrderPosition, PlotOpts, Series } from "@invinite-org/chartlang-core";
import { afterEach, describe, expect, it } from "vitest";

import { createScriptRunner } from "../createScriptRunner.js";
import { ORDER_LABEL_SLOT_SUFFIX, ORDER_MARKER_SLOT_SUFFIX } from "../emit/index.js";
import { ACTIVE_RUNTIME_CONTEXT } from "../runtimeContext.js";

// The compiler injects a leading slot id at every `slot: true` callsite; the
// script-facing types hide it, so the tests alias the injected shapes.
type InjectedOrder = (slotId: string, opts?: OrderOpts) => void;
type InjectedPlot = (slotId: string, value: number | Series<number>, opts?: PlotOpts) => void;
type InjectedEma = (slotId: string, source: Series<number>, length: number) => Series<number>;
type InjectedCross = (slotId: string, a: Series<number>, b: Series<number>) => Series<boolean>;

function makeCapabilities(over: Partial<Capabilities> = {}): Capabilities {
    return {
        plots: capabilities.union(capabilities.allLines(), new Set(["arrow", "label"] as const)),
        drawings: new Set(),
        alerts: new Set(),
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
        ...over,
    };
}

function makeBar(close: number, time = close * 60_000): Bar {
    const high = close + 1;
    const low = close - 1;
    return {
        time,
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

/** The folded position as the snapshot codec sees it (flat ⇒ the field is omitted). */
function positionOf(runner: ReturnType<typeof createScriptRunner>): OrderPosition {
    const snapshot = runner.exportSnapshot();
    return snapshot?.primary.orderPosition ?? { size: 0, avgPrice: null, entryBar: null };
}

afterEach(() => {
    ACTIVE_RUNTIME_CONTEXT.current = null;
});

describe("order semantics — confirmed-step fold", () => {
    it("folds on a close and reports the position one bar later", async () => {
        // Reads happen during compute, folds after it returns, so the buy on
        // bar 2 is invisible to bar 2's own read — Pine's
        // `strategy.position_size` lag, and it needs no special case.
        const seen: number[] = [];
        const compiled = defineIndicator({
            name: "lag",
            apiVersion: 1,
            compute: ({ order }) => {
                seen.push(order.position().size);
                if (seen.length === 3) (order.buy as unknown as InjectedOrder)("lag:1:1#0");
            },
        });
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });
        for (let i = 0; i < 5; i += 1) await runner.onBarClose(makeBar(10 + i));

        expect(seen).toEqual([0, 0, 0, 1, 1]);
        expect(positionOf(runner)).toEqual({ size: 1, avgPrice: 12, entryBar: 2 });
        await runner.dispose();
    });

    it("folds on a history push, bar by bar", async () => {
        const compiled = defineIndicator({
            name: "hist",
            apiVersion: 1,
            compute: ({ bar, order }) => {
                if (bar.close.current === 11) (order.buy as unknown as InjectedOrder)("h:1:1#0");
                if (bar.close.current === 13) (order.close as unknown as InjectedOrder)("h:2:1#0");
            },
        });
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });
        await runner.onHistory([makeBar(10), makeBar(11), makeBar(12), makeBar(13)]);

        const drained = runner.drain();
        expect(drained.orders.map((o) => o.action)).toEqual(["buy", "close"]);
        // Both bars' markers survive the history accumulator (the channel that
        // is silent when missed: it would otherwise report only the last bar).
        expect(drained.plots.map((p) => `${p.slotId}@${String(p.bar)}`)).toEqual([
            `h:1:1#0${ORDER_MARKER_SLOT_SUFFIX}@1`,
            `h:2:1#0${ORDER_MARKER_SLOT_SUFFIX}@3`,
        ]);
        expect(positionOf(runner)).toEqual({ size: 0, avgPrice: null, entryBar: null });
        await runner.dispose();
    });

    it("never folds on a tick, and re-ticking the same order folds exactly once", async () => {
        // Ticks are REPLACED, not accumulated: the intent reaches the wire on
        // every tick (a host must see a live signal), but a folding tick would
        // double-apply the moment the head bar is re-ticked.
        const compiled = defineIndicator({
            name: "tick",
            apiVersion: 1,
            compute: ({ order }) => {
                (order.buy as unknown as InjectedOrder)("t:1:1#0");
            },
        });
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });

        await runner.onBarClose(makeBar(10));
        expect(runner.drain().orders).toHaveLength(1);
        expect(positionOf(runner)).toEqual({ size: 1, avgPrice: 10, entryBar: 0 });

        await runner.onBarTick(makeBar(11, 10 * 60_000));
        const firstTick = runner.drain();
        expect(firstTick.orders).toHaveLength(1);
        expect(firstTick.plots).toEqual([]);
        expect(positionOf(runner)).toEqual({ size: 1, avgPrice: 10, entryBar: 0 });

        await runner.onBarTick(makeBar(12, 10 * 60_000));
        expect(runner.drain().orders).toHaveLength(1);
        expect(positionOf(runner)).toEqual({ size: 1, avgPrice: 10, entryBar: 0 });

        await runner.dispose();
    });

    it("a runtime.error halt leaves the position where it was", async () => {
        const compiled = defineIndicator({
            name: "halt",
            apiVersion: 1,
            compute: ({ bar, order, runtime }) => {
                (order.buy as unknown as InjectedOrder)("hl:1:1#0");
                if (bar.close.current === 11) runtime.error("boom");
            },
        });
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });

        await runner.onBarClose(makeBar(10));
        runner.drain();
        expect(positionOf(runner).size).toBe(1);

        await runner.onBarClose(makeBar(11));
        const drained = runner.drain();
        expect(drained.orders).toEqual([]);
        expect(drained.plots).toEqual([]);
        expect(positionOf(runner).size).toBe(1);

        await runner.dispose();
    });

    it("a dep-errored bar folds nothing and draws no markers", async () => {
        // `clearVisualEmissions` runs AFTER the primary's compute returns, so a
        // fold that ignored `depErroredThisBar` would apply orders that never
        // reached the wire.
        const primary = defineIndicator({
            name: "primary",
            apiVersion: 1,
            compute: ({ order }) => {
                (order.buy as unknown as InjectedOrder)("dp:1:1#0", { label: "Long" });
            },
        });
        const bad = defineIndicator({
            name: "bad",
            apiVersion: 1,
            compute: ({ runtime }) => {
                runtime.error("dep down");
            },
        });
        const runner = createScriptRunner({
            compiled: Object.freeze({
                primary,
                dependencies: [{ localId: "bad", compiled: bad }],
                siblings: [],
            }),
            capabilities: makeCapabilities(),
        });

        await runner.onBarClose(makeBar(10));

        const drained = runner.drain();
        expect(drained.orders).toEqual([]);
        expect(drained.plots).toEqual([]);
        expect(drained.diagnostics.map((d) => d.code)).toContain("dep-error");
        expect(positionOf(runner)).toEqual({ size: 0, avgPrice: null, entryBar: null });
        await runner.dispose();
    });

    it("a sibling folds its OWN position and forwards prefixed markers", async () => {
        const siblingSeen: number[] = [];
        const sibling = defineIndicator({
            name: "sib",
            apiVersion: 1,
            compute: ({ order }) => {
                siblingSeen.push(order.position().size);
                (order.buy as unknown as InjectedOrder)("sb:1:1#0", { label: "S" });
            },
        });
        const primary = defineIndicator({
            name: "primary",
            apiVersion: 1,
            compute: () => undefined,
        });
        const runner = createScriptRunner({
            compiled: Object.freeze({
                primary,
                dependencies: [],
                siblings: [{ exportName: "sib", compiled: sibling }],
            }),
            capabilities: makeCapabilities(),
        });

        await runner.onBarClose(makeBar(10));
        await runner.onBarClose(makeBar(11));

        const drained = runner.drain();
        expect(siblingSeen).toEqual([0, 1]);
        expect(drained.orders.map((o) => o.slotId)).toEqual(["export:sib/sb:1:1#0"]);
        expect(drained.plots.map((p) => p.slotId)).toEqual([
            `export:sib/sb:1:1#0${ORDER_MARKER_SLOT_SUFFIX}`,
            `export:sib/sb:1:1#0${ORDER_LABEL_SLOT_SUFFIX}`,
        ]);
        // The primary never traded, so its own section stays flat.
        expect(positionOf(runner)).toEqual({ size: 0, avgPrice: null, entryBar: null });
        await runner.dispose();
    });
});

describe("order semantics — markers beside the rest of the plot pipeline", () => {
    it("leaves synthetic marker slots untouched by a real slot's plot override", async () => {
        const compiled = defineIndicator({
            name: "ovr",
            apiVersion: 1,
            compute: ({ bar, order, plot }) => {
                (plot as unknown as InjectedPlot)("ovr:1:1#0", bar.close, { title: "line" });
                (order.buy as unknown as InjectedOrder)("ovr:2:1#0", { label: "Long" });
            },
        });
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });
        runner.setPlotOverrides({ "ovr:1:1#0": { visible: false, color: "#123456" } });

        await runner.onBarClose(makeBar(10));

        const drained = runner.drain();
        const real = drained.plots.find((p) => p.slotId === "ovr:1:1#0");
        expect(real?.visible).toBe(false);
        expect(real?.color).toBe("#123456");
        for (const suffix of [ORDER_MARKER_SLOT_SUFFIX, ORDER_LABEL_SLOT_SUFFIX]) {
            const marker = drained.plots.find((p) => p.slotId === `ovr:2:1#0${suffix}`);
            expect(marker).toBeDefined();
            expect("visible" in (marker ?? {})).toBe(false);
            expect(marker?.color).not.toBe("#123456");
        }
        await runner.dispose();
    });

    it("emits no markers when the adapter declines the arrow / label kinds", async () => {
        const compiled = defineIndicator({
            name: "nomark",
            apiVersion: 1,
            compute: ({ order }) => {
                (order.buy as unknown as InjectedOrder)("nm:1:1#0", { label: "Long" });
            },
        });
        const runner = createScriptRunner({
            compiled,
            capabilities: makeCapabilities({ plots: capabilities.allLines() }),
        });

        await runner.onBarClose(makeBar(10));

        const drained = runner.drain();
        expect(drained.orders).toHaveLength(1);
        expect(drained.plots).toEqual([]);
        expect(drained.diagnostics).toEqual([]);
        expect(positionOf(runner).size).toBe(1);
        await runner.dispose();
    });

    it("replays the position from flat after an overlapping history re-seed", async () => {
        const bars = [makeBar(10), makeBar(11), makeBar(12)];
        const compiled = defineIndicator({
            name: "reseed",
            apiVersion: 1,
            compute: ({ bar, order }) => {
                if (bar.close.current === 10) (order.buy as unknown as InjectedOrder)("rs:1:1#0");
            },
        });
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });

        await runner.onHistory(bars);
        runner.drain();
        expect(positionOf(runner)).toEqual({ size: 1, avgPrice: 10, entryBar: 0 });

        // The same batch again OVERLAPS, so the runner re-seeds and replays from
        // bar 0 — the position must be re-derived, not doubled.
        await runner.onHistory(bars);
        expect(positionOf(runner)).toEqual({ size: 1, avgPrice: 10, entryBar: 0 });
        await runner.dispose();
    });
});

describe("order semantics — the RFC 0002 EMA-cross probe", () => {
    it("alternates buy / close over 30 bars, honouring marker: false", async () => {
        const positions: number[] = [];
        const compiled = defineIndicator({
            name: "ema-cross",
            apiVersion: 1,
            compute: ({ bar, order, ta }) => {
                const fast = (ta.ema as unknown as InjectedEma)("x:1:1#0", bar.close, 3);
                const slow = (ta.ema as unknown as InjectedEma)("x:1:2#0", bar.close, 8);
                const up = (ta.crossover as unknown as InjectedCross)("x:2:1#0", fast, slow);
                const down = (ta.crossunder as unknown as InjectedCross)("x:2:2#0", fast, slow);
                positions.push(order.position().size);
                if (order.position().size <= 0 && up.current) {
                    (order.buy as unknown as InjectedOrder)("x:3:1#0", { label: "Long" });
                }
                if (order.position().size > 0 && down.current) {
                    // The author draws their own exit glyph, so the courtesy
                    // marker is opted out of.
                    (order.close as unknown as InjectedOrder)("x:4:1#0", {
                        label: "Exit",
                        marker: false,
                    });
                }
            },
        });
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });

        // Down, up, down. The opening decline outlasts the slow EMA's warmup so
        // `fast < slow` is established before the first real cross; the rally
        // then crosses up (entry) and the final decline crosses back under
        // (exit). A monotone rise from bar 0 would never cross at all — both
        // EMAs leave warmup with fast already above slow.
        const closes = [
            ...Array.from({ length: 10 }, (_, i) => 20 - i),
            ...Array.from({ length: 10 }, (_, i) => 12 + i),
            ...Array.from({ length: 10 }, (_, i) => 20 - i),
        ];
        await runner.onHistory(closes.map((close, i) => makeBar(close, (i + 1) * 60_000)));

        const drained = runner.drain();
        expect(drained.orders.map((o) => o.action)).toEqual(["buy", "close"]);
        expect(drained.orders.map((o) => o.label)).toEqual(["Long", "Exit"]);

        // Only the entry drew markers; `marker: false` on the exit suppressed
        // both of its plots while the ORDER still rode the wire.
        expect(drained.plots.map((p) => p.slotId)).toEqual([
            `x:3:1#0${ORDER_MARKER_SLOT_SUFFIX}`,
            `x:3:1#0${ORDER_LABEL_SLOT_SUFFIX}`,
        ]);

        // The read lags the fold by one confirmed step: the entry bar still
        // reads flat, the bar after it reads long, and the exit bar reads long.
        const entryBar = drained.orders[0].bar;
        const exitBar = drained.orders[1].bar;
        expect(positions[entryBar]).toBe(0);
        expect(positions[entryBar + 1]).toBe(1);
        expect(positions[exitBar]).toBe(1);
        expect(positions[exitBar + 1]).toBe(0);
        expect(positionOf(runner)).toEqual({ size: 0, avgPrice: null, entryBar: null });

        await runner.dispose();
    });
});

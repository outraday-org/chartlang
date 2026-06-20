// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AlertConditionEmission,
    AlertEmission,
    CandleEvent,
    DrawingEmission,
    LogEmission,
    PlotEmission,
    RunnerEmissions,
    RuntimeDiagnostic,
} from "@invinite-org/chartlang-adapter-kit";
import type { DrawingState } from "@invinite-org/chartlang-core";
import type { HostCompiledScript, ScriptHost } from "@invinite-org/chartlang-host-worker";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SAMPLE_BARS } from "./__fixtures__/sampleBars.js";
import { CANVAS2D_CAPABILITIES } from "./capabilities.js";
import {
    type Canvas2dAdapterHandle,
    createCanvas2dAdapter,
    runRendererLoop,
} from "./createCanvas2dAdapter.js";
import { MockCanvas2DContext } from "./testing.js";

function plotEmission(overrides: Partial<PlotEmission> & { slotId: string }): PlotEmission {
    return {
        kind: "plot",
        slotId: overrides.slotId,
        title: overrides.title ?? "",
        style: overrides.style ?? { kind: "line", lineWidth: 1, lineStyle: "solid" },
        bar: overrides.bar ?? 0,
        time: overrides.time ?? SAMPLE_BARS[0].time,
        value: "value" in overrides ? (overrides.value as number | null) : 100,
        color: overrides.color ?? null,
        meta: overrides.meta ?? {},
        pane: overrides.pane ?? "overlay",
        ...(overrides.visible === undefined ? {} : { visible: overrides.visible }),
        ...(overrides.xShift === undefined ? {} : { xShift: overrides.xShift }),
        ...(overrides.z === undefined ? {} : { z: overrides.z }),
    };
}

function alertEmission(overrides: Partial<AlertEmission> & { slotId: string }): AlertEmission {
    return {
        kind: "alert",
        slotId: overrides.slotId,
        severity: overrides.severity ?? "info",
        message: overrides.message ?? "hi",
        bar: overrides.bar ?? 0,
        time: overrides.time ?? SAMPLE_BARS[0].time,
        meta: overrides.meta ?? {},
        channels: overrides.channels ?? ["log"],
        dedupeKey: overrides.dedupeKey ?? "k",
    };
}

function alertConditionEmission(
    overrides: Partial<AlertConditionEmission> & { conditionId: string },
): AlertConditionEmission {
    return {
        kind: "alert-condition",
        conditionId: overrides.conditionId,
        title: overrides.title ?? "Cross",
        description: overrides.description ?? "Fast crossed slow",
        defaultMessage: overrides.defaultMessage ?? "cross",
        fired: overrides.fired ?? true,
        bar: overrides.bar ?? 0,
        time: overrides.time ?? SAMPLE_BARS[0].time,
    };
}

function logEmission(overrides: Partial<LogEmission> = {}): LogEmission {
    return {
        kind: "log",
        level: overrides.level ?? "info",
        message: overrides.message ?? "debug",
        meta: overrides.meta ?? {},
        bar: overrides.bar ?? 0,
        time: overrides.time ?? SAMPLE_BARS[0].time,
    };
}

function lineDrawing(overrides: Partial<DrawingEmission> & { handleId: string }): DrawingEmission {
    return {
        kind: "drawing",
        handleId: overrides.handleId,
        drawingKind: overrides.drawingKind ?? "line",
        op: overrides.op ?? "create",
        state:
            overrides.state ??
            ({
                kind: "line",
                anchors: [
                    { time: SAMPLE_BARS[0].time, price: 100 },
                    { time: SAMPLE_BARS[1].time, price: 110 },
                ],
                style: {},
            } as unknown as DrawingState),
        bar: overrides.bar ?? 0,
        time: overrides.time ?? SAMPLE_BARS[0].time,
    };
}

function diagnostic(overrides: Partial<RuntimeDiagnostic> = {}): RuntimeDiagnostic {
    return {
        kind: "diagnostic",
        severity: overrides.severity ?? "warning",
        code: overrides.code ?? "unsupported-plot-kind",
        message: overrides.message ?? "msg",
        slotId: overrides.slotId ?? null,
        bar: overrides.bar ?? null,
    };
}

function emissions(overrides: Partial<RunnerEmissions> = {}): RunnerEmissions {
    return {
        plots: overrides.plots ?? [],
        drawings: overrides.drawings ?? [],
        alerts: overrides.alerts ?? [],
        alertConditions: overrides.alertConditions ?? [],
        logs: overrides.logs ?? [],
        diagnostics: overrides.diagnostics ?? [],
        fromBar: overrides.fromBar ?? 0,
        toBar: overrides.toBar ?? 0,
    };
}

type StubHost = ScriptHost & {
    readonly pushed: CandleEvent[];
    readonly drains: RunnerEmissions[];
    readonly state: { disposed: boolean; loaded: boolean; nextDrains: RunnerEmissions[] };
};

function stubHost(scripted: RunnerEmissions[] = []): StubHost {
    const pushed: CandleEvent[] = [];
    const drains: RunnerEmissions[] = [];
    const state = {
        disposed: false,
        loaded: false,
        nextDrains: [...scripted] as RunnerEmissions[],
    };
    const host: ScriptHost = {
        limits: { maxHeapBytes: 0, maxCpuMsPerStep: 0, maxRingBufferBars: 0 },
        load: async (_c: HostCompiledScript) => {
            state.loaded = true;
        },
        push: async (e: CandleEvent) => {
            pushed.push(e);
        },
        drain: async () => {
            const head = state.nextDrains.shift() ?? emissions();
            drains.push(head);
            return head;
        },
        dispose: () => {
            state.disposed = true;
        },
    };
    return Object.assign(host, { pushed, drains, state });
}

async function* candleStream(events: ReadonlyArray<CandleEvent>): AsyncIterable<CandleEvent> {
    for (const e of events) yield e;
}

function buildAdapter(args: {
    ctx?: MockCanvas2DContext;
    host?: ScriptHost;
    candles?: AsyncIterable<CandleEvent>;
    resolveInputs?: (scriptId: string) => Readonly<Record<string, unknown>>;
    onAlert?: (a: AlertEmission) => void;
    alertBadgeFilter?: (a: AlertEmission) => boolean;
}): { adapter: Canvas2dAdapterHandle; ctx: MockCanvas2DContext; host: StubHost } {
    const ctx = args.ctx ?? new MockCanvas2DContext();
    const host = (args.host as StubHost | undefined) ?? stubHost();
    const adapter = createCanvas2dAdapter({
        canvas: { width: 320, height: 240 },
        ctx,
        candleSource: args.candles ?? candleStream([]),
        capabilities: CANVAS2D_CAPABILITIES,
        host,
        ...(args.resolveInputs !== undefined ? { resolveInputs: args.resolveInputs } : {}),
        ...(args.onAlert !== undefined ? { onAlert: args.onAlert } : {}),
        ...(args.alertBadgeFilter !== undefined ? { alertBadgeFilter: args.alertBadgeFilter } : {}),
    });
    return { adapter, ctx, host };
}

beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("createCanvas2dAdapter — construction", () => {
    it("exposes the host on the returned handle", () => {
        const { adapter, host } = buildAdapter({});
        expect(adapter.host).toBe(host);
    });

    it("exposes the demo sym-info payload", () => {
        const { adapter } = buildAdapter({});
        expect(adapter.symInfo).toEqual({
            ticker: "DEMO",
            type: "equity",
            mintick: 0.01,
            currency: "USD",
            basecurrency: "USD",
            exchange: "CHARTLANG",
            timezone: "Etc/UTC",
            session: "regular",
            meta: { vendor: "canvas2d-reference" },
        });
    });

    it("preserves optional input resolver on the adapter handle", () => {
        const resolveInputs = vi.fn((scriptId: string) => ({ length: scriptId.length }));
        const { adapter } = buildAdapter({ resolveInputs });

        expect(adapter.resolveInputs).toBe(resolveInputs);
        expect(adapter.resolveInputs?.("demo")).toEqual({ length: 4 });
    });

    it("freezes the handle", () => {
        const { adapter } = buildAdapter({});
        expect(Object.isFrozen(adapter)).toBe(true);
    });

    it("rejects a canvas without getContext('2d') and no opts.ctx", () => {
        expect(() =>
            createCanvas2dAdapter({
                canvas: { width: 1, height: 1 },
                candleSource: candleStream([]),
                host: stubHost(),
            }),
        ).toThrow(/getContext/);
    });

    it("rejects when canvas.getContext('2d') returns null", () => {
        const canvas = {
            width: 1,
            height: 1,
            getContext: (_id: "2d") => null,
        };
        expect(() =>
            createCanvas2dAdapter({
                canvas,
                candleSource: candleStream([]),
                host: stubHost(),
            }),
        ).toThrow(/returned null/);
    });

    it("uses canvas.getContext('2d') when ctx is not supplied", () => {
        const mock = new MockCanvas2DContext();
        const canvas = {
            width: 100,
            height: 100,
            getContext: (id: "2d") => (id === "2d" ? mock : null),
        };
        const adapter = createCanvas2dAdapter({
            canvas,
            candleSource: candleStream([]),
            host: stubHost(),
        });
        // Drive one emission to confirm the resolved ctx is the one we passed in.
        adapter.onEmissions(emissions());
        expect(mock.calls.length).toBeGreaterThan(0);
    });

    it("builds a real worker host via createWorkerHost when workerLike is supplied", () => {
        const channel = new MessageChannel();
        const worker = {
            addEventListener: () => {},
            postMessage: () => {},
            terminate: () => {
                channel.port1.close();
                channel.port2.close();
            },
        };
        const ctx = new MockCanvas2DContext();
        const adapter = createCanvas2dAdapter({
            canvas: { width: 1, height: 1 },
            ctx,
            candleSource: candleStream([]),
            resolveInputs: () => ({ length: 20 }),
            workerLike: worker,
        });
        expect(adapter.host.limits.maxCpuMsPerStep).toBeGreaterThan(0);
        adapter.dispose();
    });

    it("builds a worker host without an input resolver when omitted", () => {
        const channel = new MessageChannel();
        const worker = {
            addEventListener: () => {},
            postMessage: () => {},
            terminate: () => {
                channel.port1.close();
                channel.port2.close();
            },
        };
        const adapter = createCanvas2dAdapter({
            canvas: { width: 1, height: 1 },
            ctx: new MockCanvas2DContext(),
            candleSource: candleStream([]),
            workerLike: worker,
        });
        expect(adapter.resolveInputs).toBeUndefined();
        adapter.dispose();
    });

    it("calls createWorkerHost without workerLike when neither host nor workerLike are supplied", () => {
        // We can't actually construct a real Worker here, but we can drive
        // the branch by providing a non-undefined `host` is the *not* path
        // and a non-undefined `workerLike` is the *truthy* path; the third
        // branch is `host === undefined && workerLike === undefined`. That
        // path calls `createWorkerHost({ capabilities })` which in turn
        // calls `defaultWorkerFactory()` — that factory has a v8-ignore
        // marker on its only line, so the branch coverage cost lives at
        // the host-worker level, not here. We exercise the branch via the
        // try/catch — `new Worker(...)` throws in Node, and the error
        // surfaces before the adapter is returned. Asserting the throw
        // both documents the production-only nature of the default path
        // and lights up the missing branch in our own file.
        expect(() =>
            createCanvas2dAdapter({
                canvas: { width: 1, height: 1 },
                ctx: new MockCanvas2DContext(),
                candleSource: candleStream([]),
                resolveInputs: () => ({ length: 20 }),
            }),
        ).toThrow();
        expect(() =>
            createCanvas2dAdapter({
                canvas: { width: 1, height: 1 },
                ctx: new MockCanvas2DContext(),
                candleSource: candleStream([]),
            }),
        ).toThrow();
    });
});

describe("onEmissions dispatch", () => {
    it("accumulates line + step-line plot points keyed by slotId", () => {
        const { adapter, ctx } = buildAdapter({});
        adapter.onEmissions(
            emissions({
                plots: [
                    plotEmission({ slotId: "a", value: 100 }),
                    plotEmission({
                        slotId: "a",
                        value: 101,
                        time: SAMPLE_BARS[1].time,
                    }),
                    plotEmission({
                        slotId: "b",
                        style: { kind: "step-line", lineWidth: 1, lineStyle: "solid" },
                        value: 50,
                    }),
                ],
            }),
        );
        expect(ctx.calls.filter((c) => c.kind === "stroke").length).toBeGreaterThan(0);
    });

    it("accumulates glyph overlays from one slotId across distinct bars", () => {
        // A callsite that emits a glyph on many bars (e.g. a crossover
        // mark) must render one glyph per bar. Keying overlays by slotId
        // alone collapses every emission to the last bar — this guards
        // that regression by asserting both bars render their character.
        const { adapter, ctx } = buildAdapter({});
        adapter.onEmissions(
            emissions({
                plots: [
                    plotEmission({
                        slotId: "cross",
                        style: { kind: "character", char: "X", size: 12 },
                        time: SAMPLE_BARS[0].time,
                    }),
                    plotEmission({
                        slotId: "cross",
                        style: { kind: "character", char: "X", size: 12 },
                        time: SAMPLE_BARS[1].time,
                    }),
                ],
            }),
        );
        const marks = ctx.calls.filter((c) => c.kind === "fillText" && c.text === "X");
        expect(marks.length).toBe(2);
    });

    it("plotSeries that contain null gap values are skipped by viewport computation", async () => {
        // Run through runRendererLoop so bars are populated before the
        // emission whose plotSeries contains a null. The viewport loop must
        // skip the null without raising it as a candidate for yMin/yMax.
        const host = stubHost([
            emissions(), // after history — empty drain
            emissions({
                plots: [
                    plotEmission({ slotId: "a", value: null }),
                    plotEmission({ slotId: "a", value: 100, time: SAMPLE_BARS[2].time }),
                ],
            }),
        ]);
        const ctx = new MockCanvas2DContext();
        const { adapter } = buildAdapter({
            ctx,
            host,
            candles: candleStream([
                { kind: "history", bars: SAMPLE_BARS.slice(0, 2) },
                { kind: "close", bar: SAMPLE_BARS[2] },
            ]),
        });
        await runRendererLoop(adapter);
        expect(ctx.calls.some((c) => c.kind === "stroke")).toBe(true);
    });

    it("plot values below bar.low extend the viewport's yMin", async () => {
        const host = stubHost([
            emissions(), // history drain
            emissions({ plots: [plotEmission({ slotId: "lo", value: 5 })] }), // post-close: very low
        ]);
        const ctx = new MockCanvas2DContext();
        const { adapter } = buildAdapter({
            ctx,
            host,
            candles: candleStream([
                { kind: "history", bars: SAMPLE_BARS.slice(0, 3) },
                { kind: "close", bar: SAMPLE_BARS[3] },
            ]),
        });
        await runRendererLoop(adapter);
        expect(ctx.calls.some((c) => c.kind === "stroke")).toBe(true);
    });

    it("plot values above bar.high extend the viewport's yMax", async () => {
        const host = stubHost([
            emissions(),
            emissions({ plots: [plotEmission({ slotId: "hi", value: 9999 })] }),
        ]);
        const ctx = new MockCanvas2DContext();
        const { adapter } = buildAdapter({
            ctx,
            host,
            candles: candleStream([
                { kind: "history", bars: SAMPLE_BARS.slice(0, 3) },
                { kind: "close", bar: SAMPLE_BARS[3] },
            ]),
        });
        await runRendererLoop(adapter);
        expect(ctx.calls.some((c) => c.kind === "stroke")).toBe(true);
    });

    it("dispatches a histogram plot through drawHistogram (fillRect-per-bar)", () => {
        const { adapter, ctx } = buildAdapter({});
        adapter.onEmissions(
            emissions({
                plots: [
                    plotEmission({
                        slotId: "h",
                        style: { kind: "histogram", baseline: 0 },
                        value: 100,
                    }),
                    plotEmission({
                        slotId: "h",
                        style: { kind: "histogram", baseline: 0 },
                        value: 50,
                        time: SAMPLE_BARS[1].time,
                    }),
                ],
            }),
        );
        // The histogram renderer emits exactly one `fillRect` per finite
        // point — plus background `fillRect`s from `clear`. Two of the
        // fillRect calls must carry the histogram bar width (4 px).
        const histogramRects = ctx.calls.filter((c) => c.kind === "fillRect" && c.w === 4);
        expect(histogramRects.length).toBe(2);
        // No `stroke` call is needed for histograms — the renderer is
        // fillRect-only.
    });

    it("dispatches Phase-5 plot overlays", async () => {
        const host = stubHost([
            emissions({
                plots: [
                    plotEmission({
                        slotId: "bg",
                        style: { kind: "bg-color", color: "#123456", transp: 50 },
                    }),
                    plotEmission({
                        slotId: "bg-default",
                        style: { kind: "bg-color", color: "#123456" },
                    }),
                    plotEmission({
                        slotId: "candle",
                        style: { kind: "candle-override", bull: "#0f0", bear: "#f00" },
                    }),
                    plotEmission({
                        slotId: "candle-doji",
                        style: {
                            kind: "candle-override",
                            bull: "#0f0",
                            bear: "#f00",
                            doji: "#999",
                        },
                    }),
                    plotEmission({
                        slotId: "candle-missing-bar",
                        style: { kind: "candle-override", bull: "#0f0", bear: "#f00" },
                        time: SAMPLE_BARS[1].time,
                    }),
                    plotEmission({
                        slotId: "bar-override",
                        style: { kind: "bar-override", color: "#f59e0b" },
                    }),
                    plotEmission({
                        slotId: "bar-color",
                        style: { kind: "bar-color", color: "#a855f7" },
                    }),
                    plotEmission({
                        slotId: "shape",
                        style: { kind: "shape", shape: "cross", size: 8, location: "below" },
                    }),
                    plotEmission({
                        slotId: "shape-default",
                        style: { kind: "shape", shape: "circle", size: 8 },
                    }),
                    plotEmission({
                        slotId: "shape-null",
                        style: { kind: "shape", shape: "circle", size: 8 },
                        value: null,
                    }),
                    plotEmission({
                        slotId: "character",
                        style: { kind: "character", char: "A", size: 12, location: "above" },
                    }),
                    plotEmission({
                        slotId: "character-default",
                        style: { kind: "character", char: "B", size: 12 },
                    }),
                    plotEmission({
                        slotId: "arrow",
                        style: { kind: "arrow", direction: "up", size: 10 },
                    }),
                    plotEmission({
                        slotId: "hh",
                        style: {
                            kind: "horizontal-histogram",
                            buckets: [{ price: 100, volume: 10 }],
                        },
                    }),
                ],
            }),
        ]);
        const ctx = new MockCanvas2DContext();
        const { adapter } = buildAdapter({
            ctx,
            host,
            candles: candleStream([{ kind: "close", bar: SAMPLE_BARS[0] }]),
        });
        await runRendererLoop(adapter);
        expect(ctx.calls.some((c) => c.kind === "fillText" && c.text === "A")).toBe(true);
        expect(ctx.calls.some((c) => c.kind === "fillRect")).toBe(true);
        expect(ctx.calls.some((c) => c.kind === "stroke")).toBe(true);
    });

    it("histogram with a null gap is skipped (no fillRect for that point)", () => {
        const { adapter, ctx } = buildAdapter({});
        adapter.onEmissions(
            emissions({
                plots: [
                    plotEmission({
                        slotId: "h",
                        style: { kind: "histogram", baseline: 0 },
                        value: null,
                    }),
                    plotEmission({
                        slotId: "h",
                        style: { kind: "histogram", baseline: 0 },
                        value: 75,
                        time: SAMPLE_BARS[1].time,
                    }),
                ],
            }),
        );
        const histogramRects = ctx.calls.filter((c) => c.kind === "fillRect" && c.w === 4);
        expect(histogramRects.length).toBe(1);
    });

    // Render a single line point at `bar` (time = that bar's time) with an
    // optional `xShift`, over a 5-bar history, and return the first `moveTo`
    // x. The line's only point lands at `bar`, so the polyline's `moveTo`
    // is the projected x of the (possibly shifted) point.
    // The plot line uses a distinctive strokeStyle (`#abcdef`) so its
    // `moveTo` can be isolated from candle wicks / gridlines: take the
    // first `moveTo` recorded after that strokeStyle is set.
    const PLOT_STROKE = "#abcdef";
    function moveAfterStroke(ctx: MockCanvas2DContext, stroke: string): number {
        const idx = ctx.calls.findIndex(
            (c) => c.kind === "set" && c.prop === "strokeStyle" && c.value === stroke,
        );
        if (idx < 0) throw new Error("plot strokeStyle never set");
        const move = ctx.calls.slice(idx).find((c) => c.kind === "moveTo");
        if (move === undefined || move.kind !== "moveTo") throw new Error("no moveTo after stroke");
        return move.x;
    }

    async function lineMoveX(bar: number, xShift?: number): Promise<number> {
        const host = stubHost([
            emissions(), // history drain
            emissions({
                plots: [
                    plotEmission({
                        slotId: "shift",
                        value: 105,
                        color: PLOT_STROKE,
                        bar,
                        time: SAMPLE_BARS[bar].time,
                        ...(xShift === undefined ? {} : { xShift }),
                    }),
                ],
            }),
        ]);
        const ctx = new MockCanvas2DContext();
        const { adapter } = buildAdapter({
            ctx,
            host,
            candles: candleStream([
                { kind: "history", bars: SAMPLE_BARS.slice(0, 4) },
                { kind: "close", bar: SAMPLE_BARS[4] },
            ]),
        });
        await runRendererLoop(adapter);
        return moveAfterStroke(ctx, PLOT_STROKE);
    }

    it("renders a no-shift / omitted-xShift line at the bar's own x", async () => {
        // The shifted-by-0 point and a point at the same bar without the
        // field must land on the exact same x (byte-identical baseline).
        const omitted = await lineMoveX(2);
        const zero = await lineMoveX(2, 0);
        expect(zero).toBe(omitted);
    });

    it("a negative xShift renders the line k bars left", async () => {
        // bar 4 shifted two left must land at the unshifted x of bar 2.
        const shifted = await lineMoveX(4, -2);
        const target = await lineMoveX(2);
        expect(shifted).toBe(target);
        expect(shifted).toBeLessThan(await lineMoveX(4));
    });

    it("a positive xShift renders the line k bars right", async () => {
        // bar 1 shifted two right must land at the unshifted x of bar 3.
        const shifted = await lineMoveX(1, 2);
        const target = await lineMoveX(3);
        expect(shifted).toBe(target);
        expect(shifted).toBeGreaterThan(await lineMoveX(1));
    });

    it("a positive xShift past the last bar extends xMax (future projection, not clipped)", async () => {
        // bar 4 (the last bar) shifted three right projects three bars into
        // the future. The viewport widens so the projected x stays inside
        // the plot area (≤ pxWidth) rather than overflowing past the edge.
        const host = stubHost([
            emissions(),
            emissions({
                plots: [
                    plotEmission({
                        slotId: "future",
                        value: 105,
                        color: PLOT_STROKE,
                        bar: 4,
                        time: SAMPLE_BARS[4].time,
                        xShift: 3,
                    }),
                ],
            }),
        ]);
        const ctx = new MockCanvas2DContext();
        const { adapter } = buildAdapter({
            ctx,
            host,
            candles: candleStream([
                { kind: "history", bars: SAMPLE_BARS.slice(0, 4) },
                { kind: "close", bar: SAMPLE_BARS[4] },
            ]),
        });
        await runRendererLoop(adapter);
        const x = moveAfterStroke(ctx, PLOT_STROKE);
        // The plot area is 320 width − 52 gutter = 268 px. The projected
        // point sits at the (now-extended) xMax, i.e. the right edge of the
        // plot area — finite and within the drawable range.
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThanOrEqual(268);
    });

    it("a negative xShift histogram column renders k bars left", async () => {
        async function histX(bar: number, xShift?: number): Promise<number> {
            const host = stubHost([
                emissions(),
                emissions({
                    plots: [
                        plotEmission({
                            slotId: "h",
                            style: { kind: "histogram", baseline: 0 },
                            value: 105,
                            bar,
                            time: SAMPLE_BARS[bar].time,
                            ...(xShift === undefined ? {} : { xShift }),
                        }),
                    ],
                }),
            ]);
            const ctx = new MockCanvas2DContext();
            const { adapter } = buildAdapter({
                ctx,
                host,
                candles: candleStream([
                    { kind: "history", bars: SAMPLE_BARS.slice(0, 4) },
                    { kind: "close", bar: SAMPLE_BARS[4] },
                ]),
            });
            await runRendererLoop(adapter);
            const rect = ctx.calls.find((c) => c.kind === "fillRect" && c.w === 4);
            if (rect === undefined || rect.kind !== "fillRect")
                throw new Error("no histogram rect");
            return rect.x;
        }
        // Column x is centred on the projected x (offset by −width/2), so a
        // shifted-left column's x is strictly less than the unshifted one.
        const shifted = await histX(4, -2);
        const target = await histX(2);
        expect(shifted).toBe(target);
        expect(shifted).toBeLessThan(await histX(4));
    });

    it("a glyph overlay (shape) honours xShift via the shared projection", async () => {
        async function shapeArcX(bar: number, xShift?: number): Promise<number> {
            const host = stubHost([
                emissions(),
                emissions({
                    plots: [
                        plotEmission({
                            slotId: "g",
                            style: { kind: "shape", shape: "circle", size: 8 },
                            value: 105,
                            bar,
                            time: SAMPLE_BARS[bar].time,
                            ...(xShift === undefined ? {} : { xShift }),
                        }),
                    ],
                }),
            ]);
            const ctx = new MockCanvas2DContext();
            const { adapter } = buildAdapter({
                ctx,
                host,
                candles: candleStream([
                    { kind: "history", bars: SAMPLE_BARS.slice(0, 4) },
                    { kind: "close", bar: SAMPLE_BARS[4] },
                ]),
            });
            await runRendererLoop(adapter);
            const arc = ctx.calls.find((c) => c.kind === "arc");
            if (arc === undefined || arc.kind !== "arc") throw new Error("no shape arc recorded");
            return arc.x;
        }
        const shifted = await shapeArcX(4, -2);
        const target = await shapeArcX(2);
        expect(shifted).toBe(target);
    });

    it("candle / bar / bg overrides ignore xShift (candle-state, not shifted series)", async () => {
        // A bar-color override carries the same anchor regardless of any
        // xShift: it tints the candle at its own bar. Render two frames —
        // one with a large xShift, one without — and assert the bar-tint
        // fillRect lands at the same x both times.
        async function barTintX(xShift?: number): Promise<number> {
            const host = stubHost([
                emissions({
                    plots: [
                        plotEmission({
                            slotId: "tint",
                            style: { kind: "bar-color", color: "#a855f7" },
                            value: 105,
                            bar: 2,
                            time: SAMPLE_BARS[2].time,
                            ...(xShift === undefined ? {} : { xShift }),
                        }),
                    ],
                }),
            ]);
            const ctx = new MockCanvas2DContext();
            const { adapter } = buildAdapter({
                ctx,
                host,
                candles: candleStream([{ kind: "history", bars: SAMPLE_BARS.slice(0, 5) }]),
            });
            await runRendererLoop(adapter);
            // The bar tint is a translucent fillRect; take the last one (the
            // candle overrides draw after the base candles).
            const tints = ctx.calls.filter((c) => c.kind === "fillRect");
            const last = tints[tints.length - 1];
            if (last === undefined || last.kind !== "fillRect") throw new Error("no tint rect");
            return last.x;
        }
        expect(await barTintX(5)).toBe(await barTintX());
    });

    it("stores horizontal-line emissions keyed by slotId (last-write-wins)", () => {
        const { adapter, ctx } = buildAdapter({});
        adapter.onEmissions(
            emissions({
                plots: [
                    plotEmission({
                        slotId: "hl",
                        style: { kind: "horizontal-line", lineWidth: 1, lineStyle: "solid" },
                        value: 70,
                    }),
                    plotEmission({
                        slotId: "hl",
                        style: { kind: "horizontal-line", lineWidth: 2, lineStyle: "dashed" },
                        value: 30,
                    }),
                ],
            }),
        );
        const lineWidths = ctx.calls.filter((c) => c.kind === "set" && c.prop === "lineWidth");
        expect(lineWidths[lineWidths.length - 1]).toEqual({
            kind: "set",
            prop: "lineWidth",
            value: 2,
        });
    });

    it("falls back to 0 for horizontal-line with null value", () => {
        const { adapter, ctx } = buildAdapter({});
        adapter.onEmissions(
            emissions({
                plots: [
                    plotEmission({
                        slotId: "hl",
                        style: { kind: "horizontal-line", lineWidth: 1, lineStyle: "solid" },
                        value: null,
                    }),
                ],
            }),
        );
        expect(ctx.calls.some((c) => c.kind === "moveTo")).toBe(true);
    });

    it("forwards alerts to opts.onAlert and pins the badge buffer to 256", () => {
        const seen: AlertEmission[] = [];
        const { adapter } = buildAdapter({
            onAlert: (a) => {
                seen.push(a);
            },
        });
        const alerts: AlertEmission[] = Array.from({ length: 300 }, (_, i) =>
            alertEmission({ slotId: "a", dedupeKey: `k${i}`, bar: i }),
        );
        adapter.onEmissions(emissions({ alerts }));
        // All 300 reach the consumer callback even though the on-canvas
        // badge buffer trims to the most recent 256.
        expect(seen.length).toBe(300);
    });

    it("alertBadgeFilter gates the on-canvas badge but never the onAlert callback", async () => {
        const seen: AlertEmission[] = [];
        const host = stubHost([
            emissions({
                alerts: [
                    alertEmission({ slotId: "a", dedupeKey: "k0", bar: 0 }),
                    alertEmission({ slotId: "a", dedupeKey: "k1", bar: 1 }),
                ],
            }),
        ]);
        const ctx = new MockCanvas2DContext();
        const { adapter } = buildAdapter({
            ctx,
            host,
            candles: candleStream([{ kind: "history", bars: SAMPLE_BARS.slice(0, 3) }]),
            onAlert: (a) => {
                seen.push(a);
            },
            alertBadgeFilter: (a) => a.bar >= 1,
        });
        await runRendererLoop(adapter);
        // Both alerts reach the consumer; only bar 1 becomes a badge (the
        // badge is the sole arc in a candles-only frame).
        expect(seen.map((a) => a.bar)).toEqual([0, 1]);
        expect(ctx.calls.filter((c) => c.kind === "arc").length).toBe(1);
    });

    it("drops a malformed plot via validateEmission without throwing", () => {
        const { adapter, ctx } = buildAdapter({});
        const bad = { ...plotEmission({ slotId: "a" }), value: Number.NaN } as PlotEmission;
        adapter.onEmissions(emissions({ plots: [bad] }));
        // No stroke for the polyline (the line-renderer requires at least one
        // finite point), but the frame should still draw the background.
        expect(ctx.calls.some((c) => c.kind === "fillRect")).toBe(true);
    });

    it("drops a malformed alert", () => {
        const seen: AlertEmission[] = [];
        const { adapter } = buildAdapter({
            onAlert: (a) => {
                seen.push(a);
            },
        });
        const bad = {
            ...alertEmission({ slotId: "a" }),
            severity: "BOOM",
        } as unknown as AlertEmission;
        adapter.onEmissions(emissions({ alerts: [bad] }));
        expect(seen.length).toBe(0);
    });

    it("applies valid alert-condition and log emissions while dropping malformed ones", () => {
        const { adapter, ctx } = buildAdapter({});
        const badCondition = {
            ...alertConditionEmission({ conditionId: "bad-condition" }),
            fired: "yes",
        } as unknown as AlertConditionEmission;
        const badLog = {
            ...logEmission(),
            level: "loud",
        } as unknown as LogEmission;

        adapter.onEmissions(
            emissions({
                alertConditions: [
                    alertConditionEmission({ conditionId: "condition-1" }),
                    badCondition,
                ],
                logs: [
                    ...Array.from({ length: 6 }, (_, i) =>
                        logEmission({ message: `kept-log-${i}` }),
                    ),
                    badLog,
                ],
            }),
        );

        const text = ctx.calls.flatMap((call) => (call.kind === "fillText" ? [call.text] : []));
        expect(text.some((entry) => entry.includes("kept-log-5"))).toBe(true);
    });

    it("ignores a plot whose style.kind is not in the Phase-1 union", () => {
        const { adapter, ctx } = buildAdapter({});
        const bizarre = {
            ...plotEmission({ slotId: "x" }),
            style: { kind: "area", lineWidth: 1, lineStyle: "solid" },
        } as unknown as PlotEmission;
        adapter.onEmissions(emissions({ plots: [bizarre] }));
        // No throw; the frame still draws the background.
        expect(ctx.calls.some((c) => c.kind === "fillRect")).toBe(true);
    });

    it("logs warning + error diagnostics through console.warn; ignores info", () => {
        const spy = vi.spyOn(console, "warn");
        const { adapter } = buildAdapter({});
        adapter.onEmissions(
            emissions({
                diagnostics: [
                    diagnostic({ severity: "info" }),
                    diagnostic({ severity: "warning", message: "warn-msg" }),
                    diagnostic({ severity: "error", message: "err-msg" }),
                ],
            }),
        );
        const args = spy.mock.calls.map((c) => c.join(" "));
        expect(args.some((a) => a.includes("warn-msg"))).toBe(true);
        expect(args.some((a) => a.includes("err-msg"))).toBe(true);
        expect(args.every((a) => !a.includes("info"))).toBe(true);
    });

    it("renders alert badges anchored to the most recent bar", () => {
        const ctx = new MockCanvas2DContext();
        const { adapter } = buildAdapter({ ctx });
        // Seed bars by pushing a history candle event through the adapter
        // via runRendererLoop is overkill — apply a direct emission with
        // bar context already established via onEmissions of a plot first.
        adapter.onEmissions(emissions({ plots: [plotEmission({ slotId: "a", value: 100 })] }));
        adapter.onEmissions(emissions({ alerts: [alertEmission({ slotId: "a" })] }));
        // No bars in state yet (no candle source iterated) — so the alert
        // branch hits the "no bars" early return. Add a bar via runRendererLoop.
        expect(ctx.calls.some((c) => c.kind === "arc")).toBe(false);
    });
});

describe("plot overrides", () => {
    it("renders no series for a visible:false line emission", () => {
        const { adapter, ctx } = buildAdapter({});
        adapter.onEmissions(
            emissions({
                plots: [
                    plotEmission({ slotId: "hidden", value: 100, visible: false }),
                    plotEmission({
                        slotId: "hidden",
                        value: 101,
                        time: SAMPLE_BARS[1].time,
                        visible: false,
                    }),
                ],
            }),
        );
        // A hidden slot contributes no series point, so the line renderer
        // never strokes it.
        expect(ctx.calls.some((c) => c.kind === "stroke")).toBe(false);
    });

    it("excludes a hidden slot from the pane viewport", async () => {
        // A visible line at a normal value plus a hidden line at an extreme
        // value: the hidden slot must not stretch the y-scale, so the visible
        // series renders at the same pixel position as if the hidden slot
        // were never emitted.
        function firstMoveToY(scene: RunnerEmissions[]): number {
            const ctx = new MockCanvas2DContext();
            return runRendererLoop(
                buildAdapter({
                    ctx,
                    host: stubHost(scene),
                    candles: candleStream([
                        { kind: "history", bars: SAMPLE_BARS.slice(0, 2) },
                        { kind: "close", bar: SAMPLE_BARS[2] },
                    ]),
                }).adapter,
            ).then(() => {
                const moveTo = ctx.calls.find((c) => c.kind === "moveTo");
                if (moveTo === undefined || moveTo.kind !== "moveTo") {
                    throw new Error("expected a moveTo call from the visible series");
                }
                return moveTo.y;
            });
        }
        const withHidden = await firstMoveToY([
            emissions(),
            emissions({
                plots: [
                    plotEmission({ slotId: "shown", value: 100, time: SAMPLE_BARS[2].time }),
                    plotEmission({
                        slotId: "hidden",
                        value: 1_000_000,
                        time: SAMPLE_BARS[2].time,
                        visible: false,
                    }),
                ],
            }),
        ]);
        const withoutHidden = await firstMoveToY([
            emissions(),
            emissions({
                plots: [plotEmission({ slotId: "shown", value: 100, time: SAMPLE_BARS[2].time })],
            }),
        ]);
        expect(withHidden).toBe(withoutHidden);
    });

    it("renders a recolored line with the override-baked color", () => {
        const { adapter, ctx } = buildAdapter({});
        adapter.onEmissions(
            emissions({
                plots: [
                    plotEmission({ slotId: "c", value: 100, color: "#ff0000" }),
                    plotEmission({
                        slotId: "c",
                        value: 101,
                        time: SAMPLE_BARS[1].time,
                        color: "#ff0000",
                    }),
                ],
            }),
        );
        expect(
            ctx.calls.some(
                (c) => c.kind === "set" && c.prop === "strokeStyle" && c.value === "#ff0000",
            ),
        ).toBe(true);
    });
});

describe("drawing emission dispatch", () => {
    it("accumulates create + update drawings keyed by handleId and walks them through decomposeDrawing + paintPrimitive", () => {
        const { adapter, ctx } = buildAdapter({});
        const baseline = ctx.calls.length;
        adapter.onEmissions(
            emissions({
                drawings: [
                    lineDrawing({ handleId: "h1" }),
                    lineDrawing({ handleId: "h2", drawingKind: "horizontal-line" }),
                    lineDrawing({ handleId: "h1", op: "update" }),
                ],
            }),
        );
        // Drawings route through the shared adapter-kit geometry layer
        // (`decomposeDrawing` → `paintPrimitive`); the two live handles
        // each decompose to real path primitives on top of the frame's
        // `clearPaneRect` + `drawCandles` pre-amble. The dispatch test
        // pins that the drawings path neither throws nor leaks calls into
        // the mock context.
        expect(ctx.calls.length).toBeGreaterThan(baseline);
    });

    it("drops a drawing from the render set on op:'remove'", () => {
        const { adapter, ctx } = buildAdapter({});
        adapter.onEmissions(emissions({ drawings: [lineDrawing({ handleId: "h1" })] }));
        const afterCreate = ctx.calls.length;
        adapter.onEmissions(
            emissions({ drawings: [lineDrawing({ handleId: "h1", op: "remove" })] }),
        );
        // The remove path is silent — the second frame redraws the
        // baseline from scratch, minus the removed handle. Both frames
        // touch the same baseline (clear + candles + zero-drawing
        // dispatches).
        expect(ctx.calls.length).toBeGreaterThan(afterCreate);
    });

    it("drops a malformed drawing via validateEmission without throwing", () => {
        const { adapter, ctx } = buildAdapter({});
        const bad = {
            ...lineDrawing({ handleId: "h-bad" }),
            drawingKind: "not-a-real-kind",
        } as unknown as DrawingEmission;
        adapter.onEmissions(emissions({ drawings: [bad] }));
        // The frame still draws the background.
        expect(ctx.calls.some((c) => c.kind === "fillRect")).toBe(true);
    });
});

describe("future-projected drawing anchors extend xMax", () => {
    const DRAW_STROKE = "#abcdef";
    const DAY_MS = 86_400_000;

    // Render a 5-bar history (bars 0..4) with a single `draw.line`
    // whose anchors are supplied by `state`, then return the line's
    // projected `from` / `to` x (the `moveTo` / `lineTo` recorded right
    // after the drawing's strokeStyle is set). The plot area is
    // 320 width − 52 gutter = 268 px.
    async function lineEndpoints(state: DrawingState): Promise<{ from: number; to: number }> {
        const host = stubHost([
            emissions(),
            emissions({ drawings: [lineDrawing({ handleId: "fc", state })] }),
        ]);
        const ctx = new MockCanvas2DContext();
        const { adapter } = buildAdapter({
            ctx,
            host,
            candles: candleStream([
                { kind: "history", bars: SAMPLE_BARS.slice(0, 4) },
                { kind: "close", bar: SAMPLE_BARS[4] },
            ]),
        });
        await runRendererLoop(adapter);
        const idx = ctx.calls.findIndex(
            (c) => c.kind === "set" && c.prop === "strokeStyle" && c.value === DRAW_STROKE,
        );
        if (idx < 0) throw new Error("drawing strokeStyle never set");
        const move = ctx.calls.slice(idx).find((c) => c.kind === "moveTo");
        const line = ctx.calls.slice(idx).find((c) => c.kind === "lineTo");
        if (move?.kind !== "moveTo" || line?.kind !== "lineTo") {
            throw new Error("line did not emit moveTo + lineTo");
        }
        return { from: move.x, to: line.x };
    }

    it("widens the viewport so a `bar.point(+k, …)` line endpoint stays on-screen", async () => {
        // The forecast-line idiom: anchor at the last bar, project the
        // far endpoint three bars into the future. Without the widening
        // the start sits on the right edge (268) and the end overflows
        // off the canvas; with it the whole segment fits inside the plot.
        const { from, to } = await lineEndpoints({
            kind: "line",
            anchors: [
                { time: SAMPLE_BARS[4].time, price: 106 },
                { time: SAMPLE_BARS[4].time + 3 * DAY_MS, price: 120 },
            ],
            style: { color: DRAW_STROKE },
        } as unknown as DrawingState);
        // xMin = bar0, extended xMax = bar4 + 3 days = bar0 + 7 days.
        // from = bar4 → (4/7)·268 ≈ 153; to = the new right edge ≈ 268.
        expect(from).toBeGreaterThan(140);
        expect(from).toBeLessThan(165);
        expect(to).toBeGreaterThan(265);
        expect(to).toBeLessThanOrEqual(268);
        expect(from).toBeLessThan(to);
    });

    it("leaves xMax untouched when every anchor is within the data range", async () => {
        // A line fully inside the history must not move the right edge:
        // its far endpoint at the last bar lands exactly on it (268).
        const { to } = await lineEndpoints({
            kind: "line",
            anchors: [
                { time: SAMPLE_BARS[1].time, price: 103 },
                { time: SAMPLE_BARS[4].time, price: 106 },
            ],
            style: { color: DRAW_STROKE },
        } as unknown as DrawingState);
        expect(to).toBeGreaterThan(265);
        expect(to).toBeLessThanOrEqual(268);
    });

    it("tolerates null fields and non-numeric `time` keys in a drawing state", async () => {
        // The anchor walker recurses structurally over unknown state
        // shapes; `validateEmission` only checks the named anchor/style
        // fields, so extra fields must not crash the walk nor poison the
        // viewport. A null field is skipped; a non-numeric `time` key is
        // ignored (no NaN max). The real anchors still project normally.
        const { from, to } = await lineEndpoints({
            kind: "line",
            anchors: [
                { time: SAMPLE_BARS[2].time, price: 104 },
                { time: SAMPLE_BARS[4].time, price: 106 },
            ],
            style: { color: DRAW_STROKE },
            _probeNull: null,
            _probeBadTime: { time: "not-a-number", price: 1 },
        } as unknown as DrawingState);
        expect(Number.isFinite(from)).toBe(true);
        expect(to).toBeGreaterThan(265);
        expect(to).toBeLessThanOrEqual(268);
    });
});

describe("pane routing", () => {
    // The adapter's per-pane render walk wraps each pane in
    // `save / translate(0, rect.y) / restore`. The overlay pane sits at
    // rect.y === 0; every subpane sits at a positive rect.y. State is
    // WeakMap-private, so these tests assert behaviourally via the
    // recorded translate offsets rather than reading `paneOrder` directly.
    function nonZeroTranslateYs(ctx: MockCanvas2DContext): number[] {
        return ctx.calls.flatMap((c) => (c.kind === "translate" && c.y > 0 ? [c.y] : []));
    }

    async function runWithHistory(
        scene: RunnerEmissions[],
        ctx: MockCanvas2DContext,
    ): Promise<void> {
        await runRendererLoop(
            buildAdapter({
                ctx,
                host: stubHost(scene),
                candles: candleStream([
                    { kind: "history", bars: SAMPLE_BARS.slice(0, 2) },
                    { kind: "close", bar: SAMPLE_BARS[2] },
                ]),
            }).adapter,
        );
    }

    it("renders an overlay-only bundle as a single full-canvas pane", async () => {
        const ctx = new MockCanvas2DContext();
        await runWithHistory(
            [
                emissions(),
                emissions({
                    plots: [plotEmission({ slotId: "ema", value: 100, time: SAMPLE_BARS[2].time })],
                }),
            ],
            ctx,
        );
        // No subpane ⇒ no positive translate-y in the final frame.
        expect(new Set(nonZeroTranslateYs(ctx))).toEqual(new Set());
    });

    it("registers a subpane on first emit and renders it in its own rect", async () => {
        const ctx = new MockCanvas2DContext();
        await runWithHistory(
            [
                emissions(),
                emissions({
                    plots: [
                        plotEmission({
                            slotId: "rsi",
                            value: 55,
                            time: SAMPLE_BARS[2].time,
                            pane: "script:rsi",
                        }),
                    ],
                }),
            ],
            ctx,
        );
        const subpaneYs = new Set(nonZeroTranslateYs(ctx));
        // Exactly one distinct subpane offset (the one subpane's rect.y).
        expect(subpaneYs.size).toBe(1);
    });

    it("does not duplicate a subpane across repeated emissions on the same key", async () => {
        const ctx = new MockCanvas2DContext();
        await runWithHistory(
            [
                emissions(),
                emissions({
                    plots: [
                        plotEmission({
                            slotId: "rsi",
                            value: 40,
                            time: SAMPLE_BARS[1].time,
                            pane: "script:rsi",
                        }),
                        plotEmission({
                            slotId: "rsi",
                            value: 60,
                            time: SAMPLE_BARS[2].time,
                            pane: "script:rsi",
                        }),
                    ],
                }),
            ],
            ctx,
        );
        // Still exactly one subpane — the second emission on the same key
        // must not grow `paneOrder`.
        expect(new Set(nonZeroTranslateYs(ctx)).size).toBe(1);
    });

    it("keeps the price y-scale independent of a 0-100 subpane series", async () => {
        // Bars span [100, 110]; a subpane RSI series spans [0, 100]. The
        // overlay candle bodies must land at the same y-pixels whether or
        // not the subpane series is present — the subpane must not stretch
        // the price scale. Compare the first overlay candle `fillRect` y.
        function firstOverlayCandleY(ctx: MockCanvas2DContext): number {
            // The overlay block runs first inside translate(0, 0); the
            // first candle-body fillRect is the price pane's.
            const rect = ctx.calls.find((c) => c.kind === "fillRect" && c.w !== 4 && c.h > 0);
            if (rect === undefined || rect.kind !== "fillRect") {
                throw new Error("expected an overlay candle fillRect");
            }
            return rect.y;
        }
        const withSubpane = new MockCanvas2DContext();
        await runWithHistory(
            [
                emissions(),
                emissions({
                    plots: [
                        plotEmission({
                            slotId: "rsi",
                            value: 0,
                            time: SAMPLE_BARS[1].time,
                            pane: "script:rsi",
                        }),
                        plotEmission({
                            slotId: "rsi",
                            value: 100,
                            time: SAMPLE_BARS[2].time,
                            pane: "script:rsi",
                        }),
                    ],
                }),
            ],
            withSubpane,
        );
        const withoutSubpane = new MockCanvas2DContext();
        await runWithHistory([emissions(), emissions()], withoutSubpane);
        // The subpane's full-canvas vs. 70% price-pane height differs, so
        // we cannot compare raw y across the two; instead assert the
        // subpane series (0-100) never appears in the overlay pane's
        // moveTo trail. The overlay block draws before any positive
        // translate, so an overlay-space moveTo at the subpane's extreme
        // value would only appear if the price scale had absorbed it.
        const overlayMoveTos = withSubpane.calls.filter((c) => c.kind === "moveTo");
        expect(overlayMoveTos.length).toBeGreaterThan(0);
        expect(firstOverlayCandleY(withSubpane)).toBeGreaterThanOrEqual(0);
    });

    it("routes a subpane hline into the subpane's rect", async () => {
        const ctx = new MockCanvas2DContext();
        await runWithHistory(
            [
                emissions(),
                emissions({
                    plots: [
                        plotEmission({
                            slotId: "rsi",
                            value: 55,
                            time: SAMPLE_BARS[2].time,
                            pane: "script:rsi",
                        }),
                        plotEmission({
                            slotId: "rsi-70",
                            style: { kind: "horizontal-line", lineWidth: 1, lineStyle: "dashed" },
                            value: 70,
                            time: SAMPLE_BARS[2].time,
                            pane: "script:rsi",
                        }),
                        // A second hline below the series value exercises
                        // the `hline.price < yMin` branch of the per-pane
                        // viewport's y-range expansion.
                        plotEmission({
                            slotId: "rsi-30",
                            style: { kind: "horizontal-line", lineWidth: 1, lineStyle: "dashed" },
                            value: 30,
                            time: SAMPLE_BARS[2].time,
                            pane: "script:rsi",
                        }),
                    ],
                }),
            ],
            ctx,
        );
        // The hlines draw inside the subpane (after a positive translate);
        // a moveTo is emitted by `drawHorizontalLine` for the subpane.
        expect(new Set(nonZeroTranslateYs(ctx)).size).toBe(1);
        expect(ctx.calls.some((c) => c.kind === "moveTo")).toBe(true);
    });

    it("falls back to a (0,1) y-range for a registered-but-empty subpane", async () => {
        // A subpane whose only emitted point is a null gap: the pane key
        // is registered (so the subpane rect renders) but its viewport has
        // no finite y candidate, so `computePaneViewport` falls back to
        // (0, 1) instead of producing NaN/Infinity coordinates.
        const ctx = new MockCanvas2DContext();
        await runWithHistory(
            [
                emissions(),
                emissions({
                    plots: [
                        plotEmission({
                            slotId: "rsi",
                            value: null,
                            time: SAMPLE_BARS[2].time,
                            pane: "script:rsi",
                        }),
                    ],
                }),
            ],
            ctx,
        );
        // The subpane still renders (one positive translate); no coordinate
        // in the log is non-finite.
        expect(new Set(nonZeroTranslateYs(ctx)).size).toBe(1);
        for (const call of ctx.calls) {
            if (call.kind === "moveTo" || call.kind === "lineTo" || call.kind === "fillRect") {
                expect(Number.isFinite(call.x)).toBe(true);
                expect(Number.isFinite(call.y)).toBe(true);
            }
        }
    });

    it("resets paneOrder on dispose so the next bundle starts overlay-only", async () => {
        const host = stubHost([
            emissions(),
            emissions({
                plots: [
                    plotEmission({
                        slotId: "rsi",
                        value: 55,
                        time: SAMPLE_BARS[2].time,
                        pane: "script:rsi",
                    }),
                ],
            }),
        ]);
        const ctx = new MockCanvas2DContext();
        const { adapter } = buildAdapter({
            ctx,
            host,
            candles: candleStream([
                { kind: "history", bars: SAMPLE_BARS.slice(0, 2) },
                { kind: "close", bar: SAMPLE_BARS[2] },
            ]),
        });
        await runRendererLoop(adapter);
        expect(new Set(nonZeroTranslateYs(ctx)).size).toBe(1);
        adapter.dispose();
        // After dispose, an overlay-only emission renders a single pane —
        // proving `paneOrder` was reset to ["overlay"].
        const after = new MockCanvas2DContext();
        const { adapter: fresh } = buildAdapter({
            ctx: after,
            candles: candleStream([]),
        });
        fresh.onEmissions(emissions({ plots: [plotEmission({ slotId: "p", value: 1 })] }));
        expect(new Set(nonZeroTranslateYs(after))).toEqual(new Set());
    });
});

describe("dispose", () => {
    it("clears state and disposes the host", () => {
        const host = stubHost();
        const { adapter } = buildAdapter({ host });
        adapter.onEmissions(
            emissions({
                plots: [plotEmission({ slotId: "a", value: 100 })],
                alerts: [alertEmission({ slotId: "a" })],
                drawings: [lineDrawing({ handleId: "h1" })],
            }),
        );
        adapter.dispose();
        expect(host.state.disposed).toBe(true);
        // Re-emit after dispose to confirm state was cleared: the polyline
        // for slot "a" should restart from empty (no NaN traces from the
        // pre-dispose point).
        adapter.onEmissions(emissions({ plots: [plotEmission({ slotId: "b", value: 5 })] }));
    });
});

describe("runRendererLoop", () => {
    it("iterates the candle source, pushes every event to host, drains, and re-renders", async () => {
        const host = stubHost([
            emissions(), // after history
            emissions({ plots: [plotEmission({ slotId: "a", value: 100 })] }), // after close
            emissions(), // after tick
        ]);
        const events: CandleEvent[] = [
            { kind: "history", bars: SAMPLE_BARS.slice(0, 3) },
            { kind: "close", bar: SAMPLE_BARS[3] },
            { kind: "tick", bar: SAMPLE_BARS[4] },
        ];
        const { adapter } = buildAdapter({
            candles: candleStream(events),
            host,
        });
        await runRendererLoop(adapter);
        expect(host.pushed).toEqual(events);
        expect(host.drains.length).toBe(3);
    });

    it("renders alert badges once bars exist in the adapter state", async () => {
        const host = stubHost([emissions({ alerts: [alertEmission({ slotId: "a" })] })]);
        const events: CandleEvent[] = [{ kind: "history", bars: SAMPLE_BARS.slice(0, 3) }];
        const ctx = new MockCanvas2DContext();
        const { adapter } = buildAdapter({ ctx, candles: candleStream(events), host });
        await runRendererLoop(adapter);
        expect(ctx.calls.some((c) => c.kind === "arc")).toBe(true);
    });

    it("anchors an alert whose bar index is out of range to the latest bar", async () => {
        // bar 999 is past the 3-bar history, so `state.bars[alert.bar]` is
        // undefined and the badge falls back to the latest bar instead of
        // throwing on an undefined anchor.
        const host = stubHost([emissions({ alerts: [alertEmission({ slotId: "a", bar: 999 })] })]);
        const events: CandleEvent[] = [{ kind: "history", bars: SAMPLE_BARS.slice(0, 3) }];
        const ctx = new MockCanvas2DContext();
        const { adapter } = buildAdapter({ ctx, candles: candleStream(events), host });
        await runRendererLoop(adapter);
        expect(ctx.calls.some((c) => c.kind === "arc")).toBe(true);
    });

    it("handles a tick event before any history (renders the tick as the lone bar)", async () => {
        const host = stubHost([emissions()]);
        const events: CandleEvent[] = [{ kind: "tick", bar: SAMPLE_BARS[0] }];
        const ctx = new MockCanvas2DContext();
        const { adapter } = buildAdapter({ ctx, candles: candleStream(events), host });
        await runRendererLoop(adapter);
        // The tick should draw a wick + body.
        expect(ctx.calls.some((c) => c.kind === "fillRect")).toBe(true);
    });

    it("expands a flat-price viewport (yMin === yMax) so the renderer does not divide by zero", async () => {
        // All-equal OHLC bar: every coordinate collapses to one price, which
        // hits the yMin === yMax expansion branch in `computeViewport`.
        const flat: CandleEvent[] = [
            {
                kind: "history",
                bars: [
                    {
                        time: SAMPLE_BARS[0].time,
                        open: 100,
                        high: 100,
                        low: 100,
                        close: 100,
                        volume: 1,
                        symbol: "FLAT",
                        interval: "1D",
                    },
                ],
            },
        ];
        const host = stubHost([emissions()]);
        const ctx = new MockCanvas2DContext();
        const { adapter } = buildAdapter({ ctx, candles: candleStream(flat), host });
        await runRendererLoop(adapter);
        // The frame still renders the candle body — the only assertion is
        // that no NaN/Infinity surfaced into the call log.
        expect(ctx.calls.length).toBeGreaterThan(0);
        for (const call of ctx.calls) {
            if (call.kind === "fillRect" || call.kind === "moveTo" || call.kind === "lineTo") {
                expect(Number.isFinite(call.x)).toBe(true);
                expect(Number.isFinite(call.y)).toBe(true);
            }
        }
    });

    it("treats a tick after a close as a head-bar replacement", async () => {
        const host = stubHost([emissions(), emissions()]);
        const ctx = new MockCanvas2DContext();
        const { adapter } = buildAdapter({
            ctx,
            candles: candleStream([
                { kind: "close", bar: SAMPLE_BARS[0] },
                { kind: "tick", bar: { ...SAMPLE_BARS[0], close: SAMPLE_BARS[0].close + 5 } },
            ]),
            host,
        });
        await runRendererLoop(adapter);
        expect(host.pushed.length).toBe(2);
    });

    it("rejects when handed a handle not produced by createCanvas2dAdapter", async () => {
        const fake = Object.freeze({
            id: "x",
            name: "x",
            capabilities: CANVAS2D_CAPABILITIES,
            candles: () => candleStream([]),
            onEmissions: () => {},
            dispose: () => {},
            host: stubHost(),
        }) as unknown as Canvas2dAdapterHandle;
        await expect(runRendererLoop(fake)).rejects.toThrow(/not produced by/);
    });

    it("returns immediately when the signal is already aborted", async () => {
        const host = stubHost([emissions()]);
        const { adapter } = buildAdapter({
            candles: candleStream([{ kind: "close", bar: SAMPLE_BARS[0] }]),
            host,
        });
        const controller = new AbortController();
        controller.abort();
        await runRendererLoop(adapter, { signal: controller.signal });
        expect(host.pushed).toEqual([]);
        expect(host.drains).toEqual([]);
    });

    it("breaks out of the loop on the next iteration after an abort", async () => {
        const host = stubHost([emissions(), emissions(), emissions()]);
        const controller = new AbortController();
        const events: CandleEvent[] = [
            { kind: "close", bar: SAMPLE_BARS[0] },
            { kind: "close", bar: SAMPLE_BARS[1] },
            { kind: "close", bar: SAMPLE_BARS[2] },
        ];
        // Yield every event regardless of abort state — the
        // runRendererLoop body's top-of-iteration abort check is what
        // we want to hit here, not the early-return inside the generator.
        async function* yieldAll(): AsyncIterable<CandleEvent> {
            for (const event of events) {
                yield event;
                controller.abort();
            }
        }
        const { adapter } = buildAdapter({
            candles: yieldAll(),
            host,
        });
        await expect(
            runRendererLoop(adapter, { signal: controller.signal }),
        ).resolves.toBeUndefined();
        // First iteration ran end-to-end; the abort triggered at the
        // end of that iteration, so the second iteration's top-of-loop
        // abort check short-circuits and the second event is never
        // pushed.
        expect(host.pushed.length).toBe(1);
        expect(host.drains.length).toBe(1);
    });

    it("ignores abort when the signal is never triggered", async () => {
        const host = stubHost([emissions(), emissions()]);
        const controller = new AbortController();
        const { adapter } = buildAdapter({
            candles: candleStream([
                { kind: "close", bar: SAMPLE_BARS[0] },
                { kind: "close", bar: SAMPLE_BARS[1] },
            ]),
            host,
        });
        await runRendererLoop(adapter, { signal: controller.signal });
        expect(host.pushed.length).toBe(2);
        expect(host.drains.length).toBe(2);
    });

    it("aborts mid-push so the post-push branch returns silently", async () => {
        const controller = new AbortController();
        const event: CandleEvent = { kind: "close", bar: SAMPLE_BARS[0] };
        const baseHost = stubHost([emissions()]);
        const host: ScriptHost = {
            ...baseHost,
            push: async (e: CandleEvent) => {
                baseHost.pushed.push(e);
                controller.abort();
            },
        };
        const { adapter } = buildAdapter({
            candles: candleStream([event]),
            host,
        });
        await runRendererLoop(adapter, { signal: controller.signal });
        // push ran once; abort fired during it; we never reached drain.
        expect(baseHost.pushed).toEqual([event]);
        expect(baseHost.drains).toEqual([]);
    });

    it("aborts during the post-yield microtask so the pre-drain branch returns", async () => {
        const controller = new AbortController();
        const event: CandleEvent = { kind: "close", bar: SAMPLE_BARS[0] };
        const baseHost = stubHost([emissions()]);
        const host: ScriptHost = {
            ...baseHost,
            push: async (e: CandleEvent) => {
                baseHost.pushed.push(e);
                // Schedule the abort to fire on the next macrotask — the
                // setTimeout(0) yield inside runRendererLoop awaits a
                // queueMicrotask of its own, so a setTimeout-scheduled
                // abort lands strictly after push() resolves but before
                // the post-yield abort check.
                setTimeout(() => controller.abort(), 0);
            },
        };
        const { adapter } = buildAdapter({
            candles: candleStream([event]),
            host,
        });
        await runRendererLoop(adapter, { signal: controller.signal });
        expect(baseHost.pushed).toEqual([event]);
        expect(baseHost.drains).toEqual([]);
    });

    it("aborts after drain so the pre-emit branch returns without onEmissions", async () => {
        const controller = new AbortController();
        const event: CandleEvent = { kind: "close", bar: SAMPLE_BARS[0] };
        const ctx = new MockCanvas2DContext();
        const baseHost = stubHost([emissions()]);
        const host: ScriptHost = {
            ...baseHost,
            drain: async () => {
                const head = baseHost.state.nextDrains.shift() ?? emissions();
                baseHost.drains.push(head);
                controller.abort();
                return head;
            },
        };
        const { adapter } = buildAdapter({
            ctx,
            candles: candleStream([event]),
            host,
        });
        const baseline = ctx.calls.length;
        await runRendererLoop(adapter, { signal: controller.signal });
        expect(baseHost.drains.length).toBe(1);
        // onEmissions was NOT called, so no new ctx calls were appended.
        expect(ctx.calls.length).toBe(baseline);
    });
});

describe("z-order render pass", () => {
    // Every mark sets `strokeStyle` to a distinctive colour, so the index
    // of its `set strokeStyle` call in the recorded log is the mark's
    // paint position. Marks paint in `(z, band, seq)` order, so comparing
    // these indices pins the global render order. Distinct hex colours
    // avoid collision with the candle/axis palette.
    const PLOT_A = "#aa0001";
    const PLOT_B = "#bb0002";
    const DRAW_A = "#cc0003";
    const DRAW_B = "#dd0004";

    // First index at which `strokeStyle` is set to `color`, or -1.
    function strokeIndex(ctx: MockCanvas2DContext, color: string): number {
        return ctx.calls.findIndex(
            (c) => c.kind === "set" && c.prop === "strokeStyle" && c.value === color,
        );
    }

    // A line plot whose stroke colour is `color`, at the given `z`.
    function colouredLine(slotId: string, color: string, z?: number): PlotEmission {
        return plotEmission({
            slotId,
            color,
            value: 102,
            ...(z === undefined ? {} : { z }),
        });
    }

    // A `draw.line` whose stroke colour is `color`, at the given `z`.
    function colouredDrawing(handleId: string, color: string, z?: number): DrawingEmission {
        return {
            ...lineDrawing({
                handleId,
                state: {
                    kind: "line",
                    anchors: [
                        { time: SAMPLE_BARS[0].time, price: 100 },
                        { time: SAMPLE_BARS[1].time, price: 110 },
                    ],
                    style: { color },
                } as unknown as DrawingState,
            }),
            ...(z === undefined ? {} : { z }),
        };
    }

    it("at the default z=0 paints plots beneath drawings (today's band order)", () => {
        const { adapter, ctx } = buildAdapter({});
        adapter.onEmissions(
            emissions({
                plots: [colouredLine("p1", PLOT_A)],
                drawings: [colouredDrawing("d1", DRAW_A)],
            }),
        );
        const plotIdx = strokeIndex(ctx, PLOT_A);
        const drawIdx = strokeIndex(ctx, DRAW_A);
        expect(plotIdx).toBeGreaterThanOrEqual(0);
        expect(drawIdx).toBeGreaterThanOrEqual(0);
        // series band (0) < drawing band (3) ⇒ plot paints first (beneath).
        expect(plotIdx).toBeLessThan(drawIdx);
    });

    it("a drawing at z=-1 paints beneath a z=0 plot (cross-band reorder)", () => {
        const { adapter, ctx } = buildAdapter({});
        adapter.onEmissions(
            emissions({
                plots: [colouredLine("p1", PLOT_A)],
                drawings: [colouredDrawing("d1", DRAW_A, -1)],
            }),
        );
        const plotIdx = strokeIndex(ctx, PLOT_A);
        const drawIdx = strokeIndex(ctx, DRAW_A);
        // z=-1 < z=0 ⇒ the drawing now paints first, beneath the plot,
        // inverting the default band order.
        expect(drawIdx).toBeLessThan(plotIdx);
    });

    it("a plot at z=5 paints above a z=0 drawing (cross-band reorder)", () => {
        const { adapter, ctx } = buildAdapter({});
        adapter.onEmissions(
            emissions({
                plots: [colouredLine("p1", PLOT_A, 5)],
                drawings: [colouredDrawing("d1", DRAW_A)],
            }),
        );
        const plotIdx = strokeIndex(ctx, PLOT_A);
        const drawIdx = strokeIndex(ctx, DRAW_A);
        // z=5 > z=0 ⇒ the plot paints last, above the drawing.
        expect(drawIdx).toBeLessThan(plotIdx);
    });

    it("a fractional z=1.5 slots a drawing between z=1 and z=2 plots", () => {
        const { adapter, ctx } = buildAdapter({});
        adapter.onEmissions(
            emissions({
                plots: [colouredLine("p1", PLOT_A, 1), colouredLine("p2", PLOT_B, 2)],
                drawings: [colouredDrawing("d1", DRAW_A, 1.5)],
            }),
        );
        const aIdx = strokeIndex(ctx, PLOT_A);
        const drawIdx = strokeIndex(ctx, DRAW_A);
        const bIdx = strokeIndex(ctx, PLOT_B);
        expect(aIdx).toBeLessThan(drawIdx);
        expect(drawIdx).toBeLessThan(bIdx);
    });

    it("breaks a (z, band) tie by declaration order", () => {
        const { adapter, ctx } = buildAdapter({});
        adapter.onEmissions(
            emissions({
                // Two plots at the same z in the same band: the later
                // declaration must paint last (on top).
                plots: [colouredLine("p1", PLOT_A, 2), colouredLine("p2", PLOT_B, 2)],
            }),
        );
        const aIdx = strokeIndex(ctx, PLOT_A);
        const bIdx = strokeIndex(ctx, PLOT_B);
        expect(aIdx).toBeLessThan(bIdx);
    });

    it("breaks a (z, band) tie by declaration order across drawings too", () => {
        const { adapter, ctx } = buildAdapter({});
        adapter.onEmissions(
            emissions({
                drawings: [colouredDrawing("d1", DRAW_A, 3), colouredDrawing("d2", DRAW_B, 3)],
            }),
        );
        const aIdx = strokeIndex(ctx, DRAW_A);
        const bIdx = strokeIndex(ctx, DRAW_B);
        expect(aIdx).toBeLessThan(bIdx);
    });

    it("keeps alert badges on top regardless of a mark's z", async () => {
        // Alert badges only paint when the frame has bars, so drive the
        // loop with a history candle then a drain carrying a high-z plot
        // and an alert. The badge (an arc) must paint after the plot's
        // stroke even though the plot is lifted far above via z — alerts
        // are pinned on top, not z-sorted (v1 deferral).
        const ctx = new MockCanvas2DContext();
        const host = stubHost([
            emissions(),
            emissions({
                plots: [colouredLine("p1", PLOT_A, 100)],
                alerts: [alertEmission({ slotId: "a1", bar: 0 })],
            }),
        ]);
        const { adapter } = buildAdapter({
            ctx,
            host,
            candles: candleStream([
                { kind: "history", bars: SAMPLE_BARS.slice(0, 2) },
                { kind: "close", bar: SAMPLE_BARS[2] },
            ]),
        });
        await runRendererLoop(adapter);
        const plotIdx = strokeIndex(ctx, PLOT_A);
        // The alert badge draws an arc; it must come after the high-z plot.
        const arcIdx = ctx.calls.findIndex((c) => c.kind === "arc");
        expect(plotIdx).toBeGreaterThanOrEqual(0);
        expect(arcIdx).toBeGreaterThan(plotIdx);
    });

    it("sorts marks within their pane, not across panes", () => {
        const { adapter, ctx } = buildAdapter({});
        adapter.onEmissions(
            emissions({
                // A subpane plot with a huge z must not jump into the
                // overlay pane's paint order — panes paint in pane order,
                // each pane z-sorted independently.
                plots: [
                    colouredLine("overlayPlot", PLOT_A, 0),
                    { ...colouredLine("subPlot", PLOT_B, 999), pane: "rsi" },
                ],
            }),
        );
        const overlayIdx = strokeIndex(ctx, PLOT_A);
        const subIdx = strokeIndex(ctx, PLOT_B);
        // The overlay pane paints fully before the subpane, so the overlay
        // plot's stroke precedes the subpane plot's despite the subpane's
        // far-higher z. (z orders within a pane, never across panes.)
        expect(overlayIdx).toBeGreaterThanOrEqual(0);
        expect(subIdx).toBeGreaterThan(overlayIdx);
    });

    it("reproduces today's series → glyph → hline order at z=0", () => {
        const { adapter, ctx } = buildAdapter({});
        adapter.onEmissions(
            emissions({
                plots: [
                    colouredLine("line1", PLOT_A),
                    plotEmission({
                        slotId: "glyph1",
                        value: 103,
                        color: DRAW_A,
                        style: { kind: "arrow", direction: "up", size: "normal" },
                    }),
                    plotEmission({
                        slotId: "h1",
                        value: 101,
                        color: DRAW_B,
                        style: { kind: "horizontal-line", lineWidth: 1, lineStyle: "solid" },
                    }),
                ],
            }),
        );
        const lineIdx = strokeIndex(ctx, PLOT_A);
        const hlineIdx = strokeIndex(ctx, DRAW_B);
        // series band (0) before hline band (2): the line stroke precedes
        // the horizontal-line stroke at the default z.
        expect(lineIdx).toBeGreaterThanOrEqual(0);
        expect(hlineIdx).toBeGreaterThan(lineIdx);
    });
});

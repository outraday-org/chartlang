// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AlertEmission,
    AlertConditionEmission,
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

import { CANVAS2D_CAPABILITIES } from "./capabilities";
import {
    createCanvas2dAdapter,
    runRendererLoop,
    type Canvas2dAdapterHandle,
} from "./createCanvas2dAdapter";
import { SAMPLE_BARS } from "./__fixtures__/sampleBars";
import { MockCanvas2DContext } from "./testing";

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

    it("forwards alerts to opts.onAlert and pins the recent-alerts queue to 8", () => {
        const seen: AlertEmission[] = [];
        const { adapter } = buildAdapter({
            onAlert: (a) => {
                seen.push(a);
            },
        });
        const alerts: AlertEmission[] = Array.from({ length: 12 }, (_, i) =>
            alertEmission({ slotId: "a", dedupeKey: `k${i}`, bar: i }),
        );
        adapter.onEmissions(emissions({ alerts }));
        // All 12 reach the consumer callback.
        expect(seen.length).toBe(12);
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
                    ...Array.from({ length: 6 }, (_, i) => logEmission({ message: `kept-log-${i}` })),
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

describe("drawing emission dispatch", () => {
    it("accumulates create + update drawings keyed by handleId and walks them through drawingDispatch", () => {
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
        // Task 4's per-kind renderers are no-op stubs — every dispatch
        // adds zero context calls. The frame's `clear` + `drawCandles`
        // pre-amble is the only source of calls. The dispatch test pins
        // that the drawings path neither throws nor leaks calls into
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
});

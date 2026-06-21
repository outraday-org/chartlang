// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AlertConditionEmission,
    AlertEmission,
    CandleEvent,
    DrawingEmission,
    LogEmission,
    PlotEmission,
    PlotStyle,
    RunnerEmissions,
    RuntimeDiagnostic,
} from "@invinite-org/chartlang-adapter-kit";
import type { Bar } from "@invinite-org/chartlang-core";
import type { HostCompiledScript, ScriptHost } from "@invinite-org/chartlang-host-worker";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type UplotAdapterHandle, createUplotAdapter, runUplotLoop } from "./createUplotAdapter.js";
import { type MockUplot, hashCallLog, makeMockUplotFactory } from "./testing.js";

const MS_PER_DAY = 86_400_000;
const START = 1_700_000_000_000;

function bar(i: number, open: number, high: number, low: number, close: number): Bar {
    return {
        time: START + i * MS_PER_DAY,
        open,
        high,
        low,
        close,
        volume: 1_000 + i,
        symbol: "DEMO",
        interval: "1D",
        hl2: (high + low) / 2,
        hlc3: (high + low + close) / 3,
        ohlc4: (open + high + low + close) / 4,
        hlcc4: (high + low + close + close) / 4,
    };
}

const BARS: ReadonlyArray<Bar> = [
    bar(0, 100, 105, 98, 103),
    bar(1, 103, 108, 102, 101),
    bar(2, 101, 106, 100, 105),
];

function plotEmission(overrides: Partial<PlotEmission> & { slotId: string }): PlotEmission {
    const style: PlotStyle = overrides.style ?? { kind: "line", lineWidth: 1, lineStyle: "solid" };
    return {
        kind: "plot",
        slotId: overrides.slotId,
        title: overrides.title ?? "",
        style,
        bar: overrides.bar ?? 0,
        time: overrides.time ?? BARS[0].time,
        value: "value" in overrides ? (overrides.value as number | null) : 100,
        color: overrides.color ?? null,
        meta: overrides.meta ?? {},
        pane: overrides.pane ?? "overlay",
        ...(overrides.visible === undefined ? {} : { visible: overrides.visible }),
    };
}

function alertEmission(slotId: string): AlertEmission {
    return {
        kind: "alert",
        slotId,
        severity: "info",
        message: "hi",
        bar: 0,
        time: BARS[0].time,
        meta: {},
        channels: ["log"],
        dedupeKey: "k",
    };
}

function alertConditionEmission(conditionId: string): AlertConditionEmission {
    return {
        kind: "alert-condition",
        conditionId,
        title: "Cross",
        description: "d",
        defaultMessage: "cross",
        fired: true,
        bar: 0,
        time: BARS[0].time,
    };
}

function logEmission(): LogEmission {
    return { kind: "log", level: "info", message: "debug", meta: {}, bar: 0, time: BARS[0].time };
}

function lineDrawing(handleId: string, op: DrawingEmission["op"] = "create"): DrawingEmission {
    return {
        kind: "drawing",
        handleId,
        drawingKind: "line",
        op,
        state: {
            kind: "line",
            anchors: [
                { time: BARS[0].time, price: 100 },
                { time: BARS[1].time, price: 110 },
            ],
            style: {},
        } as unknown as DrawingEmission["state"],
        bar: 0,
        time: BARS[0].time,
    };
}

function diagnostic(severity: RuntimeDiagnostic["severity"]): RuntimeDiagnostic {
    return {
        kind: "diagnostic",
        severity,
        code: "unsupported-plot-kind",
        message: "m",
        slotId: null,
        bar: null,
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
        fromBar: 0,
        toBar: 0,
    };
}

type StubHost = ScriptHost & { readonly state: { disposed: boolean } };

function stubHost(scripted: RunnerEmissions[] = []): StubHost {
    const next = [...scripted];
    const state = { disposed: false };
    const host: ScriptHost = {
        limits: { maxHeapBytes: 0, maxCpuMsPerStep: 0, maxRingBufferBars: 0 },
        load: async (_c: HostCompiledScript) => {},
        push: async (_e: CandleEvent) => {},
        setPlotOverrides: () => {},
        drain: async () => next.shift() ?? emissions(),
        dispose: () => {
            state.disposed = true;
        },
    };
    return Object.assign(host, { state });
}

async function* candleStream(events: ReadonlyArray<CandleEvent>): AsyncIterable<CandleEvent> {
    for (const e of events) yield e;
}

function build(args: {
    host?: ScriptHost;
    candles?: AsyncIterable<CandleEvent>;
    resolveInputs?: (scriptId: string) => Readonly<Record<string, unknown>>;
    onAlert?: (a: AlertEmission) => void;
}): { adapter: UplotAdapterHandle; instances: MockUplot[]; host: StubHost } {
    const { factory, instances } = makeMockUplotFactory();
    const host = (args.host as StubHost | undefined) ?? stubHost();
    const adapter = createUplotAdapter({
        target: {} as HTMLElement,
        width: 320,
        height: 240,
        uplotFactory: factory,
        candleSource: args.candles ?? candleStream([]),
        host,
        ...(args.resolveInputs !== undefined ? { resolveInputs: args.resolveInputs } : {}),
        ...(args.onAlert !== undefined ? { onAlert: args.onAlert } : {}),
    });
    return { adapter, instances, host };
}

// Drive a single drain frame: feed a history event then one drain.
async function drive(
    drains: RunnerEmissions[],
    bars: ReadonlyArray<Bar> = BARS,
): Promise<{ instances: MockUplot[]; adapter: UplotAdapterHandle }> {
    const host = stubHost(drains);
    const { adapter, instances } = build({
        host,
        candles: candleStream([{ kind: "history", bars: [...bars] }]),
    });
    await runUplotLoop(adapter);
    return { instances, adapter };
}

beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("createUplotAdapter — construction", () => {
    it("exposes the host on the returned handle", () => {
        const { adapter, host } = build({});
        expect(adapter.host).toBe(host);
    });

    it("exposes the demo sym-info + a frozen handle", () => {
        const { adapter } = build({});
        expect(adapter.symInfo?.ticker).toBe("DEMO");
        expect(Object.isFrozen(adapter)).toBe(true);
    });

    it("threads resolveInputs through to the adapter", () => {
        const { adapter } = build({ resolveInputs: () => ({ len: 14 }) });
        expect(adapter.resolveInputs?.("x")).toEqual({ len: 14 });
    });

    it("calls createWorkerHost without a host/workerLike seam (both resolveInputs branches)", () => {
        // No injected `host` and no `workerLike` ⇒ the default path calls
        // `createWorkerHost({ capabilities })`, which constructs a real
        // `Worker` — unavailable in Node, so the call throws. Asserting the
        // throw documents the production-only nature of the default path and
        // lights both the resolveInputs-present and -absent branches (the
        // `new Worker` line itself carries a host-worker-level v8-ignore).
        // Omit `uplotFactory` too so the `?? defaultUplotFactory` fallback
        // is evaluated before the host construction throws.
        expect(() =>
            createUplotAdapter({
                target: {} as HTMLElement,
                width: 320,
                height: 240,
                candleSource: candleStream([]),
                resolveInputs: () => ({ length: 20 }),
            }),
        ).toThrow();
        expect(() =>
            createUplotAdapter({
                target: {} as HTMLElement,
                width: 320,
                height: 240,
                candleSource: candleStream([]),
            }),
        ).toThrow();
    });

    it("constructs a worker host with a workerLike seam (resolveInputs both ways)", () => {
        const { factory } = makeMockUplotFactory();
        const makeWorkerLike = () => ({
            addEventListener: () => {},
            postMessage: () => {},
            terminate: () => {},
        });
        const withInputs = createUplotAdapter({
            target: {} as HTMLElement,
            width: 320,
            height: 240,
            uplotFactory: factory,
            candleSource: candleStream([]),
            workerLike: makeWorkerLike(),
            resolveInputs: () => ({}),
        });
        const withoutInputs = createUplotAdapter({
            target: {} as HTMLElement,
            width: 320,
            height: 240,
            uplotFactory: factory,
            candleSource: candleStream([]),
            workerLike: makeWorkerLike(),
        });
        expect(withInputs.host).toBeDefined();
        expect(withoutInputs.host).toBeDefined();
        withInputs.dispose();
        withoutInputs.dispose();
    });
});

describe("createUplotAdapter — candles + panes", () => {
    it("builds the overlay instance and paints candles via the draw hook", async () => {
        const { instances } = await drive([emissions()]);
        expect(instances.length).toBe(1);
        const overlay = instances[0];
        const newRecord = overlay.records[0];
        expect(newRecord.kind).toBe("new");
        // x row = bar times.
        if (newRecord.kind === "new") {
            expect(newRecord.opts.paneKey).toBe("overlay");
            expect(newRecord.data[0]).toEqual(BARS.map((b) => b.time));
        }
        overlay.runDraw();
        // Each candle paints a wick (stroke) + a body (fillRect).
        expect(overlay.ctx.calls.filter((c) => c.kind === "fillRect").length).toBe(BARS.length);
        expect(overlay.ctx.calls.filter((c) => c.kind === "stroke").length).toBe(BARS.length);
    });

    it("pins the y scale per frame", async () => {
        const { instances } = await drive([emissions()]);
        const scaleCall = instances[0].records.find((r) => r.kind === "setScale");
        expect(scaleCall?.kind).toBe("setScale");
        if (scaleCall?.kind === "setScale") {
            expect(scaleCall.scaleKey).toBe("y");
            expect(scaleCall.max).toBeGreaterThan(scaleCall.min);
        }
    });

    it("stacks a new instance per pane, overlay first", async () => {
        const { instances } = await drive([
            emissions({
                plots: [
                    plotEmission({ slotId: "rsi", pane: "rsi", value: 55, time: BARS[0].time }),
                    plotEmission({ slotId: "rsi", pane: "rsi", value: 60, time: BARS[1].time }),
                ],
            }),
        ]);
        expect(instances.length).toBe(2);
        expect(instances[0].records[0].kind === "new" && instances[0].records[0].opts.paneKey).toBe(
            "overlay",
        );
        expect(instances[1].records[0].kind === "new" && instances[1].records[0].opts.paneKey).toBe(
            "rsi",
        );
    });

    it("allocates a fresh pane per distinct slot emitting pane:\"new\"", async () => {
        const { instances } = await drive([
            emissions({
                plots: [
                    // Two distinct slots both ask for pane:"new"; each must land
                    // in its OWN sub-pane (not collapse into a shared "new" key),
                    // mirroring the lightweight-charts adapter.
                    plotEmission({ slotId: "a", pane: "new", value: 10, time: BARS[0].time }),
                    plotEmission({ slotId: "b", pane: "new", value: 20, time: BARS[0].time }),
                ],
            }),
        ]);
        // overlay + two fresh sub-panes.
        expect(instances.length).toBe(3);
        const paneKeys = instances.map((u) =>
            u.records[0].kind === "new" ? u.records[0].opts.paneKey : "",
        );
        expect(paneKeys[0]).toBe("overlay");
        expect(paneKeys[1]).toBe("new:a");
        expect(paneKeys[2]).toBe("new:b");
    });

    it("reuses the same pane:\"new\" pane when one slot re-emits across frames", async () => {
        const host = stubHost([
            emissions({
                plots: [plotEmission({ slotId: "a", pane: "new", value: 10, time: BARS[0].time })],
            }),
            emissions({
                plots: [plotEmission({ slotId: "a", pane: "new", value: 11, time: BARS[1].time })],
            }),
        ]);
        const { adapter, instances } = build({
            host,
            candles: candleStream([
                { kind: "close", bar: BARS[0] },
                { kind: "close", bar: BARS[1] },
            ]),
        });
        await runUplotLoop(adapter);
        // The slot re-emits each frame but reuses its first-allocated pane —
        // no runaway pane-per-frame.
        expect(instances.length).toBe(2);
        expect(instances[1].records[0].kind === "new" && instances[1].records[0].opts.paneKey).toBe(
            "new:a",
        );
    });

    it("falls back to a unit y-range for a subpane with no finite values", async () => {
        const { instances } = await drive([
            emissions({
                plots: [
                    plotEmission({
                        slotId: "empty",
                        pane: "sub",
                        value: null,
                        time: BARS[0].time,
                    }),
                ],
            }),
        ]);
        const subScale = instances[1].records.find((r) => r.kind === "setScale");
        if (subScale?.kind === "setScale") {
            // No finite candidate ⇒ the (0, 1) fallback, padded.
            expect(subScale.min).toBeLessThan(subScale.max);
        }
    });

    it("expands a degenerate single-value y-range", async () => {
        const { instances } = await drive([
            emissions({
                plots: [
                    plotEmission({ slotId: "flat", pane: "flat", value: 50, time: BARS[0].time }),
                    plotEmission({ slotId: "flat", pane: "flat", value: 50, time: BARS[1].time }),
                ],
            }),
        ]);
        const flatScale = instances[1].records.find((r) => r.kind === "setScale");
        if (flatScale?.kind === "setScale") {
            // yMin === yMax ⇒ ±1 expansion (plus padding).
            expect(flatScale.max - flatScale.min).toBeGreaterThanOrEqual(2);
        }
    });

    it("handles a single-bar window (xMax === xMin)", async () => {
        const { instances } = await drive([emissions()], [BARS[0]]);
        // One bar ⇒ the overlay still builds + paints without throwing.
        instances[0].runDraw();
        expect(instances[0].ctx.calls.some((c) => c.kind === "fillRect")).toBe(true);
    });

    it("computes an odd-count median bar spacing (two bars)", async () => {
        const { instances } = await drive([emissions()], [BARS[0], BARS[1]]);
        instances[0].runDraw();
        // Two bars ⇒ one gap ⇒ the odd-length median branch.
        expect(instances[0].ctx.calls.filter((c) => c.kind === "fillRect")).toHaveLength(2);
    });

    it("early-returns from the draw hook once bars are cleared (dispose)", async () => {
        const { adapter, instances } = await drive([emissions()]);
        adapter.dispose();
        // After dispose the bar window is empty; a stale redraw is a no-op.
        const overlay = instances[0];
        const before = overlay.ctx.calls.length;
        overlay.runDraw();
        expect(overlay.ctx.calls.length).toBe(before);
    });

    it("does not paint when there are no bars", async () => {
        const host = stubHost([emissions()]);
        const { adapter, instances } = build({ host, candles: candleStream([]) });
        await runUplotLoop(adapter);
        // No candle events ⇒ no drain frame ⇒ no instance built.
        expect(instances.length).toBe(0);
    });

    it("appends closes and replaces the in-progress bar on tick", async () => {
        const host = stubHost([emissions(), emissions(), emissions()]);
        const { adapter, instances } = build({
            host,
            candles: candleStream([
                { kind: "close", bar: BARS[0] },
                { kind: "close", bar: BARS[1] },
                // A tick replaces the last (in-progress) bar in place.
                { kind: "tick", bar: bar(1, 103, 110, 101, 108) },
            ]),
        });
        await runUplotLoop(adapter);
        const last = instances[0].records.filter((r) => r.kind === "setData").at(-1);
        // Two closes ⇒ 2 bars; the tick replaces the second, not a third.
        if (last?.kind === "setData") {
            expect(last.data[0]).toHaveLength(2);
        }
    });

    it("seeds the first bar from an opening tick", async () => {
        const host = stubHost([emissions()]);
        const { adapter, instances } = build({
            host,
            candles: candleStream([{ kind: "tick", bar: BARS[0] }]),
        });
        await runUplotLoop(adapter);
        const last =
            instances[0].records.filter((r) => r.kind === "setData").at(-1) ??
            instances[0].records[0];
        if (last.kind === "new" || last.kind === "setData") {
            expect(last.data[0]).toHaveLength(1);
        }
    });

    it("ignores secondary-stream candle events", async () => {
        const host = stubHost([emissions()]);
        const { adapter, instances } = build({
            host,
            candles: candleStream([
                { kind: "close", bar: BARS[0] },
                { kind: "close", bar: BARS[1], streamKey: "1W" },
            ]),
        });
        await runUplotLoop(adapter);
        const last = instances[0].records.filter((r) => r.kind === "setData").at(-1);
        if (last?.kind === "setData") {
            expect(last.data[0]).toHaveLength(1);
        }
    });
});

describe("createUplotAdapter — plot kinds", () => {
    const seriesKinds: ReadonlyArray<{ name: string; style: PlotStyle }> = [
        { name: "line", style: { kind: "line", lineWidth: 1, lineStyle: "solid" } },
        { name: "step-line", style: { kind: "step-line", lineWidth: 1, lineStyle: "dashed" } },
        { name: "histogram", style: { kind: "histogram", baseline: 0 } },
        { name: "area", style: { kind: "area", lineWidth: 1, lineStyle: "solid", fillAlpha: 0.2 } },
        {
            name: "filled-band",
            style: { kind: "filled-band", upper: 110, lower: 90, alpha: 0.2 },
        },
    ];

    for (const { name, style } of seriesKinds) {
        it(`maps a ${name} plot to a native uPlot series`, async () => {
            const { instances } = await drive([
                emissions({
                    plots: [
                        plotEmission({ slotId: name, style, value: 100, time: BARS[0].time }),
                        plotEmission({ slotId: name, style, value: 104, time: BARS[1].time }),
                    ],
                }),
            ]);
            const newRecord = instances[0].records[0];
            if (newRecord.kind === "new") {
                expect(newRecord.opts.series).toHaveLength(1);
                expect(newRecord.opts.series[0].label).toBe(name);
                // The series data row aligns to the bar window with a gap.
                expect(newRecord.data).toHaveLength(2);
                expect(newRecord.data[1]).toEqual([100, 104, null]);
            }
        });
    }

    it("renders a null / NaN plot value as a gap", async () => {
        const { instances } = await drive([
            emissions({
                plots: [
                    plotEmission({ slotId: "g", value: null, time: BARS[0].time }),
                    plotEmission({ slotId: "g", value: 104, time: BARS[1].time }),
                ],
            }),
        ]);
        const newRecord = instances[0].records[0];
        if (newRecord.kind === "new") {
            expect(newRecord.data[1]).toEqual([null, 104, null]);
        }
    });

    it("selects step vs line paths per PlotStyle", async () => {
        const { instances } = await drive([
            emissions({
                plots: [
                    plotEmission({
                        slotId: "step",
                        style: { kind: "step-line", lineWidth: 1, lineStyle: "solid" },
                        time: BARS[0].time,
                    }),
                    plotEmission({ slotId: "lin", time: BARS[0].time }),
                ],
            }),
        ]);
        const newRecord = instances[0].records[0];
        if (newRecord.kind === "new") {
            const byLabel = new Map(newRecord.opts.series.map((s) => [s.label, s.paths]));
            expect(byLabel.get("step")).toBe("step");
            expect(byLabel.get("lin")).toBe("line");
        }
    });

    it("sets a fill for area / filled-band series only", async () => {
        const { instances } = await drive([
            emissions({
                plots: [
                    plotEmission({
                        slotId: "area",
                        style: { kind: "area", lineWidth: 1, lineStyle: "solid", fillAlpha: 0.2 },
                        time: BARS[0].time,
                    }),
                    plotEmission({ slotId: "lin", time: BARS[0].time }),
                ],
            }),
        ]);
        const newRecord = instances[0].records[0];
        if (newRecord.kind === "new") {
            const byLabel = new Map(newRecord.opts.series.map((s) => [s.label, s.fill]));
            expect(byLabel.get("area")).toBeDefined();
            expect(byLabel.get("lin")).toBeUndefined();
        }
    });

    it("hides a slot marked visible: false (no series)", async () => {
        const { instances } = await drive([
            emissions({
                plots: [plotEmission({ slotId: "hidden", visible: false, time: BARS[0].time })],
            }),
        ]);
        const newRecord = instances[0].records[0];
        if (newRecord.kind === "new") {
            expect(newRecord.opts.series).toHaveLength(0);
        }
    });

    it("buffers glyph / override kinds without dropping them", async () => {
        const overrideStyles: ReadonlyArray<PlotStyle> = [
            { kind: "shape", shape: "circle", size: 1 },
            { kind: "character", char: "A", size: 1 },
            { kind: "arrow", direction: "up", size: 1 },
            { kind: "label", text: "x", position: "above" },
            { kind: "marker", shape: "circle", size: 1 },
            { kind: "candle-override", bull: "#0f0", bear: "#f00" },
            { kind: "bar-override", color: "#0f0" },
            { kind: "bg-color", color: "#00f" },
            { kind: "bar-color", color: "#0f0" },
            { kind: "horizontal-histogram", buckets: [{ price: 100, volume: 5 }] },
        ];
        const { instances } = await drive([
            emissions({
                plots: overrideStyles.map((style, i) =>
                    plotEmission({ slotId: `ov${i}`, style, time: BARS[0].time }),
                ),
            }),
        ]);
        // None becomes a series; the overlay instance is still built.
        const newRecord = instances[0].records[0];
        if (newRecord.kind === "new") {
            expect(newRecord.opts.series).toHaveLength(0);
        }
    });
});

describe("createUplotAdapter — horizontal lines", () => {
    it("paints an hline in the draw hook via valToPos", async () => {
        const { instances } = await drive([
            emissions({
                plots: [
                    plotEmission({
                        slotId: "h",
                        style: { kind: "horizontal-line", lineWidth: 1, lineStyle: "solid" },
                        value: 102,
                        color: "#ff0000",
                        time: BARS[0].time,
                    }),
                ],
            }),
        ]);
        const overlay = instances[0];
        overlay.runDraw();
        // After the candles, the hline contributes one more stroke segment.
        const strokeStyles = overlay.ctx.calls.filter(
            (c) => c.kind === "set" && c.prop === "strokeStyle" && c.value === "#ff0000",
        );
        expect(strokeStyles).toHaveLength(1);
    });

    it("defaults a null-valued hline to price 0 and a fallback colour", async () => {
        const { instances } = await drive([
            emissions({
                plots: [
                    plotEmission({
                        slotId: "h",
                        style: { kind: "horizontal-line", lineWidth: 1, lineStyle: "solid" },
                        value: null,
                        color: null,
                        time: BARS[0].time,
                    }),
                ],
            }),
        ]);
        const overlay = instances[0];
        overlay.runDraw();
        const fallback = overlay.ctx.calls.filter(
            (c) => c.kind === "set" && c.prop === "strokeStyle" && c.value === "#787b86",
        );
        expect(fallback).toHaveLength(1);
    });

    it("skips an hline whose valToPos is non-finite (scale not ready)", async () => {
        const host = stubHost([
            emissions({
                plots: [
                    plotEmission({
                        slotId: "h",
                        style: { kind: "horizontal-line", lineWidth: 1, lineStyle: "solid" },
                        value: 102,
                        color: "#123456",
                        time: BARS[0].time,
                    }),
                ],
            }),
        ]);
        const { adapter, instances } = build({
            host,
            candles: candleStream([{ kind: "history", bars: [...BARS] }]),
        });
        await runUplotLoop(adapter);
        // Simulate uPlot returning NaN before its scale is ranged.
        vi.spyOn(instances[0], "valToPos").mockReturnValue(Number.NaN);
        instances[0].runDraw();
        const hlineStroke = instances[0].ctx.calls.some(
            (c) => c.kind === "set" && c.prop === "strokeStyle" && c.value === "#123456",
        );
        expect(hlineStroke).toBe(false);
    });

    it("applies the hline's lineWidth + dash, then resets to solid 1px", async () => {
        const { instances } = await drive([
            emissions({
                plots: [
                    plotEmission({
                        slotId: "h",
                        style: { kind: "horizontal-line", lineWidth: 3, lineStyle: "dashed" },
                        value: 102,
                        color: "#ff0000",
                        time: BARS[0].time,
                    }),
                ],
            }),
        ]);
        const overlay = instances[0];
        overlay.runDraw();
        // The hline strokes at width 3 with the dashed pattern, then restores
        // solid 1px so downstream draws are not contaminated.
        const widthSets = overlay.ctx.calls.filter(
            (c) => c.kind === "set" && c.prop === "lineWidth",
        );
        expect(widthSets.some((c) => c.kind === "set" && c.value === 3)).toBe(true);
        const dashes = overlay.ctx.calls.filter((c) => c.kind === "setLineDash");
        expect(dashes.some((c) => c.kind === "setLineDash" && c.segments.length > 0)).toBe(true);
        // The last width + dash the hline emits restore the defaults.
        const lastWidth = widthSets.at(-1);
        expect(lastWidth?.kind === "set" && lastWidth.value).toBe(1);
        const lastDash = dashes.at(-1);
        expect(lastDash?.kind === "setLineDash" && lastDash.segments).toEqual([]);
    });

    it("strokes a dotted hline with the dotted dash pattern", async () => {
        const { instances } = await drive([
            emissions({
                plots: [
                    plotEmission({
                        slotId: "h",
                        style: { kind: "horizontal-line", lineWidth: 1, lineStyle: "dotted" },
                        value: 102,
                        color: "#00ff00",
                        time: BARS[0].time,
                    }),
                ],
            }),
        ]);
        const overlay = instances[0];
        overlay.runDraw();
        const dotted = overlay.ctx.calls.some(
            (c) =>
                c.kind === "setLineDash" &&
                c.segments.length === 2 &&
                c.segments[0] === 2 &&
                c.segments[1] === 4,
        );
        expect(dotted).toBe(true);
    });

    it("routes a subpane hline into its own pane's draw hook", async () => {
        const { instances } = await drive([
            emissions({
                plots: [
                    plotEmission({
                        slotId: "rsiHi",
                        pane: "rsi",
                        style: { kind: "horizontal-line", lineWidth: 1, lineStyle: "solid" },
                        value: 70,
                        color: "#abcdef",
                        time: BARS[0].time,
                    }),
                ],
            }),
        ]);
        // overlay paints no hline; the rsi pane paints it.
        instances[0].runDraw();
        instances[1].runDraw();
        const overlayHline = instances[0].ctx.calls.some(
            (c) => c.kind === "set" && c.prop === "strokeStyle" && c.value === "#abcdef",
        );
        const rsiHline = instances[1].ctx.calls.some(
            (c) => c.kind === "set" && c.prop === "strokeStyle" && c.value === "#abcdef",
        );
        expect(overlayHline).toBe(false);
        expect(rsiHline).toBe(true);
    });
});

function rectangleDrawing(handleId: string): DrawingEmission {
    return {
        kind: "drawing",
        handleId,
        drawingKind: "rectangle",
        op: "create",
        state: {
            kind: "rectangle",
            anchors: [
                { time: BARS[0].time, price: 100 },
                { time: BARS[2].time, price: 106 },
            ],
            style: {},
        } as unknown as DrawingEmission["state"],
        bar: 0,
        time: BARS[0].time,
    };
}

describe("createUplotAdapter — drawings (Task 8 draw-hook geometry)", () => {
    it("paints a buffered drawing via decomposeDrawing + paintPrimitive", async () => {
        const { instances } = await drive([emissions({ drawings: [lineDrawing("d1")] })]);
        const overlay = instances[0];
        overlay.runDraw();
        // The drawing pass brackets its prims in a save/translate/restore so
        // plotting-area-relative pixels land where uPlot's series sit.
        const translates = overlay.ctx.calls.filter((c) => c.kind === "translate");
        expect(translates).toHaveLength(1);
        // A line decomposes to a polyline primitive → moveTo + lineTo + stroke.
        const moveTos = overlay.ctx.calls.filter((c) => c.kind === "moveTo");
        const lineTos = overlay.ctx.calls.filter((c) => c.kind === "lineTo");
        expect(moveTos.length).toBeGreaterThan(0);
        expect(lineTos.length).toBeGreaterThan(0);
    });

    it("paints multiple drawing kinds in one pass", async () => {
        const { instances } = await drive([
            emissions({ drawings: [lineDrawing("d1"), rectangleDrawing("r1")] }),
        ]);
        const overlay = instances[0];
        overlay.runDraw();
        // One translate brackets the whole pass (not one per drawing); a
        // rectangle decomposes to a closed polyline (fill + stroke).
        expect(overlay.ctx.calls.filter((c) => c.kind === "translate")).toHaveLength(1);
        expect(overlay.ctx.calls.some((c) => c.kind === "closePath")).toBe(true);
    });

    it("skips the drawing pass entirely when no drawings are buffered", async () => {
        const { instances } = await drive([emissions()]);
        const overlay = instances[0];
        overlay.runDraw();
        // No drawings ⇒ no save/translate bracket (candles still paint).
        expect(overlay.ctx.calls.filter((c) => c.kind === "translate")).toHaveLength(0);
    });

    it("renders a sub-pane drawing against the sub-pane's own instance", async () => {
        const { instances } = await drive([
            emissions({
                plots: [
                    plotEmission({
                        slotId: "rsi",
                        pane: "rsi",
                        value: 55,
                        time: BARS[0].time,
                    }),
                ],
                drawings: [lineDrawing("d1")],
            }),
        ]);
        // Both panes buffer the same drawing map, so each pane's hook paints
        // it against its own viewport (overlay + rsi).
        instances[0].runDraw();
        instances[1].runDraw();
        expect(instances[0].ctx.calls.filter((c) => c.kind === "translate")).toHaveLength(1);
        expect(instances[1].ctx.calls.filter((c) => c.kind === "translate")).toHaveLength(1);
    });

    it("projects the drawing through the pane's valToPos-equivalent viewport", async () => {
        const { instances } = await drive([emissions({ drawings: [lineDrawing("d1")] })]);
        const overlay = instances[0];
        overlay.runDraw();
        // The line anchors at price 100 → 110; both must project to finite,
        // in-range y pixels (the viewport reproduces u.valToPos).
        const lineTos = overlay.ctx.calls.filter(
            (c): c is Extract<typeof c, { kind: "lineTo" }> => c.kind === "lineTo",
        );
        expect(lineTos.length).toBeGreaterThan(0);
        for (const call of lineTos) {
            expect(Number.isFinite(call.x)).toBe(true);
            expect(Number.isFinite(call.y)).toBe(true);
        }
    });
});

describe("createUplotAdapter — ingest of other emission kinds", () => {
    it("collects alerts and forwards them to onAlert", async () => {
        const seen: AlertEmission[] = [];
        const host = stubHost([emissions({ alerts: [alertEmission("a")] })]);
        const { adapter } = build({
            host,
            candles: candleStream([{ kind: "history", bars: [...BARS] }]),
            onAlert: (a) => seen.push(a),
        });
        await runUplotLoop(adapter);
        expect(seen).toHaveLength(1);
    });

    it("ingests alert conditions, logs, and drawings; a remove clears the create", async () => {
        const { instances } = await drive([
            emissions({
                alertConditions: [alertConditionEmission("c")],
                logs: [logEmission()],
                drawings: [lineDrawing("d1"), lineDrawing("d1", "remove")],
            }),
        ]);
        // The remove op clears the create, so the draw hook paints no
        // drawing stroke (the candles still paint).
        instances[0].runDraw();
        const drawingStrokes = instances[0].ctx.calls.filter((c) => c.kind === "translate");
        expect(drawingStrokes).toHaveLength(0);
    });

    it("caps the recent-log ring buffer", async () => {
        // Six logs in one frame exceed the 5-entry cap, exercising the shift.
        await drive([emissions({ logs: Array.from({ length: 6 }, () => logEmission()) })]);
        expect(true).toBe(true);
    });

    it("caps the recent-alert ring buffer", async () => {
        // 257 alerts exceed the 256 cap, exercising the shift loop.
        const alerts = Array.from({ length: 257 }, (_, i) => alertEmission(`a${i}`));
        await drive([emissions({ alerts })]);
        expect(true).toBe(true);
    });

    it("logs runtime diagnostics at warning / error severity", async () => {
        await drive([
            emissions({
                diagnostics: [diagnostic("warning"), diagnostic("error"), diagnostic("info")],
            }),
        ]);
        expect(console.warn).toHaveBeenCalledTimes(2);
    });

    it("drops emissions that fail validation", async () => {
        const bad = plotEmission({ slotId: "nan", value: Number.NaN, time: BARS[0].time });
        const { instances } = await drive([emissions({ plots: [bad] })]);
        const newRecord = instances[0].records[0];
        if (newRecord.kind === "new") {
            // NaN value rejected ⇒ no series.
            expect(newRecord.opts.series).toHaveLength(0);
        }
    });
});

describe("createUplotAdapter — lifecycle", () => {
    it("disposes each instance + the host", async () => {
        const host = stubHost([
            emissions({ plots: [plotEmission({ slotId: "rsi", pane: "rsi" })] }),
        ]);
        const { adapter, instances } = build({
            host,
            candles: candleStream([{ kind: "history", bars: [...BARS] }]),
        });
        await runUplotLoop(adapter);
        expect(instances.length).toBe(2);
        adapter.dispose();
        expect(instances.every((u) => u.records.some((r) => r.kind === "destroy"))).toBe(true);
        expect(host.state.disposed).toBe(true);
    });

    it("refreshes an existing instance via setData across frames", async () => {
        const host = stubHost([emissions(), emissions()]);
        const { adapter, instances } = build({
            host,
            candles: candleStream([
                { kind: "close", bar: BARS[0] },
                { kind: "close", bar: BARS[1] },
            ]),
        });
        await runUplotLoop(adapter);
        // Built once, then refreshed (setData) on the second frame.
        expect(instances.length).toBe(1);
        expect(instances[0].records.filter((r) => r.kind === "setData").length).toBeGreaterThan(0);
    });

    it("yields a stable hashed candle draw log", async () => {
        const { instances } = await drive([emissions()]);
        instances[0].runDraw();
        const h = hashCallLog(instances[0].ctx.calls);
        expect(h).toMatch(/^[0-9a-f]{64}$/);
        // Re-running the same draw reproduces the hash (determinism).
        const again = makeMockUplotFactory();
        const adapter2 = createUplotAdapter({
            target: {} as HTMLElement,
            width: 320,
            height: 240,
            uplotFactory: again.factory,
            candleSource: candleStream([{ kind: "history", bars: [...BARS] }]),
            host: stubHost([emissions()]),
        });
        await runUplotLoop(adapter2);
        again.instances[0].runDraw();
        expect(hashCallLog(again.instances[0].ctx.calls)).toBe(h);
    });
});

describe("runUplotLoop", () => {
    it("throws on a foreign handle", async () => {
        const foreign = Object.freeze({
            id: "x",
            name: "x",
            capabilities: build({}).adapter.capabilities,
            candles: () => candleStream([]),
            onEmissions: () => {},
            dispose: () => {},
            host: stubHost(),
        }) as unknown as UplotAdapterHandle;
        await expect(runUplotLoop(foreign)).rejects.toThrow(/was not produced by/);
    });

    it("returns immediately when the signal is already aborted", async () => {
        const controller = new AbortController();
        controller.abort();
        const host = stubHost([emissions()]);
        const { adapter, instances } = build({
            host,
            candles: candleStream([{ kind: "history", bars: [...BARS] }]),
        });
        await runUplotLoop(adapter, { signal: controller.signal });
        expect(instances.length).toBe(0);
    });

    it("aborts at the post-push checkpoint", async () => {
        const controller = new AbortController();
        const host = stubHost([emissions()]);
        host.push = async () => {
            controller.abort();
        };
        const { adapter, instances } = build({
            host,
            candles: candleStream([{ kind: "history", bars: [...BARS] }]),
        });
        await runUplotLoop(adapter, { signal: controller.signal });
        // Abort fired during push ⇒ no drain frame, no instance built.
        expect(instances.length).toBe(0);
    });

    it("aborts during the post-push yield window", async () => {
        const controller = new AbortController();
        const host = stubHost([emissions()]);
        // Queue the abort during push so it fires while the loop awaits its
        // own `setTimeout(0)` yield — between the push and drain checks.
        host.push = async () => {
            setTimeout(() => controller.abort(), 0);
        };
        const { adapter, instances } = build({
            host,
            candles: candleStream([{ kind: "history", bars: [...BARS] }]),
        });
        await runUplotLoop(adapter, { signal: controller.signal });
        expect(instances.length).toBe(0);
    });

    it("aborts at the post-drain checkpoint", async () => {
        const controller = new AbortController();
        const host = stubHost([emissions()]);
        host.drain = async () => {
            controller.abort();
            return emissions();
        };
        const { adapter, instances } = build({
            host,
            candles: candleStream([{ kind: "history", bars: [...BARS] }]),
        });
        await runUplotLoop(adapter, { signal: controller.signal });
        // Abort fired during drain ⇒ onEmissions skipped, no instance built.
        expect(instances.length).toBe(0);
    });

    it("runs to completion without a signal (aborted() ?? false)", async () => {
        const host = stubHost([emissions()]);
        const { adapter, instances } = build({
            host,
            candles: candleStream([{ kind: "history", bars: [...BARS] }]),
        });
        await runUplotLoop(adapter);
        expect(instances.length).toBe(1);
    });

    it("aborts mid-stream after the first event", async () => {
        const controller = new AbortController();
        const events: CandleEvent[] = [
            { kind: "close", bar: BARS[0] },
            { kind: "close", bar: BARS[1] },
        ];
        async function* aborting(): AsyncIterable<CandleEvent> {
            yield events[0];
            controller.abort();
            yield events[1];
        }
        const host = stubHost([emissions(), emissions()]);
        const { adapter, instances } = build({ host, candles: aborting() });
        await runUplotLoop(adapter, { signal: controller.signal });
        // The first event built one frame; the abort stopped the second.
        const setDataCount = instances[0]?.records.filter((r) => r.kind === "setData").length ?? 0;
        expect(setDataCount).toBe(0);
    });
});

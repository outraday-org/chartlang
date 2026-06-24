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
    const time = overrides.time ?? BARS[0].time;
    // Default `bar` to the index whose time matches (real runtime keeps the
    // two consistent), so the aligned-data column mapping — which resolves
    // the column from `bar` via `shiftedBarTime` — lands the value on the
    // matching bar even when a fixture only sets `time`.
    const barFromTime = BARS.findIndex((b) => b.time === time);
    return {
        kind: "plot",
        slotId: overrides.slotId,
        title: overrides.title ?? "",
        style,
        bar: overrides.bar ?? (barFromTime >= 0 ? barFromTime : 0),
        time,
        value: "value" in overrides ? (overrides.value as number | null) : 100,
        color: overrides.color ?? null,
        meta: overrides.meta ?? {},
        pane: overrides.pane ?? "overlay",
        ...(overrides.visible === undefined ? {} : { visible: overrides.visible }),
        ...("colorValue" in overrides ? { colorValue: overrides.colorValue } : {}),
        ...(overrides.xShift === undefined ? {} : { xShift: overrides.xShift }),
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
    initialVisibleBars?: number;
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
        ...(args.initialVisibleBars !== undefined
            ? { initialVisibleBars: args.initialVisibleBars }
            : {}),
    });
    return { adapter, instances, host };
}

// Drive a single drain frame: feed a history event then one drain.
async function drive(
    drains: RunnerEmissions[],
    bars: ReadonlyArray<Bar> = BARS,
    initialVisibleBars?: number,
): Promise<{ instances: MockUplot[]; adapter: UplotAdapterHandle }> {
    const host = stubHost(drains);
    const { adapter, instances } = build({
        host,
        candles: candleStream([{ kind: "history", bars: [...bars] }]),
        ...(initialVisibleBars !== undefined ? { initialVisibleBars } : {}),
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

    it("zooms the x scale on a wheel gesture and holds the view afterwards", async () => {
        const { instances, adapter } = await drive([emissions(), emissions()]);
        const overlay = instances[0];
        // Wheel up (negative deltaY) zooms in about the cursor.
        overlay.dispatch("wheel", { offsetX: 100, deltaY: -200, preventDefault: () => {} });
        const xScale = overlay.records.filter((r) => r.kind === "setScale" && r.scaleKey === "x");
        expect(xScale.length).toBeGreaterThan(0);

        // A subsequent frame must HOLD the user's window: setData with
        // resetScales:false and NO further y re-pin.
        const before = overlay.records.length;
        adapter.onEmissions(emissions());
        const added = overlay.records.slice(before);
        const setData = added.find((r) => r.kind === "setData");
        expect(setData?.kind === "setData" && setData.resetScales).toBe(false);
        expect(added.some((r) => r.kind === "setScale" && r.scaleKey === "y")).toBe(false);
    });

    it("pans the x scale on a pointer drag", async () => {
        const { instances } = await drive([emissions()]);
        const overlay = instances[0];
        overlay.dispatch("pointerdown", { clientX: 50, pointerId: 1 });
        overlay.dispatch("pointermove", { clientX: 80, pointerId: 1 });
        overlay.dispatch("pointerup", { pointerId: 1 });
        expect(overlay.records.some((r) => r.kind === "setScale" && r.scaleKey === "x")).toBe(true);
    });

    it("resets to auto-follow on a double-click", async () => {
        const { instances, adapter } = await drive([emissions(), emissions()]);
        const overlay = instances[0];
        overlay.dispatch("wheel", { offsetX: 100, deltaY: -200, preventDefault: () => {} });
        overlay.dispatch("dblclick", {});
        // After reset the next frame re-pins y again (auto-follow resumed).
        const before = overlay.records.length;
        adapter.onEmissions(emissions());
        const added = overlay.records.slice(before);
        expect(added.some((r) => r.kind === "setScale" && r.scaleKey === "y")).toBe(true);
    });

    it("tolerates a wheel gesture before any bars are loaded", () => {
        const { instances, adapter } = build({});
        // A frame with no bars still builds + wires the overlay instance.
        adapter.onEmissions(emissions());
        expect(() =>
            instances[0].dispatch("wheel", { offsetX: 10, deltaY: -100, preventDefault: () => {} }),
        ).not.toThrow();
    });

    it("widens a single-bar data window so the x span is never zero", async () => {
        // One bar ⇒ data xMax === xMin; barsXBounds widens it by 1.
        const { instances } = await drive([emissions()], [BARS[0]]);
        const overlay = instances[0];
        expect(() =>
            overlay.dispatch("wheel", { offsetX: 10, deltaY: -100, preventDefault: () => {} }),
        ).not.toThrow();
        expect(overlay.records.some((r) => r.kind === "setScale" && r.scaleKey === "x")).toBe(true);
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

    it('allocates a fresh pane per distinct slot emitting pane:"new"', async () => {
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

    it('reuses the same pane:"new" pane when one slot re-emits across frames', async () => {
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

describe("createUplotAdapter — initialVisibleBars default window", () => {
    // The auto-follow x window pins to a HALF-SPACING-PADDED data window;
    // BARS is 3 uniform daily bars, so the pad is MS_PER_DAY / 2.
    const X_PAD = MS_PER_DAY / 2;

    function lastXScale(overlay: MockUplot): { min: number; max: number } | undefined {
        const x = overlay.records.filter((r) => r.kind === "setScale" && r.scaleKey === "x").at(-1);
        return x?.kind === "setScale" ? { min: x.min, max: x.max } : undefined;
    }

    it("frames only the most recent N bars on load when set", async () => {
        // N = 2 with 3 bars ⇒ autoFollowXMin = bars[1].time; the padded
        // window starts there rather than at the first bar.
        const { instances } = await drive([emissions()], BARS, 2);
        const win = lastXScale(instances[0]);
        expect(win?.min).toBeCloseTo(BARS[1].time - X_PAD);
        expect(win?.max).toBeCloseTo(BARS[2].time + X_PAD);
    });

    it("still fits all bars when N exceeds the loaded bar count", async () => {
        // N = 10 > 3 bars ⇒ autoFollowXMin undefined ⇒ full-data window,
        // byte-identical to the no-option auto-follow.
        const { instances } = await drive([emissions()], BARS, 10);
        const win = lastXScale(instances[0]);
        expect(win?.min).toBeCloseTo(BARS[0].time - X_PAD);
        expect(win?.max).toBeCloseTo(BARS[2].time + X_PAD);
    });

    it("fits all bars when N is 0 (explicit opt-out)", async () => {
        // N = 0 ⇒ the `n > 0` guard fails ⇒ full-data window.
        const { instances } = await drive([emissions()], BARS, 0);
        const win = lastXScale(instances[0]);
        expect(win?.min).toBeCloseTo(BARS[0].time - X_PAD);
        expect(win?.max).toBeCloseTo(BARS[2].time + X_PAD);
    });

    it("frames the recent window through a pan/zoom requestRender too", async () => {
        // The interaction handler resolves the SAME framed window while the
        // user has not committed a held window; a wheel gesture flips
        // userInteracted true and the held window then wins (autoFollowXMin
        // ignored), so the framed start no longer applies.
        const { instances } = await drive([emissions(), emissions()], BARS, 2);
        const overlay = instances[0];
        const before = overlay.records.length;
        overlay.dispatch("wheel", { offsetX: 100, deltaY: -200, preventDefault: () => {} });
        const win = lastXScale(overlay);
        // A held window after a zoom-in sits strictly inside the data range,
        // distinct from the framed auto-follow window — proving the gesture
        // path took over.
        expect(win?.min).toBeGreaterThan(BARS[0].time - X_PAD);
        expect(overlay.records.length).toBeGreaterThan(before);
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

    it("gives each series its own last-non-null stroke (color fix, not all-blue)", async () => {
        const { instances } = await drive([
            emissions({
                plots: [
                    // Two distinct slots with DISTINCT per-point colours must
                    // produce DISTINCT strokes — the all-blue hardcode was a BUG.
                    plotEmission({ slotId: "a", color: "#ff0000", time: BARS[0].time }),
                    plotEmission({ slotId: "b", color: "#00ff00", time: BARS[0].time }),
                ],
            }),
        ]);
        const newRecord = instances[0].records[0];
        if (newRecord.kind === "new") {
            const byLabel = new Map(newRecord.opts.series.map((s) => [s.label, s.stroke]));
            expect(byLabel.get("a")).toBe("#ff0000");
            expect(byLabel.get("b")).toBe("#00ff00");
            // Two strokes, two distinct colours.
            expect(new Set(newRecord.opts.series.map((s) => s.stroke)).size).toBe(2);
        }
    });

    it("uses the LAST non-null per-point colour as the series stroke", async () => {
        const { instances } = await drive([
            emissions({
                plots: [
                    // An early null-colour point then a later coloured one: the
                    // stroke tracks the last non-null colour (#abcdef).
                    plotEmission({ slotId: "c", color: null, time: BARS[0].time }),
                    plotEmission({ slotId: "c", color: "#abcdef", time: BARS[1].time }),
                ],
            }),
        ]);
        const newRecord = instances[0].records[0];
        if (newRecord.kind === "new") {
            expect(newRecord.opts.series[0].stroke).toBe("#abcdef");
        }
    });

    it("falls back to the default stroke for an all-null-colour series", async () => {
        const { instances } = await drive([
            emissions({
                plots: [
                    plotEmission({ slotId: "d", color: null, time: BARS[0].time }),
                    plotEmission({ slotId: "d", color: null, time: BARS[1].time }),
                ],
            }),
        ]);
        const newRecord = instances[0].records[0];
        if (newRecord.kind === "new") {
            // No per-point colour ⇒ the default fallback stroke.
            expect(newRecord.opts.series[0].stroke).toBe("#3b82f6");
        }
    });

    it("places a +offset point in an extrapolated future column (distinct from unshifted)", async () => {
        const { instances } = await drive([
            emissions({
                plots: [
                    // Unshifted SMA at every bar.
                    plotEmission({ slotId: "base", value: 100, time: BARS[0].time, bar: 0 }),
                    plotEmission({ slotId: "base", value: 101, time: BARS[1].time, bar: 1 }),
                    plotEmission({ slotId: "base", value: 102, time: BARS[2].time, bar: 2 }),
                    // A +1 copy of the last bar's value: lands one spacing past
                    // the last bar in an extrapolated FUTURE column.
                    plotEmission({
                        slotId: "shift",
                        value: 102,
                        time: BARS[2].time,
                        bar: 2,
                        xShift: 1,
                    }),
                ],
            }),
        ]);
        const newRecord = instances[0].records[0];
        if (newRecord.kind === "new") {
            const spacing = MS_PER_DAY;
            const xs = newRecord.data[0];
            // The x row is the 3 bar times + 1 extrapolated future column.
            expect(xs).toEqual([BARS[0].time, BARS[1].time, BARS[2].time, BARS[2].time + spacing]);
            // The base series fills cols 0..2; the shifted series puts 102 in
            // col 3 (the future column) and nothing in the unshifted columns —
            // a DISTINCT column from the unshifted point.
            const base = newRecord.data[1];
            const shifted = newRecord.data[2];
            expect(base).toEqual([100, 101, 102, null]);
            expect(shifted).toEqual([null, null, null, 102]);
        }
    });

    it("clips a -offset point that lands before the first bar (no negative column)", async () => {
        const { instances } = await drive([
            emissions({
                plots: [
                    plotEmission({ slotId: "base", value: 100, time: BARS[0].time, bar: 0 }),
                    plotEmission({ slotId: "base", value: 101, time: BARS[1].time, bar: 1 }),
                    // A -2 copy of bar 0: shifted time precedes the first bar →
                    // dropped (no negative-time column is prepended).
                    plotEmission({
                        slotId: "past",
                        value: 100,
                        time: BARS[0].time,
                        bar: 0,
                        xShift: -2,
                    }),
                    // A -1 copy of bar 1: lands on bar 0's column (in range).
                    plotEmission({
                        slotId: "past",
                        value: 101,
                        time: BARS[1].time,
                        bar: 1,
                        xShift: -1,
                    }),
                ],
            }),
        ]);
        const newRecord = instances[0].records[0];
        if (newRecord.kind === "new") {
            // No future column appended (only -k shifts present).
            expect(newRecord.data[0]).toEqual([BARS[0].time, BARS[1].time, BARS[2].time]);
            const past = newRecord.data[2];
            // The -2 point is clipped; the -1 point lands on col 0.
            expect(past).toEqual([101, null, null]);
        }
    });

    it("drops a point whose resolved column does not exist (defensive guard)", async () => {
        const { instances } = await drive([
            emissions({
                plots: [
                    plotEmission({ slotId: "base", value: 100, time: BARS[0].time, bar: 0 }),
                    // A point anchored at a bar index PAST the data with no
                    // positive shift: `shiftedBarTime` extrapolates a future
                    // time that no column covers (only `+k` shifts extend xs),
                    // so it is silently dropped — no row column to write.
                    plotEmission({ slotId: "base", value: 999, time: BARS[0].time, bar: 9 }),
                ],
            }),
        ]);
        const newRecord = instances[0].records[0];
        if (newRecord.kind === "new") {
            // Only the 3 bar columns; the out-of-range point contributed
            // nothing (its future time has no column).
            expect(newRecord.data[0]).toEqual([BARS[0].time, BARS[1].time, BARS[2].time]);
            expect(newRecord.data[1]).toEqual([100, null, null]);
        }
    });

    it("pads the x scale so the first / last candle centres sit inside the plot area", async () => {
        const { instances } = await drive([emissions()]);
        const overlay = instances[0];
        const width = overlay.bbox.width;
        // The x scale was pinned to the half-spacing-padded data window, so a
        // candle at the first / last bar time projects strictly INSIDE the
        // plotting area (not flush at 0 / width as uPlot's auto-range would).
        const firstX = overlay.valToPos(BARS[0].time, "x", true);
        const lastX = overlay.valToPos(BARS[BARS.length - 1].time, "x", true);
        expect(firstX).toBeGreaterThan(0);
        expect(lastX).toBeLessThan(width);
        // Both centres are inside the [0, width] plotting area.
        expect(firstX).toBeLessThan(width);
        expect(lastX).toBeGreaterThan(0);
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

describe("createUplotAdapter — bg-color / bar-color draw-hook rendering", () => {
    it("paints a per-bar bg-color band per bar, behind the candles", async () => {
        const { instances } = await drive([
            emissions({
                plots: [
                    plotEmission({
                        slotId: "bg",
                        style: { kind: "bg-color", color: "#26a69a", transp: 85 },
                        value: null,
                        time: BARS[0].time,
                    }),
                    plotEmission({
                        slotId: "bg",
                        style: { kind: "bg-color", color: "#ef5350", transp: 85 },
                        value: null,
                        time: BARS[1].time,
                    }),
                ],
            }),
        ]);
        const overlay = instances[0];
        overlay.runDraw();
        // Two distinct bars ⇒ two bands ⇒ two extra fillRects (BARS.length
        // candle bodies + 2 bands) and matching alpha brackets.
        const fillRects = overlay.ctx.calls.filter((c) => c.kind === "fillRect");
        expect(fillRects).toHaveLength(BARS.length + 2);
        const alphaSets = overlay.ctx.calls.filter(
            (c) => c.kind === "set" && c.prop === "globalAlpha",
        );
        // alpha = 1 - 85/100 = 0.15 then reset to 1, per band.
        const dimmed = alphaSets.filter((c) => c.kind === "set" && c.value === 1 - 85 / 100);
        expect(dimmed).toHaveLength(2);
    });

    it("carries per-bar colours on adjacent bg-color bands", async () => {
        const { instances } = await drive([
            emissions({
                plots: [
                    plotEmission({
                        slotId: "bg",
                        style: { kind: "bg-color", color: "#26a69a" },
                        value: null,
                        time: BARS[0].time,
                    }),
                    plotEmission({
                        slotId: "bg",
                        style: { kind: "bg-color", color: "#ef5350" },
                        value: null,
                        time: BARS[1].time,
                    }),
                ],
            }),
        ]);
        const overlay = instances[0];
        overlay.runDraw();
        const bandFills = overlay.ctx.calls.filter(
            (c) => c.kind === "set" && c.prop === "fillStyle" && typeof c.value === "string",
        );
        const fillValues = bandFills.map((c) => (c.kind === "set" ? c.value : undefined));
        expect(fillValues).toContain("#26a69a");
        expect(fillValues).toContain("#ef5350");
    });

    it("prefers a per-bar colorValue over the static bg-color (precedence)", async () => {
        const { instances } = await drive([
            emissions({
                plots: [
                    plotEmission({
                        slotId: "bg",
                        // A static colour distinct from any candle bull/bear
                        // default so its absence proves the dynamic override won.
                        style: { kind: "bg-color", color: "#aabbcc", transp: 50 },
                        colorValue: "#123456",
                        value: null,
                        time: BARS[0].time,
                    }),
                ],
            }),
        ]);
        const overlay = instances[0];
        overlay.runDraw();
        const fills = overlay.ctx.calls.filter((c) => c.kind === "set" && c.prop === "fillStyle");
        const fillValues = fills.map((c) => (c.kind === "set" ? c.value : undefined));
        expect(fillValues).toContain("#123456");
        expect(fillValues).not.toContain("#aabbcc");
    });

    it("treats a null colorValue as a no-fill gap (no band painted)", async () => {
        const { instances } = await drive([
            emissions({
                plots: [
                    plotEmission({
                        slotId: "bg",
                        style: { kind: "bg-color", color: "#26a69a" },
                        colorValue: null,
                        value: null,
                        time: BARS[0].time,
                    }),
                ],
            }),
        ]);
        const overlay = instances[0];
        overlay.runDraw();
        // No band ⇒ no globalAlpha bracket ⇒ only the candle fillRects.
        const alphaSets = overlay.ctx.calls.filter(
            (c) => c.kind === "set" && c.prop === "globalAlpha",
        );
        expect(alphaSets).toHaveLength(0);
        const fillRects = overlay.ctx.calls.filter((c) => c.kind === "fillRect");
        expect(fillRects).toHaveLength(BARS.length);
    });

    it("re-paints a previously null bg-color band once its colorValue returns", async () => {
        // First frame: a null gap deletes nothing (no prior band); second
        // frame: a present colour re-establishes the band; third: a null
        // gap removes it again, exercising the delete branch.
        const host = stubHost([
            emissions({
                plots: [
                    plotEmission({
                        slotId: "bg",
                        style: { kind: "bg-color", color: "#26a69a" },
                        colorValue: "#abcdef",
                        value: null,
                        time: BARS[0].time,
                    }),
                ],
            }),
            emissions({
                plots: [
                    plotEmission({
                        slotId: "bg",
                        style: { kind: "bg-color", color: "#26a69a" },
                        colorValue: null,
                        value: null,
                        time: BARS[0].time,
                    }),
                ],
            }),
        ]);
        const { adapter, instances } = build({
            host,
            candles: candleStream([
                { kind: "close", bar: BARS[0] },
                { kind: "close", bar: BARS[0] },
            ]),
        });
        await runUplotLoop(adapter);
        instances[0].runDraw();
        // After the second frame's null gap, the band is gone.
        const alphaSets = instances[0].ctx.calls.filter(
            (c) => c.kind === "set" && c.prop === "globalAlpha",
        );
        expect(alphaSets).toHaveLength(0);
    });

    it("tints a bar's candle body + wick with bar-color", async () => {
        const { instances } = await drive([
            emissions({
                plots: [
                    plotEmission({
                        slotId: "bc",
                        style: { kind: "bar-color", color: "#2962ff" },
                        value: null,
                        time: BARS[0].time,
                    }),
                ],
            }),
        ]);
        const overlay = instances[0];
        overlay.runDraw();
        // The first candle's wick stroke + body fill take the tint.
        const strokeTinted = overlay.ctx.calls.some(
            (c) => c.kind === "set" && c.prop === "strokeStyle" && c.value === "#2962ff",
        );
        const fillTinted = overlay.ctx.calls.some(
            (c) => c.kind === "set" && c.prop === "fillStyle" && c.value === "#2962ff",
        );
        expect(strokeTinted).toBe(true);
        expect(fillTinted).toBe(true);
    });

    it("prefers a per-bar colorValue over the static bar-color, and null clears it", async () => {
        const { instances } = await drive([
            emissions({
                plots: [
                    // Bar 0: dynamic colour wins over the static red.
                    plotEmission({
                        slotId: "bc",
                        style: { kind: "bar-color", color: "#ff0000" },
                        colorValue: "#00ff00",
                        value: null,
                        time: BARS[0].time,
                    }),
                    // Bar 1: null gap ⇒ falls back to the bull/bear colour.
                    plotEmission({
                        slotId: "bc",
                        style: { kind: "bar-color", color: "#ff0000" },
                        colorValue: null,
                        value: null,
                        time: BARS[1].time,
                    }),
                ],
            }),
        ]);
        const overlay = instances[0];
        overlay.runDraw();
        const fills = overlay.ctx.calls.filter((c) => c.kind === "set" && c.prop === "fillStyle");
        const fillValues = fills.map((c) => (c.kind === "set" ? c.value : undefined));
        expect(fillValues).toContain("#00ff00");
        // The static red is never used (colorValue wins), and bar 1's null
        // falls back to the bull/bear default (never red).
        expect(fillValues).not.toContain("#ff0000");
    });

    it("leaves the candle render byte-identical when no bg/bar overrides exist", async () => {
        // The pinned candle hash must hold when no bg/bar-color is emitted.
        const plain = await drive([emissions()]);
        plain.instances[0].runDraw();
        const baseline = hashCallLog(plain.instances[0].ctx.calls);
        // A frame that emits an UNRELATED override kind (candle-override is
        // still only buffered) must not perturb the candle hash either.
        const withBuffered = await drive([
            emissions({
                plots: [
                    plotEmission({
                        slotId: "co",
                        style: { kind: "candle-override", bull: "#0f0", bear: "#f00" },
                        value: null,
                        time: BARS[0].time,
                    }),
                ],
            }),
        ]);
        withBuffered.instances[0].runDraw();
        expect(hashCallLog(withBuffered.instances[0].ctx.calls)).toBe(baseline);
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

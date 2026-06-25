// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import {
    type CandleEvent,
    type PlotEmission,
    type RunnerEmissions,
    mockCandleSource,
} from "@invinite-org/chartlang-adapter-kit";
import type { Bar } from "@invinite-org/chartlang-core";
import type { HostCompiledScript, ScriptHost } from "@invinite-org/chartlang-host-worker";
import { describe, expect, it, vi } from "vitest";

import defaultAdapter, {
    DEFAULT_ADAPTER,
    WEBGL_CAPABILITIES,
    WEBGL_SYM_INFO,
    createWebglAdapter,
    runWebglLoop,
} from "./index.js";

function emptyEmissions(): RunnerEmissions {
    return {
        plots: [],
        drawings: [],
        alerts: [],
        alertConditions: [],
        logs: [],
        diagnostics: [],
        fromBar: 0,
        toBar: 0,
    };
}

// In-process stub `ScriptHost` so the headless tests never spin up a real
// Web Worker. It records `push`ed events + `drain` count and lets the
// caller inspect `disposed`.
type StubHost = ScriptHost & {
    readonly pushed: CandleEvent[];
    readonly state: { disposed: boolean; drains: number };
};

function stubHost(): StubHost {
    const pushed: CandleEvent[] = [];
    const state = { disposed: false, drains: 0 };
    const host: ScriptHost = {
        limits: { maxHeapBytes: 0, maxCpuMsPerStep: 0, maxRingBufferBars: 0 },
        load: async (_c: HostCompiledScript) => {},
        push: async (e: CandleEvent) => {
            pushed.push(e);
        },
        setPlotOverrides: () => {},
        drain: async () => {
            state.drains += 1;
            return emptyEmissions();
        },
        dispose: () => {
            state.disposed = true;
        },
    };
    return Object.assign(host, { pushed, state });
}

const bar = (time: number): Bar => ({
    time,
    open: 10,
    high: 12,
    low: 9,
    close: 11,
    volume: 100,
    point: () => ({ time, price: 11 }),
});

// Recording stub `WebGL2RenderingContext` — the surface the renderer's
// begin-frame + per-pane draw touch, with the enum constants those calls read.
function stubGl(): WebGL2RenderingContext {
    const gl = {
        SCISSOR_TEST: 0x0c11,
        BLEND: 0x0be2,
        COLOR_BUFFER_BIT: 0x4000,
        SRC_ALPHA: 0x0302,
        ONE_MINUS_SRC_ALPHA: 0x0303,
        ONE: 1,
        disable: vi.fn(),
        enable: vi.fn(),
        clearColor: vi.fn(),
        clear: vi.fn(),
        blendFuncSeparate: vi.fn(),
        viewport: vi.fn(),
        scissor: vi.fn(),
    };
    return gl as unknown as WebGL2RenderingContext;
}

// One synthetic line plot on the overlay pane, enough to accumulate a series
// and (with a gl seam) produce a candle-less line-strip descriptor.
function linePlot(time: number, value: number): PlotEmission {
    return {
        kind: "plot",
        slotId: "ema#0",
        pane: "overlay",
        bar: 0,
        time,
        value,
        color: "#90caf9",
        style: { kind: "line", lineWidth: 1, lineStyle: "solid" },
    } as unknown as PlotEmission;
}

describe("public surface", () => {
    it("re-exports the factory, loop, capabilities, and default adapter", () => {
        expect(typeof createWebglAdapter).toBe("function");
        expect(typeof runWebglLoop).toBe("function");
        expect(WEBGL_CAPABILITIES.plots.has("line")).toBe(true);
        expect(WEBGL_SYM_INFO.ticker).toBe("DEMO");
        expect(DEFAULT_ADAPTER.id).toBe("webgl-reference-default");
    });

    it("default export is the headless DEFAULT_ADAPTER", () => {
        expect(defaultAdapter).toBe(DEFAULT_ADAPTER);
    });
});

describe("createWebglAdapter — construction", () => {
    it("constructs headlessly from { width, height } with no GL context", () => {
        const adapter = createWebglAdapter({
            canvas: { width: 320, height: 240 },
            candleSource: mockCandleSource([]),
            host: stubHost(),
        });
        expect(adapter.id).toBe("webgl-reference");
        expect(adapter.capabilities.plots.has("line")).toBe(true);
    });

    it("exposes the host on the returned handle", () => {
        const host = stubHost();
        const adapter = createWebglAdapter({
            canvas: { width: 320, height: 240 },
            candleSource: mockCandleSource([]),
            host,
        });
        expect(adapter.host).toBe(host);
    });

    it("uses the supplied capabilities override", () => {
        const adapter = createWebglAdapter({
            canvas: { width: 10, height: 10 },
            candleSource: mockCandleSource([]),
            capabilities: WEBGL_CAPABILITIES,
            host: stubHost(),
        });
        expect(adapter.capabilities).toBe(WEBGL_CAPABILITIES);
    });

    it("dispose() is idempotent", () => {
        const host = stubHost();
        const adapter = createWebglAdapter({
            canvas: { width: 10, height: 10 },
            candleSource: mockCandleSource([]),
            host,
        });
        adapter.dispose();
        adapter.dispose();
        expect(host.state.disposed).toBe(true);
    });
});

describe("runWebglLoop", () => {
    it("drains a mockCandleSource through the host", async () => {
        const host = stubHost();
        const bars = [bar(1), bar(2), bar(3)];
        const adapter = createWebglAdapter({
            canvas: { width: 320, height: 240 },
            candleSource: mockCandleSource(bars, { mode: "stream", interval: "1D" }),
            host,
        });
        await runWebglLoop(adapter);
        expect(host.pushed.length).toBe(bars.length);
        expect(host.state.drains).toBe(bars.length);
    });

    it("returns silently when the signal is already aborted", async () => {
        const host = stubHost();
        const controller = new AbortController();
        controller.abort();
        const adapter = createWebglAdapter({
            canvas: { width: 10, height: 10 },
            candleSource: mockCandleSource([bar(1)], { mode: "stream", interval: "1D" }),
            host,
        });
        await runWebglLoop(adapter, { signal: controller.signal });
        expect(host.pushed.length).toBe(0);
    });

    it("throws on a foreign handle", async () => {
        await expect(runWebglLoop({ host: stubHost() } as never)).rejects.toThrow(
            "handle was not produced by createWebglAdapter",
        );
    });
});

describe("createWebglAdapter — onEmissions wiring", () => {
    it("ingests emissions without throwing when headless (no gl, no-op draw)", () => {
        const adapter = createWebglAdapter({
            canvas: { width: 320, height: 240 },
            candleSource: mockCandleSource([]),
            host: stubHost(),
        });
        expect(() =>
            adapter.onEmissions({ ...emptyEmissions(), plots: [linePlot(1, 42)] }),
        ).not.toThrow();
    });

    it("drives the renderer draw path when a gl seam is supplied", () => {
        const gl = stubGl();
        const adapter = createWebglAdapter({
            canvas: { width: 320, height: 240 },
            gl,
            candleSource: mockCandleSource([]),
            host: stubHost(),
        });
        // Seed a bar so buildFrame produces a non-empty overlay window, then a
        // line plot so there is a descriptor to dispatch. The draw is rAF-
        // coalesced, but node has no rAF; the begin-frame clear only fires on a
        // synchronous draw — so assert the wiring did not throw and the host
        // teardown stays clean. (The synchronous draw path is unit-tested on
        // the Renderer directly.)
        expect(() =>
            adapter.onEmissions({ ...emptyEmissions(), plots: [linePlot(1, 42)] }),
        ).not.toThrow();
        // No rAF in node ⇒ no synchronous clear; the seam is wired but not
        // forced here.
        expect((gl as unknown as { clear: ReturnType<typeof vi.fn> }).clear).not.toHaveBeenCalled();
    });

    it("dispose() with a gl seam is idempotent and tears down the host", () => {
        const host = stubHost();
        const adapter = createWebglAdapter({
            canvas: { width: 320, height: 240 },
            gl: stubGl(),
            candleSource: mockCandleSource([]),
            host,
        });
        adapter.dispose();
        adapter.dispose();
        expect(host.state.disposed).toBe(true);
    });

    it("threads opts.palette + initialVisibleBars into state without throwing", () => {
        const adapter = createWebglAdapter({
            canvas: { width: 320, height: 240 },
            candleSource: mockCandleSource([]),
            palette: {
                background: "#000000",
                candleBullBody: "#11aa22",
                candleBearBody: "#aa1122",
                candleWick: "#cccccc",
                gridLine: "#222222",
                paneBorder: "#333333",
                plotDefault: "#4488ff",
                alertInfo: "#2196f3",
                alertWarning: "#ff9800",
                alertCritical: "#f44336",
            },
            initialVisibleBars: 120,
            host: stubHost(),
        });
        expect(() =>
            adapter.onEmissions({ ...emptyEmissions(), plots: [linePlot(1, 42)] }),
        ).not.toThrow();
    });
});

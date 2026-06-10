// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
import type { RunnerEmissions } from "@invinite-org/chartlang-adapter-kit";
import { compileFile } from "@invinite-org/chartlang-compiler";
import type { Bar, ScriptManifest } from "@invinite-org/chartlang-core";
import {
    type ScriptHost,
    type WorkerBootScope,
    type WorkerLike,
    createWorkerBoot,
    createWorkerHost,
} from "@invinite-org/chartlang-host-worker";
import { describe, expect, it } from "vitest";

import { CANVAS2D_CAPABILITIES, CANVAS2D_SYM_INFO } from "./capabilities.js";
import { createCanvas2dAdapter, runRendererLoop } from "./createCanvas2dAdapter.js";
import { createMultiStreamCandlePump } from "./streamPump.js";
import { MockCanvas2DContext, hashCallLog } from "./testing.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolvePath(here, "../../..");

/**
 * Pair a `MessageChannel`-backed `WorkerLike` (port1, used by the host)
 * with a `WorkerBootScope` (port2, used by the boot factory). Cribbed
 * from `@invinite-org/chartlang-host-worker`'s integration test.
 */
function pair(): { worker: WorkerLike; scope: WorkerBootScope } {
    const ch = new MessageChannel();
    ch.port1.start();
    ch.port2.start();
    const worker: WorkerLike = {
        addEventListener(type, listener) {
            if (type !== "message") return;
            ch.port1.addEventListener("message", (ev) => {
                listener(ev as MessageEvent<unknown>);
            });
        },
        postMessage(msg) {
            ch.port1.postMessage(msg);
        },
        terminate() {
            ch.port1.close();
            ch.port2.close();
        },
    };
    const scope: WorkerBootScope = {
        addEventListener(_type, listener) {
            ch.port2.addEventListener("message", (ev) => {
                void listener(ev as MessageEvent<never>);
            });
        },
        postMessage(msg) {
            ch.port2.postMessage(msg);
        },
    };
    return { worker, scope };
}

const MS_PER_DAY = 86_400_000;
const START_TIME = 1_700_000_000_000;

function bar(i: number, open: number, high: number, low: number, close: number): Bar {
    const hl2 = (high + low) / 2;
    const hlc3 = (high + low + close) / 3;
    return {
        time: START_TIME + i * MS_PER_DAY,
        open,
        high,
        low,
        close,
        volume: 1_000 + i,
        symbol: "EMA-X",
        interval: "1D",
        hl2,
        hlc3,
        ohlc4: (open + high + low + close) / 4,
        hlcc4: (high + low + close + close) / 4,
    };
}

/**
 * 120-bar dataset shaped so a 12-bar EMA crosses a 26-bar EMA in
 * both directions. The series starts with a 40-bar downtrend
 * (settles both EMAs aligned with falling price, fast EMA pinned
 * below slow EMA post-warmup), then a 40-bar uptrend (fast EMA
 * accelerates upward through the slow — crossover), then a 40-bar
 * downtrend (fast EMA falls back through the slow — crossunder).
 */
const HISTORY_BARS: ReadonlyArray<Bar> = Array.from({ length: 120 }, (_, i) => {
    const phase = Math.floor(i / 40); // 0 → down, 1 → up, 2 → down
    const within = i % 40;
    const close =
        phase === 0 ? 120 - within * 0.5 : phase === 1 ? 100 + within * 0.5 : 120 - within * 0.5;
    return bar(i, close - 0.5, close + 1, close - 1, close);
});

const EMA_CROSS_MANIFEST: ScriptManifest = {
    apiVersion: 1,
    kind: "indicator",
    name: "EMA Cross (integration fixture)",
    inputs: {},
    capabilities: ["indicators"],
    requestedIntervals: [],
    userPickableInterval: false,
    seriesCapacities: { ohlcv: 128 },
    maxLookback: 26,
};

/**
 * Hand-crafted compiled-bundle source equivalent to the EMA-cross
 * example script (`tasks/phase-1-walking-skeleton/11-examples-and-cli.md`
 * §1). Calls the runtime's slot-aware `ctx.ta.ema` / `ctx.plot` /
 * `ctx.alert` directly so the bundle has no static imports — the
 * data-URL `import(...)` path the worker uses cannot resolve workspace
 * specifiers. Task 12's CLI-driven pipeline (using `esbuild.build` with
 * a resolver) will exercise the real on-disk bundle.
 */
const EMA_CROSS_MODULE_SOURCE = `
export default {
    manifest: ${JSON.stringify(EMA_CROSS_MANIFEST)},
    compute: (ctx) => {
        const fast = ctx.ta.ema("ema-cross.chart.ts:5:22#0", ctx.bar.close, 12);
        const slow = ctx.ta.ema("ema-cross.chart.ts:6:22#0", ctx.bar.close, 26);
        ctx.plot("ema-cross.chart.ts:7:9#0", fast, { color: "#26a69a", title: "EMA(12)" });
        ctx.plot("ema-cross.chart.ts:8:9#0", slow, { color: "#ef5350", title: "EMA(26)" });
        const co = ctx.ta.crossover("ema-cross.chart.ts:9:16#0", fast, slow);
        const cu = ctx.ta.crossunder("ema-cross.chart.ts:12:16#0", fast, slow);
        if (co.current) {
            ctx.alert("ema-cross.chart.ts:10:13#0", "EMA(12) crossed above EMA(26)", { severity: "info" });
        }
        if (cu.current) {
            ctx.alert("ema-cross.chart.ts:13:13#0", "EMA(12) crossed below EMA(26)", { severity: "warning" });
        }
    },
};
`;

const MTF_MANIFEST: ScriptManifest = {
    apiVersion: 1,
    kind: "indicator",
    name: "MTF close (integration fixture)",
    inputs: {},
    capabilities: ["indicators"],
    requestedIntervals: ["1D"],
    userPickableInterval: false,
    seriesCapacities: { ohlcv: 16 },
    maxLookback: 4,
};

const MTF_MODULE_SOURCE = `
export default {
    manifest: ${JSON.stringify(MTF_MANIFEST)},
    compute: (ctx) => {
        const daily = ctx.request.security("mtf.chart.ts:5:23#0", { interval: "1D" });
        ctx.plot("mtf.chart.ts:6:9#0", daily.close, { color: "#2563eb", title: "Daily close" });
    },
};
`;

type CapturedRun = {
    readonly emissions: ReadonlyArray<RunnerEmissions>;
    readonly alerts: ReadonlyArray<unknown>;
    readonly workerErrors: ReadonlyArray<string>;
};

function phase4ModuleSource(relPath: string, manifest: ScriptManifest): string {
    const manifestJson = JSON.stringify(manifest);
    if (relPath.endsWith("session-high-alert.chart.ts")) {
        return `
const manifest = ${manifestJson};
export default {
    manifest,
    compute: (ctx) => {
        const high = ctx.state.float("session-high-alert.chart.ts:18:22#0", NaN);
        const isSessionOpen = ctx.barstate.isfirst || ctx.bar.time % 86400000 === 0;
        if (isSessionOpen) {
            high.value = ctx.bar.high;
        } else if (Number.isNaN(high.value) || ctx.bar.high > high.value) {
            high.value = ctx.bar.high;
        }
        ctx.plot("session-high-alert.chart.ts:25:9#0", high.value, {
            color: "#ff9900",
            title: "Session high",
        });
        if (
            ctx.inputs.alertOnCross &&
            ctx.ta.crossover("session-high-alert.chart.ts:26:36#0", ctx.bar.close, high.value).current
        ) {
            ctx.alert("session-high-alert.chart.ts:27:13#0", "Close crossed session high", {
                severity: "info",
            });
        }
    },
};
`;
    }
    if (relPath.endsWith("daily-rsi-divergence.chart.ts")) {
        return `
const manifest = ${manifestJson};
export default {
    manifest,
    compute: (ctx) => {
        if (!ctx.timeframe.isdaily) return;
        const rsi = ctx.ta.rsi("daily-rsi-divergence.chart.ts:19:21#0", ctx.bar.close, ctx.inputs.length);
        const barsSince = ctx.state.int("daily-rsi-divergence.chart.ts:20:27#0", 0);
        const overbought = rsi.current > 70;
        const oversold = rsi.current < 30;
        barsSince.value = overbought || oversold ? 0 : barsSince.value + 1;
        ctx.plot("daily-rsi-divergence.chart.ts:24:9#0", rsi.current, {
            color: "#7c3aed",
            title: "RSI",
            pane: "rsi",
        });
        ctx.plot("daily-rsi-divergence.chart.ts:25:9#0", barsSince.value, {
            color: "#94a3b8",
            title: "Bars since divergence",
            pane: "rsi",
        });
    },
};
`;
    }
    if (relPath.endsWith("mintick-snapped-entry.chart.ts")) {
        return `
const manifest = ${manifestJson};
export default {
    manifest,
    compute: (ctx) => {
        const target = ctx.bar.close * (1 + ctx.inputs.offsetPercent / 100);
        if (!Number.isFinite(ctx.syminfo.mintick)) {
            ctx.plot("mintick-snapped-entry.chart.ts:20:13#0", target, {
                color: "#10b981",
                title: "Target (raw)",
            });
            return;
        }
        const snapped = Math.round(target / ctx.syminfo.mintick) * ctx.syminfo.mintick;
        ctx.plot("mintick-snapped-entry.chart.ts:25:9#0", snapped, {
            color: "#10b981",
            title: "Target (snapped)",
        });
    },
};
`;
    }
    throw new Error(`no Phase-4 module fixture for ${relPath}`);
}

function captureHost(host: ScriptHost, emissions: RunnerEmissions[]): ScriptHost {
    return Object.freeze({
        load: host.load,
        push: host.push,
        async drain() {
            const next = await host.drain();
            emissions.push(next);
            return next;
        },
        dispose: host.dispose,
        limits: host.limits,
    });
}

function hasErrorDiagnostics(emissions: ReadonlyArray<RunnerEmissions>): boolean {
    return emissions.some((frame) => frame.diagnostics.some((d) => d.severity === "error"));
}

async function runExampleScript(
    relPath: string,
    bars: ReadonlyArray<Bar>,
    opts: {
        readonly interval?: string;
        readonly resolveInputs?: (scriptId: string) => Readonly<Record<string, unknown>>;
    } = {},
): Promise<CapturedRun> {
    const { worker, scope } = pair();
    createWorkerBoot(scope);
    const emissions: RunnerEmissions[] = [];
    const workerErrors: string[] = [];
    const alerts: unknown[] = [];
    const host = captureHost(
        createWorkerHost({
            capabilities: CANVAS2D_CAPABILITIES,
            symInfo: CANVAS2D_SYM_INFO,
            ...(opts.resolveInputs !== undefined ? { resolveInputs: opts.resolveInputs } : {}),
            workerLike: worker,
            onWorkerError: (m) => workerErrors.push(m),
        }),
        emissions,
    );
    const ctx = new MockCanvas2DContext();
    const adapter = createCanvas2dAdapter({
        canvas: { width: 640, height: 320 },
        ctx,
        candleSource: mockCandleSource(bars, {
            interval: opts.interval ?? "1D",
            mode: "stream",
        }),
        capabilities: CANVAS2D_CAPABILITIES,
        host,
        ...(opts.interval !== undefined ? { interval: opts.interval } : {}),
        ...(opts.resolveInputs !== undefined ? { resolveInputs: opts.resolveInputs } : {}),
        onAlert: (a) => alerts.push(a),
    });

    const compiled = await compileFile(resolvePath(REPO_ROOT, relPath), {
        apiVersion: 1,
        write: false,
    });
    await adapter.host.load({
        manifest: compiled.manifest,
        moduleSource: phase4ModuleSource(relPath, compiled.manifest),
    });
    await runRendererLoop(adapter);
    adapter.dispose();

    return { emissions, alerts, workerErrors };
}

function phase4Bar(i: number, close: number, interval: string): Bar {
    const open = close - 0.5;
    const high = close + 1;
    const low = close - 1;
    const hl2 = (high + low) / 2;
    const hlc3 = (high + low + close) / 3;
    return {
        time: START_TIME + i * MS_PER_DAY,
        open,
        high,
        low,
        close,
        volume: 2_000 + i,
        symbol: "DEMO",
        interval,
        hl2,
        hlc3,
        ohlc4: (open + high + low + close) / 4,
        hlcc4: (high + low + close + close) / 4,
    };
}

const PHASE4_DAILY_BARS: ReadonlyArray<Bar> = Array.from({ length: 24 }, (_, i) =>
    phase4Bar(i, i < 12 ? 100 + i * 2 : 124 - (i - 12) * 3, "1D"),
);

const PHASE4_INTRADAY_BARS: ReadonlyArray<Bar> = PHASE4_DAILY_BARS.map((b) => ({
    ...b,
    interval: "5m",
}));

const SESSION_ALERT_BARS: ReadonlyArray<Bar> = [
    {
        ...phase4Bar(0, 100, "1D"),
        time: START_TIME + 1,
        high: 105,
        hl2: 102,
        hlc3: 101.66666666666667,
        ohlc4: 101.125,
        hlcc4: 100.83333333333333,
    },
    {
        ...phase4Bar(1, 106, "1D"),
        time: START_TIME + MS_PER_DAY + 1,
        high: 105,
        hl2: 102,
        hlc3: 105.33333333333333,
        ohlc4: 103.875,
        hlcc4: 105.5,
    },
];

function mtfBar(i: number, close: number, interval: string): Bar {
    const open = close - 0.25;
    const high = close + 0.5;
    const low = close - 0.5;
    const hl2 = (high + low) / 2;
    const hlc3 = (high + low + close) / 3;
    return {
        time: START_TIME + i * 60_000,
        open,
        high,
        low,
        close,
        volume: 5_000 + i,
        symbol: "DEMO",
        interval,
        hl2,
        hlc3,
        ohlc4: (open + high + low + close) / 4,
        hlcc4: (high + low + close + close) / 4,
    };
}

const MTF_MAIN_BARS: ReadonlyArray<Bar> = [
    mtfBar(0, 100, "1m"),
    mtfBar(1, 101, "1m"),
    mtfBar(2, 102, "1m"),
    mtfBar(3, 103, "1m"),
];

const MTF_DAILY_BARS: ReadonlyArray<Bar> = [mtfBar(0, 201, "1D"), mtfBar(2, 222, "1D")];

describe("canvas2d adapter integration", () => {
    it("drives an EMA-cross-equivalent compiled bundle through the worker shim and renders to the mock canvas", async () => {
        const { worker, scope } = pair();
        createWorkerBoot(scope);
        const workerErrors: string[] = [];
        const host = createWorkerHost({
            capabilities: CANVAS2D_CAPABILITIES,
            workerLike: worker,
            onWorkerError: (m) => workerErrors.push(m),
        });

        const ctx = new MockCanvas2DContext();
        const alertsReceived: unknown[] = [];
        const adapter = createCanvas2dAdapter({
            canvas: { width: 800, height: 400 },
            ctx,
            // Stream mode — one `close` event per bar so `runRendererLoop`
            // drains between bars and the adapter sees per-bar alert /
            // plot emissions (per PLAN §6.7: onBarClose resets the
            // emissions queue at the start of each bar).
            candleSource: mockCandleSource(HISTORY_BARS, {
                interval: "1D",
                mode: "stream",
            }),
            capabilities: CANVAS2D_CAPABILITIES,
            host,
            onAlert: (a) => alertsReceived.push(a),
        });

        await adapter.host.load({
            moduleSource: EMA_CROSS_MODULE_SOURCE,
            manifest: EMA_CROSS_MANIFEST,
        });
        await runRendererLoop(adapter);

        // Structural assertions — every Phase-1 primitive surface lights up.
        const fillRects = ctx.calls.filter((c) => c.kind === "fillRect").length;
        const strokes = ctx.calls.filter((c) => c.kind === "stroke").length;
        const arcs = ctx.calls.filter((c) => c.kind === "arc").length;
        expect(workerErrors).toEqual([]);
        expect(fillRects).toBeGreaterThanOrEqual(HISTORY_BARS.length); // candle bodies
        expect(strokes).toBeGreaterThanOrEqual(HISTORY_BARS.length + 2); // wicks + ≥1 polyline
        expect(arcs).toBeGreaterThanOrEqual(1); // at least one alert badge
        expect(alertsReceived.length).toBeGreaterThanOrEqual(1);

        // Pinned hash — re-snap after a deliberate visual change by
        // reading the new value off this assertion's failure message.
        const hash = hashCallLog(ctx.calls);
        expect(hash).toBe(PINNED_HASH);

        adapter.dispose();
    });

    it("drives Phase-4 Pine-port scripts through canvas2d with plots and no errors", async () => {
        const cases = [
            "examples/scripts/session-high-alert.chart.ts",
            "examples/scripts/daily-rsi-divergence.chart.ts",
            "examples/scripts/mintick-snapped-entry.chart.ts",
        ] as const;

        for (const relPath of cases) {
            const run = await runExampleScript(relPath, PHASE4_DAILY_BARS);
            const plotCount = run.emissions.reduce((sum, frame) => sum + frame.plots.length, 0);
            expect(run.workerErrors).toEqual([]);
            expect(hasErrorDiagnostics(run.emissions)).toBe(false);
            expect(plotCount).toBeGreaterThan(0);
        }
    });

    it("emits a session-high alert on crossover", async () => {
        const run = await runExampleScript(
            "examples/scripts/session-high-alert.chart.ts",
            SESSION_ALERT_BARS,
        );
        expect(run.workerErrors).toEqual([]);
        expect(hasErrorDiagnostics(run.emissions)).toBe(false);
        expect(run.alerts.length).toBeGreaterThan(0);
    });

    it("short-circuits daily RSI divergence on non-daily streams", async () => {
        const run = await runExampleScript(
            "examples/scripts/daily-rsi-divergence.chart.ts",
            PHASE4_INTRADAY_BARS,
            { interval: "5m" },
        );
        const plotCount = run.emissions.reduce((sum, frame) => sum + frame.plots.length, 0);
        expect(run.workerErrors).toEqual([]);
        expect(hasErrorDiagnostics(run.emissions)).toBe(false);
        expect(plotCount).toBe(0);
    });

    it("routes 1D request.security data through a 1m canvas2d stream", async () => {
        const { worker, scope } = pair();
        createWorkerBoot(scope);
        const emissions: RunnerEmissions[] = [];
        const workerErrors: string[] = [];
        const host = captureHost(
            createWorkerHost({
                capabilities: CANVAS2D_CAPABILITIES,
                symInfo: CANVAS2D_SYM_INFO,
                workerLike: worker,
                onWorkerError: (m) => workerErrors.push(m),
            }),
            emissions,
        );
        const ctx = new MockCanvas2DContext();
        const adapter = createCanvas2dAdapter({
            canvas: { width: 640, height: 320 },
            ctx,
            candleSource: createMultiStreamCandlePump({
                main: mockCandleSource(MTF_MAIN_BARS, {
                    interval: "1m",
                    mode: "stream",
                }),
                secondary: { "1D": MTF_DAILY_BARS },
            }),
            capabilities: CANVAS2D_CAPABILITIES,
            host,
            interval: "1m",
        });

        await adapter.host.load({
            moduleSource: MTF_MODULE_SOURCE,
            manifest: MTF_MANIFEST,
        });
        await runRendererLoop(adapter);

        const values = emissions.flatMap((frame) => frame.plots.map((plot) => plot.value));
        const diagnostics = emissions.flatMap((frame) => frame.diagnostics.map((d) => d.code));
        expect(workerErrors).toEqual([]);
        expect(diagnostics).toEqual([]);
        expect(values).toEqual([201, 201, 222, 222]);
        expect(ctx.calls.filter((call) => call.kind === "fillRect").length).toBeGreaterThanOrEqual(
            MTF_MAIN_BARS.length,
        );

        adapter.dispose();
    });
});

// Pinned by the integration test; update only when a deliberate visual
// change re-shapes the renderer's draw sequence. The hash canonicalises
// floats to 4 decimal places (see `hashCallLog` in `./testing`) so
// microscopic numeric drift does not re-hash the log.
const PINNED_HASH = "a7f041f1ce9b818d5578db39b4021a54632a86ea3a5cb5b35625aa2400934d5f";

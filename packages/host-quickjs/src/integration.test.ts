// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities, PlotOverride } from "@invinite-org/chartlang-adapter-kit";
import type { Bar, ScriptManifest } from "@invinite-org/chartlang-core";
import { feedKey } from "@invinite-org/chartlang-core";
import { createWorkerBoot, createWorkerHost } from "@invinite-org/chartlang-host-worker";
import type {
    HostCompiledScript,
    WorkerBootScope,
    WorkerLike,
} from "@invinite-org/chartlang-host-worker";
import { describe, expect, it } from "vitest";

import { createQuickJsHost } from "./createQuickJsHost.js";

type ScriptFixture = Readonly<{
    name: string;
    source: string;
    manifest: ScriptManifest;
}>;

function makeCapabilities(): Capabilities {
    return {
        plots: capabilities.allLines(),
        drawings: capabilities.allPhase3Drawings(),
        alerts: new Set(["default"]),
        alertConditions: false,
        logs: false,
        inputs: new Set(),
        intervals: [],
        multiTimeframe: false,
        multiSymbol: false,
        subPanes: 0,
        symInfoFields: new Set(),
        maxDrawingsPerScript: { lines: 10, labels: 10, boxes: 10, polylines: 10, other: 10 },
        maxLookback: 5_000,
        maxTickHz: 10,
    };
}

function manifest(name: string): ScriptManifest {
    return {
        apiVersion: 1,
        kind: "indicator",
        name,
        inputs: {},
        capabilities: ["indicators"],
        requestedIntervals: [],
        userPickableInterval: false,
        seriesCapacities: { ohlcv: 32 },
        maxLookback: 10,
    };
}

function bars(count: number): ReadonlyArray<Bar> {
    return Array.from({ length: count }, (_, index) => {
        const close = index + 1;
        const open = close - 0.5;
        const high = close + 1;
        const low = close - 1;
        return {
            time: index + 1,
            open,
            high,
            low,
            close,
            hl2: (high + low) / 2,
            hlc3: (high + low + close) / 3,
            ohlc4: (open + high + low + close) / 4,
            hlcc4: (high + low + close + close) / 4,
            volume: close * 100,
            symbol: "X",
            interval: "1m",
        };
    });
}

function pair(): { worker: WorkerLike; scope: WorkerBootScope } {
    const ch = new MessageChannel();
    ch.port1.start();
    ch.port2.start();
    return {
        worker: {
            addEventListener(_type, listener) {
                ch.port1.addEventListener("message", (ev) => listener(ev as MessageEvent<unknown>));
            },
            postMessage(msg) {
                ch.port1.postMessage(msg);
            },
            terminate() {
                ch.port1.close();
                ch.port2.close();
            },
        },
        scope: {
            addEventListener(_type, listener) {
                ch.port2.addEventListener("message", (ev) => {
                    void listener(ev as MessageEvent<never>);
                });
            },
            postMessage(msg) {
                ch.port2.postMessage(msg);
            },
        },
    };
}

function source(m: ScriptManifest, compute: string): string {
    return `
export default {
    manifest: ${JSON.stringify(m)},
    compute: ${compute},
};
`;
}

const FIXTURES: ReadonlyArray<ScriptFixture> = [
    {
        name: "constant plot",
        manifest: manifest("constant plot"),
        source: source(
            manifest("constant plot"),
            `({ bar, plot }) => { plot("parity.constant:1:1#0", bar.close, {}); }`,
        ),
    },
    {
        name: "ema",
        manifest: manifest("ema"),
        source: source(
            manifest("ema"),
            `({ bar, ta, plot }) => {
                const ema = ta.ema("parity.ema:1:1#0", bar.close, 3);
                plot("parity.ema:1:2#0", ema, {});
            }`,
        ),
    },
    {
        name: "bb",
        manifest: manifest("bb"),
        source: source(
            manifest("bb"),
            `({ bar, ta, plot }) => {
                const bb = ta.bb("parity.bb:1:1#0", bar.close, 3);
                plot("parity.bb:1:2#0", bb.upper, {});
                plot("parity.bb:1:3#0", bb.middle, {});
                plot("parity.bb:1:4#0", bb.lower, {});
            }`,
        ),
    },
    {
        name: "alert",
        manifest: manifest("alert"),
        source: source(
            manifest("alert"),
            `({ bar, alert }) => {
                if (bar.close >= 5) alert("parity.alert:1:1#0", "threshold", {});
            }`,
        ),
    },
    {
        name: "draw line",
        manifest: manifest("draw line"),
        source: source(
            manifest("draw line"),
            `({ bar, draw }) => {
                draw.line(
                    "parity.draw:1:1#0",
                    { time: bar.time, price: bar.low },
                    { time: bar.time, price: bar.high },
                    { color: "#3b82f6" },
                );
            }`,
        ),
    },
];

async function runWorker(fixture: ScriptFixture): Promise<string> {
    const { worker, scope } = pair();
    createWorkerBoot(scope);
    const host = createWorkerHost({
        capabilities: makeCapabilities(),
        workerLike: worker,
    });
    const compiled: HostCompiledScript = {
        moduleSource: fixture.source,
        manifest: fixture.manifest,
    };
    await host.load(compiled);
    await host.push({ kind: "history", bars: bars(10) });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const emissions = await host.drain();
    host.dispose();
    return JSON.stringify(emissions);
}

async function runQuickJs(fixture: ScriptFixture): Promise<string> {
    const host = createQuickJsHost({ capabilities: makeCapabilities() });
    await host.load({
        moduleSource: fixture.source,
        manifest: fixture.manifest,
    });
    await host.push({ kind: "history", bars: bars(10) });
    const emissions = await host.drain();
    host.dispose();
    return JSON.stringify(emissions);
}

const OVERRIDE_FIXTURE: ScriptFixture = {
    name: "plot overrides",
    manifest: manifest("plot overrides"),
    source: source(
        manifest("plot overrides"),
        `({ bar, plot }) => {
            plot("parity.ovr:1:1#0", bar.close, {});
            plot("parity.ovr:1:2#0", bar.high, {});
        }`,
    ),
};

// Mount-time overrides keyed by the fixture's literal slot ids (resolved via
// the host constructor's `resolvePlotOverrides` opt). Slot 1 is hidden; slot 2
// is recolored + thickened. The runtime bakes these into the emission
// (`visible` / `color` / `style.lineWidth`), so the drained JSON must be
// byte-identical across both hosts.
const OVERRIDE_MAP: Readonly<Record<string, PlotOverride>> = {
    "parity.ovr:1:1#0": { visible: false },
    "parity.ovr:1:2#0": { color: "#ff0000", lineWidth: 3 },
};

function resolveOverrides(): Readonly<Record<string, PlotOverride>> {
    return OVERRIDE_MAP;
}

function externalSeriesManifest(): ScriptManifest {
    return {
        ...manifest("external series"),
        inputs: {
            feed: {
                kind: "external-series",
                name: "feed",
                schema: { kind: "external-series-schema" },
            },
        },
    };
}

const EXTERNAL_SERIES_FIXTURE: ScriptFixture = {
    name: "external series",
    manifest: externalSeriesManifest(),
    source: source(
        externalSeriesManifest(),
        `({ inputs, plot }) => {
            plot("parity.external:1:1#0", inputs.feed.current, {});
        }`,
    ),
};

function resolveExternalSeries(): Readonly<
    Record<string, { readonly values: ReadonlyArray<number> }>
> {
    return { feed: { values: [10, 20, 30] } };
}

async function runWorkerWithOverrides(): Promise<string> {
    const { worker, scope } = pair();
    createWorkerBoot(scope);
    const host = createWorkerHost({
        capabilities: makeCapabilities(),
        workerLike: worker,
        resolvePlotOverrides: resolveOverrides,
    });
    await host.load({ moduleSource: OVERRIDE_FIXTURE.source, manifest: OVERRIDE_FIXTURE.manifest });
    await host.push({ kind: "history", bars: bars(10) });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const emissions = await host.drain();
    host.dispose();
    return JSON.stringify(emissions);
}

async function runQuickJsWithOverrides(): Promise<string> {
    const host = createQuickJsHost({
        capabilities: makeCapabilities(),
        resolvePlotOverrides: resolveOverrides,
    });
    await host.load({ moduleSource: OVERRIDE_FIXTURE.source, manifest: OVERRIDE_FIXTURE.manifest });
    await host.push({ kind: "history", bars: bars(10) });
    const emissions = await host.drain();
    host.dispose();
    return JSON.stringify(emissions);
}

async function runWorkerWithExternalSeries(): Promise<string> {
    const { worker, scope } = pair();
    createWorkerBoot(scope);
    const host = createWorkerHost({
        capabilities: { ...makeCapabilities(), inputs: new Set(["external-series"]) },
        workerLike: worker,
        resolveExternalSeries,
    });
    await host.load({
        moduleSource: EXTERNAL_SERIES_FIXTURE.source,
        manifest: EXTERNAL_SERIES_FIXTURE.manifest,
    });
    await host.push({ kind: "close", bar: bars(1)[0] });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const initial = await host.drain();
    host.setExternalSeries({ other: { values: [99, 99] } });
    await host.push({ kind: "close", bar: bars(2)[1] });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const cleared = await host.drain();
    host.setExternalSeries({ feed: { values: [1, 2, 33] } });
    await host.push({ kind: "close", bar: bars(3)[2] });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const restored = await host.drain();
    host.dispose();
    return JSON.stringify([initial, cleared, restored]);
}

async function runQuickJsWithExternalSeries(): Promise<string> {
    const host = createQuickJsHost({
        capabilities: { ...makeCapabilities(), inputs: new Set(["external-series"]) },
        resolveExternalSeries,
    });
    await host.load({
        moduleSource: EXTERNAL_SERIES_FIXTURE.source,
        manifest: EXTERNAL_SERIES_FIXTURE.manifest,
    });
    await host.push({ kind: "close", bar: bars(1)[0] });
    const initial = await host.drain();
    host.setExternalSeries({ other: { values: [99, 99] } });
    await host.push({ kind: "close", bar: bars(2)[1] });
    const cleared = await host.drain();
    host.setExternalSeries({ feed: { values: [1, 2, 33] } });
    await host.push({ kind: "close", bar: bars(3)[2] });
    const restored = await host.drain();
    host.dispose();
    return JSON.stringify([initial, cleared, restored]);
}

function multiSymbolCapabilities(): Capabilities {
    return {
        ...makeCapabilities(),
        intervals: [
            { value: "1m", label: "1 minute", group: "minute" },
            { value: "1D", label: "1 day", group: "daily" },
        ],
        // A different-symbol feed needs BOTH gates open.
        multiTimeframe: true,
        multiSymbol: true,
    };
}

function twoSymbolManifest(): ScriptManifest {
    return {
        ...manifest("spy-qqq-ratio"),
        requestedIntervals: [],
        requestedFeeds: [
            { symbol: "AMEX:SPY", interval: "1D" },
            { symbol: "NASDAQ:QQQ", interval: "1D" },
        ],
        seriesCapacities: { ohlcv: 16 },
        maxLookback: 0,
    };
}

const TWO_SYMBOL_FIXTURE: ScriptFixture = {
    name: "spy-qqq-ratio",
    manifest: twoSymbolManifest(),
    source: source(
        twoSymbolManifest(),
        `({ request, plot }) => {
            const spy = request.security("ratio:1:1#0", { symbol: "AMEX:SPY", interval: "1D" });
            const qqq = request.security("ratio:2:1#0", { symbol: "NASDAQ:QQQ", interval: "1D" });
            plot("ratio:3:1#0", spy.close.current, {});
            plot("ratio:4:1#0", qqq.close.current, {});
            plot("ratio:5:1#0", spy.close.current / qqq.close.current, {});
        }`,
    ),
};

function symbolBar(time: number, close: number, symbol: string): Bar {
    return {
        time,
        open: close,
        high: close + 1,
        low: close - 1,
        close,
        hl2: close,
        hlc3: close,
        ohlc4: close,
        hlcc4: close,
        volume: 10,
        symbol,
        interval: "1D",
    };
}

const SPY_HISTORY = [400, 410].map((c, i) => symbolBar(i * 86_400_000, c, "AMEX:SPY"));
const QQQ_HISTORY = [300, 305].map((c, i) => symbolBar(i * 86_400_000, c, "NASDAQ:QQQ"));
const MAIN_HISTORY = [
    symbolBar(86_400_000, 100, "X"),
    symbolBar(86_400_000 + 60_000, 101, "X"),
].map((b) => ({ ...b, interval: "1m" }));

async function runWorkerTwoSymbol(): Promise<string> {
    const { worker, scope } = pair();
    createWorkerBoot(scope);
    const host = createWorkerHost({
        capabilities: multiSymbolCapabilities(),
        workerLike: worker,
    });
    await host.load({
        moduleSource: TWO_SYMBOL_FIXTURE.source,
        manifest: TWO_SYMBOL_FIXTURE.manifest,
    });
    await host.push({ kind: "history", bars: SPY_HISTORY, streamKey: feedKey("AMEX:SPY", "1D") });
    await host.push({ kind: "history", bars: QQQ_HISTORY, streamKey: feedKey("NASDAQ:QQQ", "1D") });
    await host.push({ kind: "history", bars: MAIN_HISTORY });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const emissions = await host.drain();
    host.dispose();
    return JSON.stringify(emissions);
}

async function runQuickJsTwoSymbol(): Promise<string> {
    const host = createQuickJsHost({ capabilities: multiSymbolCapabilities() });
    await host.load({
        moduleSource: TWO_SYMBOL_FIXTURE.source,
        manifest: TWO_SYMBOL_FIXTURE.manifest,
    });
    await host.push({ kind: "history", bars: SPY_HISTORY, streamKey: feedKey("AMEX:SPY", "1D") });
    await host.push({ kind: "history", bars: QQQ_HISTORY, streamKey: feedKey("NASDAQ:QQQ", "1D") });
    await host.push({ kind: "history", bars: MAIN_HISTORY });
    const emissions = await host.drain();
    host.dispose();
    return JSON.stringify(emissions);
}

describe("host-quickjs integration parity", () => {
    for (const fixture of FIXTURES) {
        it(`matches host-worker emissions for ${fixture.name}`, async () => {
            await expect(runQuickJs(fixture)).resolves.toBe(await runWorker(fixture));
        });
    }

    it("matches host-worker emissions for mount-time plot overrides", async () => {
        const quickjs = await runQuickJsWithOverrides();
        const worker = await runWorkerWithOverrides();
        expect(quickjs).toBe(worker);
        // Sanity: the overrides actually baked into the wire (not a no-op match).
        const drained = JSON.parse(quickjs) as {
            plots: ReadonlyArray<{
                slotId: string;
                visible?: boolean;
                color: string | null;
                style: { lineWidth?: number };
            }>;
        };
        const hidden = drained.plots.find((p) => p.slotId === "parity.ovr:1:1#0");
        const recolored = drained.plots.find((p) => p.slotId === "parity.ovr:1:2#0");
        expect(hidden?.visible).toBe(false);
        expect(recolored?.color).toBe("#ff0000");
        expect(recolored?.style.lineWidth).toBe(3);
    });

    it("matches host-worker emissions for external-series load and whole-map replacement", async () => {
        const quickjs = await runQuickJsWithExternalSeries();
        const worker = await runWorkerWithExternalSeries();
        expect(quickjs).toBe(worker);
        const drained = JSON.parse(quickjs) as ReadonlyArray<{
            plots: ReadonlyArray<{ value: number | null }>;
        }>;
        expect(drained[0]?.plots[0]?.value).toBe(10);
        expect(drained[1]?.plots[0]?.value).toBeNull();
        expect(drained[2]?.plots[0]?.value).toBe(33);
    });

    it("matches host-worker emissions for a two-symbol composite-stream script", async () => {
        const quickjs = await runQuickJsTwoSymbol();
        const worker = await runWorkerTwoSymbol();
        expect(quickjs).toBe(worker);
        // Sanity: both composite streams routed to finite, DISTINCT values and
        // the ratio is their quotient (the streams did not cross-talk).
        const drained = JSON.parse(quickjs) as {
            plots: ReadonlyArray<{ slotId: string; value: number }>;
            diagnostics: ReadonlyArray<unknown>;
        };
        const head = (slotId: string): number | undefined =>
            drained.plots.filter((p) => p.slotId === slotId).at(-1)?.value;
        expect(head("ratio:3:1#0")).toBeCloseTo(410, 6);
        expect(head("ratio:4:1#0")).toBeCloseTo(305, 6);
        expect(head("ratio:5:1#0")).toBeCloseTo(410 / 305, 6);
        expect(drained.diagnostics).toEqual([]);
    });

    it("mounts a §22.10 multi-export bundle and forwards sibling plots with `export:` prefix", async () => {
        // The dispatcher's moduleSourceToScript rewriter captures named
        // exports onto a host-visible global map; `loadCompiled` builds
        // a `CompiledScriptBundle` the runtime walks. Sibling plots
        // forward through with the runtime's `export:<name>/` prefix.
        const primaryManifest: ScriptManifest = {
            ...manifest("primary"),
            exportName: "default",
            isDrawn: true,
        };
        const siblingManifest: ScriptManifest = {
            ...manifest("sibling"),
            exportName: "sibling",
            isDrawn: true,
        };
        const moduleSource = `
export const sibling = {
    manifest: ${JSON.stringify(siblingManifest)},
    compute: ({ plot }) => {
        plot("sibling.chart.ts:1:1#0", 42, { title: "sibling-plot" });
    },
};
export default {
    manifest: ${JSON.stringify(primaryManifest)},
    compute: () => {},
};
export const __manifest = ${JSON.stringify([primaryManifest, siblingManifest])};
`;
        const host = createQuickJsHost({ capabilities: makeCapabilities() });
        await host.load({ moduleSource, manifest: primaryManifest });
        await host.push({ kind: "close", bar: bars(1)[0] });
        const emissions = await host.drain();
        host.dispose();
        const exportPrefixed = emissions.plots.filter((p) =>
            p.slotId.startsWith("export:sibling/"),
        );
        expect(exportPrefixed.length).toBeGreaterThan(0);
        expect(exportPrefixed[0]?.value).toBe(42);
    });
});

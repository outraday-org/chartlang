// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ExternalSeriesFeedMap } from "@invinite-org/chartlang-core";
import { createQuickJsHost } from "@invinite-org/chartlang-host-quickjs";
import { describe, expect, it, vi } from "vitest";

import {
    CONSUMER,
    HOUR,
    PRODUCER,
    RELAY,
    TWIN_FEEDS,
    UP_BAR_ALERT,
    compiled,
    walk,
} from "./__fixtures__/scripts.js";
import { toRuntimeBar } from "./bar.js";
import { alertRunnerCapabilities } from "./capabilities.js";
import { AlertRunnerError } from "./errors.js";
import { DEFAULT_MIN_WARM_UP_BARS, createAlertRunner, requiredHistoryFor } from "./runner.js";
import { createSeriesRunner } from "./series.js";
import type {
    AlertBar,
    AlertRunnerCompiledScript,
    CreateSeriesRunnerOpts,
    SeriesRunner,
} from "./types.js";

// Real scripts compile through esbuild and run in QuickJS; a loaded CI box
// needs more than the default 5 s.
vi.setConfig({ testTimeout: 120_000 });

const BARS = walk(160);
const HISTORY = BARS.slice(0, 100);
const LIVE = BARS.slice(100);
const LIMITS = { maxHeapBytes: 32 * 1024 * 1024, maxStepMs: 250 };

function slotsOf(script: AlertRunnerCompiledScript): string[] {
    return (script.manifest.plots ?? []).map((plot) => plot.slotId);
}

type Golden = Readonly<{
    plots: Readonly<Record<string, number[]>>;
    alerts: ReadonlyArray<readonly [number, string]>;
}>;

/**
 * The reference: invinite's order of operations on the plain QuickJS host —
 * every bar pushed as a close, the WHOLE feed map (every value so far)
 * re-sent with `setExternalSeries` before each bar, the first emission per
 * slot picked.
 */
async function golden(
    script: AlertRunnerCompiledScript,
    bars: ReadonlyArray<AlertBar>,
    feeds: Readonly<Record<string, ReadonlyArray<number>>> = {},
): Promise<Golden> {
    const manifest = script.manifest;
    const host = createQuickJsHost({
        capabilities: alertRunnerCapabilities({
            manifest,
            interval: "1h",
            maxLookback: requiredHistoryFor(manifest, DEFAULT_MIN_WARM_UP_BARS),
        }),
        symInfo: { ticker: "TEST" },
        resolveInputs: () => ({}),
        limits: LIMITS,
    });
    await host.load({ moduleSource: script.moduleSource, manifest });
    const slots = slotsOf(script);
    const plots: Record<string, number[]> = Object.fromEntries(slots.map((s) => [s, []]));
    const alerts: Array<readonly [number, string]> = [];
    for (const [i, bar] of bars.entries()) {
        const map: Record<string, ExternalSeriesFeedMap[string]> = {};
        for (const [name, values] of Object.entries(feeds)) {
            map[name] = { values: values.slice(0, i + 1) };
        }
        host.setExternalSeries(map);
        await host.push({ kind: "close", bar: toRuntimeBar(bar, "TEST", "1h") });
        const drained = await host.drain();
        for (const slot of slots) {
            const first = drained.plots.find((p) => p.slotId === slot);
            const value = first?.value;
            plots[slot]?.push(
                typeof value === "number" && Number.isFinite(value) ? value : Number.NaN,
            );
        }
        for (const alert of drained.alerts) alerts.push([bar.time, alert.message]);
    }
    host.dispose();
    return { plots, alerts };
}

async function series(
    source: string,
    extra: Partial<CreateSeriesRunnerOpts> = {},
): Promise<SeriesRunner> {
    const script = await compiled(source);
    return createSeriesRunner({
        compiled: script,
        interval: "1h",
        symInfo: { ticker: "TEST" },
        plotSlots: slotsOf(script),
        ...extra,
    });
}

function head(values: ReadonlyArray<number>, n: number): number[] {
    return values.slice(0, n);
}

describe("createSeriesRunner", () => {
    it("returns warm-up plots aligned to the bars and per-bar plots equal to the plain host", async () => {
        const script = await compiled(PRODUCER);
        const [fast, gain] = slotsOf(script) as [string, string];
        const reference = await golden(script, BARS);
        const producer = await series(PRODUCER);
        expect(producer.plotSlots).toEqual([fast, gain]);
        expect(producer.snapshotFidelity).toBe("exact");

        const warm = await producer.warmUp(HISTORY);
        expect(warm.plots[fast]).toEqual(head(reference.plots[fast] as number[], 100));
        expect(warm.plots[gain]).toEqual(head(reference.plots[gain] as number[], 100));
        expect(warm.plots[gain]?.some(Number.isNaN)).toBe(true);

        const live: Record<string, number[]> = { [fast]: [], [gain]: [] };
        for (const bar of LIVE) {
            const out = await producer.onBarClose(bar);
            expect(out.folded).toBe(true);
            expect(out.events).toEqual([]);
            live[fast]?.push(out.plots[fast] as number);
            live[gain]?.push(out.plots[gain] as number);
        }
        expect(live[fast]).toEqual((reference.plots[fast] as number[]).slice(100));
        expect(live[gain]).toEqual((reference.plots[gain] as number[]).slice(100));

        const skipped = await producer.onBarClose(LIVE[0] as AlertBar);
        expect(skipped).toEqual({
            folded: false,
            events: [],
            plots: { [fast]: Number.NaN, [gain]: Number.NaN },
        });
        producer.dispose();
    });

    it("harvests warm-up plots across multi-bar chunks", async () => {
        const script = await compiled(PRODUCER);
        const [fast] = slotsOf(script) as [string];
        const reference = await golden(script, HISTORY);
        const producer = await series(PRODUCER, { warmUpChunkBars: 7, plotSlots: [fast] });
        const warm = await producer.warmUp(HISTORY);
        expect(Object.keys(warm.plots)).toEqual([fast]);
        expect(warm.plots[fast]).toEqual(reference.plots[fast]);
        producer.dispose();
    });

    it("a producer → consumer pair equals the plain host fed whole arrays (entry key ≠ feed name)", async () => {
        const producerScript = await compiled(PRODUCER);
        const consumerScript = await compiled(CONSUMER);
        const [fast] = slotsOf(producerScript) as [string];
        const [seen, lag] = slotsOf(consumerScript) as [string, string];
        const producerRef = await golden(producerScript, BARS);
        const consumerRef = await golden(consumerScript, BARS, {
            "producer-feed": producerRef.plots[fast] as number[],
        });
        expect(consumerRef.alerts.length).toBeGreaterThan(0);

        const producer = await series(PRODUCER, { plotSlots: [fast] });
        const consumer = await series(CONSUMER, {
            externalSeries: { names: ["signal"] },
            frequency: "every_time",
        });
        expect(consumer.snapshotFidelity).toBe("lossy");
        const pw = await producer.warmUp(HISTORY);
        const cw = await consumer.warmUp(HISTORY, {
            externalSeries: { signal: pw.plots[fast] as number[] },
        });
        expect(cw.plots[seen]).toEqual(head(consumerRef.plots[seen] as number[], 100));
        expect(cw.plots[lag]).toEqual(head(consumerRef.plots[lag] as number[], 100));

        const alerts: Array<readonly [number, string]> = [];
        const seenLive: number[] = [];
        const lagLive: number[] = [];
        for (const bar of LIVE) {
            const p = await producer.onBarClose(bar);
            const c = await consumer.onBarClose(bar, {
                externalSeries: { signal: p.plots[fast] as number },
            });
            for (const event of c.events) alerts.push([event.time, event.message]);
            seenLive.push(c.plots[seen] as number);
            lagLive.push(c.plots[lag] as number);
        }
        expect(seenLive).toEqual((consumerRef.plots[seen] as number[]).slice(100));
        expect(lagLive).toEqual((consumerRef.plots[lag] as number[]).slice(100));
        expect(alerts).toEqual(consumerRef.alerts.filter(([t]) => t >= (LIVE[0] as AlertBar).time));
        expect(await consumer.exportSnapshot()).toBeNull();
        producer.dispose();
        consumer.dispose();
    });

    it("runs a nested chain (a producer reads a producer) equal to the plain host", async () => {
        const producerScript = await compiled(PRODUCER);
        const relayScript = await compiled(RELAY);
        const consumerScript = await compiled(CONSUMER);
        const [, gain] = slotsOf(producerScript) as [string, string];
        const [smoothed] = slotsOf(relayScript) as [string];
        const [seen] = slotsOf(consumerScript) as [string];
        const p = await golden(producerScript, BARS);
        const r = await golden(relayScript, BARS, { up: p.plots[gain] as number[] });
        const c = await golden(consumerScript, BARS, {
            "producer-feed": r.plots[smoothed] as number[],
        });

        const producer = await series(PRODUCER, { plotSlots: [gain] });
        const relay = await series(RELAY, { externalSeries: { names: ["upstream"] } });
        const consumer = await series(CONSUMER, {
            plotSlots: [seen],
            externalSeries: { names: ["signal"] },
        });
        const pw = await producer.warmUp(HISTORY);
        const rw = await relay.warmUp(HISTORY, {
            externalSeries: { upstream: pw.plots[gain] as number[] },
        });
        expect(rw.plots[smoothed]).toEqual(head(r.plots[smoothed] as number[], 100));
        await consumer.warmUp(HISTORY, {
            externalSeries: { signal: rw.plots[smoothed] as number[] },
        });
        const out: number[] = [];
        const alerts: Array<readonly [number, string]> = [];
        for (const bar of LIVE) {
            const a = await producer.onBarClose(bar);
            const b = await relay.onBarClose(bar, {
                externalSeries: { upstream: a.plots[gain] as number },
            });
            const d = await consumer.onBarClose(bar, {
                externalSeries: { signal: b.plots[smoothed] as number },
            });
            out.push(d.plots[seen] as number);
            for (const event of d.events) alerts.push([event.time, event.message]);
        }
        expect(out).toEqual((c.plots[seen] as number[]).slice(100));
        expect(alerts).toEqual(c.alerts.filter(([t]) => t >= (LIVE[0] as AlertBar).time));
        for (const runner of [producer, relay, consumer]) runner.dispose();
    });

    it("reads NaN for missing, non-finite and short-array values", async () => {
        const script = await compiled(CONSUMER);
        const [seen, lag] = slotsOf(script) as [string, string];
        const consumer = await series(CONSUMER, { externalSeries: { names: ["signal"] } });
        const warm = await consumer.warmUp(BARS.slice(0, 4), {
            externalSeries: { signal: [1, Number.POSITIVE_INFINITY] },
        });
        expect(warm.plots[seen]).toEqual([1, Number.NaN, Number.NaN, Number.NaN]);
        const a = await consumer.onBarClose(BARS[4] as AlertBar);
        const b = await consumer.onBarClose(BARS[5] as AlertBar, {
            externalSeries: { signal: Number.NaN },
        });
        const c = await consumer.onBarClose(BARS[6] as AlertBar, { externalSeries: { signal: 7 } });
        expect([a.plots[seen], b.plots[seen], c.plots[seen]]).toEqual([Number.NaN, Number.NaN, 7]);
        expect(c.plots[lag]).toBeNaN();
        const d = await consumer.onBarClose(BARS[7] as AlertBar, { externalSeries: { signal: 8 } });
        const e = await consumer.onBarClose(BARS[8] as AlertBar, { externalSeries: { signal: 9 } });
        expect(d.plots[lag]).toBeNaN();
        expect(e.plots[lag]).toBe(7);
        consumer.dispose();

        // A warm-up without values for a fed input reads NaN throughout.
        const bare = await series(CONSUMER, { externalSeries: { names: ["signal"] } });
        const cold = await bare.warmUp(BARS.slice(0, 3));
        expect(cold.plots[seen]).toEqual([Number.NaN, Number.NaN, Number.NaN]);
        bare.dispose();
    });

    it("keeps alignment when the watermark skips a replayed bar", async () => {
        const script = await compiled(CONSUMER);
        const [seen, lag] = slotsOf(script) as [string, string];
        const consumer = await series(CONSUMER, { externalSeries: { names: ["signal"] } });
        await consumer.warmUp(BARS.slice(0, 3), { externalSeries: { signal: [1, 2, 3] } });
        await consumer.onBarClose(BARS[3] as AlertBar, { externalSeries: { signal: 4 } });
        const replayed = await consumer.onBarClose(BARS[2] as AlertBar, {
            externalSeries: { signal: 99 },
        });
        expect(replayed.folded).toBe(false);
        const next = await consumer.onBarClose(BARS[4] as AlertBar, {
            externalSeries: { signal: 5 },
        });
        expect([next.plots[seen], next.plots[lag]]).toEqual([5, 3]);
        consumer.dispose();
    });

    it("pre-close feeds the forming bar's values to a copy and leaves the main state unchanged", async () => {
        const script = await compiled(CONSUMER);
        const [seen, lag] = slotsOf(script) as [string, string];
        const make = () => series(CONSUMER, { externalSeries: { names: ["signal"] } });
        const values = HISTORY.map((b) => b.close - 1);
        const withPre = await make();
        const plain = await make();
        await withPre.warmUp(HISTORY, { externalSeries: { signal: values } });
        await plain.warmUp(HISTORY, { externalSeries: { signal: values } });
        const forming = LIVE[0] as AlertBar;

        const pre = await withPre.onPreClose(forming, 60_000, {
            externalSeries: { signal: forming.close - 5 },
        });
        expect(pre.plots[seen]).toBe(forming.close - 5);
        // The journal replayed the warm-up window, so the copy's history is right.
        expect(pre.plots[lag]).toBe(values[98]);
        expect(pre.events.map((e) => e.message)).toEqual([`above ${forming.close - 5}`]);
        expect(pre.events[0]?.phase).toBe("preClose");

        const a = await withPre.onBarClose(forming, {
            externalSeries: { signal: forming.close + 5 },
        });
        const b = await plain.onBarClose(forming, {
            externalSeries: { signal: forming.close + 5 },
        });
        expect(a.plots).toEqual(b.plots);
        expect(a.events).toEqual(b.events);
        expect(a.events).toEqual([]);

        // A second pre-close replays the live window of bar 100 too.
        const next = LIVE[1] as AlertBar;
        const again = await withPre.onPreClose(next, 0);
        expect(again.plots[seen]).toBeNaN();
        expect(again.plots[lag]).toBe(values[99]);
        withPre.dispose();
        plain.dispose();
    });

    it("pre-close of a producer without external series returns its plots", async () => {
        const script = await compiled(PRODUCER);
        const [fast] = slotsOf(script) as [string];
        const reference = await golden(script, BARS.slice(0, 101));
        const producer = await series(PRODUCER, { plotSlots: [fast] });
        await producer.warmUp(HISTORY);
        const pre = await producer.onPreClose(LIVE[0] as AlertBar, 0);
        expect(pre.plots[fast]).toBe(reference.plots[fast]?.[100]);
        expect(producer.lastBarTime).toBe((HISTORY[99] as AlertBar).time);
        producer.dispose();
    });

    it("a producer without external series restores its snapshot and keeps producing", async () => {
        const script = await compiled(PRODUCER);
        const [fast] = slotsOf(script) as [string];
        const reference = await golden(script, BARS);
        const first = await series(PRODUCER, { plotSlots: [fast] });
        await first.warmUp(HISTORY);
        const snapshot = await first.exportSnapshot();
        expect(snapshot).not.toBeNull();
        first.dispose();
        const restored = await series(PRODUCER, { plotSlots: [fast], snapshot });
        expect(restored.snapshotStatus).toBe("restored");
        const out = await restored.onBarClose(LIVE[0] as AlertBar);
        expect(out.plots[fast]).toBe(reference.plots[fast]?.[100]);
        restored.dispose();
    });

    it("takes secondary bars like the alert runner", async () => {
        const source = `import { defineIndicator } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "MTF plot",
    apiVersion: 1,
    overlay: true,
    compute({ request, plot }) {
        const daily = request.security({ interval: "1D" });
        plot(daily.close.current, { title: "Daily" });
    },
});
`;
        const producer = await series(source);
        const [daily] = producer.plotSlots as [string];
        const days = walk(3, 0, 24 * HOUR).map((b) => ({ ...b, time: b.time - 3 * 24 * HOUR }));
        await producer.warmUp(HISTORY, { secondary: { "1D": days } });
        const fresh = {
            ...(days[2] as AlertBar),
            time: (HISTORY[99] as AlertBar).time,
            close: 123,
        };
        await producer.onSecondaryBarClose("1D", fresh);
        const out = await producer.onBarClose(LIVE[0] as AlertBar);
        expect(out.plots[daily]).toBe(123);
        producer.dispose();
    });

    it("refuses unknown, duplicate, empty and non-array plot slots", async () => {
        const script = await compiled(PRODUCER);
        const [fast] = slotsOf(script) as [string];
        const base = { compiled: script, interval: "1h" };
        for (const plotSlots of [[], ["nope"], [fast, fast], "x", [1]]) {
            await expect(
                createSeriesRunner({ ...base, plotSlots: plotSlots as string[] }),
            ).rejects.toBeInstanceOf(AlertRunnerError);
        }
        await expect(
            createSeriesRunner({
                compiled: { ...script, manifest: { ...script.manifest, plots: undefined } },
                interval: "1h",
                plotSlots: [fast],
            }),
        ).rejects.toMatchObject({ code: "invalid-argument" });
    });
});

describe("external series in the alert runner", () => {
    it("refuses unlisted external inputs with the 1.0 text", async () => {
        const script = await compiled(CONSUMER);
        await expect(
            createAlertRunner({ compiled: script, interval: "1h", frequency: "every_time" }),
        ).rejects.toMatchObject({
            code: "invalid-inputs",
            details: ['input "signal" is an external series, which the alert runner cannot feed'],
        });
    });

    it("refuses a listed key that is not an external series, and an inputs value for one", async () => {
        const script = await compiled(CONSUMER);
        const base = { compiled: script, interval: "1h", frequency: "every_time" as const };
        await expect(
            createAlertRunner({ ...base, externalSeries: { names: ["signal", "producer-feed"] } }),
        ).rejects.toMatchObject({
            details: [
                'external series "producer-feed" is not an external-series input of the script',
            ],
        });
        await expect(
            createAlertRunner({
                ...base,
                externalSeries: { names: ["signal"] },
                inputs: { signal: { values: [1] } },
            }),
        ).rejects.toMatchObject({
            details: [
                'input "signal" is an external series; its values are fed per bar, not as an input',
            ],
        });
        await expect(
            createAlertRunner({ ...base, externalSeries: { names: "signal" as never } }),
        ).rejects.toMatchObject({ code: "invalid-argument" });
        await expect(
            createAlertRunner({ ...base, externalSeries: { names: [3 as never] } }),
        ).rejects.toMatchObject({ code: "invalid-argument" });
    });

    it("refuses two fed keys that share one feed name", async () => {
        await expect(
            createAlertRunner({
                compiled: await compiled(TWIN_FEEDS),
                interval: "1h",
                frequency: "every_time",
                externalSeries: { names: ["a", "b"] },
            }),
        ).rejects.toMatchObject({
            code: "invalid-argument",
            message: 'external series "a" and "b" share the feed name "same"',
        });
    });

    it("refuses bad per-bar and warm-up values", async () => {
        const script = await compiled(CONSUMER);
        const make = (extra = {}) =>
            createAlertRunner({
                compiled: script,
                interval: "1h",
                frequency: "every_time",
                externalSeries: { names: ["signal"] },
                ...extra,
            });
        const r = await make();
        const bars = BARS.slice(0, 2);
        const bad: ReadonlyArray<unknown> = [
            { other: [1] },
            { signal: 1 },
            { signal: [1, 2, 3] },
            [1],
        ];
        for (const externalSeries of bad) {
            await expect(
                r.warmUp(bars, { externalSeries: externalSeries as never }),
            ).rejects.toMatchObject({ code: "invalid-argument" });
        }
        await expect(
            r.onBarClose(BARS[0] as AlertBar, { externalSeries: { other: 1 } }),
        ).rejects.toMatchObject({ code: "invalid-argument" });
        await expect(
            r.onPreClose(BARS[0] as AlertBar, 0, { externalSeries: 5 as never }),
        ).rejects.toMatchObject({ code: "invalid-argument" });
        r.dispose();

        const capped = await make({
            capabilities: {
                ...alertRunnerCapabilities({
                    manifest: script.manifest,
                    interval: "1h",
                    maxLookback: 1,
                }),
                maxLookback: 3,
            },
        });
        await expect(
            capped.warmUp(BARS.slice(0, 4), { externalSeries: { signal: [1, 2, 3, 4] } }),
        ).rejects.toMatchObject({
            code: "invalid-argument",
            message: 'warmUp: externalSeries "signal" has 4 values for 4 bars (lookback 3)',
        });
        await capped.warmUp(BARS.slice(0, 4), { externalSeries: { signal: [1, 2, 3] } });
        capped.dispose();
    });

    it("feeds an alert runner and keeps the 1.0 return types", async () => {
        const r = await createAlertRunner({
            compiled: await compiled(CONSUMER),
            interval: "1h",
            frequency: "every_time",
            externalSeries: { names: ["signal"] },
        });
        expect(r.snapshotFidelity).toBe("lossy");
        await r.warmUp(HISTORY, { externalSeries: { signal: HISTORY.map((b) => b.close) } });
        const bar = LIVE[0] as AlertBar;
        const events = await r.onBarClose(bar, { externalSeries: { signal: bar.close - 1 } });
        expect(events.map((e) => e.message)).toEqual([`above ${bar.close - 1}`]);
        expect(await r.onBarClose(bar)).toEqual([]);
        const pre = await r.onPreClose(LIVE[1] as AlertBar, 0, {
            externalSeries: { signal: 0 },
        });
        expect(pre.emissionCount).toBe(1);
        expect(await r.exportSnapshot()).toBeNull();
        r.dispose();
    });

    it("leaves a runner without external series unchanged (no feed sent)", async () => {
        const r = await createAlertRunner({
            compiled: await compiled(UP_BAR_ALERT),
            interval: "1h",
            frequency: "every_time",
        });
        await r.warmUp(HISTORY, { externalSeries: {} });
        await expect(
            r.onBarClose(LIVE[0] as AlertBar, { externalSeries: { x: 1 } }),
        ).rejects.toMatchObject({ code: "invalid-argument" });
        expect(Array.isArray(await r.onBarClose(LIVE[0] as AlertBar, {}))).toBe(true);
        r.dispose();
    });
});

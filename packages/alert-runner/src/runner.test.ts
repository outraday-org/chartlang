// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it, vi } from "vitest";

import {
    CONDITIONS,
    CROSS,
    HOUR,
    MTF,
    T0,
    UP_BAR_ALERT,
    WITH_INPUTS,
    compiled,
    heavyAfter,
    walk,
} from "./__fixtures__/scripts.js";
import { AlertRunnerError } from "./errors.js";
import { DEFAULT_MIN_WARM_UP_BARS, createAlertRunner, requiredHistoryFor } from "./runner.js";
import type {
    AlertBar,
    AlertRunner,
    AlertRunnerDiagnostic,
    AlertRunnerEvent,
    CreateAlertRunnerOpts,
} from "./types.js";

// Real scripts compile through esbuild and run in QuickJS; a loaded CI box
// needs more than the default 5 s.
vi.setConfig({ testTimeout: 60_000 });

const BARS = walk(160);
const HISTORY = BARS.slice(0, 100);
const LIVE = BARS.slice(100);

async function runner(
    source: string,
    extra: Partial<CreateAlertRunnerOpts> = {},
): Promise<AlertRunner> {
    return createAlertRunner({
        compiled: await compiled(source),
        interval: "1h",
        frequency: "every_time",
        symInfo: { ticker: "TEST" },
        ...extra,
    });
}

async function feed(r: AlertRunner, bars: ReadonlyArray<AlertBar>): Promise<AlertRunnerEvent[]> {
    const out: AlertRunnerEvent[] = [];
    for (const bar of bars) out.push(...(await r.onBarClose(bar)));
    return out;
}

async function coldEvents(
    source: string,
    extra: Partial<CreateAlertRunnerOpts> = {},
): Promise<AlertRunnerEvent[]> {
    const r = await runner(source, extra);
    await r.warmUp(HISTORY);
    const events = await feed(r, LIVE);
    r.dispose();
    return events;
}

function upBars(bars: ReadonlyArray<AlertBar>): number[] {
    return bars.filter((b) => b.close > b.open).map((b) => b.time);
}

describe("createAlertRunner", () => {
    it("delivers an alert per up bar under every_time, after a silent warm-up", async () => {
        const r = await runner(UP_BAR_ALERT);
        expect(r.needsWarmUp()).toBe(true);
        expect(r.snapshotStatus).toBe("none");
        expect(r.key).toMatchObject({
            apiVersion: 1,
            symbol: "TEST",
            mainInterval: "1h",
            requestedIntervals: [],
        });
        await r.warmUp(HISTORY);
        expect(r.needsWarmUp()).toBe(false);
        expect(r.lastBarTime).toBe(HISTORY[HISTORY.length - 1]?.time);

        const events = await feed(r, LIVE);

        expect(events.map((e) => e.time)).toEqual(upBars(LIVE));
        const first = events[0] as AlertRunnerEvent;
        expect(first).toMatchObject({
            kind: "alert",
            severity: "warning",
            phase: "close",
            bar: 100 + LIVE.findIndex((b) => b.time === first.time),
        });
        expect(first.message).toMatch(/^up /);
        expect(first.meta).toHaveProperty("close");
        expect(first.dedupeKey).toBe(`alert:${first.id}:${first.time}`);
        r.dispose();
    });

    it("ignores a replayed bar at or before the watermark", async () => {
        const r = await runner(UP_BAR_ALERT);
        await r.warmUp(HISTORY);
        const up = LIVE.find((b) => b.close > b.open) as AlertBar;
        expect(await r.onBarClose(up)).toHaveLength(1);
        expect(await r.onBarClose(up)).toEqual([]);
        expect(await r.onBarClose(HISTORY[0] as AlertBar)).toEqual([]);
        r.dispose();
    });

    it("starts cold without a warm-up and then refuses one", async () => {
        const r = await runner(UP_BAR_ALERT);
        await r.onBarClose(LIVE[0] as AlertBar);
        expect(r.needsWarmUp()).toBe(false);
        await expect(r.warmUp(HISTORY)).rejects.toMatchObject({ code: "warm-up-not-allowed" });
        r.dispose();
    });

    it("treats an empty warm-up as nothing folded", async () => {
        const r = await runner(UP_BAR_ALERT, { warmUpChunkBars: 7 });
        await r.warmUp([]);
        expect(r.needsWarmUp()).toBe(true);
        await r.warmUp(HISTORY);
        expect(r.lastBarTime).toBe(HISTORY[HISTORY.length - 1]?.time);
        r.dispose();
    });

    it("emits the same events whatever the warm-up chunk size", async () => {
        expect(await coldEvents(UP_BAR_ALERT, { warmUpChunkBars: 13 })).toEqual(
            await coldEvents(UP_BAR_ALERT),
        );
    });

    it("projects fired conditions only, with title, message and description", async () => {
        const events = await coldEvents(CONDITIONS);
        expect(events.map((e) => e.time)).toEqual(upBars(LIVE));
        expect(events[0]).toMatchObject({
            kind: "condition",
            id: "up",
            title: "Up",
            message: "{{ticker}} up",
            meta: { description: "Close above open." },
        });
        expect(events.some((e) => e.id === "never")).toBe(false);
    });

    it("reports runtime and host diagnostics", async () => {
        const seen: AlertRunnerDiagnostic[] = [];
        const r = await runner(MTF, {
            onDiagnostic: (d) => seen.push(d),
            limits: { maxStepMs: 0.000001 },
        });
        await r.onBarClose(LIVE[0] as AlertBar).catch(() => undefined);
        r.dispose();
        expect(seen.length).toBeGreaterThan(0);
    });

    it("validates its options", async () => {
        await expect(
            runner(UP_BAR_ALERT, { frequency: "sometimes" as never }),
        ).rejects.toMatchObject({
            code: "invalid-argument",
        });
        await expect(runner(UP_BAR_ALERT, { interval: "soon" })).rejects.toMatchObject({
            code: "invalid-argument",
        });
        await expect(runner(UP_BAR_ALERT, { cooldownBars: -1 })).rejects.toMatchObject({
            code: "invalid-argument",
        });
        await expect(runner(UP_BAR_ALERT, { minWarmUpBars: 1.5 })).rejects.toMatchObject({
            code: "invalid-argument",
        });
        await expect(runner(UP_BAR_ALERT, { warmUpChunkBars: 0 })).rejects.toMatchObject({
            code: "invalid-argument",
        });
    });

    it("refuses inputs that do not match the manifest", async () => {
        const failure = await runner(WITH_INPUTS, {
            inputs: { length: 0, mode: "sideways", other: 1 },
        }).catch((err: unknown) => err);
        expect(failure).toBeInstanceOf(AlertRunnerError);
        expect((failure as AlertRunnerError).code).toBe("invalid-inputs");
        expect((failure as AlertRunnerError).details).toHaveLength(3);
    });

    it("serves valid inputs to the script", async () => {
        const above = await coldEvents(WITH_INPUTS, { inputs: { length: 3, mode: "above" } });
        const below = await coldEvents(WITH_INPUTS, { inputs: { length: 3, mode: "below" } });
        expect(above.length).toBeGreaterThan(0);
        expect(below.length).toBeGreaterThan(0);
        expect(above.every((e) => e.message === "cross above")).toBe(true);
        expect(below.every((e) => e.message === "cross below")).toBe(true);
    });

    it("reports a module that does not load", async () => {
        await expect(
            createAlertRunner({
                compiled: {
                    moduleSource: "throw new Error('boom');",
                    manifest: (await compiled(UP_BAR_ALERT)).manifest,
                },
                interval: "1h",
                frequency: "every_time",
            }),
        ).rejects.toMatchObject({ code: "load-failed" });
    });

    it("reports a module whose load exceeds the step budget", async () => {
        const c = await compiled(UP_BAR_ALERT);
        const failure = await createAlertRunner({
            compiled: { moduleSource: `while (true) {}\n${c.moduleSource}`, manifest: c.manifest },
            interval: "1h",
            frequency: "every_time",
            limits: { maxSteps: 100_000, maxStepMs: 60_000 },
        }).catch((err: unknown) => err);
        expect(failure).toMatchObject({ code: "aborted", reason: "steps" });
    });

    it("computes the warm-up size from the manifest with a floor", async () => {
        const r = await runner(UP_BAR_ALERT);
        expect(r.requiredHistory()).toBe(DEFAULT_MIN_WARM_UP_BARS);
        r.dispose();
        const low = await runner(UP_BAR_ALERT, { minWarmUpBars: 0 });
        expect(low.requiredHistory()).toBe(1);
        low.dispose();
        const manifest = (await compiled(UP_BAR_ALERT)).manifest;
        expect(requiredHistoryFor({ ...manifest, maxLookback: 20 }, 0)).toBe(21);
        expect(requiredHistoryFor({ ...manifest, maxBarsBack: 300 }, 0)).toBe(300);
        expect(
            requiredHistoryFor({ ...manifest, seriesCapacities: { dynamicFallback: 5_000 } }, 0),
        ).toBe(5_000);
    });
});

describe("frequencies", () => {
    it("once delivers the first firing evaluation, then nothing", async () => {
        const r = await runner(UP_BAR_ALERT, { frequency: "once" });
        await r.warmUp(HISTORY);
        const events = await feed(r, LIVE);
        expect(events).toHaveLength(1);
        expect(events[0]?.time).toBe(upBars(LIVE)[0]);
        expect(r.exhausted).toBe(true);
        r.dispose();
    });

    it("once_per_bar and once_per_bar_close equal every_time on closes alone", async () => {
        const every = await coldEvents(UP_BAR_ALERT);
        expect(await coldEvents(UP_BAR_ALERT, { frequency: "once_per_bar" })).toEqual(every);
        expect(await coldEvents(UP_BAR_ALERT, { frequency: "once_per_bar_close" })).toEqual(every);
    });

    it("cooldownBars spaces deliveries", async () => {
        const events = await coldEvents(UP_BAR_ALERT, { cooldownBars: 5 });
        for (let i = 1; i < events.length; i += 1) {
            expect(
                (events[i] as AlertRunnerEvent).time - (events[i - 1] as AlertRunnerEvent).time,
            ).toBeGreaterThanOrEqual(5 * HOUR);
        }
        expect(events.length).toBeLessThan(upBars(LIVE).length);
    });
});

describe("onPreClose", () => {
    const forming = LIVE.find((b, i) => i > 0 && b.close > b.open) as AlertBar;
    const before = LIVE.slice(0, LIVE.indexOf(forming));
    const after = LIVE.slice(LIVE.indexOf(forming));

    async function primed(extra: Partial<CreateAlertRunnerOpts> = {}): Promise<AlertRunner> {
        const r = await runner(UP_BAR_ALERT, extra);
        await r.warmUp(HISTORY);
        await feed(r, before);
        return r;
    }

    it("evaluates the forming bar and rolls the state back", async () => {
        const r = await primed();
        const watermark = r.lastBarTime;
        const result = await r.onPreClose({ ...forming, closeTime: forming.time + HOUR }, 300_000);
        expect(result.emissionCount).toBe(1);
        expect(result.events).toHaveLength(1);
        expect(result.events[0]).toMatchObject({ phase: "preClose", time: forming.time });
        expect(result.events[0]?.dedupeKey).toMatch(/:pre:300000$/);
        expect(result.bar).toEqual({ ...forming, closeTime: forming.time + HOUR });
        expect(result.offsetMs).toBe(300_000);
        expect(r.lastBarTime).toBe(watermark);

        // The rest of the run is byte-identical to a run without the pre-close.
        const rest = await feed(r, after);
        r.dispose();
        const cold = await coldEvents(UP_BAR_ALERT);
        expect(JSON.stringify(rest)).toBe(
            JSON.stringify(cold.filter((e) => e.time >= forming.time)),
        );
    });

    it("every_time delivers both the pre-close and the close of one bar", async () => {
        const r = await primed();
        expect((await r.onPreClose(forming, 0)).events).toHaveLength(1);
        expect(await r.onBarClose(forming)).toHaveLength(1);
        r.dispose();
    });

    it("once_per_bar folds the pre-close fire and the close into one signal", async () => {
        const r = await primed({ frequency: "once_per_bar" });
        const pre = await r.onPreClose(forming, 60_000);
        expect(pre.events).toHaveLength(1);
        expect(pre.events[0]?.dedupeKey).not.toMatch(/:pre:/);
        expect(await r.onBarClose(forming)).toEqual([]);
        r.dispose();
    });

    it("once_per_bar_close never delivers before the close", async () => {
        const r = await primed({ frequency: "once_per_bar_close" });
        const pre = await r.onPreClose(forming, 60_000);
        expect(pre.events).toEqual([]);
        expect(pre.emissionCount).toBe(1);
        expect(pre.suppressed).toEqual([
            expect.objectContaining({ reason: "frequency", time: forming.time }),
        ]);
        expect(await r.onBarClose(forming)).toHaveLength(1);
        r.dispose();
    });

    it("once delivers on the pre-close and stays exhausted", async () => {
        const r = await primed({ frequency: "once" });
        expect((await r.onPreClose(forming, 0)).events).toHaveLength(1);
        expect(r.exhausted).toBe(true);
        expect(await feed(r, after)).toEqual([]);
        r.dispose();
    });

    it("works on a runner that folded nothing yet", async () => {
        const r = await runner(UP_BAR_ALERT);
        const result = await r.onPreClose(forming, 0);
        expect(result.events).toHaveLength(1);
        expect(r.needsWarmUp()).toBe(true);
        r.dispose();
    });

    it("reports a budget abort on the forming bar without failing the runner", async () => {
        const r = await runner(heavyAfter((before[before.length - 1] as AlertBar).time), {
            limits: { maxSteps: 2_000_000, maxStepMs: 60_000 },
        });
        await r.warmUp(HISTORY);
        await feed(r, before);
        await expect(r.onPreClose(forming, 0)).rejects.toMatchObject({
            code: "aborted",
            reason: "steps",
        });
        expect(await r.exportSnapshot()).not.toBeNull();
        r.dispose();
    });

    it("refuses a stale bar and a bad offset", async () => {
        const r = await primed();
        await expect(r.onPreClose(before[0] as AlertBar, 0)).rejects.toMatchObject({
            code: "stale-bar",
        });
        await expect(r.onPreClose(forming, -1)).rejects.toMatchObject({ code: "invalid-argument" });
        await expect(r.onPreClose(forming, Number.NaN)).rejects.toMatchObject({
            code: "invalid-argument",
        });
        r.dispose();
    });
});

describe("snapshots", () => {
    it("restore + replay equals a cold run, byte for byte", async () => {
        const cold = await coldEvents(UP_BAR_ALERT, { frequency: "once_per_bar" });

        const first = await runner(UP_BAR_ALERT, { frequency: "once_per_bar" });
        await first.warmUp(HISTORY);
        const head = await feed(first, LIVE.slice(0, 25));
        const stored = JSON.parse(JSON.stringify(await first.exportSnapshot()));
        first.dispose();

        const second = await runner(UP_BAR_ALERT, { frequency: "once_per_bar", snapshot: stored });
        expect(second.snapshotStatus).toBe("restored");
        expect(second.needsWarmUp()).toBe(false);
        expect(second.lastBarTime).toBe(LIVE[24]?.time);
        await expect(second.warmUp(HISTORY)).rejects.toMatchObject({ code: "warm-up-not-allowed" });
        // Replaying bars the snapshot already holds is a no-op.
        const tail = await feed(second, LIVE);
        second.dispose();

        expect(JSON.stringify([...head, ...tail])).toBe(JSON.stringify(cold));
    });

    it("keeps the once gate across a restore", async () => {
        const first = await runner(UP_BAR_ALERT, { frequency: "once" });
        await first.warmUp(HISTORY);
        expect(await feed(first, LIVE.slice(0, 30))).toHaveLength(1);
        const stored = await first.exportSnapshot();
        first.dispose();
        const second = await runner(UP_BAR_ALERT, { frequency: "once", snapshot: stored });
        expect(second.exhausted).toBe(true);
        expect(await feed(second, LIVE)).toEqual([]);
        second.dispose();
    });

    it("refuses a snapshot taken under another identity", async () => {
        const first = await runner(WITH_INPUTS, { inputs: { length: 3 } });
        await first.warmUp(HISTORY);
        const stored = await first.exportSnapshot();
        first.dispose();

        for (const extra of [
            { inputs: { length: 4 } },
            { symInfo: { ticker: "OTHER" }, inputs: { length: 3 } },
            { interval: "2h", inputs: { length: 3 } },
        ] satisfies ReadonlyArray<Partial<CreateAlertRunnerOpts>>) {
            const r = await runner(WITH_INPUTS, { ...extra, snapshot: stored });
            expect(r.snapshotStatus).toBe("key-mismatch");
            expect(r.needsWarmUp()).toBe(true);
            r.dispose();
        }
    });

    it("refuses malformed snapshots", async () => {
        const first = await runner(UP_BAR_ALERT);
        await first.warmUp(HISTORY);
        const stored = (await first.exportSnapshot()) as NonNullable<
            Awaited<ReturnType<AlertRunner["exportSnapshot"]>>
        >;
        first.dispose();

        for (const bad of [null, { format: "x" }, { ...stored, lastBarTime: "x" }]) {
            const r = await runner(UP_BAR_ALERT, { snapshot: bad });
            expect(r.snapshotStatus).toBe("invalid");
            r.dispose();
        }
        // An envelope that passes the shape check but whose payload the
        // runtime refuses falls back to a clean host.
        const refused = await runner(UP_BAR_ALERT, {
            snapshot: { ...stored, state: { snapshotVersion: 99 } },
        });
        expect(refused.snapshotStatus).toBe("invalid");
        expect(await feed(refused, LIVE.slice(0, 3))).toBeDefined();
        refused.dispose();
    });

    it("is unkeyed when the manifest has no compiler version", async () => {
        const c = await compiled(UP_BAR_ALERT);
        const { compilerVersion: _dropped, ...manifest } = c.manifest;
        const r = await createAlertRunner({
            compiled: { moduleSource: c.moduleSource, manifest },
            interval: "1h",
            frequency: "every_time",
            snapshot: {},
        });
        expect(r.key).toBeNull();
        expect(r.snapshotStatus).toBe("unkeyed");
        await r.warmUp(HISTORY);
        expect(await r.exportSnapshot()).toBeNull();
        // Pre-close still rolls back through a key-less internal snapshot.
        const forming = LIVE[0] as AlertBar;
        await r.onPreClose(forming, 0);
        expect(r.lastBarTime).toBe(HISTORY[HISTORY.length - 1]?.time);
        r.dispose();
    });
});

describe("lossy scripts", () => {
    it("never exports or restores a snapshot", async () => {
        const r = await runner(CROSS);
        expect(r.snapshotFidelity).toBe("lossy");
        await r.warmUp(HISTORY);
        expect(await r.exportSnapshot()).toBeNull();
        r.dispose();
        const restored = await runner(CROSS, { snapshot: {} });
        expect(restored.snapshotStatus).toBe("lossy");
        expect(restored.needsWarmUp()).toBe(true);
        restored.dispose();
    });

    it("evaluates pre-close on a replayed copy and leaves the live state alone", async () => {
        const cold = await coldEvents(CROSS);
        expect(cold.length).toBeGreaterThan(1);

        const seen: AlertRunnerDiagnostic[] = [];
        const r = await runner(CROSS, { onDiagnostic: (d) => seen.push(d) });
        await r.warmUp(HISTORY);
        const withPreClose: AlertRunnerEvent[] = [];
        const preCloseTimes: number[] = [];
        for (const bar of LIVE) {
            for (const e of (await r.onPreClose(bar, 0)).events) preCloseTimes.push(e.time);
            withPreClose.push(...(await r.onBarClose(bar)));
        }
        r.dispose();
        expect(JSON.stringify(withPreClose)).toBe(JSON.stringify(cold));
        // The pre-close of a bar sees what that bar's close sees.
        expect(preCloseTimes).toEqual(cold.map((e) => e.time));
        expect(seen).toEqual([]);
    });
});

describe("secondary intervals", () => {
    const daily = walk(10, 0, 24 * HOUR);

    it("warms and feeds a requested interval", async () => {
        const r = await runner(MTF);
        await r.warmUp(HISTORY, { secondary: { "1D": daily.slice(0, 4) } });
        expect(r.lastSecondaryBarTime("1D")).toBe(daily[3]?.time);
        expect(r.lastSecondaryBarTime("1W")).toBeNull();
        await r.onSecondaryBarClose("1D", daily[4] as AlertBar);
        await r.onSecondaryBarClose("1D", daily[4] as AlertBar);
        expect(r.lastSecondaryBarTime("1D")).toBe(daily[4]?.time);
        const events = await feed(r, LIVE);
        expect(events.length).toBeGreaterThan(0);
        expect(events[0]?.message).toMatch(/^above daily close \d/);
        const stored = await r.exportSnapshot();
        expect(stored?.secondaryLastBarTimes).toEqual({ "1D": daily[4]?.time });
        expect(stored?.key.requestedIntervals).toEqual(["1D"]);
        r.dispose();
        const restored = await runner(MTF, { snapshot: stored });
        expect(restored.lastSecondaryBarTime("1D")).toBe(daily[4]?.time);
        restored.dispose();
    });

    it("refuses an interval the script did not request", async () => {
        const r = await runner(MTF);
        await expect(r.warmUp(HISTORY, { secondary: { "1W": [] } })).rejects.toMatchObject({
            code: "unknown-interval",
        });
        await expect(r.onSecondaryBarClose("1W", daily[0] as AlertBar)).rejects.toMatchObject({
            code: "unknown-interval",
        });
        r.dispose();
    });

    it("counts a secondary-only warm-up as folded", async () => {
        const r = await runner(MTF);
        await r.warmUp([], { secondary: { "1D": daily.slice(0, 2) } });
        expect(r.needsWarmUp()).toBe(false);
        r.dispose();
    });
});

describe("failure", () => {
    it("aborts on maxSteps, fails the runner, and still disposes", async () => {
        const boundary = (LIVE[2] as AlertBar).time;
        const r = await runner(heavyAfter(boundary), {
            limits: { maxSteps: 2_000_000, maxStepMs: 60_000 },
        });
        await r.warmUp(HISTORY);
        await feed(r, LIVE.slice(0, 3));
        const failure = await r.onBarClose(LIVE[3] as AlertBar).catch((err: unknown) => err);
        expect(failure).toMatchObject({ code: "aborted", reason: "steps" });
        expect((failure as Error).message).toMatch(/step budget exceeded/);
        await expect(r.onBarClose(LIVE[4] as AlertBar)).rejects.toMatchObject({
            code: "runner-failed",
            reason: "steps",
        });
        await expect(r.exportSnapshot()).rejects.toMatchObject({ code: "runner-failed" });
        r.dispose();
        r.dispose();
        await expect(r.onBarClose(LIVE[4] as AlertBar)).rejects.toMatchObject({ code: "disposed" });
    });

    it("survives a script that runs out of memory inside compute", async () => {
        // The runtime catches the guest's own out-of-memory error like any
        // script error: that bar's emissions are dropped with a diagnostic
        // and the runner stays usable (the hoard is garbage afterwards).
        const hungry = `import { defineIndicator } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Hungry",
    apiVersion: 1,
    overlay: true,
    compute({ bar, alert }) {
        const hoard = [];
        if (bar.time === ${T0 + 103 * HOUR}) {
            for (let i = 0; i < 100000000; i++) hoard.push("x".repeat(1024) + i);
        }
        alert("bar " + hoard.length);
    },
});
`;
        const seen: AlertRunnerDiagnostic[] = [];
        const r = await runner(hungry, {
            limits: {
                maxHeapBytes: 16 * 1024 * 1024,
                maxStepMs: 60_000,
                maxSteps: Number.POSITIVE_INFINITY,
            },
            onDiagnostic: (d) => seen.push(d),
        });
        await r.warmUp(HISTORY);
        await feed(r, LIVE.slice(0, 3));
        expect(await r.onBarClose(LIVE[3] as AlertBar)).toEqual([]);
        expect(seen.map((d) => d.message).join("\n")).toMatch(/memory/i);
        expect(await r.onBarClose(LIVE[4] as AlertBar)).toHaveLength(1);
        r.dispose();
    });

    it("rejects malformed bars", async () => {
        const r = await runner(UP_BAR_ALERT);
        const good = LIVE[0] as AlertBar;
        await expect(r.onBarClose({ ...good, close: Number.NaN })).rejects.toMatchObject({
            code: "invalid-argument",
        });
        await expect(
            r.onBarClose({ ...good, closeTime: Number.POSITIVE_INFINITY }),
        ).rejects.toMatchObject({
            code: "invalid-argument",
        });
        await expect(r.warmUp([good, good])).rejects.toMatchObject({ code: "invalid-argument" });
        r.dispose();
    });

    it("serializes concurrent calls", async () => {
        const r = await runner(UP_BAR_ALERT);
        await r.warmUp(HISTORY);
        const all = await Promise.all(LIVE.map((bar) => r.onBarClose(bar)));
        expect(all.flat().map((e) => e.time)).toEqual(upBars(LIVE));
        r.dispose();
    });
});

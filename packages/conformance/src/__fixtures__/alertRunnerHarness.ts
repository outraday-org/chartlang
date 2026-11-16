// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Drives conformance scenarios through `@invinite-org/chartlang-alert-runner`
// (QuickJS) and, for the same bars, through the in-process runtime, so the
// two alert streams can be compared. Test-only: excluded from build and
// coverage like every `__fixtures__` module.
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { RunnerEmissions } from "@invinite-org/chartlang-adapter-kit";
import {
    type AlertBar,
    type AlertRunnerEvent,
    type CreateAlertRunnerOpts,
    alertRunnerCapabilities,
    createAlertRunner,
    requiredHistoryFor,
} from "@invinite-org/chartlang-alert-runner";
import { type CompiledScript, compile } from "@invinite-org/chartlang-compiler";
import type { Bar } from "@invinite-org/chartlang-core";
import { feedKey } from "@invinite-org/chartlang-core";
import type { CompiledModuleExport } from "@invinite-org/chartlang-runtime";
import { buildBundleFromModule, createScriptRunner } from "@invinite-org/chartlang-runtime";

import type { Scenario } from "../runConformanceSuite.js";

const PACKAGE_DIR = resolvePath(fileURLToPath(import.meta.url), "../../..");
const REPO_ROOT = resolvePath(PACKAGE_DIR, "../..");
const CACHE_DIR = resolvePath(PACKAGE_DIR, ".cache");

export const SYMBOL = "GOLDEN";
export const INTERVAL = "1D";

let goldenBars: ReadonlyArray<AlertBar> | null = null;

export async function loadGoldenBars(): Promise<ReadonlyArray<AlertBar>> {
    if (goldenBars === null) {
        const raw = JSON.parse(
            await readFile(resolvePath(PACKAGE_DIR, "fixtures/goldenBars.json"), "utf8"),
        ) as Bar[];
        goldenBars = raw.map((b) => ({
            time: b.time,
            open: b.open,
            high: b.high,
            low: b.low,
            close: b.close,
            volume: b.volume,
        }));
    }
    return goldenBars;
}

/** A scenario the runner pass can drive: close stream, no feeds, one file. */
export function isRunnerEligible(scenario: Scenario): boolean {
    return (
        scenario.historyReseed === undefined &&
        (scenario.eventStream === undefined || scenario.eventStream.kind === "close") &&
        scenario.externalSeriesFeeds === undefined &&
        scenario.externalSeriesEvents === undefined &&
        scenario.additionalSources === undefined &&
        (scenario.secondaryFeeds ?? []).every((feed) => feed.symbol === undefined)
    );
}

export async function compileScenario(scenario: Scenario): Promise<CompiledScript> {
    if (scenario.inlineSource !== undefined) {
        return compile(scenario.inlineSource, {
            apiVersion: 1,
            sourcePath: `<inline:${scenario.id}>.chart.ts`,
        });
    }
    const path = scenario.scriptPath as string;
    const source = await readFile(isAbsolute(path) ? path : resolvePath(REPO_ROOT, path), "utf8");
    return compile(source, { apiVersion: 1, sourcePath: path });
}

/**
 * Cheap pre-filter before compiling: a scenario whose source text never
 * mentions an alert surface cannot emit an event, so the runner pass skips it.
 */
export async function scenarioMentionsAlerts(scenario: Scenario): Promise<boolean> {
    const text =
        scenario.inlineSource ??
        (await readFile(
            isAbsolute(scenario.scriptPath as string)
                ? (scenario.scriptPath as string)
                : resolvePath(REPO_ROOT, scenario.scriptPath as string),
            "utf8",
        ));
    return /\balert\b|signal|defineAlert/.test(text);
}

export function scenarioUsesAlerts(compiled: CompiledScript): boolean {
    const families = compiled.manifest.capabilities;
    return families.includes("alerts") || families.includes("alertConditions");
}

function secondaryStreams(
    scenario: Scenario,
): ReadonlyArray<{ interval: string; bars: ReadonlyArray<AlertBar> }> {
    const out: { interval: string; bars: ReadonlyArray<AlertBar> }[] = [];
    for (const [interval, bars] of Object.entries(scenario.secondaryCandles ?? {}))
        out.push({ interval, bars });
    for (const feed of scenario.secondaryFeeds ?? [])
        out.push({ interval: feed.interval, bars: feed.bars });
    return out;
}

/** One step of a run: a bar for the main stream or for a secondary interval. */
type Step = Readonly<{ interval: string | null; bar: AlertBar }>;

export type RunPlan = Readonly<{
    warmMain: ReadonlyArray<AlertBar>;
    warmSecondary: Readonly<Record<string, ReadonlyArray<AlertBar>>>;
    live: ReadonlyArray<Step>;
}>;

/**
 * Split the scenario's bars into a warm-up and a live part, interleaving each
 * secondary bar before the first main bar at or after it (the conformance
 * runner's order).
 */
export function planRun(scenario: Scenario, bars: ReadonlyArray<AlertBar>, warm: number): RunPlan {
    const secondary = secondaryStreams(scenario);
    const main = bars.slice(0, Math.min(bars.length, scenario.candleLimit ?? bars.length));
    const warmMain = main.slice(0, warm);
    const cutoff = warmMain[warmMain.length - 1]?.time ?? Number.NEGATIVE_INFINITY;
    const warmSecondary: Record<string, AlertBar[]> = {};
    const cursor = new Map<string, number>();
    for (const { interval, bars: sbars } of secondary) {
        const within = sbars.filter((b) => b.time <= cutoff);
        if (within.length > 0) warmSecondary[interval] = [...within];
        cursor.set(interval, within.length);
    }
    const live: Step[] = [];
    for (const bar of main.slice(warm)) {
        for (const { interval, bars: sbars } of secondary) {
            let i = cursor.get(interval) as number;
            while (i < sbars.length && (sbars[i] as AlertBar).time <= bar.time) {
                live.push({ interval, bar: sbars[i] as AlertBar });
                i += 1;
            }
            cursor.set(interval, i);
        }
        live.push({ interval: null, bar });
    }
    return { warmMain, warmSecondary, live };
}

/** The runner's events for a plan, close-only. */
export async function runnerEvents(
    compiled: CompiledScript,
    plan: RunPlan,
    extra: Partial<CreateAlertRunnerOpts> = {},
): Promise<AlertRunnerEvent[]> {
    const runner = await createAlertRunner({
        compiled,
        interval: INTERVAL,
        frequency: "every_time",
        symInfo: { ticker: SYMBOL },
        limits: { maxStepMs: 60_000 },
        ...extra,
    });
    try {
        await runner.warmUp(plan.warmMain, { secondary: plan.warmSecondary });
        const events: AlertRunnerEvent[] = [];
        for (const step of plan.live) {
            if (step.interval === null) events.push(...(await runner.onBarClose(step.bar)));
            else await runner.onSecondaryBarClose(step.interval, step.bar);
        }
        return events;
    } finally {
        runner.dispose();
    }
}

function runtimeBar(bar: AlertBar, interval: string): Bar {
    return {
        ...bar,
        symbol: SYMBOL,
        interval,
        hl2: (bar.high + bar.low) / 2,
        hlc3: (bar.high + bar.low + bar.close) / 3,
        ohlc4: (bar.open + bar.high + bar.low + bar.close) / 4,
        hlcc4: (bar.high + bar.low + bar.close + bar.close) / 4,
        point: (_offset: number, price: number) => ({ time: bar.time, price }),
    };
}

/**
 * The same plan through the in-process runtime under the runner's own
 * capability bag, projected to what `every_time` must deliver: each alert and
 * each `fired: true` condition, in drain order.
 */
export async function referenceEmissions(
    compiled: CompiledScript,
    plan: RunPlan,
): Promise<RunnerEmissions[]> {
    await mkdir(CACHE_DIR, { recursive: true });
    const path = resolvePath(CACHE_DIR, `alert-runner-${randomBytes(8).toString("hex")}.mjs`);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, compiled.moduleSource, "utf8");
    try {
        const mod = (await import(
            /* @vite-ignore */ pathToFileURL(path).href
        )) as CompiledModuleExport;
        const runner = createScriptRunner({
            compiled: buildBundleFromModule(mod),
            capabilities: alertRunnerCapabilities({
                manifest: compiled.manifest,
                interval: INTERVAL,
                maxLookback: requiredHistoryFor(compiled.manifest, 1_000),
            }),
            symInfo: { ticker: SYMBOL },
        });
        for (const [interval, bars] of Object.entries(plan.warmSecondary)) {
            for (const bar of bars) {
                await runner.push({
                    kind: "history",
                    bars: [runtimeBar(bar, interval)],
                    streamKey: feedKey(undefined, interval),
                });
                runner.drain();
            }
        }
        for (const bar of plan.warmMain) {
            await runner.push({ kind: "history", bars: [runtimeBar(bar, INTERVAL)] });
            runner.drain();
        }
        const drains: RunnerEmissions[] = [];
        for (const step of plan.live) {
            if (step.interval === null) {
                await runner.push({ kind: "close", bar: runtimeBar(step.bar, INTERVAL) });
                drains.push(runner.drain());
            } else {
                await runner.push({
                    kind: "close",
                    bar: runtimeBar(step.bar, step.interval),
                    streamKey: feedKey(undefined, step.interval),
                });
                runner.drain();
            }
        }
        await runner.dispose();
        return drains;
    } finally {
        await rm(path, { force: true });
    }
}

/** The comparable part of an event (everything the drain also carries). */
export function comparable(event: AlertRunnerEvent): Record<string, unknown> {
    return {
        kind: event.kind,
        id: event.id,
        message: event.message,
        severity: event.severity,
        meta: event.meta,
        bar: event.bar,
        time: event.time,
    };
}

export function comparableDrains(
    drains: ReadonlyArray<RunnerEmissions>,
): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = [];
    for (const drained of drains) {
        for (const a of drained.alerts) {
            out.push({
                kind: "alert",
                id: a.slotId,
                message: a.message,
                severity: a.severity,
                meta: a.meta,
                bar: a.bar,
                time: a.time,
            });
        }
        for (const c of drained.alertConditions) {
            if (!c.fired) continue;
            out.push({
                kind: "condition",
                id: c.conditionId,
                message: c.defaultMessage,
                severity: undefined,
                meta: { description: c.description },
                bar: c.bar,
                time: c.time,
            });
        }
    }
    return out;
}

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CandleEvent, RunnerEmissions } from "@invinite-org/chartlang-adapter-kit";
import { type ExternalSeriesFeedMap, feedKey, isSnapshotError } from "@invinite-org/chartlang-core";
import {
    QuickJsStepAbortedError,
    type ScriptHost,
    createQuickJsHost,
} from "@invinite-org/chartlang-host-quickjs";

import { assertAlertBar, assertAscending, projectBar, toRuntimeBar } from "./bar.js";
import { DEFAULT_ALERT_RUNNER_MAX_LOOKBACK, alertRunnerCapabilities } from "./capabilities.js";
import { AlertRunnerError } from "./errors.js";
import { projectEvents } from "./events.js";
import { snapshotFidelityOf } from "./fidelity.js";
import { createFrequencyGate } from "./frequency.js";
import { validateAlertInputs } from "./inputs.js";
import { intervalMs } from "./interval.js";
import { buildStateStoreKey, canonicalJson, matchSnapshot, sha256Hex } from "./snapshot.js";
import type {
    AlertBar,
    AlertFrequency,
    AlertRunner,
    AlertRunnerEvent,
    AlertRunnerLimits,
    AlertRunnerSnapshot,
    BarCloseOpts,
    CreateAlertRunnerOpts,
    PreCloseResult,
    SnapshotStatus,
    WarmUpOpts,
} from "./types.js";

/**
 * Default sandbox caps. `maxSteps` bounds the work of one guest call
 * deterministically (about 2.5 million iterations of a tight loop);
 * `maxStepMs` is a generous wall-clock backstop, because a wall-clock budget
 * also fires on a descheduled thread, and an abort fails the runner.
 *
 * @since 1.0
 * @stable
 * @example
 *     import { DEFAULT_ALERT_RUNNER_LIMITS } from "@invinite-org/chartlang-alert-runner";
 *     void DEFAULT_ALERT_RUNNER_LIMITS.maxSteps; // 5_000_000
 */
export const DEFAULT_ALERT_RUNNER_LIMITS: AlertRunnerLimits = Object.freeze({
    maxHeapBytes: 32 * 1024 * 1024,
    maxStepMs: 250,
    maxSteps: 5_000_000,
    maxLoadTimeoutMs: 30_000,
});

/**
 * Floor of {@link AlertRunner.requiredHistory}. The manifest's `maxLookback`
 * covers only provable series indexing (`close[20]`), not the warm-up a
 * `ta.*` call needs — an `ema(close, 200)` script reports `maxLookback: 0` —
 * so the runner asks for at least this many bars unless the caller lowers it
 * through `minWarmUpBars`.
 *
 * @since 1.0
 * @stable
 * @example
 *     import { DEFAULT_MIN_WARM_UP_BARS } from "@invinite-org/chartlang-alert-runner";
 *     void DEFAULT_MIN_WARM_UP_BARS; // 1000
 */
export const DEFAULT_MIN_WARM_UP_BARS = 1_000;

const FREQUENCIES: ReadonlySet<AlertFrequency> = new Set([
    "once",
    "once_per_bar",
    "once_per_bar_close",
    "every_time",
]);

function assertCount(value: number | undefined, what: string, min: number): void {
    if (value === undefined) return;
    if (!Number.isInteger(value) || value < min) {
        throw new AlertRunnerError(
            "invalid-argument",
            `${what} must be an integer >= ${min}, got ${value}`,
        );
    }
}

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

function chunks<T>(items: ReadonlyArray<T>, size: number): ReadonlyArray<ReadonlyArray<T>> {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
}

function finiteOrNaN(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) ? value : Number.NaN;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** One folded event, plus the feed map sent right before it (lossy replay). */
type JournalEntry = Readonly<{ event: CandleEvent; feeds?: ExternalSeriesFeedMap }>;

/**
 * Entry key → descriptor name of each external-series input the caller
 * feeds. Runs after `validateAlertInputs`, which refuses a listed key that is
 * not an external series and two listed keys sharing one descriptor name.
 */
function externalFeedNames(
    manifest: CreateAlertRunnerOpts["compiled"]["manifest"],
    keys: ReadonlyArray<string>,
): ReadonlyMap<string, string> {
    const out = new Map<string, string>();
    const fed = new Set(keys);
    for (const [key, descriptor] of Object.entries(manifest.inputs)) {
        if (descriptor.kind === "external-series" && fed.has(key)) out.set(key, descriptor.name);
    }
    return out;
}

/**
 * The raw result of one evaluation: what the script emitted. Internal; not
 * exported from the package.
 *
 * @since 1.1
 * @internal
 * @example
 *     declare const step: RunnerStepResult;
 *     void step.drained.plots;
 */
export type RunnerStepResult = Readonly<{ drained: RunnerEmissions }>;

/**
 * The runner minus its public wrappers: the state both `createAlertRunner`
 * and `createSeriesRunner` expose, and the three evaluations with their raw
 * drain output. Internal; not exported from the package.
 *
 * @since 1.1
 * @internal
 * @example
 *     declare const core: RunnerCore;
 *     void core.shared.lastBarTime;
 */
export type RunnerCore = Readonly<{
    shared: Omit<AlertRunner, "warmUp" | "onBarClose" | "onPreClose">;
    warmUp(
        bars: ReadonlyArray<AlertBar>,
        opts: WarmUpOpts | undefined,
        /** Called per main chunk; a plot's warm-up position is `plot.bar + shift`. */
        onMainChunk?: (shift: number, drained: RunnerEmissions) => void,
    ): Promise<void>;
    onBarClose(
        bar: AlertBar,
        opts: BarCloseOpts | undefined,
    ): Promise<(RunnerStepResult & { events: ReadonlyArray<AlertRunnerEvent> }) | null>;
    onPreClose(
        bar: AlertBar,
        offsetMs: number,
        opts: BarCloseOpts | undefined,
    ): Promise<RunnerStepResult & { result: PreCloseResult }>;
}>;

/**
 * Bars of history a script needs before its first live bar: the largest of
 * `maxLookback + 1`, `maxBarsBack`, the dynamic-index fallback capacity
 * (`seriesCapacities.dynamicFallback`, 5,000) and the `minWarmUp` floor.
 *
 * @since 1.0
 * @stable
 * @example
 *     import { requiredHistoryFor } from "@invinite-org/chartlang-alert-runner";
 *     declare const manifest: Parameters<typeof requiredHistoryFor>[0];
 *     const bars = requiredHistoryFor(manifest, 1_000);
 *     void bars;
 */
export function requiredHistoryFor(
    manifest: CreateAlertRunnerOpts["compiled"]["manifest"],
    minWarmUp: number,
): number {
    return Math.max(
        manifest.maxLookback + 1,
        manifest.maxBarsBack ?? 0,
        manifest.seriesCapacities.dynamicFallback ?? 0,
        minWarmUp,
    );
}

/**
 * Turn a compiled chartlang script into a headless alert evaluator running in
 * a QuickJS sandbox: restore a stored snapshot (or warm up from history),
 * then feed closed bars and receive alert events filtered by the frequency.
 *
 * Throws `AlertRunnerError` with `"invalid-argument"` (bad options),
 * `"invalid-inputs"` (inputs that do not match the manifest; `details` lists
 * them), `"load-failed"` or `"aborted"` (the module did not load).
 *
 * @since 1.0
 * @stable
 * @example
 *     import { createAlertRunner } from "@invinite-org/chartlang-alert-runner";
 *
 *     const runner = await createAlertRunner({
 *         compiled,
 *         symInfo: { ticker: "AAPL" },
 *         interval: "1h",
 *         frequency: "once_per_bar_close",
 *         snapshot: stored,
 *     });
 *     if (runner.needsWarmUp()) await runner.warmUp(history);
 *     const events = await runner.onBarClose(bar);
 *     const next = await runner.exportSnapshot();
 *     runner.dispose();
 */
export async function createAlertRunner(opts: CreateAlertRunnerOpts): Promise<AlertRunner> {
    const core = await openRunner(opts);
    return Object.freeze<AlertRunner>(
        Object.defineProperties(
            {
                warmUp: (bars: ReadonlyArray<AlertBar>, warmOpts?: WarmUpOpts) =>
                    core.warmUp(bars, warmOpts),
                onBarClose: async (bar: AlertBar, closeOpts?: BarCloseOpts) =>
                    (await core.onBarClose(bar, closeOpts))?.events ?? [],
                onPreClose: async (bar: AlertBar, offsetMs: number, closeOpts?: BarCloseOpts) =>
                    (await core.onPreClose(bar, offsetMs, closeOpts)).result,
            },
            Object.getOwnPropertyDescriptors(core.shared),
        ) as AlertRunner,
    );
}

/**
 * Validate the options, load the sandbox, restore a snapshot: everything
 * `createAlertRunner` and `createSeriesRunner` share. Internal; not exported
 * from the package.
 *
 * @since 1.1
 * @internal
 * @example
 *     declare const opts: CreateAlertRunnerOpts;
 *     const core = await openRunner(opts);
 *     void core.shared.requiredHistory();
 */
export async function openRunner(opts: CreateAlertRunnerOpts): Promise<RunnerCore> {
    const { compiled, interval, frequency } = opts;
    const manifest = compiled.manifest;
    if (!FREQUENCIES.has(frequency)) {
        throw new AlertRunnerError(
            "invalid-argument",
            `unknown frequency ${JSON.stringify(frequency)}`,
        );
    }
    const barMs = intervalMs(interval);
    assertCount(opts.cooldownBars, "cooldownBars", 0);
    assertCount(opts.minWarmUpBars, "minWarmUpBars", 0);
    assertCount(opts.warmUpChunkBars, "warmUpChunkBars", 1);
    const inputs = opts.inputs ?? {};
    const fedKeys = opts.externalSeries?.names ?? [];
    if (!Array.isArray(fedKeys) || fedKeys.some((key) => typeof key !== "string")) {
        throw new AlertRunnerError(
            "invalid-argument",
            "externalSeries.names must be an array of input keys",
        );
    }
    const problems = validateAlertInputs(manifest, inputs, { externalSeries: fedKeys });
    if (problems.length > 0) {
        throw new AlertRunnerError("invalid-inputs", `invalid inputs: ${problems.join("; ")}`, {
            details: problems,
        });
    }
    const feedNames = externalFeedNames(manifest, fedKeys);

    const requiredHistory = requiredHistoryFor(
        manifest,
        opts.minWarmUpBars ?? DEFAULT_MIN_WARM_UP_BARS,
    );
    const chunkSize = opts.warmUpChunkBars ?? 1;
    const symbol = opts.symInfo?.ticker ?? "";
    const capabilities =
        opts.capabilities ??
        alertRunnerCapabilities({ manifest, interval, maxLookback: requiredHistory });
    const limits: AlertRunnerLimits = Object.freeze({
        ...DEFAULT_ALERT_RUNNER_LIMITS,
        ...opts.limits,
    });
    const requested = new Set(manifest.requestedIntervals);
    const [key, inputsHash] = await Promise.all([
        buildStateStoreKey({
            moduleSource: compiled.moduleSource,
            manifest,
            capabilities,
            symbol,
            interval,
        }),
        sha256Hex(canonicalJson(inputs)),
    ]);

    const fidelity = snapshotFidelityOf(compiled, { externalSeries: feedNames.size > 0 });
    // A lossy script cannot be rolled back or restored by snapshot, so the
    // runner keeps every event it folded in (with the external-series window
    // sent before it) and rebuilds by replaying them.
    const journal: JournalEntry[] | null = fidelity === "lossy" ? [] : null;
    // Absolute index of the next main-stream bar: the offset of every
    // external-series window the runner sends.
    let nextBarIndex = 0;
    let disposed = false;
    let failure: AlertRunnerError | null = null;
    let lastBarTime: number | null = null;
    const secondaryLastBarTimes = new Map<string, number>();
    let folded = false;
    let snapshotStatus: SnapshotStatus = "none";
    let gate = createFrequencyGate({
        frequency,
        intervalMs: barMs,
        ...(opts.cooldownBars === undefined ? {} : { cooldownBars: opts.cooldownBars }),
    });

    /** A loaded host plus the host messages of its CURRENT guest call. */
    type Sandbox = Readonly<{ host: ScriptHost; messages: string[] }>;

    async function buildSandbox(): Promise<Sandbox> {
        const messages: string[] = [];
        const fresh = createQuickJsHost({
            capabilities,
            resolveInputs: () => inputs,
            limits,
            onHostError: (message) => {
                messages.push(message);
            },
            ...(opts.symInfo === undefined ? {} : { symInfo: opts.symInfo }),
            ...(key === null ? {} : { stateStoreKey: key }),
            ...(opts.sessionCalendar === undefined
                ? {}
                : { sessionCalendar: opts.sessionCalendar }),
            ...(opts.quickJsLike === undefined ? {} : { quickJsLike: opts.quickJsLike }),
        });
        try {
            await fresh.load({ moduleSource: compiled.moduleSource, manifest });
        } catch (err) {
            fresh.dispose();
            if (err instanceof QuickJsStepAbortedError) {
                throw new AlertRunnerError("aborted", `script load aborted: ${err.message}`, {
                    reason: err.reason,
                    cause: err,
                });
            }
            throw new AlertRunnerError("load-failed", `script load failed: ${errorMessage(err)}`, {
                cause: err,
            });
        }
        messages.length = 0;
        return { host: fresh, messages };
    }

    let main = await buildSandbox();

    if (opts.snapshot !== undefined) {
        if (key === null) {
            snapshotStatus = "unkeyed";
        } else if (fidelity === "lossy") {
            snapshotStatus = "lossy";
        } else {
            const match = matchSnapshot(opts.snapshot, key, inputsHash);
            if (match.status !== "match") {
                snapshotStatus = match.status;
            } else {
                try {
                    const ack = await main.host.importSnapshot({
                        key,
                        snapshot: match.snapshot.state,
                    });
                    nextBarIndex = ack.barIndex + 1;
                    snapshotStatus = "restored";
                    lastBarTime = match.snapshot.lastBarTime;
                    for (const [k, v] of Object.entries(match.snapshot.secondaryLastBarTimes)) {
                        secondaryLastBarTimes.set(k, v);
                    }
                    gate = createFrequencyGate({
                        frequency,
                        intervalMs: barMs,
                        state: match.snapshot.gate,
                        ...(opts.cooldownBars === undefined
                            ? {}
                            : { cooldownBars: opts.cooldownBars }),
                    });
                } catch (err) {
                    main.host.dispose();
                    if (!isSnapshotError(err)) throw err;
                    // A refused import may have touched nothing, but a clean
                    // host is the only state that is certainly cold.
                    snapshotStatus = "invalid";
                    main = await buildSandbox();
                }
            }
        }
    }

    function fail(error: AlertRunnerError): AlertRunnerError {
        failure = error;
        return error;
    }

    function assertUsable(): void {
        if (disposed) throw new AlertRunnerError("disposed", "the alert runner is disposed");
        if (failure !== null) {
            throw new AlertRunnerError(
                "runner-failed",
                `the alert runner failed: ${failure.message}`,
                {
                    reason: failure.reason,
                    cause: failure,
                },
            );
        }
    }

    function report(messages: ReadonlyArray<string>, drained: RunnerEmissions): void {
        if (opts.onDiagnostic === undefined) return;
        for (const message of messages) opts.onDiagnostic({ source: "host", message });
        for (const diagnostic of drained.diagnostics) {
            opts.onDiagnostic({ source: "runtime", message: diagnostic.message, diagnostic });
        }
    }

    /**
     * Push one event into a sandbox, then drain. A step that hit a budget
     * poisons the host and the drain refuses — that, and an out-of-memory
     * push, raise `"aborted"` / `"out-of-memory"`; the caller decides whether
     * that fails the runner (the main sandbox) or not (a scratch one).
     */
    async function step(
        sandbox: Sandbox,
        event: CandleEvent,
        quiet = false,
    ): Promise<RunnerEmissions> {
        await sandbox.host.push(event);
        const messages = sandbox.messages.splice(0);
        const oom = messages.find((message) => message.startsWith("quickjs-oom"));
        if (oom !== undefined) throw new AlertRunnerError("out-of-memory", oom);
        let drained: RunnerEmissions;
        try {
            drained = await sandbox.host.drain();
        } catch (err) {
            if (err instanceof QuickJsStepAbortedError) {
                const detail = messages.length > 0 ? messages.join("; ") : err.message;
                throw new AlertRunnerError("aborted", detail, { reason: err.reason, cause: err });
            }
            throw err;
        }
        if (!quiet) report(messages, drained);
        return drained;
    }

    /**
     * {@link step} on the main sandbox: a budget or memory failure fails the
     * runner. `feeds`, when given, replaces the external-series map first.
     */
    async function mainStep(
        event: CandleEvent,
        feeds?: ExternalSeriesFeedMap,
    ): Promise<RunnerEmissions> {
        try {
            if (feeds !== undefined) main.host.setExternalSeries(feeds);
            const drained = await step(main, event);
            journal?.push(feeds === undefined ? { event } : { event, feeds });
            return drained;
        } catch (err) {
            if (err instanceof AlertRunnerError) throw fail(err);
            // An unexpected host error leaves it unknown whether the event
            // folded. A runner without external series survives (1.0); one
            // that feeds them cannot: `nextBarIndex` would lag the runtime's
            // bar index and every later window would read `NaN`, silently.
            if (feedNames.size > 0) {
                fail(
                    new AlertRunnerError(
                        "runner-failed",
                        `external-series alignment lost: ${errorMessage(err)}`,
                        { cause: err },
                    ),
                );
            }
            throw err;
        }
    }

    function assertFedKeys(given: Readonly<Record<string, unknown>>, what: string): void {
        for (const key of Object.keys(given)) {
            if (!feedNames.has(key)) {
                throw new AlertRunnerError(
                    "invalid-argument",
                    `${what}: ${JSON.stringify(key)} is not one of the runner's externalSeries names`,
                );
            }
        }
    }

    /**
     * The one-bar external-series window for the bar at `nextBarIndex`, or
     * `undefined` when the runner feeds none. O(1) per bar: the runtime reads
     * by absolute bar index through `offset`, so history is never re-sent.
     */
    function barFeeds(
        closeOpts: BarCloseOpts | undefined,
        what: string,
    ): ExternalSeriesFeedMap | undefined {
        const given = closeOpts?.externalSeries ?? {};
        if (!isRecord(given)) {
            throw new AlertRunnerError(
                "invalid-argument",
                `${what}: externalSeries must be an object`,
            );
        }
        assertFedKeys(given, what);
        if (feedNames.size === 0) return undefined;
        const feeds: Record<string, ExternalSeriesFeedMap[string]> = {};
        for (const [key, name] of feedNames) {
            feeds[name] = { values: [finiteOrNaN(given[key])], offset: nextBarIndex };
        }
        return feeds;
    }

    /** The warm-up window: one array per fed input, aligned to `bars`. */
    function warmUpFeeds(
        warmOpts: WarmUpOpts | undefined,
        barCount: number,
    ): ExternalSeriesFeedMap | undefined {
        const given = warmOpts?.externalSeries ?? {};
        if (!isRecord(given)) {
            throw new AlertRunnerError(
                "invalid-argument",
                "warmUp: externalSeries must be an object",
            );
        }
        assertFedKeys(given, "warmUp");
        // A chain warms every runner on the SAME bars, sized to the longest
        // `requiredHistory()` of the chain, so a consumer's own (smaller)
        // lookback must not refuse them: the cap is the default ring floor.
        const cap = Math.max(DEFAULT_ALERT_RUNNER_MAX_LOOKBACK, capabilities.maxLookback);
        const feeds: Record<string, ExternalSeriesFeedMap[string]> = {};
        for (const [key, name] of feedNames) {
            const values = given[key] ?? [];
            if (!Array.isArray(values)) {
                throw new AlertRunnerError(
                    "invalid-argument",
                    `warmUp: externalSeries ${JSON.stringify(key)} must be an array`,
                );
            }
            if (values.length > barCount || values.length > cap) {
                throw new AlertRunnerError(
                    "invalid-argument",
                    `warmUp: externalSeries ${JSON.stringify(key)} has ${values.length} values for ${barCount} bars (lookback ${cap})`,
                );
            }
            feeds[name] = { values: values.map(finiteOrNaN), offset: nextBarIndex };
        }
        return feedNames.size === 0 ? undefined : feeds;
    }

    function assertSecondary(name: string): void {
        if (!requested.has(name)) {
            throw new AlertRunnerError(
                "unknown-interval",
                `interval ${JSON.stringify(name)} is not one of the script's requestedIntervals`,
            );
        }
    }

    let chain: Promise<unknown> = Promise.resolve();
    function serialized<T>(fn: () => Promise<T>): Promise<T> {
        const result = chain.then(fn);
        chain = result.then(
            () => undefined,
            () => undefined,
        );
        return result;
    }

    async function warmUp(
        bars: ReadonlyArray<AlertBar>,
        warmOpts: WarmUpOpts | undefined,
        onMainChunk?: (shift: number, drained: RunnerEmissions) => void,
    ): Promise<void> {
        assertUsable();
        if (snapshotStatus === "restored" || folded) {
            throw new AlertRunnerError(
                "warm-up-not-allowed",
                "warmUp is only allowed before the first bar and without a restored snapshot",
            );
        }
        assertAscending(bars, "warmUp");
        // Sent once, with the first main chunk: the whole warm-up window.
        let feeds = warmUpFeeds(warmOpts, bars.length);
        const secondary = Object.entries(warmOpts?.secondary ?? {});
        for (const [name, secondaryBars] of secondary) {
            assertSecondary(name);
            assertAscending(secondaryBars, `warmUp secondary ${name}`);
        }
        // Secondary streams first: an expression-form `request.security`
        // captures its callback on the script's first compute, so its ring
        // must already hold history when the main stream starts.
        for (const [name, secondaryBars] of secondary) {
            for (const chunk of chunks(secondaryBars, chunkSize)) {
                await mainStep({
                    kind: "history",
                    bars: chunk.map((b) => toRuntimeBar(b, symbol, name)),
                    streamKey: feedKey(undefined, name),
                });
                folded = true;
                secondaryLastBarTimes.set(name, (chunk[chunk.length - 1] as AlertBar).time);
            }
        }
        let position = 0;
        for (const chunk of chunks(bars, chunkSize)) {
            const drained = await mainStep(
                {
                    kind: "history",
                    bars: chunk.map((b) => toRuntimeBar(b, symbol, interval)),
                },
                feeds,
            );
            feeds = undefined;
            onMainChunk?.(position - drained.fromBar, drained);
            position += chunk.length;
            nextBarIndex += chunk.length;
            folded = true;
            lastBarTime = (chunk[chunk.length - 1] as AlertBar).time;
        }
    }

    async function onBarClose(
        bar: AlertBar,
        closeOpts: BarCloseOpts | undefined,
    ): Promise<(RunnerStepResult & { events: ReadonlyArray<AlertRunnerEvent> }) | null> {
        assertUsable();
        assertAlertBar(bar, "onBarClose");
        const feeds = barFeeds(closeOpts, "onBarClose");
        // The watermark makes a replayed gap idempotent; a skipped bar
        // appends no external value either.
        if (lastBarTime !== null && bar.time <= lastBarTime) return null;
        const drained = await mainStep(
            { kind: "close", bar: toRuntimeBar(bar, symbol, interval) },
            feeds,
        );
        nextBarIndex += 1;
        lastBarTime = bar.time;
        folded = true;
        const events = gate.evaluate(
            projectEvents(drained, "close", 0, frequency),
            "close",
        ).delivered;
        return { drained, events };
    }

    async function onSecondaryBarClose(name: string, bar: AlertBar): Promise<void> {
        assertUsable();
        assertSecondary(name);
        assertAlertBar(bar, "onSecondaryBarClose");
        const previous = secondaryLastBarTimes.get(name);
        if (previous !== undefined && bar.time <= previous) return;
        await mainStep({
            kind: "close",
            bar: toRuntimeBar(bar, symbol, name),
            streamKey: feedKey(undefined, name),
        });
        secondaryLastBarTimes.set(name, bar.time);
        folded = true;
    }

    /**
     * A throwaway sandbox holding exactly the main sandbox's state: the main
     * state imported (an exact script) or every folded event replayed (a
     * lossy one). The main sandbox is never touched.
     */
    async function scratchCopy(): Promise<Sandbox> {
        const saved = journal === null ? await main.host.exportSnapshot() : null;
        if (journal === null && saved === null && folded) {
            throw new AlertRunnerError(
                "snapshot-unavailable",
                "could not capture state for the pre-close copy",
            );
        }
        const scratch = await buildSandbox();
        try {
            if (saved !== null) await scratch.host.importSnapshot(saved);
            // Replayed bars were reported when they were folded in.
            for (const entry of journal ?? []) {
                if (entry.feeds !== undefined) scratch.host.setExternalSeries(entry.feeds);
                await step(scratch, entry.event, true);
            }
        } catch (err) {
            scratch.host.dispose();
            throw err instanceof AlertRunnerError
                ? err
                : new AlertRunnerError(
                      "snapshot-unavailable",
                      `pre-close copy failed: ${errorMessage(err)}`,
                      {
                          cause: err,
                      },
                  );
        }
        return scratch;
    }

    async function onPreClose(
        bar: AlertBar,
        offsetMs: number,
        closeOpts: BarCloseOpts | undefined,
    ): Promise<RunnerStepResult & { result: PreCloseResult }> {
        assertUsable();
        assertAlertBar(bar, "onPreClose");
        const feeds = barFeeds(closeOpts, "onPreClose");
        if (!Number.isFinite(offsetMs) || offsetMs < 0) {
            throw new AlertRunnerError(
                "invalid-argument",
                `offsetMs must be finite and >= 0, got ${offsetMs}`,
            );
        }
        if (lastBarTime !== null && bar.time <= lastBarTime) {
            throw new AlertRunnerError(
                "stale-bar",
                `pre-close bar ${bar.time} is not after the last folded bar ${lastBarTime}`,
            );
        }
        // The forming bar goes in as a CLOSE — a tick would revise the last
        // committed bar and read a window one bar short. A close commits
        // (ring, `ta` accumulators, `state.*`), so it runs on a copy.
        const scratch = await scratchCopy();
        let drained: RunnerEmissions;
        try {
            if (feeds !== undefined) scratch.host.setExternalSeries(feeds);
            drained = await step(scratch, {
                kind: "close",
                bar: toRuntimeBar(bar, symbol, interval),
            });
        } finally {
            scratch.host.dispose();
        }
        const candidates = projectEvents(drained, "preClose", offsetMs, frequency);
        const verdict = gate.evaluate(candidates, "preClose");
        return {
            drained,
            result: {
                events: verdict.delivered,
                suppressed: verdict.suppressed,
                bar: projectBar(bar),
                offsetMs,
                emissionCount: candidates.length,
            },
        };
    }

    async function exportSnapshot(): Promise<AlertRunnerSnapshot | null> {
        assertUsable();
        if (key === null || fidelity === "lossy") return null;
        const exported = await main.host.exportSnapshot();
        if (exported === null) {
            throw new AlertRunnerError(
                "snapshot-unavailable",
                "the sandbox could not capture its state",
            );
        }
        return {
            format: "chartlang-alert-runner",
            version: 1,
            key,
            inputsHash,
            lastBarTime,
            secondaryLastBarTimes: Object.fromEntries(secondaryLastBarTimes),
            gate: gate.state(),
            state: exported.snapshot,
        };
    }

    const shared: RunnerCore["shared"] = {
        get snapshotStatus(): SnapshotStatus {
            return snapshotStatus;
        },
        key,
        snapshotFidelity: fidelity,
        get lastBarTime(): number | null {
            return lastBarTime;
        },
        lastSecondaryBarTime(name: string): number | null {
            return secondaryLastBarTimes.get(name) ?? null;
        },
        get exhausted(): boolean {
            return gate.exhausted;
        },
        requiredHistory: () => requiredHistory,
        needsWarmUp: () => snapshotStatus !== "restored" && !folded,
        onSecondaryBarClose: (name, bar) => serialized(() => onSecondaryBarClose(name, bar)),
        exportSnapshot: () => serialized(() => exportSnapshot()),
        dispose(): void {
            if (disposed) return;
            disposed = true;
            main.host.dispose();
        },
    };
    return {
        shared,
        warmUp: (bars, warmOpts, onMainChunk) =>
            serialized(() => warmUp(bars, warmOpts, onMainChunk)),
        onBarClose: (bar, closeOpts) => serialized(() => onBarClose(bar, closeOpts)),
        onPreClose: (bar, offsetMs, closeOpts) =>
            serialized(() => onPreClose(bar, offsetMs, closeOpts)),
    };
}

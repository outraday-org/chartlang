// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { AlertEmission, CandleEvent } from "@invinite-org/chartlang-adapter-kit";
import type { Bar, ScriptManifest } from "@invinite-org/chartlang-core";
import { type ReactElement, useEffect, useRef, useState } from "react";

import type { DemoAdapterDriver } from "./adapters/types";
import { DEFAULT_ADAPTER_ID, DEMO_ADAPTERS } from "./adapters/registry";
import type { CompiledArtifact } from "./hybridLanguageService";
import { createResamplingCandlePump } from "./secondaryStreams";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 480;
const PLAY_TOTAL_BARS = 1000;
const PLAY_DURATION_MS = 10_000;
const PLAY_TIMER_MS = 25;
const FALLBACK_BAR_INTERVAL_MS = 86_400_000;

/**
 * Props for {@link ChartPane}. The pane re-mounts the selected adapter's
 * driver every time `artifact` or `adapterId` changes; the previous
 * driver is disposed. `onPlayStart` fires when a play run begins so the
 * host can reset its alert feed. `onAdapterChange` is optional: when
 * provided the toolbar renders the adapter switcher (the live demo);
 * when omitted (the converter preview, which is locked to one adapter)
 * the switcher is hidden.
 */
export type ChartPaneProps = Readonly<{
    bars: ReadonlyArray<Bar>;
    artifact: CompiledArtifact | null;
    adapterId: string;
    onAlert: (alert: AlertEmission) => void;
    onPlayStart: () => void;
    onAdapterChange?: (id: string) => void;
}>;

type PushCandleSource = Readonly<{
    source: AsyncIterable<CandleEvent>;
    push: (bar: Bar) => void;
    end: () => void;
}>;

/**
 * A candle source the play run can feed. Yields the static history
 * batch once, then waits for `push(bar)` calls until `end()` is
 * invoked (on adapter teardown).
 */
function createPushCandleSource(history: ReadonlyArray<Bar>): PushCandleSource {
    const queue: Bar[] = [];
    let wake: (() => void) | null = null;
    let ended = false;
    return {
        source: {
            async *[Symbol.asyncIterator](): AsyncIterator<CandleEvent> {
                yield { kind: "history", bars: history };
                while (true) {
                    const bar = queue.shift();
                    if (bar !== undefined) {
                        yield { kind: "close", bar };
                        continue;
                    }
                    if (ended) return;
                    await new Promise<void>((resolve) => {
                        wake = resolve;
                    });
                    wake = null;
                }
            },
        },
        push: (bar) => {
            queue.push(bar);
            wake?.();
        },
        end: () => {
            ended = true;
            wake?.();
        },
    };
}

/** Random-walk continuation of `prev` (≈±1.5% close drift per bar). */
function nextRandomBar(prev: Bar, intervalMs: number): Bar {
    const time = prev.time + intervalMs;
    const open = prev.close;
    const close = Math.max(open * (1 + (Math.random() - 0.5) * 0.03), 0.01);
    const high = Math.max(open, close) * (1 + Math.random() * 0.008);
    const low = Math.min(open, close) * (1 - Math.random() * 0.008);
    const volume = 800 + Math.random() * 400;
    // No `point` method: bars are streamed to the worker host via
    // `postMessage`, and a function is not structured-cloneable (it throws
    // `DataCloneError`). The runtime injects the real `point` on its own
    // `BarView`, so input bars stay plain serialisable data — exactly like
    // the `bars.json` static history (which carries no `point` either).
    return {
        time,
        open,
        high,
        low,
        close,
        volume,
        symbol: prev.symbol,
        interval: prev.interval,
        hl2: (high + low) / 2,
        hlc3: (high + low + close) / 3,
        ohlc4: (open + high + low + close) / 4,
        hlcc4: (high + low + close + close) / 4,
    } as Bar;
}

/**
 * Right half of the demo. Holds a single container `<div>`; each new
 * artifact (or adapter selection) disposes the previous driver, resolves
 * the matching adapter from {@link DEMO_ADAPTERS}, dynamic-imports its
 * library, mounts a fresh driver into the container, loads the compiled
 * module, and runs the renderer loop in the background.
 *
 * The chart is static by default: the full dataset goes through one
 * history batch and historical alerts are suppressed. Each press of
 * Play resets the chart to the static history, then generates
 * {@link PLAY_TOTAL_BARS} fresh random-walk bars paced evenly across
 * {@link PLAY_DURATION_MS}, auto-stopping at the end (Stop cancels
 * early). Alerts fired by those generated bars (bar index >= history
 * length) are the only ones forwarded to `onAlert`.
 *
 * Cancellation flows through an `AbortController` that is wired into
 * `driver.run(signal)`, so the loop exits silently when a new artifact or
 * adapter arrives mid-stream instead of throwing through the disposed
 * driver. Because the factory + `host.load` are async (the driver lazily
 * imports a heavy lib), every `await` boundary re-checks `signal.aborted`
 * so a switch mid-import never mounts a stale driver.
 */
export function ChartPane(props: ChartPaneProps): ReactElement {
    const { artifact, bars, adapterId, onAdapterChange } = props;
    const [playing, setPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [playRun, setPlayRun] = useState(0);
    const [loadingLib, setLoadingLib] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const driverRef = useRef<DemoAdapterDriver | null>(null);
    const lastBarRef = useRef<Bar | null>(null);
    const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pendingPlayRef = useRef(false);
    const onAlertRef = useRef(props.onAlert);
    const onPlayStartRef = useRef(props.onPlayStart);
    onAlertRef.current = props.onAlert;
    onPlayStartRef.current = props.onPlayStart;

    const stopPlaying = (): void => {
        pendingPlayRef.current = false;
        if (playTimerRef.current !== null) {
            clearInterval(playTimerRef.current);
            playTimerRef.current = null;
        }
        setPlaying(false);
    };

    // Re-mounts the adapter with the pristine static history; the
    // effect below picks up the pending flag and starts streaming
    // once the compiled module is loaded. `playing` flips on right
    // away so the button gives feedback during the reload, and Stop
    // can cancel a still-pending run.
    const requestPlay = (): void => {
        onPlayStartRef.current();
        pendingPlayRef.current = true;
        setPlaying(true);
        setProgress(0);
        setPlayRun((run) => run + 1);
    };

    useEffect(() => {
        const container = containerRef.current;
        if (container === null || artifact === null || bars.length === 0) return;

        // Size the renderer to the container's ACTUAL laid-out box, not the
        // nominal 800×480: `.chart-surface` is `width:800px; max-width:100%`,
        // so in the two-column demo (or any pane narrower than 800px) it
        // shrinks to the pane width. canvas2d (CSS `max-width:100%`) and the
        // container-measuring libs (echarts/lightweight-charts) fit either
        // way, but uPlot/konva render at the explicit width they are handed —
        // pass 800 and their canvas overflows the narrower container to the
        // right (the clipped-right-edge symptom). Measuring keeps every
        // adapter inside the box. Fallback to the nominal size if the box has
        // not been laid out yet (clientWidth/Height === 0).
        const mountWidth = container.clientWidth || CANVAS_WIDTH;
        const mountHeight = container.clientHeight || CANVAS_HEIGHT;

        // Tear down the previous driver cleanly before spinning up a
        // fresh one. `dispose()` clears the renderer state, terminates the
        // underlying worker, and empties the mount element.
        driverRef.current?.dispose();
        driverRef.current = null;

        const controller = new AbortController();
        const pushSource = createPushCandleSource(bars);
        lastBarRef.current = bars[bars.length - 1] ?? null;
        const historyLength = bars.length;
        const last = bars[bars.length - 1];
        const beforeLast = bars[bars.length - 2];
        const intervalMs =
            last !== undefined && beforeLast !== undefined
                ? last.time - beforeLast.time
                : FALLBACK_BAR_INTERVAL_MS;

        // Multi-timeframe scripts request higher-timeframe streams in
        // their manifest. The demo has no real HTF feed, so it resamples
        // the main bars into each requested interval live (covering both the
        // history replay and the bars streamed during Play) and weaves the
        // secondary closes into the source. Non-MTF scripts keep the plain
        // single-source path byte-for-byte.
        const requestedIntervals = (artifact.manifest as ScriptManifest).requestedIntervals;
        const candleSource =
            requestedIntervals.length > 0
                ? createResamplingCandlePump(pushSource.source, requestedIntervals)
                : pushSource.source;
        const mainInterval = bars[0]?.interval;

        // Paces PLAY_TOTAL_BARS evenly across PLAY_DURATION_MS: each
        // timer tick emits however many bars the elapsed-time target
        // calls for, so a slow tab catches up instead of drifting.
        const beginStream = (): void => {
            const startedAt = performance.now();
            let emitted = 0;
            setPlaying(true);
            setProgress(0);
            playTimerRef.current = setInterval(() => {
                const elapsed = performance.now() - startedAt;
                const target = Math.min(
                    PLAY_TOTAL_BARS,
                    Math.floor((elapsed / PLAY_DURATION_MS) * PLAY_TOTAL_BARS),
                );
                while (emitted < target) {
                    const prev = lastBarRef.current;
                    if (prev === null) break;
                    const bar = nextRandomBar(prev, intervalMs);
                    lastBarRef.current = bar;
                    pushSource.push(bar);
                    emitted += 1;
                }
                setProgress(emitted);
                if (emitted >= PLAY_TOTAL_BARS) {
                    if (playTimerRef.current !== null) {
                        clearInterval(playTimerRef.current);
                        playTimerRef.current = null;
                    }
                    setPlaying(false);
                }
            }, PLAY_TIMER_MS);
        };

        const start = async (): Promise<void> => {
            try {
                setLoadingLib(true);
                // Resolve the selected adapter, falling back to the first
                // (canvas2d) descriptor for an unknown id.
                const descriptor =
                    DEMO_ADAPTERS.find((a) => a.id === adapterId) ?? DEMO_ADAPTERS[0];
                if (descriptor === undefined) return;
                const factory = await descriptor.load();
                if (controller.signal.aborted) return;
                const driver = await factory(container, {
                    candleSource,
                    ...(mainInterval !== undefined ? { interval: mainInterval } : {}),
                    width: mountWidth,
                    height: mountHeight,
                    onAlert: (alert) => {
                        // Chart bubbles mark every alert at its bar (history
                        // included); the React feed only carries live alerts
                        // from the play run.
                        if (alert.bar >= historyLength) onAlertRef.current(alert);
                    },
                });
                // A new artifact/adapter arrived while the lib was importing:
                // discard this now-stale driver instead of mounting it.
                if (controller.signal.aborted) {
                    driver.dispose();
                    return;
                }
                driverRef.current = driver;
                setLoadingLib(false);
                await driver.host.load({
                    moduleSource: artifact.moduleSource,
                    manifest: artifact.manifest as ScriptManifest,
                });
                if (controller.signal.aborted) return;
                if (pendingPlayRef.current) {
                    pendingPlayRef.current = false;
                    beginStream();
                }
                await driver.run(controller.signal);
            } catch (err) {
                if (controller.signal.aborted) return;
                console.error("chart render failed", err);
            } finally {
                if (!controller.signal.aborted) setLoadingLib(false);
            }
        };
        void start();

        return () => {
            if (playTimerRef.current !== null) {
                clearInterval(playTimerRef.current);
                playTimerRef.current = null;
            }
            // A pending run means this teardown IS the play-triggered
            // remount — keep the just-set playing state in that case.
            if (!pendingPlayRef.current) setPlaying(false);
            setLoadingLib(false);
            pushSource.end();
            controller.abort();
            // The driver may not exist yet if the teardown fires mid-import;
            // dispose whatever is mounted and clear the ref.
            driverRef.current?.dispose();
            driverRef.current = null;
        };
    }, [artifact, bars, adapterId, playRun]);

    useEffect(() => {
        return () => {
            driverRef.current?.dispose();
            driverRef.current = null;
        };
    }, []);

    const ready = artifact !== null && bars.length > 0;
    return (
        <div className="chart-pane">
            <div className="chart-toolbar">
                <button
                    className={`play-button ${playing ? "play-button-active" : ""}`}
                    disabled={!ready}
                    onClick={() => (playing ? stopPlaying() : requestPlay())}
                    type="button"
                >
                    {playing ? "Stop" : "Play"}
                </button>
                <span className="chart-mode">
                    {loadingLib
                        ? "loading renderer…"
                        : playing
                          ? `streaming random bars ${progress}/${PLAY_TOTAL_BARS}`
                          : "static history"}
                </span>
                {onAdapterChange !== undefined && (
                    <label className="chart-adapter">
                        <Select
                            items={DEMO_ADAPTERS.map((a) => ({ label: a.label, value: a.id }))}
                            onValueChange={(value) =>
                                onAdapterChange(value ?? DEFAULT_ADAPTER_ID)
                            }
                            value={adapterId}
                        >
                            {/* Disabled while streaming to avoid a mid-run
                                driver re-mount; re-enabled on stop. */}
                            <SelectTrigger aria-label="Adapter" disabled={playing} size="sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {DEMO_ADAPTERS.map((a) => (
                                    <SelectItem key={a.id} value={a.id}>
                                        {a.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </label>
                )}
            </div>
            <div className="chart-surface" ref={containerRef} />
        </div>
    );
}

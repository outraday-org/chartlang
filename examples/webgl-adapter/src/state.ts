// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import {
    type AlertConditionEmission,
    type AlertEmission,
    type DrawingEmission,
    type LogEmission,
    type PlotEmission,
    type PlotStyle,
    type ViewController,
    createViewController,
} from "@invinite-org/chartlang-adapter-kit";
import type { Bar, LineStyle } from "@invinite-org/chartlang-core";

import { DEFAULT_PALETTE, type Palette } from "./layer-descriptor.js";

/**
 * One accumulated point in a plot series, keyed by `${paneKey}|${slotId}` at
 * the adapter layer. `value` is `null` for a "skip this bar" gap. `bar` is
 * the source bar index; `xShift` is the presentation-only display shift in
 * bars (omitted ⇒ no shift). `buildFrame` resolves the drawn world x from
 * `bar` + `xShift` via the shared `shiftedBarTime`, so an omitted `xShift`
 * reproduces the unshifted bar's time.
 *
 * `z` (default `0`) + `seq` (global declaration order) are the render-pass
 * sort keys assigned at ingest. `upper` / `lower` are the per-bar
 * `filled-band` edges (each `null` for a gap; omitted for every other style).
 * `colorValue` is the per-bar dynamic-color channel for the line family
 * (omitted ⇒ static `color`; present ⇒ override; `null` ⇒ paint-nothing gap).
 *
 * @since 0.1
 * @stable
 * @example
 *     const p: PlotPoint = {
 *         time: 1_700_000_000_000, value: 42.31, color: "#26a69a", bar: 100,
 *         z: 0, seq: 0,
 *     };
 *     void p;
 */
export type PlotPoint = {
    readonly time: number;
    readonly value: number | null;
    readonly color: string | null;
    readonly bar: number;
    readonly xShift?: number;
    readonly z: number;
    readonly seq: number;
    readonly upper?: number | null;
    readonly lower?: number | null;
    readonly colorValue?: string | null;
};

/**
 * One horizontal-line definition keyed by callsite slot id (last-write-wins).
 * `paneKey` routes it into its pane's y-range + draw pass; `z` / `seq` are the
 * ingest-assigned render-order keys.
 *
 * @since 0.1
 * @stable
 * @example
 *     const h: HLine = {
 *         price: 70, color: "#ef4444", lineWidth: 1, lineStyle: "dashed",
 *         paneKey: "rsi", z: 0, seq: 0,
 *     };
 *     void h;
 */
export type HLine = {
    readonly price: number;
    readonly color: string | null;
    readonly lineWidth: number;
    readonly lineStyle: LineStyle;
    readonly paneKey: string;
    readonly z: number;
    readonly seq: number;
};

/**
 * The pure, renderer-agnostic state container the WebGL adapter accumulates
 * emissions into. Mirrors the canvas2d reference adapter's stores so the two
 * stay behaviourally identical (last-write-wins per slot, pane-keyed series,
 * z / seq assigned at ingest), minus the canvas2d-specific render handles
 * (`ctx`, `dpr`, interaction detach) — those are GL / loop concerns wired in
 * Task 5. `view` is a shared adapter-kit {@link ViewController}; `buildFrame`
 * reads the x-window from it and never reimplements the window math.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { createAdapterState } from "chartlang-example-webgl-adapter";
 *     const state = createAdapterState();
 *     // state.paneOrder[0] === "overlay"
 *     void state;
 */
export type AdapterState = {
    readonly bars: Bar[];
    // Distinct pane keys in first-emit order; `"overlay"` is always index 0.
    paneOrder: string[];
    // Keyed `${paneKey}|${slotId}` so the same callsite can land in different
    // panes and a pane's y-scale only sees its own series.
    readonly plotSeries: Map<string, PlotPoint[]>;
    readonly plotSeriesStyle: Map<string, PlotStyle>;
    readonly plotOverlays: Map<string, PlotEmission>;
    // Keyed by slotId (last-write-wins); the value carries its pane key.
    readonly hlines: Map<string, HLine>;
    readonly recentAlerts: AlertEmission[];
    readonly currentAlertConditions: AlertConditionEmission[];
    readonly recentLogs: LogEmission[];
    readonly drawings: Map<string, DrawingEmission>;
    // Global declaration-order counter, bumped once per ingested sortable
    // mark; the (z, band, seq) tiebreak keeps the paint order total.
    seq: number;
    // Declaration sequence for each glyph overlay (`${slotId}@${time}`) /
    // drawing (`handleId`), written in lockstep with `plotOverlays` /
    // `drawings` (which carry `z` but not `seq`).
    readonly overlaySeq: Map<string, number>;
    readonly drawingSeq: Map<string, number>;
    readonly palette: Palette;
    // Pan/zoom controller (adapter-kit). `buildFrame` resolves the per-frame
    // x window through `view.resolveXWindow(...)`; the held window wins once
    // the user interacts.
    readonly view: ViewController;
    // Default visible-window size (most-recent N bars shown on load);
    // undefined ⇒ fit all data. Resolved into `autoFollowXMin` each frame.
    readonly initialVisibleBars?: number;
};

/**
 * Options for {@link createAdapterState}. Both are optional — omit `palette`
 * to seed {@link DEFAULT_PALETTE}, omit `initialVisibleBars` to fit all data.
 * Task 5's factory threads `opts.palette` / `opts.initialVisibleBars` here.
 *
 * @since 0.1
 * @stable
 * @example
 *     const opts: CreateAdapterStateOpts = { initialVisibleBars: 120 };
 *     void opts;
 */
export type CreateAdapterStateOpts = {
    readonly palette?: Palette;
    readonly initialVisibleBars?: number;
};

// Per-pane filter prefix for `plotSeries` / `plotSeriesStyle` keys. The
// canonical separator (`|`) is owned by `paneSlotKey`; this returns the
// prefix only so callers `key.startsWith(...)` without re-asserting it.
export function paneKeyPrefix(paneKey: string): string {
    return `${paneKey}|`;
}

/**
 * The `${paneKey}|${slotId}` composite key for the `plotSeries` /
 * `plotSeriesStyle` maps — keeps a slot's series partitioned per pane so a
 * subpane oscillator never stretches the overlay y-scale.
 *
 * @since 0.1
 * @stable
 * @example
 *     paneSlotKey("overlay", "ema#0"); // "overlay|ema#0"
 */
export function paneSlotKey(paneKey: string, slotId: string): string {
    return `${paneKey}|${slotId}`;
}

/**
 * Construct an empty {@link AdapterState}: `view` is a fresh adapter-kit
 * {@link ViewController}, `paneOrder` seeds `["overlay"]`, and `palette` is
 * `opts.palette ?? DEFAULT_PALETTE`. Pure — no GL, no DOM.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { createAdapterState } from "chartlang-example-webgl-adapter";
 *     const state = createAdapterState({ initialVisibleBars: 120 });
 *     // state.palette.candleBullBody === "#26a69a"
 *     void state;
 */
export function createAdapterState(opts: CreateAdapterStateOpts = {}): AdapterState {
    return {
        bars: [],
        paneOrder: ["overlay"],
        plotSeries: new Map(),
        plotSeriesStyle: new Map(),
        plotOverlays: new Map(),
        hlines: new Map(),
        recentAlerts: [],
        currentAlertConditions: [],
        recentLogs: [],
        drawings: new Map(),
        seq: 0,
        overlaySeq: new Map(),
        drawingSeq: new Map(),
        palette: opts.palette ?? DEFAULT_PALETTE,
        view: createViewController(),
        ...(opts.initialVisibleBars !== undefined
            ? { initialVisibleBars: opts.initialVisibleBars }
            : {}),
    };
}

/**
 * Reset an {@link AdapterState} back to its constructed-empty shape — the
 * `dispose` helper Task 5's factory calls. Clears every store and resets the
 * sequence counter + pane order in place (the `view` controller and `palette`
 * are retained — a same-canvas remount reuses them).
 *
 * @since 0.1
 * @stable
 * @example
 *     import { createAdapterState, resetAdapterState } from "chartlang-example-webgl-adapter";
 *     const state = createAdapterState();
 *     resetAdapterState(state);
 *     // state.seq === 0
 *     void state;
 */
export function resetAdapterState(state: AdapterState): void {
    state.bars.length = 0;
    state.paneOrder = ["overlay"];
    state.plotSeries.clear();
    state.plotSeriesStyle.clear();
    state.plotOverlays.clear();
    state.hlines.clear();
    state.recentAlerts.length = 0;
    state.currentAlertConditions.length = 0;
    state.recentLogs.length = 0;
    state.drawings.clear();
    state.seq = 0;
    state.overlaySeq.clear();
    state.drawingSeq.clear();
}

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { MockCanvasContext } from "@invinite-org/chartlang-adapter-kit/canvas";

import type { UplotFactory, UplotLike, UplotOptions } from "./createUplotAdapter.js";

// uPlot's aligned data table — `[xValues, ...yValues]`.
type AlignedData = ReadonlyArray<ReadonlyArray<number | null>>;

/**
 * One recorded method call against a {@link MockUplot}. Tests inspect the
 * factory's `records` array to assert the per-pane uPlot construction +
 * update sequence without standing up a DOM. `new` captures the built
 * {@link UplotOptions} + the initial data + the target's pane key.
 *
 * @since 1.4
 * @stable
 * @example
 *     const r: UplotRecord = { kind: "setScale", scaleKey: "y", min: 0, max: 1 };
 *     void r;
 */
export type UplotRecord =
    | { readonly kind: "new"; readonly opts: UplotOptions; readonly data: AlignedData }
    | { readonly kind: "setData"; readonly data: AlignedData }
    | {
          readonly kind: "setScale";
          readonly scaleKey: string;
          readonly min: number;
          readonly max: number;
      }
    | { readonly kind: "destroy" };

/**
 * A headless stand-in for a uPlot instance satisfying {@link UplotLike}.
 * Every call appends a {@link UplotRecord} to `records`; `valToPos` is a
 * deterministic linear stub (configurable scale range) so the draw hook's
 * `u.valToPos(price, "y")` is reproducible; `ctx` is a
 * `MockCanvasContext` so the hline / candle draw pass records to a hashable
 * call log. `runDraw()` invokes the instance's registered `hooks.draw`
 * (what a real uPlot does each redraw) so tests can drive the ctx pass.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { MockUplot } from "chartlang-example-uplot-adapter/testing";
 *     const u = new MockUplot({ width: 800, height: 400, paneKey: "overlay", series: [], hooks: { draw: [] } }, [[0, 1]]);
 *     u.setData([[0, 1], [2, 3]]);
 *     // u.records[1].kind === "setData"
 *     void u;
 */
export class MockUplot implements UplotLike {
    readonly records: UplotRecord[] = [];
    readonly ctx: MockCanvasContext = new MockCanvasContext();
    // The plotting-area bbox. The headless mock keeps `devicePixelRatio`
    // at 1 and the plot area flush with the canvas (offset 0), so canvas
    // px == CSS px and `valToPos` is the plotting-area-relative projection
    // `buildViewport` reproduces.
    readonly bbox: { left: number; top: number; width: number; height: number };
    private readonly drawHooks: ReadonlyArray<(u: UplotLike) => void>;
    // Linear `valToPos` mapping for the `y` scale: a value in
    // `[scaleMin, scaleMax]` maps across `[0, plotHeight]`, y-flipped.
    private scaleMin = 0;
    private scaleMax = 1;
    // The `x` (time) scale, derived from the data's bar-time row — uPlot
    // ranges the x scale from data, so the adapter never `setScale("x")`s.
    private xMin = 0;
    private xMax = 1;
    private readonly plotHeight: number;
    private readonly plotWidth: number;

    constructor(opts: UplotOptions, data: AlignedData) {
        this.records.push({ kind: "new", opts, data });
        this.drawHooks = opts.hooks.draw;
        this.plotHeight = opts.height;
        this.plotWidth = opts.width;
        this.bbox = { left: 0, top: 0, width: opts.width, height: opts.height };
        this.rangeXFrom(data);
    }

    // The scale ranges `buildViewport` reads. `x`/`y` carry the current
    // min/max; an unkeyed lookup is `undefined`, matching uPlot.
    get scales(): Readonly<Record<string, { readonly min?: number; readonly max?: number }>> {
        return {
            x: { min: this.xMin, max: this.xMax },
            y: { min: this.scaleMin, max: this.scaleMax },
        };
    }

    private rangeXFrom(data: AlignedData): void {
        const xs = data[0] ?? [];
        let min = Number.POSITIVE_INFINITY;
        let max = Number.NEGATIVE_INFINITY;
        for (const value of xs) {
            if (value === null || !Number.isFinite(value)) continue;
            if (value < min) min = value;
            if (value > max) max = value;
        }
        if (Number.isFinite(min) && Number.isFinite(max)) {
            this.xMin = min;
            this.xMax = max === min ? min + 1 : max;
        }
    }

    setData(data: AlignedData): void {
        this.records.push({ kind: "setData", data });
        this.rangeXFrom(data);
    }

    setScale(scaleKey: string, limits: { min: number; max: number }): void {
        this.records.push({ kind: "setScale", scaleKey, min: limits.min, max: limits.max });
        if (scaleKey === "y") {
            this.scaleMin = limits.min;
            this.scaleMax = limits.max;
        }
    }

    destroy(): void {
        this.records.push({ kind: "destroy" });
    }

    valToPos(val: number, scaleKey: string, _canvasPixels?: boolean): number {
        if (scaleKey === "x") {
            // `rangeXFrom` widens a single-point range and the default is
            // `[0, 1]`, so the x span is always non-zero by construction.
            const span = this.xMax - this.xMin;
            return ((val - this.xMin) / span) * this.plotWidth;
        }
        const span = this.scaleMax - this.scaleMin;
        if (span === 0) return this.plotHeight / 2;
        const normalised = (val - this.scaleMin) / span;
        // Canvas y grows downward; a higher value sits nearer the top.
        return this.plotHeight - normalised * this.plotHeight;
    }

    /**
     * Invoke every registered `hooks.draw` (what a real uPlot does each
     * redraw), driving the adapter's ctx pass against {@link ctx}.
     *
     * @since 1.4
     * @stable
     * @example
     *     import { MockUplot } from "chartlang-example-uplot-adapter/testing";
     *     declare const u: MockUplot;
     *     u.runDraw();
     */
    runDraw(): void {
        for (const hook of this.drawHooks) {
            hook(this);
        }
    }
}

/**
 * Build a {@link UplotFactory} backed by {@link MockUplot} instances. The
 * shared `instances` array collects every instance the adapter
 * constructs (one per pane), in construction order, so tests can inspect
 * the per-pane build + drive each instance's draw pass.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { makeMockUplotFactory } from "chartlang-example-uplot-adapter/testing";
 *     const { factory, instances } = makeMockUplotFactory();
 *     // pass `factory` as `opts.uplotFactory` to `createUplotAdapter`
 *     void factory;
 *     void instances;
 */
export function makeMockUplotFactory(): {
    readonly factory: UplotFactory;
    readonly instances: MockUplot[];
} {
    const instances: MockUplot[] = [];
    const factory: UplotFactory = (opts, data) => {
        const instance = new MockUplot(opts, data);
        instances.push(instance);
        return instance;
    };
    return { factory, instances };
}

export { hashCallLog } from "@invinite-org/chartlang-adapter-kit/canvas";

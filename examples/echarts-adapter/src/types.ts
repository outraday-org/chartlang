// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { EChartsOption, SetOptionOpts } from "echarts/types/dist/echarts";

/**
 * The minimal structural slice of an ECharts instance the adapter drives.
 * Both the real `EChartsType` (from `echarts.init(container)`) and the
 * test-time {@link import("./testing.js").MockECharts} satisfy this, so the
 * factory's `opts.echartsFactory` seam can return either without the adapter
 * importing the full `EChartsType`. Declared structurally (not imported as
 * `EChartsType`) so the mock does not have to implement the chart's whole
 * surface.
 *
 * @since 1.4
 * @stable
 * @example
 *     import type { EChartsSurface } from "chartlang-example-echarts-adapter";
 *     declare const chart: EChartsSurface;
 *     chart.setOption({ series: [] });
 *     void chart;
 */
export type EChartsSurface = {
    setOption(option: EChartsOption, opts?: SetOptionOpts): void;
    resize(): void;
    dispose(): void;
    /**
     * Optional pixel converter used by `buildViewport` to align drawing
     * `graphic` elements with the candlestick grid. Production wires the real
     * `echarts.init(...)` instance, whose `convertToPixel` is DOM/layout-bound
     * and only meaningful once laid out; the headless default + the mock may
     * omit it (then `buildViewport` returns a deterministic fallback). The
     * structural shape (a `{ gridIndex }` finder + a value pair → a pixel
     * pair) is the slice the adapter consumes; the real ECharts overload is
     * wider and assignable to it.
     */
    convertToPixel?(
        finder: { readonly gridIndex: number },
        value: readonly [number, number],
    ): readonly [number, number] | undefined;
    /**
     * Optional reader for the live option tree. The adapter rebuilds the
     * whole option every drain with `notMerge: true`, which would reset any
     * user `dataZoom` window; before each rebuild it reads the current
     * `dataZoom[0].start`/`.end` back through this and re-applies them, so an
     * inside-zoom/pan survives the rebuild. The real `echarts.init(...)`
     * instance implements `getOption()`; the headless default omits it (no
     * zoom to preserve). Only the `dataZoom` slice is consumed.
     */
    getOption?(): {
        readonly dataZoom?: ReadonlyArray<{ readonly start: number; readonly end: number }>;
    };
    /**
     * Optional event subscription. The adapter binds a `"dblclick"` handler to
     * reset the inside-`dataZoom` window to the full range (`0`/`100`), for
     * parity with the canvas2d reference adapter's double-click reset. The real
     * `echarts.init(...)` instance implements the wide ECharts `on(eventName,
     * handler)` overload, which is assignable to this narrow slice; the headless
     * default omits it (no interaction to wire) and the mock implements it so
     * the reset path is exercised without a DOM. Only the bare `(eventName,
     * handler)` form is consumed.
     */
    on?(eventName: string, handler: () => void): void;
};

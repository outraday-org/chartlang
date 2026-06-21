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
};

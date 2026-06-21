// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { EChartsSurface } from "chartlang-example-echarts-adapter";

import type { DemoAdapterFactory } from "./types";

/**
 * ECharts driver. The adapter takes an `echartsFactory` DOM seam rather
 * than importing `echarts` itself, so the driver dynamic-imports `echarts`
 * and supplies `() => echarts.init(mountEl)`.
 */
const factory: DemoAdapterFactory = async (mountEl, opts) => {
    const [{ createEChartsAdapter, runEChartsLoop }, echarts] = await Promise.all([
        import("chartlang-example-echarts-adapter"),
        import("echarts"),
    ]);

    mountEl.replaceChildren();
    const adapter = createEChartsAdapter({
        // The real `echarts.init` returns the wider `EChartsType`, whose
        // `convertToPixel` overload (value: `ScaleDataValue`, incl. `Date`)
        // is not structurally assignable to `EChartsSurface`'s narrowed slice
        // under `exactOptionalPropertyTypes` — narrow it at this one seam.
        echartsFactory: () => echarts.init(mountEl) as unknown as EChartsSurface,
        candleSource: opts.candleSource,
        ...(opts.interval !== undefined ? { interval: opts.interval } : {}),
        ...(opts.onAlert !== undefined ? { onAlert: opts.onAlert } : {}),
    });

    let disposed = false;
    return {
        host: adapter.host,
        run: (signal) => runEChartsLoop(adapter, { signal }),
        dispose: () => {
            if (disposed) return;
            disposed = true;
            adapter.dispose();
            mountEl.replaceChildren();
        },
    };
};

export default factory;

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DemoAdapterFactory } from "./types";

/**
 * Lightweight Charts driver. The adapter imports `lightweight-charts`
 * internally (default `createChart`) and mounts into the container, so the
 * driver only needs `mountEl` + the candle wiring.
 */
const factory: DemoAdapterFactory = async (mountEl, opts) => {
    const { createLightweightChartsAdapter, runRendererLoop } = await import(
        "chartlang-example-lightweight-charts-adapter"
    );

    mountEl.replaceChildren();
    const adapter = createLightweightChartsAdapter({
        container: mountEl,
        candleSource: opts.candleSource,
        ...(opts.initialVisibleBars !== undefined
            ? { initialVisibleBars: opts.initialVisibleBars }
            : {}),
        ...(opts.interval !== undefined ? { interval: opts.interval } : {}),
        ...(opts.onAlert !== undefined ? { onAlert: opts.onAlert } : {}),
    });

    let disposed = false;
    return {
        host: adapter.host,
        run: (signal) => runRendererLoop(adapter, { signal }),
        dispose: () => {
            if (disposed) return;
            disposed = true;
            adapter.dispose();
            mountEl.replaceChildren();
        },
    };
};

export default factory;

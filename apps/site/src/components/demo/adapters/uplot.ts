// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DemoAdapterFactory } from "./types";

/**
 * uPlot driver. The adapter imports `uplot` internally and constructs one
 * instance per pane against `target`, so the driver hands it `mountEl` plus
 * the explicit `width`/`height` uPlot needs at construction.
 */
const factory: DemoAdapterFactory = async (mountEl, opts) => {
    const { createUplotAdapter, runUplotLoop } = await import("chartlang-example-uplot-adapter");

    mountEl.replaceChildren();
    const adapter = createUplotAdapter({
        target: mountEl,
        width: opts.width,
        height: opts.height,
        candleSource: opts.candleSource,
        ...(opts.interval !== undefined ? { interval: opts.interval } : {}),
        ...(opts.onAlert !== undefined ? { onAlert: opts.onAlert } : {}),
    });

    let disposed = false;
    return {
        host: adapter.host,
        run: (signal) => runUplotLoop(adapter, { signal }),
        dispose: () => {
            if (disposed) return;
            disposed = true;
            adapter.dispose();
            mountEl.replaceChildren();
        },
    };
};

export default factory;

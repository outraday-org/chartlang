// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// uPlot ships its layout in a stylesheet: it sizes the canvas + positions
// `.u-wrap`/`.u-over`/`.u-axis` via these rules. Without it the canvas
// renders at its device-px backing size (2× on Retina) and overflows the
// mount, so the chart appears tiny in a clipped corner. This rides the lazy
// per-adapter uplot chunk (the driver module is only ever dynamic-imported),
// so it never enters the SSR or initial client graph.
import "uplot/dist/uPlot.min.css";

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
        ...(opts.initialVisibleBars !== undefined
            ? { initialVisibleBars: opts.initialVisibleBars }
            : {}),
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

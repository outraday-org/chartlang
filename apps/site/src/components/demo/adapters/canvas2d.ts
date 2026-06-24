// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DemoAdapterFactory } from "./types";

/**
 * Canvas 2D driver. Builds a `<canvas class="chart-canvas">` inside
 * `mountEl` — the class is preserved because `landing.spec.ts` targets
 * `canvas.chart-canvas` and reads its bitmap.
 */
const factory: DemoAdapterFactory = async (mountEl, opts) => {
    const { createCanvas2dAdapter, runRendererLoop } = await import(
        "chartlang-example-canvas2d-adapter"
    );

    const canvas = document.createElement("canvas");
    canvas.className = "chart-canvas";
    canvas.width = opts.width;
    canvas.height = opts.height;
    mountEl.replaceChildren(canvas);

    const adapter = createCanvas2dAdapter({
        canvas,
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

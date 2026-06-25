// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DemoAdapterFactory } from "./types";

/**
 * WebGL driver. Builds a `<canvas class="chart-canvas">` inside `mountEl`
 * and lets `createWebglAdapter` resolve a WebGL2 context from it (raw
 * WebGL2, no chart lib — like canvas2d). The `chart-canvas` class carries
 * the demo's canvas styling (`demo.css`).
 */
const factory: DemoAdapterFactory = async (mountEl, opts) => {
    const { createWebglAdapter, runWebglLoop } = await import("chartlang-example-webgl-adapter");

    // Back the canvas at the device-pixel ratio (retina) and lay it out at the
    // CSS size, then hand the dpr to the adapter so its GL pipeline draws
    // full-thickness, crisp lines instead of half-thick HiDPI hairlines.
    const dpr = mountEl.ownerDocument.defaultView?.devicePixelRatio ?? 1;
    const canvas = document.createElement("canvas");
    canvas.className = "chart-canvas";
    canvas.width = Math.round(opts.width * dpr);
    canvas.height = Math.round(opts.height * dpr);
    canvas.style.width = `${opts.width}px`;
    canvas.style.height = `${opts.height}px`;
    mountEl.replaceChildren(canvas);

    const adapter = createWebglAdapter({
        canvas,
        candleSource: opts.candleSource,
        devicePixelRatio: dpr,
        ...(opts.initialVisibleBars !== undefined
            ? { initialVisibleBars: opts.initialVisibleBars }
            : {}),
        ...(opts.interval !== undefined ? { interval: opts.interval } : {}),
        ...(opts.onAlert !== undefined ? { onAlert: opts.onAlert } : {}),
    });

    let disposed = false;
    return {
        host: adapter.host,
        run: (signal) => runWebglLoop(adapter, { signal }),
        dispose: () => {
            if (disposed) return;
            disposed = true;
            adapter.dispose();
            mountEl.replaceChildren();
        },
    };
};

export default factory;

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { KonvaNamespace } from "chartlang-example-konva-adapter";

import type { DemoAdapterFactory } from "./types";

/**
 * Konva driver. The adapter takes the Konva namespace injected via
 * `opts.konva` (it never statically imports `konva`, to stay headless), so
 * the driver dynamic-imports `konva` and hands its default namespace in,
 * with `container: mountEl` so the stage attaches its content `<div>`.
 * Both the `container` option and `runKonvaLoop` land in Task 1.
 */
const factory: DemoAdapterFactory = async (mountEl, opts) => {
    const [{ createKonvaAdapter, runKonvaLoop }, konva] = await Promise.all([
        import("chartlang-example-konva-adapter"),
        import("konva"),
    ]);

    mountEl.replaceChildren();
    const adapter = createKonvaAdapter({
        // Real Konva's `StageConfig.container` is `string | HTMLDivElement`
        // while the adapter's structural `KonvaNamespace` declares the wider
        // `HTMLElement`, so the namespaces are not directly assignable —
        // narrow the real namespace to the adapter's seam at this one point.
        konva: konva.default as unknown as KonvaNamespace,
        container: mountEl,
        stage: { width: opts.width, height: opts.height },
        candleSource: opts.candleSource,
        ...(opts.initialVisibleBars !== undefined
            ? { initialVisibleBars: opts.initialVisibleBars }
            : {}),
        ...(opts.interval !== undefined ? { interval: opts.interval } : {}),
    });

    let disposed = false;
    return {
        host: adapter.host,
        run: (signal) => runKonvaLoop(adapter, { signal }),
        dispose: () => {
            if (disposed) return;
            disposed = true;
            adapter.dispose();
            mountEl.replaceChildren();
        },
    };
};

export default factory;

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { AlertEmission, CandleEvent } from "@invinite-org/chartlang-adapter-kit";
import type { ScriptHost } from "@invinite-org/chartlang-host-worker";

/** What the driver needs to stand up one live renderer in `mountEl`. */
export type DriverMountOpts = Readonly<{
    candleSource: AsyncIterable<CandleEvent>;
    interval?: string;
    width: number;
    height: number;
    onAlert?: (alert: AlertEmission) => void;
    /** Default visible window (most-recent bars shown on load); forwarded to
     * each adapter's `initialVisibleBars`. Omit to fit all data. */
    initialVisibleBars?: number;
}>;

/**
 * A live, mounted adapter normalised across the five example libraries.
 * `host.load(...)` feeds the compiled module; `run(signal)` drives the
 * render loop until `signal` aborts; `dispose()` tears down the renderer
 * + worker AND empties the mount element.
 */
export type DemoAdapterDriver = Readonly<{
    host: ScriptHost;
    run: (signal: AbortSignal) => Promise<void>;
    dispose: () => void;
}>;

/** Mounts one adapter into `mountEl`. Async: drivers dynamic-import. */
export type DemoAdapterFactory = (
    mountEl: HTMLElement,
    opts: DriverMountOpts,
) => Promise<DemoAdapterDriver>;

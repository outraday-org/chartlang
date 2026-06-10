// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Adapter } from "./types";

/**
 * Options accepted by {@link defineAdapter}. `dispose` is optional —
 * `defineAdapter` substitutes a no-op when omitted.
 *
 * @since 0.1
 * @stable
 * @example
 *     const opts: DefineAdapterOpts = {
 *         id: "demo",
 *         name: "Demo",
 *         capabilities: {
 *             plots: new Set(),
 *             drawings: new Set(),
 *             alerts: new Set(),
 *             alertConditions: false,
 *             logs: false,
 *             inputs: new Set(),
 *             intervals: [],
 *             multiTimeframe: false,
 *             subPanes: 0,
 *             symInfoFields: new Set(),
 *             maxDrawingsPerScript: {
 *                 lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0,
 *             },
 *             maxLookback: 0,
 *             maxTickHz: 0,
 *         },
 *         candles: () => ({ async *[Symbol.asyncIterator]() {} }),
 *         onEmissions: () => {},
 *     };
 */
export type DefineAdapterOpts = Omit<Adapter, "dispose"> & {
    readonly dispose?: () => void;
};

/**
 * Wrap an adapter description in a stable factory so consumer-repo
 * adapters get a single entry point + a default no-op `dispose`. The
 * returned object aliases the supplied callbacks by reference — no
 * normalisation, no cloning.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { defineAdapter, capabilities, mockCandleSource }
 *         from "@invinite-org/chartlang-adapter-kit";
 *
 *     const adapter = defineAdapter({
 *         id: "demo",
 *         name: "Demo",
 *         capabilities: {
 *             plots: capabilities.allLines(),
 *             drawings: new Set(),
 *             alerts: new Set(),
 *             alertConditions: false,
 *             logs: false,
 *             inputs: new Set(),
 *             intervals: [],
 *             multiTimeframe: false,
 *             subPanes: 0,
 *             symInfoFields: new Set(),
 *             maxDrawingsPerScript: {
 *                 lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0,
 *             },
 *             maxLookback: 5000,
 *             maxTickHz: 10,
 *         },
 *         candles: () => mockCandleSource([]),
 *         onEmissions: () => {},
 *     });
 *     void adapter;
 */
export function defineAdapter(opts: DefineAdapterOpts): Adapter {
    return {
        id: opts.id,
        name: opts.name,
        capabilities: opts.capabilities,
        ...(opts.resolveInputs !== undefined ? { resolveInputs: opts.resolveInputs } : {}),
        ...(opts.symInfo !== undefined ? { symInfo: opts.symInfo } : {}),
        candles: opts.candles,
        onEmissions: opts.onEmissions,
        dispose: opts.dispose ?? noopDispose,
    };
}

function noopDispose(): void {
    // intentional no-op
}

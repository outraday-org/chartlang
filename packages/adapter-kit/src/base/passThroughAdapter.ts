// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Adapter, CandleEvent, Capabilities, RunnerEmissions } from "../types.js";

/**
 * Minimal `Adapter` that forwards a supplied `AsyncIterable<CandleEvent>`
 * and drops every emission. Useful as a runtime test fixture when the
 * caller doesn't need to observe outputs.
 *
 * @since 0.1
 * @stable
 * @example
 *     import {
 *         PassThroughAdapter,
 *         capabilities,
 *         mockCandleSource,
 *     } from "@invinite-org/chartlang-adapter-kit";
 *
 *     const a = new PassThroughAdapter(
 *         "p", "Passthrough",
 *         {
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
 *         mockCandleSource([]),
 *     );
 *     void a;
 */
export class PassThroughAdapter implements Adapter {
    constructor(
        public readonly id: string,
        public readonly name: string,
        public readonly capabilities: Capabilities,
        private readonly source: AsyncIterable<CandleEvent>,
    ) {}

    candles(): AsyncIterable<CandleEvent> {
        return this.source;
    }

    onEmissions(_emissions: RunnerEmissions): void {
        // intentional no-op
    }

    dispose(): void {
        // intentional no-op
    }
}

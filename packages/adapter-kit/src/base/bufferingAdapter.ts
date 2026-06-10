// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Adapter, CandleEvent, Capabilities, RunnerEmissions } from "../types.js";

/**
 * `Adapter` that records every `onEmissions` batch and exposes a
 * `drain()` method to retrieve them all at once. Used by the
 * conformance suite (Task 11) to collect emissions across a full
 * fixture playback before asserting against golden bars.
 *
 * @since 0.1
 * @stable
 * @example
 *     import {
 *         BufferingAdapter,
 *         capabilities,
 *         mockCandleSource,
 *     } from "@invinite-org/chartlang-adapter-kit";
 *
 *     const a = new BufferingAdapter(
 *         "b", "Buffering",
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
 *     a.drain();
 */
export class BufferingAdapter implements Adapter {
    private buffered: RunnerEmissions[] = [];

    constructor(
        public readonly id: string,
        public readonly name: string,
        public readonly capabilities: Capabilities,
        private readonly source: AsyncIterable<CandleEvent>,
    ) {}

    candles(): AsyncIterable<CandleEvent> {
        return this.source;
    }

    onEmissions(emissions: RunnerEmissions): void {
        this.buffered.push(emissions);
    }

    drain(): ReadonlyArray<RunnerEmissions> {
        const out = this.buffered.slice();
        this.buffered = [];
        return out;
    }

    dispose(): void {
        this.buffered = [];
    }
}

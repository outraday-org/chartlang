// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Adapter, CandleEvent } from "@invinite-org/chartlang-adapter-kit";

import { CANVAS2D_CAPABILITIES, CANVAS2D_SYM_INFO } from "./capabilities";

async function* emptyCandleSource(): AsyncIterator<CandleEvent> {
    /* intentionally empty — the conformance harness drives the
     * runner from its own candle source. */
}

/**
 * Headless `Adapter` exposing {@link CANVAS2D_CAPABILITIES} as its
 * `id` / `name` / `capabilities` triple. Task 12's
 * `scripts/run-conformance.ts` wrapper auto-imports this as the
 * default export of `chartlang-example-canvas2d-adapter` and feeds it
 * to `runConformanceSuite`, which reads `capabilities` only — the
 * `candles`, `onEmissions`, `dispose` methods are no-ops so the
 * conformance harness does not spin up a Worker host or a real
 * `<canvas>` renderer for what is fundamentally an emission-contract
 * test.
 *
 * Production callers should use `createCanvas2dAdapter` instead,
 * which wires a real renderer + worker host against a `<canvas>`
 * element.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import defaultAdapter, { DEFAULT_ADAPTER } from "chartlang-example-canvas2d-adapter";
 *     // defaultAdapter === DEFAULT_ADAPTER
 *     // defaultAdapter.capabilities.plots.has("line") === true
 *     void defaultAdapter;
 */
export const DEFAULT_ADAPTER: Adapter = Object.freeze({
    id: "canvas2d-reference-default",
    name: "Canvas 2D Reference Adapter (default)",
    capabilities: CANVAS2D_CAPABILITIES,
    symInfo: CANVAS2D_SYM_INFO,
    resolveInputs(): Readonly<Record<string, unknown>> {
        return {};
    },
    candles(): AsyncIterable<CandleEvent> {
        return {
            [Symbol.asyncIterator](): AsyncIterator<CandleEvent> {
                return emptyCandleSource();
            },
        };
    },
    onEmissions(): void {
        /* intentional no-op — the conformance harness owns the
         * emission buffer. */
    },
    dispose(): void {
        /* intentional no-op — no resources held. */
    },
});

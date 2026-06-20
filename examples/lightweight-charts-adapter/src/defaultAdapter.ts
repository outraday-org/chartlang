// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Adapter, CandleEvent } from "@invinite-org/chartlang-adapter-kit";

import { LWC_CAPABILITIES, LWC_SYM_INFO } from "./capabilities.js";

async function* emptyCandleSource(): AsyncIterator<CandleEvent> {
    /* intentionally empty — the conformance harness drives the
     * runner from its own candle source. */
}

/**
 * Headless `Adapter` exposing {@link LWC_CAPABILITIES} as its
 * `id` / `name` / `capabilities` triple. `scripts/run-conformance.ts`
 * auto-imports this as the package default export and feeds it to
 * `runConformanceSuite`, which reads `capabilities` only — the
 * `candles`, `onEmissions`, `dispose` methods are no-ops so the
 * conformance harness does not stand up a real lightweight-charts chart
 * (which needs a DOM container) for what is fundamentally an
 * emission-contract test.
 *
 * Production callers should use `createLightweightChartsAdapter` instead,
 * which wires a real chart + worker host against a container element.
 *
 * @since 0.1
 * @stable
 * @example
 *     import defaultAdapter, { DEFAULT_ADAPTER } from "chartlang-example-lightweight-charts-adapter";
 *     // defaultAdapter === DEFAULT_ADAPTER
 *     // defaultAdapter.capabilities.plots.has("line") === true
 *     void defaultAdapter;
 */
export const DEFAULT_ADAPTER: Adapter = Object.freeze({
    id: "lightweight-charts-reference-default",
    name: "Lightweight Charts Reference Adapter (default)",
    capabilities: LWC_CAPABILITIES,
    symInfo: LWC_SYM_INFO,
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

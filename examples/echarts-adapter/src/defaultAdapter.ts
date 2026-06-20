// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Adapter, CandleEvent } from "@invinite-org/chartlang-adapter-kit";

import { ECHARTS_CAPABILITIES, ECHARTS_SYM_INFO } from "./capabilities.js";

async function* emptyCandleSource(): AsyncIterator<CandleEvent> {
    /* intentionally empty — the conformance harness drives the
     * runner from its own candle source. */
}

/**
 * Headless `Adapter` exposing {@link ECHARTS_CAPABILITIES} as its
 * `id` / `name` / `capabilities` triple. The conformance runner
 * (`scripts/run-conformance.ts`) auto-imports this as the default export of
 * `chartlang-example-echarts-adapter` and feeds it to `runConformanceSuite`,
 * which reads `capabilities` only — the `candles` / `onEmissions` / `dispose`
 * methods are no-ops so the conformance harness does not spin up an ECharts
 * instance for what is fundamentally an emission-contract test.
 *
 * Production callers should use `createEChartsAdapter` instead, which wires a
 * real ECharts chart + worker host against a DOM container.
 *
 * @since 1.5
 * @experimental
 * @example
 *     import defaultAdapter, { DEFAULT_ADAPTER } from "chartlang-example-echarts-adapter";
 *     // defaultAdapter === DEFAULT_ADAPTER
 *     // defaultAdapter.capabilities.plots.has("line") === true
 *     void defaultAdapter;
 */
export const DEFAULT_ADAPTER: Adapter = Object.freeze({
    id: "echarts-example-default",
    name: "ECharts Example Adapter (default)",
    capabilities: ECHARTS_CAPABILITIES,
    symInfo: ECHARTS_SYM_INFO,
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

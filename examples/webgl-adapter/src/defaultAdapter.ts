// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Adapter, CandleEvent } from "@invinite-org/chartlang-adapter-kit";

import { WEBGL_CAPABILITIES, WEBGL_SYM_INFO } from "./capabilities.js";

async function* emptyCandleSource(): AsyncIterator<CandleEvent> {
    /* intentionally empty — the conformance harness drives the
     * runner from its own candle source. */
}

/**
 * Headless `Adapter` exposing {@link WEBGL_CAPABILITIES} as its
 * `id` / `name` / `capabilities` triple. `scripts/run-conformance.ts`
 * auto-imports this as the default export of
 * `chartlang-example-webgl-adapter` and feeds it to `runConformanceSuite`,
 * which reads `capabilities` only — the `candles`, `onEmissions`, `dispose`
 * methods are no-ops so the conformance harness does not spin up a Worker
 * host or a real WebGL2 context for what is fundamentally an
 * emission-contract test. Its `id` (`"webgl-reference-default"`) is distinct
 * from the registry id (`"webgl"`) and the production factory's adapter id
 * (`"webgl-reference"`).
 *
 * Production callers should use `createWebglAdapter` instead, which wires a
 * real GPU renderer + worker host against a `<canvas>` element (filled in by
 * later tasks).
 *
 * @since 0.1
 * @stable
 * @example
 *     import defaultAdapter, { DEFAULT_ADAPTER } from "chartlang-example-webgl-adapter";
 *     // defaultAdapter === DEFAULT_ADAPTER
 *     // defaultAdapter.capabilities.plots.has("line") === true
 *     void defaultAdapter;
 */
export const DEFAULT_ADAPTER: Adapter = Object.freeze({
    id: "webgl-reference-default",
    name: "WebGL Reference Adapter (default)",
    capabilities: WEBGL_CAPABILITIES,
    symInfo: WEBGL_SYM_INFO,
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

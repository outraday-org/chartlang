// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";
import { MTF_QQQ_FIXTURE_BARS, MTF_SPY_FIXTURE_BARS } from "./multiSymbolFixtures.js";

// Same two-symbol ratio source as MULTI_SYMBOL_RATIO_SCENARIO, but the adapter
// declares multiSymbol: false — both different-symbol reads degrade to all-NaN
// and the runtime pushes the deduped `multi-symbol-not-supported` diagnostic.
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "multi symbol not supported",
    apiVersion: 1,
    compute({ plot, request }) {
        const spy = request.security({ symbol: "AMEX:SPY", interval: "1D" });
        const qqq = request.security({ symbol: "NASDAQ:QQQ", interval: "1D" });
        plot(spy.close.current / qqq.close.current);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "diagnostic-code-present", code: "multi-symbol-not-supported" },
    // 10 all-NaN points → byte-identical to `mtfCapabilityFalse`'s all-NaN
    // hash (both serialise the same `{ bar, value: null }` tuples). The shared
    // value confirms the NaN fallback; do not assume it diverged on a re-pin.
    {
        kind: "plot-hash",
        sha256: "18fb0cce9a095b255be7570ddec6bd84fb089d34c8e92a1b23b14352d1ebb148",
    },
]);

/**
 * Multi-symbol `request.security` scenario for the `multiSymbol: false`
 * fallback. `multiTimeframe` stays `true`, so the symbol gate (which precedes
 * the timeframe gate) is what fires: both different-symbol reads return all-NaN
 * (the ratio is NaN every bar) and the runtime emits the deduped
 * `multi-symbol-not-supported` diagnostic. Mirrors `mtfCapabilityFalse` for the
 * symbol dimension.
 *
 * @since 1.3
 * @stable
 * @example
 *     import { MULTI_SYMBOL_NOT_SUPPORTED_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void MULTI_SYMBOL_NOT_SUPPORTED_SCENARIO;
 */
export const MULTI_SYMBOL_NOT_SUPPORTED_SCENARIO: Scenario = Object.freeze({
    id: "multi-symbol-not-supported",
    title: "Multi-symbol capability false",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 10,
    capabilitiesOverride: Object.freeze({
        multiTimeframe: true,
        multiSymbol: false,
    }),
    secondaryFeeds: Object.freeze([
        Object.freeze({ symbol: "AMEX:SPY", interval: "1D", bars: MTF_SPY_FIXTURE_BARS }),
        Object.freeze({ symbol: "NASDAQ:QQQ", interval: "1D", bars: MTF_QQQ_FIXTURE_BARS }),
    ]),
    assertions: ASSERTIONS,
});

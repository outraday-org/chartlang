// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";
import { MTF_QQQ_FIXTURE_BARS, MTF_SPY_FIXTURE_BARS } from "./multiSymbolFixtures.js";

// Two DIFFERENT symbols at the same interval: the composite (symbol, interval)
// feed key (`feedKey`) is the only thing that keeps the two secondary streams
// apart, so the plotted ratio (~2) could not arise unless SPY and QQQ resolved
// to distinct streams — the end-to-end proof of the multi-symbol key.
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "multi symbol ratio",
    apiVersion: 1,
    compute({ plot, request }) {
        const spy = request.security({ symbol: "AMEX:SPY", interval: "1D" });
        const qqq = request.security({ symbol: "NASDAQ:QQQ", interval: "1D" });
        plot(spy.close.current / qqq.close.current);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        sha256: "f3c29388232c4f856a79426803dd877aef59739ac9c4cf6e10d378e8c4134b13",
    },
    { kind: "diagnostic-code-absent", code: "multi-symbol-not-supported" },
    { kind: "diagnostic-code-absent", code: "multi-timeframe-not-supported" },
    { kind: "diagnostic-code-absent", code: "unknown-secondary-stream" },
]);

/**
 * Two-symbol `request.security` ratio scenario: SPY priced in QQQ. The pinned
 * plot-hash carries the finite SPY/QQQ close ratio (~2), a value that could
 * only arise if the composite `feedKey(symbol, interval)` routed the two daily
 * fixtures (`AMEX:SPY@1D`, `NASDAQ:QQQ@1D`) to distinct secondary streams. The
 * ratio band (~2) is unreachable by the main golden stream (~100) and by a
 * single-symbol HTF read, so the hash doubles as the conformance-side
 * distinctness proof; the companion guard
 * (`multiSymbolRatio.test.ts`) asserts the ratio is finite and ≠ 1.
 *
 * @since 1.3
 * @stable
 * @example
 *     import { MULTI_SYMBOL_RATIO_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void MULTI_SYMBOL_RATIO_SCENARIO;
 */
export const MULTI_SYMBOL_RATIO_SCENARIO: Scenario = Object.freeze({
    id: "multi-symbol-ratio",
    title: "Multi-symbol request.security ratio",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 10,
    capabilitiesOverride: Object.freeze({
        multiTimeframe: true,
        multiSymbol: true,
    }),
    secondaryFeeds: Object.freeze([
        Object.freeze({ symbol: "AMEX:SPY", interval: "1D", bars: MTF_SPY_FIXTURE_BARS }),
        Object.freeze({ symbol: "NASDAQ:QQQ", interval: "1D", bars: MTF_QQQ_FIXTURE_BARS }),
    ]),
    assertions: ASSERTIONS,
});

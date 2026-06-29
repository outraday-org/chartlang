// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.dmi(14)",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot }) {
        const d = ta.dmi(14);
        plot(d.plusDi);
        plot(d.minusDi);
    },
});
`;

// Value-pins the REAL-path `+DI` / `−DI` series over the bundled golden bars.
// DMI reads `bar.high`/`bar.low`/`bar.close` (number-coercible series-view
// proxies) directly; the proxy-coercion fix makes the directional helpers see
// real numbers instead of an always-NaN proxy. Re-pin via the runner's
// "expected vs actual" message if the golden bars change.
const PLUS_DI_HASH = "0b2805c434d12a02fb39c95186c571e4754bab70b104567811668b0fc79aef31";
const MINUS_DI_HASH = "66ee04cac59f7bc261099243112ef305d6507129164d950e44a01f939c4a973d";

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "plot-hash", slotId: "<inline:ta-dmi>.chart.ts:8:9#0", sha256: PLUS_DI_HASH },
    { kind: "plot-hash", slotId: "<inline:ta-dmi>.chart.ts:9:9#0", sha256: MINUS_DI_HASH },
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.dmi` conformance scenario. Plots Wilder's `+DI` / `−DI` pair
 * over the bundled 10 000-bar `goldenBars.json` fixture.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_DMI_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_DMI_SCENARIO;
 */
export const TA_DMI_SCENARIO: Scenario = Object.freeze({
    id: "ta-dmi",
    title: "ta.dmi(14)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});

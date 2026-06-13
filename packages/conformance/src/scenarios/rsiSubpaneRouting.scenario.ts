// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "rsi-subpane-routing",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot, hline }) {
        const rsi = ta.rsi(bar.close, 14);
        plot(rsi, { title: "RSI(14)" });
        hline(70, { title: "Overbought" });
        hline(30, { title: "Oversold" });
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "all-plots-on-pane", pane: "script:rsi-subpane-routing" },
    { kind: "diagnostic-code-absent", code: "unsupported-pane" },
]);

/**
 * RSI(14) on a script-level subpane. Pins the `subpane-rendering`
 * contract: `defineIndicator({ overlay: false })` routes every plot +
 * hline to `script:<sanitised-name>`, and adapters with `subPanes >= 1`
 * (the canvas2d reference declares unlimited) do not push
 * `unsupported-pane`.
 *
 * @since 0.9
 * @stable
 * @example
 *     import { RSI_SUBPANE_ROUTING_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void RSI_SUBPANE_ROUTING_SCENARIO;
 */
export const RSI_SUBPANE_ROUTING_SCENARIO: Scenario = Object.freeze({
    id: "rsi-subpane-routing",
    title: "RSI(14) routed to script-level subpane",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    // RSI(14) warms up in 14 bars; 50 gives enough emitted points for the
    // `all-plots-on-pane` assertion to bite (an empty `run.plots` is now a
    // failure, not a vacuous pass — see `evalAssertion`) without churning
    // the full 10 000-bar golden fixture per CI run.
    candleLimit: 50,
    assertions: ASSERTIONS,
});

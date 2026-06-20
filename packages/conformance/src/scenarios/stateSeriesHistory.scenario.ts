// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

/**
 * Inline source: a user `state.series` that republishes `bar.close` every
 * bar (`s.value = bar.close.current`), then plots its live head (`s[0]`),
 * its two-bar-old committed history (`s[2]`), and `bar.close[2]` directly.
 * The point is the byte-for-byte equality of `s[2]` and `bar.close[2]` — the
 * user series' history is bar-for-bar identical to a direct `bar.close[N]`
 * read, warmup `NaN`s included. All three plots are on overlay.
 */
const SOURCE = `import { defineIndicator, plot, state } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "User series lag",
    apiVersion: 1,
    overlay: true,
    compute({ bar, state, plot }) {
        const s = state.series(0);
        s.value = bar.close.current;
        plot(s[0], { title: "s[0]" });
        plot(s[2], { title: "s[2]" });
        plot(bar.close[2], { title: "close[2]" });
    },
});
`;

// `s[0]` is the live head republishing `bar.close.current`, so it tracks an
// unshifted `bar.close[0]` — finite from bar 0, its own SHA-256.
const LIVE_HASH = "76a745e34ca1752a77abb91cbf5e7d852700171923337b5acb9263f172e49bc5";
// `s[2]` (two committed bars back) and `bar.close[2]` MUST be byte-identical:
// the user series' history is the same lagged close, `NaN` for bars 0–1 and
// equal thereafter. They share ONE pinned constant on purpose — if a future
// run splits them, the series advance/commit discipline (Task 3) regressed;
// fail loudly rather than re-pin around a real divergence. Re-pin via the
// runner's "expected vs actual" message if the golden bars change.
const HISTORY_LAG_HASH = "412dd16c4d6dd7ea3ab278daf516833dda40c6201cd6dd3da2fe278050ffc208";

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        slotId: "<inline:state-series-history>.chart.ts:10:9#0",
        sha256: LIVE_HASH,
    },
    {
        kind: "plot-hash",
        slotId: "<inline:state-series-history>.chart.ts:11:9#0",
        sha256: HISTORY_LAG_HASH,
    },
    {
        kind: "plot-hash",
        slotId: "<inline:state-series-history>.chart.ts:12:9#0",
        sha256: HISTORY_LAG_HASH,
    },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
]);

/**
 * `state.series` history scenario. Proves a writable, indexable user series
 * (`s.value = bar.close.current` each bar) carries history that is
 * byte-identical to indexing `bar.close` directly: `s[2]` and `bar.close[2]`
 * pin to the same SHA-256 (warmup `NaN`s included), while `s[0]` tracks the
 * unshifted close. The shared `HISTORY_LAG_HASH` constant locks the
 * advance/commit discipline of the runtime `state.series` slot.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { STATE_SERIES_HISTORY_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     // STATE_SERIES_HISTORY_SCENARIO.id === "state-series-history"
 *     void STATE_SERIES_HISTORY_SCENARIO;
 */
export const STATE_SERIES_HISTORY_SCENARIO: Scenario = Object.freeze({
    id: "state-series-history",
    title: "state.series history is byte-identical to bar.close[N]",
    inlineSource: SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});

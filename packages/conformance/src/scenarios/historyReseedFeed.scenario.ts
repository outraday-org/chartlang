// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, input, type Series } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "History reseed feed",
    apiVersion: 1,
    overlay: true,
    inputs: {
        other: input.externalSeries<number>({
            name: "other",
            schema: { kind: "external-series-schema" },
        }),
    },
    compute({ inputs, plot }) {
        const other = inputs.other as Series<number>;
        plot(other.current, { title: "Other current" });
    },
});
`;

// sha256 over the JSON-stringified `{ bar, value }` tuples of the replayed
// three-bar range: [{bar:0,value:100},{bar:1,value:200},{bar:2,value:300}].
// The re-seed replays from bar 0 with the swapped feed map AND drops the
// undrained first-seed (NaN) emissions, so the drained stream is exactly
// these three finite tuples — never six, and never the appended 3..5 range.
const RESEED_HASH = "7860f814d1ddcfdd818403e7c4e65cd256c045a73f3bca6e226044eb47757ac9";

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        sha256: RESEED_HASH,
    },
]);

/**
 * History re-seed conformance scenario. It seeds a three-bar `history` block
 * with NO mount feeds (so `input.externalSeries` reads warmup `NaN`), swaps
 * the whole feed map in via `setExternalSeries`, then re-pushes the SAME
 * `history` block. The runtime treats the second push into the now non-fresh
 * runner (its bars overlap the processed range) as a full re-seed: it replays
 * from bar 0 with the live feed map and drops the undrained first-seed
 * emissions. The single pinned `plot-hash`
 * proves the replayed range lands at bars `0..2` with the swapped values —
 * not appended at `3..5`, and not doubled with the dropped NaN prefix.
 *
 * @since 1.10
 * @stable
 * @example
 *     import { HISTORY_RESEED_FEED_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void HISTORY_RESEED_FEED_SCENARIO;
 */
export const HISTORY_RESEED_FEED_SCENARIO: Scenario = Object.freeze({
    id: "history-reseed-feed",
    title: "History re-seed replays external-series feeds from bar 0",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    historyReseed: Object.freeze({
        bars: 3,
        reseedFeeds: Object.freeze({
            other: Object.freeze({ values: Object.freeze([100, 200, 300]) }),
        }),
    }),
    assertions: ASSERTIONS,
});

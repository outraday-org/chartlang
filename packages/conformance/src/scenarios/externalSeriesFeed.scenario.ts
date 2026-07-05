// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, input, type Series } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "External series feed",
    apiVersion: 1,
    overlay: true,
    inputs: {
        other: input.externalSeries<number>({
            name: "other",
            schema: { kind: "external-series-schema" },
        }),
    },
    compute({ inputs, plot, ta }) {
        const other = inputs.other as Series<number>;
        plot(other.current, { title: "Other current" });
        plot(other[1], { title: "Other previous" });
        plot(ta.sma(other, 2), { title: "Other SMA(2)" });
    },
});
`;

const CURRENT_HASH = "193c71b3e93ee89f3670f1ba5d3c9bbd3208baa2bc06a8c98063ad4d80a4c66c";
const PREVIOUS_HASH = "921e8e33ae01e3402ddbd63fbd06a06a690836f7586006d20bb14fdae00b96a9";
const SMA_HASH = "d30733da6beba51356e0b418bc2b5621c67ea2e7a911c6d4c50667aec88d85ab";

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        slotId: "<inline:external-series-feed>.chart.ts:15:9#0",
        sha256: CURRENT_HASH,
    },
    {
        kind: "plot-hash",
        slotId: "<inline:external-series-feed>.chart.ts:16:9#0",
        sha256: PREVIOUS_HASH,
    },
    {
        kind: "plot-hash",
        slotId: "<inline:external-series-feed>.chart.ts:17:9#0",
        sha256: SMA_HASH,
    },
]);

/**
 * Runtime-only external-series conformance scenario. It mounts an
 * `input.externalSeries` feed, reads `.current` and `[1]` history, then
 * replaces the complete feed map after bar 2. The bar 3+ current/SMA hashes
 * prove the live `setExternalSeries` replacement takes effect without
 * remounting; the previous-value hash proves committed history remains
 * indexable across the replacement boundary.
 *
 * @since 1.9
 * @stable
 * @example
 *     import { EXTERNAL_SERIES_FEED_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void EXTERNAL_SERIES_FEED_SCENARIO;
 */
export const EXTERNAL_SERIES_FEED_SCENARIO: Scenario = Object.freeze({
    id: "external-series-feed",
    title: "External series feed history and live replacement",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 6,
    externalSeriesFeeds: Object.freeze({
        other: Object.freeze({ values: Object.freeze([10, 20, 30, 40, 50, 60]) }),
    }),
    externalSeriesEvents: Object.freeze([
        Object.freeze({
            atBar: 2,
            feeds: Object.freeze({
                other: Object.freeze({ values: Object.freeze([100, 200, 300, 400, 500, 600]) }),
            }),
        }),
    ]),
    assertions: ASSERTIONS,
});

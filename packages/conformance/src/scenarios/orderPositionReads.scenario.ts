// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";
import { ORDER_MARKER_PLOTS } from "./orderFixtures.js";

// Golden bars are daily candles spaced `86_400_000` ms from
// `1_700_000_000_000`, so an exact `bar.time` equality is a deterministic bar
// ordinal — the `drawLine.scenario.ts` idiom. Bars 0 / 2 / 4.
const INLINE_SOURCE = `import { defineIndicator, order, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "order.position reads",
    apiVersion: 1,
    overlay: true,
    compute({ bar, plot, order }) {
        plot(order.position().size, { title: "Position" });
        if (bar.time === 1_700_000_000_000) order.buy({ qty: 2, label: "Long", marker: false });
        if (bar.time === 1_700_172_800_000) order.sell({ qty: 3, marker: false });
        if (bar.time === 1_700_345_600_000) order.close({ marker: false });
    },
});
`;

const POSITION_SLOT_ID = "<inline:order-position-reads>.chart.ts:7:9#0";

// The plotted `order.position().size` series over the six bars:
// `[0, 2, 2, -1, -1, 0]`. Every number in it is a contract:
//   bar 0 → 0   the buy has not folded yet (RFC 0002 §7's one-fold lag)
//   bar 1 → 2   the bar-0 buy folded at bar 0's close
//   bar 2 → 2   the sell has not folded yet
//   bar 3 → -1  `sell 3` crossed zero from +2 and REVERSED to -1
//   bar 4 → -1  the close has not folded yet
//   bar 5 → 0   `close` flattened
const POSITION_SERIES_SHA256 = "80272792ab8c0242c08be197d65ebc20fe5013602f1e0e3d74799ee996726755";

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "plot-hash", slotId: POSITION_SLOT_ID, sha256: POSITION_SERIES_SHA256 },
    // The SAME hash with no `slotId` — i.e. over EVERY plot the run emitted — is
    // the `marker: false` proof: had any of the three orders drawn its arrow or
    // label, the all-plots tuple list would carry extra entries and diverge.
    // Deliberately the same constant referenced twice, like the two `plot-hash`
    // entries in `state-series-history`; if a future run splits them, the marker
    // opt-out regressed — fix the runtime, do NOT re-pin them apart.
    { kind: "plot-hash", sha256: POSITION_SERIES_SHA256 },
    {
        kind: "order-at-bar",
        expected: [
            { action: "buy", bar: 0, label: "Long" },
            // No `label` — asserts `OrderEmission.label === ""`, the wire default.
            { action: "sell", bar: 2 },
            { action: "close", bar: 4 },
        ],
    },
    { kind: "order-count", count: 3 },
    { kind: "diagnostic-code-absent", code: "unsupported-orders" },
]);

/**
 * `order.position()` semantics — the one-fold read lag, a reversal through zero,
 * and the per-call `marker: false` opt-out, over a six-bar slice with the three
 * orders keyed to exact golden-bar times.
 *
 * The script plots its own position, so ONE `plot-hash` pins the lag and the
 * fold arithmetic together; asserting that same hash a second time unscoped is
 * what proves no marker plot was emitted, against a capability bag that declares
 * both marker kinds.
 *
 * @since 1.11
 * @stable
 * @example
 *     import { ORDER_POSITION_READS_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void ORDER_POSITION_READS_SCENARIO;
 */
export const ORDER_POSITION_READS_SCENARIO: Scenario = Object.freeze({
    id: "order-position-reads",
    title: "order.position() lag, reversal and marker: false",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 6,
    capabilitiesOverride: { orders: true, plots: ORDER_MARKER_PLOTS },
    assertions: ASSERTIONS,
});

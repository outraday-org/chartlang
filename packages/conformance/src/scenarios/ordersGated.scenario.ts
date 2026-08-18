// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { ORDER_MARKER_SLOT_SUFFIX } from "@invinite-org/chartlang-runtime";

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";
import {
    EMPTY_PLOT_SERIES_SHA256,
    ORDER_MARKER_PLOTS,
    orderEmaCrossSource,
} from "./orderFixtures.js";

const INLINE_SOURCE = orderEmaCrossSource();

const BUY_SLOT_ID = "<inline:orders-gated>.chart.ts:13:32#0";

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "diagnostic-code-present", code: "unsupported-orders" },
    { kind: "order-count", count: 0 },
    // Marker suppression, proved against a bag that DOES declare `arrow` +
    // `label` (`ORDER_MARKER_PLOTS`): the slot is empty because the order was
    // declined, not because the glyph was undrawable. The emitting sibling pins
    // the same slot at `7e061e47…`.
    {
        kind: "plot-hash",
        slotId: `${BUY_SLOT_ID}${ORDER_MARKER_SLOT_SUFFIX}`,
        sha256: EMPTY_PLOT_SERIES_SHA256,
    },
]);

/**
 * `orders: false` capability fallback — the same EMA-cross source as
 * {@link ORDER_EMA_CROSS_SCENARIO} against a bag that declines the channel. The
 * runtime drops every call, pushes `unsupported-orders` once per slot per mount,
 * and emits no auto-markers; `order.position()` keeps reading flat (it asks for
 * no capability), so the script's entry branch retries on every crossover and the
 * once-per-slot dedup is what keeps the diagnostic channel from flooding.
 *
 * `candleLimit: 200` is load-bearing: the first order attempt is at bar **162**
 * (EMA(26) warmup plus the first crossing), so a shorter slice would assert the
 * diagnostic's presence over a stream that never tried to trade.
 *
 * @since 1.11
 * @stable
 * @example
 *     import { ORDERS_GATED_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void ORDERS_GATED_SCENARIO;
 */
export const ORDERS_GATED_SCENARIO: Scenario = Object.freeze({
    id: "orders-gated",
    title: "order.* declined by an orders: false adapter",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 200,
    capabilitiesOverride: { orders: false, plots: ORDER_MARKER_PLOTS },
    assertions: ASSERTIONS,
});

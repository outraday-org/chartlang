// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { ORDER_MARKER_SLOT_SUFFIX } from "@invinite-org/chartlang-runtime";

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";
import { ORDER_MARKER_PLOTS, orderEmaCrossSource } from "./orderFixtures.js";

const INLINE_SOURCE = orderEmaCrossSource();

// The two `order.*` callsites' compiler-issued slot ids. The synthetic marker
// slots are composed with the runtime's own exported suffix rather than a second
// spelling of `"#marker"`.
const BUY_SLOT_ID = "<inline:order-ema-cross>.chart.ts:13:32#0";
const CLOSE_SLOT_ID = "<inline:order-ema-cross>.chart.ts:14:35#0";

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    // 76 entries + 76 exits over the 10 000 golden bars. The paired count is a
    // consequence of the script's own gate (it never buys while long, never
    // closes while flat), not a coincidence of the fixture.
    { kind: "order-count", count: 152 },
    // Spot check of the first round trip. The 162-bar delay to the first entry
    // is the EMA(26) warmup plus the first real crossing.
    {
        kind: "order-at-bar",
        expected: [
            { action: "buy", bar: 162, label: "Long" },
            { action: "close", bar: 264, label: "Exit" },
        ],
    },
    // The auto-render proof. A buy's arrow anchors at `bar.low`, a close's at
    // `bar.high`, and `plot-hash` covers `{ bar, value }` — so these two hashes
    // differing IS the up/down anchor contract. Colour + direction ride `style`
    // and are outside the tuple; the canvas2d render tests own those.
    {
        kind: "plot-hash",
        slotId: `${BUY_SLOT_ID}${ORDER_MARKER_SLOT_SUFFIX}`,
        sha256: "7e061e47b76099b8c0abf9f694a4b8ea1f3ae0fefaabb5aa12eb6958cf15ac18",
    },
    {
        kind: "plot-hash",
        slotId: `${CLOSE_SLOT_ID}${ORDER_MARKER_SLOT_SUFFIX}`,
        sha256: "2020a4c434d239fc1dbaa77b56997bdcac5fc1644585f28e15a1eeb8e26a12b8",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-orders" },
]);

/**
 * `order.*` happy path — the RFC 0002 §5 EMA-cross strategy over the bundled
 * 10 000-bar golden fixture. Pins the append-only `orders` channel (count +
 * the first round trip) and the auto-rendered entry / exit marker series.
 *
 * `capabilitiesOverride` forces `orders: true` and the marker plot kinds rather
 * than inheriting them, so the scenario is byte-stable on every adapter AND
 * unaffected when Task 8 flips the six example bags from `orders: false`.
 *
 * @since 1.11
 * @stable
 * @example
 *     import { ORDER_EMA_CROSS_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void ORDER_EMA_CROSS_SCENARIO;
 */
export const ORDER_EMA_CROSS_SCENARIO: Scenario = Object.freeze({
    id: "order-ema-cross",
    title: "order.* EMA cross entries and exits",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    capabilitiesOverride: { orders: true, plots: ORDER_MARKER_PLOTS },
    assertions: ASSERTIONS,
});

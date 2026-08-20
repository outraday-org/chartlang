// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { convert } from "@invinite-org/chartlang-pine-converter";

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";
import { ORDER_MARKER_PLOTS } from "./orderFixtures.js";

// The Invinite order-backtest QA reproduction, verbatim: an ordinary Pine v5
// EMA-crossover strategy with no position gate. `ta.crossover`/`ta.crossunder`
// are `Series<boolean>` in chartlang, so before the converter's scalar-condition
// rule this emitted `if (ta.crossover(fast, slow))` — testing the Series OBJECT,
// which is truthy on EVERY bar. That shape orders twice per bar (20 000 orders
// over the 10 000 golden bars); the pinned counts below are what an
// EVENT-DRIVEN predicate produces, so this scenario cannot pass by accident.
const PINE_SOURCE = `//@version=5
strategy("EMA Crossover", overlay=true)
fast = ta.ema(close, 12)
slow = ta.ema(close, 26)
if ta.crossover(fast, slow)
    strategy.entry("Long", strategy.long, qty=2)
if ta.crossunder(fast, slow)
    strategy.close("Long")
`;

const CONVERTED = convert(PINE_SOURCE, { barInterval: 60_000, barIndexOrigin: 1_700_000_000_000 });
/* v8 ignore next 3 — module-load guard: the inline fixture always converts. */
if (CONVERTED.output === null) {
    throw new Error("Pine converter produced no output for the crossover order round-trip fixture");
}
const INLINE_SOURCE = CONVERTED.output;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    // MEASURED on this branch: 153 with the scalar-condition rule, 20 000
    // without it (2 per bar × 10 000 golden bars) — the defect and the fix are
    // two orders of magnitude apart, so this number IS the regression.
    { kind: "order-count", count: 153 },
    // The first round trip. Entry at 162 / exit at 264 are bar-for-bar the same
    // events the HAND-WRITTEN `order-ema-cross` scenario pins over the same
    // golden bars, which is the cross-check that the converted program is the
    // same strategy rather than merely a quieter one. The lone `close` at 111
    // is real Pine: this fixture has no position gate, so its first crossunder
    // closes while flat (that one extra order is the 153-vs-152 difference).
    {
        kind: "order-at-bar",
        expected: [
            { action: "close", bar: 111, label: "Long" },
            { action: "buy", bar: 162, label: "Long" },
            { action: "close", bar: 264, label: "Long" },
        ],
    },
    { kind: "diagnostic-code-absent", code: "unsupported-orders" },
]);

/**
 * Pine → chartlang round-trip of the EMA-crossover STRATEGY: converts the
 * reproduction, compiles it, runs it through the runtime, and pins the `orders`
 * channel. The count is the regression that a series-rooted predicate cannot
 * satisfy — it would order on every bar.
 *
 * @since 1.12
 * @stable
 * @example
 *     import { PINE_CONVERTER_ROUND_TRIP_ORDER_CROSSOVER_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void PINE_CONVERTER_ROUND_TRIP_ORDER_CROSSOVER_SCENARIO;
 */
export const PINE_CONVERTER_ROUND_TRIP_ORDER_CROSSOVER_SCENARIO: Scenario = Object.freeze({
    id: "pine-converter-round-trip-order-crossover",
    title: "Pine converter round-trip crossover orders are event-driven",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    capabilitiesOverride: { orders: true, plots: ORDER_MARKER_PLOTS },
    assertions: ASSERTIONS,
});

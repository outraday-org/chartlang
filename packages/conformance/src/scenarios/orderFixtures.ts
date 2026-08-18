// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { PlotKind } from "@invinite-org/chartlang-adapter-kit";

/**
 * Plot kinds every `order.*` scenario FORCES via `capabilitiesOverride`.
 *
 * The auto-rendered markers are ordinary `arrow` / `label` plot emissions and
 * `emitOrderMarkers` pre-gates on both kinds **silently** (RFC 0002 §5) — so a
 * capability bag missing either one produces a marker `plot-hash` of `[]` with
 * no diagnostic to explain it. All six conformance adapters do declare both, but
 * the package's own `runConformanceSuite.test.ts` bag declares
 * `line + horizontal-line` only, so an inheriting scenario would hash `[]`
 * there and quietly pass its "no markers" sibling for the wrong reason. Forcing
 * the set is the same lever `plot-kind-candle` / `plot-kind-ohlc-bar` use to
 * force a kind PRESENT, and it makes `marker: false` provable against a bag that
 * *could* have drawn the glyph.
 *
 * @since 1.11
 * @stable
 * @example
 *     import { ORDER_MARKER_PLOTS } from "./orderFixtures";
 *     // ORDER_MARKER_PLOTS.has("arrow") === true
 *     void ORDER_MARKER_PLOTS;
 */
export const ORDER_MARKER_PLOTS: ReadonlySet<PlotKind> = new Set<PlotKind>([
    "line",
    "arrow",
    "label",
]);

/**
 * `sha256(JSON.stringify([]))` — the `plot-hash` of a slot that emitted
 * **nothing**. `hashPlotSeries` filters by `slotId` before hashing, so pinning
 * this against a synthetic `#marker` slot asserts that no marker plot for that
 * order callsite ever reached the wire.
 *
 * @since 1.11
 * @stable
 * @example
 *     import { EMPTY_PLOT_SERIES_SHA256 } from "./orderFixtures";
 *     void EMPTY_PLOT_SERIES_SHA256;
 */
export const EMPTY_PLOT_SERIES_SHA256 =
    "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945";

/**
 * The `order.*` EMA-cross source shared by the emitting and the
 * capability-gated scenario, so the two differ ONLY by their capability bag.
 *
 * Both `ta.crossover` / `ta.crossunder` and the `order.position()` read are
 * hoisted out of the `if`s: a stateful `ta.*` callsite evaluated conditionally
 * would desync its own history, and hoisting the position read makes the
 * one-fold lag (RFC 0002 §7) the only thing the branches depend on.
 *
 * @since 1.11
 * @stable
 * @example
 *     const src = orderEmaCrossSource();
 *     void src;
 */
export function orderEmaCrossSource(): string {
    return `import { defineIndicator, order, plot, ta } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "Order EMA cross",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot, order }) {
        const fast = ta.ema(bar.close, 12);
        const slow = ta.ema(bar.close, 26);
        const up = ta.crossover(fast, slow).current;
        const down = ta.crossunder(fast, slow).current;
        const flatOrShort = order.position().size <= 0;
        plot(fast, { title: "EMA 12" });
        if (flatOrShort && up) order.buy({ label: "Long" });
        if (!flatOrShort && down) order.close({ label: "Exit" });
    },
});
`;
}

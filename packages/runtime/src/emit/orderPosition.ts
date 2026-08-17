// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { OrderEmission } from "@invinite-org/chartlang-adapter-kit";
import type { OrderPosition } from "@invinite-org/chartlang-core";

import { finiteOrNull } from "../bufferSnapshot.js";
import { FLAT_ORDER_POSITION, type RuntimeContext } from "../runtimeContext.js";
import { emitPlot, resolveValue } from "./plot.js";

/** Buy-side marker colour — the same literal `plotcandle`'s bull default uses. */
const MARKER_BUY_COLOR = "#26a69a";
/** Sell / close-side marker colour — `plotcandle`'s bear default. */
const MARKER_SELL_COLOR = "#ef5350";
/** Arrow glyph size for an auto-rendered order marker. */
const MARKER_ARROW_SIZE = 12;
/** Shared slot title for both auto-rendered marker plots. */
const MARKER_TITLE = "Order";

/**
 * Slot-id suffix of the auto-rendered arrow plot. Appended to the *whole*
 * compiler-issued slot id, which already ends in `:<line>:<col>#<n>` — so the
 * synthetic namespace cannot collide with a compiler-issued id (`#` is followed
 * by digits there, never by a letter).
 *
 * @since 1.11
 * @example
 *     // `${slotId}${ORDER_MARKER_SLOT_SUFFIX}` === "s.chart.ts:3:5#0#marker"
 */
export const ORDER_MARKER_SLOT_SUFFIX = "#marker";

/**
 * Slot-id suffix of the auto-rendered label plot. Separate from the arrow slot
 * because the `arrow` `PlotStyle` arm carries no text field — that is a property
 * of the existing style union, not a new design.
 *
 * @since 1.11
 * @example
 *     // `${slotId}${ORDER_LABEL_SLOT_SUFFIX}` === "s.chart.ts:3:5#0#label"
 */
export const ORDER_LABEL_SLOT_SUFFIX = "#label";

function freezePosition(
    size: number,
    avgPrice: number | null,
    entryBar: number | null,
): OrderPosition {
    return Object.freeze({ size, avgPrice, entryBar });
}

/**
 * Fold one accepted order into the nominal position (RFC 0002 §7).
 *
 * Nominal fill price is the folding step's `bar.close`; an absent `qty` is one
 * unit. `close` targets flat and deliberately ignores a partial-close `qty` —
 * v1's tracker has no partials, though the emission still carries `qty` for a
 * consumer that simulates them. Prices are stored through `finiteOrNull` so a
 * warmup bar whose close is `NaN` yields `avgPrice: null` rather than a
 * non-finite number, which would make the whole state snapshot fail its
 * JSON-cleanliness validation.
 *
 * @since 1.11
 * @example
 *     // Internal — `foldConfirmedOrders` threads the position through this.
 *     // const fn: typeof applyOrderToPosition = applyOrderToPosition;
 *     // void fn;
 */
export function applyOrderToPosition(
    prev: OrderPosition,
    emission: OrderEmission,
    bar: number,
    price: number,
): OrderPosition {
    if (emission.action === "close") return FLAT_ORDER_POSITION;

    const qty = emission.qty ?? 1;
    const size = prev.size + (emission.action === "buy" ? qty : -qty);
    // A fold that lands exactly on zero is flat: "crosses from <= 0 to > 0"
    // excludes zero on both sides, so neither the entry nor the reverse arm owns
    // it, and a position of zero size has no entry bar or average price.
    if (size === 0) return FLAT_ORDER_POSITION;

    // A fresh entry, or a reversal that crossed through zero: both restart the
    // position at THIS bar and this bar's close.
    if (prev.size === 0 || Math.sign(prev.size) !== Math.sign(size)) {
        return freezePosition(size, finiteOrNull(price), bar);
    }

    const prevUnits = Math.abs(prev.size);
    const addedUnits = Math.abs(size) - prevUnits;
    // Same side but not larger — a partial reduce. Only added units move a
    // volume-weighted average, and the position never re-opened, so both
    // `avgPrice` and `entryBar` ride through unchanged. An unknown previous
    // average (a fold priced off a non-finite close) stays unknown.
    if (addedUnits <= 0 || prev.avgPrice === null) {
        return freezePosition(size, prev.avgPrice, prev.entryBar);
    }

    const weighted = (prev.avgPrice * prevUnits + price * addedUnits) / Math.abs(size);
    return freezePosition(size, finiteOrNull(weighted), prev.entryBar);
}

function emitOrderMarkers(ctx: RuntimeContext, emission: OrderEmission): void {
    const isBuy = emission.action === "buy";
    const color = isBuy ? MARKER_BUY_COLOR : MARKER_SELL_COLOR;
    // Buys hang below the bar, sells / closes above it, so an entry and its exit
    // never overlap on the same candle.
    const value = resolveValue(Number(isBuy ? ctx.stream.bar.low : ctx.stream.bar.high));

    // Silently pre-gated, with no diagnostic: the `orders` channel is the source
    // of truth and markers are a courtesy, so an adapter that cannot draw an
    // arrow has not failed to honour a promise it made (RFC 0002 §5). The gate
    // lives HERE rather than inside `emitPlot`, whose own capability branch
    // pushes `unsupported-plot-kind`.
    if (ctx.capabilities.plots.has("arrow")) {
        emitPlot(
            ctx,
            `${emission.slotId}${ORDER_MARKER_SLOT_SUFFIX}`,
            { kind: "arrow", direction: isBuy ? "up" : "down", size: MARKER_ARROW_SIZE },
            {
                title: MARKER_TITLE,
                value,
                color,
                paneOpt: "overlay",
                visible: undefined,
                xShift: 0,
                z: 0,
                colorValue: undefined,
            },
        );
    }

    if (emission.label !== "" && ctx.capabilities.plots.has("label")) {
        emitPlot(
            ctx,
            `${emission.slotId}${ORDER_LABEL_SLOT_SUFFIX}`,
            { kind: "label", text: emission.label, position: isBuy ? "below" : "above" },
            {
                title: MARKER_TITLE,
                value,
                color,
                paneOpt: "overlay",
                visible: undefined,
                xShift: 0,
                z: 0,
                colorValue: undefined,
            },
        );
    }
}

/**
 * Fold the step's accepted order intents into the runner's nominal position and
 * auto-render their entry / exit markers. Called once per runner at the end of
 * every **confirmed** step (`history` / `close`) — see
 * `execution/runComputeStep.ts` for the three conditions that suppress it.
 *
 * `ctx.pendingOrders` already holds exactly this step's accepted orders in
 * emission order (it is reset with the emission queues and emptied again
 * whenever they are discarded), so nothing here filters. The position is
 * REPLACED as a whole frozen object rather than mutated — `order.position()`
 * hands it straight to script code.
 *
 * Markers ride the ordinary plot queue, so they inherit its `(slotId, bar)`
 * last-write-wins dedup: a repeated same-bar fold collapses to one picture while
 * the append-only `orders` channel keeps every event. The two dedup policies
 * differ on the same event on purpose (RFC 0002 §8).
 *
 * @since 1.11
 * @example
 *     // Internal — the step driver calls this after `compute` returns.
 *     // foldConfirmedOrders(state.runtimeContext);
 */
export function foldConfirmedOrders(ctx: RuntimeContext): void {
    const pending = ctx.pendingOrders;
    if (pending.length === 0) return;

    const bar = ctx.barIndex();
    // `bar.close` is the cached series VIEW (number-coercible), not a scalar —
    // the `bar.point` precedent coerces the same way.
    const price = Number(ctx.stream.bar.close);

    let position = ctx.orderPosition;
    for (const record of pending) {
        position = applyOrderToPosition(position, record.emission, bar, price);
        if (record.marker) emitOrderMarkers(ctx, record.emission);
    }
    ctx.orderPosition = position;
}

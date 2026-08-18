// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { JsonValue } from "../types.js";

const sentinel = (name: string): never => {
    throw new Error(`${name} called outside compiled runtime`);
};

/**
 * The three market intents `order.*` can express. `"buy"` opens or adds to a
 * long, `"sell"` opens or adds to a short, `"close"` targets flat. There are
 * deliberately no limit / stop / bracket actions in `apiVersion: 1` — a resting
 * order would force the language to define when it fills, which is a fill
 * model, and fill economics belong to the consumer.
 *
 * @since 1.12
 * @stable
 * @example
 *     const action: OrderAction = "buy";
 *     void action;
 */
export type OrderAction = "buy" | "sell" | "close";

/**
 * Options accepted by every `order.*` emitter. `qty` is an **unsigned**
 * magnitude (the action names the side); absent means the consumer's default,
 * and the nominal position tracker treats it as one unit. `label` is shown on
 * the auto-rendered marker and forwarded to consumers. `marker` is render-side
 * only — `false` suppresses the auto-drawn arrow / label and is deliberately
 * absent from the wire emission, which records the intent rather than how it was
 * drawn. `meta` is round-tripped to the host as a JSON-serialisable payload.
 *
 * @since 1.12
 * @stable
 * @example
 *     const opts: OrderOpts = { qty: 2, label: "Long", meta: { reason: "cross" } };
 *     void opts;
 */
export type OrderOpts = Readonly<{
    qty?: number;
    label?: string;
    marker?: boolean;
    meta?: Readonly<Record<string, JsonValue>>;
}>;

/**
 * The **nominal** position the runtime tracks over emitted order intents:
 * `size` is signed (`> 0` long, `< 0` short, `0` flat), `avgPrice` averages the
 * *signal bar's close* (never a simulated fill price) and is `null` when flat,
 * and `entryBar` is the bar index the current position opened. There is no
 * capital, no slippage, no commission and no P&L here by design — a consumer's
 * own simulator is the authority on economics, so a next-bar-open filler will
 * legitimately report a different average price than `avgPrice`.
 *
 * @since 1.12
 * @stable
 * @example
 *     const flat: OrderPosition = { size: 0, avgPrice: null, entryBar: null };
 *     void flat;
 */
export type OrderPosition = Readonly<{
    size: number;
    avgPrice: number | null;
    entryBar: number | null;
}>;

/**
 * Compile-time callable hole for the `order.*` namespace. Every method throws
 * the `"order.<member> called outside compiled runtime"` sentinel — the compiler
 * rewrites each callsite to dispatch to the runtime, which installs the real
 * namespace on `ComputeContext.order`.
 *
 * The three emitters queue an intent on the `orders` emission channel and are
 * gated by the adapter's `orders` capability; each accepted order additionally
 * auto-renders an entry/exit arrow through the existing plot pipeline unless the
 * call passes `marker: false`. `order.position()` is a pure read of the nominal
 * position and reads the state as of the **previous** confirmed step, so a read
 * never sees the same bar's own orders (matching Pine's
 * `strategy.position_size` lag).
 *
 * Legal wherever `alert` is: inside the `compute` of `defineIndicator`,
 * `defineAlert` and `defineDrawing`. There is no separate strategy script kind.
 *
 * @since 1.12
 * @stable
 * @example
 * ```ts
 * import { defineIndicator, order, ta } from "@invinite-org/chartlang-core";
 *
 * export default defineIndicator({
 *     name: "EMA cross orders",
 *     apiVersion: 1,
 *     compute: ({ bar }) => {
 *         const fast = ta.ema(bar.close, 12);
 *         const slow = ta.ema(bar.close, 26);
 *         if (order.position().size <= 0 && ta.crossover(fast, slow).current) {
 *             order.buy({ label: "Long" });
 *         }
 *         if (order.position().size > 0 && ta.crossunder(fast, slow).current) {
 *             order.close({ label: "Exit" });
 *         }
 *     },
 * });
 * ```
 */
export const order = /* @__PURE__ */ Object.freeze({
    /**
     * Emit a market **buy** intent: open or add to a long, reversing an
     * existing short that it crosses through. `qty` is unsigned magnitude.
     *
     * @since 1.12
     * @stable
     * @example
     *     const fn: typeof order.buy = order.buy;
     *     void fn;
     */
    buy(_opts?: OrderOpts): void {
        sentinel("order.buy");
    },

    /**
     * Emit a market **sell** intent: open or add to a short, reversing an
     * existing long that it crosses through. `qty` is unsigned magnitude.
     *
     * @since 1.12
     * @stable
     * @example
     *     const fn: typeof order.sell = order.sell;
     *     void fn;
     */
    sell(_opts?: OrderOpts): void {
        sentinel("order.sell");
    },

    /**
     * Emit a market **close** intent: target flat from either side. The nominal
     * tracker always flattens fully — a partial-close `qty` rides the emission
     * for consumers that simulate partials but is ignored here.
     *
     * @since 1.12
     * @stable
     * @example
     *     const fn: typeof order.close = order.close;
     *     void fn;
     */
    close(_opts?: OrderOpts): void {
        sentinel("order.close");
    },

    /**
     * Read the nominal position. Pure — it allocates no per-callsite state, so
     * it is the one `order.*` member that is legal inside a bounded loop and
     * that does **not** make a script ask for the `orders` capability. Returns
     * the state as of the previous confirmed step (see the lag note on the
     * namespace).
     *
     * @since 1.12
     * @stable
     * @example
     *     const fn: typeof order.position = order.position;
     *     void fn;
     */
    position(): OrderPosition {
        return sentinel("order.position");
    },
});

/**
 * Static type of the `order` namespace. Derived from the frozen namespace object
 * (like `TimeNamespace` / `RequestNamespace`) rather than hand-written, so the
 * member JSDoc has exactly one home and the generated hover registry cannot
 * receive two competing entries per member.
 *
 * @since 1.12
 * @stable
 * @example
 *     const ns: OrderNamespace = order;
 *     void ns;
 */
export type OrderNamespace = typeof order;

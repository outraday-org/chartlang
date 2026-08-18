// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    JsonValue,
    OrderAction,
    OrderNamespace,
    OrderOpts,
    OrderPosition,
} from "@invinite-org/chartlang-core";
import type { OrderEmission } from "@invinite-org/chartlang-adapter-kit";

import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { pushDiagnostic, pushOrder } from "./emissionsQueue.js";
import { hashStringStable } from "./hash.js";
import { snapshotMeta } from "./snapshotMeta.js";

const outsideCtxMessage = (member: string): string =>
    `order.${member} called outside an active script step`;

function computeDedupeKey(
    slotId: string,
    bar: number,
    action: OrderAction,
    qty: number | null,
    label: string,
    meta: Readonly<Record<string, JsonValue>>,
): string {
    return `${slotId}::${bar}::${hashStringStable(
        action + String(qty) + label + JSON.stringify(meta),
    )}`;
}

function orderImpl(
    ctx: RuntimeContext,
    slotId: string,
    action: OrderAction,
    opts: OrderOpts,
): void {
    if (ctx.capabilities.orders !== true) {
        // Once per slot per mount — an `orders: false` adapter would otherwise
        // collect one diagnostic per order per bar.
        if (!ctx.diagnosedOrderSlots.has(slotId)) {
            ctx.diagnosedOrderSlots.add(slotId);
            pushDiagnostic(ctx.emissions, {
                kind: "diagnostic",
                severity: "warning",
                code: "unsupported-orders",
                message: "Adapter does not support order emissions.",
                slotId,
                bar: ctx.barIndex(),
            });
        }
        return;
    }

    const bar = ctx.barIndex();
    const qty = opts.qty ?? null;
    const label = opts.label ?? "";
    const meta = snapshotMeta(opts.meta ?? {});

    const emission: OrderEmission = {
        kind: "order",
        slotId,
        action,
        qty,
        label,
        bar,
        time: ctx.stream.bar.time,
        meta,
        dedupeKey: computeDedupeKey(slotId, bar, action, qty, label, meta),
    };

    // The wire is the arbiter: a `qty` that is not finite-`> 0`, a non-string
    // `label`, or non-JSON `meta` is rejected by `validateEmission` inside
    // `pushOrder`, which diagnoses `malformed-emission` and queues nothing.
    // Nothing is ever clamped, and a rejected intent must not reach the
    // position tracker either — hence the guard rather than an unconditional
    // record.
    if (!pushOrder(ctx.emissions, emission)) return;

    ctx.pendingOrders.push({ emission, marker: opts.marker !== false });
}

function emit(
    member: OrderAction,
    arg1: string | OrderOpts | undefined,
    arg2: OrderOpts | undefined,
): void {
    if (typeof arg1 !== "string") {
        // No slot id present — direct script-author invocation or missing
        // compiler injection. Surface the sentinel.
        throw new Error(outsideCtxMessage(member));
    }
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(outsideCtxMessage(member));
    orderImpl(ctx, arg1, member, arg2 ?? {});
}

/**
 * Emit a market **buy** intent for the current bar (script-facing overload).
 *
 * @since 1.11
 * @example
 *     // Scripts call `order.buy({ label: "Long" })`.
 */
function buy(opts?: OrderOpts): void;
/**
 * Compiler-injected overload — `order.buy` is `slot: true`, so every callsite
 * is rewritten to carry its stable slot id as the leading argument.
 *
 * @since 1.11
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 */
function buy(slotId: string, opts?: OrderOpts): void;
/**
 * Implementation signature. Branches on `typeof arg1 === "string"` to
 * discriminate the compiler-injected form from the bare script-facing form,
 * which always throws the active-step sentinel.
 *
 * @since 1.11
 * @example
 *     // const fn: typeof buy = buy;
 */
function buy(arg1?: string | OrderOpts, arg2?: OrderOpts): void {
    emit("buy", arg1, arg2);
}

/**
 * Emit a market **sell** intent for the current bar (script-facing overload).
 *
 * @since 1.11
 * @example
 *     // Scripts call `order.sell({ label: "Short" })`.
 */
function sell(opts?: OrderOpts): void;
/**
 * Compiler-injected overload.
 *
 * @since 1.11
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 */
function sell(slotId: string, opts?: OrderOpts): void;
/**
 * Implementation signature for the `sell` emitter.
 *
 * @since 1.11
 * @example
 *     // const fn: typeof sell = sell;
 */
function sell(arg1?: string | OrderOpts, arg2?: OrderOpts): void {
    emit("sell", arg1, arg2);
}

/**
 * Emit a market **close** intent for the current bar (script-facing overload).
 *
 * @since 1.11
 * @example
 *     // Scripts call `order.close({ label: "Exit" })`.
 */
function close(opts?: OrderOpts): void;
/**
 * Compiler-injected overload.
 *
 * @since 1.11
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 */
function close(slotId: string, opts?: OrderOpts): void;
/**
 * Implementation signature for the `close` emitter.
 *
 * @since 1.11
 * @example
 *     // const fn: typeof close = close;
 */
function close(arg1?: string | OrderOpts, arg2?: OrderOpts): void {
    emit("close", arg1, arg2);
}

/**
 * Read the nominal position. Unlike the three emitters this takes **no** slot
 * id: `order.position` is registered `slot: false`, so the compiler injects
 * nothing (which is also what keeps it legal inside a bounded loop and what
 * keeps a position-reading script from asking for the `orders` capability).
 *
 * @since 1.11
 * @example
 *     // const fn: typeof position = position;
 */
function position(): OrderPosition {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(outsideCtxMessage("position"));
    return ctx.orderPosition;
}

/**
 * Runtime `order` namespace — the real implementation behind core's throwing
 * holes, installed on `ComputeContext.order` by `buildComputeContext`.
 *
 * Each emitter gates on `capabilities.orders`, deep-snapshots `meta`, computes
 * a machine-stable `dedupeKey`, and appends to the **append-only** `orders`
 * queue; the accepted intent is additionally recorded on
 * `RuntimeContext.pendingOrders` for the confirmed-step position fold and the
 * auto-marker lowering. `position()` is a pure read of
 * `RuntimeContext.orderPosition`.
 *
 * Typed as core's `OrderNamespace` directly — no widening cast (unlike `ta`),
 * because each member's script-facing overload already matches the
 * script-facing shape.
 *
 * @since 1.11
 * @example
 *     import { order } from "@invinite-org/chartlang-runtime";
 *     void order;
 */
export const ORDER_NAMESPACE: OrderNamespace = Object.freeze({ buy, sell, close, position });

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { AlertOpts, JsonValue } from "@invinite-org/chartlang-core";
import type { AlertChannel, AlertEmission } from "@invinite-org/chartlang-adapter-kit";

import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { pushAlert, pushDiagnostic } from "./emissionsQueue";
import { hashStringStable } from "./hash";

const OUTSIDE_CTX_MESSAGE = "alert called outside an active script step";

function computeDedupeKey(
    slotId: string,
    bar: number,
    message: string,
    meta: Readonly<Record<string, JsonValue>>,
): string {
    return `${slotId}::${bar}::${hashStringStable(message + JSON.stringify(meta))}`;
}

function snapshotUnknown(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map((item) => snapshotUnknown(item));
    }
    if (typeof value === "object" && value !== null) {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [key, snapshotUnknown(item)]),
        );
    }
    return value;
}

function snapshotMeta(
    meta: Readonly<Record<string, JsonValue>>,
): Readonly<Record<string, JsonValue>> {
    return snapshotUnknown(meta) as Readonly<Record<string, JsonValue>>;
}

function alertImpl(ctx: RuntimeContext, slotId: string, message: string, opts: AlertOpts): void {
    if (ctx.capabilities.alerts.size === 0) {
        pushDiagnostic(ctx.emissions, {
            kind: "diagnostic",
            severity: "warning",
            code: "unsupported-alert-channel",
            message: "Adapter declares no alert channels; alert dropped.",
            slotId,
            bar: ctx.barIndex(),
        });
        return;
    }

    const channels: AlertChannel[] = Array.from(ctx.capabilities.alerts);
    const bar = ctx.barIndex();
    const meta = snapshotMeta(opts.meta ?? {});

    const emission: AlertEmission = {
        kind: "alert",
        slotId,
        severity: opts.severity ?? "info",
        message,
        bar,
        time: ctx.stream.bar.time,
        meta,
        channels: Object.freeze(channels.slice()),
        dedupeKey: computeDedupeKey(slotId, bar, message, meta),
    };

    pushAlert(ctx.emissions, emission);
}

/**
 * Emit an `AlertEmission` for the current bar (script-facing overload).
 *
 * Same dual-signature contract as {@link plot}: scripts call
 * `alert(message, opts?)`; the compiler injects the slot id as the
 * leading argument (see the sibling `alert(slotId, message, opts?)`
 * overload). Direct invocation without a slot id throws the sentinel
 * error.
 *
 * `dedupeKey` is computed as
 * `${slotId}::${bar}::FNV1a(message + JSON.stringify(meta))` and is
 * stable across machines — adapters that dispatch via async channels
 * use it for idempotency. `channels` is a snapshot of
 * `capabilities.alerts` at emission time; adapters that gate on
 * specific channels filter downstream.
 *
 * @since 0.1
 * @example
 *     import { defineIndicator, alert, ta } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "EMA cross",
 *         apiVersion: 1,
 *         compute({ bar }) {
 *             const fast = ta.ema(bar.close, 12);
 *             const slow = ta.ema(bar.close, 26);
 *             if (ta.crossover(fast, slow).current) {
 *                 alert("Fast EMA crossed above slow EMA", { severity: "info" });
 *             }
 *         },
 *     });
 */
export function alert(message: string, opts?: AlertOpts): void;
/**
 * Emit an `AlertEmission` (compiler-injected overload). Task 2's
 * transformer rewrites script-side `alert(msg)` into
 * `alert(slotId, msg)`.
 *
 * @since 0.1
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof alert = alert;
 *     // void fn;
 */
export function alert(slotId: string, message: string, opts?: AlertOpts): void;
/**
 * Implementation signature for {@link alert}. Branches on
 * `typeof arg2 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.1
 * @example
 *     // const fn: typeof alert = alert;
 *     // void fn;
 */
export function alert(arg1: string, arg2?: string | AlertOpts, arg3?: AlertOpts): void {
    if (typeof arg2 !== "string") {
        // No slot id present — direct script-author invocation or
        // missing compiler injection. Surface the sentinel.
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (!ctx) throw new Error(OUTSIDE_CTX_MESSAGE);
    alertImpl(ctx, arg1, arg2, arg3 ?? {});
}

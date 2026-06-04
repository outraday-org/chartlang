// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { HLineOpts } from "@invinite-org/chartlang-core";
import type { PlotEmission, PlotStyle } from "@invinite-org/chartlang-adapter-kit";

import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { pushDiagnostic, pushPlot } from "./emissionsQueue";

const OUTSIDE_CTX_MESSAGE = "hline called outside an active script step";

function hlineImpl(ctx: RuntimeContext, slotId: string, price: number, opts: HLineOpts): void {
    const style: PlotStyle = {
        kind: "horizontal-line",
        lineWidth: opts.lineWidth ?? 1,
        lineStyle: opts.lineStyle ?? "solid",
    };

    if (!ctx.capabilities.plots.has("horizontal-line")) {
        pushDiagnostic(ctx.emissions, {
            kind: "diagnostic",
            severity: "warning",
            code: "unsupported-plot-kind",
            message: 'Adapter cannot render plot kind "horizontal-line".',
            slotId,
            bar: ctx.barIndex(),
        });
        return;
    }

    const emission: PlotEmission = {
        kind: "plot",
        slotId,
        title: opts.title ?? "",
        style,
        bar: ctx.barIndex(),
        time: ctx.stream.bar.time,
        value: Number.isFinite(price) ? price : null,
        color: opts.color ?? null,
        meta: {},
        pane: "overlay",
    };

    pushPlot(ctx.emissions, emission);
}

/**
 * Emit a horizontal-line plot pinned at the supplied `price`
 * (script-facing overload).
 *
 * Same dual-signature contract as {@link plot}: scripts call
 * `hline(price, opts?)`; the compiler's callsite-id transformer (Task 2)
 * rewrites every call to `hline(slotId, price, opts?)` (the sibling
 * overload). Direct invocation without a slot id throws the sentinel
 * error.
 *
 * `hline` is fixed to `pane: "overlay"` — horizontal lines never
 * route to a sub-pane in any phase. The `kind` discriminator is
 * always `"horizontal-line"`; adapters that don't declare the
 * capability drop with `unsupported-plot-kind`.
 *
 * @since 0.1
 * @example
 *     import { defineIndicator, hline } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "RSI bounds",
 *         apiVersion: 1,
 *         compute() {
 *             hline(70, { color: "#ef4444", title: "Overbought" });
 *             hline(30, { color: "#10b981", title: "Oversold" });
 *         },
 *     });
 */
export function hline(price: number, opts?: HLineOpts): void;
/**
 * Emit a horizontal-line plot for the current bar (compiler-injected
 * overload). Task 2's transformer rewrites script-side `hline(price)`
 * into `hline(slotId, price)`.
 *
 * @since 0.1
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof hline = hline;
 *     // void fn;
 */
export function hline(slotId: string, price: number, opts?: HLineOpts): void;
/**
 * Implementation signature for {@link hline}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.1
 * @example
 *     // const fn: typeof hline = hline;
 *     // void fn;
 */
export function hline(arg1: string | number, arg2?: number | HLineOpts, arg3?: HLineOpts): void {
    if (typeof arg1 !== "string") {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (!ctx) throw new Error(OUTSIDE_CTX_MESSAGE);
    if (typeof arg2 !== "number") {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    hlineImpl(ctx, arg1, arg2, arg3 ?? {});
}

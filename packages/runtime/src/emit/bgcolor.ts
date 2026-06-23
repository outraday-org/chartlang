// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { BgColorOpts, Color, PlotOpts } from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../runtimeContext.js";
import { plotImpl } from "./plot.js";

const OUTSIDE_CTX_MESSAGE = "bgcolor called outside an active script step";

/**
 * Lower a `bgcolor(color, opts?)` call to the `PlotOpts` a verbose
 * `plot(NaN, { style: { kind: "bg-color", color, transp }, title })` would
 * carry. The static `bg-color` style still carries the color (fallback for
 * adapters that ignore the dynamic channel); the live per-bar color is
 * additionally routed to {@link plotImpl}'s `dynamicColor` arg so it rides
 * the wire as `PlotEmission.colorValue`. `transp` / `title` are spread
 * conditionally (omitted ⇒ absent on the wire), matching the author style arm
 * and `exactOptionalPropertyTypes`.
 */
function bgColorOpts(color: Color, opts: BgColorOpts): PlotOpts {
    return {
        style: {
            kind: "bg-color",
            color,
            ...(opts.transp === undefined ? {} : { transp: opts.transp }),
        },
        ...(opts.title === undefined ? {} : { title: opts.title }),
    };
}

/**
 * Paint the pane background for the current bar — the runtime impl of the
 * Pine-ergonomic `bgcolor` alias (script-facing overload).
 *
 * Same dual-signature contract as {@link plot}: scripts call
 * `bgcolor(color, opts?)`; the compiler's callsite-id transformer rewrites
 * every call to `bgcolor(slotId, color, opts?)` (the sibling overload).
 * Direct invocation without a slot id throws the sentinel error.
 *
 * `bgcolor` is Pine-ergonomic sugar — it builds the `bg-color` `PlotStyle`
 * and dispatches to the shared {@link plotImpl} with `value = NaN` (→ wire
 * `value: null`). The per-bar color rides the wire as
 * `PlotEmission.colorValue` (the dynamic-color channel), so a single call
 * recolors every bar by that bar's evaluated color; the static `style.color`
 * remains the fallback. Adapters that do not declare the `bg-color`
 * capability drop it with `unsupported-plot-kind`.
 *
 * @since 1.4
 * @example
 *     import { defineIndicator, bgcolor } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "Heat",
 *         apiVersion: 1,
 *         compute({ bar }) {
 *             bgcolor(bar.close > bar.open ? "#16a34a" : "#dc2626", { transp: 80 });
 *         },
 *     });
 */
export function bgcolor(color: Color, opts?: BgColorOpts): void;
/**
 * Paint the pane background for the current bar (compiler-injected overload).
 * The callsite-id transformer rewrites script-side `bgcolor(color, opts?)`
 * into `bgcolor(slotId, color, opts?)`.
 *
 * @since 1.4
 * @example
 *     // Internal — the compiler rewrites every script callsite, e.g.
 *     // `bgcolor("#000")` becomes `bgcolor("demo.chart.ts:5:9#0", "#000")`.
 *     // const fn: typeof bgcolor = bgcolor;
 *     // void fn;
 */
export function bgcolor(slotId: string, color: Color, opts?: BgColorOpts): void;
/**
 * Implementation signature for {@link bgcolor}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 1.4
 * @example
 *     // const fn: typeof bgcolor = bgcolor;
 *     // void fn;
 */
export function bgcolor(
    arg1: string | Color,
    arg2?: Color | BgColorOpts,
    arg3?: BgColorOpts,
): void {
    if (typeof arg1 !== "string" || typeof arg2 !== "string") {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (!ctx) throw new Error(OUTSIDE_CTX_MESSAGE);
    plotImpl(ctx, arg1, Number.NaN, bgColorOpts(arg2, arg3 ?? {}), arg2);
}

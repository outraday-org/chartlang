// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { BarColorOpts, Color, PlotOpts } from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../runtimeContext.js";
import { plotImpl } from "./plot.js";

const OUTSIDE_CTX_MESSAGE = "barcolor called outside an active script step";

/**
 * Lower a `barcolor(color, opts?)` call to the `PlotOpts` a verbose
 * `plot(NaN, { style: { kind: "bar-color", color }, title })` would carry. The
 * static `bar-color` style still carries the color (fallback for adapters
 * that ignore the dynamic channel); the live per-bar color is additionally
 * routed to {@link plotImpl}'s `dynamicColor` arg so it rides the wire as
 * `PlotEmission.colorValue`. The `bar-color` style carries no transparency, so
 * only `title` is spread conditionally (omitted ⇒ absent on the wire).
 */
function barColorOpts(color: Color, opts: BarColorOpts): PlotOpts {
    return {
        style: { kind: "bar-color", color },
        ...(opts.title === undefined ? {} : { title: opts.title }),
    };
}

/**
 * Tint the candle / bar for the current bar — the runtime impl of the
 * Pine-ergonomic `barcolor` alias (script-facing overload).
 *
 * Same dual-signature contract as {@link plot}: scripts call
 * `barcolor(color, opts?)`; the compiler's callsite-id transformer rewrites
 * every call to `barcolor(slotId, color, opts?)` (the sibling overload).
 * Direct invocation without a slot id throws the sentinel error.
 *
 * `barcolor` is Pine-ergonomic sugar — it builds the `bar-color` `PlotStyle`
 * and dispatches to the shared {@link plotImpl} with `value = NaN` (→ wire
 * `value: null`). The per-bar color rides the wire as
 * `PlotEmission.colorValue` (the dynamic-color channel), so a single call
 * recolors every bar by that bar's evaluated color; the static `style.color`
 * remains the fallback. Adapters that do not declare the `bar-color`
 * capability drop it with `unsupported-plot-kind`.
 *
 * @since 1.4
 * @example
 *     import { defineIndicator, barcolor } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "Tint",
 *         apiVersion: 1,
 *         compute({ bar }) {
 *             barcolor(bar.close > bar.open ? "#16a34a" : "#dc2626");
 *         },
 *     });
 */
export function barcolor(color: Color, opts?: BarColorOpts): void;
/**
 * Tint the candle / bar for the current bar (compiler-injected overload).
 * The callsite-id transformer rewrites script-side `barcolor(color, opts?)`
 * into `barcolor(slotId, color, opts?)`.
 *
 * @since 1.4
 * @example
 *     // Internal — the compiler rewrites every script callsite, e.g.
 *     // `barcolor("#000")` becomes `barcolor("demo.chart.ts:5:9#0", "#000")`.
 *     // const fn: typeof barcolor = barcolor;
 *     // void fn;
 */
export function barcolor(slotId: string, color: Color, opts?: BarColorOpts): void;
/**
 * Implementation signature for {@link barcolor}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 1.4
 * @example
 *     // const fn: typeof barcolor = barcolor;
 *     // void fn;
 */
export function barcolor(
    arg1: string | Color,
    arg2?: Color | BarColorOpts,
    arg3?: BarColorOpts,
): void {
    if (typeof arg1 !== "string" || typeof arg2 !== "string") {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (!ctx) throw new Error(OUTSIDE_CTX_MESSAGE);
    plotImpl(ctx, arg1, Number.NaN, barColorOpts(arg2, arg3 ?? {}), arg2);
}

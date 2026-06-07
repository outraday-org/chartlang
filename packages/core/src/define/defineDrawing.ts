// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CompiledScriptObject, ComputeFn, DrawingCounts, InputSchema } from "../types";

/**
 * Author-supplied options the script passes to `defineDrawing(...)`. Same
 * shape as `DefineAlertOpts` (no indicator-only `overlay` flag) plus the
 * Phase-3 `maxDrawings` per-bucket cap from `DefineIndicatorOpts`.
 *
 * @since 0.3
 * @experimental
 * @example
 *     const opts: DefineDrawingOpts = {
 *         name: "Interactive Fib Retracement",
 *         apiVersion: 1,
 *         compute: () => {},
 *     };
 */
export type DefineDrawingOpts = Readonly<{
    name: string;
    apiVersion: 1;
    inputs?: InputSchema;
    compute: ComputeFn;
    /** Per-bucket cap on `draw.*` emissions per bar. @since 0.3 */
    maxDrawings?: DrawingCounts;
}>;

/**
 * Construct a Phase-3 drawing script object. Mirrors `defineIndicator`
 * structurally; only `manifest.kind` (`"drawing"`) and the declared
 * `capabilities` (`["drawings"]`) differ. The runtime treats indicator
 * and drawing scripts identically at the per-bar level — the
 * discriminator is a host-side hint the editor uses to distinguish
 * drawing scripts from indicator scripts in the script-picker UI
 * (PLAN.md §4.1).
 *
 * `compute({ bar, draw, inputs, ... })` runs per bar; emit drawings via
 * the `draw.*` namespace. Each `draw.<kind>(...)` returns a
 * {@link DrawingHandle} the script can `update(...)` or `remove()`
 * across bars. Phase 4 layers an interactive-anchor-picker UI on top of
 * this constructor (PLAN.md §10.1.1); Phase 3 ships the constructor
 * with fixed anchors so the runtime path can be exercised.
 *
 * @since 0.3
 * @experimental
 * @example
 * ```ts
 * import { defineDrawing } from "@invinite-org/chartlang-core";
 *
 * export default defineDrawing({
 *     name: "Interactive Fib Retracement",
 *     apiVersion: 1,
 *     compute: ({ draw }) => {
 *         draw.fibRetracement(
 *             { time: 1_700_000_000_000, price: 100 },
 *             { time: 1_700_086_400_000, price: 110 },
 *         );
 *     },
 * });
 * ```
 */
export function defineDrawing(opts: DefineDrawingOpts): CompiledScriptObject {
    const capabilities: ReadonlyArray<"drawings"> = Object.freeze<["drawings"]>(["drawings"]);
    const requestedIntervals: ReadonlyArray<string> = Object.freeze<string[]>([]);
    const seriesCapacities: Readonly<Record<string, number>> = Object.freeze({});
    const base = {
        apiVersion: 1 as const,
        kind: "drawing" as const,
        name: opts.name,
        inputs: opts.inputs ?? {},
        capabilities,
        requestedIntervals,
        userPickableInterval: false,
        seriesCapacities,
        maxLookback: 0,
    };
    const manifest =
        opts.maxDrawings === undefined ? base : { ...base, maxDrawings: opts.maxDrawings };
    return Object.freeze({
        manifest: Object.freeze(manifest),
        compute: opts.compute,
    });
}

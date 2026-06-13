// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CompiledScriptObject, ComputeFn, DrawingCounts, InputSchema } from "../types.js";
import { attachDepAccessorSentinels } from "./depAccessorSentinel.js";
import type { OutputDeclaration } from "./dependency.js";
import type { ScriptOverrides } from "./overrides.js";

/**
 * Author-supplied options the script passes to `defineIndicator(...)`. The
 * compiler reads this object's static shape to build the script's manifest;
 * any field can be overridden at compile time via the AST transform.
 *
 * `maxDrawings` (Phase 3 / §10 / §4.1) caps the per-bucket `draw.*`
 * emission rate per bar. Omit to default to the adapter's cap.
 *
 * @since 0.1
 * @example
 *     const opts: DefineIndicatorOpts = {
 *         name: "demo",
 *         apiVersion: 1,
 *         compute: () => {},
 *     };
 */
export type DefineIndicatorOpts = Readonly<{
    name: string;
    apiVersion: 1;
    overlay?: boolean;
    inputs?: InputSchema;
    compute: ComputeFn;
    /** Per-bucket cap on `draw.*` emissions per bar. @since 0.3 */
    maxDrawings?: DrawingCounts;
    /**
     * Titled outputs this producer exposes for `<binding>.output(...)`
     * consumption. Injected by the compiler from the producer's
     * `plot(value, { title })` calls so the runtime object is
     * self-describing — hosts read `manifest.outputs` to allocate the
     * dep-output ring buffer. Hand-authored scripts omit it; absent
     * `outputs` keeps the emitted manifest byte-identical to a script
     * with no titled plots. @since 0.7
     */
    outputs?: ReadonlyArray<OutputDeclaration>;
}> &
    ScriptOverrides;

/**
 * Construct a Phase-1 indicator script object. Returns a frozen
 * `CompiledScriptObject` with a default manifest the compiler later overrides
 * (extracts `capabilities` from primitive usage, `maxLookback` from
 * `series[N]` reads). The defaults let the constructor work in unit tests
 * before the compiler runs.
 *
 * @since 0.1
 * @example
 * ```ts
 * import { defineIndicator } from "@invinite-org/chartlang-core";
 *
 * export default defineIndicator({
 *     name: "EMA(20)",
 *     apiVersion: 1,
 *     compute: ({ bar, plot }) => { plot(bar.close); },
 * });
 * ```
 */
export function defineIndicator(opts: DefineIndicatorOpts): CompiledScriptObject {
    const capabilities: ReadonlyArray<"indicators"> = Object.freeze<["indicators"]>(["indicators"]);
    const requestedIntervals: ReadonlyArray<string> = Object.freeze<string[]>([]);
    const seriesCapacities: Readonly<Record<string, number>> = Object.freeze({});
    const base = {
        apiVersion: 1 as const,
        kind: "indicator" as const,
        name: opts.name,
        inputs: opts.inputs ?? {},
        capabilities,
        requestedIntervals,
        userPickableInterval: false,
        seriesCapacities,
        maxLookback: 0,
    };
    const manifest = {
        ...base,
        ...(opts.maxDrawings === undefined ? {} : { maxDrawings: opts.maxDrawings }),
        ...(opts.maxBarsBack === undefined ? {} : { maxBarsBack: opts.maxBarsBack }),
        ...(opts.format === undefined ? {} : { format: opts.format }),
        ...(opts.precision === undefined ? {} : { precision: opts.precision }),
        ...(opts.scale === undefined ? {} : { scale: opts.scale }),
        ...(opts.requiresIntervals === undefined
            ? {}
            : { requiresIntervals: opts.requiresIntervals }),
        ...(opts.shortName === undefined ? {} : { shortName: opts.shortName }),
        ...(opts.outputs === undefined ? {} : { outputs: opts.outputs }),
    };
    return Object.freeze(
        attachDepAccessorSentinels({
            manifest: Object.freeze(manifest),
            compute: opts.compute,
        }),
    );
}

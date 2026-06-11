// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CompiledScriptObject, ComputeFn, InputSchema } from "../types.js";
import { attachDepAccessorSentinels } from "./depAccessorSentinel.js";
import type { ScriptOverrides } from "./overrides.js";

type AlertOverrides = Omit<ScriptOverrides, "scale" | "format" | "precision">;

/**
 * Author-supplied options the script passes to `defineAlert(...)`. Same shape
 * as `DefineIndicatorOpts` minus the indicator-only `overlay` flag — alert
 * scripts have no plot output.
 *
 * @since 0.1
 * @example
 *     const opts: DefineAlertOpts = {
 *         name: "RSI overbought",
 *         apiVersion: 1,
 *         compute: () => {},
 *     };
 */
export type DefineAlertOpts = Readonly<{
    name: string;
    apiVersion: 1;
    inputs?: InputSchema;
    compute: ComputeFn;
}> &
    AlertOverrides;

/**
 * Construct a Phase-1 alert script object. Returns a frozen
 * `CompiledScriptObject` whose `manifest.kind` is `"alert"` and whose
 * declared `capabilities` is `["alerts"]`. Same compile-time override
 * semantics as `defineIndicator`.
 *
 * @since 0.1
 * @example
 * ```ts
 * import { defineAlert } from "@invinite-org/chartlang-core";
 *
 * export default defineAlert({
 *     name: "RSI > 70",
 *     apiVersion: 1,
 *     compute: ({ alert }) => { alert("overbought"); },
 * });
 * ```
 */
export function defineAlert(opts: DefineAlertOpts): CompiledScriptObject {
    const capabilities: ReadonlyArray<"alerts"> = Object.freeze<["alerts"]>(["alerts"]);
    const requestedIntervals: ReadonlyArray<string> = Object.freeze<string[]>([]);
    const seriesCapacities: Readonly<Record<string, number>> = Object.freeze({});
    const base = {
        apiVersion: 1 as const,
        kind: "alert" as const,
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
        ...(opts.maxBarsBack === undefined ? {} : { maxBarsBack: opts.maxBarsBack }),
        ...(opts.requiresIntervals === undefined
            ? {}
            : { requiresIntervals: opts.requiresIntervals }),
        ...(opts.shortName === undefined ? {} : { shortName: opts.shortName }),
    };
    return Object.freeze(
        attachDepAccessorSentinels({
            manifest: Object.freeze(manifest),
            compute: opts.compute,
        }),
    );
}

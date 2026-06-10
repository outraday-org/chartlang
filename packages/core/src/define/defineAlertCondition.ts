// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AlertConditionDescriptor,
    AlertConditionDefinition,
    CompiledScriptObject,
    ComputeFn,
    InputSchema,
    ScriptManifest,
} from "../types.js";

/**
 * Author-supplied options for `defineAlertCondition(...)`. Mirrors
 * `DefineAlertOpts` plus the `conditions` map.
 *
 * @since 0.5
 * @stable
 * @example
 *     const opts: DefineAlertConditionOpts = {
 *         name: "EMA cross",
 *         apiVersion: 1,
 *         conditions: {
 *             up: {
 *                 title: "Up",
 *                 description: "Close > EMA",
 *                 defaultMessage: "{{ticker}} up",
 *             },
 *         },
 *         compute: () => {},
 *     };
 *     void opts;
 */
export type DefineAlertConditionOpts = Readonly<{
    name: string;
    apiVersion: 1;
    inputs?: InputSchema;
    conditions: Readonly<Record<string, AlertConditionDescriptor>>;
    compute: ComputeFn;
}>;

function freezeCondition(
    id: string,
    descriptor: AlertConditionDescriptor,
): AlertConditionDefinition {
    return Object.freeze({
        id,
        title: descriptor.title,
        description: descriptor.description,
        defaultMessage: descriptor.defaultMessage,
    });
}

/**
 * Construct a Phase-5 alert-condition script. Returns a frozen
 * `CompiledScriptObject` whose `manifest.kind` is `"alertCondition"`.
 *
 * @since 0.5
 * @stable
 * @example
 * ```ts
 * import { defineAlertCondition, input, ta } from "@invinite-org/chartlang-core";
 *
 * export default defineAlertCondition({
 *     name: "EMA cross",
 *     apiVersion: 1,
 *     inputs: { length: input.int(20) },
 *     conditions: {
 *         up: {
 *             title: "Up",
 *             description: "Close > EMA",
 *             defaultMessage: "{{ticker}} up",
 *         },
 *         down: {
 *             title: "Down",
 *             description: "Close < EMA",
 *             defaultMessage: "{{ticker}} down",
 *         },
 *     },
 *     compute({ bar, ta, inputs, signal }) {
 *         const ema = ta.ema(bar.close, inputs.length as number);
 *         signal?.("up", ta.crossover(bar.close, ema).current);
 *         signal?.("down", ta.crossunder(bar.close, ema).current);
 *     },
 * });
 * ```
 */
export function defineAlertCondition(opts: DefineAlertConditionOpts): CompiledScriptObject {
    const alertConditions = Object.freeze(
        Object.entries(opts.conditions).map(([id, descriptor]) => freezeCondition(id, descriptor)),
    );
    const capabilities = Object.freeze<ReadonlyArray<"alertConditions">>(["alertConditions"]);
    const requestedIntervals = Object.freeze<string[]>([]);
    const seriesCapacities: Readonly<Record<string, number>> = Object.freeze({});
    const manifest: ScriptManifest = Object.freeze({
        apiVersion: 1,
        kind: "alertCondition",
        name: opts.name,
        inputs: opts.inputs ?? {},
        capabilities,
        requestedIntervals,
        userPickableInterval: false,
        seriesCapacities,
        maxLookback: 0,
        alertConditions,
    });
    return Object.freeze({ manifest, compute: opts.compute });
}

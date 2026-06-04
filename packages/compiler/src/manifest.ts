// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CapabilityId, InputSchema, ScriptManifest } from "@invinite-org/chartlang-core";

/**
 * Build a recursively-frozen `ScriptManifest` from the compiler's
 * extraction passes. Every array, every nested record, and the outer
 * object itself are frozen so the runtime can structurally clone the
 * manifest without worrying about post-build mutation.
 *
 * @since 0.1
 * @example
 *     // const manifest = buildManifest({
 *     //     name: "EMA(20)", kind: "indicator",
 *     //     capabilities: ["alerts", "indicators"],
 *     //     requestedIntervals: [], userPickableInterval: false,
 *     //     seriesCapacities: {}, maxLookback: 0, inputs: {},
 *     // });
 *     const fn: typeof buildManifest = buildManifest;
 *     void fn;
 */
export function buildManifest(args: {
    readonly name: string;
    readonly kind: "indicator" | "drawing" | "alert";
    readonly capabilities: ReadonlyArray<CapabilityId>;
    readonly requestedIntervals: ReadonlyArray<string>;
    readonly userPickableInterval: boolean;
    readonly seriesCapacities: Readonly<Record<string, number>>;
    readonly maxLookback: number;
    readonly inputs: InputSchema;
}): ScriptManifest {
    const capabilities = Object.freeze(args.capabilities.slice());
    const requestedIntervals = Object.freeze(args.requestedIntervals.slice());
    const seriesCapacities = Object.freeze({ ...args.seriesCapacities });
    const inputs = Object.freeze({ ...args.inputs });
    return Object.freeze({
        apiVersion: 1 as const,
        kind: args.kind,
        name: args.name,
        inputs,
        capabilities,
        requestedIntervals,
        userPickableInterval: args.userPickableInterval,
        seriesCapacities,
        maxLookback: args.maxLookback,
    });
}

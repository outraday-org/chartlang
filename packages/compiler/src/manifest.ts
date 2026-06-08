// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CapabilityId, ScriptManifest } from "@invinite-org/chartlang-core";

type ValueFormat = "price" | "volume" | "percent" | "compact";
type ScaleAxis = "price" | "left" | "right" | "new";
type ManifestInputDescriptors = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

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
    readonly inputs: ManifestInputDescriptors;
    readonly maxBarsBack?: number;
    readonly format?: ValueFormat;
    readonly precision?: number;
    readonly scale?: ScaleAxis;
    readonly requiresIntervals?: ReadonlyArray<string>;
    readonly shortName?: string;
}): ScriptManifest {
    const capabilities = Object.freeze(args.capabilities.slice());
    const requestedIntervals = Object.freeze(args.requestedIntervals.slice());
    const seriesCapacities = Object.freeze({ ...args.seriesCapacities });
    const inputEntries = Object.entries(args.inputs).map(
        ([key, value]) => [key, Object.freeze({ ...value })] as const,
    );
    const inputs = Object.freeze(Object.fromEntries(inputEntries));
    const scriptInputs = inputs as ScriptManifest["inputs"];
    const requiresIntervals =
        args.requiresIntervals === undefined
            ? undefined
            : Object.freeze(args.requiresIntervals.slice());
    return Object.freeze({
        apiVersion: 1 as const,
        kind: args.kind,
        name: args.name,
        inputs: scriptInputs,
        capabilities,
        requestedIntervals,
        userPickableInterval: args.userPickableInterval,
        seriesCapacities,
        maxLookback: args.maxLookback,
        ...(args.maxBarsBack === undefined ? {} : { maxBarsBack: args.maxBarsBack }),
        ...(args.format === undefined ? {} : { format: args.format }),
        ...(args.precision === undefined ? {} : { precision: args.precision }),
        ...(args.scale === undefined ? {} : { scale: args.scale }),
        ...(requiresIntervals === undefined ? {} : { requiresIntervals }),
        ...(args.shortName === undefined ? {} : { shortName: args.shortName }),
    });
}

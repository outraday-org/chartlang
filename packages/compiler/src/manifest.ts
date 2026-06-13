// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AlertConditionDefinition,
    CapabilityId,
    DependencyDeclaration,
    OutputDeclaration,
    ScriptManifest,
} from "@invinite-org/chartlang-core";

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
    readonly kind: "indicator" | "drawing" | "alert" | "alertCondition";
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
    readonly alertConditions?: ReadonlyArray<AlertConditionDefinition>;
    readonly dependencies?: ReadonlyArray<DependencyDeclaration>;
    readonly outputs?: ReadonlyArray<OutputDeclaration>;
    readonly exportName?: string;
    readonly isDrawn?: boolean;
    readonly siblings?: ReadonlyArray<ScriptManifest>;
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
    const alertConditions =
        args.alertConditions === undefined
            ? undefined
            : Object.freeze(
                  args.alertConditions.map((condition) =>
                      Object.freeze({
                          id: condition.id,
                          title: condition.title,
                          description: condition.description,
                          defaultMessage: condition.defaultMessage,
                      }),
                  ),
              );
    const dependencies =
        args.dependencies === undefined || args.dependencies.length === 0
            ? undefined
            : Object.freeze(
                  args.dependencies.map((dep) =>
                      Object.freeze({
                          localId: dep.localId,
                          producerName: dep.producerName,
                          producerSourcePath: dep.producerSourcePath,
                          producerExportName: dep.producerExportName,
                          effectiveInputs: Object.freeze({ ...dep.effectiveInputs }),
                          outputs: Object.freeze(
                              dep.outputs.map((o) =>
                                  Object.freeze({ title: o.title, kind: o.kind }),
                              ),
                          ),
                          isDrawn: dep.isDrawn,
                      }),
                  ),
              );
    const outputs =
        args.outputs === undefined || args.outputs.length === 0
            ? undefined
            : Object.freeze(
                  args.outputs.map((o) => Object.freeze({ title: o.title, kind: o.kind })),
              );
    const siblings =
        args.siblings === undefined || args.siblings.length === 0
            ? undefined
            : Object.freeze(args.siblings.slice());
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
        ...(alertConditions === undefined ? {} : { alertConditions }),
        ...(dependencies === undefined ? {} : { dependencies }),
        ...(outputs === undefined ? {} : { outputs }),
        ...(args.exportName === undefined ? {} : { exportName: args.exportName }),
        ...(args.isDrawn === undefined ? {} : { isDrawn: args.isDrawn }),
        ...(siblings === undefined ? {} : { siblings }),
    });
}

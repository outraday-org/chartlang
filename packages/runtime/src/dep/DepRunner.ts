// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Bar, CompiledScriptObject } from "@invinite-org/chartlang-core";

import type { RunnerState } from "../createScriptRunner.js";
import { pushDiagnostic } from "../emit/emissionsQueue.js";
import { resolveDefaultPane, resolveScriptPane } from "../emit/paneResolver.js";
import { resetBarEmissions, runComputeBody } from "../execution/runComputeStep.js";
import { resolveInputs } from "../inputs/resolveInputs.js";
import type { MutableRunnerEmissions } from "../runtimeContext.js";
import { inMemoryStateStore } from "../stateStore.js";
import type { StreamState } from "../streamState.js";
import { createRuntimeViews } from "../views/index.js";
import type { EventKind } from "../views/index.js";
import type { DepOutputStore } from "./DepOutputStore.js";
import {
    type DepRunnerLike,
    type SiblingRunnerLike,
    applyDepEmissionPolicy,
} from "./emissionFilter.js";

/**
 * One mounted private dep — a `const X = defineIndicator(...)` binding
 * that another script in the same compiled bundle references via
 * `X.output("title")`. Owns its own `RunnerState`; shares the parent's
 * `mainStream` + `secondaryStreams`. Plot emissions are dropped from
 * the parent's queue and captured into the shared
 * {@link DepOutputStore}.
 *
 * @since 0.7
 * @stable
 * @example
 *     // const dep = createDepRunner({ compiled, localId: "fast", ... });
 *     // await runDepStep(dep, parent, rawBar, "close", false);
 *     const x: number = 1;
 *     void x;
 */
export type DepRunner = Readonly<{
    readonly kind: "dep";
    readonly localId: string;
    readonly slotIdPrefix: string;
    readonly declaredOutputs: ReadonlyArray<string>;
    readonly state: RunnerState;
}>;

/**
 * One mounted drawn sibling — a `export const X = defineIndicator(...)`
 * binding whose emissions ARE forwarded to the parent's queue, with
 * slot ids prefixed by `export:<exportName>/`. Siblings can also expose
 * outputs consumed by the primary or by other siblings.
 *
 * @since 0.7
 * @stable
 * @example
 *     // const sib = createSiblingRunner({ compiled, exportName: "slow", ... });
 *     // await runSiblingStep(sib, parent, rawBar, "close", false);
 *     const x: number = 1;
 *     void x;
 */
export type SiblingRunner = Readonly<{
    readonly kind: "sibling";
    readonly exportName: string;
    readonly slotIdPrefix: string;
    readonly declaredOutputs: ReadonlyArray<string>;
    readonly state: RunnerState;
}>;

/**
 * Constructor arguments for {@link createDepRunner} /
 * {@link createSiblingRunner}.
 *
 * `mainStream` + `secondaryStreams` are SHARED with the parent runner
 * (same OHLCV history); `depOutputStore` is also shared so every
 * sibling + dep + primary read from the same store. `inputOverrides`
 * is the merged effective-inputs record the compiler attached to the
 * dep's `DependencyDeclaration`.
 *
 * @since 0.7
 * @stable
 * @example
 *     // const args: CreateDepRunnerArgs = {
 *     //     compiled, localId: "x",
 *     //     parentCapabilities, mainStream, secondaryStreams,
 *     //     depOutputStore, inputOverrides: {}, now: Date.now,
 *     // };
 *     const x: number = 1;
 *     void x;
 */
export type CreateDepRunnerArgs = Readonly<{
    readonly compiled: CompiledScriptObject;
    readonly parentCapabilities: Capabilities;
    readonly mainStream: StreamState;
    readonly secondaryStreams: Map<string, StreamState>;
    readonly depOutputStore: DepOutputStore;
    readonly inputOverrides: Readonly<Record<string, unknown>>;
    readonly now: () => number;
}>;

function freshEmissions(barIndex: number): MutableRunnerEmissions {
    return {
        plots: [],
        drawings: [],
        alerts: [],
        alertConditions: [],
        logs: [],
        diagnostics: [],
        fromBar: barIndex,
        toBar: barIndex,
    };
}

function buildSubRunnerState(
    args: CreateDepRunnerArgs,
    slotIdPrefix: string,
    isDep: boolean,
): RunnerState {
    const stateStore = inMemoryStateStore();
    const emissions = freshEmissions(0);
    const alertConditions = new Map(
        (args.compiled.manifest.alertConditions ?? []).map((c) => [c.id, c]),
    );
    const state: RunnerState = {
        manifest: args.compiled.manifest,
        compute: args.compiled.compute,
        capabilities: args.parentCapabilities,
        stateStore,
        persistenceIntervalMs: Number.POSITIVE_INFINITY,
        now: args.now,
        mainStream: args.mainStream,
        runtimeContext: {
            stream: args.mainStream,
            stateStore,
            lastPersistTime: 0,
            capabilities: args.parentCapabilities,
            emissions,
            barIndex: () => state.barIndex,
            isTick: false,
            drawingSlots: new Map(),
            drawingSubIdCounters: new Map(),
            drawingBucketCounters: {
                lines: 0,
                labels: 0,
                boxes: 0,
                polylines: 0,
                other: 0,
            },
            scriptMaxDrawings: args.compiled.manifest.maxDrawings ?? null,
            stateSlots: new Map(),
            secondaryStreams: args.secondaryStreams,
            requestSecurityBars: new Map(),
            requestSecurityAlignments: new Map(),
            requestSecurityAscendingBars: new Map(),
            requestLowerTfViews: new Map(),
            diagnosedRequestKeys: new Set(),
            alertConditions,
            diagnosedAlertConditionKeys: new Set(),
            logBudget: 0,
            logBudgetExceededDiagnosed: false,
            resolvedInputs: Object.freeze({}),
            defaultPane: resolveDefaultPane(args.compiled.manifest),
            scriptPane: resolveScriptPane(args.compiled.manifest),
            // Overrides target the primary script's slots only in v1;
            // dep-output plots are not host-overridable.
            plotOverrides: Object.freeze({}),
            diagnosedInputKeys: new Set(),
            views: createRuntimeViews(),
            slotIdPrefix,
            isDep,
            depOutputStore: args.depOutputStore,
        },
        emissions,
        depRunners: [],
        siblingRunners: [],
        depOutputStore: args.depOutputStore,
        depErroredThisBar: false,
        barIndex: 0,
    };
    state.runtimeContext.resolvedInputs = resolveInputs(
        args.compiled.manifest,
        args.inputOverrides,
        state.runtimeContext,
    );
    return state;
}

function declaredOutputTitles(compiled: CompiledScriptObject): ReadonlyArray<string> {
    return (compiled.manifest.outputs ?? []).map((o) => o.title);
}

/**
 * Construct a {@link DepRunner} for one private dep entry of a
 * `CompiledScriptBundle`. The runner shares the parent's `mainStream`
 * + `secondaryStreams`, owns a fresh `inMemoryStateStore`, and feeds
 * its plot emissions into the shared `DepOutputStore`.
 *
 * @since 0.7
 * @stable
 * @example
 *     // const dep = createDepRunner({ compiled, localId: "fast",
 *     //     parentCapabilities, mainStream, secondaryStreams,
 *     //     depOutputStore, inputOverrides: { length: 20 }, now: Date.now });
 *     const x: number = 1;
 *     void x;
 */
export function createDepRunner(
    args: CreateDepRunnerArgs & { readonly localId: string },
): DepRunner {
    const slotIdPrefix = `dep:${args.localId}/`;
    return Object.freeze({
        kind: "dep" as const,
        localId: args.localId,
        slotIdPrefix,
        declaredOutputs: declaredOutputTitles(args.compiled),
        state: buildSubRunnerState(args, slotIdPrefix, true),
    });
}

/**
 * Construct a {@link SiblingRunner} for one drawn named-export entry of
 * a `CompiledScriptBundle`. Shares streams + store with the parent;
 * emissions forward to the parent with `export:<exportName>/` slot-id
 * prefixes.
 *
 * @since 0.7
 * @stable
 * @example
 *     // const sib = createSiblingRunner({ compiled, exportName: "slow", ... });
 *     const x: number = 1;
 *     void x;
 */
export function createSiblingRunner(
    args: CreateDepRunnerArgs & { readonly exportName: string },
): SiblingRunner {
    const slotIdPrefix = `export:${args.exportName}/`;
    return Object.freeze({
        kind: "sibling" as const,
        exportName: args.exportName,
        slotIdPrefix,
        declaredOutputs: declaredOutputTitles(args.compiled),
        state: buildSubRunnerState(args, slotIdPrefix, false),
    });
}

function depRunnerLike(dep: DepRunner): DepRunnerLike {
    return {
        kind: "dep",
        localId: dep.localId,
        slotIdPrefix: dep.slotIdPrefix,
        declaredOutputs: dep.declaredOutputs,
        emissions: dep.state.emissions,
    };
}

function siblingRunnerLike(sib: SiblingRunner): SiblingRunnerLike {
    return {
        kind: "sibling",
        exportName: sib.exportName,
        slotIdPrefix: sib.slotIdPrefix,
        declaredOutputs: sib.declaredOutputs,
        emissions: sib.state.emissions,
    };
}

async function executeSubStep(
    state: RunnerState,
    eventKind: EventKind,
    isTick: boolean,
): Promise<{ readonly halted: boolean; readonly message: string }> {
    resetBarEmissions(state);
    try {
        const outcome = await runComputeBody({ state, eventKind, isTick });
        return outcome.kind === "halt"
            ? { halted: true, message: outcome.message }
            : { halted: false, message: "" };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { halted: true, message };
    }
}

/**
 * Drive one bar of execution for a {@link DepRunner}. Runs the dep's
 * `compute`, captures its titled-plot output into the shared
 * `DepOutputStore` via {@link applyDepEmissionPolicy}, namespaces
 * diagnostics with `dep:<localId>/`, and on halt sets
 * `parentState.depErroredThisBar = true` so the parent's primary
 * step drops its emissions for the bar (per task spec §6).
 *
 * @since 0.7
 * @stable
 * @example
 *     // await runDepStep(dep, parent, rawBar, "close", false);
 *     const x: number = 1;
 *     void x;
 */
export async function runDepStep(
    dep: DepRunner,
    parentState: RunnerState,
    rawBar: Bar,
    eventKind: EventKind,
    isTick: boolean,
): Promise<void> {
    if (parentState.depOutputStore === null) {
        throw new Error("runDepStep called on a runner with no dep output store");
    }
    void rawBar;
    const result = await executeSubStep(dep.state, eventKind, isTick);
    if (result.halted) {
        // Use an empty slot id so the filter's prefix call produces the
        // runner's slotIdPrefix (`dep:<localId>/`) — preserves the
        // distinguished slotId in the parent's diagnostic queue.
        pushDiagnostic(dep.state.emissions, {
            kind: "diagnostic",
            severity: "error",
            code: "dep-error",
            message: result.message,
            slotId: "",
            bar: dep.state.barIndex,
        });
        parentState.depErroredThisBar = true;
    }
    if (!isTick) {
        dep.state.barIndex += 1;
    }
    applyDepEmissionPolicy(depRunnerLike(dep), parentState.emissions, parentState.depOutputStore);
}

/**
 * Drive one bar of execution for a {@link SiblingRunner}. Same shape
 * as {@link runDepStep} but the sibling's emissions are forwarded to
 * the parent with `export:<exportName>/` slot-id prefixes, and a
 * sibling halt does NOT clear the primary's emissions — only the
 * sibling's own bar emissions are lost.
 *
 * @since 0.7
 * @stable
 * @example
 *     // await runSiblingStep(sibling, parent, rawBar, "close", false);
 *     const x: number = 1;
 *     void x;
 */
export async function runSiblingStep(
    sibling: SiblingRunner,
    parentState: RunnerState,
    rawBar: Bar,
    eventKind: EventKind,
    isTick: boolean,
): Promise<void> {
    if (parentState.depOutputStore === null) {
        throw new Error("runSiblingStep called on a runner with no dep output store");
    }
    void rawBar;
    const result = await executeSubStep(sibling.state, eventKind, isTick);
    if (result.halted) {
        pushDiagnostic(sibling.state.emissions, {
            kind: "diagnostic",
            severity: "error",
            code: "dep-error",
            message: result.message,
            slotId: "",
            bar: sibling.state.barIndex,
        });
        // sibling halt does NOT set parentState.depErroredThisBar.
    }
    if (!isTick) {
        sibling.state.barIndex += 1;
    }
    applyDepEmissionPolicy(
        siblingRunnerLike(sibling),
        parentState.emissions,
        parentState.depOutputStore,
    );
}

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    Bar,
    CompiledScriptObject,
    ComputeFn,
    ScriptManifest,
} from "@invinite-org/chartlang-core";
import type { Capabilities, RunnerEmissions } from "@invinite-org/chartlang-adapter-kit";

import {
    drain as drainImpl,
    dispose as disposeImpl,
    onBarClose as onBarCloseImpl,
    onBarTick as onBarTickImpl,
    onHistory as onHistoryImpl,
} from "./execution";
import type { MutableRunnerEmissions, RuntimeContext } from "./runtimeContext";
import { inMemoryStateStore, type StateStore } from "./stateStore";
import { createStreamState, type StreamState } from "./streamState";

/**
 * Internal handle the execution functions read and mutate per step. Lives
 * inside `createScriptRunner`'s closure; never exposed on the public
 * barrel. `barIndex` is the only mutable field — `onBarClose` increments
 * it; `onBarTick` does not.
 *
 * @since 0.1
 * @example
 *     // RunnerState is internal — execution functions accept it as
 *     // their first argument:
 *     //   await onBarClose(state, rawBar);
 */
export type RunnerState = {
    readonly manifest: ScriptManifest;
    readonly compute: ComputeFn;
    readonly capabilities: Capabilities;
    readonly stateStore: StateStore;
    readonly mainStream: StreamState;
    readonly runtimeContext: RuntimeContext;
    readonly emissions: MutableRunnerEmissions;
    barIndex: number;
};

/**
 * The user-facing handle `createScriptRunner` returns. Hosts (Worker,
 * QuickJS, conformance harness) drive a `ScriptRunner` through the
 * standard lifecycle: `load → onHistory → onBarClose × N → onBarTick × M
 * → drain → dispose`. PLAN §6.1 fixes this shape; consumer-repo hosts
 * pin against it.
 *
 * `onHistory` / `onBarClose` / `onBarTick` return `Promise<void>` — the
 * runtime allows compute bodies to `await` (Phase 1 doesn't, but the
 * surface is forward-compatible with Phase-5 `request.security` warmup).
 *
 * @since 0.1
 * @example
 *     // import { createScriptRunner }
 *     //     from "@invinite-org/chartlang-runtime";
 *     // const runner = createScriptRunner({ compiled, capabilities });
 *     // await runner.onHistory(historicalBars);
 *     // const emissions = runner.drain();
 *     // runner.dispose();
 */
export type ScriptRunner = {
    onHistory(bars: ReadonlyArray<Bar>): Promise<void>;
    onBarClose(bar: Bar): Promise<void>;
    onBarTick(bar: Bar): Promise<void>;
    drain(): RunnerEmissions;
    dispose(): void;
};

/**
 * Constructor arguments for {@link createScriptRunner}. `stateStore`
 * defaults to {@link inMemoryStateStore} so callers without persistence
 * needs can omit it. `capabilities` is the adapter's declared shape;
 * Phase-1 primitives (Tasks 7-8) gate emissions against it.
 *
 * @since 0.1
 * @example
 *     // const args: CreateScriptRunnerArgs = {
 *     //     compiled,
 *     //     capabilities,
 *     //     stateStore: inMemoryStateStore(),
 *     // };
 */
export type CreateScriptRunnerArgs = {
    readonly compiled: CompiledScriptObject;
    readonly capabilities: Capabilities;
    readonly stateStore?: StateStore;
};

function resolveCapacity(manifest: ScriptManifest): number {
    const requested = manifest.seriesCapacities.ohlcv;
    const fallback = manifest.maxLookback + 1;
    return Math.max(1, requested ?? fallback);
}

/**
 * Build a `ScriptRunner` for a compiled chartlang script. The runner
 * owns one `StreamState`, one `MutableRunnerEmissions` queue set, and
 * the `RuntimeContext` Task 7-8 primitives read through
 * `ACTIVE_RUNTIME_CONTEXT`. Phase 1 ships a single-stream model; the
 * `requestedIntervals` field on the manifest is always empty.
 *
 * Capacity sizing follows PLAN §6.6: prefer
 * `manifest.seriesCapacities.ohlcv` (compiler-emitted per-series
 * lookback) and fall back to `manifest.maxLookback + 1`, clamped to a
 * minimum of 1 so an empty-history script still has a valid head slot.
 *
 * @since 0.1
 * @example
 *     // import { createScriptRunner } from "@invinite-org/chartlang-runtime";
 *     // const runner = createScriptRunner({ compiled, capabilities });
 *     // await runner.onHistory([]);
 *     // runner.drain();
 *     // runner.dispose();
 */
export function createScriptRunner(args: CreateScriptRunnerArgs): ScriptRunner {
    const capacity = resolveCapacity(args.compiled.manifest);
    const mainStream = createStreamState({ interval: "", capacity, symbol: "" });
    const stateStore = args.stateStore ?? inMemoryStateStore();
    const emissions: MutableRunnerEmissions = {
        plots: [],
        drawings: [],
        alerts: [],
        diagnostics: [],
        fromBar: 0,
        toBar: 0,
    };

    const state: RunnerState = {
        manifest: args.compiled.manifest,
        compute: args.compiled.compute,
        capabilities: args.capabilities,
        stateStore,
        mainStream,
        runtimeContext: {
            stream: mainStream,
            stateStore,
            capabilities: args.capabilities,
            emissions,
            barIndex: () => state.barIndex,
            isTick: false,
        },
        emissions,
        barIndex: 0,
    };

    return Object.freeze({
        async onHistory(bars) {
            await onHistoryImpl(state, bars);
        },
        async onBarClose(bar) {
            await onBarCloseImpl(state, bar);
        },
        async onBarTick(bar) {
            await onBarTickImpl(state, bar);
        },
        drain() {
            return drainImpl(state);
        },
        dispose() {
            disposeImpl(state);
        },
    });
}

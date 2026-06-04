// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { describe, expect, it } from "vitest";

import { buildComputeContext } from "./buildComputeContext";
import type { RunnerState } from "./createScriptRunner";
import type { MutableRunnerEmissions } from "./runtimeContext";
import { inMemoryStateStore } from "./stateStore";
import { createStreamState } from "./streamState";

function freshCapabilities(): Capabilities {
    return {
        plots: capabilities.allLines(),
        drawings: new Set(),
        alerts: new Set(),
        alertConditions: false,
        logs: false,
        inputs: new Set(),
        intervals: [],
        multiTimeframe: false,
        subPanes: 0,
        symInfoFields: new Set(),
        maxDrawingsPerScript: {
            lines: 0,
            labels: 0,
            boxes: 0,
            polylines: 0,
            other: 0,
        },
        maxLookback: 5000,
        maxTickHz: 10,
    };
}

function freshState(): RunnerState {
    const mainStream = createStreamState({ interval: "", capacity: 5, symbol: "" });
    const stateStore = inMemoryStateStore();
    const emissions: MutableRunnerEmissions = {
        plots: [],
        drawings: [],
        alerts: [],
        diagnostics: [],
        fromBar: 0,
        toBar: 0,
    };
    const state: RunnerState = {
        manifest: {
            apiVersion: 1,
            kind: "indicator",
            name: "demo",
            inputs: {},
            capabilities: ["indicators"],
            requestedIntervals: [],
            userPickableInterval: false,
            seriesCapacities: {},
            maxLookback: 0,
        },
        compute: () => {},
        capabilities: freshCapabilities(),
        stateStore,
        mainStream,
        runtimeContext: {
            stream: mainStream,
            stateStore,
            capabilities: freshCapabilities(),
            emissions,
            barIndex: () => 0,
            isTick: false,
        },
        emissions,
        barIndex: 0,
    };
    return state;
}

describe("buildComputeContext", () => {
    it("returns an object with bar / inputs / ta / plot / hline / alert", () => {
        const state = freshState();
        const ctx = buildComputeContext(state);
        expect(ctx).toHaveProperty("bar");
        expect(ctx).toHaveProperty("inputs");
        expect(ctx).toHaveProperty("ta");
        expect(ctx).toHaveProperty("plot");
        expect(ctx).toHaveProperty("hline");
        expect(ctx).toHaveProperty("alert");
    });

    it("bar field shares identity with state.mainStream.bar", () => {
        const state = freshState();
        const ctx = buildComputeContext(state);
        expect(ctx.bar).toBe(state.mainStream.bar);
    });

    it("inputs is a frozen empty object", () => {
        const state = freshState();
        const ctx = buildComputeContext(state);
        expect(Object.isFrozen(ctx.inputs)).toBe(true);
        expect(Object.keys(ctx.inputs)).toEqual([]);
    });

    it("inputs identity is stable across calls (module-scoped constant)", () => {
        const ctx1 = buildComputeContext(freshState());
        const ctx2 = buildComputeContext(freshState());
        expect(ctx1.inputs).toBe(ctx2.inputs);
    });

    it("ta is the real runtime impl on the ComputeContext (Task 7 wired)", () => {
        // Post-Task 7 ctx.ta points at TA_REGISTRY. Calling a primitive
        // outside an active script step throws the outside-ctx sentinel.
        const state = freshState();
        const ctx = buildComputeContext(state);
        expect(() => ctx.ta.ema(state.mainStream.seriesViews.close, 20)).toThrow(
            "ta.ema called outside an active script step",
        );
    });

    it("plot / hline / alert are the Task-8 emit re-exports and throw the outside-ctx sentinel when called directly", () => {
        // Post-Task-8 the runtime's `plot` / `hline` / `alert` are real
        // emit impls. Calling them directly (no compiler-injected slot
        // id; no `ACTIVE_RUNTIME_CONTEXT.current`) throws the sentinel.
        const state = freshState();
        const ctx = buildComputeContext(state);
        expect(() => ctx.plot(0)).toThrow("plot called outside an active script step");
        expect(() => ctx.hline(0)).toThrow("hline called outside an active script step");
        expect(() => ctx.alert("hi")).toThrow("alert called outside an active script step");
    });
});

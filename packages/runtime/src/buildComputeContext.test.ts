// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { DRAWING_KINDS, KIND_CAMELCASE } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { buildComputeContext } from "./buildComputeContext";
import type { RunnerState } from "./createScriptRunner";
import type { MutableRunnerEmissions } from "./runtimeContext";
import { inMemoryStateStore } from "./stateStore";
import { createStreamState } from "./streamState";
import { createRuntimeViews, makeBarStateView, makeSymInfoView, makeTimeframeView } from "./views";

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
            drawingSlots: new Map(),
            drawingSubIdCounters: new Map(),
            drawingBucketCounters: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
            scriptMaxDrawings: null,
            stateSlots: new Map(),
            requestSecurityBars: new Map(),
            diagnosedRequestKeys: new Set(),
            resolvedInputs: Object.freeze({ length: 14 }),
            diagnosedInputKeys: new Set(),
            views: createRuntimeViews({
                syminfo: makeSymInfoView({ ticker: "DEMO" }, new Set(["ticker"])),
            }),
        },
        emissions,
        barIndex: 0,
    };
    return state;
}

describe("buildComputeContext", () => {
    it("returns an object with bar / inputs / ta / plot / hline / alert / draw / state / request / views", () => {
        const state = freshState();
        const ctx = buildComputeContext(state);
        expect(ctx).toHaveProperty("bar");
        expect(ctx).toHaveProperty("inputs");
        expect(ctx).toHaveProperty("ta");
        expect(ctx).toHaveProperty("plot");
        expect(ctx).toHaveProperty("hline");
        expect(ctx).toHaveProperty("alert");
        expect(ctx).toHaveProperty("draw");
        expect(ctx).toHaveProperty("state");
        expect(ctx).toHaveProperty("request");
        expect(ctx).toHaveProperty("barstate");
        expect(ctx).toHaveProperty("syminfo");
        expect(ctx).toHaveProperty("timeframe");
    });

    it("bar field shares identity with state.mainStream.bar", () => {
        const state = freshState();
        const ctx = buildComputeContext(state);
        expect(ctx.bar).toBe(state.mainStream.bar);
    });

    it("inputs is the frozen resolved input bag", () => {
        const state = freshState();
        const ctx = buildComputeContext(state);
        expect(Object.isFrozen(ctx.inputs)).toBe(true);
        expect(ctx.inputs).toEqual({ length: 14 });
        expect(ctx.inputs).toBe(state.runtimeContext.resolvedInputs);
    });

    it("inputs identity follows the runner context", () => {
        const state = freshState();
        const ctx1 = buildComputeContext(state);
        const ctx2 = buildComputeContext(state);
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

    it("state is the Task-9 runtime namespace and throws outside the active context", () => {
        const state = freshState();
        const ctx = buildComputeContext(state);
        expect(() => ctx.state.float(0)).toThrow(
            "state.float called outside an active script step",
        );
    });

    it("request is the Task-11 runtime namespace and throws outside the active context", () => {
        const state = freshState();
        const ctx = buildComputeContext(state);
        expect(() => ctx.request.security({ interval: "1D" })).toThrow(
            "request.security called outside an active script step",
        );
    });

    it("wires runtime views by identity", () => {
        const state = freshState();
        state.runtimeContext.views.barstate = makeBarStateView({
            eventKind: "close",
            barIndex: 3,
            isLastBar: true,
        });
        state.runtimeContext.views.timeframe = makeTimeframeView("1D", {
            value: "1D",
            label: "1 day",
            group: "daily",
        });
        const ctx = buildComputeContext(state);
        expect(ctx.barstate).toBe(state.runtimeContext.views.barstate);
        expect(ctx.syminfo).toBe(state.runtimeContext.views.syminfo);
        expect(ctx.timeframe).toBe(state.runtimeContext.views.timeframe);
        expect(ctx.syminfo.ticker).toBe("DEMO");
        expect(ctx.timeframe.inSeconds).toBe(86_400);
    });

    it("draw exposes a runtime impl for every DrawingKind (no core stubs after Task 18)", () => {
        // Phase-3 cardinality gate: after Task 18 the runtime
        // `DRAW_NAMESPACE` carries a real impl for every one of the 61
        // `DrawingKind`s, so every flat method on `ctx.draw` throws the
        // runtime sentinel (`"called outside an active script step"`)
        // when called bare — none falls through to the core stub.
        const state = freshState();
        const ctx = buildComputeContext(state);
        expect(DRAWING_KINDS.length).toBe(61);
        for (const kind of DRAWING_KINDS) {
            const camel = KIND_CAMELCASE.get(kind);
            if (camel === undefined) throw new Error(`missing camel mapping for ${kind}`);
            const method = (ctx.draw as unknown as Record<string, () => unknown>)[camel];
            expect(typeof method).toBe("function");
            expect(() => method()).toThrow(
                new RegExp(`^draw\\.${camel} called outside an active script step$`),
            );
        }
    });
});

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { DRAWING_KINDS, KIND_CAMELCASE } from "@invinite-org/chartlang-core";
import { afterEach, describe, expect, it } from "vitest";

import {
    ACTIVE_RUNTIME_CONTEXT,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../../runtimeContext";
import { createStreamState } from "../../streamState";
import { inMemoryStateStore } from "../../stateStore";
import { DRAW_NAMESPACE } from "./namespace";

function makeCaps(): Capabilities {
    return {
        plots: capabilities.allLines(),
        // Tasks 5–10 cover lines + box + curve + freehand + annotations +
        // channels; Tasks 11 + 12 cover all 10 fib kinds via
        // `allFibDrawings()`; Task 13 covers the 4 gann kinds via
        // `allGannDrawings()`; Task 14 covers the 2 pitchfork kinds via
        // `allPitchforkDrawings()`; Task 15 covers the 6 harmonic
        // pattern kinds via `allPatternDrawings()`; Task 16 covers the
        // 5 elliott kinds via `allElliottDrawings()`; Task 17 covers the
        // 3 cycle kinds via `allCycleDrawings()`; Task 18 covers the
        // 2 container kinds via `allContainerDrawings()`. Widen the cap
        // set so the namespace test exercises every shipped impl
        // without budget / capability gating noise.
        drawings: new Set([
            ...capabilities.allLineDrawings(),
            ...capabilities.allBoxDrawings(),
            ...capabilities.allCurveDrawings(),
            ...capabilities.allFreehandDrawings(),
            ...capabilities.allAnnotationDrawings(),
            ...capabilities.allChannelDrawings(),
            ...capabilities.allFibDrawings(),
            ...capabilities.allGannDrawings(),
            ...capabilities.allPitchforkDrawings(),
            ...capabilities.allPatternDrawings(),
            ...capabilities.allElliottDrawings(),
            ...capabilities.allCycleDrawings(),
            ...capabilities.allContainerDrawings(),
        ]),
        alerts: new Set(),
        alertConditions: false,
        logs: false,
        inputs: new Set(),
        intervals: [],
        multiTimeframe: false,
        subPanes: 0,
        symInfoFields: new Set(),
        maxDrawingsPerScript: {
            lines: 100,
            labels: 100,
            boxes: 100,
            polylines: 100,
            other: 100,
        },
        maxLookback: 5000,
        maxTickHz: 10,
    };
}

function makeCtx(): { ctx: RuntimeContext; emissions: MutableRunnerEmissions } {
    const emissions: MutableRunnerEmissions = {
        plots: [],
        drawings: [],
        alerts: [],
        diagnostics: [],
        fromBar: 0,
        toBar: 0,
    };
    const stream = createStreamState({ interval: "", capacity: 4, symbol: "" });
    stream.bar.time = 1_700_000_000_000;
    const ctx: RuntimeContext = {
        stream,
        stateStore: inMemoryStateStore(),
        capabilities: makeCaps(),
        emissions,
        barIndex: () => 0,
        isTick: false,
        drawingSlots: new Map(),
        drawingSubIdCounters: new Map(),
        drawingBucketCounters: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        scriptMaxDrawings: null,
        stateSlots: new Map(),
    };
    return { ctx, emissions };
}

afterEach(() => {
    ACTIVE_RUNTIME_CONTEXT.current = null;
});

describe("DRAW_NAMESPACE", () => {
    it("dispatches the 6 Task-5 line-kind names to their runtime impls", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        DRAW_NAMESPACE.line("slot-line", { time: 0, price: 0 }, { time: 1, price: 1 });
        DRAW_NAMESPACE.horizontalLine("slot-hline", 100);
        DRAW_NAMESPACE.horizontalRay("slot-hray", { time: 0, price: 100 });
        DRAW_NAMESPACE.verticalLine("slot-vline", 1_700_000_000_000);
        DRAW_NAMESPACE.crossLine("slot-cross", { time: 0, price: 0 });
        DRAW_NAMESPACE.trendAngle("slot-trend", { time: 0, price: 0 }, { time: 1, price: 1 });
        expect(emissions.drawings.map((d) => d.drawingKind)).toEqual([
            "line",
            "horizontal-line",
            "horizontal-ray",
            "vertical-line",
            "cross-line",
            "trend-angle",
        ]);
    });

    it("dispatches the 4 Task-6 box-A kinds to their runtime impls", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        DRAW_NAMESPACE.rectangle("slot-rect", { time: 0, price: 0 }, { time: 1, price: 1 });
        DRAW_NAMESPACE.rotatedRectangle("slot-rrect", [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 2, price: 0 },
            { time: 1, price: -1 },
        ]);
        DRAW_NAMESPACE.triangle("slot-tri", [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 2, price: 0 },
        ]);
        DRAW_NAMESPACE.polyline("slot-poly", [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 2, price: 0 },
        ]);
        expect(emissions.drawings.map((d) => d.drawingKind)).toEqual([
            "rectangle",
            "rotated-rectangle",
            "triangle",
            "polyline",
        ]);
    });

    it("dispatches the 4 Task-7 box-B kinds to their runtime impls", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        DRAW_NAMESPACE.circle("slot-circle", { time: 0, price: 0 }, { time: 1, price: 0 });
        DRAW_NAMESPACE.ellipse("slot-ellipse", { time: 0, price: 0 }, { time: 2, price: 1 });
        DRAW_NAMESPACE.path("slot-path", [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
        ]);
        DRAW_NAMESPACE.marker("slot-marker", { time: 1, price: 1 });
        expect(emissions.drawings.map((d) => d.drawingKind)).toEqual([
            "circle",
            "ellipse",
            "path",
            "marker",
        ]);
    });

    it("dispatches the 6 Task-8 curve + freehand kinds to their runtime impls", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        DRAW_NAMESPACE.arc("slot-arc", [
            { time: 0, price: 0 },
            { time: 1, price: 2 },
            { time: 2, price: 0 },
        ]);
        DRAW_NAMESPACE.curve("slot-curve", [
            { time: 0, price: 0 },
            { time: 1, price: 2 },
            { time: 2, price: 0 },
        ]);
        DRAW_NAMESPACE.doubleCurve("slot-double", [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 2, price: 0 },
            { time: 3, price: -1 },
            { time: 4, price: 0 },
        ]);
        DRAW_NAMESPACE.pen("slot-pen", [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
        ]);
        DRAW_NAMESPACE.highlighter(
            "slot-hl",
            [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
            ],
            { color: "#facc15", alpha: 0.3 },
        );
        DRAW_NAMESPACE.brush(
            "slot-brush",
            [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
            ],
            { stroke: "#000", fill: "#fff" },
        );
        expect(emissions.drawings.map((d) => d.drawingKind)).toEqual([
            "arc",
            "curve",
            "double-curve",
            "pen",
            "highlighter",
            "brush",
        ]);
    });

    it("dispatches the 5 Task-9 annotation kinds to their runtime impls", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        DRAW_NAMESPACE.text("slot-text", { time: 1, price: 1 }, "Note");
        DRAW_NAMESPACE.arrow("slot-arrow", { time: 0, price: 0 }, { time: 1, price: 1 });
        DRAW_NAMESPACE.arrowMarker("slot-am", { time: 1, price: 1 });
        DRAW_NAMESPACE.arrowMarkUp("slot-amu", { time: 1, price: 1 });
        DRAW_NAMESPACE.arrowMarkDown("slot-amd", { time: 1, price: 1 });
        expect(emissions.drawings.map((d) => d.drawingKind)).toEqual([
            "text",
            "arrow",
            "arrow-marker",
            "arrow-mark-up",
            "arrow-mark-down",
        ]);
    });

    it("dispatches the 4 Task-10 channel kinds to their runtime impls", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        DRAW_NAMESPACE.trendChannel("slot-tc", [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 0, price: 1 },
        ]);
        DRAW_NAMESPACE.flatTopBottom("slot-ftb", [
            { time: 0, price: 1 },
            { time: 1, price: 1 },
            { time: 0, price: 0 },
        ]);
        DRAW_NAMESPACE.disjointChannel("slot-dc", [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 0, price: 2 },
            { time: 1, price: 3 },
        ]);
        DRAW_NAMESPACE.regressionTrend("slot-rt", { time: 0, price: 0 }, { time: 1, price: 1 });
        expect(emissions.drawings.map((d) => d.drawingKind)).toEqual([
            "trend-channel",
            "flat-top-bottom",
            "disjoint-channel",
            "regression-trend",
        ]);
    });

    it("dispatches the 5 Task-11 fib-A kinds to their runtime impls", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        DRAW_NAMESPACE.fibRetracement("slot-fr", { time: 0, price: 0 }, { time: 1, price: 1 });
        DRAW_NAMESPACE.fibTrendExtension("slot-fte", [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 2, price: 0.5 },
        ]);
        DRAW_NAMESPACE.fibChannel("slot-fc", [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 0, price: 1 },
        ]);
        DRAW_NAMESPACE.fibTimeZone("slot-ftz", { time: 0, price: 0 }, { time: 100, price: 0 });
        DRAW_NAMESPACE.fibWedge("slot-fw", [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 1, price: -1 },
        ]);
        expect(emissions.drawings.map((d) => d.drawingKind)).toEqual([
            "fib-retracement",
            "fib-trend-extension",
            "fib-channel",
            "fib-time-zone",
            "fib-wedge",
        ]);
    });

    it("dispatches the 5 Task-12 fib-B kinds to their runtime impls", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        DRAW_NAMESPACE.fibSpeedFan("slot-fsf", { time: 0, price: 0 }, { time: 1, price: 1 });
        DRAW_NAMESPACE.fibSpeedArcs("slot-fsa", { time: 0, price: 0 }, { time: 1, price: 0 });
        DRAW_NAMESPACE.fibSpiral("slot-fs", { time: 0, price: 0 }, { time: 1, price: 0 });
        DRAW_NAMESPACE.fibCircles("slot-fc", { time: 0, price: 0 }, { time: 1, price: 0 });
        DRAW_NAMESPACE.fibTrendTime("slot-ftt", [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 2, price: 0.5 },
        ]);
        expect(emissions.drawings.map((d) => d.drawingKind)).toEqual([
            "fib-speed-fan",
            "fib-speed-arcs",
            "fib-spiral",
            "fib-circles",
            "fib-trend-time",
        ]);
    });

    it("dispatches the 4 Task-13 gann kinds to their runtime impls", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        DRAW_NAMESPACE.gannBox("slot-gb", { time: 0, price: 0 }, { time: 1, price: 1 });
        DRAW_NAMESPACE.gannSquareFixed("slot-gsf", { time: 0, price: 0 });
        DRAW_NAMESPACE.gannSquare("slot-gs", { time: 0, price: 0 }, { time: 1, price: 1 });
        DRAW_NAMESPACE.gannFan("slot-gf", { time: 0, price: 0 }, { time: 1, price: 1 });
        expect(emissions.drawings.map((d) => d.drawingKind)).toEqual([
            "gann-box",
            "gann-square-fixed",
            "gann-square",
            "gann-fan",
        ]);
    });

    it("dispatches the 2 Task-14 pitchfork kinds to their runtime impls", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        DRAW_NAMESPACE.pitchfork("slot-pf", [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 2, price: 0.5 },
        ]);
        DRAW_NAMESPACE.pitchfan("slot-pn", [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 2, price: 0.5 },
        ]);
        expect(emissions.drawings.map((d) => d.drawingKind)).toEqual(["pitchfork", "pitchfan"]);
    });

    it("dispatches the 6 Task-15 harmonic-pattern kinds to their runtime impls", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        DRAW_NAMESPACE.xabcdPattern("slot-xp", [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 2, price: 0.5 },
            { time: 3, price: 1.5 },
            { time: 4, price: 1 },
        ]);
        DRAW_NAMESPACE.cypherPattern("slot-cp", [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 2, price: 0.4 },
            { time: 3, price: 1.3 },
            { time: 4, price: 0.6 },
        ]);
        DRAW_NAMESPACE.headAndShoulders("slot-hs", [
            { time: 0, price: 1 },
            { time: 1, price: 0 },
            { time: 2, price: 2 },
            { time: 3, price: 0 },
            { time: 4, price: 1 },
        ]);
        DRAW_NAMESPACE.abcdPattern("slot-ap", [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 2, price: 0.5 },
            { time: 3, price: 1.5 },
        ]);
        DRAW_NAMESPACE.trianglePattern("slot-tp", [
            { time: 2, price: 0.5 },
            { time: 0, price: 1 },
            { time: 0, price: 0 },
        ]);
        DRAW_NAMESPACE.threeDrivesPattern("slot-td", [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 2, price: 0.5 },
            { time: 3, price: 1.5 },
            { time: 4, price: 1 },
            { time: 5, price: 2 },
            { time: 6, price: 1.5 },
        ]);
        expect(emissions.drawings.map((d) => d.drawingKind)).toEqual([
            "xabcd-pattern",
            "cypher-pattern",
            "head-and-shoulders",
            "abcd-pattern",
            "triangle-pattern",
            "three-drives-pattern",
        ]);
    });

    it("dispatches the 5 Task-16 elliott-wave kinds to their runtime impls", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        DRAW_NAMESPACE.elliottImpulseWave("slot-eiw", [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 2, price: 0.5 },
            { time: 3, price: 1.5 },
            { time: 4, price: 1 },
        ]);
        DRAW_NAMESPACE.elliottCorrectionWave("slot-ecw", [
            { time: 0, price: 1 },
            { time: 1, price: 0 },
            { time: 2, price: 0.5 },
        ]);
        DRAW_NAMESPACE.elliottTriangleWave("slot-etw", [
            { time: 0, price: 1 },
            { time: 1, price: 0 },
            { time: 2, price: 0.8 },
            { time: 3, price: 0.2 },
            { time: 4, price: 0.5 },
        ]);
        DRAW_NAMESPACE.elliottDoubleCombo("slot-edc", [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 2, price: 0.5 },
            { time: 3, price: 1.5 },
            { time: 4, price: 1 },
            { time: 5, price: 2 },
            { time: 6, price: 1.5 },
        ]);
        DRAW_NAMESPACE.elliottTripleCombo("slot-etc", [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 2, price: 0.5 },
            { time: 3, price: 1.5 },
            { time: 4, price: 1 },
            { time: 5, price: 2 },
            { time: 6, price: 1.5 },
        ]);
        expect(emissions.drawings.map((d) => d.drawingKind)).toEqual([
            "elliott-impulse-wave",
            "elliott-correction-wave",
            "elliott-triangle-wave",
            "elliott-double-combo",
            "elliott-triple-combo",
        ]);
    });

    it("dispatches the 3 Task-17 cycle kinds to their runtime impls", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        DRAW_NAMESPACE.cyclicLines("slot-cl", { time: 0, price: 0 }, { time: 100, price: 0 });
        DRAW_NAMESPACE.timeCycles("slot-tc", { time: 0, price: 50 }, { time: 100, price: 50 });
        DRAW_NAMESPACE.sineLine("slot-sl", { time: 0, price: 40 }, { time: 100, price: 60 });
        expect(emissions.drawings.map((d) => d.drawingKind)).toEqual([
            "cyclic-lines",
            "time-cycles",
            "sine-line",
        ]);
    });

    it("dispatches the 2 Task-18 container kinds to their runtime impls", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        DRAW_NAMESPACE.group("slot-g", []);
        DRAW_NAMESPACE.frame("slot-f", { time: 0, price: 0 }, { time: 100, price: 100 });
        expect(emissions.drawings.map((d) => d.drawingKind)).toEqual(["group", "frame"]);
    });

    it("falls through to core's throwing-stub for non-kind property access (defence-in-depth)", () => {
        // After Task 18 every `DrawingKind` is in `KIND_IMPLS` — the
        // `else` branch in the Proxy `get` is unreachable through the
        // `DrawNamespace` type surface. It stays as defence-in-depth
        // for property access outside that type (e.g. JS code reading
        // an arbitrary property via a typed-erased view). Hitting it
        // should fall through to core's throwing-stub Proxy.
        const erased = DRAW_NAMESPACE as unknown as Record<string, () => unknown>;
        expect(() => erased.notARealDrawingKind()).toThrow(
            "draw.notARealDrawingKind called outside compiled runtime",
        );
    });

    it("registers a real runtime impl for every DrawingKind (stub-free after Task 18)", () => {
        // Phase-3 cardinality gate: after Task 18 the runtime
        // `DRAW_NAMESPACE` carries a real impl for every one of the 61
        // `DrawingKind`s. Calling each method through the Proxy with no
        // active runtime context must throw the runtime sentinel
        // (`"called outside an active script step"`) — NOT the core
        // stub sentinel (`"called outside compiled runtime"`) — which
        // would signal a fall-through to the core throwing-stub Proxy
        // and a missing impl.
        expect(DRAWING_KINDS.length).toBe(61);
        for (const kind of DRAWING_KINDS) {
            const camel = KIND_CAMELCASE.get(kind);
            if (camel === undefined) throw new Error(`missing camel mapping for ${kind}`);
            const method = (DRAW_NAMESPACE as unknown as Record<string, () => unknown>)[camel];
            expect(typeof method).toBe("function");
            // The bare script-facing overload always throws the
            // active-step sentinel when called with insufficient args.
            // A future `DrawingKind` added without a `KIND_IMPLS` entry
            // would fall through to the core stub Proxy and throw the
            // `"called outside compiled runtime"` message instead.
            expect(() => method()).toThrow(
                new RegExp(`^draw\\.${camel} called outside an active script step$`),
            );
        }
    });
});

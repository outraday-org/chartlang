// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { afterEach, describe, expect, it } from "vitest";

import {
    ACTIVE_RUNTIME_CONTEXT,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../runtimeContext.js";
import { createStreamState } from "../streamState.js";
import { inMemoryStateStore } from "../stateStore.js";
import { hline } from "./hline.js";

function makeCaps(overrides: Partial<Capabilities> = {}): Capabilities {
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
        maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        maxLookback: 5000,
        maxTickHz: 10,
        ...overrides,
    };
}

function makeCtx(opts: { caps?: Capabilities; barIndex?: number } = {}): {
    ctx: RuntimeContext;
    emissions: MutableRunnerEmissions;
} {
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
        capabilities: opts.caps ?? makeCaps(),
        emissions,
        barIndex: () => opts.barIndex ?? 5,
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

describe("hline — happy path", () => {
    it("pushes one PlotEmission with kind 'horizontal-line'", () => {
        const { ctx, emissions } = makeCtx({ barIndex: 3 });
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        hline("a:1:1#0", 70);
        expect(emissions.plots).toHaveLength(1);
        const e = emissions.plots[0];
        expect(e.style.kind).toBe("horizontal-line");
        expect(e.value).toBe(70);
        expect(e.pane).toBe("overlay");
        expect(e.bar).toBe(3);
    });

    it("applies opts (color, title, lineWidth, lineStyle)", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        hline("a:1:1#0", 30, {
            color: "#ef4444",
            title: "Stop",
            lineWidth: 2,
            lineStyle: "dashed",
        });
        const e = emissions.plots[0];
        expect(e.color).toBe("#ef4444");
        expect(e.title).toBe("Stop");
        expect(e.style.lineWidth).toBe(2);
        expect(e.style.lineStyle).toBe("dashed");
    });
});

describe("hline — NaN handling", () => {
    it("emits value: null for NaN price", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        hline("a:1:1#0", Number.NaN);
        expect(emissions.plots[0].value).toBeNull();
    });

    it("emits value: null for Infinity", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        hline("a:1:1#0", Number.POSITIVE_INFINITY);
        expect(emissions.plots[0].value).toBeNull();
    });
});

describe("hline — capability gating", () => {
    it("drops + diagnoses unsupported-plot-kind when capabilities.plots lacks 'horizontal-line'", () => {
        const caps = makeCaps({ plots: capabilities.line() });
        const { ctx, emissions } = makeCtx({ caps });
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        hline("a:1:1#0", 70);
        expect(emissions.plots).toEqual([]);
        expect(emissions.diagnostics).toHaveLength(1);
        expect(emissions.diagnostics[0].code).toBe("unsupported-plot-kind");
        expect(emissions.diagnostics[0].message).toContain("horizontal-line");
    });
});

describe("hline — dedup", () => {
    it("two hlines on the same (slotId, bar) — second wins", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        hline("a:1:1#0", 70);
        hline("a:1:1#0", 30);
        expect(emissions.plots).toHaveLength(1);
        expect(emissions.plots[0].value).toBe(30);
    });
});

describe("hline — outside context", () => {
    it("throws sentinel when ACTIVE_RUNTIME_CONTEXT.current is null", () => {
        expect(() => hline("a:1:1#0", 70)).toThrow("hline called outside an active script step");
    });

    it("throws sentinel when called without a slot id (direct script-author invocation)", () => {
        const { ctx } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        expect(() => hline(70)).toThrow("hline called outside an active script step");
    });

    it("throws sentinel when slotId is provided but price is not a number", () => {
        const { ctx } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        expect(() => hline("a:1:1#0", { color: "#fff" } as never)).toThrow(
            "hline called outside an active script step",
        );
    });
});

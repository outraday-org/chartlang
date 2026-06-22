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
import { inMemoryStateStore } from "../stateStore.js";
import { createStreamState } from "../streamState.js";
import { bgcolor } from "./bgcolor.js";
import { plot } from "./plot.js";

function makeCaps(overrides: Partial<Capabilities> = {}): Capabilities {
    return {
        plots: capabilities.allPhase5Plots(),
        drawings: new Set(),
        alerts: new Set(),
        alertConditions: false,
        logs: false,
        inputs: new Set(),
        intervals: [],
        multiTimeframe: false,
        multiSymbol: false,
        subPanes: 0,
        symInfoFields: new Set(),
        maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        maxLookback: 5000,
        maxTickHz: 10,
        ...overrides,
    };
}

function makeCtx(caps: Capabilities = makeCaps()): {
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
        capabilities: caps,
        emissions,
        barIndex: () => 5,
        isTick: false,
        drawingSlots: new Map(),
        drawingSubIdCounters: new Map(),
        drawingBucketCounters: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        scriptMaxDrawings: null,
        stateSlots: new Map(),
        defaultPane: "overlay",
        scriptPane: "script:test",
        plotOverrides: {},
    };
    return { ctx, emissions };
}

afterEach(() => {
    ACTIVE_RUNTIME_CONTEXT.current = null;
});

describe("bgcolor — emission shape vs verbose plot(NaN, { style })", () => {
    it("matches the verbose form on every field but adds the dynamic colorValue", () => {
        const aliased = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = aliased.ctx;
        bgcolor("a:1:1#0", "#1d4ed8", { transp: 80 });

        const verbose = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = verbose.ctx;
        plot("a:1:1#0", Number.NaN, {
            style: { kind: "bg-color", color: "#1d4ed8", transp: 80 },
        });

        expect(aliased.emissions.plots).toHaveLength(1);
        const e = aliased.emissions.plots[0];
        // The Deliverable-1 fields are identical; Deliverable-2 additionally
        // routes the per-bar color through the dynamic `colorValue` channel.
        expect({ ...e, colorValue: undefined }).toEqual({
            ...verbose.emissions.plots[0],
            colorValue: undefined,
        });
        expect("colorValue" in verbose.emissions.plots[0]).toBe(false);
        expect(e.colorValue).toBe("#1d4ed8");
        expect(e.style).toEqual({ kind: "bg-color", color: "#1d4ed8", transp: 80 });
        expect(e.value).toBeNull();
        expect(e.color).toBeNull();
        expect(e.slotId).toBe("a:1:1#0");
        expect(aliased.emissions.diagnostics).toEqual([]);
    });

    it("omits transp when absent (matches the verbose no-transp form)", () => {
        const aliased = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = aliased.ctx;
        bgcolor("a:1:1#0", "#1d4ed8");

        const verbose = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = verbose.ctx;
        plot("a:1:1#0", Number.NaN, { style: { kind: "bg-color", color: "#1d4ed8" } });

        const e = aliased.emissions.plots[0];
        expect({ ...e, colorValue: undefined }).toEqual({
            ...verbose.emissions.plots[0],
            colorValue: undefined,
        });
        expect("transp" in e.style).toBe(false);
    });

    it("carries a literal title through to the emission", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        bgcolor("a:1:1#0", "#1d4ed8", { transp: 80, title: "Heat" });
        expect(emissions.plots[0].title).toBe("Heat");
    });
});

describe("bgcolor — per-bar dynamic colorValue", () => {
    it("carries the per-bar color through colorValue as the condition flips", () => {
        const colors = ["#16a34a", "#dc2626", "#16a34a"];
        const seen: Array<string | null | undefined> = [];
        for (const color of colors) {
            const { ctx, emissions } = makeCtx();
            ACTIVE_RUNTIME_CONTEXT.current = ctx;
            bgcolor("a:1:1#0", color, { transp: 80 });
            const e = emissions.plots[0];
            // The static style mirrors the color too (older-adapter fallback);
            // the live per-bar color is the dynamic colorValue.
            expect(e.style).toEqual({ kind: "bg-color", color, transp: 80 });
            seen.push(e.colorValue);
        }
        expect(seen).toEqual(["#16a34a", "#dc2626", "#16a34a"]);
    });

    it("drops the emission as malformed when the color is an empty string", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        bgcolor("a:1:1#0", "", { transp: 80 });
        // The alias mirrors the color onto the static `style.color`, so an empty
        // color fails the style validator and the whole emission is dropped with
        // `malformed-emission` — never a throw, and no partial colorValue wire.
        expect(emissions.plots).toHaveLength(0);
        expect(emissions.diagnostics).toHaveLength(1);
        expect(emissions.diagnostics[0].code).toBe("malformed-emission");
    });

    it("collapses two writes at the same (slotId, bar) to the last colorValue", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        bgcolor("a:1:1#0", "#16a34a");
        bgcolor("a:1:1#0", "#dc2626");
        expect(emissions.plots).toHaveLength(1);
        expect(emissions.plots[0].colorValue).toBe("#dc2626");
    });
});

describe("bgcolor — capability gate", () => {
    it("drops with unsupported-plot-kind when bg-color is withheld", () => {
        const { ctx, emissions } = makeCtx(makeCaps({ plots: capabilities.allLines() }));
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        bgcolor("a:1:1#0", "#1d4ed8");
        expect(emissions.plots).toHaveLength(0);
        expect(emissions.diagnostics).toHaveLength(1);
        expect(emissions.diagnostics[0].code).toBe("unsupported-plot-kind");
    });
});

describe("bgcolor — overload seam", () => {
    it("throws the sentinel for the bare script-facing call (no slotId)", () => {
        expect(() => bgcolor("#000")).toThrow("bgcolor called outside an active script step");
    });

    it("throws the sentinel for a non-string first argument", () => {
        // Covers the `typeof arg1 !== "string"` branch — unreachable through
        // the typed surface (color is a string), reachable from malformed JS.
        expect(() => bgcolor(0 as never)).toThrow(
            "bgcolor called outside an active script step",
        );
    });

    it("throws the sentinel for the bare call with an opts bag", () => {
        // Both args present but arg2 is not a color string ⇒ script-facing form.
        expect(() => bgcolor("#000", { transp: 50 })).toThrow(
            "bgcolor called outside an active script step",
        );
    });

    it("throws the sentinel when the active context is null", () => {
        ACTIVE_RUNTIME_CONTEXT.current = null;
        expect(() => bgcolor("a:1:1#0", "#000")).toThrow(
            "bgcolor called outside an active script step",
        );
    });
});

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
import { barcolor } from "./barcolor.js";
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

describe("barcolor — emission shape vs verbose plot(NaN, { style })", () => {
    it("matches the verbose form on every field but adds the dynamic colorValue", () => {
        const aliased = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = aliased.ctx;
        barcolor("a:1:1#0", "#a855f7");

        const verbose = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = verbose.ctx;
        plot("a:1:1#0", Number.NaN, { style: { kind: "bar-color", color: "#a855f7" } });

        expect(aliased.emissions.plots).toHaveLength(1);
        const e = aliased.emissions.plots[0];
        expect({ ...e, colorValue: undefined }).toEqual({
            ...verbose.emissions.plots[0],
            colorValue: undefined,
        });
        expect("colorValue" in verbose.emissions.plots[0]).toBe(false);
        expect(e.colorValue).toBe("#a855f7");
        expect(e.style).toEqual({ kind: "bar-color", color: "#a855f7" });
        expect(e.value).toBeNull();
        expect(e.color).toBeNull();
        expect(e.slotId).toBe("a:1:1#0");
        expect(aliased.emissions.diagnostics).toEqual([]);
    });

    it("carries a literal title through to the emission", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        barcolor("a:1:1#0", "#a855f7", { title: "Trend tint" });
        expect(emissions.plots[0].title).toBe("Trend tint");
    });
});

describe("barcolor — per-bar dynamic colorValue", () => {
    it("carries the per-bar color through colorValue as the condition flips", () => {
        const colors = ["#16a34a", "#dc2626", "#16a34a"];
        const seen: Array<string | null | undefined> = [];
        for (const color of colors) {
            const { ctx, emissions } = makeCtx();
            ACTIVE_RUNTIME_CONTEXT.current = ctx;
            barcolor("a:1:1#0", color);
            const e = emissions.plots[0];
            expect(e.style).toEqual({ kind: "bar-color", color });
            seen.push(e.colorValue);
        }
        expect(seen).toEqual(["#16a34a", "#dc2626", "#16a34a"]);
    });

    it("drops the emission as malformed when the color is an empty string", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        barcolor("a:1:1#0", "");
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
        barcolor("a:1:1#0", "#16a34a");
        barcolor("a:1:1#0", "#dc2626");
        expect(emissions.plots).toHaveLength(1);
        expect(emissions.plots[0].colorValue).toBe("#dc2626");
    });
});

describe("barcolor — capability gate", () => {
    it("drops with unsupported-plot-kind when bar-color is withheld", () => {
        const { ctx, emissions } = makeCtx(makeCaps({ plots: capabilities.allLines() }));
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        barcolor("a:1:1#0", "#a855f7");
        expect(emissions.plots).toHaveLength(0);
        expect(emissions.diagnostics).toHaveLength(1);
        expect(emissions.diagnostics[0].code).toBe("unsupported-plot-kind");
    });
});

describe("barcolor — overload seam", () => {
    it("throws the sentinel for the bare script-facing call (no slotId)", () => {
        expect(() => barcolor("#000")).toThrow("barcolor called outside an active script step");
    });

    it("throws the sentinel for a non-string first argument", () => {
        // Covers the `typeof arg1 !== "string"` branch — unreachable through
        // the typed surface (color is a string), reachable from malformed JS.
        expect(() => barcolor(0 as never)).toThrow("barcolor called outside an active script step");
    });

    it("throws the sentinel for the bare call with an opts bag", () => {
        expect(() => barcolor("#000", { title: "x" })).toThrow(
            "barcolor called outside an active script step",
        );
    });

    it("throws the sentinel when the active context is null", () => {
        ACTIVE_RUNTIME_CONTEXT.current = null;
        expect(() => barcolor("a:1:1#0", "#000")).toThrow(
            "barcolor called outside an active script step",
        );
    });
});

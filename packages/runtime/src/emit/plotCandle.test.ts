// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities, validateEmission } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities, PlotEmission, PlotKind } from "@invinite-org/chartlang-adapter-kit";
import { afterEach, describe, expect, it } from "vitest";

import {
    ACTIVE_RUNTIME_CONTEXT,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../runtimeContext.js";
import { inMemoryStateStore } from "../stateStore.js";
import { createStreamState } from "../streamState.js";
import { plotbar, plotcandle } from "./plotCandle.js";

const CANDLE_PLOT_KINDS: ReadonlyArray<PlotKind> = ["candle", "ohlc-bar"];

function makeCaps(overrides: Partial<Capabilities> = {}): Capabilities {
    return {
        plots: new Set<PlotKind>([...capabilities.allPhase5Plots(), ...CANDLE_PLOT_KINDS]),
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

describe("plotcandle — candle emission", () => {
    it("emits one candle emission with the resolved OHLC quad + default colors", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plotcandle("a:1:1#0", 10, 12, 9, 11);

        expect(emissions.plots).toHaveLength(1);
        expect(emissions.diagnostics).toEqual([]);
        const e = emissions.plots[0];
        expect(e.style).toEqual({
            kind: "candle",
            open: 10,
            high: 12,
            low: 9,
            close: 11,
            bull: "#26a69a",
            bear: "#ef5350",
        });
        // `value` is the single-channel resolved close (the conformance hash).
        expect(e.value).toBe(11);
        expect(e.color).toBeNull();
        expect(e.title).toBe("");
        expect(e.pane).toBe("overlay");
        expect(e.slotId).toBe("a:1:1#0");
        expect(e.bar).toBe(5);
        expect(e.time).toBe(1_700_000_000_000);
    });

    it("honors author colors + spreads doji / wickColor / borderColor when present", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plotcandle("a:1:1#0", 10, 12, 9, 11, {
            bull: "#0f0",
            bear: "#f00",
            doji: "#999",
            wickColor: "#333",
            borderColor: "#111",
        });
        expect(emissions.plots[0].style).toEqual({
            kind: "candle",
            open: 10,
            high: 12,
            low: 9,
            close: 11,
            bull: "#0f0",
            bear: "#f00",
            doji: "#999",
            wickColor: "#333",
            borderColor: "#111",
        });
    });

    it("resolves a non-finite source to null (all-null quad ⇒ a legit gap bar)", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plotcandle("a:1:1#0", Number.NaN, Number.NaN, Number.NaN, Number.NaN);
        expect(emissions.plots).toHaveLength(1);
        expect(emissions.diagnostics).toEqual([]);
        const e = emissions.plots[0];
        expect(e.style).toEqual({
            kind: "candle",
            open: null,
            high: null,
            low: null,
            close: null,
            bull: "#26a69a",
            bear: "#ef5350",
        });
        expect(e.value).toBeNull();
    });

    it("drops a partial (mixed finite / null) quad as malformed-emission", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plotcandle("a:1:1#0", 10, Number.NaN, 9, 11);
        expect(emissions.plots).toHaveLength(0);
        expect(emissions.diagnostics).toHaveLength(1);
        expect(emissions.diagnostics[0].code).toBe("malformed-emission");
    });

    it("reads Series<number> sources via series.current", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const series = { current: 7 } as never;
        plotcandle("a:1:1#0", series, series, series, series);
        expect(emissions.plots[0].style).toMatchObject({
            open: 7,
            high: 7,
            low: 7,
            close: 7,
        });
    });

    it("threads title / z / visible / pane through the emission", () => {
        const { ctx, emissions } = makeCtx(makeCaps({ subPanes: 4 }));
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plotcandle("a:1:1#0", 10, 12, 9, 11, {
            title: "HA",
            z: 2,
            visible: false,
            pane: "new",
        });
        const e = emissions.plots[0];
        expect(e.title).toBe("HA");
        expect(e.z).toBe(2);
        expect(e.visible).toBe(false);
        expect(e.pane).toBe("script:test");
    });
});

describe("plotbar — ohlc-bar emission", () => {
    it("emits an ohlc-bar with the up (close ≥ open) default color", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plotbar("a:1:1#0", 10, 12, 9, 11);
        expect(emissions.plots).toHaveLength(1);
        expect(emissions.plots[0].style).toEqual({
            kind: "ohlc-bar",
            open: 10,
            high: 12,
            low: 9,
            close: 11,
            color: "#26a69a",
        });
        expect(emissions.plots[0].value).toBe(11);
    });

    it("selects the down default color when close < open", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plotbar("a:1:1#0", 12, 13, 8, 9);
        expect(emissions.plots[0].style).toMatchObject({ color: "#ef5350" });
    });

    it("treats a fully-null bar as up (gap; color irrelevant, emission is a gap)", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plotbar("a:1:1#0", Number.NaN, Number.NaN, Number.NaN, Number.NaN);
        expect(emissions.plots).toHaveLength(1);
        expect(emissions.plots[0].style).toEqual({
            kind: "ohlc-bar",
            open: null,
            high: null,
            low: null,
            close: null,
            color: "#26a69a",
        });
    });

    it("drops a partial quad (open null, close finite) as malformed-emission", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plotbar("a:1:1#0", Number.NaN, 12, 9, 11);
        expect(emissions.plots).toHaveLength(0);
        expect(emissions.diagnostics[0].code).toBe("malformed-emission");
    });

    it("selects upColor / downColor by close ≥ open when provided", () => {
        const upRun = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = upRun.ctx;
        plotbar("a:1:1#0", 10, 12, 9, 11, { upColor: "#0f0", downColor: "#f00" });
        expect(upRun.emissions.plots[0].style).toEqual({
            kind: "ohlc-bar",
            open: 10,
            high: 12,
            low: 9,
            close: 11,
            color: "#0f0",
            upColor: "#0f0",
            downColor: "#f00",
        });

        const downRun = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = downRun.ctx;
        plotbar("a:1:1#0", 12, 13, 8, 9, { upColor: "#0f0", downColor: "#f00" });
        expect(downRun.emissions.plots[0].style).toMatchObject({
            color: "#f00",
            upColor: "#0f0",
            downColor: "#f00",
        });
    });

    it("falls back to opts.color when the up/down pair is absent", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plotbar("a:1:1#0", 12, 13, 8, 9, { color: "#abc" });
        expect(emissions.plots[0].style).toEqual({
            kind: "ohlc-bar",
            open: 12,
            high: 13,
            low: 8,
            close: 9,
            color: "#abc",
        });
    });

    it("falls back to opts.color on an up bar when upColor is absent", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plotbar("a:1:1#0", 10, 12, 9, 11, { color: "#abc" });
        expect(emissions.plots[0].style).toMatchObject({ color: "#abc" });
    });

    it("selects the up color as upColor before opts.color", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plotbar("a:1:1#0", 10, 12, 9, 11, { upColor: "#0f0", color: "#abc" });
        expect(emissions.plots[0].style).toMatchObject({ color: "#0f0", upColor: "#0f0" });
    });

    it("threads title / z / visible / pane through the emission", () => {
        const { ctx, emissions } = makeCtx(makeCaps({ subPanes: 4 }));
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plotbar("a:1:1#0", 10, 12, 9, 11, { title: "Bars", z: -1, visible: false, pane: "new" });
        const e = emissions.plots[0];
        expect(e.title).toBe("Bars");
        expect(e.z).toBe(-1);
        expect(e.visible).toBe(false);
        expect(e.pane).toBe("script:test");
    });
});

describe("plotcandle / plotbar — capability gate", () => {
    it("drops plotcandle with unsupported-plot-kind when candle is withheld", () => {
        const { ctx, emissions } = makeCtx(makeCaps({ plots: capabilities.allPhase5Plots() }));
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plotcandle("a:1:1#0", 10, 12, 9, 11);
        expect(emissions.plots).toHaveLength(0);
        expect(emissions.diagnostics).toHaveLength(1);
        expect(emissions.diagnostics[0].code).toBe("unsupported-plot-kind");
    });

    it("drops plotbar with unsupported-plot-kind when ohlc-bar is withheld", () => {
        const { ctx, emissions } = makeCtx(makeCaps({ plots: capabilities.allPhase5Plots() }));
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plotbar("a:1:1#0", 10, 12, 9, 11);
        expect(emissions.plots).toHaveLength(0);
        expect(emissions.diagnostics).toHaveLength(1);
        expect(emissions.diagnostics[0].code).toBe("unsupported-plot-kind");
    });
});

describe("plotcandle / plotbar — tick parity (no bespoke tick branch)", () => {
    it("collapses a tick-then-close sequence to one emission at (slotId, bar)", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        // A tick emit followed by the close emit at the same (slotId, bar):
        // the impl adds no tick branch, so pushPlot's last-write-wins dedup
        // reconciles exactly like a plain plot() would.
        ctx.isTick = true;
        plotcandle("a:1:1#0", 10, 12, 9, 10.5);
        ctx.isTick = false;
        plotcandle("a:1:1#0", 10, 12, 9, 11);
        expect(emissions.plots).toHaveLength(1);
        expect(emissions.plots[0].style).toMatchObject({ close: 11 });
    });
});

describe("plotcandle / plotbar — validation round-trip", () => {
    it("validateEmission accepts a well-formed emitted candle style", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plotcandle("a:1:1#0", 10, 12, 9, 11);
        expect(validateEmission(emissions.plots[0])).toEqual({ ok: true });
    });

    it("validateEmission rejects a hand-crafted mixed-null candle quad", () => {
        const emission: PlotEmission = {
            kind: "plot",
            slotId: "a:1:1#0",
            title: "",
            style: {
                kind: "candle",
                open: 10,
                high: null,
                low: 9,
                close: 11,
                bull: "#26a69a",
                bear: "#ef5350",
            },
            bar: 5,
            time: 1_700_000_000_000,
            value: 11,
            color: null,
            meta: {},
            pane: "overlay",
        };
        const result = validateEmission(emission);
        expect(result.ok).toBe(false);
    });
});

describe("plotcandle / plotbar — overload seam", () => {
    it("throws the sentinel for the bare script-facing plotcandle call", () => {
        expect(() => plotcandle(10, 12, 9, 11)).toThrow(
            "plotcandle called outside an active script step",
        );
    });

    it("throws the sentinel for the bare script-facing plotbar call", () => {
        expect(() => plotbar(10, 12, 9, 11)).toThrow(
            "plotbar called outside an active script step",
        );
    });

    it("throws when the close argument is not a number/series (malformed JS)", () => {
        expect(() => plotcandle("a:1:1#0", 10, 12, 9, {} as never)).toThrow(
            "plotcandle called outside an active script step",
        );
        expect(() => plotbar("a:1:1#0", 10, 12, 9, {} as never)).toThrow(
            "plotbar called outside an active script step",
        );
    });

    it("throws when the active context is null", () => {
        ACTIVE_RUNTIME_CONTEXT.current = null;
        expect(() => plotcandle("a:1:1#0", 10, 12, 9, 11)).toThrow(
            "plotcandle called outside an active script step",
        );
        expect(() => plotbar("a:1:1#0", 10, 12, 9, 11)).toThrow(
            "plotbar called outside an active script step",
        );
    });
});

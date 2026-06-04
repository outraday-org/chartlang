// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Series } from "@invinite-org/chartlang-core";
import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { afterEach, describe, expect, it } from "vitest";

import {
    ACTIVE_RUNTIME_CONTEXT,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../runtimeContext";
import { createStreamState } from "../streamState";
import { inMemoryStateStore } from "../stateStore";
import { plot } from "./plot";

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

function makeCtx(opts: { caps?: Capabilities; barIndex?: number; barTime?: number } = {}): {
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
    stream.bar.time = opts.barTime ?? 1_700_000_000_000;
    const ctx: RuntimeContext = {
        stream,
        stateStore: inMemoryStateStore(),
        capabilities: opts.caps ?? makeCaps(),
        emissions,
        barIndex: () => opts.barIndex ?? 5,
        isTick: false,
    };
    return { ctx, emissions };
}

function fakeSeries(value: number): Series<number> {
    const stub = {
        get current() {
            return value;
        },
        get length() {
            return 1;
        },
    };
    return stub as Series<number>;
}

afterEach(() => {
    ACTIVE_RUNTIME_CONTEXT.current = null;
});

describe("plot — happy path", () => {
    it("pushes one PlotEmission with the expected fields (numeric value)", () => {
        const { ctx, emissions } = makeCtx({ barIndex: 3, barTime: 1_700_000_060_000 });
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", 42);
        expect(emissions.plots).toHaveLength(1);
        const e = emissions.plots[0];
        expect(e.kind).toBe("plot");
        expect(e.slotId).toBe("a:1:1#0");
        expect(e.value).toBe(42);
        expect(e.bar).toBe(3);
        expect(e.time).toBe(1_700_000_060_000);
        expect(e.style.kind).toBe("line");
        expect(e.pane).toBe("overlay");
        expect(e.color).toBeNull();
        expect(e.meta).toEqual({});
        expect(e.title).toBe("");
        expect(emissions.diagnostics).toEqual([]);
    });

    it("reads .current when passed a Series<number>", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", fakeSeries(7.5));
        expect(emissions.plots[0].value).toBe(7.5);
    });

    it("applies opts (color, title, lineWidth, lineStyle)", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", 1, {
            color: "#3b82f6",
            title: "EMA",
            lineWidth: 2,
            lineStyle: "dashed",
        });
        const e = emissions.plots[0];
        expect(e.color).toBe("#3b82f6");
        expect(e.title).toBe("EMA");
        expect(e.style.lineWidth).toBe(2);
        expect(e.style.lineStyle).toBe("dashed");
    });
});

describe("plot — NaN handling", () => {
    it("emits value: null for non-finite numeric value", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", Number.NaN);
        expect(emissions.plots).toHaveLength(1);
        expect(emissions.plots[0].value).toBeNull();
    });

    it("emits value: null when Series.current is NaN", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", fakeSeries(Number.NaN));
        expect(emissions.plots[0].value).toBeNull();
    });

    it("emits value: null for Infinity", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", Number.POSITIVE_INFINITY);
        expect(emissions.plots[0].value).toBeNull();
    });
});

describe("plot — capability gating", () => {
    it("drops + diagnoses unsupported-plot-kind when capabilities.plots lacks 'line'", () => {
        const caps = makeCaps({ plots: capabilities.horizontalLine() });
        const { ctx, emissions } = makeCtx({ caps });
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", 1);
        expect(emissions.plots).toEqual([]);
        expect(emissions.diagnostics).toHaveLength(1);
        expect(emissions.diagnostics[0].code).toBe("unsupported-plot-kind");
        expect(emissions.diagnostics[0].slotId).toBe("a:1:1#0");
    });

    it("emits an unsupported-pane diagnostic when opts.pane is non-overlay", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", 1, { pane: "new" });
        expect(emissions.plots).toHaveLength(1);
        expect(emissions.plots[0].pane).toBe("overlay");
        expect(emissions.diagnostics).toHaveLength(1);
        expect(emissions.diagnostics[0].code).toBe("unsupported-pane");
    });
});

describe("plot — dedup", () => {
    it("two plots on the same (slotId, bar) — second wins", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", 1);
        plot("a:1:1#0", 2);
        expect(emissions.plots).toHaveLength(1);
        expect(emissions.plots[0].value).toBe(2);
    });
});

describe("plot — outside context", () => {
    it("throws sentinel when ACTIVE_RUNTIME_CONTEXT.current is null", () => {
        expect(() => plot("a:1:1#0", 1)).toThrow("plot called outside an active script step");
    });

    it("throws sentinel when called without a slot id (direct script-author invocation)", () => {
        const { ctx } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        expect(() => plot(1)).toThrow("plot called outside an active script step");
    });

    it("throws sentinel when slotId is provided but value is not number|Series", () => {
        const { ctx } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        // Three-arg shape with non-numeric value — the compiler would
        // never emit this, but the guard must throw.
        expect(() => plot("a:1:1#0", { color: "#fff" } as never)).toThrow(
            "plot called outside an active script step",
        );
    });
});

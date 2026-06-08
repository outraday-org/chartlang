// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

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
import { alert } from "./alert";
import { hashStringStable } from "./hash";

function makeCaps(overrides: Partial<Capabilities> = {}): Capabilities {
    return {
        plots: capabilities.allLines(),
        drawings: new Set(),
        alerts: capabilities.alerts("toast"),
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

describe("alert — happy path", () => {
    it("pushes one AlertEmission with expected fields", () => {
        const { ctx, emissions } = makeCtx({ barIndex: 3, barTime: 1_700_000_060_000 });
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        alert("a:1:1#0", "Test");
        expect(emissions.alerts).toHaveLength(1);
        const e = emissions.alerts[0];
        expect(e.kind).toBe("alert");
        expect(e.slotId).toBe("a:1:1#0");
        expect(e.message).toBe("Test");
        expect(e.severity).toBe("info");
        expect(e.bar).toBe(3);
        expect(e.time).toBe(1_700_000_060_000);
        expect(e.channels).toEqual(["toast"]);
        expect(emissions.diagnostics).toEqual([]);
    });

    it("uses opts.severity and opts.meta", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        alert("a:1:1#0", "warn", { severity: "warning", meta: { reason: "x" } });
        expect(emissions.alerts[0].severity).toBe("warning");
        expect(emissions.alerts[0].meta).toEqual({ reason: "x" });
    });

    it("dedupeKey matches ${slotId}::${bar}::FNV1a(message + JSON.stringify(meta))", () => {
        const { ctx, emissions } = makeCtx({ barIndex: 5 });
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const meta = { reason: "crossover" };
        alert("rsi.ts:42:1#0", "RSI divergence", { meta });
        const expectedHash = hashStringStable(`RSI divergence${JSON.stringify(meta)}`);
        expect(emissions.alerts[0].dedupeKey).toBe(`rsi.ts:42:1#0::5::${expectedHash}`);
    });

    it("snapshots channels from capabilities.alerts at emission time", () => {
        const caps = makeCaps({ alerts: capabilities.alerts("toast", "log", "webhook") });
        const { ctx, emissions } = makeCtx({ caps });
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        alert("a:1:1#0", "msg");
        expect(emissions.alerts[0].channels).toEqual(["toast", "log", "webhook"]);
    });
});

describe("alert — capability gating", () => {
    it("drops + diagnoses when capabilities.alerts is empty", () => {
        const caps = makeCaps({ alerts: new Set() });
        const { ctx, emissions } = makeCtx({ caps });
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        alert("a:1:1#0", "msg");
        expect(emissions.alerts).toEqual([]);
        expect(emissions.diagnostics).toHaveLength(1);
        expect(emissions.diagnostics[0].code).toBe("unsupported-alert-channel");
        expect(emissions.diagnostics[0].slotId).toBe("a:1:1#0");
    });
});

describe("alert — dedup", () => {
    it("two alerts on the same (slotId, bar) — second wins", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        alert("a:1:1#0", "first");
        alert("a:1:1#0", "second");
        expect(emissions.alerts).toHaveLength(1);
        expect(emissions.alerts[0].message).toBe("second");
    });
});

describe("alert — outside context", () => {
    it("throws sentinel when ACTIVE_RUNTIME_CONTEXT.current is null", () => {
        expect(() => alert("a:1:1#0", "msg")).toThrow("alert called outside an active script step");
    });

    it("throws sentinel when called without a slot id (direct script-author invocation)", () => {
        const { ctx } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        expect(() => alert("just a message")).toThrow("alert called outside an active script step");
    });

    it("throws sentinel when called with opts but no message+slotId pair", () => {
        const { ctx } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        // (message, opts) — typeof arg2 === "object" → no slot id present → throw
        expect(() => alert("msg", { severity: "info" })).toThrow(
            "alert called outside an active script step",
        );
    });
});

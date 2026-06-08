// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { RequestSecurityOpts, SecurityBar } from "@invinite-org/chartlang-core";
import { afterEach, describe, expect, it } from "vitest";

import {
    ACTIVE_RUNTIME_CONTEXT,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../runtimeContext";
import { inMemoryStateStore } from "../stateStore";
import { createStreamState } from "../streamState";
import { createRuntimeViews } from "../views";
import { buildRequestNamespace } from "./requestNamespace";

type RuntimeRequestNamespace = {
    readonly security: (slotId: string, opts: RequestSecurityOpts) => SecurityBar;
};

function makeCapabilities(multiTimeframe: boolean): Capabilities {
    return {
        plots: capabilities.allLines(),
        drawings: new Set(),
        alerts: new Set(),
        alertConditions: false,
        logs: false,
        inputs: new Set(),
        intervals: [
            { value: "1m", label: "1 minute", group: "minute" },
            { value: "1D", label: "1 day", group: "daily" },
        ],
        multiTimeframe,
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

function makeEmissions(): MutableRunnerEmissions {
    return {
        plots: [],
        drawings: [],
        alerts: [],
        diagnostics: [],
        fromBar: 0,
        toBar: 0,
    };
}

function makeContext(multiTimeframe = true): RuntimeContext {
    const stream = createStreamState({ interval: "1m", capacity: 5, symbol: "AAPL" });
    stream.bar.time = 1_700_000_000_000;
    return {
        stream,
        stateStore: inMemoryStateStore(),
        capabilities: makeCapabilities(multiTimeframe),
        emissions: makeEmissions(),
        barIndex: () => 3,
        isTick: false,
        drawingSlots: new Map(),
        drawingSubIdCounters: new Map(),
        drawingBucketCounters: {
            lines: 0,
            labels: 0,
            boxes: 0,
            polylines: 0,
            other: 0,
        },
        scriptMaxDrawings: null,
        stateSlots: new Map(),
        requestSecurityBars: new Map(),
        diagnosedRequestKeys: new Set(),
        resolvedInputs: Object.freeze({}),
        diagnosedInputKeys: new Set(),
        views: createRuntimeViews(),
    };
}

function runtimeRequest(): RuntimeRequestNamespace {
    return buildRequestNamespace() as unknown as RuntimeRequestNamespace;
}

describe("buildRequestNamespace", () => {
    afterEach(() => {
        ACTIVE_RUNTIME_CONTEXT.current = null;
    });

    it("throws the runtime sentinel outside an active script step", () => {
        expect(() => runtimeRequest().security("slot#0", { interval: "1D" })).toThrow(
            "request.security called outside an active script step",
        );
    });

    it("returns a NaN bar without diagnostics for known intervals when multi-timeframe is enabled", () => {
        const ctx = makeContext(true);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;

        const bar = runtimeRequest().security("slot#0", { interval: "1D" });

        expect(Number.isNaN(bar.close.current)).toBe(true);
        expect(bar.symbol.current).toBe("");
        expect(ctx.emissions.diagnostics).toEqual([]);
    });

    it("emits unsupported-interval once per slot and interval", () => {
        const ctx = makeContext(true);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const request = runtimeRequest();

        const first = request.security("slot#0", { interval: "1W" });
        const second = request.security("slot#0", { interval: "1W" });

        expect(second).toBe(first);
        expect(ctx.emissions.diagnostics).toEqual([
            {
                kind: "diagnostic",
                severity: "warning",
                code: "unsupported-interval",
                message: 'Requested interval "1W" is not in Capabilities.intervals',
                slotId: "slot#0",
                bar: 3,
            },
        ]);
    });

    it("emits multi-timeframe-not-supported once for supported intervals when disabled", () => {
        const ctx = makeContext(false);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const request = runtimeRequest();

        request.security("slot#0", { interval: "1D" });
        request.security("slot#0", { interval: "1D" });

        expect(ctx.emissions.diagnostics).toEqual([
            {
                kind: "diagnostic",
                severity: "warning",
                code: "multi-timeframe-not-supported",
                message: "Adapter declares multiTimeframe: false; request.security returns NaN",
                slotId: "slot#0",
                bar: 3,
            },
        ]);
    });

    it("keeps distinct SecurityBar identities and diagnostics for different slots", () => {
        const ctx = makeContext(false);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const request = runtimeRequest();

        const left = request.security("slot#0", { interval: "1D" });
        const right = request.security("slot#1", { interval: "1D" });

        expect(left).not.toBe(right);
        expect(ctx.emissions.diagnostics.map((diagnostic) => diagnostic.slotId)).toEqual([
            "slot#0",
            "slot#1",
        ]);
    });

    it("uses interval as part of the cache and diagnostic dedupe key", () => {
        const ctx = makeContext(false);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const request = runtimeRequest();

        const first = request.security("slot#0", { interval: "1m" });
        const second = request.security("slot#0", { interval: "1D" });

        expect(first).not.toBe(second);
        expect(ctx.emissions.diagnostics).toHaveLength(2);
        expect(ctx.diagnosedRequestKeys).toEqual(
            new Set([
                "multi-timeframe-not-supported|slot#0|1m",
                "multi-timeframe-not-supported|slot#0|1D",
            ]),
        );
    });

    it("does not re-emit when the diagnostic key is already known", () => {
        const ctx = makeContext(false);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const request = runtimeRequest();

        request.security("slot#0", { interval: "1D" });
        ctx.requestSecurityBars.clear();
        const next = request.security("slot#0", { interval: "1D" });

        expect(Number.isNaN(next.close.current)).toBe(true);
        expect(ctx.emissions.diagnostics).toHaveLength(1);
    });
});

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { MutableRunnerEmissions, RuntimeContext } from "../runtimeContext.js";
import { inMemoryStateStore } from "../stateStore.js";
import { createStreamState } from "../streamState.js";
import { resolvePane } from "./paneResolver.js";

function makeCapabilities(subPanes: number): Capabilities {
    return {
        plots: capabilities.allLines(),
        drawings: new Set(),
        alerts: new Set(),
        alertConditions: false,
        logs: false,
        inputs: new Set(),
        intervals: [],
        multiTimeframe: false,
        subPanes,
        symInfoFields: new Set(),
        maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        maxLookback: 5000,
        maxTickHz: 10,
    };
}

function makeCtx(subPanes: number): {
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
    const ctx: RuntimeContext = {
        stream,
        stateStore: inMemoryStateStore(),
        capabilities: makeCapabilities(subPanes),
        emissions,
        barIndex: () => 0,
        isTick: false,
        drawingSlots: new Map(),
        drawingSubIdCounters: new Map(),
        drawingBucketCounters: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        scriptMaxDrawings: null,
        stateSlots: new Map(),
        defaultPane: "overlay",
        scriptPane: "script:test",
    };
    return { ctx, emissions };
}

describe("resolvePane — properties", () => {
    it("always returns a non-empty string and pushes at most one diagnostic", () => {
        fc.assert(
            fc.property(
                fc.option(fc.string({ minLength: 1, maxLength: 24 }), { nil: undefined }),
                fc.constantFrom(0, 1, Number.MAX_SAFE_INTEGER),
                (requested, subPanes) => {
                    const { ctx, emissions } = makeCtx(subPanes);
                    const pane = resolvePane(requested, ctx, "slot");
                    expect(pane.length).toBeGreaterThan(0);
                    expect(emissions.diagnostics.length).toBeLessThanOrEqual(1);
                },
            ),
        );
    });
});

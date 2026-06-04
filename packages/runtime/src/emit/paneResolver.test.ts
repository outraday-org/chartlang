// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { describe, expect, it } from "vitest";

import type { MutableRunnerEmissions, RuntimeContext } from "../runtimeContext";
import { createStreamState } from "../streamState";
import { inMemoryStateStore } from "../stateStore";
import { resolvePane } from "./paneResolver";

function makeCapabilities(subPanes = 0): Capabilities {
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

function makeCtx(subPanes = 0): {
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
        barIndex: () => 7,
        isTick: false,
    };
    return { ctx, emissions };
}

describe("resolvePane", () => {
    it("returns 'overlay' and pushes no diagnostic when requested is undefined", () => {
        const { ctx, emissions } = makeCtx(0);
        const pane = resolvePane(undefined, ctx, "slot");
        expect(pane).toBe("overlay");
        expect(emissions.diagnostics).toEqual([]);
    });

    it("returns 'overlay' and pushes no diagnostic when requested is 'overlay'", () => {
        const { ctx, emissions } = makeCtx(0);
        const pane = resolvePane("overlay", ctx, "slot");
        expect(pane).toBe("overlay");
        expect(emissions.diagnostics).toEqual([]);
    });

    it("folds 'new' to 'overlay' and pushes unsupported-pane (subPanes 0 branch)", () => {
        const { ctx, emissions } = makeCtx(0);
        const pane = resolvePane("new", ctx, "slot");
        expect(pane).toBe("overlay");
        expect(emissions.diagnostics).toHaveLength(1);
        expect(emissions.diagnostics[0].code).toBe("unsupported-pane");
        expect(emissions.diagnostics[0].slotId).toBe("slot");
        expect(emissions.diagnostics[0].bar).toBe(7);
        expect(emissions.diagnostics[0].message).toContain("subPanes: 0");
    });

    it("folds named pane to 'overlay' and pushes unsupported-pane (subPanes >= 1 branch)", () => {
        const { ctx, emissions } = makeCtx(1);
        const pane = resolvePane("rsi", ctx, "slot");
        expect(pane).toBe("overlay");
        expect(emissions.diagnostics).toHaveLength(1);
        expect(emissions.diagnostics[0].code).toBe("unsupported-pane");
        expect(emissions.diagnostics[0].message).toContain("Phase-1 runtime flattens");
    });
});

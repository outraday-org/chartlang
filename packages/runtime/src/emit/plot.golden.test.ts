// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { createHash } from "node:crypto";

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

// Inline 50-bar mini-fixture — graduates to Task 12's goldenBars.json
// when that fixture lands. Deterministic linear ramp keeps the
// expected SHA-256 stable across CI runners.
const MINI_FIXTURE_BARS = 50;

function makeCaps(): Capabilities {
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
    };
}

afterEach(() => {
    ACTIVE_RUNTIME_CONTEXT.current = null;
});

describe("plot — golden", () => {
    it("emits a SHA-256-stable plot array against the 50-bar mini-fixture", () => {
        const emissions: MutableRunnerEmissions = {
            plots: [],
            drawings: [],
            alerts: [],
            diagnostics: [],
            fromBar: 0,
            toBar: 0,
        };
        const stream = createStreamState({ interval: "", capacity: 64, symbol: "" });
        let barIndex = 0;
        const ctx: RuntimeContext = {
            stream,
            stateStore: inMemoryStateStore(),
            capabilities: makeCaps(),
            emissions,
            barIndex: () => barIndex,
            isTick: false,
        };
        ACTIVE_RUNTIME_CONTEXT.current = ctx;

        for (let i = 0; i < MINI_FIXTURE_BARS; i += 1) {
            stream.bar.time = 1_700_000_000_000 + i * 60_000;
            const close = 100 + i * 0.5;
            plot("fixture.ts:1:1#0", close);
            barIndex += 1;
        }

        const hash = createHash("sha256").update(JSON.stringify(emissions.plots)).digest("hex");

        // Pinned: any change to plot-emission shape or value rounding
        // shifts this hash and surfaces the regression immediately.
        expect(hash).toBe("64c0bacd74a7a76ea520c1f30e314dd732ca1946976f24eb5d7f2b1ece5b9d34");
        expect(emissions.plots).toHaveLength(MINI_FIXTURE_BARS);
    });
});

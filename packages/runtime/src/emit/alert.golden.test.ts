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
import { alert } from "./alert";

const MINI_FIXTURE_BARS = 50;

function makeCaps(): Capabilities {
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
    };
}

afterEach(() => {
    ACTIVE_RUNTIME_CONTEXT.current = null;
});

describe("alert — golden", () => {
    it("emits a SHA-256-stable alert array against the 50-bar mini-fixture", () => {
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
            drawingSlots: new Map(),
            drawingSubIdCounters: new Map(),
            drawingBucketCounters: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
            scriptMaxDrawings: null,
            stateSlots: new Map(),
        };
        ACTIVE_RUNTIME_CONTEXT.current = ctx;

        for (let i = 0; i < MINI_FIXTURE_BARS; i += 1) {
            stream.bar.time = 1_700_000_000_000 + i * 60_000;
            alert("fixture.ts:1:1#0", `bar ${i}`);
            barIndex += 1;
        }

        const hash = createHash("sha256").update(JSON.stringify(emissions.alerts)).digest("hex");

        expect(hash).toBe("5c23cbccbc8b61939254349eb1fb3715eef33e702268deb93f9e169608e298f3");
        expect(emissions.alerts).toHaveLength(MINI_FIXTURE_BARS);
    });
});

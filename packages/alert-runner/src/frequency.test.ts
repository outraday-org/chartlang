// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { createFrequencyGate } from "./frequency.js";
import type { GateCandidate } from "./frequency.js";

const H = 3_600_000;
const a = (time: number, id = "a"): GateCandidate => ({ kind: "alert", id, time });

describe("createFrequencyGate", () => {
    it("every_time delivers everything, including repeats on one bar", () => {
        const gate = createFrequencyGate({ frequency: "every_time", intervalMs: H });
        expect(gate.evaluate([a(0), a(0)], "preClose").delivered).toHaveLength(2);
        expect(gate.evaluate([a(0)], "close").delivered).toHaveLength(1);
        expect(gate.exhausted).toBe(false);
    });

    it("once_per_bar delivers one per id per bar across phases", () => {
        const gate = createFrequencyGate({ frequency: "once_per_bar", intervalMs: H });
        expect(gate.evaluate([a(0), a(0, "b")], "preClose").delivered).toHaveLength(2);
        const close = gate.evaluate([a(0), a(0, "b")], "close");
        expect(close.delivered).toEqual([]);
        expect(close.suppressed).toEqual([
            { kind: "alert", id: "a", time: 0, reason: "already-fired-this-bar" },
            { kind: "alert", id: "b", time: 0, reason: "already-fired-this-bar" },
        ]);
        expect(gate.evaluate([a(H)], "close").delivered).toHaveLength(1);
    });

    it("once_per_bar_close holds every pre-close emission", () => {
        const gate = createFrequencyGate({ frequency: "once_per_bar_close", intervalMs: H });
        expect(gate.evaluate([a(0)], "preClose")).toEqual({
            delivered: [],
            suppressed: [{ kind: "alert", id: "a", time: 0, reason: "frequency" }],
        });
        expect(gate.evaluate([a(0)], "close").delivered).toHaveLength(1);
        expect(gate.evaluate([a(0)], "close").suppressed[0]?.reason).toBe("already-fired-this-bar");
    });

    it("once exhausts after the first delivering evaluation", () => {
        const gate = createFrequencyGate({ frequency: "once", intervalMs: H });
        expect(gate.evaluate([], "close").delivered).toEqual([]);
        expect(gate.exhausted).toBe(false);
        expect(gate.evaluate([a(0), a(0, "b")], "close").delivered).toHaveLength(2);
        expect(gate.exhausted).toBe(true);
        expect(gate.evaluate([a(H)], "close").suppressed[0]?.reason).toBe("exhausted");
        expect(gate.state()).toEqual({
            lastFiredBarTime: { "alert:a": 0, "alert:b": 0 },
            exhausted: true,
        });
    });

    it("cooldownBars holds an id inside its window in every frequency", () => {
        const gate = createFrequencyGate({
            frequency: "every_time",
            intervalMs: H,
            cooldownBars: 2,
        });
        expect(gate.evaluate([a(0)], "close").delivered).toHaveLength(1);
        expect(gate.evaluate([a(H)], "close").suppressed[0]?.reason).toBe("cooldown");
        expect(gate.evaluate([a(2 * H)], "close").delivered).toHaveLength(1);
    });

    it("restores its memory from a snapshot state", () => {
        const gate = createFrequencyGate({
            frequency: "once_per_bar",
            intervalMs: H,
            state: { lastFiredBarTime: { "alert:a": 0 }, exhausted: false },
        });
        expect(gate.evaluate([a(0)], "close").delivered).toEqual([]);
        const once = createFrequencyGate({
            frequency: "once",
            intervalMs: H,
            state: { lastFiredBarTime: {}, exhausted: true },
        });
        expect(once.exhausted).toBe(true);
    });
});

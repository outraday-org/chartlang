// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { state } from "./state.js";

describe("state callable holes", () => {
    it("throws sentinels for state.* slots outside an active script step", () => {
        expect(() => state.float(0)).toThrow("state.float called outside an active script step");
        expect(() => state.int(0)).toThrow("state.int called outside an active script step");
        expect(() => state.bool(false)).toThrow("state.bool called outside an active script step");
        expect(() => state.string("")).toThrow("state.string called outside an active script step");
        expect(() => state.series(0)).toThrow("state.series called outside an active script step");
        expect(() => state.array<number>(8)).toThrow(
            "state.array called outside an active script step",
        );
    });

    it("throws sentinels for state.tick.* slots outside an active script step", () => {
        expect(() => state.tick.float(0)).toThrow(
            "state.tick.float called outside an active script step",
        );
        expect(() => state.tick.int(0)).toThrow(
            "state.tick.int called outside an active script step",
        );
        expect(() => state.tick.bool(false)).toThrow(
            "state.tick.bool called outside an active script step",
        );
        expect(() => state.tick.string("")).toThrow(
            "state.tick.string called outside an active script step",
        );
    });

    it("freezes the namespace and tick subnamespace", () => {
        expect(Object.isFrozen(state)).toBe(true);
        expect(Object.isFrozen(state.tick)).toBe(true);
    });
});

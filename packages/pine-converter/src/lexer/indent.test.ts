// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { createIndentTracker } from "./indent.js";

describe("createIndentTracker", () => {
    it("emits indent on a deeper level and none on an equal level", () => {
        const tracker = createIndentTracker();
        expect(tracker.resolve(4).delta).toEqual({ kind: "indent" });
        expect(tracker.resolve(4).delta).toEqual({ kind: "none" });
    });

    it("pops a single level back to the base", () => {
        const tracker = createIndentTracker();
        tracker.resolve(4);
        expect(tracker.resolve(0).delta).toEqual({ kind: "dedent", dedentCount: 1 });
    });

    it("pops several nested levels at once", () => {
        const tracker = createIndentTracker();
        tracker.resolve(2);
        tracker.resolve(4);
        tracker.resolve(6);
        const result = tracker.resolve(0);
        expect(result.delta).toEqual({ kind: "dedent", dedentCount: 3 });
        expect(result.inconsistentDedent).toBe(false);
    });

    it("flags an inconsistent dedent and snaps to the nearest lower level", () => {
        const tracker = createIndentTracker();
        tracker.resolve(4);
        tracker.resolve(8);
        const result = tracker.resolve(6);
        expect(result.delta).toEqual({ kind: "dedent", dedentCount: 1 });
        expect(result.inconsistentDedent).toBe(true);
        // After snapping, 6 is now the live level — no further dedent.
        expect(tracker.resolve(6).delta).toEqual({ kind: "none" });
    });

    it("drains every level to zero at eof", () => {
        const tracker = createIndentTracker();
        tracker.resolve(2);
        tracker.resolve(4);
        expect(tracker.dedentToZero()).toBe(2);
        expect(tracker.dedentToZero()).toBe(0);
    });

    it("returns zero from dedentToZero when never indented", () => {
        const tracker = createIndentTracker();
        expect(tracker.dedentToZero()).toBe(0);
    });
});

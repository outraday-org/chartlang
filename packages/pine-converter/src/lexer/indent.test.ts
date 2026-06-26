// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { createIndentTracker, isContinuationLead } from "./indent.js";

describe("isContinuationLead", () => {
    it("treats and/or keywords as continuation leads", () => {
        expect(isContinuationLead("keyword", "and")).toBe(true);
        expect(isContinuationLead("keyword", "or")).toBe(true);
    });

    it("excludes the prefix-only not keyword", () => {
        expect(isContinuationLead("keyword", "not")).toBe(false);
    });

    it("treats arithmetic/comparison/ternary operators as continuation leads", () => {
        for (const op of ["+", "-", "*", "/", "%", "==", "!=", "<", "<=", ">", ">=", "?", ":"]) {
            expect(isContinuationLead("operator", op)).toBe(true);
        }
    });

    it("excludes assignment operators that cannot continue an expression", () => {
        expect(isContinuationLead("operator", "=")).toBe(false);
        expect(isContinuationLead("operator", ":=")).toBe(false);
    });

    it("never treats a non-operator/keyword token as a lead", () => {
        expect(isContinuationLead("identifier", "close")).toBe(false);
        expect(isContinuationLead("punctuation", "(")).toBe(false);
    });
});

describe("createIndentTracker", () => {
    it("reports the live indent level without mutating the stack", () => {
        const tracker = createIndentTracker();
        expect(tracker.currentLevel()).toBe(0);
        tracker.resolve(4);
        expect(tracker.currentLevel()).toBe(4);
        // Reading it twice does not change it.
        expect(tracker.currentLevel()).toBe(4);
        tracker.resolve(0);
        expect(tracker.currentLevel()).toBe(0);
    });

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

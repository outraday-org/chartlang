// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { capabilities } from "./capabilities";

describe("capabilities builders", () => {
    it("line() returns a set containing only 'line'", () => {
        const s = capabilities.line();
        expect(s.size).toBe(1);
        expect(s.has("line")).toBe(true);
    });

    it("stepLine() returns a set containing only 'step-line'", () => {
        const s = capabilities.stepLine();
        expect(s.size).toBe(1);
        expect(s.has("step-line")).toBe(true);
    });

    it("horizontalLine() returns a set containing only 'horizontal-line'", () => {
        const s = capabilities.horizontalLine();
        expect(s.size).toBe(1);
        expect(s.has("horizontal-line")).toBe(true);
    });

    it("allLines() returns the three Phase-1 line variants", () => {
        const s = capabilities.allLines();
        expect(s.size).toBe(3);
        expect(s.has("line")).toBe(true);
        expect(s.has("step-line")).toBe(true);
        expect(s.has("horizontal-line")).toBe(true);
    });

    it("alerts(...) returns a set containing exactly the supplied channels", () => {
        const s = capabilities.alerts("toast", "webhook");
        expect(s.size).toBe(2);
        expect(s.has("toast")).toBe(true);
        expect(s.has("webhook")).toBe(true);
    });

    it("alerts() with no args returns an empty set", () => {
        const s = capabilities.alerts();
        expect(s.size).toBe(0);
    });

    it("union(...) merges sets without duplicating values", () => {
        const s = capabilities.union(capabilities.line(), capabilities.horizontalLine());
        expect(s.size).toBe(2);
        expect(s.has("line")).toBe(true);
        expect(s.has("horizontal-line")).toBe(true);
    });

    it("union() with no args returns an empty set", () => {
        const s = capabilities.union<string>();
        expect(s.size).toBe(0);
    });

    it("union(a, a) collapses duplicates", () => {
        const a = capabilities.line();
        const s = capabilities.union(a, a);
        expect(s.size).toBe(1);
        expect(s.has("line")).toBe(true);
    });
});

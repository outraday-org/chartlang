// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { resolvePaintColor } from "./colorValue.js";

describe("resolvePaintColor", () => {
    it("omitted colorValue uses the static color", () => {
        expect(resolvePaintColor(undefined, "#26a69a", "#888")).toBe("#26a69a");
    });

    it("omitted colorValue with a null static color falls back to plotDefault", () => {
        expect(resolvePaintColor(undefined, null, "#888")).toBe("#888");
    });

    it("present colorValue overrides the static color", () => {
        expect(resolvePaintColor("#ef5350", "#26a69a", "#888")).toBe("#ef5350");
    });

    it("null colorValue is the paint-nothing gap", () => {
        expect(resolvePaintColor(null, "#26a69a", "#888")).toBeNull();
    });
});

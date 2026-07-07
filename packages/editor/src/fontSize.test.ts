// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { createChartlangEditor } from "./createChartlangEditor.js";
import {
    clampEditorFontSize,
    DEFAULT_EDITOR_FONT_SIZE,
    editorFontSizeTheme,
    EDITOR_FONT_SIZE_PRESETS,
    MAX_EDITOR_FONT_SIZE,
    MIN_EDITOR_FONT_SIZE,
} from "./fontSize.js";

describe("clampEditorFontSize", () => {
    it("clamps below the minimum up to 11", () => {
        expect(clampEditorFontSize(9)).toBe(MIN_EDITOR_FONT_SIZE);
        expect(clampEditorFontSize(-100)).toBe(MIN_EDITOR_FONT_SIZE);
    });

    it("clamps above the maximum down to 22", () => {
        expect(clampEditorFontSize(30)).toBe(MAX_EDITOR_FONT_SIZE);
    });

    it("rounds floating-point input to the nearest whole pixel", () => {
        expect(clampEditorFontSize(15.6)).toBe(16);
        expect(clampEditorFontSize(14.4)).toBe(14);
    });

    it("returns in-range values unchanged", () => {
        expect(clampEditorFontSize(16)).toBe(16);
    });

    it("falls back to the default for non-finite input", () => {
        expect(clampEditorFontSize(Number.NaN)).toBe(DEFAULT_EDITOR_FONT_SIZE);
        expect(clampEditorFontSize(Number.POSITIVE_INFINITY)).toBe(DEFAULT_EDITOR_FONT_SIZE);
    });
});

describe("EDITOR_FONT_SIZE_PRESETS", () => {
    it("exposes the shared preset ladder inside the clamp range", () => {
        expect(EDITOR_FONT_SIZE_PRESETS).toEqual([12, 14, 16, 18, 20]);
        for (const preset of EDITOR_FONT_SIZE_PRESETS) {
            expect(clampEditorFontSize(preset)).toBe(preset);
        }
    });
});

describe("editorFontSizeTheme", () => {
    it("returns a defined CodeMirror Extension", () => {
        expect(editorFontSizeTheme(16)).toBeDefined();
    });

    it("mounts at the seeded size and lets setFontSize reconfigure live", () => {
        const parent = document.createElement("div");
        const editor = createChartlangEditor({ doc: "const value = 1;", fontSize: 16, parent });

        // Seeded mount keeps the view attached and intact.
        expect(parent.contains(editor.view.dom)).toBe(true);
        expect(editor.view.state.doc.toString()).toBe("const value = 1;");

        // Live reconfigure — clamps out-of-range values without remounting.
        editor.setFontSize(20);
        editor.setFontSize(9);
        editor.setFontSize(30);

        expect(parent.contains(editor.view.dom)).toBe(true);
        expect(editor.view.state.doc.toString()).toBe("const value = 1;");

        editor.destroy();
    });
});

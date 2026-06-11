// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";

import { createChartlangEditor } from "./createChartlangEditor.js";
import { chartlangDark } from "./theme.js";

describe("chartlangDark", () => {
    it("is a non-empty CodeMirror Extension", () => {
        expect(chartlangDark).toBeDefined();
        // The composed extension is an array of (theme, syntaxHighlighting).
        // We don't lock to a specific length — the contract is "non-empty
        // and a valid extension" — but we do confirm it carries content.
        expect(Array.isArray(chartlangDark) ? chartlangDark.length : 1).toBeGreaterThan(0);
    });

    it("activates dark mode when mounted", () => {
        const parent = document.createElement("div");
        const editor = createChartlangEditor({
            doc: "const x = 1;",
            extensions: [chartlangDark],
            parent,
        });

        // The `EditorView.darkTheme` facet is CM6's source-of-truth for
        // "this editor is in dark mode" — `EditorView.theme(_, { dark })`
        // pushes into this facet, and consumer CSS / extensions use it
        // to branch.
        expect(editor.view.state.facet(EditorView.darkTheme)).toBe(true);

        editor.destroy();
    });

    it("mounts a `cm-editor` root carrying the theme's dynamic classes", () => {
        const parent = document.createElement("div");
        document.body.append(parent);
        const editor = createChartlangEditor({
            doc: "const value = 1;",
            extensions: [chartlangDark],
            parent,
        });

        // CM6 emits dynamic theme-id classes via StyleModule. We assert
        // the root class hook and that `themeClasses` resolved to a
        // non-empty string — both confirm the theme extension wired
        // through cleanly.
        expect(editor.view.dom.classList.contains("cm-editor")).toBe(true);
        expect(editor.view.themeClasses.length).toBeGreaterThan(0);

        editor.destroy();
        parent.remove();
    });
});

describe("createChartlangEditor extensions passthrough", () => {
    it("honours a consumer-provided read-only extension", () => {
        const parent = document.createElement("div");
        const editor = createChartlangEditor({
            doc: "abc",
            extensions: [EditorView.editable.of(false)],
            parent,
        });

        // EditorView.editable is a facet — the read-only extension sets
        // the editor's editable facet to `false`.
        expect(editor.view.state.facet(EditorView.editable)).toBe(false);

        editor.destroy();
    });

    it("works without any consumer extensions", () => {
        const parent = document.createElement("div");
        const editor = createChartlangEditor({ doc: "abc", parent });

        // Default editor stays editable and is not dark.
        expect(editor.view.state.facet(EditorView.editable)).toBe(true);
        expect(editor.view.state.facet(EditorView.darkTheme)).toBe(false);

        editor.destroy();
    });
});

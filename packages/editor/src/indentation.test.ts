// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { type EditorView, runScopeHandlers } from "@codemirror/view";
import { describe, expect, it } from "vitest";

import { createChartlangEditor } from "./createChartlangEditor.js";

function pressKey(view: EditorView, key: string, shiftKey = false): void {
    runScopeHandlers(view, new KeyboardEvent("keydown", { key, shiftKey }), "editor");
}

function selectAll(view: EditorView): void {
    view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
}

describe("indentationExtension (baked into createChartlangEditor)", () => {
    it("inserts one 4-space indent unit on Tab at a bare cursor", () => {
        const editor = createChartlangEditor({ doc: "" });

        pressKey(editor.view, "Tab");

        expect(editor.view.state.doc.toString()).toBe("    ");
        editor.destroy();
    });

    it("indents every selected line on Tab with a non-empty selection", () => {
        const editor = createChartlangEditor({ doc: "foo\nbar" });
        selectAll(editor.view);

        pressKey(editor.view, "Tab");

        expect(editor.view.state.doc.toString()).toBe("    foo\n    bar");
        editor.destroy();
    });

    it("unindents on Shift+Tab", () => {
        const editor = createChartlangEditor({ doc: "    foo" });
        editor.view.dispatch({ selection: { anchor: editor.view.state.doc.length } });

        pressKey(editor.view, "Tab", true);

        expect(editor.view.state.doc.toString()).toBe("foo");
        editor.destroy();
    });

    it("keeps the previous line's indentation on Enter", () => {
        const editor = createChartlangEditor({ doc: "    foo" });
        editor.view.dispatch({ selection: { anchor: editor.view.state.doc.length } });

        pressKey(editor.view, "Enter");

        expect(editor.view.state.doc.toString()).toBe("    foo\n    ");
        editor.destroy();
    });

    it("expands the syntax-aware newline when the cursor is between brackets", () => {
        const editor = createChartlangEditor({ doc: "{}" });
        editor.view.dispatch({ selection: { anchor: 1 } });

        pressKey(editor.view, "Enter");

        const doc = editor.view.state.doc;
        expect(doc.lines).toBe(3);
        expect(doc.line(1).text).toBe("{");
        expect(doc.line(3).text).toBe("}");
        // The middle line carries an indented body.
        expect(doc.line(2).text.length).toBeGreaterThan(0);
        editor.destroy();
    });

    it("keeps indent (does not expand) when the cursor sits at the document start", () => {
        const editor = createChartlangEditor({ doc: "foo" });
        editor.view.dispatch({ selection: { anchor: 0 } });

        pressKey(editor.view, "Enter");

        expect(editor.view.state.doc.toString()).toBe("\nfoo");
        editor.destroy();
    });

    it("keeps indent (does not expand) when Enter runs over a non-empty selection", () => {
        const editor = createChartlangEditor({ doc: "abc" });
        selectAll(editor.view);

        pressKey(editor.view, "Enter");

        expect(editor.view.state.doc.toString()).toBe("\n");
        editor.destroy();
    });

    it("does not insert the 4-space unit on Tab when indentation is disabled", () => {
        const editor = createChartlangEditor({ doc: "", indentation: false });

        pressKey(editor.view, "Tab");

        expect(editor.view.state.doc.toString()).toBe("");
        editor.destroy();
    });
});

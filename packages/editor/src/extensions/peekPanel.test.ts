// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { EditorState } from "@codemirror/state";
import { EditorView } from "codemirror";
import { describe, expect, it } from "vitest";

import { peekPanelExtension } from "./peekPanel";

describe("peekPanelExtension", () => {
    it("renders and removes the Phase 4 placeholder panel", () => {
        const parent = document.createElement("div");
        const view = new EditorView({
            parent,
            state: EditorState.create({
                doc: "const value = 1;",
                extensions: [peekPanelExtension({})],
            }),
        });

        expect(parent.querySelector(".chartlang-peek-panel")?.textContent).toBe(
            "preview unavailable in Phase 4",
        );

        view.dispatch({ changes: { from: 0, insert: "export " } });
        view.destroy();

        expect(parent.querySelector(".chartlang-peek-panel")).toBeNull();
    });
});

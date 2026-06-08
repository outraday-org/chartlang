// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { diagnosticCount, forceLinting } from "@codemirror/lint";
import { EditorState } from "@codemirror/state";
import { EditorView } from "codemirror";
import { describe, expect, it } from "vitest";

import { linterExtension } from "./linter";
import { createTestLanguageService, waitFor } from "../__fixtures__/testHelpers";

describe("linterExtension", () => {
    it("maps language-service diagnostics and renders gutter pins", async () => {
        const service = createTestLanguageService({
            compileToDiagnostics: async () => [
                {
                    range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 5 },
                    severity: "error",
                    code: "first",
                    message: "First diagnostic.",
                },
                {
                    range: { startLine: 1, startColumn: 6, endLine: 1, endColumn: 7 },
                    severity: "warning",
                    code: "second",
                    message: "Second diagnostic.",
                },
                {
                    range: { startLine: 1, startColumn: 7, endLine: 1, endColumn: 7 },
                    severity: "hint",
                    code: "third",
                    message: "Third diagnostic.",
                },
            ],
        });
        const view = new EditorView({
            parent: document.body.appendChild(document.createElement("div")),
            state: EditorState.create({
                doc: "abcdefg",
                extensions: [linterExtension(() => service, undefined, 1)],
            }),
        });

        forceLinting(view);
        await waitFor(() => diagnosticCount(view.state) === 3);

        expect(diagnosticCount(view.state)).toBe(3);
        expect(view.dom.querySelector(".cm-lint-marker")).not.toBeNull();

        view.destroy();
    });
});

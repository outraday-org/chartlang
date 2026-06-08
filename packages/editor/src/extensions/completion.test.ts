// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { currentCompletions, startCompletion } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { EditorView } from "codemirror";
import { describe, expect, it } from "vitest";

import { completionExtension, completionStart } from "./completion";
import { createTestLanguageService, waitFor } from "../__fixtures__/testHelpers";

describe("completionExtension", () => {
    it("resolves completion replacement offsets", () => {
        expect(completionStart(null, 4)).toBe(4);
        expect(completionStart({ from: 1 }, 4)).toBe(1);
    });

    it("maps language-service completions into CM6 completions", async () => {
        const service = createTestLanguageService({
            getCompletions: () => [
                { label: "ta.ema", kind: "function", insertText: "ta.ema", detail: "EMA" },
                { label: "ta", kind: "namespace", insertText: "ta" },
                { label: "length", kind: "property", insertText: "length" },
                { label: "1D", kind: "enumMember", insertText: "1D" },
                { label: "const", kind: "keyword", insertText: "const" },
            ],
        });
        const view = new EditorView({
            parent: document.body.appendChild(document.createElement("div")),
            state: EditorState.create({
                doc: "ta",
                extensions: [completionExtension(() => service)],
            }),
        });

        startCompletion(view);
        await waitFor(() => currentCompletions(view.state).length === 5);

        expect(
            currentCompletions(view.state).map(({ label, type, detail }) => ({
                label,
                type,
                detail,
            })),
        ).toEqual([
            { label: "1D", type: "enum", detail: undefined },
            { label: "const", type: "keyword", detail: undefined },
            { label: "length", type: "property", detail: undefined },
            { label: "ta", type: "namespace", detail: undefined },
            { label: "ta.ema", type: "function", detail: "EMA" },
        ]);

        view.destroy();
    });

    it("returns no completions when the language service has none", async () => {
        const service = createTestLanguageService();
        const view = new EditorView({
            parent: document.body.appendChild(document.createElement("div")),
            state: EditorState.create({
                doc: "",
                extensions: [completionExtension(() => service)],
            }),
        });

        startCompletion(view);
        await new Promise((resolve) => setTimeout(resolve, 20));

        expect(currentCompletions(view.state)).toEqual([]);
        view.destroy();
    });

    it("supports explicit completions without a preceding token", async () => {
        const service = createTestLanguageService({
            getCompletions: () => [{ label: "plot", kind: "function", insertText: "plot" }],
        });
        const view = new EditorView({
            parent: document.body.appendChild(document.createElement("div")),
            state: EditorState.create({
                doc: " ",
                extensions: [completionExtension(() => service)],
            }),
        });

        startCompletion(view);
        await waitFor(() => currentCompletions(view.state).length === 1);

        expect(currentCompletions(view.state)[0]?.label).toBe("plot");
        view.destroy();
    });
});

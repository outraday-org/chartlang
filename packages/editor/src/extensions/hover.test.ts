// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { EditorState } from "@codemirror/state";
import { activateHover } from "@codemirror/view";
import { EditorView } from "codemirror";
import { describe, expect, it } from "vitest";

import { hoverExtension } from "./hover.js";
import { createTestLanguageService, waitFor } from "../__fixtures__/testHelpers.js";

describe("hoverExtension", () => {
    it("renders hover docs with a title, summary, and params", async () => {
        const service = createTestLanguageService({
            getHoverDoc: () => ({
                title: "ta.ema(source, length)",
                summary: "Exponential moving average.",
                paramTable: [{ name: "length", type: "number", doc: "Window length." }],
            }),
        });
        const view = new EditorView({
            parent: document.body.appendChild(document.createElement("div")),
            state: EditorState.create({
                doc: "ta.ema",
                extensions: [hoverExtension(() => service)],
            }),
        });

        activateHover(view, 1, 1);
        await waitFor(() => document.querySelector(".chartlang-hover") !== null);

        expect(document.querySelector(".chartlang-hover")?.textContent).toContain(
            "ta.ema(source, length)",
        );
        expect(document.querySelector(".chartlang-hover")?.textContent).toContain("Window length.");

        view.destroy();
    });

    it("skips tooltip rendering when no hover doc exists", async () => {
        const service = createTestLanguageService();
        const view = new EditorView({
            parent: document.body.appendChild(document.createElement("div")),
            state: EditorState.create({
                doc: "unknown",
                extensions: [hoverExtension(() => service)],
            }),
        });

        activateHover(view, 1, 1);
        await new Promise((resolve) => setTimeout(resolve, 20));

        expect(document.querySelector(".chartlang-hover")).toBeNull();
        view.destroy();
    });
});

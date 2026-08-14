// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { EditorState } from "@codemirror/state";
import { EditorView } from "codemirror";
import { describe, expect, it } from "vitest";

import { createTestLanguageService } from "../__fixtures__/testHelpers.js";
import { signatureHelpExtension } from "./signatureHelp.js";

const SOURCE = "ta.ema(bar.close, 20)";
const INSIDE_ARGS = SOURCE.indexOf("bar.close");

function mount(
    service: ReturnType<typeof createTestLanguageService>,
    selection: { anchor: number; head?: number },
): EditorView {
    return new EditorView({
        parent: document.body.appendChild(document.createElement("div")),
        state: EditorState.create({
            doc: SOURCE,
            selection,
            extensions: [signatureHelpExtension(() => service)],
        }),
    });
}

describe("signatureHelpExtension", () => {
    it("renders the signature label and marks the active parameter", () => {
        const service = createTestLanguageService({
            getSignatureHelp: () => ({
                label: "ta.ema(source, length)",
                parameters: [
                    { name: "source", doc: "Input series." },
                    { name: "length", doc: "Window length." },
                ],
                activeParameter: 1,
            }),
        });
        const view = mount(service, { anchor: INSIDE_ARGS });

        const tooltip = document.querySelector(".chartlang-signature");
        expect(tooltip?.textContent).toContain("ta.ema(source, length)");
        expect(tooltip?.textContent).toContain("Window length.");
        expect(document.querySelector(".chartlang-signature-active")?.textContent).toBe(
            "length — Window length.",
        );

        view.destroy();
    });

    it("renders the label alone when the signature declares no parameters", () => {
        const service = createTestLanguageService({
            getSignatureHelp: () => ({
                label: "bar.point(offset, price)",
                parameters: [],
                activeParameter: 0,
            }),
        });
        const view = mount(service, { anchor: INSIDE_ARGS });

        expect(document.querySelector(".chartlang-signature")?.textContent).toBe(
            "bar.point(offset, price)",
        );
        expect(document.querySelector(".chartlang-signature-params")).toBeNull();

        view.destroy();
    });

    it("shows nothing when the service resolves no signature", () => {
        const view = mount(createTestLanguageService(), { anchor: INSIDE_ARGS });

        expect(document.querySelector(".chartlang-signature")).toBeNull();

        view.destroy();
    });

    it("shows nothing while a range is selected", () => {
        const service = createTestLanguageService({
            getSignatureHelp: () => ({
                label: "ta.ema(source, length)",
                parameters: [{ name: "source", doc: "Input series." }],
                activeParameter: 0,
            }),
        });
        const view = mount(service, { anchor: 0, head: SOURCE.length });

        expect(document.querySelector(".chartlang-signature")).toBeNull();

        view.destroy();
    });

    it("recomputes on cursor + document changes and holds across unrelated transactions", () => {
        const offsets: number[] = [];
        const service = createTestLanguageService({
            getSignatureHelp: (_source, offset) => {
                offsets.push(offset);
                return offset === 0
                    ? null
                    : {
                          label: `at:${offset}`,
                          parameters: [{ name: "source", doc: "Input series." }],
                          activeParameter: 0,
                      };
            },
        });
        const view = mount(service, { anchor: 0 });

        expect(document.querySelector(".chartlang-signature")).toBeNull();

        // Selection change → recompute.
        view.dispatch({ selection: { anchor: INSIDE_ARGS } });
        expect(document.querySelector(".chartlang-signature-label")?.textContent).toBe(
            `at:${INSIDE_ARGS}`,
        );

        // A transaction that changes neither the doc nor the selection must
        // reuse the cached tooltip rather than re-query the service.
        const callsBefore = offsets.length;
        view.dispatch({ scrollIntoView: true });
        expect(offsets.length).toBe(callsBefore);
        expect(document.querySelector(".chartlang-signature-label")?.textContent).toBe(
            `at:${INSIDE_ARGS}`,
        );

        // Doc change → recompute.
        view.dispatch({ changes: { from: 0, to: 0, insert: "  " } });
        expect(offsets.length).toBeGreaterThan(callsBefore);

        view.destroy();
    });
});

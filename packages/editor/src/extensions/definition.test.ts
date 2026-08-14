// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { EditorState, Text } from "@codemirror/state";
import { EditorView } from "codemirror";
import { describe, expect, it } from "vitest";

import { createTestLanguageService } from "../__fixtures__/testHelpers.js";
import {
    DEFAULT_SCRIPT_FILE_NAME,
    type DefinitionExtensionOpts,
    definitionExtension,
    definitionOffset,
} from "./definition.js";

const SOURCE = 'const fast = base.output("line");\nplot(fast, { title: "line" });\n';
const CLICK_AT = SOURCE.indexOf('output("') + 'output("'.length;

function mount(
    service: ReturnType<typeof createTestLanguageService>,
    opts?: DefinitionExtensionOpts,
): EditorView {
    return new EditorView({
        parent: document.body.appendChild(document.createElement("div")),
        state: EditorState.create({
            doc: SOURCE,
            selection: { anchor: CLICK_AT },
            extensions: [definitionExtension(() => service, opts)],
        }),
    });
}

// happy-dom has no layout engine, so `view.posAtCoords` — the only layout
// query in the click path — cannot resolve real coordinates. Pin it to the
// offset the click is meant to land on; everything downstream of it is the
// code under test.
function modifierClick(view: EditorView, offset = CLICK_AT): void {
    Object.defineProperty(view, "posAtCoords", { value: () => offset, configurable: true });
    view.contentDOM.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true, metaKey: true }),
    );
}

function pressF12(view: EditorView): void {
    view.contentDOM.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "F12" }),
    );
}

describe("definitionOffset", () => {
    it("maps a 1-based location onto a document offset", () => {
        const doc = Text.of(["const a = 1;", "plot(a);"]);
        expect(definitionOffset(doc, { file: DEFAULT_SCRIPT_FILE_NAME, line: 2, column: 6 })).toBe(
            doc.line(2).from + 5,
        );
    });

    it("clamps an out-of-range line and column into the document", () => {
        const doc = Text.of(["const a = 1;", "plot(a);"]);
        expect(definitionOffset(doc, { file: "x", line: 99, column: 999 })).toBe(doc.line(2).to);
        expect(definitionOffset(doc, { file: "x", line: 0, column: 0 })).toBe(doc.line(1).from);
    });
});

describe("definitionExtension", () => {
    it("jumps to an in-document location on Cmd/Ctrl-click", () => {
        const service = createTestLanguageService({
            getDefinition: () => ({ file: DEFAULT_SCRIPT_FILE_NAME, line: 2, column: 21 }),
        });
        const view = mount(service);

        modifierClick(view);

        expect(view.state.selection.main.head).toBe(view.state.doc.line(2).from + 20);
        expect(document.querySelector(".chartlang-definition")).toBeNull();

        view.destroy();
    });

    it("jumps from the cursor on F12", () => {
        const service = createTestLanguageService({
            getDefinition: () => ({ file: DEFAULT_SCRIPT_FILE_NAME, line: 2, column: 1 }),
        });
        const view = mount(service);

        pressF12(view);

        expect(view.state.selection.main.head).toBe(view.state.doc.line(2).from);

        view.destroy();
    });

    it("honours a custom scriptFileName as the in-document discriminant", () => {
        const service = createTestLanguageService({
            getDefinition: () => ({ file: "demo.chart.ts", line: 2, column: 1 }),
            getHoverDoc: () => ({ title: "unused", summary: "unused" }),
        });
        const view = mount(service, { scriptFileName: "demo.chart.ts" });

        modifierClick(view);

        expect(view.state.selection.main.head).toBe(view.state.doc.line(2).from);
        expect(document.querySelector(".chartlang-definition")).toBeNull();

        view.destroy();
    });

    it("ignores an unmodified mousedown", () => {
        let calls = 0;
        const service = createTestLanguageService({
            getDefinition: () => {
                calls += 1;
                return { file: DEFAULT_SCRIPT_FILE_NAME, line: 2, column: 1 };
            },
        });
        const view = mount(service);

        // `button: 2` keeps CodeMirror's own mousedown handler off the
        // layout-dependent drag-selection path happy-dom cannot service.
        view.contentDOM.dispatchEvent(
            new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 2 }),
        );

        expect(calls).toBe(0);

        view.destroy();
    });

    it("does nothing when the service resolves no definition", () => {
        const view = mount(createTestLanguageService());
        const before = view.state.selection.main.head;

        modifierClick(view);

        expect(view.state.selection.main.head).toBe(before);
        expect(document.querySelector(".chartlang-definition")).toBeNull();

        view.destroy();
    });

    it("shows the hover doc for an out-of-document (stdlib) target", () => {
        const service = createTestLanguageService({
            getDefinition: () => ({ file: "packages/core/dist/index.d.ts", line: 1, column: 1 }),
            getHoverDoc: () => ({
                title: "ta.ema(source, length)",
                summary: "Exponential moving average.",
            }),
        });
        const view = mount(service);

        modifierClick(view);

        expect(document.querySelector(".chartlang-definition")?.textContent).toContain(
            "Exponential moving average.",
        );

        // A subsequent edit clears the fallback tooltip.
        view.dispatch({ changes: { from: 0, to: 0, insert: " " } });
        expect(document.querySelector(".chartlang-definition")).toBeNull();

        view.destroy();
    });

    it("shows nothing when the stdlib target carries no hover doc", () => {
        const service = createTestLanguageService({
            getDefinition: () => ({ file: "packages/core/dist/index.d.ts", line: 1, column: 1 }),
        });
        const view = mount(service);

        modifierClick(view);

        expect(document.querySelector(".chartlang-definition")).toBeNull();

        view.destroy();
    });
});

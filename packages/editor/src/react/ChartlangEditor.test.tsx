// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { currentCompletions, startCompletion } from "@codemirror/autocomplete";
import { forceLinting } from "@codemirror/lint";
import { EditorView } from "@codemirror/view";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
    createTestLanguageService,
    testCapabilities,
    waitFor,
} from "../__fixtures__/testHelpers.js";
import { ChartlangEditor } from "./ChartlangEditor.js";

const intervalSource = `
import { defineIndicator, request } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "Demo",
    apiVersion: 1,
    compute: () => {
        request.security({ interval: "" });
    },
});
`;

afterEach(() => cleanup());

describe("ChartlangEditor", () => {
    it("mounts the CM6 view and syncs external source changes", () => {
        const { container, rerender, unmount } = render(
            <ChartlangEditor
                className="editor-host"
                onCompiled={() => undefined}
                source="const first = 1;"
            />,
        );

        const cm = container.querySelector(".cm-editor");

        expect(container.firstElementChild?.classList.contains("editor-host")).toBe(true);
        expect(cm).not.toBeNull();
        expect(cm?.textContent).toContain("const first = 1;");

        rerender(<ChartlangEditor className="editor-host" source="const second = 2;" />);

        expect(container.querySelector(".cm-editor")?.textContent).toContain("const second = 2;");

        unmount();

        expect(container.querySelector(".cm-editor")).toBeNull();
    });

    it("emits source edits through onSourceChange", () => {
        const changes: string[] = [];
        const { container } = render(
            <ChartlangEditor
                source="const first = 1;"
                onSourceChange={(next) => changes.push(next)}
            />,
        );
        const view = findMountedView(container);

        view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: "const next = 2;" },
        });

        expect(changes).toEqual(["const next = 2;"]);
    });

    it("hot-swaps target capabilities without remounting", async () => {
        const { container, rerender } = render(
            <ChartlangEditor source={intervalSource} targetCapabilities={testCapabilities} />,
        );
        const view = findMountedView(container);
        const offset = intervalSource.indexOf('""') + 1;

        view.dispatch({ selection: { anchor: offset } });
        startCompletion(view);
        await waitFor(() => currentCompletions(view.state).length > 0);

        expect(currentCompletions(view.state).map((item) => item.label)).toEqual(["1D", "1m"]);

        rerender(<ChartlangEditor source={intervalSource} targetCapabilities={undefined} />);
        view.dispatch({ selection: { anchor: offset } });
        startCompletion(view);
        await waitFor(() =>
            currentCompletions(view.state).some((item) => item.label === "request.security"),
        );

        expect(currentCompletions(view.state).map((item) => item.label)).not.toContain("1m");
        expect(container.querySelectorAll(".cm-editor")).toHaveLength(1);
    });

    it("forwards consumer extensions through to the underlying view", () => {
        const { container } = render(
            <ChartlangEditor
                extensions={[EditorView.editable.of(false)]}
                source="const value = 1;"
            />,
        );
        const view = findMountedView(container);

        expect(view.state.facet(EditorView.editable)).toBe(false);
    });

    it("threads an injected service through to the linter and completions", async () => {
        let compileCalls = 0;
        const service = createTestLanguageService({
            compileToDiagnostics: async () => {
                compileCalls += 1;
                return [];
            },
            getCompletions: () => [
                {
                    label: "injectedSymbol",
                    kind: "function",
                    insertText: "injectedSymbol",
                },
            ],
        });
        const { container } = render(<ChartlangEditor service={service} source="abc" />);
        const view = findMountedView(container);

        forceLinting(view);
        await waitFor(() => compileCalls > 0);

        startCompletion(view);
        await waitFor(() =>
            currentCompletions(view.state).some((c) => c.label === "injectedSymbol"),
        );
    });
});

function findMountedView(container: HTMLElement): EditorView {
    const editorDom = container.querySelector(".cm-editor");
    if (!(editorDom instanceof HTMLElement)) throw new Error("missing CodeMirror editor");
    const view = EditorView.findFromDOM(editorDom);
    if (view === null) throw new Error("missing CodeMirror view");
    return view;
}

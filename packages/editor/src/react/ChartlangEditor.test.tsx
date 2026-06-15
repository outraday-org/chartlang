// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { currentCompletions, startCompletion } from "@codemirror/autocomplete";
import { forceLinting } from "@codemirror/lint";
import { EditorView } from "@codemirror/view";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { createTestLanguageService, waitFor } from "../__fixtures__/testHelpers.js";
import { ChartlangEditor } from "./ChartlangEditor.js";

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

    it("keeps the injected service active across target capability updates", async () => {
        let compileCalls = 0;
        const service = createTestLanguageService({
            compileToDiagnostics: async () => {
                compileCalls += 1;
                return [];
            },
        });
        const { container, rerender } = render(
            <ChartlangEditor
                service={service}
                source="const first = 1;"
                targetCapabilities={{
                    plots: new Set(["line"]),
                    drawings: new Set(),
                    alerts: new Set(),
                    alertConditions: false,
                    logs: false,
                    inputs: new Set(),
                    intervals: [],
                    multiTimeframe: false,
                    subPanes: 0,
                    symInfoFields: new Set(),
                    maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
                    maxLookback: 5000,
                    maxTickHz: 10,
                }}
            />,
        );
        const view = findMountedView(container);

        forceLinting(view);
        await waitFor(() => compileCalls > 0);
        const afterFirstLint = compileCalls;

        rerender(
            <ChartlangEditor
                service={service}
                source="const second = 2;"
                targetCapabilities={undefined}
            />,
        );
        forceLinting(view);
        await waitFor(() => compileCalls > afterFirstLint);

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

    it("forwards previewPanel through to the underlying view", () => {
        const { container } = render(<ChartlangEditor previewPanel={true} source="abc" />);

        expect(container.querySelector(".chartlang-peek-panel")?.textContent).toBe(
            "preview unavailable in Phase 4",
        );
    });

    it("forwards previewRunner through to the underlying view", () => {
        const { container } = render(<ChartlangEditor previewRunner={{}} source="abc" />);

        expect(container.querySelector(".chartlang-peek-panel")?.textContent).toBe(
            "preview unavailable in Phase 4",
        );
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

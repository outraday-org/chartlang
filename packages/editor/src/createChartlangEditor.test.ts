// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { currentCompletions, startCompletion } from "@codemirror/autocomplete";
import { describe, expect, it } from "vitest";

import { createChartlangEditor } from "./createChartlangEditor";
import { testCapabilities, waitFor } from "./__fixtures__/testHelpers";

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

describe("createChartlangEditor", () => {
    it("mounts, updates source, emits source changes, and destroys its DOM", () => {
        const parent = document.createElement("div");
        const changes: string[] = [];
        const editor = createChartlangEditor({
            doc: "const first = 1;",
            parent,
            onSourceChange: (next) => changes.push(next),
        });

        editor.setSource("ta.ema(bar.close, 20)");

        expect(editor.view.state.doc.toString()).toBe("ta.ema(bar.close, 20)");
        expect(changes).toEqual(["ta.ema(bar.close, 20)"]);
        expect(parent.contains(editor.view.dom)).toBe(true);

        editor.destroy();

        expect(parent.contains(editor.view.dom)).toBe(false);
    });

    it("allows callers to attach the view DOM themselves", () => {
        const editor = createChartlangEditor();
        const parent = document.createElement("div");

        parent.append(editor.view.dom);

        expect(parent.contains(editor.view.dom)).toBe(true);
        editor.destroy();
        expect(parent.contains(editor.view.dom)).toBe(false);
    });

    it("hot-swaps capabilities for interval completions", async () => {
        const editor = createChartlangEditor({
            doc: intervalSource,
            targetCapabilities: testCapabilities,
            lintDebounceMs: 1,
        });
        const offset = intervalSource.indexOf('""') + 1;
        editor.view.dispatch({ selection: { anchor: offset } });

        startCompletion(editor.view);
        await waitFor(() => currentCompletions(editor.view.state).length > 0);

        expect(currentCompletions(editor.view.state).map((item) => item.label)).toEqual([
            "1D",
            "1m",
        ]);

        editor.setCapabilities(null);
        editor.setSource(intervalSource);
        editor.view.dispatch({ selection: { anchor: offset } });

        startCompletion(editor.view);
        await waitFor(() =>
            currentCompletions(editor.view.state).some((item) => item.label === "request.security"),
        );

        expect(currentCompletions(editor.view.state).map((item) => item.label)).not.toContain("1m");

        editor.setCapabilities(testCapabilities);
        editor.destroy();
    });
});

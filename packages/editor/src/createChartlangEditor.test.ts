// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { currentCompletions, startCompletion } from "@codemirror/autocomplete";
import { forceLinting } from "@codemirror/lint";
import { describe, expect, it } from "vitest";

import { createChartlangEditor } from "./createChartlangEditor.js";
import {
    createTestLanguageService,
    testCapabilities,
    waitFor,
} from "./__fixtures__/testHelpers.js";

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

    it("routes dep-aware completions through the language service", async () => {
        // Task 7 regression: the bundled language service must surface
        // producer output titles when the cursor is inside
        // `<binding>.output("|")`. The editor itself doesn't grow new
        // API — the new behaviour flows through the existing completion
        // extension end-to-end.
        const composition = `
import { defineIndicator, plot } from "@invinite-org/chartlang-core";
const baseTrend = defineIndicator({
    name: "Base",
    apiVersion: 1,
    compute: ({ bar }) => {
        plot(bar.close, { title: "trend" });
        plot(bar.close, { title: "signal" });
    },
});
const x = baseTrend.output("");
void x;
`;
        const editor = createChartlangEditor({
            doc: composition,
            lintDebounceMs: 1,
        });
        const offset = composition.indexOf('output("') + 'output("'.length;
        editor.view.dispatch({ selection: { anchor: offset } });

        startCompletion(editor.view);
        await waitFor(
            () => currentCompletions(editor.view.state).some((c) => c.label === "trend"),
        );

        const labels = currentCompletions(editor.view.state).map((c) => c.label);
        expect(labels).toEqual(expect.arrayContaining(["trend", "signal"]));

        editor.destroy();
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

    it("uses an injected service for hover / completions / diagnostics", async () => {
        const calls: string[] = [];
        const service = createTestLanguageService({
            compileToDiagnostics: async (source) => {
                calls.push(`compile:${source}`);
                return [
                    {
                        range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 4 },
                        severity: "error",
                        code: "injected",
                        message: "from injected service",
                    },
                ];
            },
            getCompletions: () => [
                {
                    label: "injectedSymbol",
                    kind: "function",
                    insertText: "injectedSymbol",
                },
            ],
        });
        const editor = createChartlangEditor({
            doc: "abc",
            service,
            lintDebounceMs: 1,
        });

        forceLinting(editor.view);
        await waitFor(() => calls.length > 0);
        expect(calls[0]).toBe("compile:abc");

        startCompletion(editor.view);
        await waitFor(() =>
            currentCompletions(editor.view.state).some((c) => c.label === "injectedSymbol"),
        );

        editor.destroy();
    });

    it("setCapabilities is a no-op when a service is injected", async () => {
        let compileCalls = 0;
        const service = createTestLanguageService({
            compileToDiagnostics: async () => {
                compileCalls += 1;
                return [];
            },
        });
        const editor = createChartlangEditor({
            doc: "x",
            service,
            lintDebounceMs: 1,
        });

        forceLinting(editor.view);
        await waitFor(() => compileCalls > 0);
        const after = compileCalls;

        // Calling setCapabilities should NOT swap the service. Drive
        // another lint pass and confirm the injected service still ran
        // — not a freshly constructed real service that would crash on
        // the bare "x" source via the compiler/esbuild path.
        editor.setCapabilities(testCapabilities);
        editor.setCapabilities(null);

        editor.setSource("y");
        forceLinting(editor.view);
        await waitFor(() => compileCalls > after);

        editor.destroy();
    });
});

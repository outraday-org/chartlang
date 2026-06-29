// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { Diagnostic, SourceSpan } from "../index.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";

const SPAN: SourceSpan = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 };

describe("DiagnosticCollector", () => {
    it("starts empty", () => {
        const collector = new DiagnosticCollector();
        expect(collector.size).toBe(0);
        expect(collector.toArray()).toEqual([]);
    });

    it("pushCode builds a registry diagnostic and tracks its code", () => {
        const collector = new DiagnosticCollector();
        collector.pushCode("strategy-as-indicator", SPAN);
        expect(collector.size).toBe(1);
        expect(collector.has("pine-converter/transform/strategy-as-indicator")).toBe(true);
        expect(collector.toArray()[0]?.code).toBe("pine-converter/transform/strategy-as-indicator");
    });

    it("pushCode applies a message override", () => {
        const collector = new DiagnosticCollector();
        collector.pushCode("computed-indicator-title", SPAN, "custom");
        expect(collector.toArray()[0]?.message).toBe("custom");
    });

    it("push appends an already-built diagnostic", () => {
        const collector = new DiagnosticCollector();
        const diag: Diagnostic = {
            code: "pine-converter/transform/x",
            severity: "info",
            message: "m",
            span: SPAN,
        };
        collector.push(diag);
        expect(collector.has("pine-converter/transform/x")).toBe(true);
        expect(collector.toArray()).toEqual([diag]);
    });

    it("has returns false for an un-pushed code", () => {
        const collector = new DiagnosticCollector();
        expect(collector.has("pine-converter/transform/missing")).toBe(false);
    });

    it("pushCodeOnce emits once per (code, dedupeKey) and keeps the first span", () => {
        const collector = new DiagnosticCollector();
        const first: SourceSpan = { startLine: 3, startColumn: 1, endLine: 3, endColumn: 9 };
        const second: SourceSpan = { startLine: 9, startColumn: 1, endLine: 9, endColumn: 9 };
        collector.pushCodeOnce("input-arg-not-mapped", "group", first);
        collector.pushCodeOnce("input-arg-not-mapped", "group", second);
        expect(collector.size).toBe(1);
        expect(collector.toArray()[0]?.span).toEqual(first);
    });

    it("pushCodeOnce emits distinct dedupeKeys under the same code", () => {
        const collector = new DiagnosticCollector();
        collector.pushCodeOnce("input-arg-not-mapped", "group", SPAN);
        collector.pushCodeOnce("input-arg-not-mapped", "inline", SPAN);
        expect(collector.size).toBe(2);
    });

    it("pushCodeOnce applies a message override and defaults without one", () => {
        const collector = new DiagnosticCollector();
        collector.pushCodeOnce("input-arg-not-mapped", "group", SPAN, "named group");
        collector.pushCodeOnce("table-formatting-not-mapped", "text_wrap", SPAN);
        expect(collector.toArray()[0]?.message).toBe("named group");
        expect(collector.toArray()[1]?.message).toBe(
            "Pine's `text_formatting`/`text_font_family`/`text_wrap` cell options have no chartlang analogue and were dropped.",
        );
    });

    it("toArray returns a copy that does not alias the internal list", () => {
        const collector = new DiagnosticCollector();
        collector.pushCode("drawing-only-script", SPAN);
        const snapshot = collector.toArray();
        collector.pushCode("drawing-only-script", SPAN);
        expect(snapshot).toHaveLength(1);
        expect(collector.size).toBe(2);
    });
});

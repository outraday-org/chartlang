// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { ExpressionNode } from "../ast/index.js";
import type { Argument } from "../ast/script.js";
import type { SourceSpan } from "../index.js";
import { FALLBACK_INDICATOR_NAME, mapDeclarationArgs } from "./declarationArgs.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";

const SPAN: SourceSpan = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 };

function str(value: string): ExpressionNode {
    return { kind: "literal-expression", literalKind: "string", value: `"${value}"`, span: SPAN };
}
function int(value: number): ExpressionNode {
    return { kind: "literal-expression", literalKind: "int", value: String(value), span: SPAN };
}
function bool(value: boolean): ExpressionNode {
    return { kind: "literal-expression", literalKind: "bool", value: String(value), span: SPAN };
}
function member(chain: readonly string[]): ExpressionNode {
    return { kind: "member-access-expression", head: null, chain, span: SPAN };
}
function arg(name: string | null, value: ExpressionNode): Argument {
    return { name, value, span: SPAN };
}

function codes(collector: DiagnosticCollector): string[] {
    return collector.toArray().map((d) => d.code);
}

describe("mapDeclarationArgs", () => {
    it("maps a positional title to name", () => {
        const diag = new DiagnosticCollector();
        const opts = mapDeclarationArgs([arg(null, str("Hello"))], diag);
        expect(opts.name).toBe("Hello");
    });

    it("prefers a named title over the positional", () => {
        const diag = new DiagnosticCollector();
        const opts = mapDeclarationArgs([arg(null, str("Pos")), arg("title", str("Named"))], diag);
        expect(opts.name).toBe("Named");
    });

    it("returns null name for a computed title and raises an error", () => {
        const diag = new DiagnosticCollector();
        const opts = mapDeclarationArgs([arg(null, member(["syminfo", "ticker"]))], diag);
        expect(opts.name).toBeNull();
        expect(codes(diag)).toContain("pine-converter/transform/computed-indicator-title");
    });

    it("returns null name when no title arg is present", () => {
        const diag = new DiagnosticCollector();
        const opts = mapDeclarationArgs([], diag);
        expect(opts.name).toBeNull();
    });

    it("maps shorttitle / overlay / precision", () => {
        const diag = new DiagnosticCollector();
        const opts = mapDeclarationArgs(
            [
                arg(null, str("X")),
                arg("shorttitle", str("X2")),
                arg("overlay", bool(true)),
                arg("precision", int(4)),
            ],
            diag,
        );
        expect(opts.shortName).toBe("X2");
        expect(opts.overlay).toBe(true);
        expect(opts.precision).toBe(4);
    });

    it("maps max_bars_back", () => {
        const diag = new DiagnosticCollector();
        const opts = mapDeclarationArgs([arg("max_bars_back", int(120))], diag);
        expect(opts.maxBarsBack).toBe(120);
    });

    it("defaults each max_*_count bucket to 50 when omitted", () => {
        const diag = new DiagnosticCollector();
        const opts = mapDeclarationArgs([arg(null, str("X"))], diag);
        expect(opts.maxDrawings).toEqual({ lines: 50, labels: 50, boxes: 50, polylines: 50 });
    });

    it("maps each max_*_count arg to its bucket", () => {
        const diag = new DiagnosticCollector();
        const opts = mapDeclarationArgs(
            [
                arg("max_lines_count", int(20)),
                arg("max_labels_count", int(10)),
                arg("max_boxes_count", int(5)),
                arg("max_polylines_count", int(7)),
            ],
            diag,
        );
        expect(opts.maxDrawings).toEqual({ lines: 20, labels: 10, boxes: 5, polylines: 7 });
    });

    it("clamps an over-cap max_*_count and warns", () => {
        const diag = new DiagnosticCollector();
        const opts = mapDeclarationArgs([arg("max_polylines_count", int(999))], diag);
        expect(opts.maxDrawings.polylines).toBe(100);
        expect(codes(diag)).toContain("pine-converter/transform/max-count-out-of-range");
    });

    it("ignores a non-literal max_*_count", () => {
        const diag = new DiagnosticCollector();
        const opts = mapDeclarationArgs([arg("max_lines_count", member(["x"]))], diag);
        expect(opts.maxDrawings.lines).toBe(50);
        expect(diag.size).toBe(0);
    });

    it("maps the format enum members", () => {
        for (const [m, expected] of [
            [["format", "price"], "price"],
            [["format", "percent"], "percent"],
            [["format", "volume"], "volume"],
        ] as const) {
            const diag = new DiagnosticCollector();
            const opts = mapDeclarationArgs([arg("format", member(m))], diag);
            expect(opts.format).toBe(expected);
            expect(diag.size).toBe(0);
        }
    });

    it("maps format.inherit to null with a warning", () => {
        const diag = new DiagnosticCollector();
        const opts = mapDeclarationArgs([arg("format", member(["format", "inherit"]))], diag);
        expect(opts.format).toBeNull();
        expect(codes(diag)).toContain("pine-converter/transform/indicator-arg-not-mapped");
    });

    it("ignores an unrecognized format member", () => {
        const diag = new DiagnosticCollector();
        const opts = mapDeclarationArgs([arg("format", member(["format", "weird"]))], diag);
        expect(opts.format).toBeNull();
        expect(diag.size).toBe(0);
    });

    it("ignores a non-member format value", () => {
        const diag = new DiagnosticCollector();
        const opts = mapDeclarationArgs([arg("format", str("price"))], diag);
        expect(opts.format).toBeNull();
    });

    it("maps the scale enum members", () => {
        for (const [m, expected] of [
            [["scale", "left"], "left"],
            [["scale", "right"], "right"],
        ] as const) {
            const diag = new DiagnosticCollector();
            const opts = mapDeclarationArgs([arg("scale", member(m))], diag);
            expect(opts.scale).toBe(expected);
        }
    });

    it("maps scale.none to null with a warning", () => {
        const diag = new DiagnosticCollector();
        const opts = mapDeclarationArgs([arg("scale", member(["scale", "none"]))], diag);
        expect(opts.scale).toBeNull();
        expect(codes(diag)).toContain("pine-converter/transform/indicator-arg-not-mapped");
    });

    it("ignores an unrecognized scale member and a non-member scale value", () => {
        const diag = new DiagnosticCollector();
        mapDeclarationArgs([arg("scale", member(["scale", "weird"]))], diag);
        mapDeclarationArgs([arg("scale", str("left"))], diag);
        expect(diag.size).toBe(0);
    });

    it("warns once per unmapped arg", () => {
        const diag = new DiagnosticCollector();
        mapDeclarationArgs([arg("timeframe", str("1D")), arg("behind_chart", bool(true))], diag);
        expect(
            codes(diag).filter((c) => c === "pine-converter/transform/indicator-arg-not-mapped"),
        ).toHaveLength(2);
    });

    it("recognizes explicit_plot_zorder=true as a no-op with an info note, not a warning", () => {
        const diag = new DiagnosticCollector();
        const opts = mapDeclarationArgs(
            [arg(null, str("X")), arg("explicit_plot_zorder", bool(true))],
            diag,
        );
        // chartlang orders by declaration order already, so no field is set.
        expect(opts).toEqual(mapDeclarationArgs([arg(null, str("X"))], new DiagnosticCollector()));
        expect(codes(diag)).toContain("pine-converter/transform/explicit-plot-zorder-default");
        expect(codes(diag)).not.toContain("pine-converter/transform/indicator-arg-not-mapped");
    });

    it("recognizes explicit_plot_zorder=false the same way (no warning)", () => {
        const diag = new DiagnosticCollector();
        mapDeclarationArgs([arg("explicit_plot_zorder", bool(false))], diag);
        expect(codes(diag)).toEqual(["pine-converter/transform/explicit-plot-zorder-default"]);
    });

    it("silently drops a strategy-only arg", () => {
        const diag = new DiagnosticCollector();
        mapDeclarationArgs([arg("initial_capital", int(10000))], diag);
        expect(diag.size).toBe(0);
    });

    it("ignores a non-literal shorttitle / overlay / precision / max_bars_back", () => {
        const diag = new DiagnosticCollector();
        const opts = mapDeclarationArgs(
            [
                arg("shorttitle", int(1)),
                arg("overlay", str("x")),
                arg("precision", str("x")),
                arg("max_bars_back", str("x")),
            ],
            diag,
        );
        expect(opts.shortName).toBeNull();
        expect(opts.overlay).toBeNull();
        expect(opts.precision).toBeNull();
        expect(opts.maxBarsBack).toBeNull();
    });

    it("maps overlay=false", () => {
        const diag = new DiagnosticCollector();
        const opts = mapDeclarationArgs([arg("overlay", bool(false))], diag);
        expect(opts.overlay).toBe(false);
    });

    it("exposes the fallback name sentinel", () => {
        expect(FALLBACK_INDICATOR_NAME).toBe("<unknown>");
    });
});

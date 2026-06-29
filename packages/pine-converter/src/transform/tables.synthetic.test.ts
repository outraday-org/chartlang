// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { CallExpression, ExpressionNode } from "../ast/index.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import type { DrawingCallSite } from "../semantic/index.js";
import { analyze } from "../semantic/index.js";
import { transformDeclaration } from "./declaration.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import type { ScriptScaffold } from "./ir.js";
import type { CellSpec } from "./tables.js";
import { transformTables } from "./tables.js";

const SPAN = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 } as const;

function run(body: string): { scaffold: ScriptScaffold; diagnostics: DiagnosticCollector } {
    const src = `//@version=6\nindicator("X")\n${body}\nplot(close)\n`;
    const analysis = analyze(parseStatements(lex(src).tokens).script);
    const decl = analysis.script.declaration;
    if (
        decl === null ||
        decl.kind === "library-declaration" ||
        decl.kind === "import-declaration"
    ) {
        throw new Error("expected an indicator declaration");
    }
    const diagnostics = new DiagnosticCollector();
    const scaffold = transformDeclaration(decl, analysis, diagnostics);
    transformTables(analysis, scaffold, diagnostics);
    return { scaffold, diagnostics };
}

function cellsOf(scaffold: ScriptScaffold): string {
    const stmt = scaffold.computeBody.statements.find((s) => s.startsWith("const tCells"));
    if (stmt === undefined) {
        throw new Error("no cells statement");
    }
    return stmt;
}

const codes = (d: DiagnosticCollector): string[] => d.toArray().map((x) => x.code);

describe("transformTables — exported type", () => {
    it("the CellSpec shape carries text + span", () => {
        const c: CellSpec = { text: '"x"', sourceSpan: SPAN };
        expect(c.text).toBe('"x"');
    });
});

describe("transformTables — full cell-styling coverage", () => {
    it("maps every cell_set_* family member", () => {
        const { scaffold } = run(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 1, 1)",
                '    table.cell(t, 0, 0, "x")',
                "    table.cell_set_text_color(t, 0, 0, color.red)",
                "    table.cell_set_text_halign(t, 0, 0, text.align_left)",
                "    table.cell_set_text_size(t, 0, 0, size.small)",
            ].join("\n"),
        );
        const cells = cellsOf(scaffold);
        expect(cells).toContain('textColor: "#FF5252"');
        expect(cells).toContain('textHalign: "left"');
        expect(cells).toContain('textSize: "small"');
    });

    it("ignores an unknown cell_set_* member", () => {
        const { scaffold } = run(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 1, 1)",
                '    table.cell(t, 0, 0, "x")',
                "    table.cell_set_tooltip(t, 0, 0, color.red)",
            ].join("\n"),
        );
        expect(cellsOf(scaffold)).toContain('text: "x"');
    });

    it("warns on Pine cell formatting args with no analogue", () => {
        const { diagnostics } = run(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 1, 1)",
                '    table.cell(t, 0, 0, "x", text_formatting=text.format_bold, text_wrap=text.wrap_auto)',
            ].join("\n"),
        );
        expect(codes(diagnostics)).toContain(
            "pine-converter/transform/table-formatting-not-mapped",
        );
    });

    it("consolidates unmapped cell args to one per distinct name and still maps colors", () => {
        const { scaffold, diagnostics } = run(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 1, 3)",
                '    table.cell(t, 0, 0, "a", text_formatting=text.format_bold, text_color=color.white)',
                '    table.cell(t, 0, 1, "b", text_font_family=font.family_monospace, bgcolor=color.green)',
                '    table.cell(t, 0, 2, "c", text_wrap=text.wrap_auto, text_formatting=text.format_bold)',
            ].join("\n"),
        );
        const formatting = codes(diagnostics).filter(
            (c) => c === "pine-converter/transform/table-formatting-not-mapped",
        );
        // 4 unmapped occurrences across 3 cells → 3 (text_formatting, text_font_family, text_wrap).
        expect(formatting).toHaveLength(3);
        const messages = diagnostics
            .toArray()
            .filter((d) => d.code === "pine-converter/transform/table-formatting-not-mapped")
            .map((d) => d.message);
        expect(messages).toEqual([
            "Pine's `text_formatting` table-cell option has no chartlang analogue and was dropped.",
            "Pine's `text_font_family` table-cell option has no chartlang analogue and was dropped.",
            "Pine's `text_wrap` table-cell option has no chartlang analogue and was dropped.",
        ]);
        // Mapped color args are unaffected by the consolidation.
        const cells = cellsOf(scaffold);
        expect(cells).toContain('textColor: "#FFFFFF"');
        expect(cells).toContain('bgColor: "#4CAF50"');
    });

    it("drops an unknown cell named arg", () => {
        const { scaffold } = run(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 1, 1)",
                '    table.cell(t, 0, 0, "x", tooltip="hi")',
            ].join("\n"),
        );
        expect(cellsOf(scaffold)).toContain('text: "x"');
    });

    it("lowers a non-enum styling value via emitExpr", () => {
        const { scaffold } = run(
            [
                "myColor = color.red",
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 1, 1)",
                '    table.cell(t, 0, 0, "x", bgcolor=myColor)',
            ].join("\n"),
        );
        expect(cellsOf(scaffold)).toContain("bgColor: myColor");
    });
});

describe("transformTables — missing args + non-literal shape", () => {
    it("defaults an absent / non-enum position to top-right", () => {
        const { scaffold } = run(
            [
                "pos = position.bottom_left",
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(pos, 1, 1)",
                '    table.cell(t, 0, 0, "x")',
            ].join("\n"),
        );
        const drawStmt = scaffold.computeBody.statements.find((s) => s.includes("draw.table"));
        expect(drawStmt).toContain('position: "top-right"');
    });

    it("infers the grid extent when columns/rows are non-literal", () => {
        const { scaffold } = run(
            [
                "n = 2",
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, n, n)",
                '    table.cell(t, 1, 2, "x")',
            ].join("\n"),
        );
        const cells = cellsOf(scaffold);
        // 3 rows (max row 2 + 1), 2 columns (max col 1 + 1).
        const rows = cells.match(/\[\{[^[]*?\}\]/g) ?? [];
        expect(rows.length).toBe(3);
        expect(cells).toContain('text: "x"');
    });

    it("skips a cell write with a non-literal column index", () => {
        const { scaffold, diagnostics } = run(
            [
                "c = 0",
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 2, 2)",
                '    table.cell(t, c, 0, "x")',
            ].join("\n"),
        );
        expect(codes(diagnostics)).not.toContain(
            "pine-converter/transform/table-cell-out-of-bounds",
        );
        expect(cellsOf(scaffold)).toContain('{ text: "" }');
    });

    it("treats a cell write missing its text arg as an empty cell", () => {
        const { scaffold } = run(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 1, 1)",
                "    table.cell(t, 0, 0)",
            ].join("\n"),
        );
        expect(cellsOf(scaffold)).toContain('{ text: "" }');
    });

    it("treats a cell_set_* missing its value arg as a no-op", () => {
        const { scaffold } = run(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 1, 1)",
                '    table.cell(t, 0, 0, "x")',
                "    table.cell_set_bgcolor(t, 0, 0)",
            ].join("\n"),
        );
        const cells = cellsOf(scaffold);
        expect(cells).toContain('text: "x"');
        expect(cells).not.toContain("bgColor:");
    });
});

describe("transformTables — loop iterator substitution arms", () => {
    it("substitutes the iterator across unary / binary / ternary / paren forms", () => {
        const { scaffold } = run(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 1, 2)",
                "    for i = 0 to 1",
                "        table.cell(t, 0, i, str.tostring(-i + (i > 0 ? i : i)))",
            ].join("\n"),
        );
        const cells = cellsOf(scaffold);
        expect(cells).toContain("(-0) + ((0 > 0) ? 0 : 0)");
        expect(cells).toContain("(-1) + ((1 > 0) ? 1 : 1)");
    });

    it("warns when a cell's `str.tostring` format mask cannot be mapped", () => {
        const { scaffold, diagnostics } = run(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 1, 1)",
                '    table.cell(t, 0, 0, str.tostring(close, "#,###"))',
            ].join("\n"),
        );
        expect(diagnostics.toArray().map((d) => d.code)).toContain(
            "pine-converter/transform/str-format-not-mapped",
        );
        // The unmapped form is left as the verbatim `str.*` call source.
        expect(cellsOf(scaffold)).toContain("str.tostring");
    });

    it("leaves a non-iterator identifier untouched in an unrolled body", () => {
        const { scaffold } = run(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 1, 1)",
                "    for i = 0 to 0",
                "        table.cell(t, 0, i, str.tostring(close))",
            ].join("\n"),
        );
        expect(cellsOf(scaffold)).toContain("String(bar.close)");
    });

    it("skips non-call statements inside an unrolled loop body", () => {
        const { scaffold } = run(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 1, 1)",
                "    for i = 0 to 0",
                "        x = i",
                '        table.cell(t, 0, i, "r")',
            ].join("\n"),
        );
        expect(cellsOf(scaffold)).toContain('text: "r"');
    });
});

describe("transformTables — remaining branch coverage", () => {
    it("maps the text_valign named arg", () => {
        const { scaffold } = run(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 1, 1)",
                '    table.cell(t, 0, 0, "x", text_valign=text.align_top)',
            ].join("\n"),
        );
        expect(cellsOf(scaffold)).toContain('textValign: "top"');
    });

    it("reads a unary-literal cell index", () => {
        const { scaffold, diagnostics } = run(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 2, 1)",
                '    table.cell(t, +1, 0, "x")',
            ].join("\n"),
        );
        expect(codes(diagnostics)).not.toContain(
            "pine-converter/transform/table-cell-out-of-bounds",
        );
        expect(cellsOf(scaffold)).toContain('text: "x"');
    });

    it("falls back to top-right when the position enum has no string target", () => {
        const { scaffold } = run(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(extend.both, 1, 1)",
                '    table.cell(t, 0, 0, "x")',
            ].join("\n"),
        );
        const drawStmt = scaffold.computeBody.statements.find((s) => s.includes("draw.table"));
        expect(drawStmt).toContain('position: "top-right"');
    });

    it("ignores a non-member-callee statement targeting the handle", () => {
        const { scaffold } = run(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 1, 1)",
                "    plot(t)",
                '    table.cell(t, 0, 0, "x")',
            ].join("\n"),
        );
        expect(cellsOf(scaffold)).toContain('text: "x"');
    });

    it("collects cell writes from else-if and else branches", () => {
        const { scaffold } = run(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 1, 3)",
                '    table.cell(t, 0, 0, "a")',
                "else if barstate.isnew",
                '    table.cell(t, 0, 1, "b")',
                "else",
                '    table.cell(t, 0, 2, "c")',
            ].join("\n"),
        );
        const cells = cellsOf(scaffold);
        expect(cells).toContain('text: "a"');
        expect(cells).toContain('text: "b"');
        expect(cells).toContain('text: "c"');
    });

    it("skips a non-table-write call inside an unrolled loop", () => {
        const { scaffold } = run(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 1, 1)",
                "    for i = 0 to 0",
                "        plot(close)",
                '        table.cell(t, 0, i, "x")',
            ].join("\n"),
        );
        expect(cellsOf(scaffold)).toContain('text: "x"');
    });

    it("errors on a unary-literal row past the declared count", () => {
        const { diagnostics } = run(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 1, 1)",
                '    table.cell(t, 0, +3, "x")',
            ].join("\n"),
        );
        expect(codes(diagnostics)).toContain("pine-converter/transform/table-cell-out-of-bounds");
    });

    it("skips a merge whose far corner is non-literal but still warns", () => {
        const { scaffold, diagnostics } = run(
            [
                "n = 1",
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 2, 1)",
                '    table.cell(t, 0, 0, "kept")',
                '    table.cell(t, 1, 0, "stays")',
                "    table.merge_cells(t, 0, 0, n, 0)",
            ].join("\n"),
        );
        expect(codes(diagnostics)).toContain("pine-converter/transform/table-merge-fallback");
        // Non-literal bound: no cells blanked, both writes survive.
        const cells = cellsOf(scaffold);
        expect(cells).toContain('text: "kept"');
        expect(cells).toContain('text: "stays"');
    });

    it("treats a cell write missing its row arg as a no-op", () => {
        const { scaffold } = run(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 1, 1)",
                "    table.cell(t, 0)",
                '    table.cell(t, 0, 0, "x")',
            ].join("\n"),
        );
        expect(cellsOf(scaffold)).toContain('text: "x"');
    });

    it("ignores a table.cell whose handle arg is not the tracked identifier", () => {
        const { scaffold } = run(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 1, 1)",
                '    table.cell(other, 0, 0, "ignored")',
                '    table.cell(t, 0, 0, "x")',
            ].join("\n"),
        );
        const cells = cellsOf(scaffold);
        expect(cells).toContain('text: "x"');
        expect(cells).not.toContain('text: "ignored"');
    });

    it("ignores a table.cell with no handle arg", () => {
        const { scaffold } = run(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 1, 1)",
                "    table.cell()",
                '    table.cell(t, 0, 0, "x")',
            ].join("\n"),
        );
        expect(cellsOf(scaffold)).toContain('text: "x"');
    });

    it("skips a non-literal cell column index built from an expression", () => {
        const { scaffold } = run(
            [
                "k = 1",
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 2, 1)",
                '    table.cell(t, k + 1, 0, "x")',
            ].join("\n"),
        );
        expect(cellsOf(scaffold)).toContain('{ text: "" }');
    });

    it("infers dimensions when table.new omits the column/row args", () => {
        const { scaffold } = run(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left)",
                '    table.cell(t, 0, 0, "x")',
            ].join("\n"),
        );
        expect(cellsOf(scaffold)).toContain('text: "x"');
    });

    it("reads a negative-unary literal index (covers the minus branch)", () => {
        const { scaffold } = run(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 1, 1)",
                '    table.cell(t, -0, 0, "x")',
            ].join("\n"),
        );
        expect(cellsOf(scaffold)).toContain('text: "x"');
    });

    it("rejects a `not`-prefixed (non +/-) unary index", () => {
        const { scaffold } = run(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 1, 1)",
                '    table.cell(t, not 0, 0, "x")',
            ].join("\n"),
        );
        // The index is not a literal int, so the write is skipped.
        expect(cellsOf(scaffold)).toContain('{ text: "" }');
    });

    it("treats table.clear inside an unrolled loop as a no-op write", () => {
        const { diagnostics } = run(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 1, 1)",
                "    for i = 0 to 0",
                "        table.clear(t, 0, 0, 0, 0)",
                '        table.cell(t, 0, i, "x")',
            ].join("\n"),
        );
        // The loop writes the handle (cell), and `table.clear` is recognised
        // as a no-op when the body is unrolled.
        expect(codes(diagnostics)).toContain("pine-converter/transform/table-clear-noop");
    });

    it("ignores an unrelated table.* method against the handle", () => {
        const { scaffold } = run(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 1, 1)",
                "    table.set_position(t, position.bottom_left)",
                '    table.cell(t, 0, 0, "x")',
            ].join("\n"),
        );
        expect(cellsOf(scaffold)).toContain('text: "x"');
    });

    it("warns on a merge missing both corners", () => {
        const { diagnostics } = run(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 1, 1)",
                '    table.cell(t, 0, 0, "x")',
                "    table.merge_cells(t)",
            ].join("\n"),
        );
        expect(codes(diagnostics)).toContain("pine-converter/transform/table-merge-fallback");
    });

    it("ignores a table.cell with only the handle arg", () => {
        const { scaffold } = run(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 1, 1)",
                "    table.cell(t)",
                '    table.cell(t, 0, 0, "x")',
            ].join("\n"),
        );
        expect(cellsOf(scaffold)).toContain('text: "x"');
    });

    it("warns but blanks nothing on a merge missing its corner args", () => {
        const { scaffold, diagnostics } = run(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 2, 1)",
                '    table.cell(t, 0, 0, "a")',
                '    table.cell(t, 1, 0, "b")',
                "    table.merge_cells(t, 0, 0)",
            ].join("\n"),
        );
        expect(codes(diagnostics)).toContain("pine-converter/transform/table-merge-fallback");
        const cells = cellsOf(scaffold);
        expect(cells).toContain('text: "a"');
        expect(cells).toContain('text: "b"');
    });
});

describe("transformTables — multi-init + defensive arms", () => {
    it("warns on a second table.new into the same handle and keeps the first", () => {
        const { scaffold, diagnostics } = run(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_right, 1, 1)",
                "if barstate.isfirst",
                "    t := table.new(position.bottom_left, 1, 1)",
                '    table.cell(t, 0, 0, "x")',
            ].join("\n"),
        );
        expect(codes(diagnostics)).toContain("pine-converter/transform/table-multi-init");
        expect(scaffold.handleSlots).toEqual([{ name: "t", kind: "table", compact: false }]);
        const drawStmt = scaffold.computeBody.statements.find((s) => s.includes("draw.table"));
        expect(drawStmt).toContain('position: "top-right"');
    });

    it("ignores a non-camp-a / non-table drawing site (synthetic)", () => {
        const src = '//@version=6\nindicator("X")\nplot(close)\n';
        const analysis = analyze(parseStatements(lex(src).tokens).script);
        const decl = analysis.script.declaration;
        if (decl === null || decl.kind !== "indicator-declaration") {
            throw new Error("expected an indicator declaration");
        }
        const diagnostics = new DiagnosticCollector();
        const scaffold = transformDeclaration(decl, analysis, diagnostics);
        const fakeCall: CallExpression = {
            kind: "call-expression",
            callee: {
                kind: "member-access-expression",
                head: null,
                chain: ["table", "new"],
                span: SPAN,
            } as ExpressionNode,
            args: [],
            span: SPAN,
        };
        const fakeSite: DrawingCallSite = {
            call: fakeCall,
            constructor: "table.new",
            handleType: "table",
            // A `table.new` that did not classify camp-a (e.g. a dynamic
            // collection) is filtered out — no slot, no diagnostics.
            camp: { kind: "camp-c-unbounded", reasoning: "synthetic" },
            span: SPAN,
        };
        const fakeAnalysis = { ...analysis, drawingSites: [fakeSite] };
        transformTables(fakeAnalysis, scaffold, diagnostics);
        expect(scaffold.handleSlots).toEqual([]);
        expect(diagnostics.size).toBe(0);
    });
});

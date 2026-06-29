// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "../semantic/index.js";
import { transformCampA } from "./campA.js";
import { transformDeclaration } from "./declaration.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import type { EmitContext } from "./emitContext.js";
import type { ScriptScaffold } from "./ir.js";
import { type SetterCall, foldSetters, renderEnumTarget } from "./setterFold.js";

function bodyOf(body: string): { scaffold: ScriptScaffold; diagnostics: DiagnosticCollector } {
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
    for (const site of analysis.drawingSites) {
        if (site.camp.kind === "camp-a") {
            transformCampA(site, analysis, scaffold, diagnostics);
        }
    }
    return { scaffold, diagnostics };
}

// A synthetic `line.set_*(handle, …)` call expression for unit-level folding.
function setterCall(method: string, args: readonly string[]): SetterCall {
    const src = `//@version=6\nindicator("X")\nline.${method}(lvl, ${args.join(", ")})\nplot(close)\n`;
    const script = parseStatements(lex(src).tokens).script;
    const stmt = script.body[0];
    if (stmt.kind !== "expression-statement" || stmt.expression.kind !== "call-expression") {
        throw new Error("expected a call expression statement");
    }
    return { method, call: stmt.expression };
}

describe("foldSetters", () => {
    const emit: EmitContext = {
        annotations: new Map(),
        inputNames: new Set(),
        localNames: new Set(),
        stateSlots: new Map(),
    };
    const noWarn = (): void => {};

    it("merges multiple setters in one block into a single patch", () => {
        const patch = foldSetters(
            [setterCall("set_color", ["color.red"]), setterCall("set_width", ["3"])],
            "line",
            emit,
            noWarn,
        );
        expect(patch).toBe('{ style: { color: "#FF5252", lineWidth: 3 } }');
    });

    it("collapses set_xy1 + set_xy2 into an anchors array", () => {
        const patch = foldSetters(
            [
                setterCall("set_xy1", ["bar_index", "close"]),
                setterCall("set_xy2", ["bar_index", "open"]),
            ],
            "line",
            emit,
            noWarn,
        );
        expect(patch).toContain("anchors: [");
        expect(patch).toContain("bar.point(0, bar.close)");
        expect(patch).toContain("bar.point(0, bar.open)");
    });

    it("returns null when no setter folds", () => {
        expect(foldSetters([setterCall("set_nonsense", ["1"])], "line", emit, noWarn)).toBeNull();
    });

    it("returns null for an unmapped handle family", () => {
        expect(
            foldSetters([setterCall("set_color", ["color.red"])], "linefill", emit, noWarn),
        ).toBeNull();
    });

    it("drops a deep single-coordinate setter with set-path-unsupported", () => {
        let warned: string | null = null;
        const patch = foldSetters([setterCall("set_y1", ["close"])], "line", emit, (code) => {
            warned = code;
        });
        expect(patch).toBeNull();
        expect(warned).toBe("set-path-unsupported");
    });

    it("drops an unmapped-enum value while folding the rest", () => {
        const patch = foldSetters(
            [setterCall("set_style", ["text.format_bold"]), setterCall("set_width", ["2"])],
            "line",
            emit,
            noWarn,
        );
        expect(patch).toBe("{ style: { lineWidth: 2 } }");
    });

    it("ignores a whole-anchor setter missing its second coordinate", () => {
        const patch = foldSetters([setterCall("set_xy1", ["bar_index"])], "line", emit, noWarn);
        expect(patch).toContain("price: Number.NaN");
    });
});

describe("renderEnumTarget", () => {
    it("quotes a string target", () => {
        expect(renderEnumTarget("dashed")).toBe('"dashed"');
    });

    it("renders a partial-object target", () => {
        expect(renderEnumTarget({ extendLeft: true, extendRight: false })).toBe(
            "{ extendLeft: true, extendRight: false }",
        );
    });

    it("returns null for the REJECT target", () => {
        expect(renderEnumTarget(null)).toBeNull();
    });
});

describe("setter-fold via campA", () => {
    it("folds two setters in the same block into one update", () => {
        const { scaffold } = bodyOf(
            [
                "var line lvl = na",
                "if barstate.islast",
                "    lvl := line.new(bar_index, close, bar_index, close)",
                "    line.set_color(lvl, color.red)",
                "    line.set_width(lvl, 3)",
            ].join("\n"),
        );
        const updates = scaffold.computeBody.statements.filter((s) => s.includes(".update("));
        expect(updates).toHaveLength(1);
        expect(updates[0]).toContain('color: "#FF5252"');
        expect(updates[0]).toContain("lineWidth: 3");
    });
});

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { Declaration } from "../ast/script.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "../semantic/index.js";
import { transformDeclaration } from "./declaration.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import type { ScriptScaffold } from "./ir.js";
import { scanMaps } from "./mapCollection.js";
import { transformOther } from "./other.js";

type ConvertibleDecl = Extract<
    Declaration,
    { kind: "indicator-declaration" | "strategy-declaration" }
>;

function run(body: string): { scaffold: ScriptScaffold; diagnostics: DiagnosticCollector } {
    const src = `//@version=6\nindicator("X")\n${body}\n`;
    const analysis = analyze(parseStatements(lex(src).tokens).script);
    const decl = analysis.script.declaration;
    if (
        decl === null ||
        decl.kind === "library-declaration" ||
        decl.kind === "import-declaration"
    ) {
        throw new Error("expected an indicator declaration in the fixture");
    }
    const diagnostics = new DiagnosticCollector();
    const scaffold = transformDeclaration(decl as ConvertibleDecl, analysis, diagnostics);
    transformOther(analysis, scaffold, diagnostics);
    return { scaffold, diagnostics };
}

function slots(body: string): readonly { name: string; initExpr: string }[] {
    return run(body).scaffold.stateSlots;
}

function stmts(body: string): readonly string[] {
    return run(body).scaffold.computeBody.statements;
}

function codes(body: string): string[] {
    return run(body)
        .diagnostics.toArray()
        .map((d) => d.code);
}

const MAP = "var map<float, float> levels = map.new<float, float>()\n";

describe("map collection — keyed slot lowering", () => {
    it("lowers a `var map<float, float>` to `state.map<number, number>(1000)` with a cap-synthesis info", () => {
        expect(slots(MAP)).toEqual([
            { name: "levels", initExpr: "state.map<number, number>(1000)" },
        ]);
        expect(codes(MAP)).toEqual(["pine-converter/transform/map-capacity-synthesized"]);
    });

    it("maps put / get / contains / remove / size / clear onto the slot surface", () => {
        const body = `${MAP}k = 1
map.put(levels, k, 2)
a = map.get(levels, k)
b = map.contains(levels, k) ? 1 : 0
c = map.size(levels)
map.remove(levels, k)
map.clear(levels)
plot(a + b + c)`;
        expect(stmts(body)).toEqual([
            "let k = 1;",
            "levels.set(k, 2);",
            "let a = (levels.get(k) ?? Number.NaN);",
            "let b = levels.has(k) ? 1 : 0;",
            "let c = levels.size;",
            "levels.delete(k);",
            "levels.clear();",
            "plot((a + b) + c);",
        ]);
    });

    it("na-bridges a `map.get` read so a downstream numeric expression sees NaN", () => {
        const body = `${MAP}plot(map.get(levels, 5))`;
        expect(stmts(body)).toContain("plot((levels.get(5) ?? Number.NaN));");
    });

    it("lowers a no-annotation `map.new` (default-numeric value)", () => {
        const body = "var levels = map.new<float, float>()\nmap.put(levels, 1, close)";
        expect(slots(body)).toEqual([
            { name: "levels", initExpr: "state.map<number, number>(1000)" },
        ]);
    });

    it("lowers a `varip` map the same as `var`", () => {
        const body = "varip map<int, float> m = map.new<int, float>()\nmap.put(m, 1, close)";
        expect(slots(body)).toEqual([{ name: "m", initExpr: "state.map<number, number>(1000)" }]);
    });
});

describe("map collection — rejections and edge cases", () => {
    it("rejects a non-numeric value `map<string, string>` with `map-collection-non-numeric`", () => {
        const body =
            'var map<string, string> tags = map.new<string, string>()\nmap.put(tags, "a", "b")';
        expect(slots(body)).toEqual([]);
        expect(codes(body)).toContain("pine-converter/transform/map-collection-non-numeric");
    });

    it("emits a placeholder + diagnostic for the no-iterator `map.keys`/`map.values`", () => {
        const keysBody = `${MAP}x = map.keys(levels)\nplot(close)`;
        expect(stmts(keysBody)).toContain(
            "let x = Number.NaN /* TODO: map.keys not supported in chartlang */;",
        );
        expect(codes(keysBody)).toContain("pine-converter/transform/map-builtin-not-mapped");

        const valuesBody = `${MAP}y = map.values(levels)\nplot(close)`;
        expect(stmts(valuesBody)).toContain(
            "let y = Number.NaN /* TODO: map.values not supported in chartlang */;",
        );
    });

    it("emits a placeholder for an unmapped `map.*` member over a slot", () => {
        const body = `${MAP}z = map.copy(levels)\nplot(close)`;
        expect(stmts(body)).toContain(
            "let z = Number.NaN /* TODO: map.copy not supported in chartlang */;",
        );
        expect(codes(body)).toContain("pine-converter/transform/map-builtin-not-mapped");
    });

    it("does not lower a map declared only inside an `if` block", () => {
        const body = "if close > open\n    m = map.new<float, float>()\n    map.put(m, 1, close)";
        expect(slots(body).some((s) => s.initExpr.startsWith("state.map"))).toBe(false);
    });

    it("leaves a `map.*` call whose first arg is not a registered slot to the generic path", () => {
        // `other` is not a top-level `var map` decl, so it is not a registered
        // slot; the rewrite returns null and the generic emitter runs.
        const body = `${MAP}plot(map.size(other))`;
        expect(stmts(body)).toContain("plot(map.size(other));");
    });

    it("does not swallow a scalar `var` next to a map", () => {
        const body = `var float prev = 0.0\n${MAP}prev := map.get(levels, 1)`;
        const out = slots(body);
        expect(out).toContainEqual({ name: "levels", initExpr: "state.map<number, number>(1000)" });
        expect(out).toContainEqual({ name: "prev", initExpr: "state.float(0.0)" });
    });
});

describe("scanMaps", () => {
    function scan(body: string) {
        const src = `//@version=6\nindicator("X")\n${body}\n`;
        const analysis = analyze(parseStatements(lex(src).tokens).script);
        return scanMaps(analysis, new Set());
    }

    it("partitions slots / nonNumeric with the synthesized cap + decl spans", () => {
        const result = scan(MAP);
        expect(result.slots.get("levels")?.cap).toBe(1000);
        expect(result.nonNumeric.size).toBe(0);
    });

    it("records the non-numeric decl span", () => {
        const result = scan("var map<string, bool> flags = map.new<string, bool>()");
        expect(result.nonNumeric.has("flags")).toBe(true);
        expect(result.nonNumeric.get("flags")?.startLine).toBe(3);
    });

    it("ignores a non-`map.new` declaration", () => {
        const result = scan("var n = 5");
        expect(result.slots.size).toBe(0);
        expect(result.nonNumeric.size).toBe(0);
    });

    it("skips a name already owned by another transform", () => {
        const src = `//@version=6\nindicator("X")\n${MAP}`;
        const analysis = analyze(parseStatements(lex(src).tokens).script);
        const result = scanMaps(analysis, new Set(["levels"]));
        expect(result.slots.size).toBe(0);
    });
});

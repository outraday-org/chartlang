// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { CallArgument } from "../ast/index.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "../semantic/index.js";
import { transformCampA } from "./campA.js";
import { transformDeclaration } from "./declaration.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import type { ScriptScaffold } from "./ir.js";
import { resolveYloc } from "./ylocResolve.js";

function runCampA(body: string): { scaffold: ScriptScaffold; diagnostics: DiagnosticCollector } {
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

// A synthetic `yloc=<chain>` named argument.
function ylocArg(chain: readonly string[]): CallArgument {
    const span = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 } as const;
    return {
        name: "yloc",
        value: { kind: "member-access-expression", head: null, chain, span },
        span,
    };
}

describe("resolveYloc", () => {
    it("returns abovebar padding arithmetic", () => {
        const r = resolveYloc([ylocArg(["yloc", "abovebar"])]);
        expect(r?.priceExpr).toBe("bar.high + ((bar.high - bar.low) * 0.001)");
        expect(r?.approximated).toBe(true);
    });

    it("returns belowbar padding arithmetic", () => {
        const r = resolveYloc([ylocArg(["yloc", "belowbar"])]);
        expect(r?.priceExpr).toBe("bar.low - ((bar.high - bar.low) * 0.001)");
    });

    it("returns null for yloc.price", () => {
        expect(resolveYloc([ylocArg(["yloc", "price"])])).toBeNull();
    });

    it("returns null for a non-member yloc value", () => {
        const span = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 } as const;
        const arg: CallArgument = {
            name: "yloc",
            value: { kind: "identifier-expression", name: "x", span },
            span,
        };
        expect(resolveYloc([arg])).toBeNull();
    });

    it("returns null when no yloc arg is present", () => {
        expect(resolveYloc([])).toBeNull();
    });
});

describe("yloc via campA", () => {
    it("emits abovebar price arithmetic and one padding-approximated info", () => {
        const { scaffold, diagnostics } = runCampA(
            [
                "var label lbl = na",
                "if barstate.islast",
                "    lbl := label.new(bar_index, high, yloc=yloc.abovebar)",
            ].join("\n"),
        );
        expect(scaffold.computeBody.statements[0]).toContain(
            "bar.high + ((bar.high - bar.low) * 0.001)",
        );
        const codes = diagnostics.toArray().map((d) => d.code);
        expect(codes.filter((c) => c.endsWith("yloc-padding-approximated"))).toHaveLength(1);
    });
});

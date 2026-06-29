// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { lex } from "../lexer/index.js";
import { parseStatements } from "./parse.js";

function parse(source: string) {
    return parseStatements(lex(source).tokens);
}

function codes(result: ReturnType<typeof parse>): string[] {
    return result.diagnostics.map((d) => d.code);
}

// Value-form `switch` is supported (lowered to a chained ternary), but ONLY when
// every arm yields a single expression. A multi-statement / multi-assignment arm
// body is the residual unsupported sub-shape: it keeps emitting one clean
// `switch-expression-unsupported` and the whole `switch` degrades to a
// placeholder so the next sibling statement still parses.
describe("value-form switch residual reject", () => {
    it("rejects a multi-statement (block) arm body and continues", () => {
        const result = parse(
            "//@version=6\nindicator()\nma = switch sel\n" +
                "    1 =>\n        x = 1\n        x + 1\n    2 => 2\nplot(close)\n",
        );
        expect(codes(result)).toEqual(["pine-converter/parse/switch-expression-unsupported"]);
        expect(result.script.body.map((s) => s.kind)).toEqual([
            "assignment",
            "expression-statement",
        ]);
    });

    it("rejects an empty (multi-line) arm body with no indented block", () => {
        const result = parse(
            "//@version=6\nindicator()\nma = switch sel\n" +
                '    "A" =>\n    "B" => 2\nplot(close)\n',
        );
        expect(codes(result)).toEqual(["pine-converter/parse/switch-expression-unsupported"]);
    });

    it("rejects a comma-separated multi-assignment arm body", () => {
        const result = parse(
            "//@version=6\nindicator()\nma = switch sel\n" +
                '    "A" => a := 1, b := 2\n    "B" => 3\nplot(close)\n',
        );
        expect(codes(result)).toEqual(["pine-converter/parse/switch-expression-unsupported"]);
    });

    it("rejects a single `:=` assignment arm (a statement, not an expression)", () => {
        const result = parse(
            "//@version=6\nindicator()\nma = switch sel\n" +
                '    "A" => b := 1\n    "B" => 2\nplot(close)\n',
        );
        expect(codes(result)).toEqual(["pine-converter/parse/switch-expression-unsupported"]);
    });

    it("emits the diagnostic ONCE even when several arms are unsupported", () => {
        const result = parse(
            "//@version=6\nindicator()\nma = switch sel\n" +
                '    "A" => a := 1\n    "B" => b := 2\nplot(close)\n',
        );
        expect(codes(result)).toEqual(["pine-converter/parse/switch-expression-unsupported"]);
    });
});

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

// A `switch` used as a value is not yet supported (the Pratt parser models
// `switch` only as a statement). The parser must emit exactly one clean
// `switch-expression-unsupported` reject and recover the switch header + its
// indented arm block so the next sibling statement still parses.
describe("switch-as-value hard-reject", () => {
    it("rejects a typed declaration whose initializer is a `switch` and continues", () => {
        const result = parse(
            '//@version=6\nindicator()\nfloat ma = switch sel\n    "A" => 1\n    "B" => 2\nplot(close)\n',
        );
        expect(codes(result)).toEqual(["pine-converter/parse/switch-expression-unsupported"]);
        // The placeholder declaration is registered; `plot(close)` resumes.
        expect(result.script.body.map((s) => s.kind)).toEqual([
            "variable-declaration",
            "expression-statement",
        ]);
    });

    it("rejects an untyped assignment whose value is a `switch` and continues", () => {
        const result = parse(
            '//@version=6\nindicator()\nma = switch sel\n    "A" => 1\n    "B" => 2\nplot(close)\n',
        );
        expect(codes(result)).toEqual(["pine-converter/parse/switch-expression-unsupported"]);
        expect(result.script.body.map((s) => s.kind)).toEqual([
            "assignment",
            "expression-statement",
        ]);
    });

    it("rejects a tuple destructuring whose value is a `switch` and continues", () => {
        const result = parse(
            '//@version=6\nindicator()\n[a, b] = switch sel\n    "A" => [1, 2]\n    "B" => [3, 4]\nplot(close)\n',
        );
        expect(codes(result)).toEqual(["pine-converter/parse/switch-expression-unsupported"]);
        expect(result.script.body.map((s) => s.kind)).toEqual([
            "tuple-declaration",
            "expression-statement",
        ]);
    });
});

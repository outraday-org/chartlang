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

describe("UDT / method / import hard-reject", () => {
    it("rejects a `type` block and parses the next statement cleanly", () => {
        const result = parse(
            "//@version=6\nindicator()\ntype Point\n    float x\n    float y\nplot(close)\n",
        );
        expect(codes(result)).toEqual(["pine-converter/parse/unsupported-udt"]);
        expect(result.script.body).toHaveLength(1);
        expect(result.script.body[0].kind).toBe("expression-statement");
    });

    it("rejects a `method` block and continues", () => {
        const result = parse(
            "//@version=6\nindicator()\nmethod area(Box this) =>\n    this.w * this.h\nplot(close)\n",
        );
        expect(codes(result)).toEqual(["pine-converter/parse/unsupported-method"]);
        expect(result.script.body).toHaveLength(1);
    });

    it("rejects a library `import` on a single line and continues", () => {
        const result = parse("//@version=6\nindicator()\nimport user/lib/1 as L\nplot(close)\n");
        expect(codes(result)).toEqual(["pine-converter/parse/unsupported-library-import"]);
        expect(result.script.body).toHaveLength(1);
    });

    it("discards a `type` block with nested indentation", () => {
        const result = parse(
            "//@version=6\nindicator()\ntype T\n    int a\n    line b\nx := 1\n",
        );
        expect(codes(result)).toEqual(["pine-converter/parse/unsupported-udt"]);
        expect(result.script.body[0].kind).toBe("assignment");
    });
});

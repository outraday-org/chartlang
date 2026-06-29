// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { ExpressionNode, Statement } from "../ast/index.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "./parse.js";

function parse(source: string) {
    return parseStatements(lex(source).tokens);
}

function codes(result: ReturnType<typeof parse>): string[] {
    return result.diagnostics.map((d) => d.code);
}

// The value-form `switch` initializer of the first body statement.
function initializerOf(stmt: Statement): ExpressionNode | undefined {
    if (stmt.kind === "variable-declaration" || stmt.kind === "tuple-declaration") {
        return stmt.initializer;
    }
    if (stmt.kind === "assignment") {
        return stmt.value;
    }
    return undefined;
}

describe("value-form switch parsing", () => {
    it("parses a subject form into a SwitchExpression with arm test/value pairs", () => {
        const result = parse(
            "//@version=6\nindicator()\nfloat ma = switch sel\n" +
                '    "SMA" => sma\n    "EMA" => ema\nplot(close)\n',
        );
        expect(codes(result)).toEqual([]);
        const init = initializerOf(result.script.body[0]);
        expect(init?.kind).toBe("switch-expression");
        if (init?.kind === "switch-expression") {
            expect(init.subject?.kind).toBe("identifier-expression");
            expect(init.cases).toHaveLength(2);
            expect(init.cases[0].test?.kind).toBe("literal-expression");
            expect(init.cases[0].value.kind).toBe("identifier-expression");
        }
    });

    it("parses the subject-less boolean form with a wildcard default arm", () => {
        const result = parse(
            "//@version=6\nindicator()\nx = switch\n" + "    c => 1\n    => 2\nplot(close)\n",
        );
        expect(codes(result)).toEqual([]);
        const init = initializerOf(result.script.body[0]);
        expect(init?.kind).toBe("switch-expression");
        if (init?.kind === "switch-expression") {
            expect(init.subject).toBeNull();
            expect(init.cases).toHaveLength(2);
            expect(init.cases[0].test?.kind).toBe("identifier-expression");
            expect(init.cases[1].test).toBeNull();
        }
    });

    it("parses a value switch nested in a larger expression", () => {
        const result = parse(
            "//@version=6\nindicator()\ny = base + switch sel\n" +
                '    "A" => 1\n    "B" => 2\nplot(close)\n',
        );
        expect(codes(result)).toEqual([]);
        const init = initializerOf(result.script.body[0]);
        expect(init?.kind).toBe("binary-expression");
        if (init?.kind === "binary-expression") {
            expect(init.right.kind).toBe("switch-expression");
        }
    });

    it("parses a value switch assigned via `:=`", () => {
        const result = parse(
            "//@version=6\nindicator()\nx := switch sel\n" +
                '    "A" => 1\n    "B" => 2\nplot(close)\n',
        );
        expect(codes(result)).toEqual([]);
        const stmt = result.script.body[0];
        expect(stmt.kind).toBe("assignment");
        expect(initializerOf(stmt)?.kind).toBe("switch-expression");
    });

    it("parses a value switch on a tuple destructuring head", () => {
        const result = parse(
            "//@version=6\nindicator()\n[a, b] = switch sel\n" +
                '    "A" => [1, 2]\n    "B" => [3, 4]\nplot(close)\n',
        );
        expect(codes(result)).toEqual([]);
        const stmt = result.script.body[0];
        expect(stmt.kind).toBe("tuple-declaration");
        expect(initializerOf(stmt)?.kind).toBe("switch-expression");
    });

    it("parses a switch whose subject is an arbitrary expression", () => {
        const result = parse(
            "//@version=6\nindicator()\nx = switch math.sign(d)\n" +
                "    1 => up\n    -1 => down\nplot(close)\n",
        );
        expect(codes(result)).toEqual([]);
        const init = initializerOf(result.script.body[0]);
        expect(init?.kind).toBe("switch-expression");
        if (init?.kind === "switch-expression") {
            expect(init.subject?.kind).toBe("call-expression");
        }
    });

    it("tolerates a blank line after the last value-switch arm", () => {
        // The cf_ma helper ends its `switch` block with a blank line before the
        // next top-level statement; the stray `newline` between the last arm and
        // the `dedent` must not parse as a malformed arm (false
        // `switch-expression-unsupported`).
        const result = parse(
            "//@version=6\nindicator()\nfloat ma = switch sel\n" +
                '    "SMA" => sma\n    "EMA" => ema\n\nplot(close)\n',
        );
        expect(codes(result)).toEqual([]);
        const init = initializerOf(result.script.body[0]);
        expect(init?.kind).toBe("switch-expression");
        if (init?.kind === "switch-expression") {
            expect(init.cases).toHaveLength(2);
        }
    });

    it("tolerates a comment-only line after the last value-switch arm", () => {
        const result = parse(
            "//@version=6\nindicator()\nfloat ma = switch sel\n" +
                '    "SMA" => sma\n    "EMA" => ema\n// trailing note\nplot(close)\n',
        );
        expect(codes(result)).toEqual([]);
        const init = initializerOf(result.script.body[0]);
        expect(init?.kind).toBe("switch-expression");
        if (init?.kind === "switch-expression") {
            expect(init.cases).toHaveLength(2);
        }
    });

    it("recovers from a value switch missing its indented body", () => {
        const result = parse("//@version=6\nindicator()\nma = switch sel\nplot(close)\n");
        expect(codes(result)).toContain("pine-converter/parse/expected-token");
        const init = initializerOf(result.script.body[0]);
        expect(init?.kind).toBe("unknown-expression");
        expect(result.script.body.map((s) => s.kind)).toEqual([
            "assignment",
            "expression-statement",
        ]);
    });
});

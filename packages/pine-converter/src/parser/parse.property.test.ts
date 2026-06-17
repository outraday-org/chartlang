// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { SourceSpan } from "../index.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "./parse.js";

// Pinned seed: deterministic across runs so a flaky failure reproduces
// identically for everyone.
const SEED = 0x9a2;

function isSpan(value: unknown): value is SourceSpan {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const record = value as Record<string, unknown>;
    return (
        typeof record.startLine === "number" &&
        typeof record.startColumn === "number" &&
        typeof record.endLine === "number" &&
        typeof record.endColumn === "number"
    );
}

/** True when point (line, col) is at or after the start of `span`. */
function afterStart(line: number, col: number, span: SourceSpan): boolean {
    if (line !== span.startLine) {
        return line > span.startLine;
    }
    return col >= span.startColumn;
}

/** True when point (line, col) is at or before the end of `span`. */
function beforeEnd(line: number, col: number, span: SourceSpan): boolean {
    if (line !== span.endLine) {
        return line < span.endLine;
    }
    return col <= span.endColumn;
}

function within(child: SourceSpan, parent: SourceSpan): boolean {
    return (
        afterStart(child.startLine, child.startColumn, parent) &&
        beforeEnd(child.endLine, child.endColumn, parent)
    );
}

/**
 * Walk the tree below `node` (a record with a `span`); every descendant
 * node's span must lie within `node.span`. Recurses into nested nodes,
 * skipping the raw `tokens` array of `UnknownExpression`.
 */
function assertContainment(node: Record<string, unknown>): void {
    const parentSpan = node.span;
    if (!isSpan(parentSpan)) {
        return;
    }
    const visit = (value: unknown): void => {
        if (Array.isArray(value)) {
            for (const item of value) {
                visit(item);
            }
            return;
        }
        if (typeof value !== "object" || value === null) {
            return;
        }
        const record = value as Record<string, unknown>;
        if (isSpan(record.span)) {
            expect(within(record.span, parentSpan)).toBe(true);
            assertContainment(record);
            return;
        }
        for (const [key, child] of Object.entries(record)) {
            if (key === "tokens") {
                continue;
            }
            visit(child);
        }
    };
    for (const [key, child] of Object.entries(node)) {
        if (key === "span" || key === "tokens") {
            continue;
        }
        visit(child);
    }
}

const statement = fc.constantFrom(
    "x := 1\n",
    "var float y = 2.0\n",
    "plot(close)\n",
    "if a\n    x := 1\n",
    "for i = 0 to 9\n    plot(i)\n",
);

describe("parseStatements — properties", () => {
    it("nests every node's span inside its parent's span", () => {
        fc.assert(
            fc.property(fc.array(statement, { minLength: 0, maxLength: 6 }), (statements) => {
                const source = `//@version=6\nindicator()\n${statements.join("")}`;
                const { script } = parseStatements(lex(source).tokens);
                assertContainment(script as unknown as Record<string, unknown>);
            }),
            { seed: SEED },
        );
    });

    it("reports only missing-version-directive for an empty token stream", () => {
        const { script, diagnostics } = parseStatements(lex("").tokens);
        expect(diagnostics.map((d) => d.code)).toEqual([
            "pine-converter/parse/missing-version-directive",
        ]);
        expect(script.body).toHaveLength(0);
        expect(script.declaration).toBeNull();
    });
});

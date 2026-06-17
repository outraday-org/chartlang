// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { SourceSpan } from "../index.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "./parse.js";

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

/** Every `span` field reachable from a node, in pre-order. */
function collectSpans(value: unknown, out: SourceSpan[]): void {
    if (Array.isArray(value)) {
        for (const item of value) {
            collectSpans(item, out);
        }
        return;
    }
    if (typeof value !== "object" || value === null) {
        return;
    }
    const record = value as Record<string, unknown>;
    if (isSpan(record.span)) {
        out.push(record.span);
    }
    for (const [key, child] of Object.entries(record)) {
        // The captured raw tokens of an UnknownExpression carry their own
        // spans but are not AST nodes; skip them to keep the walk on the tree.
        if (key === "span" || key === "tokens") {
            continue;
        }
        collectSpans(child, out);
    }
}

function spanIsContiguous(span: SourceSpan): boolean {
    if (span.endLine < span.startLine) {
        return false;
    }
    if (span.endLine === span.startLine) {
        return span.endColumn >= span.startColumn;
    }
    return true;
}

const FIXTURES: readonly string[] = [
    '//@version=6\nindicator("hi")\n',
    "//@version=6\nindicator()\nvar float total = 0.0\nx := total\n",
    "//@version=6\nindicator()\nif a\n    x := 1\nelse if b\n    x := 2\nelse\n    x := 3\n",
    "//@version=6\nindicator()\nfor i = 0 to 9 by 2\n    plot(i)\n",
    "//@version=6\nindicator()\nswitch x\n    1 =>\n        y := 1\n    =>\n        y := 2\n",
];

describe("AST span integrity", () => {
    it("gives every node a contiguous span across all fixtures", () => {
        for (const source of FIXTURES) {
            const { script } = parseStatements(lex(source).tokens);
            const spans: SourceSpan[] = [];
            collectSpans(script, spans);
            expect(spans.length).toBeGreaterThan(0);
            for (const span of spans) {
                expect(spanIsContiguous(span)).toBe(true);
            }
        }
    });
});

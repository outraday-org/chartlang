// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { ExpressionNode } from "../ast/index.js";
import type { SourceSpan } from "../index.js";
import { lex } from "../lexer/index.js";
import { createContext } from "./context.js";
import { parseExpression } from "./expressions.js";
import { unparse } from "./unparse.js";

// Pinned seed so a flaky failure reproduces identically for everyone.
const SEED = 0x4e1;

function parse(source: string): ExpressionNode {
    return parseExpression(createContext(lex(source).tokens));
}

function isSpan(value: unknown): value is SourceSpan {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const r = value as Record<string, unknown>;
    return (
        typeof r.startLine === "number" &&
        typeof r.startColumn === "number" &&
        typeof r.endLine === "number" &&
        typeof r.endColumn === "number"
    );
}

function afterStart(line: number, col: number, span: SourceSpan): boolean {
    return line !== span.startLine ? line > span.startLine : col >= span.startColumn;
}

function beforeEnd(line: number, col: number, span: SourceSpan): boolean {
    return line !== span.endLine ? line < span.endLine : col <= span.endColumn;
}

function within(child: SourceSpan, parent: SourceSpan): boolean {
    return (
        afterStart(child.startLine, child.startColumn, parent) &&
        beforeEnd(child.endLine, child.endColumn, parent)
    );
}

// Every descendant node's span must lie within its parent's span. Skips the
// raw `tokens` array of an UnknownExpression (token spans are leaves).
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
            if (key !== "tokens") {
                visit(child);
            }
        }
    };
    for (const [key, child] of Object.entries(node)) {
        if (key !== "span" && key !== "tokens") {
            visit(child);
        }
    }
}

// A depth-bounded generator of well-formed Pine expression source fragments.
const atom = fc.constantFrom("close", "open", "a", "b", "42", "1.5", '"s"', "na", "true");

function exprOfDepth(depth: number): fc.Arbitrary<string> {
    if (depth <= 0) {
        return atom;
    }
    const sub = exprOfDepth(depth - 1);
    return fc.oneof(
        atom,
        fc.tuple(sub, sub).map(([l, r]) => `(${l} + ${r})`),
        fc.tuple(sub, sub).map(([l, r]) => `(${l} and ${r})`),
        sub.map((x) => `(-${x})`),
        sub.map((x) => `not ${x}`),
        fc.tuple(sub, sub, sub).map(([c, a, b]) => `(${c} ? ${a} : ${b})`),
        fc.tuple(sub, sub).map(([f, a]) => `ta.ema(${f}, ${a})`),
        sub.map((x) => `close[${x}]`),
        fc.tuple(sub, sub).map(([l, r]) => `[${l}, ${r}]`),
    );
}

const expr: fc.Arbitrary<string> = fc.integer({ min: 0, max: 4 }).chain(exprOfDepth);

describe("parseExpression — properties", () => {
    it("nests every node's span inside its parent's span", () => {
        fc.assert(
            fc.property(expr, (source) => {
                const node = parse(`${source}\n`);
                assertContainment(node as unknown as Record<string, unknown>);
            }),
            { seed: SEED, numRuns: 100 },
        );
    });

    it("round-trips lex → parse → unparse to a re-lex fixpoint", () => {
        fc.assert(
            fc.property(expr, (source) => {
                const once = unparse(parse(`${source}\n`));
                const twice = unparse(parse(`${once}\n`));
                expect(twice).toBe(once);
            }),
            { seed: SEED, numRuns: 100 },
        );
    });
});

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { TokenKind } from "./tokens.js";

// Operator/keyword texts that, when they LEAD a continuation line, continue
// the previous line's expression onto that line (leading-operator line
// continuation). This mirrors the parser's infix surface
// (`BINARY_PRECEDENCE` in `src/parser/expressions.ts`) PLUS the ternary
// `?`/`:`, and MINUS the prefix-only `not`. The two MUST stay in sync: a
// binary operator added to `BINARY_PRECEDENCE` must also be added here, or a
// multi-line expression using it would truncate. The lexer cannot import
// `BINARY_PRECEDENCE` directly (the parser depends on the lexer — a runtime
// back-import would be a layering cycle), so this is a deliberate mirror.
const CONTINUATION_LEAD_OPERATORS: ReadonlySet<string> = new Set([
    "or",
    "and",
    "==",
    "!=",
    "<",
    "<=",
    ">",
    ">=",
    "+",
    "-",
    "*",
    "/",
    "%",
    "?",
    ":",
]);

/**
 * Whether a token with the given `kind`/`text`, appearing as the first
 * significant token of a line, is an **infix/ternary lead** that continues
 * the previous line's expression (leading-operator line continuation).
 * `and`/`or` are `keyword` tokens; the arithmetic/comparison/ternary
 * operators are `operator` tokens — both live in one shared set, so a single
 * membership test decides it (mirroring `binaryPrecedenceOf`). The
 * prefix-only `not` is intentionally excluded: it cannot continue an
 * expression on its own.
 *
 * @since 0.2
 * @stable
 * @example
 *     isContinuationLead("keyword", "and"); // true
 *     isContinuationLead("keyword", "not"); // false (prefix-only)
 *     isContinuationLead("operator", "+"); // true
 *     isContinuationLead("identifier", "close"); // false
 */
export function isContinuationLead(kind: TokenKind, text: string): boolean {
    if (kind !== "operator" && kind !== "keyword") {
        return false;
    }
    return CONTINUATION_LEAD_OPERATORS.has(text);
}

/**
 * Whether a `resolve` produced an `indent`, `dedent`, or no structural
 * change. `dedent` carries a count because a single source line can pop
 * several indent levels at once.
 *
 * @since 0.1
 * @stable
 * @example
 *     const delta: IndentDelta = { kind: "dedent", dedentCount: 2 };
 *     void delta;
 */
export type IndentDelta =
    | Readonly<{ kind: "none" }>
    | Readonly<{ kind: "indent" }>
    | Readonly<{ kind: "dedent"; dedentCount: number }>;

/**
 * Result of resolving a line's indent against the level stack: the
 * structural {@link IndentDelta} plus an `inconsistentDedent` flag set
 * when a dedent does not land exactly on a prior level (the tracker then
 * snaps to the nearest lower level).
 *
 * @since 0.1
 * @stable
 * @example
 *     const r: IndentResolution = { delta: { kind: "none" }, inconsistentDedent: false };
 *     void r;
 */
export type IndentResolution = Readonly<{
    delta: IndentDelta;
    inconsistentDedent: boolean;
}>;

/**
 * Pure indentation state machine backing the lexer. Holds a stack of
 * column levels (always starting at `0`); `resolve(level)` compares the
 * next significant line's leading-whitespace width against the stack top
 * and reports the structural change, and `dedentToZero()` drains the
 * stack at EOF so `indent`/`dedent` tokens stay balanced. `currentLevel()`
 * reads the live indent column (the stack top) WITHOUT mutating it — the
 * lexer uses it as the statement-start column for the leading-operator
 * continuation guard (a continuation line must be strictly deeper).
 *
 * @since 0.1
 * @stable
 * @example
 *     const tracker = createIndentTracker();
 *     tracker.resolve(4).delta; // { kind: "indent" }
 *     tracker.currentLevel(); // 4
 *     tracker.dedentToZero(); // 1
 */
export type IndentTracker = Readonly<{
    resolve: (level: number) => IndentResolution;
    currentLevel: () => number;
    dedentToZero: () => number;
}>;

/**
 * Construct a fresh {@link IndentTracker} with a single base level (`0`).
 *
 * @since 0.1
 * @stable
 * @example
 *     const tracker = createIndentTracker();
 *     tracker.resolve(2); // pushes level 2, emits one indent
 */
export function createIndentTracker(): IndentTracker {
    const stack: number[] = [0];

    function top(): number {
        return stack[stack.length - 1];
    }

    function resolve(level: number): IndentResolution {
        const current = top();
        if (level > current) {
            stack.push(level);
            return { delta: { kind: "indent" }, inconsistentDedent: false };
        }
        if (level === current) {
            return { delta: { kind: "none" }, inconsistentDedent: false };
        }
        let dedentCount = 0;
        while (stack.length > 1 && top() > level) {
            stack.pop();
            dedentCount += 1;
        }
        const inconsistentDedent = top() !== level;
        if (inconsistentDedent) {
            // Unbalanced dedent: snap the level stack to the nearest lower
            // landing point so subsequent lines resolve against a real level.
            stack[stack.length - 1] = level;
        }
        return { delta: { kind: "dedent", dedentCount }, inconsistentDedent };
    }

    function currentLevel(): number {
        return top();
    }

    function dedentToZero(): number {
        const popped = stack.length - 1;
        stack.length = 1;
        return popped;
    }

    return { resolve, currentLevel, dedentToZero };
}

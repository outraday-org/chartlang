// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";

/**
 * The comparison operators a legal chartlang `for` condition may use.
 * Shared by `parseBoundedForLoop` (which captures the operator so a sizer
 * can derive the loop's max index) and `forbiddenConstructs` (which rejects
 * any other condition shape) so the two passes recognise the same set.
 *
 * @since 0.1
 * @stable
 * @example
 *     COMPARISON_OPS.has(ts.SyntaxKind.LessThanToken); // → true
 */
export const COMPARISON_OPS: ReadonlySet<ts.SyntaxKind> = new Set<ts.SyntaxKind>([
    ts.SyntaxKind.LessThanToken,
    ts.SyntaxKind.LessThanEqualsToken,
    ts.SyntaxKind.GreaterThanToken,
    ts.SyntaxKind.GreaterThanEqualsToken,
]);

/**
 * The parsed shape of a legal chartlang `for` loop.
 *
 * @since 0.1
 * @stable
 * @example
 *     const loop: BoundedForLoop = {
 *         varName: "i",
 *         start: 0,
 *         op: ts.SyntaxKind.LessThanToken,
 *         limit: 5,
 *     };
 *     void loop;
 */
export type BoundedForLoop = Readonly<{
    /** The induction variable name (the `i` in `for (let i = …)`). */
    varName: string;
    /** The literal initial value (`for (let i = <start>; …)`). */
    start: number;
    /** The comparison operator token used in the condition. */
    op: ts.SyntaxKind;
    /** The literal right-hand bound (`… i <op> <limit>; …`). */
    limit: number;
}>;

/**
 * Parse a `ts.ForStatement` into its `BoundedForLoop` shape, or `null`
 * when it is not the one legal chartlang loop form
 * (`for (let i = <numLit>; i <comparison> <numLit>; i++)` — single
 * `let` init, id-on-left/literal-on-right condition, postfix `i++`).
 * The single source of truth for "what is a bounded loop"; both
 * `forbiddenConstructs` (reject everything else) and
 * `resolveIndexUpperBound` (size the index range) call it so the two
 * passes can never disagree.
 *
 * @since 0.1
 * @stable
 * @example
 *     // for (let i = 0; i < 5; i++) → { varName: "i", start: 0,
 *     //                                  op: LessThanToken, limit: 5 }
 *     const fn: typeof parseBoundedForLoop = parseBoundedForLoop;
 *     void fn;
 */
export function parseBoundedForLoop(node: ts.ForStatement): BoundedForLoop | null {
    const init = parseLoopInit(node);
    if (init === null) return null;
    const condition = node.condition;
    const incrementor = node.incrementor;
    if (!condition || !incrementor) return null;
    if (!ts.isBinaryExpression(condition)) return null;
    if (!COMPARISON_OPS.has(condition.operatorToken.kind)) return null;
    if (!ts.isNumericLiteral(condition.right)) return null;
    if (!ts.isIdentifier(condition.left)) return null;
    if (condition.left.text !== init.varId.text) return null;
    if (!ts.isPostfixUnaryExpression(incrementor)) return null;
    if (!ts.isIdentifier(incrementor.operand)) return null;
    if (incrementor.operand.text !== init.varId.text) return null;
    return {
        varName: init.varId.text,
        start: Number(init.start.text),
        op: condition.operatorToken.kind,
        limit: Number(condition.right.text),
    };
}

/**
 * The induction variable's **declaration** identifier of the single legal
 * chartlang loop *initializer* shape, or `null` otherwise. A sizer calls
 * this directly when it needs the declaration node (not just the `varName`
 * text) to ask the type checker whether an index use resolves to this
 * loop's own binding rather than a nested shadow of the same name. Shares
 * `parseBoundedForLoop`'s initializer acceptance via `parseLoopInit`.
 *
 * @since 0.1
 * @stable
 * @example
 *     // for (let i = 0; i < 5; i++) → the `i` declaration identifier
 *     const fn: typeof boundedLoopVarId = boundedLoopVarId;
 *     void fn;
 */
export function boundedLoopVarId(node: ts.ForStatement): ts.Identifier | null {
    return parseLoopInit(node)?.varId ?? null;
}

/**
 * The accepted `for (let i = <numLit>; …)` initializer — a single-
 * declaration `let`/`const` list whose name is an identifier with a
 * numeric-literal start value — captured as both nodes, or `null`. The one
 * place the initializer shape is recognised; `parseBoundedForLoop` and
 * `boundedLoopVarId` both build on it (no narrowing casts in either).
 */
function parseLoopInit(
    node: ts.ForStatement,
): Readonly<{ varId: ts.Identifier; start: ts.NumericLiteral }> | null {
    const init = node.initializer;
    if (!init || !ts.isVariableDeclarationList(init)) return null;
    if (init.declarations.length !== 1) return null;
    const declaration = init.declarations[0];
    if (!declaration || !ts.isIdentifier(declaration.name)) return null;
    const start = declaration.initializer;
    if (!start || !ts.isNumericLiteral(start)) return null;
    return { varId: declaration.name, start };
}

/**
 * Unwrap any number of nested parentheses around an expression. The Pine
 * converter emits a historical bar offset as the parenthesised form
 * `bar.point(-(N), …)` (see the converter's `anchorToWorldPoint`), so the
 * lookback recogniser must peel the parens before matching the literal;
 * the index-bound resolver does the same before matching a numeric leaf.
 * Housed here — a leaf module with no analysis-package imports — so both
 * `extractMaxLookback` and `resolveIndexBound` can share it without a
 * circular import.
 *
 * @since 0.1
 * @stable
 * @example
 *     // unwrapParens of `((7))` → the `7` numeric-literal node
 *     const fn: typeof unwrapParens = unwrapParens;
 *     void fn;
 */
export function unwrapParens(node: ts.Expression): ts.Expression {
    let current = node;
    while (ts.isParenthesizedExpression(current)) current = current.expression;
    return current;
}

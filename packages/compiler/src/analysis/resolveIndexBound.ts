// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";

import {
    type BoundedForLoop,
    boundedLoopVarId,
    parseBoundedForLoop,
    unwrapParens,
} from "./loopBounds.js";

/**
 * Compile-time context for resolving a series index's upper bound.
 *
 * @since 0.1
 * @stable
 * @example
 *     const ctx: IndexBoundContext = {
 *         constEnv: new Map([["k", 3]]),
 *         checker, // ts.TypeChecker
 *     };
 *     void ctx;
 */
export type IndexBoundContext = Readonly<{
    /** `const <id> = <numeric literal>` bindings visible at the index use site. */
    constEnv: ReadonlyMap<string, number>;
    /** Checker used to avoid resolving loop variables through a shadowed name. */
    checker: ts.TypeChecker;
}>;

/**
 * The compile-time integer range an index sub-expression can span. Every
 * input is an integer and `+`/`−`/`*`/unary-`±` preserve integers, so the
 * endpoints are exact integers — no rounding and no `Number.isInteger`
 * guard is needed.
 */
type Interval = Readonly<{ lo: number; hi: number }>;

/**
 * The provable maximum non-negative integer a series-index expression
 * can reach at runtime, or `null` when no sound upper bound exists.
 * Over-approximates: a result is always `>=` the true max index, so the
 * runtime buffer (sized `maxLookback + 1`) never under-sizes. `null`
 * signals the caller to fall back to the 5000-slot dynamic buffer.
 *
 * Resolves any expression built from numeric literals, `const`
 * numeric-literal bindings (`ctx.constEnv`), bounded-loop induction
 * variables (resolved to their full range), the binary operators `+`,
 * `−`, `*`, unary `±`, and parentheses, by computing its integer
 * interval and returning the **upper** endpoint. Any other node (another
 * identifier, a call, `/`, `%`, `**`, a bitwise op, a non-numeric
 * literal) collapses the containing interval — and thus the whole
 * index — to `null`.
 *
 * @since 0.1
 * @stable
 * @example
 *     // for (let i = 0; i < 5; i++) { series[i + 1]; }
 *     // resolveIndexUpperBound(<the `i + 1` arg>, <access node>, ctx) → 5
 *     const fn: typeof resolveIndexUpperBound = resolveIndexUpperBound;
 *     void fn;
 */
export function resolveIndexUpperBound(
    argument: ts.Expression,
    node: ts.Node,
    ctx: IndexBoundContext,
): number | null {
    const interval = evalInterval(argument, node, ctx);
    return interval === null ? null : interval.hi;
}

/**
 * The integer interval an index sub-expression spans, or `null` when any
 * leaf or operator cannot be soundly bounded. The single evaluator that
 * subsumes the leaf cases (literal / bounded-loop var / `const` number)
 * and their affine combinations (`+`, `−`, `*`, unary `±`, parens).
 */
function evalInterval(expr: ts.Expression, node: ts.Node, ctx: IndexBoundContext): Interval | null {
    const inner = unwrapParens(expr);

    if (ts.isNumericLiteral(inner)) {
        const value = Number(inner.text);
        return finiteInterval(value, value);
    }

    if (ts.isIdentifier(inner)) {
        const loopInterval = resolveLoopVarInterval(inner, node, ctx.checker);
        if (loopInterval !== null) return loopInterval;
        const constValue = ctx.constEnv.get(inner.text);
        return constValue === undefined ? null : finiteInterval(constValue, constValue);
    }

    if (ts.isPrefixUnaryExpression(inner)) {
        if (inner.operator === ts.SyntaxKind.PlusToken) {
            return evalInterval(inner.operand, node, ctx);
        }
        if (inner.operator === ts.SyntaxKind.MinusToken) {
            const operand = evalInterval(inner.operand, node, ctx);
            return operand === null ? null : finiteInterval(-operand.hi, -operand.lo);
        }
        return null;
    }

    if (ts.isBinaryExpression(inner)) {
        return evalBinaryInterval(inner, node, ctx);
    }

    return null;
}

/**
 * The interval of a `+`/`−`/`*` over two sub-intervals, or `null` when
 * either operand is unbounded or the operator is unsupported (`/`, `%`,
 * `**`, bitwise, …). Multiplication takes the min/max of the four
 * endpoint products so the bound is correct for any sign combination.
 */
function evalBinaryInterval(
    expr: ts.BinaryExpression,
    node: ts.Node,
    ctx: IndexBoundContext,
): Interval | null {
    const left = evalInterval(expr.left, node, ctx);
    if (left === null) return null;
    const right = evalInterval(expr.right, node, ctx);
    if (right === null) return null;

    switch (expr.operatorToken.kind) {
        case ts.SyntaxKind.PlusToken:
            return finiteInterval(left.lo + right.lo, left.hi + right.hi);
        case ts.SyntaxKind.MinusToken:
            return finiteInterval(left.lo - right.hi, left.hi - right.lo);
        case ts.SyntaxKind.AsteriskToken: {
            const products = [
                left.lo * right.lo,
                left.lo * right.hi,
                left.hi * right.lo,
                left.hi * right.hi,
            ];
            return finiteInterval(Math.min(...products), Math.max(...products));
        }
        default:
            return null;
    }
}

/**
 * An interval with finite endpoints, or `null` when either endpoint is
 * non-finite. A defensive guard against a pathological literal
 * (`1e400` → `Infinity`) or an overflow product feeding a non-finite
 * `hi` into `maxLookback`; integer-ness needs no check (see `Interval`).
 */
function finiteInterval(lo: number, hi: number): Interval | null {
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
    // Normalise `-0` (e.g. `-2 * 0`) to `0` so a resolved bound is never the
    // negative zero a downstream `Object.is`/strict consumer would distinguish.
    return { lo: lo + 0, hi: hi + 0 };
}

/**
 * The index range a bare bounded-loop induction variable can span, or
 * `null` when the identifier is not the induction variable of an
 * enclosing legal `for`, is reassigned in the body, runs a
 * non-terminating `>`/`>=` loop, or is a shadowed name that does not
 * resolve to the loop's own declaration. Affine forms need the full
 * range (`K - i` is largest when `i` is smallest); a bare loop-var read
 * still takes `interval.hi`, identical to the leaf max.
 */
function resolveLoopVarInterval(
    id: ts.Identifier,
    node: ts.Node,
    checker: ts.TypeChecker,
): Interval | null {
    const idSymbol = checker.getSymbolAtLocation(id);

    let current: ts.Node | undefined = node;
    while (current) {
        if (ts.isForStatement(current)) {
            const loopVarId = boundedLoopVarId(current);
            if (loopVarId && loopVarId.text === id.text) {
                // Confirm the use refers to THIS loop's induction variable
                // and not a nested binding that shadows the same text.
                const loopSymbol = checker.getSymbolAtLocation(loopVarId);
                if (!idSymbol || !loopSymbol || idSymbol !== loopSymbol) return null;
                const loop = parseBoundedForLoop(current);
                if (loop === null) return null;
                if (isLoopVarReassigned(current, loop.varName)) return null;
                return loopVarInterval(loop);
            }
        }
        current = current.parent;
    }
    return null;
}

/**
 * The full index range a terminating `for` reaches (`[start, max]`), or
 * `null` for a non-terminating (`>`/`>=` with `i++`) header the resolver
 * cannot bound. `<` reaches `limit - 1`; `<=` reaches `limit`.
 */
function loopVarInterval(loop: BoundedForLoop): Interval | null {
    if (loop.op === ts.SyntaxKind.LessThanToken) {
        return finiteInterval(loop.start, loop.limit - 1);
    }
    if (loop.op === ts.SyntaxKind.LessThanEqualsToken) {
        return finiteInterval(loop.start, loop.limit);
    }
    return null;
}

/**
 * Whether the loop body reassigns `varName` beyond the header `i++`
 * incrementor (a plain `=`, a compound assignment, or an extra `++`/`--`
 * whose target is the induction variable). Such a body breaks the
 * `limit`-based bound, so the resolver refuses to size the read.
 */
function isLoopVarReassigned(loop: ts.ForStatement, varName: string): boolean {
    const body = loop.statement;
    let reassigned = false;
    const visit = (node: ts.Node): void => {
        if (reassigned) return;
        if (
            ts.isBinaryExpression(node) &&
            isAssignmentOperator(node.operatorToken.kind) &&
            ts.isIdentifier(node.left) &&
            node.left.text === varName
        ) {
            reassigned = true;
            return;
        }
        if (
            (ts.isPostfixUnaryExpression(node) || ts.isPrefixUnaryExpression(node)) &&
            (node.operator === ts.SyntaxKind.PlusPlusToken ||
                node.operator === ts.SyntaxKind.MinusMinusToken) &&
            ts.isIdentifier(node.operand) &&
            node.operand.text === varName
        ) {
            reassigned = true;
            return;
        }
        ts.forEachChild(node, visit);
    };
    visit(body);
    return reassigned;
}

/** Whether a binary operator token writes to its left operand. */
function isAssignmentOperator(kind: ts.SyntaxKind): boolean {
    return kind >= ts.SyntaxKind.FirstAssignment && kind <= ts.SyntaxKind.LastAssignment;
}

/**
 * The `const <id> = <numeric literal>` bindings lexically visible at a
 * specific series-index expression. Only `const` initialised with a
 * numeric literal — or a unary `+`/`-` on one — is included (mirroring
 * `extractInputs.readLiteral`'s numeric handling); a binary initialiser
 * is left for Task 2's interval evaluator and is simply omitted. The walk
 * runs from `useSite` outward through its lexical containers up to
 * `scopeRoot`, collecting only declarations that occur before
 * `useSite.pos` within each container, so it never sees a declaration
 * after the read, inside a sibling block, or in a nested function/class
 * that does not contain `useSite`. The innermost visible binding for a
 * name wins (normal shadowing) — including binders that are not
 * `var`/`let`/`const` statements: a `for`-init induction variable and a
 * function parameter shadow an outer numeric `const` of the same name
 * (`markContainerBinders`), so a reassigned `for (let i …)` index or a
 * `request.security((k) => series[k])` callback parameter can never leak
 * an unrelated outer `const k`'s value into the bound (which would
 * under-size the buffer).
 *
 * @since 0.1
 * @stable
 * @example
 *     // const k = 3; series[k];
 *     // collectConstNumberEnv(<the `k` arg>, scope).get("k") → 3
 *     const fn: typeof collectConstNumberEnv = collectConstNumberEnv;
 *     void fn;
 */
export function collectConstNumberEnv(
    useSite: ts.Node,
    scopeRoot: ts.Node,
): ReadonlyMap<string, number> {
    const env = new Map<string, number>();
    // Every `var`/`let`/`const` name bound at or inside a nearer container,
    // numeric or not. A nearer binding shadows an outer one even when it is
    // a `let` or a non-numeric `const`, so an outer `const k = 5` must not
    // leak through it — once a name is `seen`, no outer container can set it.
    const seen = new Set<string>();

    let container: ts.Node | undefined = useSite.parent;
    while (container) {
        // A `for`-init variable / function parameter introduced by this
        // container shadows any same-named outer `const`, even though it is
        // not a `var`/`let`/`const` statement `variableDeclarationsIn` scans.
        markContainerBinders(container, seen);
        for (const declaration of variableDeclarationsIn(container)) {
            if (declaration.pos >= useSite.pos) continue;
            if (!ts.isIdentifier(declaration.name)) continue;
            const name = declaration.name.text;
            if (seen.has(name)) continue;
            seen.add(name);
            const list = declaration.parent;
            if (ts.isVariableDeclarationList(list) && (list.flags & ts.NodeFlags.Const) !== 0) {
                const value = readNumericLiteralInit(declaration);
                if (value !== null) env.set(name, value);
            }
        }
        if (container === scopeRoot) break;
        container = container.parent;
    }

    return env;
}

/**
 * Mark every binding name a container introduces at its OWN level — a
 * `for` initializer's induction variable and a function-like's parameters
 * — as `seen`, so an outer numeric `const` of the same name cannot leak
 * past it. These binders are never numeric `const`s the resolver trusts,
 * so marking them only blocks unsound shadow leaks: a reassigned
 * `for (let i …)` index or a callback parameter (`(k) => series[k]`) that
 * collides with an outer `const i`/`const k`. Only identifier binders
 * matter here (a numeric series index is an identifier); destructured
 * parameter/loop patterns bind no numeric index and are skipped.
 */
function markContainerBinders(container: ts.Node, seen: Set<string>): void {
    if (ts.isForStatement(container)) {
        const init = container.initializer;
        if (init && ts.isVariableDeclarationList(init)) {
            for (const declaration of init.declarations) {
                if (ts.isIdentifier(declaration.name)) seen.add(declaration.name.text);
            }
        }
        return;
    }
    if (ts.isFunctionLike(container)) {
        for (const parameter of container.parameters) {
            if (ts.isIdentifier(parameter.name)) seen.add(parameter.name.text);
        }
    }
}

/**
 * The direct `var`/`let`/`const` `VariableDeclaration`s of a container —
 * of every declaration kind, so the caller can detect a nearer binding
 * that shadows an outer numeric `const` — without descending into nested
 * functions, classes, or blocks (those are handled by their own
 * enclosing-container pass when they actually contain the use site).
 * `Block`, `SourceFile`, function bodies, and case clauses hold their
 * declarations as `statements`/`clauses` we scan directly.
 */
function variableDeclarationsIn(container: ts.Node): ReadonlyArray<ts.VariableDeclaration> {
    const declarations: ts.VariableDeclaration[] = [];
    const statements = statementsOf(container);
    for (const statement of statements) {
        if (!ts.isVariableStatement(statement)) continue;
        for (const declaration of statement.declarationList.declarations) {
            declarations.push(declaration);
        }
    }
    return declarations;
}

/** The lexical statement list a container exposes, or `[]` when it holds none. */
function statementsOf(container: ts.Node): ReadonlyArray<ts.Statement> {
    if (ts.isSourceFile(container) || ts.isBlock(container) || ts.isModuleBlock(container)) {
        return container.statements;
    }
    if (ts.isCaseClause(container) || ts.isDefaultClause(container)) {
        return container.statements;
    }
    return [];
}

/**
 * The numeric value of a `const k = <numeric literal>` /
 * `const k = <unary ± numeric literal>` initialiser, or `null` for any
 * other initialiser (no binary folding here — that is Task 2).
 */
function readNumericLiteralInit(declaration: ts.VariableDeclaration): number | null {
    const initializer = declaration.initializer;
    if (!initializer) return null;
    const expr = unwrapParens(initializer);
    if (ts.isNumericLiteral(expr)) return Number(expr.text);
    if (
        ts.isPrefixUnaryExpression(expr) &&
        (expr.operator === ts.SyntaxKind.MinusToken || expr.operator === ts.SyntaxKind.PlusToken) &&
        ts.isNumericLiteral(expr.operand)
    ) {
        const value = Number(expr.operand.text);
        return expr.operator === ts.SyntaxKind.MinusToken ? -value : value;
    }
    return null;
}

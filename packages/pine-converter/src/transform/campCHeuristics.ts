// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallExpression, ExpressionNode, ForStatement, Statement } from "../ast/index.js";
import type { DrawingCallSite, HandleType, SemanticResult } from "../semantic/index.js";
import { dottedCallee } from "./callArgs.js";
import type { MaxDrawingsIR, ScriptScaffold } from "./ir.js";

/**
 * The outcome of a Camp C reducibility heuristic: a `fold` that promotes the
 * dynamic site into a bounded Camp B ring of capacity `cap` over the named
 * collection. `reasoning` is the audit string the `camp-c-heuristic-applied`
 * info diagnostic surfaces so a reader sees exactly which assumption the
 * converter made. A heuristic returns `null` (not a `HeuristicResult`) when
 * it cannot prove a cap — Camp C then hard-rejects rather than guessing.
 *
 * @since 0.1
 * @stable
 * @example
 *     const r: HeuristicResult = {
 *         kind: "fold",
 *         collectionName: "lvls",
 *         cap: 30,
 *         reasoning: "implicit FIFO at N=30 from indicator() declaration",
 *     };
 *     void r;
 */
export type HeuristicResult = Readonly<{
    kind: "fold";
    collectionName: string;
    cap: number;
    reasoning: string;
}>;

// The chartlang `maxDrawings` field a Pine handle family caps against.
const MAX_DRAWINGS_FIELD: Readonly<Record<HandleType, keyof MaxDrawingsIR | null>> = {
    line: "lines",
    label: "labels",
    box: "boxes",
    polyline: "polylines",
    table: null,
    linefill: null,
};

// The bare-identifier name of an expression, or `null` (also for a missing
// argument node, so callers can pass an optional `array.*` argument directly).
function identifierName(expr: ExpressionNode | undefined): string | null {
    return expr !== undefined && expr.kind === "identifier-expression" ? expr.name : null;
}

// A flat stream of every statement in the script, descending `if`/`for`
// bodies (the v1 nesting), so a push site is found wherever it lives.
function flatten(statements: readonly Statement[]): Statement[] {
    const out: Statement[] = [];
    for (const stmt of statements) {
        out.push(stmt);
        if (stmt.kind === "if-statement") {
            out.push(...flatten(stmt.thenBody.body));
            for (const clause of stmt.elseIfClauses) {
                out.push(...flatten(clause.body.body));
            }
            if (stmt.elseBody !== null) {
                out.push(...flatten(stmt.elseBody.body));
            }
        }
        if (stmt.kind === "for-statement") {
            out.push(...flatten(stmt.body.body));
        }
    }
    return out;
}

// The Pine collection name `site.call` is pushed into (`array.push(coll,
// site.call)`, identity match on the pushed value), or `null` when the site
// is not the value of an `array.push`.
function pushedCollectionName(analysis: SemanticResult, call: CallExpression): string | null {
    for (const stmt of flatten(analysis.script.body)) {
        if (stmt.kind !== "expression-statement") {
            continue;
        }
        const expr = stmt.expression;
        if (
            expr.kind === "call-expression" &&
            dottedCallee(expr) === "array.push" &&
            expr.args[1]?.value === call
        ) {
            return identifierName(expr.args[0]?.value);
        }
    }
    return null;
}

// A literal / `input.int(default)` integer bound, or `null` for a
// non-literal one. `input.int(20)` reads its first positional default.
function literalIntBound(expr: ExpressionNode): number | null {
    if (expr.kind === "literal-expression" && expr.literalKind === "int") {
        return Number.parseInt(expr.value, 10);
    }
    if (
        expr.kind === "unary-expression" &&
        (expr.operator === "+" || expr.operator === "-") &&
        expr.operand.kind === "literal-expression" &&
        expr.operand.literalKind === "int"
    ) {
        const magnitude = Number.parseInt(expr.operand.value, 10);
        return expr.operator === "-" ? -magnitude : magnitude;
    }
    if (expr.kind === "call-expression" && dottedCallee(expr) === "input.int") {
        const def = expr.args[0]?.value;
        return def === undefined ? null : literalIntBound(def);
    }
    return null;
}

// The `for i = 0 to L - 1` (or `to L`) loop whose body pushes `call`, paired
// with its literal upper bound, or `null`.
function loopBoundFor(analysis: SemanticResult, call: CallExpression): number | null {
    for (const stmt of analysis.script.body) {
        if (stmt.kind !== "for-statement") {
            continue;
        }
        if (!bodyPushes(stmt.body.body, call)) {
            continue;
        }
        const bound = loopUpperBound(stmt);
        if (bound !== null) {
            return bound;
        }
    }
    return null;
}

// The upper bound of a `for i = 0 to L` / `for i = 0 to L - 1` header as a
// literal count, or `null` when `L` is not literal-derivable.
function loopUpperBound(loop: ForStatement): number | null {
    const to = loop.to;
    if (to.kind === "binary-expression" && to.operator === "-") {
        const left = literalIntBound(to.left);
        const right = literalIntBound(to.right);
        if (left !== null && right !== null) {
            return left - right + 1;
        }
        return null;
    }
    const direct = literalIntBound(to);
    return direct === null ? null : direct + 1;
}

// Whether `body` (one nesting level) contains an `array.push(_, call)`.
function bodyPushes(body: readonly Statement[], call: CallExpression): boolean {
    return flatten(body).some(
        (stmt) =>
            stmt.kind === "expression-statement" &&
            stmt.expression.kind === "call-expression" &&
            dottedCallee(stmt.expression) === "array.push" &&
            stmt.expression.args[1]?.value === call,
    );
}

// The number of straight-line `array.push(coll, …)` statements at the top
// level (a single-use collection's fixed push count).
function straightLinePushCount(analysis: SemanticResult, collection: string): number {
    let count = 0;
    for (const stmt of analysis.script.body) {
        if (
            stmt.kind === "expression-statement" &&
            stmt.expression.kind === "call-expression" &&
            dottedCallee(stmt.expression) === "array.push" &&
            identifierName(stmt.expression.args[0]?.value) === collection
        ) {
            count += 1;
        }
    }
    return count;
}

// H1 — implicit cap from the indicator() declaration. A `camp-c-bounded`
// site already proved an indicator cap exists; read the chosen K from the
// scaffold's clamped `maxDrawings`.
function tryImplicitIndicatorCap(
    site: DrawingCallSite,
    analysis: SemanticResult,
    scaffold: ScriptScaffold,
): HeuristicResult | null {
    if (site.camp.kind !== "camp-c-bounded") {
        return null;
    }
    const collectionName = pushedCollectionName(analysis, site.call);
    if (collectionName === null) {
        return null;
    }
    const field = MAX_DRAWINGS_FIELD[site.handleType];
    if (field === null) {
        return null;
    }
    const cap = scaffold.maxDrawings[field];
    if (cap === undefined) {
        return null;
    }
    return {
        kind: "fold",
        collectionName,
        cap,
        reasoning: `implicit FIFO at N=${cap} from indicator() declaration`,
    };
}

// H2 — bounded by a literal `for` loop bound around the only push site.
function tryLoopBound(site: DrawingCallSite, analysis: SemanticResult): HeuristicResult | null {
    const collectionName = pushedCollectionName(analysis, site.call);
    if (collectionName === null) {
        return null;
    }
    const bound = loopBoundFor(analysis, site.call);
    if (bound === null || bound <= 0) {
        return null;
    }
    return { kind: "fold", collectionName, cap: bound, reasoning: `loop-bound K=${bound}` };
}

// H3 — a single-use collection: created, pushed N times straight-line, then
// consumed once. The fixed push count is the cap.
function trySingleUse(site: DrawingCallSite, analysis: SemanticResult): HeuristicResult | null {
    const collectionName = pushedCollectionName(analysis, site.call);
    if (collectionName === null) {
        return null;
    }
    const count = straightLinePushCount(analysis, collectionName);
    if (count <= 0) {
        return null;
    }
    return {
        kind: "fold",
        collectionName,
        cap: count,
        reasoning: `single-use straight-line push of N=${count}`,
    };
}

/**
 * Try the Camp C reducibility heuristics in priority order and return the
 * first that proves a bounded cap (`HeuristicResult`), or `null` when none
 * applies (Camp C then hard-rejects):
 *
 * - **H1 implicit-cap-from-indicator** — a `camp-c-bounded` site reads its
 *   cap from the indicator's clamped `maxDrawings`; Pine FIFO-evicts at that
 *   cap anyway, so promoting to a ring of that size preserves behaviour.
 * - **H2 bounded-by-loop-bound** — the only push lives in a `for i = 0 to L`
 *   with a literal / `input.int` `L`; the ring caps at `L`.
 * - **H3 single-use-collection** — the collection is pushed a fixed number of
 *   straight-line times; that count is the cap.
 *
 * A heuristic returns `null` rather than guessing whenever the cap or the
 * push collection cannot be proven from the AST — "no silent wrong output".
 *
 * @since 0.1
 * @stable
 * @example
 *     import { tryHeuristics } from "./campCHeuristics.js";
 *     declare const site: import("../semantic/index.js").DrawingCallSite;
 *     declare const analysis: import("../semantic/index.js").SemanticResult;
 *     declare const scaffold: import("./ir.js").ScriptScaffold;
 *     tryHeuristics(site, analysis, scaffold);
 */
export function tryHeuristics(
    site: DrawingCallSite,
    analysis: SemanticResult,
    scaffold: ScriptScaffold,
): HeuristicResult | null {
    return (
        tryImplicitIndicatorCap(site, analysis, scaffold) ??
        tryLoopBound(site, analysis) ??
        trySingleUse(site, analysis)
    );
}

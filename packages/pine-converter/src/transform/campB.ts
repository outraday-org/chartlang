// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallExpression, ExpressionNode, ForStatement, Statement } from "../ast/index.js";
import { DIAGNOSTIC_CODE_ENTRIES } from "../diagnostics/codes.js";
import type { DrawingCallSite, SemanticResult } from "../semantic/index.js";
import { dottedCallee } from "./callArgs.js";
import type { ResolvedAnchor } from "./coordinates.js";
import { resolveCoordinates } from "./coordinates.js";
import type { DiagnosticCollector } from "./diagnosticCollector.js";
import { resolveCampADrawKind } from "./drawKindResolve.js";
import { emitExpr } from "./exprEmit.js";
import type { DrawCallContext } from "./handleSlot.js";
import { synthesizeDrawCall } from "./handleSlot.js";
import type { ScriptScaffold } from "./ir.js";
import { registerRing, resolveRingCap } from "./ringHelper.js";
import { appendComputeStatement } from "./scaffoldMutators.js";
import type { SetterCall } from "./setterFold.js";
import { foldSetters } from "./setterFold.js";

// The bare-identifier name of an expression, or `null`.
function identifierName(expr: ExpressionNode): string | null {
    return expr.kind === "identifier-expression" ? expr.name : null;
}

// The condition wrapping the `array.push(collection, <site.call>)` statement:
// `null` when the push lives at the top level, else the guarding `if`
// condition (the v1 idiom is one level of nesting — `if pivotDetected`).
function findPushGuard(analysis: SemanticResult, call: CallExpression): ExpressionNode | null {
    for (const stmt of analysis.script.body) {
        if (stmt.kind === "expression-statement" && isPushOf(stmt.expression, call)) {
            return null;
        }
        if (stmt.kind === "if-statement") {
            const inThen = stmt.thenBody.body.some(
                (inner) =>
                    inner.kind === "expression-statement" && isPushOf(inner.expression, call),
            );
            if (inThen) {
                return stmt.condition;
            }
        }
    }
    return null;
}

// Whether `expr` is the `array.push(coll, <call>)` carrying this site's
// `.new()` call as its pushed value (identity match against the classified
// node, never a re-derived shape).
function isPushOf(expr: ExpressionNode, call: CallExpression): boolean {
    return (
        expr.kind === "call-expression" &&
        dottedCallee(expr) === "array.push" &&
        expr.args[1]?.value === call
    );
}

// A `linefill.new(array.get(collection, …), …)` whose anchor is pulled from
// this collection — Camp C territory. Scans each statement's value expression
// (declaration init / assignment value / bare call), recursing into `if`/`for`
// bodies (the v1 nesting), since linefill creations are statement values.
function referencesLinefillOverCollection(
    statements: readonly Statement[],
    collection: string,
): CallExpression | null {
    for (const stmt of statements) {
        const value = statementValue(stmt);
        if (value !== null && isLinefillOverCollection(value, collection)) {
            return value;
        }
        const nested = referencesLinefillOverCollection(childStatements(stmt), collection);
        if (nested !== null) {
            return nested;
        }
    }
    return null;
}

// The value expression a statement carries (init / assigned value / bare
// expression), or `null` for control-flow / declaration headers.
function statementValue(stmt: Statement): ExpressionNode | null {
    if (stmt.kind === "variable-declaration") {
        return stmt.initializer;
    }
    if (stmt.kind === "assignment") {
        return stmt.value;
    }
    if (stmt.kind === "expression-statement") {
        return stmt.expression;
    }
    return null;
}

// The child statement bodies of an `if`/`for` (the v1 nesting depth), in
// source order. Other statements have no child bodies.
function childStatements(stmt: Statement): readonly Statement[] {
    if (stmt.kind === "if-statement") {
        return [
            ...stmt.thenBody.body,
            ...stmt.elseIfClauses.flatMap((clause) => clause.body.body),
            ...(stmt.elseBody?.body ?? []),
        ];
    }
    if (stmt.kind === "for-statement") {
        return stmt.body.body;
    }
    return [];
}

// Whether `expr` is `linefill.new(array.get(collection, …), …)`.
function isLinefillOverCollection(
    expr: ExpressionNode,
    collection: string,
): expr is CallExpression {
    return (
        expr.kind === "call-expression" &&
        dottedCallee(expr) === "linefill.new" &&
        expr.args.some((arg) => isArrayGetOf(arg.value, collection))
    );
}

// Whether `expr` is `array.get(collection, …)`.
function isArrayGetOf(expr: ExpressionNode, collection: string): boolean {
    return (
        expr.kind === "call-expression" &&
        dottedCallee(expr) === "array.get" &&
        expr.args[0] !== undefined &&
        identifierName(expr.args[0].value) === collection
    );
}

// The `for i = 0 to array.size(collection) - 1` ring-update loops in the
// top-level body, paired with the loop iterator name.
function findRingUpdateLoops(
    analysis: SemanticResult,
    collection: string,
): readonly ForStatement[] {
    const loops: ForStatement[] = [];
    for (const stmt of analysis.script.body) {
        if (stmt.kind === "for-statement" && loopBoundReadsSize(stmt.to, collection)) {
            loops.push(stmt);
        }
    }
    return loops;
}

// Whether the loop's `to` bound reads `array.size(collection)` (optionally
// `- 1`), the canonical "iterate every ring element" bound.
function loopBoundReadsSize(to: ExpressionNode, collection: string): boolean {
    if (to.kind === "binary-expression" && to.operator === "-") {
        return loopBoundReadsSize(to.left, collection);
    }
    return (
        to.kind === "call-expression" &&
        dottedCallee(to) === "array.size" &&
        to.args[0] !== undefined &&
        identifierName(to.args[0].value) === collection
    );
}

// The `set_*(array.get(coll, i), …)` setters in a loop body that target the
// loop's ring element. The handle arg is `array.get(coll, <iterator>)`.
function collectLoopSetters(
    body: readonly Statement[],
    collection: string,
    iterator: string,
): SetterCall[] {
    const setters: SetterCall[] = [];
    for (const stmt of body) {
        const setter = loopSetterOf(stmt, collection, iterator);
        if (setter !== null) {
            setters.push(setter);
        }
        if (stmt.kind === "if-statement") {
            setters.push(...collectLoopSetters(stmt.thenBody.body, collection, iterator));
        }
    }
    return setters;
}

// One `*.set_*(array.get(coll, i), …)` against the loop's ring element, or
// `null`. The captured `SetterCall.call` has its `array.get(...)` handle
// argument replaced by a synthetic local so `foldSetters` reads value args
// from index 1 unchanged.
function loopSetterOf(stmt: Statement, collection: string, iterator: string): SetterCall | null {
    if (stmt.kind !== "expression-statement" || stmt.expression.kind !== "call-expression") {
        return null;
    }
    const call = stmt.expression;
    const name = dottedCallee(call);
    if (name === null) {
        return null;
    }
    const dotIndex = name.indexOf(".set_");
    if (dotIndex === -1) {
        return null;
    }
    const handleArg = call.args[0];
    if (handleArg === undefined || handleArg.value.kind !== "call-expression") {
        return null;
    }
    const getCall = handleArg.value;
    const indexArg = getCall.args[1];
    if (
        !isArrayGetOf(getCall, collection) ||
        indexArg === undefined ||
        identifierName(indexArg.value) !== iterator
    ) {
        return null;
    }
    return { method: name.slice(dotIndex + 1), call };
}

// The diagnostic context the draw-call synthesis raises into, bridging the
// structural `DrawCallContext.warn` to the package `DiagnosticCollector` with
// a once-per-script `yloc-padding-approximated` dedupe.
function drawContext(
    analysis: SemanticResult,
    anchors: ReadonlyMap<ExpressionNode, ResolvedAnchor>,
    diagnostics: DiagnosticCollector,
): DrawCallContext {
    return {
        annotations: analysis.annotations,
        anchors,
        warn: (code, node) => {
            if (
                code === "yloc-padding-approximated" &&
                diagnostics.has(DIAGNOSTIC_CODE_ENTRIES[code].code)
            ) {
                return;
            }
            diagnostics.pushCode(code, node.span);
        },
    };
}

// Emit the literal-bounded ring-update loop for one `for i = 0 to
// array.size(coll) - 1` over the collection.
function emitRingUpdateLoop(
    loop: ForStatement,
    collection: string,
    ringLocal: string,
    cap: number,
    site: DrawingCallSite,
    annotations: DrawCallContext["annotations"],
    diagnostics: DiagnosticCollector,
    scaffold: ScriptScaffold,
): void {
    const setters = collectLoopSetters(loop.body.body, collection, loop.variable);
    const patch =
        setters.length > 0
            ? foldSetters(setters, site.handleType, annotations, (code, node) =>
                  diagnostics.pushCode(code, node.span),
              )
            : null;
    const i = loop.variable;
    const header = `for (let ${i} = 0; ${i} < ${cap}; ${i}++) { const __h = ${ringLocal}.at(${i}); if (__h === null) continue; `;
    if (patch === null) {
        diagnostics.pushCode("anchor-mirror-required", loop.span);
        appendComputeStatement(
            scaffold,
            `${header}/* TODO: ring element update could not be folded */ }`,
        );
        return;
    }
    appendComputeStatement(scaffold, `${header}__h.update(${patch}); }`);
}

/**
 * Lower one Camp B drawing call-site — a `var array<line|label|box>` filled by
 * `array.push(coll, <draw>.new(...))` with FIFO eviction — into the
 * {@link ScriptScaffold} as a chartlang ring buffer. The function: resolves
 * `K = min(pineCap, bucketCap)` ({@link resolveRingCap}); registers the
 * module-level ring ({@link registerRing}); emits ONE
 * `<ring>.push(draw.<kind>(…))` callsite at the fixed source position of the
 * Pine `array.push` (inside its original guard) so the compiler's
 * `stateful-call-inside-loop` gate never sees a `draw.*` in a loop; elides the
 * explicit `array.shift`/`*.delete` eviction (one `ring-eviction-implicit`);
 * and lowers each `for i = 0 to array.size(coll) - 1` update loop into a
 * literal-bounded `for (… i < K …) { <ring>.at(i)?.update(…) }`. Rejects
 * `linefill.new` over the collection (`linefill-over-ring`). Mutates the
 * scaffold + diagnostics and returns `void` — Task 16 codegen reads
 * `scaffold.handleRings` + `scaffold.computeBody`.
 *
 * The ring helper ({@link registerRing}) and the `array.*` accessor mapping
 * (`mapArrayBuiltin`) are shared with Camp C (Task 12) and the table
 * transform (Task 13).
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { lex } from "../lexer/index.js";
 *     import { parseStatements } from "../parser/index.js";
 *     import { analyze } from "../semantic/index.js";
 *     import { DiagnosticCollector } from "./diagnosticCollector.js";
 *     import { transformDeclaration } from "./declaration.js";
 *     import { transformCampB } from "./campB.js";
 *     const src =
 *         "//@version=6\nindicator(\"X\", overlay=true)\n" +
 *         "var array<line> lvls = array.new<line>()\nif close > open\n" +
 *         "    array.push(lvls, line.new(bar_index, close, bar_index, close))\n" +
 *         "    if array.size(lvls) > 50\n        line.delete(array.shift(lvls))\nplot(close)\n";
 *     const analysis = analyze(parseStatements(lex(src).tokens).script);
 *     const decl = analysis.script.declaration;
 *     if (decl !== null && decl.kind === "indicator-declaration") {
 *         const diagnostics = new DiagnosticCollector();
 *         const scaffold = transformDeclaration(decl, analysis, diagnostics);
 *         for (const site of analysis.drawingSites) {
 *             if (site.camp.kind === "camp-b") {
 *                 transformCampB(site, analysis, scaffold, diagnostics);
 *             }
 *         }
 *         void scaffold.handleRings; // [{ name: "__lvls_ring", kind: "line", cap: 50 }]
 *     }
 */
export function transformCampB(
    site: DrawingCallSite,
    analysis: SemanticResult,
    scaffold: ScriptScaffold,
    diagnostics: DiagnosticCollector,
): void {
    if (site.camp.kind !== "camp-b") {
        return;
    }
    // Polyline ring synthesis is Task 14's surface — `synthesizeDrawCall`
    // renders only the line/box/label `draw.*` families — so a polyline
    // collection is deferred here rather than emitting a broken draw call.
    if (site.constructor === "polyline.new") {
        return;
    }
    const collection = site.camp.collectionSymbol.name;
    const kind = resolveCampADrawKind(site, diagnostics);
    if (kind === null) {
        return;
    }
    const cap = resolveRingCap(site, diagnostics);
    if (cap === null) {
        return;
    }

    const linefill = referencesLinefillOverCollection(analysis.script.body, collection);
    if (linefill !== null) {
        diagnostics.pushCode("linefill-over-ring", linefill.span);
        return;
    }

    const ringLocal = registerRing(scaffold, collection, kind, cap);
    const { anchors } = resolveCoordinates(analysis, {});
    const ctx = drawContext(analysis, anchors, diagnostics);
    const drawCall = synthesizeDrawCall(kind, site.call, ctx);

    const guard = findPushGuard(analysis, site.call);
    const push = `${ringLocal}.push(${drawCall});`;
    appendComputeStatement(
        scaffold,
        guard === null ? push : `if (${emitExpr(guard, analysis.annotations)}) { ${push} }`,
    );
    diagnostics.pushCode("ring-eviction-implicit", site.span);

    for (const loop of findRingUpdateLoops(analysis, collection)) {
        emitRingUpdateLoop(
            loop,
            collection,
            ringLocal,
            cap,
            site,
            analysis.annotations,
            diagnostics,
            scaffold,
        );
    }
}

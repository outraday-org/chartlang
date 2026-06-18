// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    CallArgument,
    CallExpression,
    ExpressionNode,
    ForStatement,
    Statement,
} from "../ast/index.js";
import type { DrawingCallSite, SemanticResult } from "../semantic/index.js";
import { dottedCallee, namedArg, positionalArgs } from "./callArgs.js";
import { convertColor } from "./colorConvert.js";
import { substituteIterator } from "./controlFlow.js";
import { anchorToWorldPoint, resolveAnchorExpr } from "./coordinates.js";
import type { DiagnosticCollector } from "./diagnosticCollector.js";
import type { AnnotationLookup } from "./exprEmit.js";
import { handleSlotLocalName } from "./handleSlot.js";
import type { ScriptScaffold } from "./ir.js";
import { appendComputeStatement, appendHandleSlot } from "./scaffoldMutators.js";

// Whether a named boolean arg is literally `true`.
function isTrueArg(args: readonly CallArgument[], name: string): boolean {
    const arg = namedArg(args, name);
    return (
        arg !== null &&
        arg.value.kind === "literal-expression" &&
        arg.value.literalKind === "bool" &&
        arg.value.value === "true"
    );
}

// The bare identifier name of an expression, or `null`.
function identifierName(expr: ExpressionNode): string | null {
    return expr.kind === "identifier-expression" ? expr.name : null;
}

// The chartlang line-style opts object for a polyline `.new`, gathered from
// its `line_color` / `line_width` / `line_style` named args. `null` when no
// style arg is present (omit the opts argument).
function polylineStyleOpts(
    call: CallExpression,
    annotations: AnnotationLookup,
    extraField: string | null,
): string | null {
    const parts: string[] = [];
    if (extraField !== null) {
        parts.push(extraField);
    }
    const color = namedArg(call.args, "line_color");
    if (color !== null) {
        parts.push(`color: ${convertColor(color.value, annotations)}`);
    }
    return parts.length === 0 ? null : `{ ${parts.join(", ")} }`;
}

// Render the `{ time, price }` anchor list source for a tuple of
// `chart.point.*(...)` factory calls.
function renderAnchorList(
    elements: readonly ExpressionNode[],
    annotations: AnnotationLookup,
): {
    readonly source: string;
    readonly count: number;
} {
    const points = elements.map((el) => anchorToWorldPoint(resolveAnchorExpr(el, el, annotations)));
    return { source: `[${points.join(", ")}]`, count: points.length };
}

// The chartlang `draw.*` method + anchor cast for a polyline anchor list,
// honouring `curved` / `closed`.
function polylineDrawCall(
    anchorSource: string,
    count: number,
    call: CallExpression,
    annotations: AnnotationLookup,
    site: DrawingCallSite,
    diagnostics: DiagnosticCollector,
): string {
    const curved = isTrueArg(call.args, "curved");
    const closed = isTrueArg(call.args, "closed");
    if (closed) {
        diagnostics.pushCode("polyline-closed-info", site.span);
        // `polylineStyleOpts` always returns a non-null object here — the
        // `closed: true` field guarantees the opts list is non-empty.
        const opts = polylineStyleOpts(call, annotations, "closed: true");
        return `draw.path(${anchorSource}, ${opts})`;
    }
    if (curved && count === 3) {
        const opts = polylineStyleOpts(call, annotations, null);
        const head = `${anchorSource} as const`;
        return opts === null ? `draw.curve(${head})` : `draw.curve(${head}, ${opts})`;
    }
    if (curved) {
        diagnostics.pushCode("polyline-curved-anchors-warning", site.span);
    }
    const opts = polylineStyleOpts(call, annotations, null);
    return opts === null
        ? `draw.polyline(${anchorSource})`
        : `draw.polyline(${anchorSource}, ${opts})`;
}

// Emit one camp-a polyline handle: a slot + a create-once / no-op update
// over the literal anchor tuple.
function emitPolylineLiteral(
    site: DrawingCallSite,
    handleName: string,
    elements: readonly ExpressionNode[],
    analysis: SemanticResult,
    scaffold: ScriptScaffold,
    diagnostics: DiagnosticCollector,
): void {
    const local = handleSlotLocalName(handleName, scaffold.names);
    appendHandleSlot(scaffold, { name: local, kind: "polyline", compact: false });
    const { source, count } = renderAnchorList(elements, analysis.annotations);
    const drawCall = polylineDrawCall(
        source,
        count,
        site.call,
        analysis.annotations,
        site,
        diagnostics,
    );
    appendComputeStatement(
        scaffold,
        `if (${local}.current() === null) { ${local}.set(${drawCall}); }`,
    );
    emitPolylineDelete(local, handleName, analysis, scaffold);
}

// Whether a `polyline.delete(handle)` against `handleName` appears at the top
// level.
function hasPolylineDelete(analysis: SemanticResult, handleName: string): boolean {
    return analysis.script.body.some(
        (stmt) =>
            stmt.kind === "expression-statement" &&
            stmt.expression.kind === "call-expression" &&
            dottedCallee(stmt.expression) === "polyline.delete" &&
            stmt.expression.args[0] !== undefined &&
            identifierName(stmt.expression.args[0].value) === handleName,
    );
}

// A literal non-negative integer (`5` or `+5`), or `null`.
function literalInt(node: ExpressionNode): number | null {
    if (node.kind === "literal-expression" && node.literalKind === "int") {
        return Number.parseInt(node.value, 10);
    }
    if (
        node.kind === "unary-expression" &&
        node.operator === "+" &&
        node.operand.kind === "literal-expression" &&
        node.operand.literalKind === "int"
    ) {
        return Number.parseInt(node.operand.value, 10);
    }
    return null;
}

// The `chart.point.*(...)` value an `array.push(<collection>, <chart.point>)`
// statement pushes, or `null` when the statement is not such a push.
function pushedChartPoint(stmt: Statement, collection: string): ExpressionNode | null {
    if (stmt.kind !== "expression-statement" || stmt.expression.kind !== "call-expression") {
        return null;
    }
    const call = stmt.expression;
    if (dottedCallee(call) !== "array.push") {
        return null;
    }
    const target = call.args[0];
    const value = call.args[1];
    if (
        target === undefined ||
        value === undefined ||
        identifierName(target.value) !== collection
    ) {
        return null;
    }
    return value.value;
}

// The literal-bounded anchor expressions a `for i = from to to` loop pushing
// `chart.point`s into `collection` unrolls to, or `null` when the loop bound
// is not literal (the dynamic-length reject). Only called for a loop already
// known to push into `collection`.
function unrollForPushes(stmt: ForStatement, collection: string): readonly ExpressionNode[] | null {
    const from = literalInt(stmt.from);
    const to = literalInt(stmt.to);
    const step = stmt.step === null ? 1 : literalInt(stmt.step);
    if (from === null || to === null || step === null || step === 0) {
        return null;
    }
    // Pine auto-counts down when `from > to`; `by` contributes only magnitude.
    const ascending = from <= to;
    const stepDelta = ascending ? Math.abs(step) : -Math.abs(step);
    const anchors: ExpressionNode[] = [];
    for (let i = from; ascending ? i <= to : i >= to; i += stepDelta) {
        for (const inner of stmt.body.body) {
            const point = pushedChartPoint(inner, collection);
            if (point !== null) {
                anchors.push(substituteIterator(point, stmt.variable, i));
            }
        }
    }
    return anchors;
}

// Whether a condition is the `barstate.islast` rebuild guard.
function isIslastGuard(condition: ExpressionNode): boolean {
    return (
        condition.kind === "member-access-expression" &&
        condition.head === null &&
        condition.chain.join(".") === "barstate.islast"
    );
}

// Whether any statement (recursing one level into `if`/`for` bodies) pushes a
// `chart.point` into `collection` — a per-bar conditional push is dynamic
// accumulation, not a fixed rebuild.
function bodyPushesPoint(stmts: readonly Statement[], collection: string): boolean {
    return stmts.some((stmt) => {
        if (pushedChartPoint(stmt, collection) !== null) {
            return true;
        }
        if (stmt.kind === "for-statement") {
            return bodyPushesPoint(stmt.body.body, collection);
        }
        if (stmt.kind === "if-statement") {
            return (
                bodyPushesPoint(stmt.thenBody.body, collection) ||
                stmt.elseIfClauses.some((c) => bodyPushesPoint(c.body.body, collection)) ||
                (stmt.elseBody !== null && bodyPushesPoint(stmt.elseBody.body, collection))
            );
        }
        return false;
    });
}

// The ordered anchor expressions built into `collection` by `array.push`,
// recognising the `if barstate.islast` rebuild idiom: straight
// `array.push(coll, chart.point)` statements contribute one anchor each and a
// literal-bounded build `for` unrolls in place, whether at the top level or
// inside the `islast` guard. A push under any OTHER guard is per-bar
// accumulation (dynamic length) → `null`; a non-literal build `for` bound and
// an empty result are also `null` (the dynamic / no-points reject).
function collectBuildPoints(
    analysis: SemanticResult,
    collection: string,
): readonly ExpressionNode[] | null {
    const anchors: ExpressionNode[] = [];
    let dynamic = false;
    const visit = (stmts: readonly Statement[]): void => {
        for (const stmt of stmts) {
            const point = pushedChartPoint(stmt, collection);
            if (point !== null) {
                anchors.push(point);
                continue;
            }
            if (
                stmt.kind === "for-statement" &&
                stmt.body.body.some((inner) => pushedChartPoint(inner, collection) !== null)
            ) {
                const unrolled = unrollForPushes(stmt, collection);
                if (unrolled === null) {
                    dynamic = true;
                    return;
                }
                anchors.push(...unrolled);
                continue;
            }
            if (stmt.kind === "if-statement") {
                if (isIslastGuard(stmt.condition)) {
                    visit(stmt.thenBody.body);
                } else if (bodyPushesPoint([stmt], collection)) {
                    // A push under a non-`islast` guard accumulates each bar.
                    dynamic = true;
                    return;
                }
            }
        }
    };
    visit(analysis.script.body);
    if (dynamic || anchors.length === 0) {
        return null;
    }
    return anchors;
}

// The `var array<chart.point>` rebuild idiom: the polyline's first arg is an
// identifier collection built per bar, then delete-and-recreate. A
// literal-bounded build loop unrolls into a fixed anchor list; a data-driven
// (non-literal) build is the finalised `polyline-dynamic-points` reject.
function emitPolylineRebuild(
    site: DrawingCallSite,
    handleName: string,
    collection: string,
    analysis: SemanticResult,
    scaffold: ScriptScaffold,
    diagnostics: DiagnosticCollector,
): void {
    const anchors = collectBuildPoints(analysis, collection);
    if (anchors === null) {
        diagnostics.pushCode("polyline-dynamic-points", site.span);
        return;
    }
    const local = handleSlotLocalName(handleName, scaffold.names);
    appendHandleSlot(scaffold, { name: local, kind: "polyline", compact: false });
    const { source, count } = renderAnchorList(anchors, analysis.annotations);
    const drawCall = polylineDrawCall(
        source,
        count,
        site.call,
        analysis.annotations,
        site,
        diagnostics,
    );
    appendComputeStatement(
        scaffold,
        `if (barstate.islast) { ${local}.current()?.remove(); ${local}.set(${drawCall}); }`,
    );
    emitPolylineDelete(local, handleName, analysis, scaffold);
}

// Emit the `remove()` + slot-clear pattern for a `polyline.delete(handle)`
// against `handleName`, when present.
function emitPolylineDelete(
    local: string,
    handleName: string,
    analysis: SemanticResult,
    scaffold: ScriptScaffold,
): void {
    if (hasPolylineDelete(analysis, handleName)) {
        appendComputeStatement(scaffold, `${local}.current()?.remove();`);
        appendComputeStatement(scaffold, `${local}.set(null);`);
    }
}

// Lower one `polyline.new` drawing site.
function emitPolyline(
    site: DrawingCallSite,
    handleName: string,
    analysis: SemanticResult,
    scaffold: ScriptScaffold,
    diagnostics: DiagnosticCollector,
): void {
    const first = positionalArgs(site.call.args)[0];
    if (first === undefined) {
        diagnostics.pushCode("polyline-dynamic-points", site.span);
        return;
    }
    if (first.value.kind === "tuple-expression") {
        emitPolylineLiteral(
            site,
            handleName,
            first.value.elements,
            analysis,
            scaffold,
            diagnostics,
        );
        return;
    }
    const collection = identifierName(first.value);
    if (collection === null) {
        diagnostics.pushCode("polyline-dynamic-points", site.span);
        return;
    }
    emitPolylineRebuild(site, handleName, collection, analysis, scaffold, diagnostics);
}

// The handle name a `var <name> = <site.call>` declaration / `<name> :=
// <site.call>` assignment binds — re-derived from the AST by identity match
// on the constructor call (the linefill camp is `camp-c-unbounded`, so it
// carries no handle symbol; polyline's camp-a does, but one lookup covers
// both). `null` when the call is not a top-level handle binding.
function handleNameOf(analysis: SemanticResult, call: CallExpression): string | null {
    for (const stmt of analysis.script.body) {
        if (stmt.kind === "variable-declaration" && stmt.initializer === call) {
            return stmt.name;
        }
        if (stmt.kind === "assignment" && stmt.value === call) {
            return stmt.name;
        }
    }
    return null;
}

// A `line.new` camp-a site keyed by its handle name — the linefill's two line
// args resolve their quad corners from these.
function lineSitesByName(analysis: SemanticResult): ReadonlyMap<string, DrawingCallSite> {
    const byName = new Map<string, DrawingCallSite>();
    for (const site of analysis.drawingSites) {
        if (site.constructor === "line.new" && site.camp.kind === "camp-a") {
            byName.set(site.camp.handleSymbol.name, site);
        }
    }
    return byName;
}

// The two endpoint `{ time, price }` anchors of a `line.new(x1,y1,x2,y2)` call.
function lineAnchors(call: CallExpression, annotations: AnnotationLookup): [string, string] {
    const positional = positionalArgs(call.args);
    const a = anchorFromPair(positional[0], positional[1], annotations);
    const b = anchorFromPair(positional[2], positional[3], annotations);
    return [a, b];
}

// Resolve one `(x, y)` positional pair into a `{ time, price }` anchor source.
function anchorFromPair(
    xArg: CallArgument | undefined,
    yArg: CallArgument | undefined,
    annotations: AnnotationLookup,
): string {
    if (xArg === undefined || yArg === undefined) {
        return "{ time: bar.time, price: Number.NaN }";
    }
    return anchorToWorldPoint(resolveAnchorExpr(xArg.value, yArg.value, annotations));
}

// Whether `call` is `linefill.new` anchored from a collection (`array.get`).
function isCrossCollectionLinefill(call: CallExpression): boolean {
    return call.args.some(
        (arg) => arg.value.kind === "call-expression" && dottedCallee(arg.value) === "array.get",
    );
}

// Whether a `line` handle is updated on every bar (an unguarded top-level
// `line.set_*`), marking a Pine "series fill" (e.g. Bollinger bands).
function isSeriesDriven(analysis: SemanticResult, lineName: string): boolean {
    return analysis.script.body.some(
        (stmt) =>
            stmt.kind === "expression-statement" &&
            stmt.expression.kind === "call-expression" &&
            isLineSetterOf(stmt.expression, lineName),
    );
}

// Whether `call` is a `line.set_*(handle, …)` against `lineName`.
function isLineSetterOf(call: CallExpression, lineName: string): boolean {
    const name = dottedCallee(call);
    if (name === null || !name.startsWith("line.set_")) {
        return false;
    }
    const first = call.args[0];
    return first !== undefined && identifierName(first.value) === lineName;
}

// The fill colour argument of a `linefill.new(a, b, color)` call (named or
// the third positional), or `null` when absent.
function fillColorArg(call: CallExpression): ExpressionNode | null {
    return (namedArg(call.args, "color") ?? positionalArgs(call.args)[2])?.value ?? null;
}

// Whether `node` is a `color.new(...)` call (whose transparency the alpha-hex
// fold approximates).
function isColorNew(node: ExpressionNode): boolean {
    return node.kind === "call-expression" && dottedCallee(node) === "color.new";
}

// The `linefill.set_color(fill, color)` re-colour against `fillName`, or
// `null`. Folds into a `handle.update({ style: { fill } })` on the quad.
function findSetColor(analysis: SemanticResult, fillName: string): ExpressionNode | null {
    for (const stmt of analysis.script.body) {
        if (stmt.kind !== "expression-statement" || stmt.expression.kind !== "call-expression") {
            continue;
        }
        const call = stmt.expression;
        if (dottedCallee(call) !== "linefill.set_color") {
            continue;
        }
        const first = call.args[0];
        const colorArg = call.args[1];
        if (
            first !== undefined &&
            identifierName(first.value) === fillName &&
            colorArg !== undefined
        ) {
            return colorArg.value;
        }
    }
    return null;
}

// Whether a `linefill.delete(fill)` against `fillName` appears at the top
// level.
function hasDelete(analysis: SemanticResult, fillName: string): boolean {
    return analysis.script.body.some(
        (stmt) =>
            stmt.kind === "expression-statement" &&
            stmt.expression.kind === "call-expression" &&
            dottedCallee(stmt.expression) === "linefill.delete" &&
            stmt.expression.args[0] !== undefined &&
            identifierName(stmt.expression.args[0].value) === fillName,
    );
}

// Lower one static two-line `linefill.new(lineA, lineB, color)` site into a
// `draw.rotatedRectangle` quad fill handle.
function emitLinefill(
    site: DrawingCallSite,
    fillName: string,
    analysis: SemanticResult,
    scaffold: ScriptScaffold,
    diagnostics: DiagnosticCollector,
): void {
    const positional = positionalArgs(site.call.args);
    const lineAName = positional[0] === undefined ? null : identifierName(positional[0].value);
    const lineBName = positional[1] === undefined ? null : identifierName(positional[1].value);
    if (lineAName === null || lineBName === null) {
        return;
    }
    const lines = lineSitesByName(analysis);
    const lineA = lines.get(lineAName);
    const lineB = lines.get(lineBName);
    if (lineA === undefined || lineB === undefined) {
        return;
    }

    const local = handleSlotLocalName(fillName, scaffold.names);
    appendHandleSlot(scaffold, { name: local, kind: "rectangle", compact: false });

    const [aA, aB] = lineAnchors(lineA.call, analysis.annotations);
    const [bA, bB] = lineAnchors(lineB.call, analysis.annotations);
    const quad = `[${aA}, ${aB}, ${bB}, ${bA}]`;
    const colorNode = fillColorArg(site.call);
    const color =
        colorNode === null ? '"#00000033"' : convertColor(colorNode, analysis.annotations);

    diagnostics.pushCode("linefill-rotatedrect-approximated", site.span);
    if (colorNode !== null && isColorNew(colorNode)) {
        diagnostics.pushCode("linefill-color-transp-approximated", site.span);
    }
    if (isSeriesDriven(analysis, lineAName) && isSeriesDriven(analysis, lineBName)) {
        diagnostics.pushCode("linefill-series-fill", site.span);
    }

    const opts = `{ fill: ${color}, fillAlpha: 1 }`;
    appendComputeStatement(
        scaffold,
        `if (${local}.current() === null) { ` +
            `${local}.set(draw.rotatedRectangle(${quad} as const, ${opts})); ` +
            `} else { ${local}.current()?.update({ anchors: ${quad} }); }`,
    );

    const recolor = findSetColor(analysis, fillName);
    if (recolor !== null) {
        appendComputeStatement(
            scaffold,
            `${local}.current()?.update({ style: { fill: ${convertColor(recolor, analysis.annotations)} } });`,
        );
    }
    if (hasDelete(analysis, fillName)) {
        appendComputeStatement(scaffold, `${local}.current()?.remove();`);
        appendComputeStatement(scaffold, `${local}.set(null);`);
    }
}

/**
 * Lower every Pine `polyline.new` and (static two-line) `linefill.new` site
 * into the {@link ScriptScaffold} IR. Polylines map to `draw.polyline` (or
 * `draw.curve` for a 3-anchor `curved=true`, or `draw.path` with `closed:
 * true`); a `var array<chart.point>` dynamic-length rebuild is the finalised
 * `polyline-dynamic-points` reject. A static `linefill.new(lineA, lineB,
 * color)` is approximated as a `draw.rotatedRectangle` quad whose corners are
 * the two referenced lines' endpoints, filled with the alpha-converted colour
 * ({@link convertColor}) — best-effort since chartlang ships no dedicated
 * fill-between-series primitive (`linefill-rotatedrect-approximated`; a
 * bar-by-bar two-series fill additionally raises `linefill-series-fill`).
 * A cross-collection `linefill.new(array.get(...))` is left to Camp C (Task
 * 12). Mutates the scaffold + diagnostics; Task 16 codegen reads
 * `scaffold.handleSlots` + `scaffold.computeBody`.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { lex } from "../lexer/index.js";
 *     import { parseStatements } from "../parser/index.js";
 *     import { analyze } from "../semantic/index.js";
 *     import { DiagnosticCollector } from "./diagnosticCollector.js";
 *     import { transformDeclaration } from "./declaration.js";
 *     import { transformPolylineLinefill } from "./polylineLinefill.js";
 *     const src =
 *         "//@version=6\nindicator(\"X\", overlay=true)\n" +
 *         "var polyline p = polyline.new([chart.point.from_index(0, close), " +
 *         "chart.point.from_index(1, close)])\nplot(close)\n";
 *     const analysis = analyze(parseStatements(lex(src).tokens).script);
 *     const decl = analysis.script.declaration;
 *     if (decl !== null && decl.kind === "indicator-declaration") {
 *         const diagnostics = new DiagnosticCollector();
 *         const scaffold = transformDeclaration(decl, analysis, diagnostics);
 *         transformPolylineLinefill(analysis, scaffold, diagnostics);
 *         void scaffold.handleSlots; // [{ name: "__p_handle", kind: "polyline" }]
 *     }
 */
export function transformPolylineLinefill(
    analysis: SemanticResult,
    scaffold: ScriptScaffold,
    diagnostics: DiagnosticCollector,
): void {
    analysis.drawingSites.forEach((site, index) => {
        if (site.constructor === "polyline.new") {
            // A `var p = polyline.new(...)` binds a handle; a standalone
            // `polyline.new(pts, …)` (the build-and-draw idiom) has no Pine
            // name, so synthesise one from the points collection (or the site
            // index) instead of silently skipping the draw.
            const handleName = handleNameOf(analysis, site.call) ?? synthPolylineName(site, index);
            emitPolyline(site, handleName, analysis, scaffold, diagnostics);
            return;
        }
        if (site.constructor === "linefill.new" && !isCrossCollectionLinefill(site.call)) {
            const fillName = handleNameOf(analysis, site.call);
            if (fillName !== null) {
                emitLinefill(site, fillName, analysis, scaffold, diagnostics);
            }
        }
    });
}

// The handle-slot base name for a standalone `polyline.new(...)` with no Pine
// handle binding: the points collection name when the first arg is an
// identifier (`pts`, reused via the name allocator), else a site-index fallback that stays
// stable across runs.
function synthPolylineName(site: DrawingCallSite, index: number): string {
    const first = positionalArgs(site.call.args)[0];
    const collection = first === undefined ? null : identifierName(first.value);
    return collection ?? `polyline_${index}`;
}

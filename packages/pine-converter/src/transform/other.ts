// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallExpression, ExpressionNode } from "../ast/index.js";
import type { Assignment, Statement, VariableDeclaration } from "../ast/statements.js";
import { DRAWING_KIND_MAP, mathLookup, taLookup } from "../mapping/index.js";
import type { PineDrawingConstructor } from "../mapping/index.js";
import type { SemanticResult } from "../semantic/index.js";
import { type BodyEmitter, emitFor, emitIf, emitSwitch } from "./controlFlow.js";
import type { DiagnosticCollector } from "./diagnosticCollector.js";
import type { EmitContext } from "./emitContext.js";
import { emitWithContext } from "./emitContext.js";
import type { ScriptScaffold } from "./ir.js";
import { emitPlotFamily, isPlotFamilyCall } from "./plotFamily.js";
import { emitRequestSecurity, isRequestSecurityCall } from "./requestSecurity.js";
import { appendComputeStatement, appendStateSlot } from "./scaffoldMutators.js";
import { emitStr } from "./strFormat.js";
import { emitStrategySignal } from "./strategySignals.js";

// The dotted member name of a bare-rooted callee (`ta.ema`, `array.push`), or
// the bare identifier name, or `null` for a computed callee.
function calleeName(call: CallExpression): string | null {
    const callee = call.callee;
    if (callee.kind === "identifier-expression") {
        return callee.name;
    }
    if (callee.kind === "member-access-expression" && callee.head === null) {
        return callee.chain.join(".");
    }
    return null;
}

// The bare identifier name of a call's first argument (the handle/collection a
// setter/mutation targets), or `null`.
function firstArgName(call: CallExpression): string | null {
    const first = call.args[0];
    return first !== undefined && first.value.kind === "identifier-expression"
        ? first.value.name
        : null;
}

// The collection name an `array.push(coll, <drawing>.new(...))` targets, or
// `null` when the call is not a drawing push.
function drawingPushCollection(call: CallExpression): string | null {
    if (calleeName(call) !== "array.push") {
        return null;
    }
    const collection = call.args[0]?.value;
    const pushed = call.args[1]?.value;
    if (collection === undefined || collection.kind !== "identifier-expression") {
        return null;
    }
    return pushed !== undefined && isDrawingConstructorValue(pushed) ? collection.name : null;
}

// Recurse one level into `if`/`for` bodies collecting the collection names a
// drawing push targets (a camp-c bounded collection carries no symbol on its
// camp, so the names are re-derived from the AST, like the camp classifier).
function collectPushCollections(statements: readonly Statement[], out: Set<string>): void {
    for (const stmt of statements) {
        if (stmt.kind === "expression-statement" && stmt.expression.kind === "call-expression") {
            const coll = drawingPushCollection(stmt.expression);
            if (coll !== null) {
                out.add(coll);
            }
        } else if (stmt.kind === "if-statement") {
            collectPushCollections(stmt.thenBody.body, out);
            for (const clause of stmt.elseIfClauses) {
                collectPushCollections(clause.body.body, out);
            }
            if (stmt.elseBody !== null) {
                collectPushCollections(stmt.elseBody.body, out);
            }
        } else if (stmt.kind === "for-statement") {
            collectPushCollections(stmt.body.body, out);
        }
    }
}

// The set of symbol names the drawing transforms own (handles + collections):
// every camp-a handle, every camp-b collection, every handle-typed symbol, and
// every collection an `array.push(coll, <drawing>.new(...))` targets (covers
// camp-c-bounded collections, which carry no symbol on the camp).
// `transformOther` skips reads / declarations / mutations of these so it never
// double-emits a drawing.
function drawingOwnedSymbols(analysis: SemanticResult): ReadonlySet<string> {
    const owned = new Set<string>();
    for (const site of analysis.drawingSites) {
        if (site.camp.kind === "camp-a") {
            owned.add(site.camp.handleSymbol.name);
        } else if (site.camp.kind === "camp-b") {
            owned.add(site.camp.collectionSymbol.name);
        }
    }
    for (const [, symbol] of analysis.symbols) {
        if (symbol.handleType !== null) {
            owned.add(symbol.name);
        }
    }
    collectPushCollections(analysis.script.body, owned);
    return owned;
}

// Whether an `if` statement is a ring-eviction guard over an owned collection
// (`if array.size(coll) > K` whose body only `*.delete`s an `array.shift`/
// `array.remove` of that collection). The drawing transforms elide this — the
// ring evicts implicitly — so `transformOther` skips it.
function isEvictionGuard(stmt: Statement, owned: ReadonlySet<string>): boolean {
    if (stmt.kind !== "if-statement" || stmt.elseBody !== null || stmt.elseIfClauses.length > 0) {
        return false;
    }
    const collection = evictionGuardCollection(stmt.condition);
    if (collection === null || !owned.has(collection)) {
        return false;
    }
    return stmt.thenBody.body.every((inner) => isEvictionDelete(inner, collection));
}

// The collection name of an `array.size(coll) >|>= K` guard condition, or null.
function evictionGuardCollection(condition: ExpressionNode): string | null {
    if (
        condition.kind !== "binary-expression" ||
        (condition.operator !== ">" && condition.operator !== ">=") ||
        condition.left.kind !== "call-expression" ||
        calleeName(condition.left) !== "array.size"
    ) {
        return null;
    }
    const arg = condition.left.args[0]?.value;
    return arg !== undefined && arg.kind === "identifier-expression" ? arg.name : null;
}

// Whether a statement is a `*.delete(array.shift|remove(coll))` eviction line.
function isEvictionDelete(stmt: Statement, collection: string): boolean {
    if (stmt.kind !== "expression-statement" || stmt.expression.kind !== "call-expression") {
        return false;
    }
    const name = calleeName(stmt.expression);
    if (name === null || !name.endsWith(".delete")) {
        return false;
    }
    const arg = stmt.expression.args[0]?.value;
    if (arg === undefined || arg.kind !== "call-expression") {
        return false;
    }
    const inner = calleeName(arg);
    const target = arg.args[0]?.value;
    return (
        (inner === "array.shift" || inner === "array.remove") &&
        target !== undefined &&
        target.kind === "identifier-expression" &&
        target.name === collection
    );
}

// Whether a call is a drawing constructor / setter / collection-or-table
// mutation the drawing transforms already consumed.
function isDrawingOwnedCall(call: CallExpression, owned: ReadonlySet<string>): boolean {
    const name = calleeName(call);
    if (name === null) {
        return false;
    }
    if (DRAWING_KIND_MAP.has(name as PineDrawingConstructor)) {
        return true;
    }
    const target = firstArgName(call);
    if (target === null || !owned.has(target)) {
        return false;
    }
    // A collection / table / linefill mutation, or any `*.set_*`/`*.delete`
    // setter, against an owned handle/collection — the drawing transforms
    // already emitted these.
    return (
        name.startsWith("array.") ||
        name.startsWith("table.") ||
        name.startsWith("linefill.") ||
        /\.(set_\w+|delete)$/.test(name)
    );
}

// Whether a value expression is directly a drawing constructor call (so a
// `var line lvl = line.new(...)` decl is skipped — Camp A owns it).
function isDrawingConstructorValue(value: ExpressionNode): boolean {
    if (value.kind !== "call-expression") {
        return false;
    }
    const name = calleeName(value);
    return name !== null && DRAWING_KIND_MAP.has(name as PineDrawingConstructor);
}

// The `state.*` factory member for a literal kind, or `null` for `na`/`color`.
function factoryForLiteralKind(literalKind: string): string | null {
    switch (literalKind) {
        case "int":
            return "state.int";
        case "float":
            return "state.float";
        case "bool":
            return "state.bool";
        case "string":
            return "state.string";
        default:
            return null;
    }
}

// The chartlang `state.*` slot factory for a scalar's initializer literal, or
// `null` when the type cannot be inferred. A unary `+`/`-` numeric literal
// infers from its operand.
function stateFactory(value: ExpressionNode): string | null {
    if (value.kind === "literal-expression") {
        return factoryForLiteralKind(value.literalKind);
    }
    if (value.kind === "unary-expression" && value.operand.kind === "literal-expression") {
        return factoryForLiteralKind(value.operand.literalKind);
    }
    return null;
}

// The state-slot local name for a Pine scalar variable.
function stateSlotName(pineName: string): string {
    return `__${pineName}_state`;
}

// The `var`/`varip` scalar declarations this transform owns (a drawing-handle
// or `na`-initialised decl is skipped). Returns a name → slot-local map.
function registerStateSlots(
    analysis: SemanticResult,
    owned: ReadonlySet<string>,
): Map<string, string> {
    const slots = new Map<string, string>();
    for (const stmt of analysis.script.body) {
        if (
            stmt.kind !== "variable-declaration" ||
            (stmt.qualifier !== "var" && stmt.qualifier !== "varip") ||
            owned.has(stmt.name) ||
            isDrawingConstructorValue(stmt.initializer) ||
            stmt.initializer.kind === "na-expression" ||
            // A malformed / array-typed decl the parser could not fully model
            // (e.g. `var line[] xs = array.new<line>()`) is not a scalar slot.
            stmt.initializer.kind === "unknown-expression" ||
            isInputCall(stmt.initializer)
        ) {
            continue;
        }
        const slot = stateSlotName(stmt.name);
        slots.set(stmt.name, slot);
    }
    return slots;
}

// Emit the `appendStateSlot` IR for each registered slot, choosing the slot
// factory + init expression. Done after the slot-name map is built so the
// init expression can rewrite references to earlier slots.
function emitStateSlots(
    analysis: SemanticResult,
    scaffold: ScriptScaffold,
    diagnostics: DiagnosticCollector,
    slots: ReadonlyMap<string, string>,
    ctx: EmitContext,
): void {
    for (const stmt of analysis.script.body) {
        if (stmt.kind !== "variable-declaration") {
            continue;
        }
        const slot = slots.get(stmt.name);
        if (slot === undefined) {
            continue;
        }
        let factory = stateFactory(stmt.initializer);
        if (factory === null) {
            diagnostics.pushCode("scalar-state-type-defaulted", stmt.span);
            factory = "state.float";
        }
        const tick =
            stmt.qualifier === "varip" ? factory.replace("state.", "state.tick.") : factory;
        const initExpr = `${tick}(${emitWithContext(stmt.initializer, ctx)})`;
        appendStateSlot(scaffold, { name: slot, initExpr });
    }
}

// Read the recorded `input.int` literal default for a registered input name,
// or `null`. Re-walks the top-level `input.int(N)` named declarations.
function inputDefaults(analysis: SemanticResult): Map<string, number> {
    const defaults = new Map<string, number>();
    for (const stmt of analysis.script.body) {
        if (stmt.kind !== "variable-declaration" && stmt.kind !== "assignment") {
            continue;
        }
        const value = stmt.kind === "variable-declaration" ? stmt.initializer : stmt.value;
        if (value.kind !== "call-expression") {
            continue;
        }
        if (calleeName(value) !== "input.int") {
            continue;
        }
        const first = value.args.find((arg) => arg.name === null);
        if (
            first === undefined ||
            first.value.kind !== "literal-expression" ||
            first.value.literalKind !== "int"
        ) {
            continue;
        }
        defaults.set(stmt.name, Number.parseInt(first.value.value, 10));
    }
    return defaults;
}

// The transform's mutable threading context.
type Walk = {
    readonly analysis: SemanticResult;
    readonly scaffold: ScriptScaffold;
    readonly diagnostics: DiagnosticCollector;
    readonly owned: ReadonlySet<string>;
    readonly defaults: ReadonlyMap<string, number>;
};

/**
 * Lower every **non-drawing** top-level statement of the analysed Pine script
 * into chartlang TypeScript source strings appended to the
 * {@link ScriptScaffold}'s `computeBody`. This is the last transform in the
 * pipeline (Task 16 calls it after every drawing transform): it owns control
 * flow (`if`/`else if`/`else`, literal-/input-bounded `for`, `switch`,
 * ternaries), scalar `var`/`varip`/`:=` state (lowered to `state.*` slots),
 * `ta.*`/`math.*`/`str.*` passthrough, the plot family, `request.security`
 * MTF reads, and strategy-as-indicator signal alerts.
 *
 * Statements the drawing transforms already consumed — drawing constructors,
 * `*.set_*`/`*.delete`/`array.*`/`table.*`/`linefill.*` mutations against a
 * known handle/collection, and the handle/collection declarations themselves
 * — are SKIPPED, so the body never double-emits a drawing and never lands a
 * `draw.*` inside a loop. Pine input references rewrite to `inputs.<name>` and
 * scalar reads to `<slot>.value`. Mutates the scaffold + diagnostics; Task 16
 * reads `scaffold.stateSlots` + `scaffold.computeBody`.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { lex } from "../lexer/index.js";
 *     import { parseStatements } from "../parser/index.js";
 *     import { analyze } from "../semantic/index.js";
 *     import { DiagnosticCollector } from "./diagnosticCollector.js";
 *     import { transformDeclaration } from "./declaration.js";
 *     import { transformOther } from "./other.js";
 *     const src = '//@version=6\nindicator("X")\nif close > open\n    plot(close)\n';
 *     const analysis = analyze(parseStatements(lex(src).tokens).script);
 *     const decl = analysis.script.declaration;
 *     if (decl !== null && decl.kind === "indicator-declaration") {
 *         const diagnostics = new DiagnosticCollector();
 *         const scaffold = transformDeclaration(decl, analysis, diagnostics);
 *         transformOther(analysis, scaffold, diagnostics);
 *         void scaffold.computeBody.statements;
 *         // ["if (bar.close > bar.open) { plot(bar.close); }"]
 *     }
 */
export function transformOther(
    analysis: SemanticResult,
    scaffold: ScriptScaffold,
    diagnostics: DiagnosticCollector,
): void {
    const owned = drawingOwnedSymbols(analysis);
    const defaults = inputDefaults(analysis);
    const slots = registerStateSlots(analysis, owned);
    const inputNames = new Set(scaffold.inputs.map((input) => input.name));
    const ctx: EmitContext = {
        annotations: analysis.annotations,
        inputNames,
        localNames: new Set(),
        stateSlots: slots,
    };
    emitStateSlots(analysis, scaffold, diagnostics, slots, ctx);
    const walk: Walk = { analysis, scaffold, diagnostics, owned, defaults };
    for (const statement of analysis.script.body) {
        for (const line of emitStatement(statement, ctx, walk)) {
            appendComputeStatement(scaffold, line);
        }
    }
}

// Render one statement to zero or more chartlang source strings. A
// drawing-owned statement, an input declaration, and a registered state-slot
// declaration each render to nothing (their effects live elsewhere).
function emitStatement(stmt: Statement, ctx: EmitContext, walk: Walk): readonly string[] {
    const emitBody: BodyEmitter = (statements, innerCtx) =>
        statements.flatMap((inner) => emitStatement(inner, innerCtx, walk));

    switch (stmt.kind) {
        case "variable-declaration":
            return emitDeclaration(stmt, ctx, walk);
        case "assignment":
            return emitAssignment(stmt, ctx, walk);
        case "expression-statement":
            return emitExpressionStatement(stmt.expression, ctx, walk);
        case "if-statement":
            return isEvictionGuard(stmt, walk.owned) ? [] : [emitIf(stmt, ctx, emitBody)];
        case "for-statement":
            return emitFor(
                stmt,
                ctx,
                walk.diagnostics,
                (name) => walk.defaults.get(name) ?? null,
                emitBody,
            );
        case "switch-statement": {
            const rendered = emitSwitch(stmt, ctx, emitBody);
            return rendered === "" ? [] : [rendered];
        }
        case "break-statement":
            return ["break;"];
        case "continue-statement":
            return ["continue;"];
        case "block-statement":
            return [`{ ${emitBody(stmt.body, ctx).join(" ")} }`];
        case "return-statement":
            return [];
    }
}

function emitDeclaration(
    stmt: VariableDeclaration,
    ctx: EmitContext,
    walk: Walk,
): readonly string[] {
    if (
        walk.owned.has(stmt.name) ||
        isDrawingConstructorValue(stmt.initializer) ||
        ctx.stateSlots.has(stmt.name) ||
        isInputCall(stmt.initializer) ||
        // A malformed / array-typed handle decl the parser modelled as a
        // scalar with no initializer — the drawing transforms own its effect.
        stmt.initializer.kind === "unknown-expression"
    ) {
        return [];
    }
    return [`let ${stmt.name} = ${emitCallValue(stmt.initializer, ctx, walk)};`];
}

function emitAssignment(stmt: Assignment, ctx: EmitContext, walk: Walk): readonly string[] {
    if (
        walk.owned.has(stmt.name) ||
        isDrawingConstructorValue(stmt.value) ||
        isInputCall(stmt.value)
    ) {
        return [];
    }
    const value = emitCallValue(stmt.value, ctx, walk);
    const slot = ctx.stateSlots.get(stmt.name);
    if (slot !== undefined) {
        return [`${slot}.value = ${value};`];
    }
    const annotation = walk.analysis.annotations.get(stmt)?.assignment;
    const keyword = annotation?.kind === "declaration" ? "let " : "";
    return [`${keyword}${stmt.name} = ${value};`];
}

// Render a value expression that MAY be a special call (request.security /
// str.* / ta.* / math.*), falling back to the input-aware emitter.
function emitCallValue(value: ExpressionNode, ctx: EmitContext, walk: Walk): string {
    if (value.kind === "call-expression") {
        const special = emitSpecialCall(value, ctx, walk);
        if (special !== null) {
            return special;
        }
    }
    return emitWithContext(value, ctx);
}

// Whether a call is an `input.*` primitive (its declaration is Task 9's, and
// references rewrite to `inputs.<name>`, so the decl itself emits nothing).
function isInputCall(value: ExpressionNode): boolean {
    if (value.kind !== "call-expression") {
        return false;
    }
    return calleeName(value)?.startsWith("input.") ?? false;
}

function emitExpressionStatement(
    expr: ExpressionNode,
    ctx: EmitContext,
    walk: Walk,
): readonly string[] {
    if (expr.kind !== "call-expression") {
        return [`${emitWithContext(expr, ctx)};`];
    }
    if (isDrawingOwnedCall(expr, walk.owned)) {
        return [];
    }
    if (isPlotFamilyCall(expr)) {
        const plot = emitPlotFamily(expr, ctx, walk.diagnostics);
        return plot === null ? [] : [plot];
    }
    const signal = emitStrategySignal(expr, walk.diagnostics);
    if (signal !== null) {
        return [signal];
    }
    const special = emitSpecialCall(expr, ctx, walk);
    if (special !== null) {
        return [`${special};`];
    }
    return [`${emitWithContext(expr, ctx)};`];
}

// Lower a `ta.*` / `math.*` / `str.*` / `request.security` call into its
// chartlang form, pushing the matching passthrough diagnostic. Returns `null`
// for any other call (the caller falls back to the generic emitter).
function emitSpecialCall(call: CallExpression, ctx: EmitContext, walk: Walk): string | null {
    if (isRequestSecurityCall(call)) {
        return emitRequestSecurity(call, ctx, walk.diagnostics);
    }
    const str = emitStr(call, ctx);
    if (str !== null) {
        if (str.kind === "warn") {
            walk.diagnostics.pushCode(str.code, call.span);
            return emitWithContext(call, ctx);
        }
        return str.source;
    }
    const name = calleeName(call);
    if (name === null) {
        return null;
    }
    if (name.startsWith("ta.")) {
        return emitTa(name, call, ctx, walk);
    }
    if (name.startsWith("math.")) {
        return emitMath(name, call, ctx, walk);
    }
    return null;
}

function emitTa(name: string, call: CallExpression, ctx: EmitContext, walk: Walk): string {
    const mapping = taLookup(name);
    if (mapping === null) {
        walk.diagnostics.pushCode("ta-not-mapped", call.span);
        return `${emitWithContext(call, ctx)} /* TODO unmapped */`;
    }
    if (mapping.signatureNote !== undefined) {
        walk.diagnostics.pushCode("ta-signature-divergence", call.span, mapping.signatureNote);
    }
    const args = call.args.map((arg) => emitWithContext(arg.value, ctx)).join(", ");
    return `${mapping.chartlang}(${args})`;
}

function emitMath(name: string, call: CallExpression, ctx: EmitContext, walk: Walk): string {
    const mapping = mathLookup(name);
    if (mapping === null) {
        walk.diagnostics.pushCode("math-not-mapped", call.span);
        return `${emitWithContext(call, ctx)} /* TODO unmapped */`;
    }
    const args = call.args.map((arg) => emitWithContext(arg.value, ctx)).join(", ");
    return `${mapping.chartlang}(${args})`;
}

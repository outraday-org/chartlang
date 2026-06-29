// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallExpression, ExpressionNode, HistoryAccessExpression } from "../ast/index.js";
import type {
    Assignment,
    BreakStatement,
    ContinueStatement,
    FunctionDeclaration,
    Statement,
    TupleDeclaration,
    VariableDeclaration,
} from "../ast/statements.js";
import { DIAGNOSTIC_CODE_ENTRIES } from "../diagnostics/codes.js";
import type { SourceSpan } from "../index.js";
import {
    BUILTIN_CALL_MAP,
    DRAWING_KIND_MAP,
    lowerBuiltinCall,
    mathLookup,
    multiReturnTaLookup,
} from "../mapping/index.js";
import type { MultiReturnTaMapping, PineDrawingConstructor } from "../mapping/index.js";
import type { SecurityTupleAnnotation, SemanticResult } from "../semantic/index.js";
import { collectUdfBodyFacts } from "../semantic/statefulness.js";
import { emitAlertCall } from "./alertCall.js";
import { type BodyEmitter, emitFor, emitIf, emitSwitch } from "./controlFlow.js";
import type { DiagnosticCollector } from "./diagnosticCollector.js";
import type { ArraySlotInfo, EmitContext, MapSlotInfo } from "./emitContext.js";
import { emitScalar, emitWithContext, lowerTaToCurrent } from "./emitContext.js";
import { forEachHistoryAccess } from "./exprEmit.js";
import type { ScriptScaffold } from "./ir.js";
import type { MapScan } from "./mapCollection.js";
import { scanMaps } from "./mapCollection.js";
import type { NameAllocator } from "./nameAllocator.js";
import type { NumericArrayScan } from "./numericArray.js";
import { scanNumericArrays } from "./numericArray.js";
import { emitPlotFamily, isPlotFamilyCall } from "./plotFamily.js";
import { emitRequestSecurity, isRequestSecurityCall } from "./requestSecurity.js";
import { appendComputeStatement, appendStateSlot } from "./scaffoldMutators.js";
import {
    collectSecurityFeedInputs,
    securityCallbackRead,
    securityDataRead,
    securityOpts,
} from "./securityShape.js";
import { emitStr } from "./strFormat.js";
import { emitStrategySignal } from "./strategySignals.js";
import type { InlineScope } from "./udfInline.js";
import { collectStatefulUdfs, inlineStatefulCalls } from "./udfInline.js";

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

// The TypeScript cast an `inputs.<name>` read needs, derived from the input
// factory in its emitted code. `input.int`/`input.float`/`input.source` lower
// to a numeric (`source` is series-or-scalar, assignable from `number`);
// `input.bool` → `boolean`; the string-valued factories → `string`. `null`
// leaves the read uncast (`enum`/unknown factories the converter does not
// emit). chartlang types `compute({ inputs })` loosely, so the cast is what
// makes `ta.atr(inputs.length)` type-check.
function inputCastType(code: string): string | null {
    if (code.startsWith("input.int(") || code.startsWith("input.float(")) {
        return "number";
    }
    if (code.startsWith("input.source(")) {
        return "number";
    }
    if (code.startsWith("input.bool(")) {
        return "boolean";
    }
    // A string-options dropdown lowers to `input.enum("…", […])` — its value is
    // one of the string options, so it casts like `input.string`.
    if (
        code.startsWith("input.string(") ||
        code.startsWith("input.interval(") ||
        code.startsWith('input.enum("')
    ) {
        return "string";
    }
    // A numeric-options dropdown lowers to `input.enum(21, […])` — its value is
    // one of the numeric options, so it casts like `input.int` (length args /
    // comparisons keep type-checking). The string enum was matched just above.
    if (code.startsWith("input.enum(")) {
        return "number";
    }
    return null;
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
    collectPolylinePointCollections(analysis, owned);
    return owned;
}

// The `chart.point` collections a `polyline.new(coll, …)` consumes — owned by
// the polyline transform, which rebuilds them as a fixed anchor list. Adding
// them here stops `transformOther` from leaking the `var coll = array.new<…>()`
// declaration and its `array.push(coll, chart.point.*)` build statements as
// raw (uncompilable) source.
function collectPolylinePointCollections(analysis: SemanticResult, out: Set<string>): void {
    for (const site of analysis.drawingSites) {
        if (site.constructor !== "polyline.new") {
            continue;
        }
        const first = site.call.args.find((arg) => arg.name === null)?.value;
        if (first !== undefined && first.kind === "identifier-expression") {
            out.add(first.name);
        }
    }
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

// Whether a statement removes the head of `collection`: a handle ring's
// `*.delete(array.shift|remove(coll))`, or a numeric ring's BARE
// `array.shift(coll)` / `array.remove(coll, …)` (no handle to delete).
function isEvictionDelete(stmt: Statement, collection: string): boolean {
    if (stmt.kind !== "expression-statement" || stmt.expression.kind !== "call-expression") {
        return false;
    }
    return isHeadRemoval(stmt.expression, collection);
}

// Whether a call removes the head of `collection`: a bare `array.shift(coll)` /
// `array.remove(coll, …)`, or a `*.delete(...)` wrapping one of those.
function isHeadRemoval(call: CallExpression, collection: string): boolean {
    const name = calleeName(call);
    if (name === "array.shift" || name === "array.remove") {
        const target = call.args[0]?.value;
        return (
            target !== undefined &&
            target.kind === "identifier-expression" &&
            target.name === collection
        );
    }
    if (name?.endsWith(".delete")) {
        const arg = call.args[0]?.value;
        return (
            arg !== undefined && arg.kind === "call-expression" && isHeadRemoval(arg, collection)
        );
    }
    return false;
}

// Whether a call is a drawing constructor / setter / collection-or-table
// mutation the drawing transforms already consumed. An `array.*` call over a
// numeric `state.array` slot (`arrayNames`) is NOT drawing-owned — it emits,
// rewritten onto the slot by the `EmitContext` — so it is excluded here.
function isDrawingOwnedCall(
    call: CallExpression,
    owned: ReadonlySet<string>,
    arrayNames: ReadonlySet<string>,
): boolean {
    const name = calleeName(call);
    if (name === null) {
        return false;
    }
    if (DRAWING_KIND_MAP.has(name as PineDrawingConstructor)) {
        return true;
    }
    const target = firstArgName(call);
    if (target === null || arrayNames.has(target) || !owned.has(target)) {
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

// Whether a value expression produces a `color` (a `#RRGGBB(AA)` literal, a
// `color.*` palette member, or a `color.*(...)` constructor call). Drives the
// `var color` scalar inference when the declaration carries no `color` type
// annotation (`var c = color.red`).
function isColorValued(value: ExpressionNode): boolean {
    if (value.kind === "literal-expression") {
        return value.literalKind === "color";
    }
    if (value.kind === "member-access-expression") {
        return value.head === null && value.chain[0] === "color";
    }
    if (value.kind === "call-expression") {
        return calleeName(value)?.startsWith("color.") === true;
    }
    return false;
}

// Whether a scalar `var`/`varip` is a persistent COLOR (so it lowers to
// `state.color`): a `color` type annotation, or a color-valued initializer.
function colorScalar(decl: VariableDeclaration): boolean {
    if (decl.typeAnnotation !== null && decl.typeAnnotation.kind === "named-type") {
        if (decl.typeAnnotation.name === "color") {
            return true;
        }
    }
    return isColorValued(decl.initializer);
}

// The element type a scalar `var`/`varip` carries — picks the `state.*` factory
// and, for a history-indexed scalar, which series slot it lowers to. `color`
// (a scalar-only `state.color`) is checked first; then the inferable slot
// factory (`state.int`/`float`/`bool`/`string`); then the declared type
// annotation (so `var bool flag = na` is `bool` despite the `na` init); else
// `numeric` — an un-inferable init (identifier/expression) defaults to a numeric
// series (`Number.NaN`), the `scalar-state-type-defaulted` precedent.
type ScalarElement = "numeric" | "bool" | "string" | "color";

function scalarElementType(decl: VariableDeclaration): ScalarElement {
    if (colorScalar(decl)) {
        return "color";
    }
    const factory = stateFactory(decl.initializer);
    if (factory !== null) {
        if (factory === "state.bool") {
            return "bool";
        }
        if (factory === "state.string") {
            return "string";
        }
        return "numeric";
    }
    if (decl.typeAnnotation !== null && decl.typeAnnotation.kind === "named-type") {
        const name = decl.typeAnnotation.name;
        if (name === "bool") {
            return "bool";
        }
        if (name === "string") {
            return "string";
        }
    }
    return "numeric";
}

// Whether a top-level statement is a scalar `var`/`varip` declaration this
// transform owns the lowering of (a drawing-handle, malformed/array-typed, or
// `input.*` decl is NOT a scalar slot). `na`-init decls ARE candidates here so
// the history-indexed scan can promote a numeric one (`var float prev = na`) to
// `state.series`; a non-history-indexed `na`-init candidate is dropped again by
// `registerStateSlots` (it stays a `let x = Number.NaN`).
function isScalarSlotCandidate(
    stmt: Statement,
    owned: ReadonlySet<string>,
): stmt is VariableDeclaration {
    return (
        stmt.kind === "variable-declaration" &&
        (stmt.qualifier === "var" || stmt.qualifier === "varip") &&
        !owned.has(stmt.name) &&
        !isDrawingConstructorValue(stmt.initializer) &&
        // A malformed / array-typed decl the parser could not fully model
        // (e.g. `var line[] xs = array.new<line>()`) is not a scalar slot.
        stmt.initializer.kind !== "unknown-expression" &&
        !isInputCall(stmt.initializer)
    );
}

// A promoted ta-derived series (`ma_slope = ta.ema(...)` that is `[n]`-indexed):
// its declaring assignment (whose `.value` write each bar feeds the slot) and
// the span of its first genuinely-dynamic offset (a non-literal, non-loop-bound
// `[n]` read), or `null` when every offset is a literal or an enclosing loop
// iterator. A non-`null` span wires the `dynamic-series-index` error.
type TaSeriesPromotion = {
    readonly decl: Assignment;
    readonly dynamicSpan: SourceSpan | null;
};

// The history-indexed scalar `var`/`varip` candidates, partitioned by element
// type. A `numeric` one lowers to `state.series`, a `bool` one to
// `state.boolSeries`, a `string` one to `state.stringSeries` (all indexable, so
// `x[n]` reads work); a `color` (or other still-unsupported type) stays in
// `unsupportedHistory` — it keeps its scalar lowering and gets a
// `series-history-non-numeric` info (color history is deferred). Each map keys
// the Pine name to its declaration so `emitStateSlots` can pick the factory +
// init. `dynamicOffsetSpans` records the access span of every series-slot read
// (numeric/bool/string) whose offset is not a literal — wiring the registered
// `dynamic-series-index` error. `taSeries` is the SEPARATE promotion of an
// `=`-declared ta-derived series that is `[n]`-indexed (a non-`var` numeric
// series; see {@link TaSeriesPromotion}).
type HistorySeriesScan = {
    readonly numeric: ReadonlyMap<string, VariableDeclaration>;
    readonly boolSeries: ReadonlyMap<string, VariableDeclaration>;
    readonly stringSeries: ReadonlyMap<string, VariableDeclaration>;
    readonly unsupportedHistory: ReadonlyMap<string, VariableDeclaration>;
    readonly dynamicOffsetSpans: ReadonlyMap<string, SourceSpan>;
    readonly taSeries: ReadonlyMap<string, TaSeriesPromotion>;
};

// Whether a statement DECLARES a ta-derived series the converter promotes to a
// `state.series` slot when it is history-indexed: an `=` assignment whose value
// is DIRECTLY a `ta.*` call (the `.current`-lowered series form). `operator ===
// "="` already characterises a declaration (the semantic analyzer's `=` arm), so
// no annotation re-check is needed; the value is a `ta.*` call, never an owned
// drawing/collection. A ta-series never `[n]`-read keeps its existing `.current`
// scalar lowering — the history-indexed gate is applied in `scanHistorySeries`.
function isTaSeriesDeclaration(stmt: Statement): stmt is Assignment {
    if (
        stmt.kind !== "assignment" ||
        stmt.operator !== "=" ||
        stmt.value.kind !== "call-expression"
    ) {
        return false;
    }
    return calleeName(stmt.value)?.startsWith("ta.") === true;
}

// Whether a history offset is a compile-time literal (`x[1]`) or a unary-literal
// (`x[-1]` — degenerate but literal-bounded). A non-literal offset (`x[i]`) on a
// converter-lowered series slot has no fixed lookback, so it trips
// `dynamic-series-index`.
function isLiteralOffset(offset: ExpressionNode): boolean {
    return (
        offset.kind === "literal-expression" ||
        (offset.kind === "unary-expression" && offset.operand.kind === "literal-expression")
    );
}

function scanHistorySeries(
    analysis: SemanticResult,
    owned: ReadonlySet<string>,
): HistorySeriesScan {
    const candidates = new Map<string, VariableDeclaration>();
    const taCandidates = new Map<string, Assignment>();
    for (const stmt of analysis.script.body) {
        if (isScalarSlotCandidate(stmt, owned)) {
            candidates.set(stmt.name, stmt);
        } else if (isTaSeriesDeclaration(stmt)) {
            taCandidates.set(stmt.name, stmt);
        }
    }
    const numeric = new Map<string, VariableDeclaration>();
    const boolSeries = new Map<string, VariableDeclaration>();
    const stringSeries = new Map<string, VariableDeclaration>();
    const unsupportedHistory = new Map<string, VariableDeclaration>();
    const dynamicOffsetSpans = new Map<string, SourceSpan>();
    const taSeries = new Map<string, TaSeriesPromotion>();
    // The series-lowered element types (their `x[n]` becomes a real indexed read,
    // so a dynamic offset is an error); `color` is scalar-only and never here.
    const seriesByType: Record<"numeric" | "bool" | "string", Map<string, VariableDeclaration>> = {
        numeric,
        bool: boolSeries,
        string: stringSeries,
    };
    // A non-literal offset that is NOT an enclosing loop iterator is genuinely
    // dynamic (`x[i]` with a free `i`); a loop-bound `[i]` is a legal runtime
    // history read on a `Series`/`state.series` receiver.
    const isDynamic = (history: HistoryAccessExpression, loopVars: ReadonlySet<string>): boolean =>
        !isLiteralOffset(history.offset) && !isLoopBoundOffset(history.offset, loopVars);
    walkHistoryAccesses(analysis.script.body, (history, loopVars) => {
        if (history.receiver.kind !== "identifier-expression") {
            return;
        }
        const name = history.receiver.name;
        const decl = candidates.get(name);
        if (decl !== undefined) {
            const element = scalarElementType(decl);
            if (element === "color") {
                // Color history (`state.colorSeries`) is deferred — keep the
                // scalar `state.color` slot and flag the gap.
                unsupportedHistory.set(name, decl);
                return;
            }
            seriesByType[element].set(name, decl);
            if (isDynamic(history, loopVars) && !dynamicOffsetSpans.has(name)) {
                dynamicOffsetSpans.set(name, history.span);
            }
            return;
        }
        const taDecl = taCandidates.get(name);
        if (taDecl !== undefined) {
            const prior = taSeries.get(name);
            const dynamicSpan =
                prior?.dynamicSpan ?? (isDynamic(history, loopVars) ? history.span : null);
            taSeries.set(name, { decl: taDecl, dynamicSpan });
        }
    });
    return { numeric, boolSeries, stringSeries, unsupportedHistory, dynamicOffsetSpans, taSeries };
}

// The visitor a {@link walkHistoryAccesses} caller supplies: each
// `history-access-expression` plus the set of `for`-iterator names in scope at
// that access (so a `<series>[i]` whose offset is the enclosing loop iterator is
// a valid runtime history read, NOT a `dynamic-series-index`).
type HistoryVisit = (history: HistoryAccessExpression, loopVars: ReadonlySet<string>) => void;

// Visit every `history-access-expression` reachable through a statement list,
// descending `if`/`for`/`switch`/`block` bodies and every statement's
// expression tree (via `forEachHistoryAccess`). Mirrors the one-level body walk
// the drawing-ownership scan uses, extended to the full control-flow tree.
// `loopVars` accumulates the enclosing `for`-iterator names so the visitor can
// tell a loop-bound runtime offset from a genuinely dynamic one.
function walkHistoryAccesses(
    statements: readonly Statement[],
    visit: HistoryVisit,
    loopVars: ReadonlySet<string> = new Set(),
): void {
    const visitExpr = (expr: ExpressionNode): void =>
        forEachHistoryAccess(expr, (history) => visit(history, loopVars));
    for (const stmt of statements) {
        switch (stmt.kind) {
            case "variable-declaration":
                visitExpr(stmt.initializer);
                break;
            case "assignment":
                visitExpr(stmt.value);
                break;
            case "tuple-declaration":
                visitExpr(stmt.initializer);
                break;
            case "expression-statement":
                visitExpr(stmt.expression);
                break;
            case "if-statement":
                visitExpr(stmt.condition);
                walkHistoryAccesses(stmt.thenBody.body, visit, loopVars);
                for (const clause of stmt.elseIfClauses) {
                    visitExpr(clause.condition);
                    walkHistoryAccesses(clause.body.body, visit, loopVars);
                }
                if (stmt.elseBody !== null) {
                    walkHistoryAccesses(stmt.elseBody.body, visit, loopVars);
                }
                break;
            case "for-statement":
                walkHistoryAccesses(stmt.body.body, visit, new Set([...loopVars, stmt.variable]));
                break;
            case "switch-statement":
                walkHistorySwitch(stmt, visit, loopVars);
                break;
            case "block-statement":
                walkHistoryAccesses(stmt.body, visit, loopVars);
                break;
            case "break-statement":
            case "continue-statement":
            case "return-statement":
                break;
        }
    }
}

// Visit the history accesses inside a `switch` statement's subject + each case
// body (factored out so `walkHistoryAccesses` stays flat). The default arm is a
// `case` whose `test` is `null`.
function walkHistorySwitch(
    stmt: Extract<Statement, { kind: "switch-statement" }>,
    visit: HistoryVisit,
    loopVars: ReadonlySet<string>,
): void {
    if (stmt.subject !== null) {
        forEachHistoryAccess(stmt.subject, (history) => visit(history, loopVars));
    }
    for (const clause of stmt.cases) {
        if (clause.test !== null) {
            forEachHistoryAccess(clause.test, (history) => visit(history, loopVars));
        }
        walkHistoryAccesses(clause.body, visit, loopVars);
    }
}

// Whether a history offset is the bare identifier of an enclosing `for`
// iterator (`<series>[i]`). Such an offset varies per iteration but stays inside
// the loop's bound, so on a `state.series`/`Series` receiver it is a legal
// runtime history read rather than a `dynamic-series-index`.
function isLoopBoundOffset(offset: ExpressionNode, loopVars: ReadonlySet<string>): boolean {
    return offset.kind === "identifier-expression" && loopVars.has(offset.name);
}

// The `var`/`varip` scalar declarations this transform owns. Returns a name →
// slot-local map. The slot local REUSES the Pine scalar identifier
// (allocator-disambiguated) so a `var int count = 0` reads as `count`, not
// `__count_state`. A `na`-init scalar is registered ONLY when it is a series
// slot (`seriesNames`) OR a persistent `state.color` scalar (`var color c = na`
// → `state.color("#00000000")`) — otherwise it stays a plain `let x =
// Number.NaN` (`emitDeclaration` handles it).
function registerStateSlots(
    analysis: SemanticResult,
    scaffold: ScriptScaffold,
    owned: ReadonlySet<string>,
    seriesNames: ReadonlySet<string>,
): Map<string, string> {
    const slots = new Map<string, string>();
    for (const stmt of analysis.script.body) {
        if (!isScalarSlotCandidate(stmt, owned)) {
            continue;
        }
        if (
            stmt.initializer.kind === "na-expression" &&
            !seriesNames.has(stmt.name) &&
            !colorScalar(stmt)
        ) {
            continue;
        }
        const slot = scaffold.names.allocateForSymbol(stmt.name);
        slots.set(stmt.name, slot);
    }
    return slots;
}

// Emit the `appendStateSlot` IR for each registered slot, choosing the slot
// factory + init expression. Done after the slot-name map is built so the init
// expression can rewrite references to earlier slots. A history-indexed scalar
// lowers to the matching series slot (numeric → `state.series`, bool →
// `state.boolSeries`, string → `state.stringSeries`); a `var color` scalar →
// `state.color`; everything else keeps its scalar factory. (The
// `series-history-non-numeric` info for the still-unsupported color-history case
// is pushed in `transformOther`, which sees every candidate, not just the
// registered slots.)
function emitStateSlots(
    analysis: SemanticResult,
    scaffold: ScriptScaffold,
    diagnostics: DiagnosticCollector,
    slots: ReadonlyMap<string, string>,
    scan: HistorySeriesScan,
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
        if (scan.numeric.has(stmt.name)) {
            appendSeriesSlot(
                stmt,
                slot,
                "state.series",
                numericSeriesInit(stmt, diagnostics, ctx),
                scaffold,
                diagnostics,
                scan,
            );
            continue;
        }
        if (scan.boolSeries.has(stmt.name)) {
            appendSeriesSlot(
                stmt,
                slot,
                "state.boolSeries",
                nonNumericSeriesInit(stmt, "false", ctx),
                scaffold,
                diagnostics,
                scan,
            );
            continue;
        }
        if (scan.stringSeries.has(stmt.name)) {
            appendSeriesSlot(
                stmt,
                slot,
                "state.stringSeries",
                nonNumericSeriesInit(stmt, '""', ctx),
                scaffold,
                diagnostics,
                scan,
            );
            continue;
        }
        if (colorScalar(stmt)) {
            // A persistent `var color` scalar. `varip color` has no
            // `state.tick.color`, so it approximates to the non-tick slot + the
            // shared warning (the `varip-series-approximated` precedent). The
            // `na` init lowers to the transparent CSS string via the color
            // na-flavour (`emitWithContext` → `emitNa`).
            if (stmt.qualifier === "varip") {
                diagnostics.pushCode("varip-series-approximated", stmt.span);
            }
            appendStateSlot(scaffold, {
                name: slot,
                initExpr: `state.color(${emitWithContext(stmt.initializer, ctx)})`,
            });
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

// The `state.series` init for a NUMERIC history-indexed scalar: the literal
// numeric value, `Number.NaN` for an `na` init, or `Number.NaN` +
// `scalar-state-type-defaulted` for an un-inferable init.
function numericSeriesInit(
    stmt: VariableDeclaration,
    diagnostics: DiagnosticCollector,
    ctx: EmitContext,
): string {
    if (stmt.initializer.kind === "na-expression") {
        return "Number.NaN";
    }
    if (stateFactory(stmt.initializer) !== null) {
        return emitWithContext(stmt.initializer, ctx);
    }
    diagnostics.pushCode("scalar-state-type-defaulted", stmt.span);
    return "Number.NaN";
}

// The `state.boolSeries`/`stringSeries` init for a non-numeric history-indexed
// scalar: the runtime first-bar default (`false` / `""`) for an `na` init, else
// the emitted initializer (a literal/expression of the matching type — bool/
// string seeds need no type defaulting, unlike numeric).
function nonNumericSeriesInit(
    stmt: VariableDeclaration,
    naDefault: string,
    ctx: EmitContext,
): string {
    return stmt.initializer.kind === "na-expression"
        ? naDefault
        : emitWithContext(stmt.initializer, ctx);
}

// Append a series slot (`<factory>(<init>)`) sharing the `varip`-approximation
// and dynamic-offset diagnostics across the numeric/bool/string series types. A
// `varip` series lowers to its non-tick form + `varip-series-approximated`
// (`state.tick.*Series` is deferred); a non-literal history offset trips the
// registered `dynamic-series-index` error.
function appendSeriesSlot(
    stmt: VariableDeclaration,
    slot: string,
    factory: string,
    init: string,
    scaffold: ScriptScaffold,
    diagnostics: DiagnosticCollector,
    scan: HistorySeriesScan,
): void {
    if (stmt.qualifier === "varip") {
        diagnostics.pushCode("varip-series-approximated", stmt.span);
    }
    const dynamicSpan = scan.dynamicOffsetSpans.get(stmt.name);
    if (dynamicSpan !== undefined) {
        diagnostics.pushCode("dynamic-series-index", dynamicSpan);
    }
    appendStateSlot(scaffold, { name: slot, initExpr: `${factory}(${init})` });
}

// Promote each `=`-declared, history-indexed ta-series (`ma_slope = ta.ema(...)`
// read as `ma_slope[i]`) to a `state.series` slot. ALLOCATES the slot local
// (reusing the Pine identifier) into the shared `slots`/`seriesNames` maps —
// reusing the EXISTING `var`→`state.series` emit machinery: the declaring
// assignment lowers via `emitAssignment` to `<slot>.value = ta.<…>(...).current`
// (the per-bar write), a bare read to `<slot>.value`, and `<slot>[n]` to a real
// series index. The slot init is `Number.NaN` (the value is computed each bar).
// A genuinely-dynamic offset still wires `dynamic-series-index`.
function emitTaSeriesSlots(
    scaffold: ScriptScaffold,
    diagnostics: DiagnosticCollector,
    scan: HistorySeriesScan,
    slots: Map<string, string>,
    seriesNames: Set<string>,
): void {
    for (const [name, promotion] of scan.taSeries) {
        const slot = scaffold.names.allocateForSymbol(name);
        slots.set(name, slot);
        seriesNames.add(name);
        if (promotion.dynamicSpan !== null) {
            diagnostics.pushCode("dynamic-series-index", promotion.dynamicSpan);
        }
        appendStateSlot(scaffold, { name: slot, initExpr: "state.series(Number.NaN)" });
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

// Register a `state.array` slot per bounded numeric array, emit its
// `const <slot> = state.array<number>(K);` declaration, push the
// eviction-elision info (the ring rotates internally), and report the
// non-numeric / unbounded collections. Returns the Pine-name → slot map threaded
// into the `EmitContext` so `array.*(coll, …)` calls rewrite onto the slot. The
// slot local reuses the Pine collection identifier (allocator-disambiguated) so
// `var array<float> win` reads as `win`. Done before the statement walk so each
// slot decl precedes its first use.
function emitArraySlots(
    scaffold: ScriptScaffold,
    diagnostics: DiagnosticCollector,
    scan: NumericArrayScan,
): Map<string, ArraySlotInfo> {
    const slots = new Map<string, ArraySlotInfo>();
    for (const [name, info] of scan.slots) {
        const local = scaffold.names.allocateForSymbol(name);
        slots.set(name, { local, cap: info.cap });
        appendStateSlot(scaffold, { name: local, initExpr: `state.array<number>(${info.cap})` });
        diagnostics.pushCode("ring-eviction-implicit", info.decl.span);
    }
    for (const [, span] of scan.nonNumeric) {
        diagnostics.pushCode("array-collection-non-numeric", span);
    }
    for (const [, span] of scan.unbounded) {
        diagnostics.pushCode("unbounded-array-collection", span);
    }
    return slots;
}

// Register a `state.map` slot per numeric-value map, emit its `const <slot> =
// state.map<number, number>(cap);` declaration, push the capacity-synthesis info
// (Pine maps are unbounded; chartlang requires a literal cap), and report the
// non-numeric maps. Returns the Pine-name → slot map threaded into the
// `EmitContext` so `map.*(id, …)` calls rewrite onto the slot. The slot local
// reuses the Pine map identifier (allocator-disambiguated). Done before the
// statement walk so each slot decl precedes its first use.
function emitMapSlots(
    scaffold: ScriptScaffold,
    diagnostics: DiagnosticCollector,
    scan: MapScan,
): Map<string, MapSlotInfo> {
    const slots = new Map<string, MapSlotInfo>();
    for (const [name, info] of scan.slots) {
        const local = scaffold.names.allocateForSymbol(name);
        slots.set(name, { local, cap: info.cap });
        appendStateSlot(scaffold, {
            name: local,
            initExpr: `state.map<number, number>(${info.cap})`,
        });
        diagnostics.pushCode("map-capacity-synthesized", info.decl.span);
    }
    for (const [, span] of scan.nonNumeric) {
        diagnostics.pushCode("map-collection-non-numeric", span);
    }
    return slots;
}

// The transform's mutable threading context.
type Walk = {
    readonly analysis: SemanticResult;
    readonly scaffold: ScriptScaffold;
    readonly diagnostics: DiagnosticCollector;
    readonly owned: ReadonlySet<string>;
    readonly arrayNames: ReadonlySet<string>;
    readonly defaults: ReadonlyMap<string, number>;
    // Stateful UDFs (`stateful: true`), inline-expanded at each call site so each
    // gets an independent slot. Empty for any script without a stateful helper,
    // which keeps the inline dispatch a no-op (byte-identical to the legacy path).
    readonly statefulUdfs: ReadonlyMap<string, FunctionDeclaration>;
};

// Build the inliner's dependency bundle from the active `Walk`: the stateful-UDF
// set, the shared name allocator, the diagnostic sink, and the two `other.ts`
// lowerers injected as callbacks (so `udfInline.ts` carries no `other.ts`
// import — which would cycle).
function inlineScopeOf(walk: Walk): InlineScope {
    return {
        statefulUdfs: walk.statefulUdfs,
        names: walk.scaffold.names,
        diagnostics: walk.diagnostics,
        emitters: {
            emitValue: (node, ctx) => emitCallValue(node, ctx, walk),
            emitStatement: (stmt, ctx) => emitStatement(stmt, ctx, walk),
        },
    };
}

// ── Tuple destructuring of multi-return `ta.*` (e.g. `ta.macd`) ──────────────

// The multi-return mapping + narrowed call for a tuple-declaration's RHS, or
// `null` when the RHS is not a recognised multi-return `ta.*` constructor.
function multiReturnRhs(
    initializer: ExpressionNode,
): { mapping: MultiReturnTaMapping; call: CallExpression } | null {
    if (initializer.kind !== "call-expression") {
        return null;
    }
    const name = calleeName(initializer);
    if (name === null) {
        return null;
    }
    const mapping = multiReturnTaLookup(name);
    return mapping === null ? null : { mapping, call: initializer };
}

// The result-record local a multi-return tuple-decl binds — `<firstName>Result`
// (e.g. `macdLineResult`), using the first non-`_` target so `[_, x] = …` still
// reads sensibly. Distinct from the element names (which alias INTO this record)
// and idempotent per decl (the allocator memoizes the `…Result` key), so the
// two call sites (`tupleAliases` + `emitTupleDeclaration`) agree.
function tupleResultName(decl: TupleDeclaration, names: NameAllocator): string {
    const named = decl.names.find((target) => target.name !== "_");
    return names.allocateForSymbol(`${named === undefined ? "anon" : named.name}Result`);
}

// The `name → <result>.<field>.current` aliases for a mapped tuple-decl: one
// per non-`_` target whose Pine tuple position maps to a chartlang field.
function tupleAliases(
    decl: TupleDeclaration,
    mapping: MultiReturnTaMapping,
    names: NameAllocator,
): Map<string, string> {
    const result = tupleResultName(decl, names);
    const aliases = new Map<string, string>();
    decl.names.forEach((target, index) => {
        const field = mapping.fields[index];
        if (target.name === "_" || field === null || field === undefined) {
            return;
        }
        aliases.set(target.name, `${result}.${field}.current`);
    });
    return aliases;
}

// Whether any non-`_` target has no chartlang field (a dropped Pine output like
// `ta.dmi`'s ADX, or more names than the function returns).
function tupleHasUnaliasable(decl: TupleDeclaration, mapping: MultiReturnTaMapping): boolean {
    return decl.names.some((target, index) => {
        const field = mapping.fields[index];
        return target.name !== "_" && (field === null || field === undefined);
    });
}

// Pre-scan top-level tuple-declarations into one alias map (mirrors
// `registerStateSlots`), built into the `EmitContext` so later references
// rewrite even though the result const is emitted at the decl's position.
function registerTupleFields(analysis: SemanticResult, names: NameAllocator): Map<string, string> {
    const aliases = new Map<string, string>();
    for (const stmt of analysis.script.body) {
        if (stmt.kind !== "tuple-declaration") {
            continue;
        }
        const resolved = multiReturnRhs(stmt.initializer);
        if (resolved === null) {
            continue;
        }
        for (const [name, replacement] of tupleAliases(stmt, resolved.mapping, names)) {
            aliases.set(name, replacement);
        }
    }
    return aliases;
}

// Build the chartlang `<fn>(<positionals>, { <opts> })` call from the Pine
// positional args per the mapping's arg layout. Trailing `opt` args fold into
// one object literal; a `drop` arg that was actually supplied raises
// `multi-return-arg-dropped`; a Pine arg omitted (chartlang default) is skipped.
function emitMultiReturnCall(
    mapping: MultiReturnTaMapping,
    call: CallExpression,
    ctx: EmitContext,
    diagnostics: DiagnosticCollector,
): string {
    const positionalArgs = call.args.filter((arg) => arg.name === null).map((arg) => arg.value);
    const positionals: string[] = [];
    const opts: string[] = [];
    let dropped = false;
    mapping.args.forEach((spec, index) => {
        const arg = positionalArgs[index];
        if (arg === undefined) {
            return;
        }
        if (spec.kind === "positional") {
            positionals.push(emitWithContext(arg, ctx));
        } else if (spec.kind === "opt") {
            opts.push(`${spec.key}: ${emitWithContext(arg, ctx)}`);
        } else {
            dropped = true;
        }
    });
    if (dropped) {
        diagnostics.pushCode("multi-return-arg-dropped", call.span);
    }
    const args = opts.length > 0 ? [...positionals, `{ ${opts.join(", ")} }`] : positionals;
    return `${mapping.chartlang}(${args.join(", ")})`;
}

// Lower a tuple-LHS `request.security` into one independent read per element:
// an OHLCV field → the data form `request.security(<opts>).<field>`, any other
// expression → the callback form `request.security(<opts>, (bar) => <body>)`.
// All N reads share ONE `{ symbol, interval }` opts literal (one feed; the
// runtime dedups via `feedKey`), so the emitted source is N standard
// single-source reads — the compiler's existing `requestedFeeds` extraction
// picks them up with no special-casing. Each non-`_` name binds its own `const`
// (bare downstream references resolve unchanged — no alias indirection); a `_`
// or an absent element (arity mismatch, already warned in the semantic walk) is
// skipped. A cross-symbol feed pushes `request-security-different-symbol` once,
// mirroring the single-source advisory. `:=` element reassignment is out of
// scope (same limit as the multi-return-`ta.*` tuple form).
function emitSecurityTuple(
    decl: TupleDeclaration,
    annotation: SecurityTupleAnnotation,
    ctx: EmitContext,
    walk: Walk,
): readonly string[] {
    const opts = securityOpts(annotation.feed.symbol ?? null, annotation.feed.interval);
    if (annotation.feed.symbol !== undefined) {
        walk.diagnostics.pushCode("request-security-different-symbol", decl.span);
    }
    const lines: string[] = [];
    decl.names.forEach((target, index) => {
        const element = annotation.elements[index];
        if (target.name === "_" || element === undefined) {
            return;
        }
        const read =
            element.kind === "ohlcv"
                ? securityDataRead(opts, element.field)
                : securityCallbackRead(opts, emitWithContext(element.node, ctx));
        lines.push(`const ${target.name} = ${read};`);
    });
    return lines;
}

// Lower a tuple destructuring. A `request.security` tuple (classified in the
// semantic walk) lowers to N independent reads — checked BEFORE the
// multi-return-`ta.*` path so it never mis-fires `multi-return-not-mapped`. A
// `request.security` RHS with no annotation is a feed/source reject the semantic
// walk already diagnosed, so it emits nothing rather than falling through.
// Otherwise: `[a, b, c] = ta.macd(...)` lowers into one result const (element
// reads rewrite to `<result>.<field>.current` via the pre-registered aliases),
// and an unrecognised multi-return RHS warns and emits nothing.
function emitTupleDeclaration(
    decl: TupleDeclaration,
    ctx: EmitContext,
    walk: Walk,
): readonly string[] {
    const securityTuple = walk.analysis.annotations.get(decl)?.securityTuple;
    if (securityTuple !== undefined) {
        return emitSecurityTuple(decl, securityTuple, ctx, walk);
    }
    const init = decl.initializer;
    if (init.kind === "call-expression" && isRequestSecurityCall(init)) {
        // A `request.security` tuple whose feed/source the semantic walk
        // rejected (request-security-not-mapped / security-tuple-source-not-list
        // already pushed) — emit nothing, never the misleading
        // multi-return-not-mapped of the `ta.*` path below.
        return [];
    }
    const resolved = multiReturnRhs(decl.initializer);
    if (resolved === null) {
        walk.diagnostics.pushCode("multi-return-not-mapped", decl.span);
        return [];
    }
    if (tupleHasUnaliasable(decl, resolved.mapping)) {
        walk.diagnostics.pushCode("multi-return-arity-mismatch", decl.span);
    }
    const call = emitMultiReturnCall(resolved.mapping, resolved.call, ctx, walk.diagnostics);
    return [`const ${tupleResultName(decl, walk.scaffold.names)} = ${call};`];
}

// ── Pure user-defined function emission (Task 3) ─────────────────────────────

// Every top-level pure UDF (a `kind: "function"` symbol resolved `stateful:
// false`), keyed by name (last declaration wins, mirroring the semantic hoist).
// A stateful UDF (Task 4 inlines it at each call site) and a recursive UDF
// (forced `stateful: true`, already `udf-recursive-rejected`) are excluded; a
// duplicate-named EARLIER declaration resolves to no symbol — the hoist
// registers only the last — and is skipped. The map doubles as the call-graph
// node set `orderPureUdfs` reads.
function collectPureUdfs(analysis: SemanticResult): Map<string, FunctionDeclaration> {
    const pure = new Map<string, FunctionDeclaration>();
    for (const stmt of analysis.script.body) {
        if (stmt.kind !== "function-declaration") {
            continue;
        }
        const symbol = analysis.symbols.get(stmt.span);
        if (symbol === undefined || symbol.stateful !== false) {
            continue;
        }
        pure.set(stmt.name, stmt);
    }
    return pure;
}

// Order the pure UDFs callee-before-caller (post-order DFS over the call graph)
// so a pure UDF that calls another is emitted AFTER its callee — both precede
// the first call site. A bare callee that is not a pure UDF (a `math.*` member
// call has no bare callee at all; `nz`, a stateful UDF, …) resolves to no node
// and is ignored. Recursion cannot occur among pure UDFs (a cycle is forced
// `stateful: true`, so it never enters this set), so the `visited` pre-mark
// terminates every walk and the order is a true topological sort.
function orderPureUdfs(pure: ReadonlyMap<string, FunctionDeclaration>): FunctionDeclaration[] {
    const ordered: FunctionDeclaration[] = [];
    const visited = new Set<string>();
    const visit = (decl: FunctionDeclaration): void => {
        if (visited.has(decl.name)) {
            return;
        }
        visited.add(decl.name);
        for (const callName of collectUdfBodyFacts(decl.body).calls) {
            const target = pure.get(callName);
            if (target !== undefined) {
                visit(target);
            }
        }
        ordered.push(decl);
    };
    for (const decl of pure.values()) {
        visit(decl);
    }
    return ordered;
}

// The chartlang assignment operator for a Pine UDF-body assignment: `=`/`:=`
// both lower to `=`, a compound arithmetic form (`+=`/…) passes through — the
// same rule `emitAssignment` applies to top-level scalars.
function udfAssignOperator(stmt: Assignment): string {
    return stmt.operator === "=" || stmt.operator === ":=" ? "=" : stmt.operator;
}

// Render one UDF-body statement. A value local (`x = expr` / `float x = expr`)
// lowers to `let x = <expr>;` on first sight and `x <op> <expr>;` on a later
// reassignment (the param names + every value local seed `declared`); a bare
// expression statement lowers to `<expr>;`. The implicit-return LAST statement
// additionally yields the `return`: a value local returns its name, a bare
// expression returns the expression. Any OTHER statement kind (control flow)
// reuses the top-level `emitStatement` lowering and contributes no return.
function emitUdfBodyStatement(
    stmt: Statement,
    ctx: EmitContext,
    walk: Walk,
    declared: Set<string>,
    isLast: boolean,
): readonly string[] {
    if (stmt.kind === "assignment" || stmt.kind === "variable-declaration") {
        const value = stmt.kind === "assignment" ? stmt.value : stmt.initializer;
        const rhs = emitCallValue(value, ctx, walk);
        const lines: string[] = [];
        if (stmt.kind === "assignment" && declared.has(stmt.name)) {
            lines.push(`${stmt.name} ${udfAssignOperator(stmt)} ${rhs};`);
        } else {
            declared.add(stmt.name);
            lines.push(`let ${stmt.name} = ${rhs};`);
        }
        if (isLast) {
            lines.push(`return ${stmt.name};`);
        }
        return lines;
    }
    if (stmt.kind === "expression-statement") {
        const source = emitCallValue(stmt.expression, ctx, walk);
        return [isLast ? `return ${source};` : `${source};`];
    }
    return emitStatement(stmt, ctx, walk);
}

// Lower one pure UDF to a reusable chartlang arrow-function `const`. Params are
// emitted with a `: number` TYPE ANNOTATION (Pine UDF params are untyped, but an
// untyped arrow param trips the compiler's `noImplicitAny`, so a clean pure
// helper would not type-check) and — together with every body local and every
// UDF name (already in `ctx.localNames`) — registered as shadowing locals so a
// param/local reference is NOT rewritten to `inputs.*` / a state slot, and a
// sibling-UDF call keeps its bare name. `number` is the sound annotation for the
// numeric helper case: every realistic pure helper uses its params in
// scalar/number positions (arithmetic, `math.*`, comparison), and a `PriceSeries`
// call-site arg (`bar.close`) is `number & Series<…>`, assignable to `number`. A
// pure helper that history-indexes a param (`p[1]`) genuinely needs a series-typed
// param — the same `state.series` promotion the stateful-inline path defers — and
// stays a documented gap. A single-expression body becomes an expression-bodied
// arrow; any other body becomes a block arrow whose locals lower to `let`s and
// whose last statement yields the `return`.
function emitPureUdf(decl: FunctionDeclaration, ctx: EmitContext, walk: Walk): string {
    const params = decl.params.map((param) => param.name);
    const body = decl.body.body;
    const bodyLocals = body.flatMap((stmt) =>
        stmt.kind === "assignment" || stmt.kind === "variable-declaration" ? [stmt.name] : [],
    );
    const childCtx: EmitContext = {
        ...ctx,
        localNames: new Set([...ctx.localNames, ...params, ...bodyLocals]),
    };
    const paramList = params.map((param) => `${param}: number`).join(", ");
    if (body.length === 1 && body[0].kind === "expression-statement") {
        return `const ${decl.name} = (${paramList}) => ${emitCallValue(body[0].expression, childCtx, walk)};`;
    }
    const declared = new Set(params);
    const lines = body.flatMap((stmt, index) =>
        emitUdfBodyStatement(stmt, childCtx, walk, declared, index === body.length - 1),
    );
    return `const ${decl.name} = (${paramList}) => { ${lines.join(" ")} };`;
}

// Emit every pure UDF as a hoisted reusable function at the TOP of the compute
// body (after the state-slot allocations, before any non-UDF statement),
// callee-before-caller, and raise one `udf-emitted-function` info per UDF. The
// statement walk's `function-declaration` arm stays a no-op — the declaration
// site contributes nothing, so this prepend is the only emission. (The seam for
// Task 4: a STATEFUL UDF is excluded here and is inlined at its call sites by
// Task 4; the no-op declaration arm is shared by both paths.)
function emitPureUdfs(
    analysis: SemanticResult,
    scaffold: ScriptScaffold,
    diagnostics: DiagnosticCollector,
    ctx: EmitContext,
    walk: Walk,
): void {
    for (const decl of orderPureUdfs(collectPureUdfs(analysis))) {
        appendComputeStatement(scaffold, emitPureUdf(decl, ctx, walk));
        diagnostics.pushCode("udf-emitted-function", decl.span);
    }
}

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
 * @stable
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
    const drawingOwned = drawingOwnedSymbols(analysis);
    // A `var array<…>` collection (a bounded numeric ring, a non-numeric
    // collection, or an unbounded numeric ring) is added to `owned` so its
    // `array.new(...)` decl + FIFO-eviction `if` are skipped by the statement
    // walk — the SCALAR pipeline must never mis-lower an `array.new(...)` decl as
    // a `state.float(array.new())` slot. A bounded numeric ring's
    // `array.push`/`array.get` operations still emit (rewritten onto the slot);
    // a rejected collection's operations emit raw (the output is an error stub).
    const arrayScan = scanNumericArrays(analysis, drawingOwned);
    // A `var map<…>` collection is added to `owned` (alongside the array
    // collections) so its `map.new(...)` decl is skipped by the statement walk —
    // the SCALAR pipeline must never mis-lower it as a `state.float(map.new())`
    // slot. A numeric-value map's `map.put`/`map.get` operations still emit
    // (rewritten onto the slot); the `map.*` ops never match `isDrawingOwnedCall`
    // (only `array.`/`table.`/`linefill.`/setter calls do), so no map-name
    // carve-out is needed there.
    const mapScan = scanMaps(analysis, drawingOwned);
    const owned: ReadonlySet<string> = new Set([
        ...drawingOwned,
        ...arrayScan.slots.keys(),
        ...arrayScan.nonNumeric.keys(),
        ...arrayScan.unbounded.keys(),
        ...mapScan.slots.keys(),
        ...mapScan.nonNumeric.keys(),
    ]);
    // Numeric-array + map slots are registered + emitted first so their
    // `const <slot> = state.array<number>(K);` / `state.map<number, number>(cap);`
    // declarations precede the scalar slots.
    const arraySlots = emitArraySlots(scaffold, diagnostics, arrayScan);
    const mapSlots = emitMapSlots(scaffold, diagnostics, mapScan);
    const defaults = inputDefaults(analysis);
    const scan = scanHistorySeries(analysis, owned);
    // Every series-lowered scalar (numeric `state.series`, bool `state.boolSeries`,
    // string `state.stringSeries`) routes `[n]` reads to the bare slot via
    // `EmitContext.seriesSlots`; the `.value` read/write stays on `stateSlots`.
    const seriesNames = new Set([
        ...scan.numeric.keys(),
        ...scan.boolSeries.keys(),
        ...scan.stringSeries.keys(),
    ]);
    const slots = registerStateSlots(analysis, scaffold, owned, seriesNames);
    // Promote `=`-declared, history-indexed ta-series into the SAME slot maps so
    // the existing read/write rewrites apply; allocated AFTER the `var` scalar
    // slots so the `slots` map carries every name before the `EmitContext` reads
    // it. The slot decls are emitted here (init `Number.NaN`).
    emitTaSeriesSlots(scaffold, diagnostics, scan, slots, seriesNames);
    const inputNames = new Set(scaffold.inputs.map((input) => input.name));
    const inputCasts = new Map<string, string>();
    for (const input of scaffold.inputs) {
        const cast = inputCastType(input.code);
        if (cast !== null) {
            inputCasts.set(input.name, cast);
        }
    }
    // Every top-level UDF name is a known local: a call site keeps the bare
    // callee (a pure UDF resolves to the hoisted function emitted by
    // `emitPureUdfs`; a stateful UDF is Task 4's inline), never an `inputs.*` /
    // slot rewrite. UDF and input/slot symbols never share a name, so this only
    // ever prevents a spurious callee rewrite.
    const udfNames = new Set<string>();
    for (const stmt of analysis.script.body) {
        if (stmt.kind === "function-declaration") {
            udfNames.add(stmt.name);
        }
    }
    const ctx: EmitContext = {
        annotations: analysis.annotations,
        inputNames,
        localNames: udfNames,
        stateSlots: slots,
        inputCasts,
        securityFeedInputs: collectSecurityFeedInputs(analysis.script),
        tupleFieldAliases: registerTupleFields(analysis, scaffold.names),
        seriesSlots: seriesNames,
        arraySlots,
        arrayWarn: (code, span) => diagnostics.pushCode(code, span),
        mapSlots,
        mapWarn: (code, span) => diagnostics.pushCode(code, span),
        // The nested `ta.*` lowering can fire on every operand; dedupe the
        // `nested-ta-lowered` info to one per script (the `yloc-padding-
        // approximated` precedent), but surface every residual-series warning.
        taWarn: (code, span) => {
            if (
                code === "nested-ta-lowered" &&
                diagnostics.has(DIAGNOSTIC_CODE_ENTRIES[code].code)
            ) {
                return;
            }
            diagnostics.pushCode(code, span);
        },
    };
    emitStateSlots(analysis, scaffold, diagnostics, slots, scan, ctx);
    // A still-unsupported non-numeric history-indexed scalar (color — its
    // `state.colorSeries` is deferred) keeps a scalar lowering and gets a clear
    // info, never a silent broken emit. `bool`/`string` history now lowers to a
    // real `state.boolSeries`/`stringSeries` and is NO LONGER flagged here.
    for (const [, decl] of scan.unsupportedHistory) {
        diagnostics.pushCode("series-history-non-numeric", decl.span);
    }
    const walk: Walk = {
        analysis,
        scaffold,
        diagnostics,
        owned,
        arrayNames: new Set(arraySlots.keys()),
        defaults,
        statefulUdfs: collectStatefulUdfs(analysis),
    };
    // Pure UDFs are hoisted to the FRONT of the compute body (callee-before-
    // caller) before the source-order statement walk, so every reusable function
    // precedes its first call site.
    emitPureUdfs(analysis, scaffold, diagnostics, ctx, walk);
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
        case "tuple-declaration":
            return emitTupleDeclaration(stmt, ctx, walk);
        case "expression-statement":
            return emitExpressionStatement(stmt.expression, ctx, walk);
        case "if-statement": {
            if (isEvictionGuard(stmt, walk.owned)) {
                return [];
            }
            const rendered = emitIf(stmt, ctx, emitBody);
            return rendered === null ? [] : [rendered];
        }
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
        case "continue-statement":
            return emitLoopJump(stmt, ctx, walk);
        case "block-statement":
            return [`{ ${emitBody(stmt.body, ctx).join(" ")} }`];
        case "return-statement":
            return [];
        // A user-defined function declaration contributes nothing at its source
        // position. A PURE UDF is hoisted to the front of the compute body by
        // `emitPureUdfs` (Task 3); a STATEFUL UDF is inline-expanded at each call
        // site by `inlineStatefulCalls` (the emitDeclaration/emitAssignment/
        // emitExpressionStatement dispatch). Both leave this declaration arm a
        // no-op.
        case "function-declaration":
            return [];
    }
}

// Lower a `break`/`continue`. Inside an emitted `for` body (`ctx.inLoop`) it
// becomes the JS jump; at top level — or any block not nested in a loop — there
// is no loop to control, so it raises `break-continue-outside-loop` and emits
// nothing rather than a stray, illegal `break;`/`continue;`.
function emitLoopJump(
    stmt: BreakStatement | ContinueStatement,
    ctx: EmitContext,
    walk: Walk,
): readonly string[] {
    if (ctx.inLoop !== true) {
        walk.diagnostics.pushCode("break-continue-outside-loop", stmt.span);
        return [];
    }
    return [stmt.kind === "break-statement" ? "break;" : "continue;"];
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
    // A stateful-UDF call in the value is inline-expanded: its arg temps + body
    // locals land in `prelude` (emitted before this declaration), and the value
    // becomes the inlined result. No stateful UDF in the script ⇒ untouched path.
    const prelude: string[] = [];
    const initializer =
        walk.statefulUdfs.size === 0
            ? stmt.initializer
            : inlineStatefulCalls(stmt.initializer, ctx, inlineScopeOf(walk), prelude);
    return [...prelude, `let ${stmt.name} = ${emitCallValue(initializer, ctx, walk)};`];
}

function emitAssignment(stmt: Assignment, ctx: EmitContext, walk: Walk): readonly string[] {
    if (
        walk.owned.has(stmt.name) ||
        isDrawingConstructorValue(stmt.value) ||
        isInputCall(stmt.value)
    ) {
        return [];
    }
    const prelude: string[] = [];
    const valueNode =
        walk.statefulUdfs.size === 0
            ? stmt.value
            : inlineStatefulCalls(stmt.value, ctx, inlineScopeOf(walk), prelude);
    const value = emitCallValue(valueNode, ctx, walk);
    // `=`/`:=` both lower to a plain `=`; a compound arithmetic assignment
    // (`+=`/`-=`/`*=`/`/=`) passes its operator through (read-modify-write of an
    // existing scalar, never a declaration).
    const operator = stmt.operator === "=" || stmt.operator === ":=" ? "=" : stmt.operator;
    const slot = ctx.stateSlots.get(stmt.name);
    if (slot !== undefined) {
        return [...prelude, `${slot}.value ${operator} ${value};`];
    }
    const annotation = walk.analysis.annotations.get(stmt)?.assignment;
    const keyword = annotation?.kind === "declaration" ? "let " : "";
    return [...prelude, `${keyword}${stmt.name} ${operator} ${value};`];
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

// Whether a call is an input primitive — an `input.*` member call OR the bare
// generic `input(...)` form (its declaration is hoisted to `manifest.inputs` and
// references rewrite to `inputs.<name>`, so the decl itself emits nothing).
function isInputCall(value: ExpressionNode): boolean {
    if (value.kind !== "call-expression") {
        return false;
    }
    const name = calleeName(value);
    return name === "input" || (name?.startsWith("input.") ?? false);
}

function emitExpressionStatement(
    expr: ExpressionNode,
    ctx: EmitContext,
    walk: Walk,
): readonly string[] {
    if (walk.statefulUdfs.size === 0) {
        return emitExpressionStatementCore(expr, ctx, walk);
    }
    // Inline-expand any stateful-UDF call (including one nested in a
    // `plot(cf_slope(…))` argument), then route the rewritten expression through
    // the normal handling so plot/strategy/special lowering still runs.
    const prelude: string[] = [];
    const target = inlineStatefulCalls(expr, ctx, inlineScopeOf(walk), prelude);
    const core = emitExpressionStatementCore(target, ctx, walk);
    return prelude.length === 0 ? core : [...prelude, ...core];
}

function emitExpressionStatementCore(
    expr: ExpressionNode,
    ctx: EmitContext,
    walk: Walk,
): readonly string[] {
    if (expr.kind !== "call-expression") {
        return [`${emitWithContext(expr, ctx)};`];
    }
    if (isDrawingOwnedCall(expr, walk.owned, walk.arrayNames)) {
        return [];
    }
    if (isPlotFamilyCall(expr)) {
        const plot = emitPlotFamily(expr, ctx, walk.diagnostics, walk.analysis.script.body);
        return plot === null ? [] : [plot];
    }
    const signal = emitStrategySignal(expr, walk.diagnostics);
    if (signal !== null) {
        return [signal];
    }
    // A bare `alert(message, freq?)` lowers here (the frequency is consumed)
    // BEFORE the generic emitter, which would leak the `alert.freq_*` 2nd arg
    // verbatim as an undefined member access.
    const alertSrc = emitAlertCall(expr, ctx, walk.diagnostics);
    if (alertSrc !== null) {
        return [alertSrc];
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
        return emitTa(call, ctx, walk);
    }
    if (name.startsWith("math.")) {
        return emitMath(name, call, ctx, walk);
    }
    // Pine's overloaded `nz(x[, r])` lowers to the scalar `math.nz(...)` (the
    // lowering itself lives in `emitExpr`); raise the advisory here, where the
    // diagnostic collector is in scope, so the author is told the scalar form
    // was assumed (a series arg wants a hand rewrite to `ta.nz`).
    if (name === "nz" && call.args.some((arg) => arg.name === null)) {
        walk.diagnostics.pushCode("nz-scalar-assumed", call.span);
        return emitWithContext(call, ctx);
    }
    if (BUILTIN_CALL_MAP.has(name)) {
        return emitBuiltinCall(name, call, ctx, walk);
    }
    return null;
}

// Lower a bare-rooted calendar built-in call (`time()` / `time_close()` /
// `dayofweek(...)`) onto its chartlang accessor form. A mapped shape returns
// the chartlang source; an unmapped argument shape (e.g. `time(timeframe)`)
// pushes `time-builtin-not-mapped` and falls back to a best-effort emit. The
// mapped forms also lower through `emitExpr` directly (so a NESTED occurrence
// converts), but routing the TOP-LEVEL call here is where the unmapped
// diagnostic can be raised.
function emitBuiltinCall(name: string, call: CallExpression, ctx: EmitContext, walk: Walk): string {
    const args = call.args.map((arg) => emitWithContext(arg.value, ctx));
    const lowered = lowerBuiltinCall(name, args);
    if (lowered === null) {
        walk.diagnostics.pushCode("time-builtin-not-mapped", call.span);
        // Preserve the CALL shape with the bare Pine callee name. Routing
        // through the generic emitter would value-remap the callee
        // (`time` → `bar.time`, `time_close` → `time.timeClose(bar.time)`)
        // and emit a number invoked as a function (`bar.time(...)`); keeping
        // the original name keeps the marker honest and matches the `ta.*` /
        // `math.*` unmapped fallbacks, which leave their callee intact.
        return `${name}(${args.join(", ")}) /* TODO unmapped */`;
    }
    return lowered;
}

// The top-level `ta.*` value of a declaration/assignment. Routes through the
// shared `lowerTaToCurrent` (the SAME rule the nested scalar-position lowering
// in `emitContext` uses) so there is one source of truth; this site additionally
// owns the diagnostics. A `null` lowering means an unmapped / REJECT name —
// push `ta-not-mapped` and leave the bare call (an error stub).
function emitTa(call: CallExpression, ctx: EmitContext, walk: Walk): string {
    const lowered = lowerTaToCurrent(call, ctx);
    if (lowered === null) {
        walk.diagnostics.pushCode("ta-not-mapped", call.span);
        return `${emitWithContext(call, ctx)} /* TODO unmapped */`;
    }
    if (lowered.signatureNote !== undefined) {
        walk.diagnostics.pushCode("ta-signature-divergence", call.span, lowered.signatureNote);
    }
    // chartlang `ta.*` returns a `Series<number>` (a history view); Pine uses
    // the current-bar scalar. `.current` projects that scalar so the result is
    // usable as a number (anchor price, `na`/arithmetic operand, plot value)
    // — `ta.*` maintains its own per-call-site history, so feeding scalars in
    // and reading `.current` out reproduces Pine's per-bar semantics.
    return lowered.source;
}

// Whether a `math.sum`/`math.avg` call is Pine's 2-arg ROLLING form
// (`math.sum(source, length)`) rather than the variadic SCALAR reducer
// (`math.avg(a, b, c)`). Pine's rolling form is exactly two positional args; a
// scalar reducer is any other arity (one, three, …). A one-arg `math.sum(x)`
// is a degenerate scalar (the value itself), so only arity 2 is rolling.
function isRollingWindowCall(name: string, call: CallExpression): boolean {
    if (name !== "math.sum" && name !== "math.avg") {
        return false;
    }
    return call.args.filter((arg) => arg.name === null).length === 2;
}

function emitMath(name: string, call: CallExpression, ctx: EmitContext, walk: Walk): string {
    const mapping = mathLookup(name);
    if (mapping === null) {
        walk.diagnostics.pushCode("math-not-mapped", call.span);
        return `${emitWithContext(call, ctx)} /* TODO unmapped */`;
    }
    // Pine's rolling `math.sum`/`math.avg(source, length)` is a window
    // reduction; chartlang's scalar `math.sum`/`math.avg` is variadic-scalar
    // and there is no `ta` rolling-sum analogue (`ta.cum` is unmapped), so do
    // NOT collapse it onto the scalar form — leave it for a hand rewrite.
    if (isRollingWindowCall(name, call)) {
        walk.diagnostics.pushCode("math-rolling-window-unmapped", call.span);
        return `${emitWithContext(call, ctx)} /* TODO rolling window */`;
    }
    // `math.*` / `Math.*` reducers take scalar `number` args, so a nested `ta.*`
    // argument lowers to its `.current` projection (`math.max(ta.rsi(...), 50)`).
    const args = call.args.map((arg) => emitScalar(arg.value, ctx)).join(", ");
    // `math.round_to_mintick(x)` → `math.roundToMintick(x, syminfo.mintick)`:
    // the chartlang namespace is pure (no ambient `syminfo`), so the author
    // passes the tick size explicitly. Inject it as the second argument here.
    if (name === "math.round_to_mintick") {
        return `${mapping.chartlang}(${args}, syminfo.mintick)`;
    }
    return `${mapping.chartlang}(${args})`;
}

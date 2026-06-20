// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallExpression, ExpressionNode, HistoryAccessExpression } from "../ast/index.js";
import type {
    Assignment,
    Statement,
    TupleDeclaration,
    VariableDeclaration,
} from "../ast/statements.js";
import type { SourceSpan } from "../index.js";
import { DRAWING_KIND_MAP, mathLookup, multiReturnTaLookup, taLookup } from "../mapping/index.js";
import type { MultiReturnTaMapping, PineDrawingConstructor } from "../mapping/index.js";
import type { SemanticResult } from "../semantic/index.js";
import { type BodyEmitter, emitFor, emitIf, emitSwitch } from "./controlFlow.js";
import type { DiagnosticCollector } from "./diagnosticCollector.js";
import type { EmitContext } from "./emitContext.js";
import { emitWithContext } from "./emitContext.js";
import { forEachHistoryAccess } from "./exprEmit.js";
import type { ScriptScaffold } from "./ir.js";
import type { NameAllocator } from "./nameAllocator.js";
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
    if (code.startsWith("input.string(") || code.startsWith("input.interval(")) {
        return "string";
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

// Whether a scalar `var`/`varip` holds a numeric value (so its history can lower
// to a number-backed `state.series`). Read from the slot factory when the type
// is inferable (`state.int`/`state.float`), else from the declared type
// annotation (so `var float prev = na` is numeric despite the `na` init), else
// `true` — an un-inferable init (identifier/expression) defaults to a numeric
// series (init `Number.NaN`), the same precedent as `scalar-state-type-defaulted`.
function scalarIsNumeric(decl: VariableDeclaration): boolean {
    const factory = stateFactory(decl.initializer);
    if (factory !== null) {
        return factory === "state.int" || factory === "state.float";
    }
    if (decl.typeAnnotation !== null && decl.typeAnnotation.kind === "named-type") {
        const name = decl.typeAnnotation.name;
        // `int`/`float` are the only numeric scalar annotations. `bool`/`string`/
        // `color` are non-numeric; every other named type is a drawing handle,
        // already filtered out of the scalar candidates before this runs.
        return name === "int" || name === "float";
    }
    return true;
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

// The history-indexed scalar `var`/`varip` candidates, partitioned by whether
// the scalar is numeric. A numeric history-indexed scalar lowers to
// `state.series` (so its `x[n]` reads work); a `bool`/`string` one keeps its
// scalar lowering and gets a `series-history-non-numeric` info. `numeric` maps
// the Pine name to its declaration (so `emitStateSlots` can pick the init);
// `nonNumeric` is the Pine-name set. `dynamicOffsetSpans` records the access
// span of every numeric series-slot read whose offset is not a literal — wiring
// the registered `dynamic-series-index` error.
type HistorySeriesScan = {
    readonly numeric: ReadonlyMap<string, VariableDeclaration>;
    readonly nonNumeric: ReadonlyMap<string, VariableDeclaration>;
    readonly dynamicOffsetSpans: ReadonlyMap<string, SourceSpan>;
};

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
    for (const stmt of analysis.script.body) {
        if (isScalarSlotCandidate(stmt, owned)) {
            candidates.set(stmt.name, stmt);
        }
    }
    const numeric = new Map<string, VariableDeclaration>();
    const nonNumeric = new Map<string, VariableDeclaration>();
    const dynamicOffsetSpans = new Map<string, SourceSpan>();
    walkHistoryAccesses(analysis.script.body, (history) => {
        if (history.receiver.kind !== "identifier-expression") {
            return;
        }
        const decl = candidates.get(history.receiver.name);
        if (decl === undefined) {
            return;
        }
        if (scalarIsNumeric(decl)) {
            numeric.set(decl.name, decl);
            if (!isLiteralOffset(history.offset) && !dynamicOffsetSpans.has(decl.name)) {
                dynamicOffsetSpans.set(decl.name, history.span);
            }
        } else {
            nonNumeric.set(decl.name, decl);
        }
    });
    return { numeric, nonNumeric, dynamicOffsetSpans };
}

// Visit every `history-access-expression` reachable through a statement list,
// descending `if`/`for`/`switch`/`block` bodies and every statement's
// expression tree (via `forEachHistoryAccess`). Mirrors the one-level body walk
// the drawing-ownership scan uses, extended to the full control-flow tree.
function walkHistoryAccesses(
    statements: readonly Statement[],
    visit: (history: HistoryAccessExpression) => void,
): void {
    for (const stmt of statements) {
        switch (stmt.kind) {
            case "variable-declaration":
                forEachHistoryAccess(stmt.initializer, visit);
                break;
            case "assignment":
                forEachHistoryAccess(stmt.value, visit);
                break;
            case "tuple-declaration":
                forEachHistoryAccess(stmt.initializer, visit);
                break;
            case "expression-statement":
                forEachHistoryAccess(stmt.expression, visit);
                break;
            case "if-statement":
                forEachHistoryAccess(stmt.condition, visit);
                walkHistoryAccesses(stmt.thenBody.body, visit);
                for (const clause of stmt.elseIfClauses) {
                    forEachHistoryAccess(clause.condition, visit);
                    walkHistoryAccesses(clause.body.body, visit);
                }
                if (stmt.elseBody !== null) {
                    walkHistoryAccesses(stmt.elseBody.body, visit);
                }
                break;
            case "for-statement":
                walkHistoryAccesses(stmt.body.body, visit);
                break;
            case "switch-statement":
                walkHistorySwitch(stmt, visit);
                break;
            case "block-statement":
                walkHistoryAccesses(stmt.body, visit);
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
    visit: (history: HistoryAccessExpression) => void,
): void {
    if (stmt.subject !== null) {
        forEachHistoryAccess(stmt.subject, visit);
    }
    for (const clause of stmt.cases) {
        if (clause.test !== null) {
            forEachHistoryAccess(clause.test, visit);
        }
        walkHistoryAccesses(clause.body, visit);
    }
}

// The `var`/`varip` scalar declarations this transform owns. Returns a name →
// slot-local map. The slot local REUSES the Pine scalar identifier
// (allocator-disambiguated) so a `var int count = 0` reads as `count`, not
// `__count_state`. A `na`-init scalar is registered ONLY when it is a numeric
// history-indexed series slot (`seriesNames`) — otherwise it stays a plain
// `let x = Number.NaN` (`emitDeclaration` handles it).
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
        if (stmt.initializer.kind === "na-expression" && !seriesNames.has(stmt.name)) {
            continue;
        }
        const slot = scaffold.names.allocateForSymbol(stmt.name);
        slots.set(stmt.name, slot);
    }
    return slots;
}

// Emit the `appendStateSlot` IR for each registered slot, choosing the slot
// factory + init expression. Done after the slot-name map is built so the
// init expression can rewrite references to earlier slots. A numeric
// history-indexed scalar (`scan.numeric`) lowers to `state.series`; a
// non-numeric history-indexed scalar keeps its scalar factory (the
// `series-history-non-numeric` info for those is pushed in `transformOther`,
// which sees every non-numeric candidate, not just the registered slots).
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
            emitSeriesSlot(stmt, slot, scaffold, diagnostics, scan, ctx);
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

// Emit a `state.series(<init>)` slot for a numeric history-indexed scalar. The
// init is the literal numeric value, `Number.NaN` for an `na` init, or
// `Number.NaN` + `scalar-state-type-defaulted` for an un-inferable init. A
// `varip` series slot lowers to a (non-tick) `state.series` + a
// `varip-series-approximated` info (`state.tick.series` is deferred). A
// non-literal history offset trips the registered `dynamic-series-index` error.
function emitSeriesSlot(
    stmt: VariableDeclaration,
    slot: string,
    scaffold: ScriptScaffold,
    diagnostics: DiagnosticCollector,
    scan: HistorySeriesScan,
    ctx: EmitContext,
): void {
    let init: string;
    if (stmt.initializer.kind === "na-expression") {
        init = "Number.NaN";
    } else if (stateFactory(stmt.initializer) !== null) {
        init = emitWithContext(stmt.initializer, ctx);
    } else {
        diagnostics.pushCode("scalar-state-type-defaulted", stmt.span);
        init = "Number.NaN";
    }
    if (stmt.qualifier === "varip") {
        diagnostics.pushCode("varip-series-approximated", stmt.span);
    }
    const dynamicSpan = scan.dynamicOffsetSpans.get(stmt.name);
    if (dynamicSpan !== undefined) {
        diagnostics.pushCode("dynamic-series-index", dynamicSpan);
    }
    appendStateSlot(scaffold, { name: slot, initExpr: `state.series(${init})` });
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

// Lower `[a, b, c] = ta.macd(...)` into one result const; element reads rewrite
// to `<result>.<field>.current` via the pre-registered aliases. An
// unrecognised multi-return RHS warns and emits nothing.
function emitTupleDeclaration(
    decl: TupleDeclaration,
    ctx: EmitContext,
    walk: Walk,
): readonly string[] {
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
    const owned = drawingOwnedSymbols(analysis);
    const defaults = inputDefaults(analysis);
    const scan = scanHistorySeries(analysis, owned);
    const seriesNames = new Set(scan.numeric.keys());
    const slots = registerStateSlots(analysis, scaffold, owned, seriesNames);
    const inputNames = new Set(scaffold.inputs.map((input) => input.name));
    const inputCasts = new Map<string, string>();
    for (const input of scaffold.inputs) {
        const cast = inputCastType(input.code);
        if (cast !== null) {
            inputCasts.set(input.name, cast);
        }
    }
    const ctx: EmitContext = {
        annotations: analysis.annotations,
        inputNames,
        localNames: new Set(),
        stateSlots: slots,
        inputCasts,
        tupleFieldAliases: registerTupleFields(analysis, scaffold.names),
        seriesSlots: seriesNames,
    };
    emitStateSlots(analysis, scaffold, diagnostics, slots, scan, ctx);
    // A bool/string history-indexed scalar keeps its current (non-`state.series`)
    // lowering and gets a clear info — its `x[n]` is a known v1 gap, never a
    // silent broken emit. Reported here (not in `emitStateSlots`) so an na-init
    // non-numeric scalar (which is NOT registered as a slot) is still flagged.
    for (const [, decl] of scan.nonNumeric) {
        diagnostics.pushCode("series-history-non-numeric", decl.span);
    }
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

// `ta.pivothigh`/`ta.pivotlow` project a field of `ta.pivotsHighLow`'s result,
// which is a FUNCTION taking `{ leftLength, rightLength }` opts — not a
// `ta.pivotsHighLow.high(...)` method. Restructure the positional
// `(left, right)` (or trailing two of `(source, left, right)`) into the opts
// call and project the field.
function emitPivot(name: string, call: CallExpression, ctx: EmitContext): string {
    const field = name === "ta.pivothigh" ? "high" : "low";
    const positional = call.args.filter((arg) => arg.name === null).map((arg) => arg.value);
    const right = positional[positional.length - 1];
    const left = positional.length >= 2 ? positional[positional.length - 2] : right;
    if (right === undefined || left === undefined) {
        return `ta.pivotsHighLow().${field}`;
    }
    const leftSrc = emitWithContext(left, ctx);
    const rightSrc = emitWithContext(right, ctx);
    return `ta.pivotsHighLow({ leftLength: ${leftSrc}, rightLength: ${rightSrc} }).${field}`;
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
    // chartlang `ta.*` returns a `Series<number>` (a history view); Pine uses
    // the current-bar scalar. `.current` projects that scalar so the result is
    // usable as a number (anchor price, `na`/arithmetic operand, plot value)
    // — `ta.*` maintains its own per-call-site history, so feeding scalars in
    // and reading `.current` out reproduces Pine's per-bar semantics.
    const body =
        name === "ta.pivothigh" || name === "ta.pivotlow"
            ? emitPivot(name, call, ctx)
            : `${mapping.chartlang}(${call.args.map((arg) => emitWithContext(arg.value, ctx)).join(", ")})`;
    return `${body}.current`;
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

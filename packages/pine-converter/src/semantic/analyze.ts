// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    Assignment,
    CallExpression,
    ExpressionNode,
    Script,
    Statement,
    TupleDeclaration,
    VariableDeclaration,
} from "../ast/index.js";
import type { Argument } from "../ast/script.js";
import type { FunctionDeclaration } from "../ast/statements.js";
import { makeDiagnostic } from "../diagnostics/codes.js";
import type { Diagnostic, SourceSpan } from "../index.js";
import { type IndicatorCaps, classifyDrawingSites } from "./drawingCamp.js";
import { createLifetimeCollector } from "./lifetimes.js";
import { dottedName, rootIdentifier } from "./nodes.js";
import { inferQualifier } from "./qualifiers.js";
import {
    type ScopeBuilder,
    createScopeBuilder,
    defineSymbol,
    freezeScope,
    isBoundInUserScopes,
    resolveSymbol,
} from "./scope.js";
import { functionParamArity, resolveUdfStatefulness } from "./statefulness.js";
import type {
    AstNode,
    HandleType,
    Scope,
    SemanticAnnotation,
    SemanticResult,
    SymbolInfo,
    SymbolKind,
} from "./types.js";

const HANDLE_TYPE_NAMES: ReadonlySet<HandleType> = new Set<HandleType>([
    "line",
    "label",
    "box",
    "table",
    "polyline",
    "linefill",
]);

type WalkState = {
    readonly scopes: Map<AstNode, Scope>;
    readonly annotations: Map<AstNode, SemanticAnnotation>;
    readonly symbols: Map<SourceSpan, SymbolInfo>;
    readonly diagnostics: Diagnostic[];
    readonly lifetimes: ReturnType<typeof createLifetimeCollector>;
    barIndex: boolean;
    futureBarIndex: boolean;
};

function handleTypeOf(decl: VariableDeclaration): HandleType | null {
    const annotation = decl.typeAnnotation;
    if (annotation === null || annotation.kind !== "named-type") {
        return null;
    }
    return (HANDLE_TYPE_NAMES as ReadonlySet<string>).has(annotation.name)
        ? (annotation.name as HandleType)
        : null;
}

function symbolKindOf(decl: VariableDeclaration): SymbolKind {
    if (decl.qualifier === "var") {
        return "var-variable";
    }
    if (decl.qualifier === "varip") {
        return "varip-variable";
    }
    return "variable";
}

// `na` directly stored into a handle variable lowers to `null`; otherwise it
// is the numeric NaN sentinel. `na(x)` likewise: handle receiver → handle
// kind, series receiver → numeric.
function naKindOfReceiver(receiver: ExpressionNode, resolve: (n: string) => SymbolInfo | null) {
    const root = rootIdentifier(receiver);
    const symbol = root === null ? null : resolve(root);
    return symbol?.handleType != null ? "handle" : "numeric";
}

// The `na` flavour of an expression node, or `undefined` for non-`na` nodes:
// a bare `na` keyword takes its kind from the assignment context (handle var
// → `handle`); an `na(receiver)` call takes it from the receiver's type.
function naKindOf(
    expr: ExpressionNode,
    contextHandle: HandleType | null,
    resolve: (n: string) => SymbolInfo | null,
): "numeric" | "handle" | undefined {
    if (expr.kind === "na-expression") {
        return contextHandle !== null ? "handle" : "numeric";
    }
    if (
        expr.kind === "call-expression" &&
        expr.callee.kind === "na-expression" &&
        expr.args.length > 0
    ) {
        return naKindOfReceiver(expr.args[0].value, resolve);
    }
    return undefined;
}

function walkExpression(
    state: WalkState,
    scope: ScopeBuilder,
    expr: ExpressionNode,
    contextHandle: HandleType | null,
): void {
    const resolve = (name: string): SymbolInfo | null => resolveSymbol(scope, name);
    state.scopes.set(expr, freezeScope(scope));
    const naKind = naKindOf(expr, contextHandle, resolve);
    state.annotations.set(expr, {
        ...(state.annotations.get(expr) ?? {}),
        qualifier: inferQualifier(expr, resolve),
        ...(naKind === undefined ? {} : { naKind }),
    });

    switch (expr.kind) {
        case "identifier-expression": {
            if (expr.name === "bar_index") {
                state.barIndex = true;
            }
            if (resolve(expr.name) === null) {
                state.diagnostics.push(makeDiagnostic("unknown-identifier", expr.span));
            }
            return;
        }
        case "na-expression":
            return;
        case "member-access-expression": {
            const root = rootIdentifier(expr);
            if (root !== null && root !== "bar_index" && resolve(root) === null) {
                state.diagnostics.push(makeDiagnostic("unknown-identifier", expr.span));
            }
            if (root === "bar_index") {
                state.barIndex = true;
            }
            if (expr.head !== null) {
                walkExpression(state, scope, expr.head, null);
            }
            return;
        }
        case "unary-expression":
            walkExpression(state, scope, expr.operand, null);
            return;
        case "paren-expression":
            walkExpression(state, scope, expr.expression, contextHandle);
            return;
        case "binary-expression": {
            detectFutureBarIndex(state, expr);
            walkExpression(state, scope, expr.left, null);
            walkExpression(state, scope, expr.right, null);
            return;
        }
        case "ternary-expression":
            walkExpression(state, scope, expr.condition, null);
            walkExpression(state, scope, expr.consequent, contextHandle);
            walkExpression(state, scope, expr.alternate, contextHandle);
            return;
        case "history-access-expression": {
            walkExpression(state, scope, expr.receiver, null);
            walkExpression(state, scope, expr.offset, null);
            if (inferQualifier(expr.receiver, resolve) !== "series") {
                state.diagnostics.push(makeDiagnostic("history-on-non-series", expr.span));
            }
            return;
        }
        case "call-expression":
            walkCall(state, scope, expr, contextHandle);
            return;
        case "tuple-expression": {
            state.diagnostics.push(makeDiagnostic("unsupported-tuple-destructuring", expr.span));
            for (const element of expr.elements) {
                walkExpression(state, scope, element, null);
            }
            return;
        }
        case "lambda-expression":
            walkExpression(state, scope, expr.body, null);
            return;
        case "literal-expression":
            return;
    }
}

function walkCall(
    state: WalkState,
    scope: ScopeBuilder,
    call: CallExpression,
    contextHandle: HandleType | null,
): void {
    walkExpression(state, scope, call.callee, null);
    for (const arg of call.args) {
        walkExpression(state, scope, arg.value, contextHandle);
    }
    checkUdfArity(state, scope, call);
}

// A bare-identifier call to a registered UDF whose argument count differs from
// its declared parameter count warns `udf-arity-mismatch`. Builtins and
// member-rooted calls (`ta.ema(...)`) resolve to a non-function symbol (arity
// `null`) and are left to the existing passthrough mapping.
function checkUdfArity(state: WalkState, scope: ScopeBuilder, call: CallExpression): void {
    if (call.callee.kind !== "identifier-expression") {
        return;
    }
    const symbol = resolveSymbol(scope, call.callee.name);
    if (symbol === null) {
        return;
    }
    const arity = functionParamArity(symbol);
    if (arity !== null && arity !== call.args.length) {
        state.diagnostics.push(makeDiagnostic("udf-arity-mismatch", call.span));
    }
}

// `bar_index + N` (N > 0 literal) projects into the future.
function detectFutureBarIndex(state: WalkState, expr: ExpressionNode): void {
    if (expr.kind !== "binary-expression" || expr.operator !== "+") {
        return;
    }
    const refsBarIndex =
        rootIdentifier(expr.left) === "bar_index" || rootIdentifier(expr.right) === "bar_index";
    const addend = expr.left.kind === "literal-expression" ? expr.left : expr.right;
    if (refsBarIndex && addend.kind === "literal-expression" && addend.literalKind === "int") {
        const value = Number.parseInt(addend.value, 10);
        if (value > 0) {
            state.futureBarIndex = true;
        }
    }
}

function declareVariable(state: WalkState, scope: ScopeBuilder, decl: VariableDeclaration): void {
    const resolve = (name: string): SymbolInfo | null => resolveSymbol(scope, name);
    const handleType = handleTypeOf(decl);
    walkExpression(state, scope, decl.initializer, handleType);
    const symbol: SymbolInfo = {
        name: decl.name,
        kind: symbolKindOf(decl),
        declarationSpan: decl.span,
        typeAnnotation: decl.typeAnnotation,
        qualifier: inferQualifier(decl.initializer, resolve),
        handleType,
    };
    defineSymbol(scope, symbol);
    state.symbols.set(decl.span, symbol);
    if (symbol.kind === "var-variable" || symbol.kind === "varip-variable") {
        state.lifetimes.register(symbol, decl.span);
    }
}

function walkAssignment(state: WalkState, scope: ScopeBuilder, assignment: Assignment): void {
    const existing = resolveSymbol(scope, assignment.name);
    const contextHandle = existing?.handleType ?? null;
    walkExpression(state, scope, assignment.value, contextHandle);

    const shadows = isBoundInUserScopes(scope, assignment.name) ? existing : null;
    if (assignment.operator === "=") {
        // `=` at statement position: a fresh declaration unless the name is
        // already bound in an enclosing user scope (accidental shadowing).
        state.annotations.set(assignment, {
            ...(state.annotations.get(assignment) ?? {}),
            assignment: { kind: "declaration", shadows },
        });
        if (shadows !== null) {
            state.diagnostics.push(makeDiagnostic("accidental-shadowing", assignment.span));
            return;
        }
        const symbol: SymbolInfo = {
            name: assignment.name,
            kind: "variable",
            declarationSpan: assignment.span,
            typeAnnotation: null,
            qualifier: inferQualifier(assignment.value, (n) => resolveSymbol(scope, n)),
            handleType: null,
        };
        defineSymbol(scope, symbol);
        state.symbols.set(assignment.span, symbol);
        return;
    }
    // `:=` reassignment.
    state.annotations.set(assignment, {
        ...(state.annotations.get(assignment) ?? {}),
        assignment: { kind: "reassignment", shadows: null },
    });
    if (shadows === null) {
        state.diagnostics.push(makeDiagnostic("unknown-identifier", assignment.span));
        return;
    }
    state.lifetimes.recordReassignment(shadows, assignment.span);
}

// `[a, b, c] = ta.macd(...)` — walk the multi-return RHS, then declare each
// target name as a fresh variable so later references resolve. A `_` target is
// a throwaway and is not bound. Each name carries its own span, so the
// `symbols` map gets one distinct entry per element (no span-key collision).
function walkTupleDeclaration(state: WalkState, scope: ScopeBuilder, decl: TupleDeclaration): void {
    const resolve = (name: string): SymbolInfo | null => resolveSymbol(scope, name);
    walkExpression(state, scope, decl.initializer, null);
    for (const target of decl.names) {
        if (target.name === "_") {
            continue;
        }
        const symbol: SymbolInfo = {
            name: target.name,
            kind: "variable",
            declarationSpan: target.span,
            typeAnnotation: null,
            qualifier: inferQualifier(decl.initializer, resolve),
            handleType: null,
        };
        defineSymbol(scope, symbol);
        state.symbols.set(target.span, symbol);
    }
}

// Walk a UDF body in a child scope seeded with its parameters. The function
// symbol itself is hoisted into the enclosing scope before the walk (see
// `registerUserFunctions`), so body call sites — including a forward or
// sibling UDF call — resolve. Each param carries its own span, so the
// `symbols` map gets one distinct entry per parameter (the `TupleTarget`
// precedent). The child scope is discarded after the body walk: parameters are
// not visible outside the function (the same discipline as a block scope).
function walkFunctionBody(state: WalkState, scope: ScopeBuilder, decl: FunctionDeclaration): void {
    const child = createScopeBuilder(scope, decl.body.span);
    for (const param of decl.params) {
        const symbol: SymbolInfo = {
            name: param.name,
            kind: "function-parameter",
            declarationSpan: param.span,
            typeAnnotation: null,
            qualifier: "series",
            handleType: null,
        };
        defineSymbol(child, symbol);
        state.symbols.set(param.span, symbol);
    }
    walkBlockInScope(state, child, decl.body.body);
}

function walkStatement(state: WalkState, scope: ScopeBuilder, stmt: Statement): void {
    state.scopes.set(stmt, freezeScope(scope));
    switch (stmt.kind) {
        case "variable-declaration":
            declareVariable(state, scope, stmt);
            return;
        case "assignment":
            walkAssignment(state, scope, stmt);
            return;
        case "tuple-declaration":
            walkTupleDeclaration(state, scope, stmt);
            return;
        case "function-declaration":
            walkFunctionBody(state, scope, stmt);
            return;
        case "expression-statement": {
            recordHandleMutation(state, scope, stmt.expression);
            walkExpression(state, scope, stmt.expression, null);
            return;
        }
        case "if-statement": {
            walkExpression(state, scope, stmt.condition, null);
            walkBlock(state, scope, stmt.thenBody.body, stmt.thenBody.span);
            for (const clause of stmt.elseIfClauses) {
                walkExpression(state, scope, clause.condition, null);
                walkBlock(state, scope, clause.body.body, clause.body.span);
            }
            if (stmt.elseBody !== null) {
                walkBlock(state, scope, stmt.elseBody.body, stmt.elseBody.span);
            }
            return;
        }
        case "for-statement": {
            walkExpression(state, scope, stmt.from, null);
            walkExpression(state, scope, stmt.to, null);
            if (stmt.step !== null) {
                walkExpression(state, scope, stmt.step, null);
            }
            const child = createScopeBuilder(scope, stmt.body.span);
            defineSymbol(child, {
                name: stmt.variable,
                kind: "for-iterator",
                declarationSpan: stmt.span,
                typeAnnotation: null,
                qualifier: "simple",
                handleType: null,
            });
            walkBlockInScope(state, child, stmt.body.body);
            return;
        }
        case "switch-statement": {
            if (stmt.subject !== null) {
                walkExpression(state, scope, stmt.subject, null);
            }
            for (const switchCase of stmt.cases) {
                if (switchCase.test !== null) {
                    walkExpression(state, scope, switchCase.test, null);
                }
                walkBlock(state, scope, switchCase.body, switchCase.span);
            }
            return;
        }
        case "block-statement":
            walkBlock(state, scope, stmt.body, stmt.span);
            return;
        case "break-statement":
        case "continue-statement":
            return;
        case "return-statement":
            if (stmt.value !== null) {
                walkExpression(state, scope, stmt.value, null);
            }
            return;
    }
}

// A `line.set_*(handleVar, ...)` / `*.delete(handleVar)` call records a
// mutation/deletion on the handle's lifetime.
function recordHandleMutation(state: WalkState, scope: ScopeBuilder, expr: ExpressionNode): void {
    if (expr.kind !== "call-expression") {
        return;
    }
    const name = dottedName(expr.callee);
    if (name === null || expr.args.length === 0) {
        return;
    }
    const firstArg = expr.args[0].value;
    if (firstArg.kind !== "identifier-expression") {
        return;
    }
    const symbol = resolveSymbol(scope, firstArg.name);
    if (symbol === null || symbol.handleType === null) {
        return;
    }
    if (name.endsWith(".delete")) {
        state.lifetimes.recordDeletion(symbol, expr.span);
    } else if (name.includes(".set_")) {
        state.lifetimes.recordMutation(symbol, expr.span);
    }
}

function walkBlock(
    state: WalkState,
    parent: ScopeBuilder,
    body: readonly Statement[],
    span: SourceSpan,
): void {
    const child = createScopeBuilder(parent, span);
    walkBlockInScope(state, child, body);
}

function walkBlockInScope(state: WalkState, scope: ScopeBuilder, body: readonly Statement[]): void {
    for (const stmt of body) {
        walkStatement(state, scope, stmt);
    }
}

// Hoist every top-level UDF: classify statefulness transitively over the call
// graph, reject recursion, and register each as a `kind: "function"` symbol
// BEFORE the body walk so any call site (forward, backward, or a sibling UDF
// referenced from another body) resolves rather than raising
// `unknown-identifier`. A recursive UDF is registered with its real params +
// `stateful: true` (rejected-recovery: no `unknown-identifier` cascade, no
// spurious arity warning), and its head gets one `udf-recursive-rejected`.
function registerUserFunctions(state: WalkState, root: ScopeBuilder, script: Script): void {
    const udfs = new Map<string, FunctionDeclaration>();
    for (const stmt of script.body) {
        if (stmt.kind === "function-declaration") {
            udfs.set(stmt.name, stmt);
        }
    }
    if (udfs.size === 0) {
        return;
    }
    const { classifications, recursiveHeads } = resolveUdfStatefulness(udfs);
    for (const head of recursiveHeads) {
        state.diagnostics.push(makeDiagnostic("udf-recursive-rejected", head.span));
    }
    for (const { decl, stateful } of classifications) {
        const symbol: SymbolInfo = {
            name: decl.name,
            kind: "function",
            declarationSpan: decl.span,
            typeAnnotation: null,
            qualifier: "series",
            handleType: null,
            params: decl.params.map((param) => param.name),
            stateful,
        };
        defineSymbol(root, symbol);
        state.symbols.set(decl.span, symbol);
    }
}

function extractIndicatorCaps(args: readonly Argument[]): IndicatorCaps {
    const caps: { -readonly [K in HandleType]?: number } = {};
    const byArg: Readonly<Record<string, HandleType>> = {
        max_lines_count: "line",
        max_labels_count: "label",
        max_boxes_count: "box",
        max_polylines_count: "polyline",
    };
    for (const arg of args) {
        if (arg.name === null) {
            continue;
        }
        const family = byArg[arg.name];
        if (family === undefined) {
            continue;
        }
        const value = arg.value;
        if (value.kind === "literal-expression" && value.literalKind === "int") {
            const parsed = Number.parseInt(value.value, 10);
            if (!Number.isNaN(parsed)) {
                caps[family] = parsed;
            }
        }
    }
    return caps;
}

/**
 * Analyze a parsed Pine v6 {@link Script}: build the scope tree, infer
 * qualifiers and `na` flavours, disambiguate declarations from
 * reassignments, track `var`/`varip` lifetimes, detect bar-index
 * references, and classify every drawing `.new()` call-site into a
 * {@link DrawingCamp}. The {@link SemanticResult} it returns is the single
 * annotated IR every transform task (8–15) consumes. Package-internal —
 * never re-exported from `src/index.ts`.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { analyze } from "./analyze.js";
 *     const result = analyze({
 *         kind: "script",
 *         version: null,
 *         declaration: null,
 *         body: [],
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
 *     });
 *     result.diagnostics.length; // 0
 */
export function analyze(script: Script): SemanticResult {
    const rootBuilder = createScopeBuilder(null, script.span);
    const state: WalkState = {
        scopes: new Map(),
        annotations: new Map(),
        symbols: new Map(),
        diagnostics: [],
        lifetimes: createLifetimeCollector(),
        barIndex: false,
        futureBarIndex: false,
    };

    registerUserFunctions(state, rootBuilder, script);

    for (const stmt of script.body) {
        walkStatement(state, rootBuilder, stmt);
    }

    const rootScope = freezeScope(rootBuilder);
    state.scopes.set(script, rootScope);

    const caps =
        script.declaration?.kind === "indicator-declaration"
            ? extractIndicatorCaps(script.declaration.args)
            : {};

    const classification = classifyDrawingSites(
        script,
        (name) => resolveSymbol(rootBuilder, name),
        caps,
    );

    return {
        script,
        rootScope,
        scopes: state.scopes,
        annotations: state.annotations,
        symbols: state.symbols,
        lifetimes: state.lifetimes.build(),
        drawingSites: classification.sites,
        drawingClassifications: classification.classifications,
        referencesBarIndex: state.barIndex,
        referencesFutureBarIndex: state.futureBarIndex,
        diagnostics: [...state.diagnostics, ...classification.diagnostics],
    };
}

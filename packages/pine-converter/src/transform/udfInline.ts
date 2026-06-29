// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallExpression, ExpressionNode } from "../ast/index.js";
import type { Assignment, FunctionDeclaration, Statement } from "../ast/statements.js";
import type { SourceSpan } from "../index.js";
import type { SemanticResult } from "../semantic/index.js";
import { substituteParams, substituteParamsStatement } from "./controlFlow.js";
import type { DiagnosticCollector } from "./diagnosticCollector.js";
import type { EmitContext } from "./emitContext.js";
import type { NameAllocator } from "./nameAllocator.js";

/**
 * The two `other.ts` lowerers the inliner calls back into to render a
 * substituted stateful-UDF body in the caller's context. Injected (rather than
 * imported) so `udfInline.ts` carries no dependency on `other.ts` — which
 * imports it — avoiding a module cycle. `emitValue` is `emitCallValue` bound to
 * the active `Walk` (lowers a value expression, handling `ta.*`/`math.*`/`str.*`/
 * `request`/`nz`); `emitStatement` is the statement lowerer bound to the same
 * `Walk` (used for a control-flow body statement).
 *
 * @since 0.1
 * @stable
 * @example
 *     const emitters: InlineEmitters = {
 *         emitValue: (_node, _ctx) => "0",
 *         emitStatement: (_stmt, _ctx) => [],
 *     };
 *     void emitters;
 */
export type InlineEmitters = Readonly<{
    emitValue: (node: ExpressionNode, ctx: EmitContext) => string;
    emitStatement: (stmt: Statement, ctx: EmitContext) => readonly string[];
}>;

/**
 * Everything the stateful-UDF inliner needs that is NOT part of the expression
 * being expanded: the resolved stateful-UDF declarations (by name), the shared
 * {@link NameAllocator} (so every synthesized arg/body temp is collision-safe),
 * the diagnostic sink, and the {@link InlineEmitters} callbacks. Built once per
 * inlined statement by `other.ts`.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { NameAllocator } from "./nameAllocator.js";
 *     import { DiagnosticCollector } from "./diagnosticCollector.js";
 *     const scope: InlineScope = {
 *         statefulUdfs: new Map(),
 *         names: new NameAllocator(),
 *         diagnostics: new DiagnosticCollector(),
 *         emitters: { emitValue: () => "0", emitStatement: () => [] },
 *     };
 *     void scope;
 */
export type InlineScope = Readonly<{
    statefulUdfs: ReadonlyMap<string, FunctionDeclaration>;
    names: NameAllocator;
    diagnostics: DiagnosticCollector;
    emitters: InlineEmitters;
}>;

/**
 * Collect every top-level STATEFUL user-defined function (a `kind:"function"`
 * symbol resolved `stateful: true`), keyed by name (last declaration wins,
 * mirroring the semantic hoist and {@link collectPureUdfs}'s complement). A
 * stateful UDF cannot be emitted as a reusable function — its `ta.*`/`state.*`
 * would share ONE slot across every caller — so each call site is inline-
 * expanded instead. A recursive UDF is forced `stateful: true` (and already
 * `udf-recursive-rejected`); it is included here, and the inline stack guard
 * stops its self-call from expanding infinitely.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { lex } from "../lexer/index.js";
 *     import { parseStatements } from "../parser/index.js";
 *     import { analyze } from "../semantic/index.js";
 *     const src = "//@version=6\nindicator(\"X\")\ncf(x) => ta.ema(x, 5)\n";
 *     const analysis = analyze(parseStatements(lex(src).tokens).script);
 *     collectStatefulUdfs(analysis).has("cf"); // true
 */
export function collectStatefulUdfs(analysis: SemanticResult): Map<string, FunctionDeclaration> {
    const stateful = new Map<string, FunctionDeclaration>();
    for (const stmt of analysis.script.body) {
        if (stmt.kind !== "function-declaration") {
            continue;
        }
        const symbol = analysis.symbols.get(stmt.span);
        if (symbol === undefined || symbol.stateful !== true) {
            continue;
        }
        stateful.set(stmt.name, stmt);
    }
    return stateful;
}

// The bare identifier name of a call's callee (a UDF callee is always a bare
// identifier), or `null` for a dotted / computed callee (a builtin like
// `ta.ema`, never a UDF).
function udfCalleeName(call: CallExpression): string | null {
    return call.callee.kind === "identifier-expression" ? call.callee.name : null;
}

// A synthesized identifier node carrying a name (a hoisted temp, a body-local
// unique, or — when spliced as a call replacement — a fully-lowered source
// string `emitExpr` re-emits verbatim).
function identifierNode(name: string, span: SourceSpan): ExpressionNode {
    return { kind: "identifier-expression", name, span };
}

// Whether an argument is safe to substitute INLINE (no evaluate-once hoist): a
// bare identifier or a literal. Any other shape — a compound expression, a
// member access, or, crucially, one CONTAINING a call (`ta.*` / a stateful UDF)
// — is hoisted to a temp so it is evaluated exactly once, matching Pine's eager
// once-per-bar argument evaluation (a `ta.*` arg must advance its own state
// every bar even when the parameter is unused).
function argIsSimple(node: ExpressionNode): boolean {
    return node.kind === "identifier-expression" || node.kind === "literal-expression";
}

// The chartlang assignment operator for a UDF-body assignment: `=`/`:=` both
// lower to `=`; a compound arithmetic form (`+=`/…) passes through — the same
// rule the top-level scalar lowering applies.
function assignOperator(stmt: Assignment): string {
    return stmt.operator === "=" || stmt.operator === ":=" ? "=" : stmt.operator;
}

/**
 * Inline-expand every stateful-UDF call reachable in `node`, appending the
 * hoisted argument temps + intermediate body locals to `prelude` (rendered
 * BEFORE the consuming statement) and returning the tree with each such call
 * replaced by its inlined result expression (spliced as a pseudo identifier so
 * `emitExpr` re-emits the lowered source verbatim). A non-stateful-UDF call (a
 * builtin, a pure UDF) is structurally preserved so the caller's normal lowering
 * (`ta.*`/plot/strategy/…) still runs.
 *
 * Each inlined `ta.*`/`state.*` lands at a DISTINCT generated source position
 * (one prelude line / call column per call site), so the compiler's
 * `callsiteIdFor` mints an INDEPENDENT slot per call site — reproducing Pine's
 * per-call-site state instancing with no compiler change.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { inlineStatefulCalls } from "./udfInline.js";
 *     const fn: typeof inlineStatefulCalls = inlineStatefulCalls;
 *     void fn;
 */
export function inlineStatefulCalls(
    node: ExpressionNode,
    ctx: EmitContext,
    scope: InlineScope,
    prelude: string[],
): ExpressionNode {
    return expandNode(node, ctx, scope, prelude, new Set());
}

// Structural walk that intercepts a stateful-UDF call and inlines it. `stack`
// holds the UDF names currently being inlined so a recursive self-call (already
// `udf-recursive-rejected`) is left bare instead of expanding forever.
function expandNode(
    node: ExpressionNode,
    ctx: EmitContext,
    scope: InlineScope,
    prelude: string[],
    stack: ReadonlySet<string>,
): ExpressionNode {
    switch (node.kind) {
        case "call-expression": {
            const name = udfCalleeName(node);
            const inlined =
                name === null ? null : tryInlineCall(node, name, ctx, scope, prelude, stack);
            if (inlined !== null) {
                return inlined;
            }
            return {
                ...node,
                callee: expandNode(node.callee, ctx, scope, prelude, stack),
                args: node.args.map((arg) => ({
                    ...arg,
                    value: expandNode(arg.value, ctx, scope, prelude, stack),
                })),
            };
        }
        case "unary-expression":
            return { ...node, operand: expandNode(node.operand, ctx, scope, prelude, stack) };
        case "binary-expression":
            return {
                ...node,
                left: expandNode(node.left, ctx, scope, prelude, stack),
                right: expandNode(node.right, ctx, scope, prelude, stack),
            };
        case "ternary-expression":
            return {
                ...node,
                condition: expandNode(node.condition, ctx, scope, prelude, stack),
                consequent: expandNode(node.consequent, ctx, scope, prelude, stack),
                alternate: expandNode(node.alternate, ctx, scope, prelude, stack),
            };
        case "member-access-expression":
            return node.head === null
                ? node
                : { ...node, head: expandNode(node.head, ctx, scope, prelude, stack) };
        case "history-access-expression":
            return {
                ...node,
                receiver: expandNode(node.receiver, ctx, scope, prelude, stack),
                offset: expandNode(node.offset, ctx, scope, prelude, stack),
            };
        case "paren-expression":
            return { ...node, expression: expandNode(node.expression, ctx, scope, prelude, stack) };
        case "tuple-expression":
        case "array-literal-expression":
            return {
                ...node,
                elements: node.elements.map((el) => expandNode(el, ctx, scope, prelude, stack)),
            };
        case "lambda-expression":
            return { ...node, body: expandNode(node.body, ctx, scope, prelude, stack) };
        case "switch-expression":
            return {
                ...node,
                subject:
                    node.subject === null
                        ? null
                        : expandNode(node.subject, ctx, scope, prelude, stack),
                cases: node.cases.map((arm) => ({
                    ...arm,
                    test:
                        arm.test === null ? null : expandNode(arm.test, ctx, scope, prelude, stack),
                    value: expandNode(arm.value, ctx, scope, prelude, stack),
                })),
            };
        default:
            return node;
    }
}

// Inline a call whose bare callee is `name` IF it resolves to a stateful UDF
// that is not already on the inline stack (a recursive self-call — already
// `udf-recursive-rejected` — is left bare). Returns the spliced result node, or
// `null` when the call is not an inlinable stateful-UDF call (a builtin, a pure
// UDF, or the recursive self-call) so the caller structurally recurses instead.
function tryInlineCall(
    node: CallExpression,
    name: string,
    ctx: EmitContext,
    scope: InlineScope,
    prelude: string[],
    stack: ReadonlySet<string>,
): ExpressionNode | null {
    const decl = scope.statefulUdfs.get(name);
    if (decl === undefined || stack.has(name)) {
        return null;
    }
    // Expand any stateful-UDF call WITHIN the arguments first (caller context),
    // then inline this call with the expanded args.
    const expandedArgs = node.args.map((arg) => ({
        ...arg,
        value: expandNode(arg.value, ctx, scope, prelude, stack),
    }));
    const result = inlineCall({ ...node, args: expandedArgs }, decl, ctx, scope, prelude, stack);
    scope.diagnostics.pushCode("udf-inlined", node.span);
    return identifierNode(result, node.span);
}

// Inline ONE stateful-UDF call: bind params to args (hoisting non-simple args to
// evaluate-once temps), substitute params → bindings through a clone of the
// body, lower each body statement in a child context, and return the last
// statement's result expression. Intermediate locals + arg temps are appended to
// `prelude` (emitted before the consuming statement).
function inlineCall(
    call: CallExpression,
    decl: FunctionDeclaration,
    ctx: EmitContext,
    scope: InlineScope,
    prelude: string[],
    stack: ReadonlySet<string>,
): string {
    const params = decl.params.map((param) => param.name);
    const positional = call.args.filter((arg) => arg.name === null).map((arg) => arg.value);
    const childLocals = new Set(ctx.localNames);
    for (const param of params) {
        // An unbound param (arity mismatch — already `udf-arity-mismatch`) keeps
        // its own name; reserve it so the body reference is not rewritten.
        childLocals.add(param);
    }
    const bindings = new Map<string, ExpressionNode>();
    params.forEach((param, index) => {
        const arg = positional[index];
        if (arg === undefined) {
            return;
        }
        if (argIsSimple(arg)) {
            bindings.set(param, arg);
            return;
        }
        const tmp = scope.names.allocate(param);
        childLocals.add(tmp);
        const expandedArg = expandNode(arg, ctx, scope, prelude, stack);
        prelude.push(`const ${tmp} = ${scope.emitters.emitValue(expandedArg, ctx)};`);
        scope.diagnostics.pushCode("udf-arg-hoisted", arg.span);
        bindings.set(param, identifierNode(tmp, arg.span));
    });
    const childCtx: EmitContext = { ...ctx, localNames: childLocals };
    const innerStack = new Set(stack);
    innerStack.add(decl.name);
    const localUnique = new Map<string, string>();
    const body = decl.body.body;
    let result = "Number.NaN";
    body.forEach((stmt, index) => {
        const isLast = index === body.length - 1;
        if (stmt.kind === "assignment" || stmt.kind === "variable-declaration") {
            const rawValue = stmt.kind === "assignment" ? stmt.value : stmt.initializer;
            const operator = stmt.kind === "assignment" ? assignOperator(stmt) : "=";
            const substituted = substituteParams(rawValue, bindings);
            const lowered = lowerBodyValue(substituted, childCtx, scope, prelude, innerStack);
            // A first-sight local declares a uniquely-named `let`; a later
            // `:=`/compound reassignment of the same local reuses that unique.
            const existing = localUnique.get(stmt.name);
            if (existing === undefined) {
                const unique = scope.names.allocate(stmt.name);
                childLocals.add(unique);
                localUnique.set(stmt.name, unique);
                bindings.set(stmt.name, identifierNode(unique, stmt.span));
                prelude.push(`let ${unique} = ${lowered};`);
                result = isLast ? unique : result;
            } else {
                prelude.push(`${existing} ${operator} ${lowered};`);
                result = isLast ? existing : result;
            }
            return;
        }
        if (stmt.kind === "expression-statement") {
            const substituted = substituteParams(stmt.expression, bindings);
            const lowered = lowerBodyValue(substituted, childCtx, scope, prelude, innerStack);
            if (isLast) {
                result = lowered;
            } else {
                prelude.push(`${lowered};`);
            }
            return;
        }
        // A control-flow body statement (e.g. a side-effecting `if`): substitute
        // params and re-lower it via the injected statement lowerer. It is a
        // side effect only and contributes no return value.
        for (const line of scope.emitters.emitStatement(
            substituteParamsStatement(stmt, bindings),
            childCtx,
        )) {
            prelude.push(line);
        }
    });
    return result;
}

// Lower a substituted body value: expand any NESTED stateful-UDF call (a UDF
// that calls another stateful UDF) into the same prelude, then render the
// result in the child context.
function lowerBodyValue(
    value: ExpressionNode,
    childCtx: EmitContext,
    scope: InlineScope,
    prelude: string[],
    stack: ReadonlySet<string>,
): string {
    const expanded = expandNode(value, childCtx, scope, prelude, stack);
    return scope.emitters.emitValue(expanded, childCtx);
}

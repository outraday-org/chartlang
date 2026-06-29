// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallExpression, ExpressionNode, Statement } from "../ast/index.js";
import type { BlockStatement, FunctionDeclaration } from "../ast/statements.js";
import type { SourceSpan } from "../index.js";
import type { SymbolInfo } from "./types.js";

// The bare-named stateful primitives (no namespace): each owns one runtime
// slot keyed by call-site, so the compiler's `stateful-call-inside-loop`
// gate rejects them inside any loop body. `ta.*`/`draw.*` are matched by
// their `ta`/`draw` namespace root, not enumerated here.
const BARE_STATEFUL_NAMES: ReadonlySet<string> = new Set(["plot", "hline", "alert"]);

// The dotted member name of a bare-rooted callee (`ta.ema`, `draw.line`), or
// the bare identifier name (`plot`), or `null` for any other callee shape.
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

/**
 * Whether a call invokes a chartlang **stateful primitive** — `plot`,
 * `hline`, `alert`, any `ta.*`, or any `draw.*`. These each own a single
 * runtime slot keyed by their source position, so chartlang's compiler
 * rejects calling one inside a loop body (`stateful-call-inside-loop`). It
 * is the neutral builtin predicate both the semantic UDF classifier and the
 * transform-layer loop-unroll decision (`transform/statefulNames.ts`,
 * `transform/controlFlow.ts`) share — kept here so the transform layer, which
 * already depends on the semantic result, never has to import back across the
 * stage boundary.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { callIsStatefulPrimitive } from "./statefulness.js";
 *     const call = {
 *         kind: "call-expression",
 *         callee: {
 *             kind: "member-access-expression",
 *             head: null,
 *             chain: ["ta", "ema"],
 *             span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 7 },
 *         },
 *         args: [],
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 9 },
 *     } as const;
 *     callIsStatefulPrimitive(call); // true
 */
export function callIsStatefulPrimitive(call: CallExpression): boolean {
    const name = calleeName(call);
    if (name === null) {
        return false;
    }
    if (BARE_STATEFUL_NAMES.has(name)) {
        return true;
    }
    return name.startsWith("ta.") || name.startsWith("draw.");
}

/**
 * The facts a UDF body contributes to the call graph: whether it directly
 * invokes a builtin stateful primitive ({@link callIsStatefulPrimitive}), and
 * the set of bare-identifier callee names it invokes (the candidate edges —
 * non-UDF names are dropped at link time).
 *
 * @since 0.1
 * @stable
 * @example
 *     const f: UdfBodyFacts = { seedStateful: true, calls: new Set(["cf_a"]) };
 *     void f;
 */
export type UdfBodyFacts = Readonly<{
    seedStateful: boolean;
    calls: ReadonlySet<string>;
}>;

type FactsAccumulator = {
    seedStateful: boolean;
    readonly calls: Set<string>;
};

function collectExpressionFacts(expr: ExpressionNode, acc: FactsAccumulator): void {
    switch (expr.kind) {
        case "call-expression": {
            if (callIsStatefulPrimitive(expr)) {
                acc.seedStateful = true;
            }
            if (expr.callee.kind === "identifier-expression") {
                acc.calls.add(expr.callee.name);
            }
            collectExpressionFacts(expr.callee, acc);
            for (const arg of expr.args) {
                collectExpressionFacts(arg.value, acc);
            }
            return;
        }
        case "unary-expression":
            collectExpressionFacts(expr.operand, acc);
            return;
        case "paren-expression":
            collectExpressionFacts(expr.expression, acc);
            return;
        case "binary-expression":
            collectExpressionFacts(expr.left, acc);
            collectExpressionFacts(expr.right, acc);
            return;
        case "ternary-expression":
            collectExpressionFacts(expr.condition, acc);
            collectExpressionFacts(expr.consequent, acc);
            collectExpressionFacts(expr.alternate, acc);
            return;
        case "history-access-expression":
            collectExpressionFacts(expr.receiver, acc);
            collectExpressionFacts(expr.offset, acc);
            return;
        case "member-access-expression":
            if (expr.head !== null) {
                collectExpressionFacts(expr.head, acc);
            }
            return;
        case "tuple-expression":
        case "array-literal-expression":
            for (const element of expr.elements) {
                collectExpressionFacts(element, acc);
            }
            return;
        case "lambda-expression":
            collectExpressionFacts(expr.body, acc);
            return;
        case "switch-expression":
            if (expr.subject !== null) {
                collectExpressionFacts(expr.subject, acc);
            }
            for (const arm of expr.cases) {
                if (arm.test !== null) {
                    collectExpressionFacts(arm.test, acc);
                }
                collectExpressionFacts(arm.value, acc);
            }
            return;
        case "identifier-expression":
        case "literal-expression":
        case "na-expression":
            return;
    }
}

function collectStatementFacts(stmt: Statement, acc: FactsAccumulator): void {
    switch (stmt.kind) {
        case "expression-statement":
            collectExpressionFacts(stmt.expression, acc);
            return;
        case "variable-declaration":
            collectExpressionFacts(stmt.initializer, acc);
            return;
        case "assignment":
            collectExpressionFacts(stmt.value, acc);
            return;
        case "tuple-declaration":
            collectExpressionFacts(stmt.initializer, acc);
            return;
        case "return-statement":
            if (stmt.value !== null) {
                collectExpressionFacts(stmt.value, acc);
            }
            return;
        case "if-statement": {
            collectExpressionFacts(stmt.condition, acc);
            collectBodyFacts(stmt.thenBody.body, acc);
            for (const clause of stmt.elseIfClauses) {
                collectExpressionFacts(clause.condition, acc);
                collectBodyFacts(clause.body.body, acc);
            }
            if (stmt.elseBody !== null) {
                collectBodyFacts(stmt.elseBody.body, acc);
            }
            return;
        }
        case "for-statement":
            collectExpressionFacts(stmt.from, acc);
            collectExpressionFacts(stmt.to, acc);
            if (stmt.step !== null) {
                collectExpressionFacts(stmt.step, acc);
            }
            collectBodyFacts(stmt.body.body, acc);
            return;
        case "switch-statement": {
            if (stmt.subject !== null) {
                collectExpressionFacts(stmt.subject, acc);
            }
            for (const switchCase of stmt.cases) {
                if (switchCase.test !== null) {
                    collectExpressionFacts(switchCase.test, acc);
                }
                collectBodyFacts(switchCase.body, acc);
            }
            return;
        }
        case "block-statement":
            collectBodyFacts(stmt.body, acc);
            return;
        case "function-declaration":
            collectBodyFacts(stmt.body.body, acc);
            return;
        case "break-statement":
        case "continue-statement":
            return;
    }
}

function collectBodyFacts(statements: readonly Statement[], acc: FactsAccumulator): void {
    for (const stmt of statements) {
        collectStatementFacts(stmt, acc);
    }
}

/**
 * Walk a UDF {@link BlockStatement} body, returning whether it directly uses a
 * builtin stateful primitive and which bare-identifier callees it invokes. The
 * call set is the unfiltered candidate-edge list — `resolveUdfStatefulness`
 * keeps only the names that resolve to another UDF.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { collectUdfBodyFacts } from "./statefulness.js";
 *     const facts = collectUdfBodyFacts({
 *         kind: "block-statement",
 *         body: [],
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
 *     });
 *     facts.seedStateful; // false
 */
export function collectUdfBodyFacts(body: BlockStatement): UdfBodyFacts {
    const acc: FactsAccumulator = { seedStateful: false, calls: new Set() };
    collectBodyFacts(body.body, acc);
    return { seedStateful: acc.seedStateful, calls: acc.calls };
}

type UdfNode = {
    readonly decl: FunctionDeclaration;
    readonly callNames: ReadonlySet<string>;
    readonly callTargets: UdfNode[];
    readonly closure: Set<string>;
    stateful: boolean;
};

/**
 * The transitive classification of one UDF: its declaration, its resolved
 * `stateful` flag, and whether it participates in a (rejected) recursion
 * cycle. The semantic pass builds a `kind: "function"` symbol from each.
 *
 * @since 0.1
 * @stable
 * @example
 *     const v: UdfClassification = {
 *         decl: {
 *             kind: "function-declaration",
 *             name: "cf",
 *             params: [],
 *             body: {
 *                 kind: "block-statement",
 *                 body: [],
 *                 span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
 *             },
 *             span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
 *         },
 *         stateful: true,
 *         recursive: false,
 *     };
 *     void v;
 */
export type UdfClassification = Readonly<{
    decl: FunctionDeclaration;
    stateful: boolean;
    recursive: boolean;
}>;

/**
 * The result of classifying every UDF: one {@link UdfClassification} per
 * declaration (source order) and one `recursiveHead` per recursion cycle (the
 * lexically-first member, where the `udf-recursive-rejected` diagnostic is
 * raised).
 *
 * @since 0.1
 * @stable
 * @example
 *     const r: UdfStatefulnessResult = { classifications: [], recursiveHeads: [] };
 *     void r;
 */
export type UdfStatefulnessResult = Readonly<{
    classifications: readonly UdfClassification[];
    recursiveHeads: readonly Readonly<{ name: string; span: SourceSpan }>[];
}>;

/**
 * Classify a set of top-level UDFs over their call graph: seed each with its
 * builtin-stateful body fact, propagate statefulness transitively (a UDF that
 * calls a stateful UDF is itself stateful) to a fixpoint, detect recursion
 * cycles, and force every recursive UDF stateful (the rejected-recovery
 * default). Pure cycles are tolerated by the fixpoint (it only flips
 * `false → true`, so it is monotone and bounded). Tasks 3/4 read the resolved
 * `stateful` flag; the semantic pass raises `udf-recursive-rejected` on each
 * `recursiveHead`.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { resolveUdfStatefulness } from "./statefulness.js";
 *     resolveUdfStatefulness(new Map()).recursiveHeads; // []
 */
export function resolveUdfStatefulness(
    udfs: ReadonlyMap<string, FunctionDeclaration>,
): UdfStatefulnessResult {
    const nodes = new Map<string, UdfNode>();
    for (const [name, decl] of udfs) {
        const bodyFacts = collectUdfBodyFacts(decl.body);
        nodes.set(name, {
            decl,
            callNames: bodyFacts.calls,
            callTargets: [],
            closure: new Set(),
            stateful: bodyFacts.seedStateful,
        });
    }

    // Link the candidate-edge names to UDF nodes; a bare callee that is not a
    // UDF (e.g. `nz`, `plot`) resolves to no node and contributes no edge.
    for (const node of nodes.values()) {
        for (const callName of node.callNames) {
            const target = nodes.get(callName);
            if (target !== undefined) {
                node.callTargets.push(target);
            }
        }
    }

    propagateClosure(nodes);
    propagateStateful(nodes);

    const recursive = new Set<string>();
    for (const node of nodes.values()) {
        if (node.closure.has(node.decl.name)) {
            recursive.add(node.decl.name);
            node.stateful = true;
        }
    }

    const classifications: UdfClassification[] = [];
    for (const node of nodes.values()) {
        classifications.push({
            decl: node.decl,
            stateful: node.stateful,
            recursive: recursive.has(node.decl.name),
        });
    }

    return { classifications, recursiveHeads: recursionHeads(nodes, recursive) };
}

// Transitive-reachability fixpoint over the call graph: each node's `closure`
// grows to every UDF name reachable through `callTargets` (so a node reaching
// itself is recursive). Monotone (names only ever added) and bounded.
function propagateClosure(nodes: ReadonlyMap<string, UdfNode>): void {
    let changed = true;
    while (changed) {
        changed = false;
        for (const node of nodes.values()) {
            for (const target of node.callTargets) {
                if (!node.closure.has(target.decl.name)) {
                    node.closure.add(target.decl.name);
                    changed = true;
                }
                for (const reached of target.closure) {
                    if (!node.closure.has(reached)) {
                        node.closure.add(reached);
                        changed = true;
                    }
                }
            }
        }
    }
}

// Statefulness fixpoint: a node becomes stateful once any of its call targets
// is stateful. Monotone (`false → true` only) and bounded by the node count.
function propagateStateful(nodes: ReadonlyMap<string, UdfNode>): void {
    let changed = true;
    while (changed) {
        changed = false;
        for (const node of nodes.values()) {
            if (!node.stateful && node.callTargets.some((target) => target.stateful)) {
                node.stateful = true;
                changed = true;
            }
        }
    }
}

// One head per recursion cycle: walking recursive names in lexical order, a
// name is a head unless a lexically-smaller name in the same mutual-
// reachability class (each reaches the other) already claimed it.
function recursionHeads(
    nodes: ReadonlyMap<string, UdfNode>,
    recursive: ReadonlySet<string>,
): readonly Readonly<{ name: string; span: SourceSpan }>[] {
    const recursiveNodes = [...nodes.values()]
        .filter((node) => recursive.has(node.decl.name))
        .sort((a, b) => (a.decl.name < b.decl.name ? -1 : 1));
    const heads: Readonly<{ name: string; span: SourceSpan }>[] = [];
    const claimed = new Set<string>();
    for (const node of recursiveNodes) {
        if (claimed.has(node.decl.name)) {
            continue;
        }
        heads.push({ name: node.decl.name, span: node.decl.span });
        for (const other of recursiveNodes) {
            if (node.closure.has(other.decl.name) && other.closure.has(node.decl.name)) {
                claimed.add(other.decl.name);
            }
        }
    }
    return heads;
}

/**
 * The declared arity of a `kind: "function"` symbol (its parameter count), or
 * `null` for any non-function symbol. Drives the `udf-arity-mismatch` check at
 * call sites. A function symbol always carries `params`; the `?? 0` arm is a
 * defensive guard on the optional type.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { functionParamArity } from "./statefulness.js";
 *     functionParamArity({
 *         name: "cf",
 *         kind: "function",
 *         declarationSpan: null,
 *         typeAnnotation: null,
 *         qualifier: "series",
 *         handleType: null,
 *         params: ["a", "b"],
 *     }); // 2
 */
export function functionParamArity(sym: SymbolInfo): number | null {
    if (sym.kind !== "function") {
        return null;
    }
    return sym.params?.length ?? 0;
}

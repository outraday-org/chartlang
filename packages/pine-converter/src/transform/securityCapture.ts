// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    Assignment,
    ExpressionNode,
    Statement,
    SwitchStatement,
    VariableDeclaration,
} from "../ast/index.js";
import type { SourceSpan } from "../index.js";
import { BUILTIN_IDENTIFIER_MAP } from "../mapping/builtinIdentifiers.js";
import { inferQualifier } from "../semantic/index.js";
import type { SemanticResult, SymbolResolver } from "../semantic/index.js";
import { spanKey } from "./callArgs.js";
import type { EmitContext } from "./emitContext.js";

// A top-level statement that DECLARES or ASSIGNS a captured binding — the only
// shapes the hoister can faithfully reconstruct inside a callback. A
// `request.security` source body that references one of these (transitively)
// rebuilds it as a callback-local so the higher-timeframe closure resolves the
// name to its own scope rather than capturing the main-timeline binding (which
// the chartlang compiler's `validateSecurityExpr` rejects).
type DefiningStatement = VariableDeclaration | Assignment | SwitchStatement;

// The Pine namespace ROOTS that can never be a free value read (they only ever
// appear as a member-access head, e.g. `ta.atr`). Excluded defensively so a
// stray bare occurrence is never mistaken for a hoistable binding.
const NAMESPACE_ROOTS: ReadonlySet<string> = new Set([
    "ta",
    "math",
    "str",
    "input",
    "color",
    "syminfo",
    "request",
    "barmerge",
]);

/**
 * A bar-varying capture the hoister could NOT reconstruct: its `name` and the
 * `span` to anchor the diagnostic on (the capture's first read reached while
 * resolving the callback body).
 *
 * @since 1.8
 * @experimental
 * @example
 *     const reject: CaptureReject = {
 *         name: "atrLen",
 *         span: { startLine: 4, startColumn: 1, endLine: 4, endColumn: 7 },
 *     };
 *     void reject;
 */
export type CaptureReject = Readonly<{ name: string; span: SourceSpan }>;

/**
 * Re-emit a hoisted defining statement as callback-local chartlang source.
 * Supplied by the caller (which owns the `emitStatement` + throwaway-diagnostic
 * wiring) so this module carries no `other.ts` import — the same injected-emitter
 * seam `udfInline.ts` uses to stay acyclic. `localNames` is the full set of
 * hoisted binding names, threaded so a cross-reference between hoisted
 * statements stays a bare local.
 *
 * @since 1.8
 * @experimental
 * @example
 *     const reEmit: CaptureReEmit = (_stmt, _localNames) => ["let len = 14;"];
 *     reEmit(
 *         {
 *             kind: "variable-declaration",
 *             qualifier: "none",
 *             typeAnnotation: null,
 *             name: "len",
 *             initializer: {
 *                 kind: "literal-expression",
 *                 literalKind: "int",
 *                 value: "14",
 *                 span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 3 },
 *             },
 *             span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 3 },
 *         },
 *         new Set(["len"]),
 *     );
 */
export type CaptureReEmit = (stmt: Statement, localNames: ReadonlySet<string>) => readonly string[];

/**
 * The hoist plan for a `request.security` expression callback: the `prelude`
 * lines reconstructing every captured bar-invariant binding (in source order),
 * the `localNames` those preludes introduce (so the body emit shadows them), and
 * the `rejects` for any capture that is bar-VARYING and so cannot be rebuilt.
 *
 * @since 1.8
 * @experimental
 * @example
 *     const hoist: CaptureHoist = {
 *         prelude: ["let len = 14;"],
 *         localNames: new Set(["len"]),
 *         rejects: [],
 *     };
 *     void hoist;
 */
export type CaptureHoist = Readonly<{
    prelude: readonly string[];
    localNames: ReadonlySet<string>;
    rejects: readonly CaptureReject[];
}>;

// One pending capture: the name plus the span to anchor a reject on.
type Candidate = Readonly<{ name: string; span: SourceSpan }>;

// Collect every bare identifier-expression VALUE READ reachable in an
// expression tree (member-access property names and namespace heads are NOT
// reads — only a computed member `head` is descended). Modelled on
// `forEachHistoryAccess`'s exhaustive node walk; there is no shared
// identifier-read walker to reuse.
function collectExpressionReads(node: ExpressionNode, out: Candidate[]): void {
    switch (node.kind) {
        case "literal-expression":
        case "na-expression":
        case "unknown-expression":
            return;
        case "identifier-expression":
            out.push({ name: node.name, span: node.span });
            return;
        case "history-access-expression":
            collectExpressionReads(node.receiver, out);
            collectExpressionReads(node.offset, out);
            return;
        case "unary-expression":
            collectExpressionReads(node.operand, out);
            return;
        case "binary-expression":
            collectExpressionReads(node.left, out);
            collectExpressionReads(node.right, out);
            return;
        case "ternary-expression":
            collectExpressionReads(node.condition, out);
            collectExpressionReads(node.consequent, out);
            collectExpressionReads(node.alternate, out);
            return;
        case "call-expression":
            collectExpressionReads(node.callee, out);
            for (const arg of node.args) {
                collectExpressionReads(arg.value, out);
            }
            return;
        case "member-access-expression":
            if (node.head !== null) {
                collectExpressionReads(node.head, out);
            }
            return;
        case "paren-expression":
            collectExpressionReads(node.expression, out);
            return;
        case "tuple-expression":
        case "array-literal-expression":
            for (const element of node.elements) {
                collectExpressionReads(element, out);
            }
            return;
        case "lambda-expression":
            collectExpressionReads(node.body, out);
            return;
        case "switch-expression":
            if (node.subject !== null) {
                collectExpressionReads(node.subject, out);
            }
            for (const arm of node.cases) {
                if (arm.test !== null) {
                    collectExpressionReads(arm.test, out);
                }
                collectExpressionReads(arm.value, out);
            }
            return;
    }
}

// The TARGET name + VALUE expression a switch arm body carries — a `:=`/`=`
// assignment or a typed declaration — or `null` for a non-assignment arm body
// (control flow), which has no reconstructible value and so makes the whole
// switch bar-varying.
function armBodyValue(body: Statement): { name: string; value: ExpressionNode } | null {
    if (body.kind === "assignment") {
        return { name: body.name, value: body.value };
    }
    if (body.kind === "variable-declaration") {
        return { name: body.name, value: body.initializer };
    }
    return null;
}

// Classify a `switch` defining statement in ONE pass: whether it is bar-invariant
// (subject + every arm value non-series, and every arm body a reconstructible
// assignment/declaration) AND the names it references (the subject/test reads
// plus each arm's TARGET name + value reads — the targets pull each preset var's
// own declaration into the transitive closure). Folding the two together keeps
// every arm-body branch reachable whether the switch is hoisted or rejected.
function classifySwitch(
    stmt: SwitchStatement,
    resolve: SymbolResolver,
): { invariant: boolean; refs: Candidate[] } {
    const refs: Candidate[] = [];
    let invariant = stmt.subject === null || inferQualifier(stmt.subject, resolve) !== "series";
    if (stmt.subject !== null) {
        collectExpressionReads(stmt.subject, refs);
    }
    for (const arm of stmt.cases) {
        if (arm.test !== null) {
            collectExpressionReads(arm.test, refs);
        }
        for (const body of arm.body) {
            const valued = armBodyValue(body);
            if (valued === null) {
                invariant = false;
                continue;
            }
            if (inferQualifier(valued.value, resolve) === "series") {
                invariant = false;
            }
            refs.push({ name: valued.name, span: body.span });
            collectExpressionReads(valued.value, refs);
        }
    }
    return { invariant, refs };
}

// Collect the names a plain (non-switch) defining statement REFERENCES — its
// value reads plus its own TARGET name (so a `:=` reassignment links its `var x
// = na` seed). Switch defining statements route through {@link classifySwitch}.
function collectPlainReferences(stmt: VariableDeclaration | Assignment, out: Candidate[]): void {
    out.push({ name: stmt.name, span: stmt.span });
    collectExpressionReads(
        stmt.kind === "variable-declaration" ? stmt.initializer : stmt.value,
        out,
    );
}

// Whether a plain (non-switch) defining statement's value is bar-invariant.
function plainInvariant(stmt: VariableDeclaration | Assignment, resolve: SymbolResolver): boolean {
    return (
        inferQualifier(
            stmt.kind === "variable-declaration" ? stmt.initializer : stmt.value,
            resolve,
        ) !== "series"
    );
}

// Every top-level statement that DECLARES or ASSIGNS `name`: a typed
// declaration, a bare/`:=` assignment, or a `switch` whose arms assign it. A
// name commonly has several (a `var x = na` seed plus a `switch` that fills it).
function definingStatements(analysis: SemanticResult, name: string): DefiningStatement[] {
    const defs: DefiningStatement[] = [];
    for (const stmt of analysis.script.body) {
        if (stmt.kind === "variable-declaration" && stmt.name === name) {
            defs.push(stmt);
        } else if (stmt.kind === "assignment" && stmt.name === name) {
            defs.push(stmt);
        } else if (
            stmt.kind === "switch-statement" &&
            stmt.cases.some((arm) =>
                arm.body.some((body) => body.kind === "assignment" && body.name === name),
            )
        ) {
            defs.push(stmt);
        }
    }
    return defs;
}

/**
 * Plan the prelude that reconstructs every bar-invariant top-level binding a
 * `request.security` expression callback captures, so the emitted callback
 * resolves those names to callback-LOCALS (which the chartlang compiler's
 * `validateSecurityExpr` accepts) instead of capturing a main-timeline binding
 * (which it rejects).
 *
 * For each free identifier read in `bodies` that resolves to a top-level symbol
 * (excluding inputs, the `bar` param, builtins/namespaces, and names already
 * local): its defining statement(s) are collected, and — when EVERY defining RHS
 * is bar-invariant (`inferQualifier !== "series"`) AND the binding is a plain
 * local (not a `state.*` / `state.series` slot) — re-emitted to the `prelude` in
 * source order, recursing transitively into their own captures. A capture that
 * is bar-VARYING (depends on series / `ta.*` / OHLCV) or slot-backed cannot be
 * rebuilt and becomes a {@link CaptureReject} the caller surfaces as
 * `request-security-expr-captures-series`.
 *
 * @since 1.8
 * @experimental
 * @example
 *     import { collectCaptureHoist } from "./securityCapture.js";
 *     // collectCaptureHoist([source], ctx, analysis, reEmit).prelude
 *     void collectCaptureHoist;
 */
export function collectCaptureHoist(
    bodies: readonly ExpressionNode[],
    ctx: EmitContext,
    analysis: SemanticResult,
    reEmit: CaptureReEmit,
): CaptureHoist {
    const resolve: SymbolResolver = (n) => analysis.rootScope.symbols.get(n) ?? null;
    const isExcluded = (name: string): boolean =>
        ctx.localNames.has(name) ||
        ctx.inputNames.has(name) ||
        BUILTIN_IDENTIFIER_MAP.has(name) ||
        NAMESPACE_ROOTS.has(name) ||
        name === "bar";
    // Whether every defining statement of a captured name is bar-invariant, and
    // the names those statements reference (to enqueue transitively). A `switch`
    // is classified in one pass so its arm-body branches are reachable for both
    // the hoisted and rejected outcomes.
    const planDefs = (
        defs: readonly DefiningStatement[],
    ): { invariant: boolean; refs: Candidate[] } => {
        const refs: Candidate[] = [];
        let invariant = true;
        for (const def of defs) {
            if (def.kind === "switch-statement") {
                const classified = classifySwitch(def, resolve);
                invariant = invariant && classified.invariant;
                refs.push(...classified.refs);
            } else {
                invariant = invariant && plainInvariant(def, resolve);
                collectPlainReferences(def, refs);
            }
        }
        return { invariant, refs };
    };

    const queue: Candidate[] = [];
    for (const body of bodies) {
        collectExpressionReads(body, queue);
    }
    const visited = new Set<string>();
    const hoistStatements = new Map<string, DefiningStatement>();
    const hoistedNames = new Set<string>();
    const rejects: CaptureReject[] = [];
    for (let head = 0; head < queue.length; head += 1) {
        const { name, span } = queue[head];
        if (visited.has(name) || isExcluded(name)) {
            continue;
        }
        visited.add(name);
        const symbol = analysis.rootScope.symbols.get(name);
        if (symbol === undefined) {
            continue;
        }
        if (ctx.stateSlots.has(name) || ctx.seriesSlots?.has(name) === true) {
            rejects.push({ name, span });
            continue;
        }
        const defs = definingStatements(analysis, name);
        const plan = planDefs(defs);
        if (defs.length === 0 || !plan.invariant) {
            rejects.push({ name, span });
            continue;
        }
        hoistedNames.add(name);
        for (const def of defs) {
            hoistStatements.set(spanKey(def.span), def);
        }
        queue.push(...plan.refs);
    }

    // Emit in source order. Every defining statement is a distinct top-level
    // statement, so its `startLine` is unique — a total order, no tiebreaker.
    const ordered = [...hoistStatements.values()].sort(
        (a, b) => a.span.startLine - b.span.startLine,
    );
    const prelude = ordered.flatMap((stmt) => reEmit(stmt, hoistedNames));
    return { prelude, localNames: hoistedNames, rejects };
}

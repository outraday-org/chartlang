// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallExpression, ExpressionNode } from "../ast/index.js";
import type { Statement } from "../ast/statements.js";
import { DIAGNOSTIC_CODE_ENTRIES } from "../diagnostics/codes.js";
import type { SourceSpan } from "../index.js";
import type { DrawingCallSite, SemanticResult, SymbolInfo } from "../semantic/index.js";
import { dottedCallee } from "./callArgs.js";
import type { ResolvedAnchor } from "./coordinates.js";
import { resolveCoordinates } from "./coordinates.js";
import type { DiagnosticCollector } from "./diagnosticCollector.js";
import { resolveCampADrawKind } from "./drawKindResolve.js";
import type { DrawCallContext } from "./handleSlot.js";
import { drawCallAnchors, handleSlotLocalName, synthesizeDrawCall } from "./handleSlot.js";
import type { ScriptScaffold } from "./ir.js";
import { appendComputeStatement, appendHandleSlot } from "./scaffoldMutators.js";
import type { SetterCall } from "./setterFold.js";
import { foldSetters } from "./setterFold.js";

// The handle name a `*.set_*(handle, …)` / `*.delete(handle)` call targets,
// or `null` when the first arg is not a bare identifier.
function targetHandleName(call: CallExpression): string | null {
    const first = call.args[0];
    if (first === undefined || first.value.kind !== "identifier-expression") {
        return null;
    }
    return first.value.name;
}

// One handle mutation found in a straight-line block: either a setter fold
// input or a delete call.
type Mutation =
    | { readonly kind: "set"; readonly setter: SetterCall }
    | { readonly kind: "delete"; readonly call: CallExpression };

// The mutations targeting one handle within a single straight-line block
// (one `if`/`else if`/`else` branch or the top level).
type Branch = {
    readonly mutations: Mutation[];
};

// Classify one expression statement as a setter / delete against the named
// handle, or `null` when it targets a different handle or is not a setter.
function classifyExpression(expr: ExpressionNode, handleName: string): Mutation | null {
    if (expr.kind !== "call-expression") {
        return null;
    }
    const name = dottedCallee(expr);
    if (name === null || targetHandleName(expr) !== handleName) {
        return null;
    }
    if (name.endsWith(".delete")) {
        return { kind: "delete", call: expr };
    }
    const dotIndex = name.indexOf(".set_");
    if (dotIndex !== -1) {
        return { kind: "set", setter: { method: name.slice(dotIndex + 1), call: expr } };
    }
    return null;
}

// Collect the mutations targeting `handleName` inside one straight-line
// statement list (no descent into nested `if`/`for` — each branch is its
// own straight-line block).
function collectBranch(body: readonly Statement[], handleName: string): Branch {
    const mutations: Mutation[] = [];
    for (const stmt of body) {
        if (stmt.kind === "expression-statement") {
            const mutation = classifyExpression(stmt.expression, handleName);
            if (mutation !== null) {
                mutations.push(mutation);
            }
        }
    }
    return { mutations };
}

// Every straight-line block in the script that may mutate the handle: the
// top-level body plus each `if`/`else if`/`else` branch (one level of
// nesting, the v1 idiom).
function collectBranches(analysis: SemanticResult, handleName: string): Branch[] {
    const branches: Branch[] = [collectBranch(analysis.script.body, handleName)];
    for (const stmt of analysis.script.body) {
        if (stmt.kind === "if-statement") {
            branches.push(collectBranch(stmt.thenBody.body, handleName));
            for (const clause of stmt.elseIfClauses) {
                branches.push(collectBranch(clause.body.body, handleName));
            }
            if (stmt.elseBody !== null) {
                branches.push(collectBranch(stmt.elseBody.body, handleName));
            }
        }
    }
    return branches.filter((branch) => branch.mutations.length > 0);
}

// The declaration span of the handle's `var`/`varip` declaration when it
// initializes to a non-`na` value (a cold mount cannot reproduce it), or
// `null` when the declaration is `na`-initialized / absent.
function nonNaInitialSpan(analysis: SemanticResult, handle: SymbolInfo): SourceSpan | null {
    for (const stmt of analysis.script.body) {
        if (
            stmt.kind === "variable-declaration" &&
            stmt.name === handle.name &&
            stmt.initializer.kind !== "na-expression"
        ) {
            return stmt.span;
        }
    }
    return null;
}

// The diagnostic context the draw-call synthesis raises into, bridging the
// structural `DrawCallContext.warn` to the package `DiagnosticCollector`.
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

/**
 * Lower one Camp A drawing call-site — a single `var`/`varip` handle
 * created once and mutated each bar — into the {@link ScriptScaffold}. The
 * function: registers the module-level handle slot
 * ({@link appendHandleSlot}); emits a guarded `slot.set(draw.<kind>(…))`
 * creation; folds every observed `*.set_*` mutation per branch into one
 * `slot.current()?.update({...})`; and emits
 * `slot.current()?.remove(); slot.set(null);` at each `*.delete(handle)`.
 * Mutates the scaffold + diagnostics collector and returns `void` — Task 16
 * codegen reads `scaffold.handleSlots` + `scaffold.computeBody`.
 *
 * The handle-slot synthesis and setter-fold are shared with Camp B
 * (Task 11) via {@link handleSlotLocalName} / {@link synthesizeDrawCall} /
 * {@link foldSetters}.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { lex } from "../lexer/index.js";
 *     import { parseStatements } from "../parser/index.js";
 *     import { analyze } from "../semantic/index.js";
 *     import { DiagnosticCollector } from "./diagnosticCollector.js";
 *     import { transformDeclaration } from "./declaration.js";
 *     import { transformCampA } from "./campA.js";
 *     const src =
 *         "//@version=6\nindicator(\"X\", overlay=true)\n" +
 *         "var line lvl = na\nif barstate.islast\n" +
 *         "    lvl := line.new(bar_index, close, bar_index, close)\nplot(close)\n";
 *     const analysis = analyze(parseStatements(lex(src).tokens).script);
 *     const decl = analysis.script.declaration;
 *     if (decl !== null && decl.kind === "indicator-declaration") {
 *         const diagnostics = new DiagnosticCollector();
 *         const scaffold = transformDeclaration(decl, analysis, diagnostics);
 *         for (const site of analysis.drawingSites) {
 *             if (site.camp.kind === "camp-a") {
 *                 transformCampA(site, analysis, scaffold, diagnostics);
 *             }
 *         }
 *         void scaffold.handleSlots; // [{ name: "__lvl_handle", kind: "line" }]
 *     }
 */
export function transformCampA(
    site: DrawingCallSite,
    analysis: SemanticResult,
    scaffold: ScriptScaffold,
    diagnostics: DiagnosticCollector,
): void {
    if (site.camp.kind !== "camp-a") {
        return;
    }
    const handle = site.camp.handleSymbol;
    const kind = resolveCampADrawKind(site, diagnostics);
    if (kind === null) {
        return;
    }
    // Allocate the readable handle local (reuses the Pine identifier) only
    // AFTER the draw-kind resolves — an unmapped kind early-returns without
    // emitting anything, so it must not consume a name.
    const local = handleSlotLocalName(handle.name, scaffold.names);

    const branches = collectBranches(analysis, handle.name);

    // Compact lowering eligibility: the single-create persistent-handle idiom
    // with NO `*.delete` and a plain (non-`varip`) handle. The runtime keys a
    // `draw.*` callsite by slot id and re-emits `update` on cross-bar re-entry,
    // so a `const <local> = draw.<kind>(…)` evaluated each bar IS the persistent
    // handle — exactly what the `useDrawingHandleSlot` create-guard reproduces
    // (its closure resets every bar, so its `current() === null` guard fires the
    // same `draw.*` callsite every bar). A `*.delete` re-creates next bar through
    // the same callsite (the runtime resurrects the slot), which the bare-const
    // form cannot express, so a delete forces the general machinery.
    const hasDelete = branches.some((branch) =>
        branch.mutations.some((mutation) => mutation.kind === "delete"),
    );
    const compact = handle.kind !== "varip-variable" && !hasDelete;
    appendHandleSlot(scaffold, { name: local, kind, compact });

    const { anchors } = resolveCoordinates(analysis, {});
    const ctx = drawContext(analysis, anchors, diagnostics);
    const drawCall = synthesizeDrawCall(kind, site.call, ctx);
    const anchorDefaults = drawCallAnchors(kind, site.call, ctx);

    appendComputeStatement(
        scaffold,
        compact
            ? `const ${local} = ${drawCall};`
            : `if (${local}.current() === null) { ${local}.set(${drawCall}); }`,
    );

    if (handle.kind === "varip-variable") {
        diagnostics.pushCode("varip-approximated", site.span);
    }
    const nonNaSpan = nonNaInitialSpan(analysis, handle);
    if (nonNaSpan !== null) {
        diagnostics.pushCode("cross-mount-state-not-preserved", nonNaSpan);
    }

    const branchesWithSetters = branches.filter((branch) =>
        branch.mutations.some((mutation) => mutation.kind === "set"),
    );
    if (branchesWithSetters.length > 1) {
        diagnostics.pushCode("setter-fold-cross-branch", site.span);
    }

    for (const branch of branches) {
        emitBranch(branch, site, local, compact, ctx, diagnostics, scaffold, anchorDefaults);
    }
}

// Emit the folded update + any delete statements for one branch. A `compact`
// slot is a bare `const` handle, so it patches via `<local>.update(…)`; the
// general slot machinery patches the held handle via `<local>.current()?.…`.
// A `delete` only reaches here on a non-compact slot (the compact path is
// gated off `hasDelete`), so its statements always use the slot form.
function emitBranch(
    branch: Branch,
    site: DrawingCallSite,
    local: string,
    compact: boolean,
    ctx: DrawCallContext,
    diagnostics: DiagnosticCollector,
    scaffold: ScriptScaffold,
    anchorDefaults: readonly string[],
): void {
    const setters: SetterCall[] = [];
    for (const mutation of branch.mutations) {
        if (mutation.kind === "set") {
            setters.push(mutation.setter);
        }
    }
    if (setters.length > 0) {
        const patch = foldSetters(
            setters,
            site.handleType,
            ctx.annotations,
            (code, node) => diagnostics.pushCode(code, node.span),
            anchorDefaults,
        );
        if (patch !== null) {
            appendComputeStatement(
                scaffold,
                compact ? `${local}.update(${patch});` : `${local}.current()?.update(${patch});`,
            );
        }
    }
    for (const mutation of branch.mutations) {
        if (mutation.kind === "delete") {
            appendComputeStatement(scaffold, `${local}.current()?.remove();`);
            appendComputeStatement(scaffold, `${local}.set(null);`);
        }
    }
}

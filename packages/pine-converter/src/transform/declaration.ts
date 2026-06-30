// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ExpressionNode, Statement } from "../ast/index.js";
import type { Declaration } from "../ast/script.js";
import type { SemanticResult } from "../semantic/index.js";
import { FALLBACK_INDICATOR_NAME, mapDeclarationArgs } from "./declarationArgs.js";
import type { DiagnosticCollector } from "./diagnosticCollector.js";
import type { ScriptScaffold } from "./ir.js";
import { NameAllocator, collectReservedNames } from "./nameAllocator.js";

// Pine plot-family call names that force a `defineIndicator` constructor.
const PLOT_CALLEES: ReadonlySet<string> = new Set([
    "plot",
    "plotshape",
    "plotchar",
    "plotcandle",
    "plotbar",
    "plotarrow",
    "hline",
    "fill",
    "bgcolor",
    "barcolor",
]);

// The bare-identifier callee name of a call expression (`plot(...)`), or
// `null` for a member-access / computed callee (`ta.ema(...)`).
function calleeName(node: ExpressionNode): string | null {
    if (node.kind === "call-expression" && node.callee.kind === "identifier-expression") {
        return node.callee.name;
    }
    return null;
}

// Whether any statement in the tree contains a plot-family call. Walks the
// nested block structure (`if`/`for`/`switch` bodies) so a plot inside a
// conditional still counts.
function hasPlotCall(statements: readonly Statement[]): boolean {
    for (const statement of statements) {
        if (statementHasPlot(statement)) {
            return true;
        }
    }
    return false;
}

function statementHasPlot(statement: Statement): boolean {
    switch (statement.kind) {
        case "expression-statement": {
            const name = calleeName(statement.expression);
            return name !== null && PLOT_CALLEES.has(name);
        }
        case "if-statement":
            return (
                hasPlotCall(statement.thenBody.body) ||
                statement.elseIfClauses.some((arm) => hasPlotCall(arm.body.body)) ||
                (statement.elseBody !== null && hasPlotCall(statement.elseBody.body))
            );
        case "for-statement":
            return hasPlotCall(statement.body.body);
        case "switch-statement":
            return statement.cases.some((arm) => hasPlotCall(arm.body));
        case "block-statement":
            return hasPlotCall(statement.body);
        case "enum-declaration":
            return false;
        default:
            return false;
    }
}

// Decide the chartlang constructor: a plot-family call → `defineIndicator`;
// no plots but at least one drawing → `defineDrawing` (with the downgrade
// info diagnostic); neither → `defineIndicator` (compute-only script).
function chooseConstructor(
    analysis: SemanticResult,
    diagnostics: DiagnosticCollector,
    declSpan: SemanticResult["script"]["span"],
): "defineIndicator" | "defineDrawing" {
    if (hasPlotCall(analysis.script.body)) {
        return "defineIndicator";
    }
    if (analysis.drawingSites.length > 0) {
        diagnostics.pushCode("drawing-only-script", declSpan);
        return "defineDrawing";
    }
    return "defineIndicator";
}

/**
 * Rewrite the Pine top-level declaration into a {@link ScriptScaffold} — the
 * mutable transform IR Tasks 9–15 populate. Maps the `indicator(...)` /
 * `strategy(...)` arguments onto chartlang options (§2), picks
 * `defineIndicator` vs `defineDrawing` by scanning for plot-family calls
 * (§3), and synthesizes a `defineIndicator` shell for a `strategy(...)`
 * declaration with a `strategy-as-indicator` info diagnostic (§4). A
 * computed (non-literal) title raises `computed-indicator-title` and falls
 * back to the `<unknown>` name (§5). The `library(...)` declaration is
 * hard-rejected upstream and never reaches this function.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { DiagnosticCollector } from "./diagnosticCollector.js";
 *     declare const analysis: SemanticResult;
 *     declare const decl: import("../ast/script.js").IndicatorDeclaration;
 *     const diagnostics = new DiagnosticCollector();
 *     const scaffold = transformDeclaration(decl, analysis, diagnostics);
 *     void scaffold;
 */
export function transformDeclaration(
    decl: Extract<Declaration, { kind: "indicator-declaration" | "strategy-declaration" }>,
    analysis: SemanticResult,
    diagnostics: DiagnosticCollector,
): ScriptScaffold {
    if (decl.kind === "strategy-declaration") {
        diagnostics.pushCode("strategy-as-indicator", decl.span);
    }

    const options = mapDeclarationArgs(decl.args, diagnostics);
    const ctor =
        decl.kind === "strategy-declaration"
            ? "defineIndicator"
            : chooseConstructor(analysis, diagnostics, decl.span);

    const overlay = ctor === "defineDrawing" ? null : options.overlay;
    const scale = ctor === "defineDrawing" ? null : options.scale;
    const maxBarsBack = ctor === "defineDrawing" ? null : options.maxBarsBack;

    return {
        constructor: ctor,
        apiVersion: 1,
        name: options.name ?? FALLBACK_INDICATOR_NAME,
        shortName: options.shortName,
        overlay,
        format: options.format,
        precision: options.precision,
        scale,
        maxDrawings: options.maxDrawings,
        maxBarsBack,
        inputs: [],
        stateSlots: [],
        handleSlots: [],
        handleRings: [],
        computeBody: { statements: [] },
        diagnostics: diagnostics.toArray(),
        names: new NameAllocator(collectReservedNames(analysis)),
    };
}

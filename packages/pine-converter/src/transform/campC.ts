// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallExpression, ExpressionNode, Statement } from "../ast/index.js";
import { makeDiagnostic } from "../diagnostics/codes.js";
import type { Diagnostic } from "../index.js";
import type { DrawingCallSite, SemanticResult, SymbolInfo } from "../semantic/index.js";
import { dottedCallee } from "./callArgs.js";
import { transformCampB } from "./campB.js";
import type { HeuristicResult } from "./campCHeuristics.js";
import { tryHeuristics } from "./campCHeuristics.js";
import type { CampCContext, RejectCode } from "./campCRejects.js";
import { rejectSuggestion } from "./campCRejects.js";
import type { DiagnosticCollector } from "./diagnosticCollector.js";
import type { ScriptScaffold } from "./ir.js";
import { appendComputeStatement } from "./scaffoldMutators.js";

// Resolve a Pine collection symbol against the root scope (the same root-only
// rule the camp classifier uses). `null` when the name was declared only in a
// nested block (and so cannot back a module-level ring).
function resolveCollectionSymbol(analysis: SemanticResult, name: string): SymbolInfo | null {
    return analysis.rootScope.symbols.get(name) ?? null;
}

// Whether `call` is a `linefill.new(...)` anchored from a collection
// (`array.get(...)` argument) — the cross-collection fill obstacle.
function isCrossCollectionLinefill(call: CallExpression): boolean {
    if (dottedCallee(call) !== "linefill.new") {
        return false;
    }
    return call.args.some(
        (arg) => arg.value.kind === "call-expression" && dottedCallee(arg.value) === "array.get",
    );
}

// Whether any statement value references `<family>.copy(...)` — a handle copy
// (no chartlang analogue). Scans top-level statement values only (the v1
// idiom for a copy is a straight-line assignment).
function referencesHandleCopy(analysis: SemanticResult, family: string): boolean {
    return analysis.script.body.some((stmt) => {
        const value = statementValue(stmt);
        return value !== null && isCopyOfFamily(value, family);
    });
}

// The value expression a statement carries, or `null`.
function statementValue(stmt: Statement): ExpressionNode | null {
    if (stmt.kind === "variable-declaration") {
        return stmt.initializer;
    }
    if (stmt.kind === "assignment") {
        return stmt.value;
    }
    if (stmt.kind === "expression-statement") {
        return stmt.expression;
    }
    return null;
}

// Whether `expr` is `<family>.copy(...)`.
function isCopyOfFamily(expr: ExpressionNode, family: string): boolean {
    return expr.kind === "call-expression" && dottedCallee(expr) === `${family}.copy`;
}

// Pick the hard-reject code for a non-foldable Camp C site from its shape and
// the semantic `reasoning`. The dominant case is a collection with no cap →
// `unbounded-handle-collection`; the rest match a specific obstacle.
function classifyReject(site: DrawingCallSite, analysis: SemanticResult): RejectCode {
    if (isCrossCollectionLinefill(site.call)) {
        return "cross-collection-linefill";
    }
    if (referencesHandleCopy(analysis, site.handleType)) {
        return "handle-copy";
    }
    // `polyline.new` never reaches here — `transformCampC` early-returns on it
    // (Task 14 owns all polyline sites). The `polyline-dynamic-points` reject
    // is now emitted by `transformPolylineLinefill`, not Camp C.
    const reasoning = site.camp.kind === "camp-c-unbounded" ? site.camp.reasoning : "";
    if (reasoning.includes(".all") || reasoning.includes("for...in")) {
        return "for-in-line-all";
    }
    if (reasoning.includes("UDT") || reasoning.includes("user-defined type")) {
        return "handle-store-in-udt";
    }
    if (reasoning.includes("dynamic index")) {
        return "dynamic-handle-index";
    }
    return "unbounded-handle-collection";
}

// The reject comment compute statement anchoring the obstacle in the
// generated TS at the site's source position. Task 16 codegen joins it into
// the compute body verbatim.
function rejectComment(code: RejectCode, site: DrawingCallSite): string {
    const where = `${site.span.startLine}:${site.span.startColumn}`;
    return (
        `// [pine-converter] HARD-REJECT (${code}) at ${where} — ` +
        `${site.constructor}(...) — see diagnostics for the suggested rewrite.`
    );
}

// Build the diagnostic for a reject, replacing the registry's generic
// suggestion with the context-specific templated one.
function rejectDiagnostic(code: RejectCode, ctx: CampCContext): Diagnostic {
    const base = makeDiagnostic(code, ctx.site.span);
    return { ...base, suggestion: rejectSuggestion(code, ctx) };
}

// Fold a reducible site into a Camp B ring by handing `transformCampB` a
// synthetic camp-b view of the same `.new()` call. Returns whether the fold
// landed (the collection had to resolve at the root scope).
function foldIntoRing(
    site: DrawingCallSite,
    heuristic: HeuristicResult,
    analysis: SemanticResult,
    scaffold: ScriptScaffold,
    diagnostics: DiagnosticCollector,
): boolean {
    const collectionSymbol = resolveCollectionSymbol(analysis, heuristic.collectionName);
    if (collectionSymbol === null) {
        return false;
    }
    diagnostics.pushCode("camp-c-heuristic-applied", site.span, heuristic.reasoning);
    const bounded: DrawingCallSite = {
        ...site,
        camp: {
            kind: "camp-b",
            collectionSymbol,
            cap: heuristic.cap,
            capSource: "max-count-decl",
        },
    };
    transformCampB(bounded, analysis, scaffold, diagnostics);
    return true;
}

/**
 * Lower one Camp C drawing call-site — a dynamic collection of drawings that
 * does not fit the Camp B ring model — either by folding it into a bounded
 * ring (when a reducibility heuristic proves a cap) or by emitting a precise
 * hard-reject. The function early-returns for any non-camp-c site (callers
 * can pass the whole `drawingSites` list and let it self-filter).
 *
 * On a successful heuristic fold it emits `camp-c-heuristic-applied` (info,
 * carrying the heuristic's reasoning) and delegates to {@link transformCampB}
 * with a synthetic camp-b view of the site — REUSING the ring synthesis, not
 * duplicating it. When no heuristic applies (or the collection does not
 * resolve at the root scope), it emits exactly ONE structured `error`
 * diagnostic naming the obstacle and carrying a context-specific suggested
 * rewrite, plus a `// [pine-converter] HARD-REJECT (...)` comment compute
 * statement so a reader sees what did not convert and where. The converter
 * never halts: every reject continues processing the remaining sites. Task 16
 * codegen reads the diagnostics + reject comments and, under
 * `ConvertOpts.strictMode`, suppresses `output` when any error is present.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { lex } from "../lexer/index.js";
 *     import { parseStatements } from "../parser/index.js";
 *     import { analyze } from "../semantic/index.js";
 *     import { DiagnosticCollector } from "./diagnosticCollector.js";
 *     import { transformDeclaration } from "./declaration.js";
 *     import { transformCampC } from "./campC.js";
 *     const src =
 *         "//@version=6\nindicator(\"X\", overlay=true, max_lines_count=30)\n" +
 *         "var lvls = array.new_line()\nif close > open\n" +
 *         "    array.push(lvls, line.new(bar_index, close, bar_index, close))\nplot(close)\n";
 *     const analysis = analyze(parseStatements(lex(src).tokens).script);
 *     const decl = analysis.script.declaration;
 *     if (decl !== null && decl.kind === "indicator-declaration") {
 *         const diagnostics = new DiagnosticCollector();
 *         const scaffold = transformDeclaration(decl, analysis, diagnostics);
 *         for (const site of analysis.drawingSites) {
 *             transformCampC(site, analysis, scaffold, diagnostics);
 *         }
 *         void scaffold.handleRings; // folded ring when the cap was provable
 *     }
 */
export function transformCampC(
    site: DrawingCallSite,
    analysis: SemanticResult,
    scaffold: ScriptScaffold,
    diagnostics: DiagnosticCollector,
): void {
    if (site.camp.kind !== "camp-c-bounded" && site.camp.kind !== "camp-c-unbounded") {
        return;
    }
    // Task 14 (`transformPolylineLinefill`) owns ALL `polyline.new` sites and
    // the STATIC two-line `linefill.new(lineA, lineB)` (no `array.get`) — it
    // converts them best-effort rather than hard-rejecting. Only the
    // collection-driven `linefill.new(array.get(...))` cross-collection fill
    // stays a Camp C reject here.
    if (site.constructor === "polyline.new") {
        return;
    }
    if (site.constructor === "linefill.new" && !isCrossCollectionLinefill(site.call)) {
        return;
    }
    const heuristic = tryHeuristics(site, analysis, scaffold);
    if (heuristic !== null && foldIntoRing(site, heuristic, analysis, scaffold, diagnostics)) {
        return;
    }
    const code = classifyReject(site, analysis);
    const ctx: CampCContext = {
        site,
        collectionName: heuristic?.collectionName ?? null,
        inferredCap: heuristic?.cap ?? null,
    };
    diagnostics.push(rejectDiagnostic(code, ctx));
    appendComputeStatement(scaffold, rejectComment(code, site));
}

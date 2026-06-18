// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    Assignment,
    CallExpression,
    ExpressionNode,
    Script,
    Statement,
    VariableDeclaration,
} from "../ast/index.js";
import { makeDiagnostic } from "../diagnostics/codes.js";
import type { Diagnostic, SourceSpan } from "../index.js";
import { DRAWING_KIND_MAP, type PineDrawingConstructor } from "../mapping/index.js";
import { dottedName } from "./nodes.js";
import type { SymbolResolver } from "./qualifiers.js";
import type { DrawingCallSite, DrawingCamp, HandleType, SymbolInfo } from "./types.js";

// Default ring capacity when a collection is bounded only by Pine's
// implicit per-bucket GC and no explicit cap is found.
const BUCKET_DEFAULT_CAP = 50;

/**
 * The per-family caps declared on the `indicator(...)` header
 * (`max_lines_count`, …). Absent families map to `null`.
 *
 * @since 0.1
 * @stable
 * @example
 *     const caps: IndicatorCaps = { line: 10 };
 *     void caps;
 */
export type IndicatorCaps = Readonly<Partial<Record<HandleType, number>>>;

/**
 * Outcome of {@link classifyDrawingSites}: the classified sites in source
 * order, the per-call lookup map, and any camp diagnostics.
 *
 * @since 0.1
 * @stable
 * @example
 *     const r: DrawingClassification = {
 *         sites: [],
 *         classifications: new Map(),
 *         diagnostics: [],
 *     };
 *     void r;
 */
export type DrawingClassification = Readonly<{
    sites: readonly DrawingCallSite[];
    classifications: ReadonlyMap<CallExpression, DrawingCamp>;
    diagnostics: readonly Diagnostic[];
}>;

const HANDLE_TYPE_OF: Readonly<Record<PineDrawingConstructor, HandleType>> = {
    "line.new": "line",
    "label.new": "label",
    "box.new": "box",
    "table.new": "table",
    "polyline.new": "polyline",
    "linefill.new": "linefill",
};

// Flatten an `if`/`for`/`switch`/block tree into a single statement stream
// for the source-order facts the classifier needs (push sites, eviction
// guards, indicator caps are all top-of-file or inside guards).
function flattenStatements(statements: readonly Statement[]): Statement[] {
    const out: Statement[] = [];
    const visit = (stmt: Statement): void => {
        out.push(stmt);
        switch (stmt.kind) {
            case "if-statement": {
                stmt.thenBody.body.forEach(visit);
                for (const clause of stmt.elseIfClauses) {
                    clause.body.body.forEach(visit);
                }
                stmt.elseBody?.body.forEach(visit);
                return;
            }
            case "for-statement":
                stmt.body.body.forEach(visit);
                return;
            case "switch-statement": {
                for (const switchCase of stmt.cases) {
                    switchCase.body.forEach(visit);
                }
                return;
            }
            case "block-statement":
                stmt.body.forEach(visit);
                return;
            default:
                return;
        }
    };
    statements.forEach(visit);
    return out;
}

function asDrawingConstructorCall(
    expr: ExpressionNode,
): { call: CallExpression; constructor: PineDrawingConstructor } | null {
    if (expr.kind !== "call-expression") {
        return null;
    }
    const name = dottedName(expr.callee);
    if (name === null || !DRAWING_KIND_MAP.has(name as PineDrawingConstructor)) {
        return null;
    }
    return { call: expr, constructor: name as PineDrawingConstructor };
}

// The `array.push(<collection>, <draw>.new(...))` form: returns the drawing
// call and the collection name when the second argument is a constructor.
function asPushedDrawing(
    expr: ExpressionNode,
): { call: CallExpression; constructor: PineDrawingConstructor; collection: string } | null {
    if (expr.kind !== "call-expression" || dottedName(expr.callee) !== "array.push") {
        return null;
    }
    if (expr.args.length < 2) {
        return null;
    }
    const collection = expr.args[0].value;
    const pushed = asDrawingConstructorCall(expr.args[1].value);
    if (pushed === null || collection.kind !== "identifier-expression") {
        return null;
    }
    return { call: pushed.call, constructor: pushed.constructor, collection: collection.name };
}

// Read an integer literal cap from an eviction-guard right-hand side. Only
// a bare int literal is treated as an explicit cap here; the lexer
// guarantees an `int` literal's text is digits, so the parse always
// succeeds.
function literalIntValue(expr: ExpressionNode): number | null {
    if (expr.kind === "literal-expression" && expr.literalKind === "int") {
        return Number.parseInt(expr.value, 10);
    }
    return null;
}

// Detect the ring-buffer eviction cap for `collection`: an
// `if array.size(collection) > K` guard whose body deletes
// `array.shift(collection)`. Returns K or null.
function findEvictionCap(statements: readonly Statement[], collection: string): number | null {
    for (const stmt of statements) {
        if (stmt.kind !== "if-statement") {
            continue;
        }
        const cap = evictionCapOfCondition(stmt.condition, collection);
        if (cap !== null && bodyEvictsCollection(stmt.thenBody.body, collection)) {
            return cap;
        }
    }
    return null;
}

// `array.size(collection) > K` → K (for `>` / `>=`).
function evictionCapOfCondition(condition: ExpressionNode, collection: string): number | null {
    if (condition.kind !== "binary-expression") {
        return null;
    }
    if (condition.operator !== ">" && condition.operator !== ">=") {
        return null;
    }
    if (!isArraySizeOf(condition.left, collection)) {
        return null;
    }
    return literalIntValue(condition.right);
}

function isArraySizeOf(expr: ExpressionNode, collection: string): boolean {
    if (expr.kind !== "call-expression" || dottedName(expr.callee) !== "array.size") {
        return false;
    }
    const arg = expr.args[0]?.value;
    return arg !== undefined && arg.kind === "identifier-expression" && arg.name === collection;
}

// Whether `body` contains a `*.delete(array.shift(collection))` eviction.
function bodyEvictsCollection(body: readonly Statement[], collection: string): boolean {
    return flattenStatements(body).some((stmt) => {
        if (stmt.kind !== "expression-statement") {
            return false;
        }
        const call = stmt.expression;
        if (call.kind !== "call-expression") {
            return false;
        }
        const name = dottedName(call.callee);
        if (name === null || !name.endsWith(".delete")) {
            return false;
        }
        return call.args.some((arg) => isArrayShiftOf(arg.value, collection));
    });
}

function isArrayShiftOf(expr: ExpressionNode, collection: string): boolean {
    if (expr.kind !== "call-expression") {
        return false;
    }
    const name = dottedName(expr.callee);
    if (name !== "array.shift" && name !== "array.remove") {
        return false;
    }
    const arg = expr.args[0]?.value;
    return arg !== undefined && arg.kind === "identifier-expression" && arg.name === collection;
}

// A `linefill.new(a, b)` whose anchors are pulled from a collection
// (`array.get(...)`) is the canonical unbounded case.
function isCollectionDrivenLinefill(call: CallExpression): boolean {
    return call.args.some((arg) => {
        const value = arg.value;
        return value.kind === "call-expression" && dottedName(value.callee) === "array.get";
    });
}

function classifyHandleSite(handleSymbol: SymbolInfo, handleType: HandleType): DrawingCamp {
    // `linefill.new` has no chartlang analogue even as a single handle.
    if (handleType === "linefill") {
        return {
            kind: "camp-c-unbounded",
            reasoning: "linefill has no single-handle chartlang analogue",
        };
    }
    return { kind: "camp-a", handleSymbol };
}

function classifyCollectionSite(
    collection: string,
    handleType: HandleType,
    call: CallExpression,
    statements: readonly Statement[],
    resolve: SymbolResolver,
    caps: IndicatorCaps,
): DrawingCamp {
    if (isCollectionDrivenLinefill(call)) {
        return {
            kind: "camp-c-unbounded",
            reasoning: "linefill anchored from a dynamic collection",
        };
    }
    const collectionSymbol = resolve(collection);
    const evictionCap = findEvictionCap(statements, collection);
    if (collectionSymbol !== null && evictionCap !== null) {
        return {
            kind: "camp-b",
            collectionSymbol,
            cap: evictionCap,
            capSource: "max-count-decl",
        };
    }
    const indicatorCap = caps[handleType];
    if (indicatorCap !== undefined) {
        return {
            kind: "camp-c-bounded",
            reasoning: `bounded by indicator cap=${indicatorCap}; relies on Pine FIFO GC`,
        };
    }
    if (collectionSymbol !== null) {
        return {
            kind: "camp-b",
            collectionSymbol,
            cap: BUCKET_DEFAULT_CAP,
            capSource: "bucket-default",
        };
    }
    return {
        kind: "camp-c-unbounded",
        reasoning: "drawing collection with no detectable cap",
    };
}

function diagnosticForCamp(camp: DrawingCamp, span: SourceSpan): Diagnostic | null {
    if (camp.kind === "camp-c-unbounded") {
        return makeDiagnostic("unbounded-handle-collection", span, camp.reasoning);
    }
    if (camp.kind === "camp-c-bounded") {
        return makeDiagnostic("dynamic-handle-collection", span, camp.reasoning);
    }
    return null;
}

/**
 * Classify every drawing `.new()` call-site in `script` into Camp A / B / C
 * (the single source of truth Tasks 10–14 consume). A constructor assigned
 * to a `var`/`varip` handle is Camp A; one `array.push`'d into a collection
 * with a detected ring-buffer eviction is Camp B (cap extracted); a capped
 * collection with no eviction is Camp C-bounded; everything else (including
 * collection-driven `linefill.new`) is Camp C-unbounded and hard-rejects.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { classifyDrawingSites } from "./drawingCamp.js";
 *     import { resolveSymbol, createScopeBuilder } from "./scope.js";
 *     const root = createScopeBuilder(null, {
 *         startLine: 1,
 *         startColumn: 1,
 *         endLine: 1,
 *         endColumn: 1,
 *     });
 *     const out = classifyDrawingSites(
 *         { kind: "script", version: null, declaration: null, body: [], span: root.span },
 *         (name) => resolveSymbol(root, name),
 *         {},
 *     );
 *     out.sites.length; // 0
 */
export function classifyDrawingSites(
    script: Script,
    resolve: SymbolResolver,
    caps: IndicatorCaps,
): DrawingClassification {
    const all = flattenStatements(script.body);
    const sites: DrawingCallSite[] = [];
    const classifications = new Map<CallExpression, DrawingCamp>();
    const diagnostics: Diagnostic[] = [];

    const record = (
        call: CallExpression,
        constructorName: PineDrawingConstructor,
        camp: DrawingCamp,
    ): void => {
        const handleType = HANDLE_TYPE_OF[constructorName];
        const site: DrawingCallSite = {
            call,
            constructor: constructorName,
            handleType,
            camp,
            span: call.span,
        };
        sites.push(site);
        classifications.set(call, camp);
        const diag = diagnosticForCamp(camp, call.span);
        if (diag !== null) {
            diagnostics.push(diag);
        }
    };

    for (const stmt of all) {
        const pushed =
            stmt.kind === "expression-statement" ? asPushedDrawing(stmt.expression) : null;
        if (pushed !== null) {
            const camp = classifyCollectionSite(
                pushed.collection,
                HANDLE_TYPE_OF[pushed.constructor],
                pushed.call,
                all,
                resolve,
                caps,
            );
            record(pushed.call, pushed.constructor, camp);
            continue;
        }
        const handleSite = handleDrawingOf(stmt);
        if (handleSite !== null) {
            const symbol = resolve(handleSite.handleName);
            const camp =
                symbol === null
                    ? ({
                          kind: "camp-c-unbounded",
                          reasoning: "drawing assigned to an unresolved variable",
                      } as const)
                    : classifyHandleSite(symbol, HANDLE_TYPE_OF[handleSite.constructor]);
            record(handleSite.call, handleSite.constructor, camp);
            continue;
        }
        const bare = asBareStandalonePolyline(stmt);
        if (bare !== null) {
            record(bare.call, "polyline.new", standalonePolylineCamp());
        }
    }

    return { sites, classifications, diagnostics };
}

// A standalone `polyline.new(pts, …)` expression statement — the build-and-
// draw idiom that binds no Pine handle. Only `polyline.new` is surfaced this
// way (a bare `line.new`/`box.new`/`label.new` each-bar is a different,
// unsupported idiom; a standalone `linefill.new` keeps the Camp C path for its
// cross-collection reject), so `transformPolylineLinefill` can rebuild it
// instead of the site being silently dropped.
function asBareStandalonePolyline(stmt: Statement): { call: CallExpression } | null {
    if (stmt.kind !== "expression-statement") {
        return null;
    }
    const drawing = asDrawingConstructorCall(stmt.expression);
    return drawing !== null && drawing.constructor === "polyline.new"
        ? { call: drawing.call }
        : null;
}

// The camp for a standalone `polyline.new`: `camp-a` (so it raises no
// reject diagnostic) with a synthetic, never-read handle symbol. The convert
// pipeline skips `polyline.new` in the Camp A/B/C dispatch — only
// `transformPolylineLinefill` consumes it — so this symbol is a placeholder.
function standalonePolylineCamp(): DrawingCamp {
    return {
        kind: "camp-a",
        handleSymbol: {
            name: "",
            kind: "var-variable",
            declarationSpan: null,
            typeAnnotation: null,
            qualifier: "series",
            handleType: "polyline",
        },
    };
}

// A `var line lvl = line.new(...)` / `lvl := line.new(...)` single-handle
// creation: the bound name plus the constructor call.
function handleDrawingOf(
    stmt: Statement,
): { handleName: string; call: CallExpression; constructor: PineDrawingConstructor } | null {
    if (stmt.kind === "variable-declaration") {
        return fromInitializer(stmt);
    }
    if (stmt.kind === "assignment") {
        return fromAssignment(stmt);
    }
    return null;
}

function fromInitializer(
    decl: VariableDeclaration,
): { handleName: string; call: CallExpression; constructor: PineDrawingConstructor } | null {
    const ctor = asDrawingConstructorCall(decl.initializer);
    return ctor === null
        ? null
        : { handleName: decl.name, call: ctor.call, constructor: ctor.constructor };
}

function fromAssignment(
    assignment: Assignment,
): { handleName: string; call: CallExpression; constructor: PineDrawingConstructor } | null {
    const ctor = asDrawingConstructorCall(assignment.value);
    return ctor === null
        ? null
        : { handleName: assignment.name, call: ctor.call, constructor: ctor.constructor };
}

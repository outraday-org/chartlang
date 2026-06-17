// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallArgument, CallExpression, ExpressionNode } from "../ast/index.js";
import type { Statement } from "../ast/statements.js";
import type { SourceSpan } from "../index.js";
import { enumLookup } from "../mapping/index.js";
import type { SemanticResult } from "../semantic/index.js";
import { dottedCallee, positionalArgs } from "./callArgs.js";
import { substituteIterator } from "./controlFlow.js";
import type { DiagnosticCollector } from "./diagnosticCollector.js";
import type { AnnotationLookup } from "./exprEmit.js";
import { emitExpr } from "./exprEmit.js";
import { handleSlotLocalName } from "./handleSlot.js";
import type { ScriptScaffold } from "./ir.js";
import { appendComputeStatement, appendHandleSlot } from "./scaffoldMutators.js";

/**
 * One collected `draw.table` cell: the chartlang source strings for its
 * `text` and optional styling fields, plus the span of the last Pine write
 * that produced it (used for the out-of-bounds diagnostic). Absent fields
 * render nothing; an absent cell renders as an empty-string cell.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const c: CellSpec = {
 *         text: '"P&L"',
 *         textColor: '"#16a34a"',
 *         sourceSpan: { startLine: 5, startColumn: 1, endLine: 5, endColumn: 9 },
 *     };
 *     void c;
 */
export type CellSpec = {
    text: string;
    bgColor?: string;
    textColor?: string;
    textHalign?: string;
    textValign?: string;
    textSize?: string;
    sourceSpan: SourceSpan;
};

// The bare identifier name the first positional arg refers to (the handle a
// `table.cell(handle, …)` call targets), or `null` when it is not an
// identifier.
function targetHandleName(call: CallExpression): string | null {
    const first = call.args[0];
    if (first === undefined || first.value.kind !== "identifier-expression") {
        return null;
    }
    return first.value.name;
}

// Read a literal non-negative integer from a node (a bare `5` or a unary
// `+5`/`-5`), or `null` when it is not a literal int.
function literalInt(node: ExpressionNode): number | null {
    if (node.kind === "literal-expression" && node.literalKind === "int") {
        return Number.parseInt(node.value, 10);
    }
    if (
        node.kind === "unary-expression" &&
        (node.operator === "+" || node.operator === "-") &&
        node.operand.kind === "literal-expression" &&
        node.operand.literalKind === "int"
    ) {
        const magnitude = Number.parseInt(node.operand.value, 10);
        return node.operator === "-" ? -magnitude : magnitude;
    }
    return null;
}

// The chartlang `TablePosition` literal for a Pine `position.*` enum, or
// `null` when the arg is absent / not a member enum / unmapped.
function resolvePosition(arg: CallArgument | undefined): string | null {
    if (arg === undefined || arg.value.kind !== "member-access-expression") {
        return null;
    }
    const mapping = enumLookup(arg.value.chain.join("."));
    return mapping !== null && typeof mapping.chartlang === "string" ? mapping.chartlang : null;
}

// The Pine cell-styling named args this transform knows have no chartlang
// `TableCell` analogue.
const UNMAPPED_CELL_ARGS: ReadonlySet<string> = new Set([
    "text_formatting",
    "text_font_family",
    "text_wrap",
]);

// The chartlang source for a styling arg: a bare-rooted enum routes through
// `enumLookup`, everything else lowers via `emitExpr`.
function styleValueSource(node: ExpressionNode, annotations: AnnotationLookup): string {
    if (node.kind === "member-access-expression" && node.head === null) {
        const mapping = enumLookup(node.chain.join("."));
        if (mapping !== null && typeof mapping.chartlang === "string") {
            return JSON.stringify(mapping.chartlang);
        }
    }
    return emitExpr(node, annotations);
}

// The mutable per-table cell store, keyed `"<col>:<row>"`, last-write-wins.
type CellMap = Map<string, CellSpec>;

// The mutable accumulator the walk fills: collected cells + whether a
// `table.delete(handle)` was seen anywhere in the script.
type Collected = {
    readonly cells: CellMap;
    deleted: boolean;
};

function cellKey(col: number, row: number): string {
    return `${col}:${row}`;
}

// Apply one `table.cell(...)` or `table.cell_set_*(...)` write to the cell
// map. `col`/`row` are already resolved to literal ints (loop-substituted).
function applyWrite(
    cells: CellMap,
    member: string,
    call: CallExpression,
    col: number,
    row: number,
    annotations: AnnotationLookup,
    diagnostics: DiagnosticCollector,
): void {
    const key = cellKey(col, row);
    const existing = cells.get(key);
    const spec: CellSpec = existing ?? { text: '""', sourceSpan: call.span };
    spec.sourceSpan = call.span;
    const positional = positionalArgs(call.args);
    if (member === "cell") {
        const textArg = positional[3];
        if (textArg !== undefined) {
            spec.text = emitExpr(textArg.value, annotations);
        }
        applyCellNamedArgs(spec, call.args, annotations, diagnostics);
    } else {
        applyCellSetter(spec, member, positional[3], annotations);
    }
    cells.set(key, spec);
}

// Map a `table.cell_set_<field>` member to its `CellSpec` field.
function applyCellSetter(
    spec: CellSpec,
    member: string,
    valueArg: CallArgument | undefined,
    annotations: AnnotationLookup,
): void {
    if (valueArg === undefined) {
        return;
    }
    const value = styleValueSource(valueArg.value, annotations);
    switch (member) {
        case "cell_set_text":
            spec.text = emitExpr(valueArg.value, annotations);
            return;
        case "cell_set_bgcolor":
            spec.bgColor = value;
            return;
        case "cell_set_text_color":
            spec.textColor = value;
            return;
        case "cell_set_text_halign":
            spec.textHalign = value;
            return;
        case "cell_set_text_valign":
            spec.textValign = value;
            return;
        case "cell_set_text_size":
            spec.textSize = value;
            return;
        default:
            return;
    }
}

// Apply the named styling args of a `table.cell(...)` create call, warning
// once on each unmapped formatting arg.
function applyCellNamedArgs(
    spec: CellSpec,
    args: readonly CallArgument[],
    annotations: AnnotationLookup,
    diagnostics: DiagnosticCollector,
): void {
    for (const arg of args) {
        if (arg.name === null) {
            continue;
        }
        if (UNMAPPED_CELL_ARGS.has(arg.name)) {
            diagnostics.pushCode("table-formatting-not-mapped", arg.span);
            continue;
        }
        const value = styleValueSource(arg.value, annotations);
        switch (arg.name) {
            case "bgcolor":
                spec.bgColor = value;
                break;
            case "text_color":
                spec.textColor = value;
                break;
            case "text_halign":
                spec.textHalign = value;
                break;
            case "text_valign":
                spec.textValign = value;
                break;
            case "text_size":
                spec.textSize = value;
                break;
            default:
                break;
        }
    }
}

// The grid dimensions + viewport position of one converted table.
type TableShape = {
    readonly columns: number | null;
    readonly rows: number | null;
    readonly position: string;
};

// Read the `(position, columns, rows)` shape from the `table.new(...)` call.
function readShape(call: CallExpression): TableShape {
    const positional = positionalArgs(call.args);
    const columns = positional[1] === undefined ? null : literalInt(positional[1].value);
    const rows = positional[2] === undefined ? null : literalInt(positional[2].value);
    const position = resolvePosition(positional[0]) ?? "top-right";
    return { columns, rows, position };
}

// One straight-line statement-list scan, descending one level into `if` /
// `else if` / `else` / `for` bodies. `for` bodies with literal bounds unroll;
// non-literal bounds raise `table-dynamic-loop`.
function collectFromBody(
    body: readonly Statement[],
    handle: string,
    collected: Collected,
    annotations: AnnotationLookup,
    shape: TableShape,
    diagnostics: DiagnosticCollector,
): void {
    for (const stmt of body) {
        collectFromStatement(stmt, handle, collected, annotations, shape, diagnostics);
    }
}

function collectFromStatement(
    stmt: Statement,
    handle: string,
    collected: Collected,
    annotations: AnnotationLookup,
    shape: TableShape,
    diagnostics: DiagnosticCollector,
): void {
    if (stmt.kind === "expression-statement" && stmt.expression.kind === "call-expression") {
        recordWrite(stmt.expression, handle, collected, annotations, shape, diagnostics);
        return;
    }
    if (stmt.kind === "if-statement") {
        collectFromBody(stmt.thenBody.body, handle, collected, annotations, shape, diagnostics);
        for (const clause of stmt.elseIfClauses) {
            collectFromBody(clause.body.body, handle, collected, annotations, shape, diagnostics);
        }
        if (stmt.elseBody !== null) {
            collectFromBody(stmt.elseBody.body, handle, collected, annotations, shape, diagnostics);
        }
        return;
    }
    if (stmt.kind === "for-statement") {
        unrollLoop(stmt, handle, collected, annotations, shape, diagnostics);
    }
}

// Unroll a literal-bounded `for i = from to to` loop, substituting the
// iterator value into each cell write. A non-literal bound is a hard error.
function unrollLoop(
    stmt: Extract<Statement, { kind: "for-statement" }>,
    handle: string,
    collected: Collected,
    annotations: AnnotationLookup,
    shape: TableShape,
    diagnostics: DiagnosticCollector,
): void {
    const writesHandle = stmt.body.body.some(
        (inner) =>
            inner.kind === "expression-statement" &&
            inner.expression.kind === "call-expression" &&
            isTableWrite(inner.expression, handle),
    );
    if (!writesHandle) {
        return;
    }
    const from = literalInt(stmt.from);
    const to = literalInt(stmt.to);
    const step = stmt.step === null ? 1 : literalInt(stmt.step);
    if (from === null || to === null || step === null || step === 0) {
        diagnostics.pushCode("table-dynamic-loop", stmt.span);
        return;
    }
    // Pine auto-counts down when `from > to`; `by` contributes only magnitude.
    const ascending = from <= to;
    const magnitude = Math.abs(step);
    const stepDelta = ascending ? magnitude : -magnitude;
    for (let i = from; ascending ? i <= to : i >= to; i += stepDelta) {
        for (const inner of stmt.body.body) {
            if (
                inner.kind === "expression-statement" &&
                inner.expression.kind === "call-expression"
            ) {
                const substituted = substituteCall(inner.expression, stmt.variable, i);
                recordWrite(substituted, handle, collected, annotations, shape, diagnostics);
            }
        }
    }
}

// Substitute the loop iterator across every argument of a call.
function substituteCall(call: CallExpression, variable: string, value: number): CallExpression {
    return {
        ...call,
        args: call.args.map((arg) => ({
            ...arg,
            value: substituteIterator(arg.value, variable, value),
        })),
    };
}

// Whether a call is a `table.cell`/`table.cell_set_*` write against `handle`.
function isTableWrite(call: CallExpression, handle: string): boolean {
    const name = dottedCallee(call);
    if (name === null || targetHandleName(call) !== handle) {
        return false;
    }
    return name === "table.cell" || name.startsWith("table.cell_set_");
}

// Record one `table.cell`/`cell_set_*`/`merge_cells`/`clear`/`delete` call.
function recordWrite(
    call: CallExpression,
    handle: string,
    collected: Collected,
    annotations: AnnotationLookup,
    shape: TableShape,
    diagnostics: DiagnosticCollector,
): void {
    const name = dottedCallee(call);
    if (name === null || targetHandleName(call) !== handle) {
        return;
    }
    if (name === "table.delete") {
        collected.deleted = true;
        return;
    }
    if (name === "table.merge_cells") {
        applyMerge(call, collected.cells, diagnostics);
        return;
    }
    if (name === "table.clear") {
        diagnostics.pushCode("table-clear-noop", call.span);
        return;
    }
    if (name !== "table.cell" && !name.startsWith("table.cell_set_")) {
        return;
    }
    const positional = positionalArgs(call.args);
    const col = positional[1] === undefined ? null : literalInt(positional[1].value);
    const row = positional[2] === undefined ? null : literalInt(positional[2].value);
    if (col === null || row === null) {
        return;
    }
    if (
        (shape.columns !== null && col >= shape.columns) ||
        (shape.rows !== null && row >= shape.rows)
    ) {
        diagnostics.pushCode("table-cell-out-of-bounds", call.span);
        return;
    }
    const member = name.slice("table.".length);
    applyWrite(collected.cells, member, call, col, row, annotations, diagnostics);
}

// Blank every cell of a merged span except the top-left, with one warning
// per `merge_cells` call.
function applyMerge(call: CallExpression, cells: CellMap, diagnostics: DiagnosticCollector): void {
    const positional = positionalArgs(call.args);
    const c0 = positional[1] === undefined ? null : literalInt(positional[1].value);
    const r0 = positional[2] === undefined ? null : literalInt(positional[2].value);
    const c1 = positional[3] === undefined ? null : literalInt(positional[3].value);
    const r1 = positional[4] === undefined ? null : literalInt(positional[4].value);
    diagnostics.pushCode("table-merge-fallback", call.span);
    if (c0 === null || r0 === null || c1 === null || r1 === null) {
        return;
    }
    for (let col: number = c0; col <= c1; col += 1) {
        for (let row: number = r0; row <= r1; row += 1) {
            if (col === c0 && row === r0) {
                continue;
            }
            cells.set(cellKey(col, row), { text: '""', sourceSpan: call.span });
        }
    }
}

// Render one cell's source from its `CellSpec`, or the empty cell literal.
function renderCell(spec: CellSpec | undefined): string {
    if (spec === undefined) {
        return '{ text: "" }';
    }
    const parts: string[] = [`text: ${spec.text}`];
    if (spec.bgColor !== undefined) {
        parts.push(`bgColor: ${spec.bgColor}`);
    }
    if (spec.textColor !== undefined) {
        parts.push(`textColor: ${spec.textColor}`);
    }
    if (spec.textHalign !== undefined) {
        parts.push(`textHalign: ${spec.textHalign}`);
    }
    if (spec.textValign !== undefined) {
        parts.push(`textValign: ${spec.textValign}`);
    }
    if (spec.textSize !== undefined) {
        parts.push(`textSize: ${spec.textSize}`);
    }
    return `{ ${parts.join(", ")} }`;
}

// The grid extent: the declared `(columns, rows)` when present, else the max
// observed `(col, row)` + 1 so every written cell fits.
function gridExtent(cells: CellMap, shape: TableShape): { columns: number; rows: number } {
    let maxCol = 0;
    let maxRow = 0;
    for (const key of cells.keys()) {
        const parts = key.split(":");
        const col = Number.parseInt(parts[0], 10);
        const row = Number.parseInt(parts[1], 10);
        maxCol = Math.max(maxCol, col + 1);
        maxRow = Math.max(maxRow, row + 1);
    }
    return {
        columns: shape.columns ?? maxCol,
        rows: shape.rows ?? maxRow,
    };
}

// Render the `cells: [[…], …]` 2D array literal: `rows × columns`, in
// row-major order.
function renderCells(cells: CellMap, shape: TableShape): string {
    const { columns, rows } = gridExtent(cells, shape);
    const rowLiterals: string[] = [];
    for (let row = 0; row < rows; row += 1) {
        const rowCells: string[] = [];
        for (let col = 0; col < columns; col += 1) {
            rowCells.push(renderCell(cells.get(cellKey(col, row))));
        }
        rowLiterals.push(`[${rowCells.join(", ")}]`);
    }
    return `[${rowLiterals.join(", ")}]`;
}

// One converted table: its `table.new` call-site and the resolved Pine
// handle name.
type TableEntry = Readonly<{ call: CallExpression; handle: string; span: SourceSpan }>;

// The `table.new` camp-a sites, grouped to one entry per handle name (first
// site wins; later inits raise `table-multi-init`).
function tableSites(analysis: SemanticResult, diagnostics: DiagnosticCollector): TableEntry[] {
    const byHandle = new Map<string, TableEntry>();
    for (const site of analysis.drawingSites) {
        if (site.camp.kind !== "camp-a" || site.constructor !== "table.new") {
            continue;
        }
        const handle = site.camp.handleSymbol.name;
        if (byHandle.has(handle)) {
            diagnostics.pushCode("table-multi-init", site.span);
            continue;
        }
        byHandle.set(handle, { call: site.call, handle, span: site.span });
    }
    return [...byHandle.values()];
}

/**
 * Lower every Pine table builder (`table.new` + `table.cell` +
 * `table.cell_set_*` + `table.merge_cells` + `table.clear` +
 * `table.delete`) into chartlang's immutable `draw.table({ position, cells
 * })`. Each `var table`/`varip table` handle becomes a persistent
 * {@link handleSlotLocalName} slot; the collected `(col, row)` cell writes
 * (last-write-wins, loops unrolled) render to a `rows × columns` 2D array
 * literal, and the table is rebuilt each `barstate.islast` tick.
 *
 * `merge_cells` keeps the top-left cell and blanks the span (warning);
 * `clear` is a rebuild-each-bar no-op (info); `delete` emits the
 * slot-clear pattern. The `other` drawing bucket cap is widened to the
 * table count. Mutates the scaffold + diagnostics collector; Task 16
 * codegen reads `scaffold.handleSlots` + `scaffold.computeBody`.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { lex } from "../lexer/index.js";
 *     import { parseStatements } from "../parser/index.js";
 *     import { analyze } from "../semantic/index.js";
 *     import { DiagnosticCollector } from "./diagnosticCollector.js";
 *     import { transformDeclaration } from "./declaration.js";
 *     import { transformTables } from "./tables.js";
 *     const src =
 *         "//@version=6\nindicator(\"X\")\n" +
 *         "var table t = na\nif barstate.islast\n" +
 *         "    t := table.new(position.top_right, 1, 1)\n" +
 *         "    table.cell(t, 0, 0, \"hi\")\nplot(close)\n";
 *     const analysis = analyze(parseStatements(lex(src).tokens).script);
 *     const decl = analysis.script.declaration;
 *     if (decl !== null && decl.kind === "indicator-declaration") {
 *         const diagnostics = new DiagnosticCollector();
 *         const scaffold = transformDeclaration(decl, analysis, diagnostics);
 *         transformTables(analysis, scaffold, diagnostics);
 *         void scaffold.handleSlots; // [{ name: "__t_handle", kind: "table" }]
 *     }
 */
export function transformTables(
    analysis: SemanticResult,
    scaffold: ScriptScaffold,
    diagnostics: DiagnosticCollector,
): void {
    const sites = tableSites(analysis, diagnostics);
    if (sites.length === 0) {
        return;
    }
    const currentCap = scaffold.maxDrawings.other ?? 0;
    if (currentCap < sites.length + 1) {
        scaffold.maxDrawings.other = sites.length + 1;
        diagnostics.pushCode("table-bucket-cap-adjusted", sites[0].span);
    }
    for (const site of sites) {
        emitTable(site, analysis, scaffold, diagnostics);
    }
}

// Lower one table site into its handle slot + rebuild statements.
function emitTable(
    entry: TableEntry,
    analysis: SemanticResult,
    scaffold: ScriptScaffold,
    diagnostics: DiagnosticCollector,
): void {
    const handle = entry.handle;
    const local = handleSlotLocalName(handle);
    appendHandleSlot(scaffold, { name: local, kind: "table" });

    const shape = readShape(entry.call);
    const collected: Collected = { cells: new Map(), deleted: false };
    collectFromBody(
        analysis.script.body,
        handle,
        collected,
        analysis.annotations,
        shape,
        diagnostics,
    );

    const cellsSource = renderCells(collected.cells, shape);
    appendComputeStatement(scaffold, `const ${local}_cells = ${cellsSource};`);
    appendComputeStatement(
        scaffold,
        `if (barstate.islast) { ${local}.current()?.remove(); ` +
            `${local}.set(draw.table({ position: ${JSON.stringify(shape.position)}, ` +
            `cells: ${local}_cells })); }`,
    );

    if (collected.deleted) {
        appendComputeStatement(scaffold, `${local}.current()?.remove();`);
        appendComputeStatement(scaffold, `${local}.set(null);`);
    }
}

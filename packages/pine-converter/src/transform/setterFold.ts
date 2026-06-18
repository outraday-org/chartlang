// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallExpression, ExpressionNode } from "../ast/index.js";
import type { ChartlangSetter } from "../mapping/index.js";
import { drawingLookup, enumLookup } from "../mapping/index.js";
import type { HandleType } from "../semantic/index.js";
import { dottedCallee } from "./callArgs.js";
import { convertColor } from "./colorConvert.js";
import { anchorToWorldPoint, resolveAnchorExpr } from "./coordinates.js";
import type { AnnotationLookup } from "./exprEmit.js";
import { emitExpr } from "./exprEmit.js";

/**
 * One observed Pine setter call against a drawing handle: the setter
 * member (`"set_xy1"`, `"set_color"`, …) and its `CallExpression`. The
 * fold consumes these in source order, later setters overriding earlier
 * ones at the same path.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const call: import("../ast/index.js").CallExpression;
 *     const s: SetterCall = { method: "set_color", call };
 *     void s;
 */
export type SetterCall = Readonly<{
    method: string;
    call: CallExpression;
}>;

/**
 * The diagnostics callback the fold raises when a setter cannot be
 * represented in the chartlang `Partial<DrawingState>` patch — currently
 * only the deep single-coordinate setters (`set_x1`/`set_y1`/…), which
 * cannot patch one element of an `anchors` tuple through the runtime's
 * shallow merge.
 *
 * @since 0.1
 * @stable
 * @example
 *     const warn: SetterWarn = () => {};
 *     void warn;
 */
export type SetterWarn = (
    code: "set-path-unsupported" | "partial-anchor-filled",
    node: ExpressionNode,
) => void;

// The Pine drawing-family key (`"line"`) → the constructor key
// (`"line.new"`) the mapping table is keyed by.
const CONSTRUCTOR_KEY: ReadonlyMap<HandleType, string> = new Map([
    ["line", "line.new"],
    ["label", "label.new"],
    ["box", "box.new"],
    ["table", "table.new"],
    ["polyline", "polyline.new"],
]);

/**
 * Render a chartlang enum target — a string literal (`"dashed"`), a
 * partial-state object (`extend.both` → `{ extendLeft, extendRight }`), or
 * the REJECT `null` — to source, returning `null` for the REJECT. Exported
 * for direct coverage of all three target shapes (real `enumLookup` never
 * surfaces the `null` arm through {@link foldSetters}, but the renderer
 * handles it so the contract is total).
 *
 * @since 0.1
 * @stable
 * @example
 *     import { renderEnumTarget } from "./setterFold.js";
 *     renderEnumTarget("dashed"); // '"dashed"'
 *     renderEnumTarget({ extendLeft: true }); // "{ extendLeft: true }"
 *     renderEnumTarget(null); // null
 */
export function renderEnumTarget(
    target: string | Readonly<Record<string, unknown>> | null,
): string | null {
    if (target === null) {
        return null;
    }
    if (typeof target === "string") {
        return JSON.stringify(target);
    }
    const fields = Object.entries(target).map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
    return `{ ${fields.join(", ")} }`;
}

// The chartlang source for a setter argument: a `color.new(base, transp)`
// call folds to a hex-alpha string (so `set_bgcolor` does not leak the
// undefined `color` namespace); a member-chain enum routes through
// `enumLookup` (string literal or partial-object); everything else lowers via
// `emitExpr`. Returns `null` when the enum has no analogue.
function setterValueSource(node: ExpressionNode, annotations: AnnotationLookup): string | null {
    if (node.kind === "call-expression" && dottedCallee(node) === "color.new") {
        return convertColor(node, annotations);
    }
    if (node.kind === "member-access-expression" && node.head === null) {
        const mapping = enumLookup(node.chain.join("."));
        if (mapping === null) {
            return null;
        }
        return renderEnumTarget(mapping.chartlang);
    }
    return emitExpr(node, annotations);
}

// Build a `{ time: …, price: … }` source from a whole-anchor setter's two
// positional value args (the handle is arg 0). The `(x, y)` pair routes
// through the coordinate resolver so `bar_index`-mode setters lower their x
// to `bar.time` arithmetic, identically to the `.new()` constructor anchors.
function wholeAnchorSource(call: CallExpression, annotations: AnnotationLookup): string {
    const values = call.args.filter((arg) => arg.name === null).slice(1);
    const xExpr = values[0];
    const yExpr = values[1];
    if (xExpr === undefined || yExpr === undefined) {
        return "{ time: bar.time, price: Number.NaN }";
    }
    return anchorToWorldPoint(resolveAnchorExpr(xExpr.value, yExpr.value, annotations));
}

// A nested patch builder: stores values at a dotted path inside a tree of
// plain records, then renders the tree to an object-literal source string.
type PatchTree = Map<string, string | PatchTree>;

function setPath(tree: PatchTree, path: readonly (string | number)[], value: string): void {
    const head = String(path[0]);
    if (path.length === 1) {
        tree.set(head, value);
        return;
    }
    const existing = tree.get(head);
    const child: PatchTree = existing instanceof Map ? existing : new Map();
    tree.set(head, child);
    setPath(child, path.slice(1), value);
}

// Render a leaf object (the `style` sub-tree): all chartlang setter
// `statePath`s are at most two deep, so a nested object only ever holds
// string leaves (`{ color: "#…", lineWidth: 3 }`).
function renderLeafObject(tree: PatchTree): string {
    const parts: string[] = [];
    for (const [key, value] of tree) {
        parts.push(`${key}: ${String(value)}`);
    }
    return `{ ${parts.join(", ")} }`;
}

// Render the top-level patch, special-casing the `anchors` index map into a
// positional array so `["anchors", 0]` + `["anchors", 1]` collapse to
// `anchors: [a, b]`. The runtime `update(patch)` shallow-merge REPLACES the
// whole `anchors` tuple, so a partial move (only `set_xy1`) must still emit a
// complete tuple: any index the setters did not move is filled from
// `anchorDefaults` (the creation expression). Without the fill a length-1
// `anchors: [a]` would fail the adapter's "2-element WorldPoint tuple" check.
function renderPatch(tree: PatchTree, anchorDefaults: readonly string[]): string {
    const parts: string[] = [];
    for (const [key, value] of tree) {
        if (key === "anchors" && value instanceof Map) {
            parts.push(`anchors: [${renderAnchorArray(value, anchorDefaults).join(", ")}]`);
            continue;
        }
        const rendered = value instanceof Map ? renderLeafObject(value) : value;
        parts.push(`${key}: ${rendered}`);
    }
    return `{ ${parts.join(", ")} }`;
}

// The positional anchor elements for a patch: each index in `0..arity` uses
// the moved value when a setter supplied it, else the creation default.
// `arity` is the create-call anchor count (`anchorDefaults.length`); a stray
// index past it (defensive — the parser never produces `set_xy3`) appends in
// sorted order. Anchor index entries are always whole-anchor strings, never
// nested maps (the deep `["anchors", N, …]` setters are dropped earlier).
function renderAnchorArray(value: PatchTree, anchorDefaults: readonly string[]): string[] {
    if (anchorDefaults.length === 0) {
        return [...value.entries()]
            .sort(([a], [b]) => Number.parseInt(a, 10) - Number.parseInt(b, 10))
            .map(([, element]) => String(element));
    }
    return anchorDefaults.map((fallback, index) => {
        const moved = value.get(String(index));
        return moved === undefined ? fallback : String(moved);
    });
}

// Whether the `anchors` patch is a partial move — at least one index was set
// but not all `arity` of them — so the renderer will fill from the creation
// expression and the caller should raise `partial-anchor-filled`.
function isPartialAnchorMove(tree: PatchTree, arity: number): boolean {
    const anchors = tree.get("anchors");
    return anchors instanceof Map && arity > 0 && anchors.size > 0 && anchors.size < arity;
}

// The chartlang setter spec for one Pine setter member against a handle
// family, or `null` when the constructor / member is unmapped.
function setterSpec(handleType: HandleType, method: string): ChartlangSetter | null {
    const constructorKey = CONSTRUCTOR_KEY.get(handleType);
    if (constructorKey === undefined) {
        return null;
    }
    const mapping = drawingLookup(constructorKey);
    return mapping?.setterMap.get(method) ?? null;
}

/**
 * Fold a source-ordered list of Pine drawing setters against one handle
 * into a single chartlang `Partial<DrawingState>` patch-object source
 * string for `handle.update({...})`, or `null` when nothing folds.
 *
 * Whole-anchor setters (`set_xy1`/`set_xy2`, `statePath` `["anchors", N]`)
 * collapse into an `anchors: [a, b]` array; style setters
 * (`["style", "color"]`, …) nest under `style`; `set_text` patches `body`.
 * Deep single-coordinate setters (`["anchors", N, "time"|"price"]`) cannot
 * be merged into the tuple and are dropped with `set-path-unsupported`.
 * Later setters override earlier ones at the same path. The same fold backs
 * Camp A and Camp B.
 *
 * `anchorDefaults` is the create-call's resolved anchor source list
 * ({@link import("./handleSlot.js").drawCallAnchors}); a partial whole-anchor
 * move (only `set_xy1`) fills the un-moved index from it so the emitted patch
 * is always a complete tuple, raising `partial-anchor-filled` once.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { foldSetters } from "./setterFold.js";
 *     declare const setters: readonly import("./setterFold.js").SetterCall[];
 *     foldSetters(setters, "line", new Map(), () => {}, []);
 */
export function foldSetters(
    setters: readonly SetterCall[],
    handleType: HandleType,
    annotations: AnnotationLookup,
    warn: SetterWarn,
    anchorDefaults: readonly string[] = [],
): string | null {
    const tree: PatchTree = new Map();
    let any = false;
    let firstAnchorSetter: CallExpression | null = null;
    for (const setter of setters) {
        const spec = setterSpec(handleType, setter.method);
        if (spec === null) {
            continue;
        }
        if (spec.statePath.length === 3) {
            warn("set-path-unsupported", setter.call);
            continue;
        }
        const last = spec.statePath[spec.statePath.length - 1];
        const isWholeAnchor =
            spec.statePath[0] === "anchors" && typeof last === "number" && spec.arity === 2;
        const valueArgs = setter.call.args.filter((arg) => arg.name === null).slice(1);
        let value: string | null;
        if (isWholeAnchor) {
            value = wholeAnchorSource(setter.call, annotations);
        } else if (valueArgs.length === 0) {
            value = null;
        } else {
            value = setterValueSource(valueArgs[0].value, annotations);
        }
        if (value === null) {
            continue;
        }
        if (isWholeAnchor && firstAnchorSetter === null) {
            firstAnchorSetter = setter.call;
        }
        setPath(tree, spec.statePath, value);
        any = true;
    }
    if (!any) {
        return null;
    }
    if (firstAnchorSetter !== null && isPartialAnchorMove(tree, anchorDefaults.length)) {
        warn("partial-anchor-filled", firstAnchorSetter);
    }
    return renderPatch(tree, anchorDefaults);
}

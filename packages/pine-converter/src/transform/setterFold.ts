// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallExpression, ExpressionNode } from "../ast/index.js";
import type { ChartlangSetter } from "../mapping/index.js";
import { drawingLookup, enumLookup } from "../mapping/index.js";
import type { HandleType } from "../semantic/index.js";
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
 * @experimental
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
 * @experimental
 * @example
 *     const warn: SetterWarn = () => {};
 *     void warn;
 */
export type SetterWarn = (code: "set-path-unsupported", node: ExpressionNode) => void;

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
 * @experimental
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

// The chartlang source for a setter argument: a member-chain enum routes
// through `enumLookup` (string literal or partial-object), everything else
// lowers via `emitExpr`. Returns `null` when the enum has no analogue.
function setterValueSource(node: ExpressionNode, annotations: AnnotationLookup): string | null {
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
// `anchors: [a, b]`.
function renderPatch(tree: PatchTree): string {
    const parts: string[] = [];
    for (const [key, value] of tree) {
        if (key === "anchors" && value instanceof Map) {
            const sorted = [...value.entries()].sort(
                ([a], [b]) => Number.parseInt(a, 10) - Number.parseInt(b, 10),
            );
            // Anchor index entries are always whole-anchor strings, never
            // nested maps (the deep `["anchors", N, …]` setters are dropped).
            const elements = sorted.map(([, element]) => String(element));
            parts.push(`anchors: [${elements.join(", ")}]`);
            continue;
        }
        const rendered = value instanceof Map ? renderLeafObject(value) : value;
        parts.push(`${key}: ${rendered}`);
    }
    return `{ ${parts.join(", ")} }`;
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
 * @since 0.1
 * @experimental
 * @example
 *     import { foldSetters } from "./setterFold.js";
 *     declare const setters: readonly import("./setterFold.js").SetterCall[];
 *     foldSetters(setters, "line", new Map(), () => {});
 */
export function foldSetters(
    setters: readonly SetterCall[],
    handleType: HandleType,
    annotations: AnnotationLookup,
    warn: SetterWarn,
): string | null {
    const tree: PatchTree = new Map();
    let any = false;
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
        setPath(tree, spec.statePath, value);
        any = true;
    }
    return any ? renderPatch(tree) : null;
}

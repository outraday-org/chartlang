// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { PlotKind } from "@invinite-org/chartlang-core";
import ts from "typescript";

const PLOT_KINDS: ReadonlySet<PlotKind> = new Set<PlotKind>([
    "line",
    "step-line",
    "horizontal-line",
    "histogram",
    "area",
    "filled-band",
    "label",
    "marker",
    "shape",
    "character",
    "arrow",
    "candle-override",
    "bar-override",
    "bg-color",
    "bar-color",
    "horizontal-histogram",
]);

function isPlotKind(value: string): value is PlotKind {
    return (PLOT_KINDS as ReadonlySet<string>).has(value);
}

function findProperty(
    obj: ts.ObjectLiteralExpression,
    name: string,
): ts.PropertyAssignment | undefined {
    for (const property of obj.properties) {
        if (
            ts.isPropertyAssignment(property) &&
            ts.isIdentifier(property.name) &&
            property.name.text === name
        ) {
            return property;
        }
    }
    return undefined;
}

/**
 * Derive the statically-known {@link PlotKind} for a plotting callsite from
 * its callee name and opts argument. The chartlang plot surface has no
 * `plot.*` member API — the kind is selected at the callsite via the opts
 * object literal's `style.kind` property (mirrored by the runtime's
 * `buildStyle`). Returns:
 *
 * - `"horizontal-line"` for `hline`.
 * - `"line"` for a bare `plot` with no `style` (no opts, opts without
 *   `style`, or a non-object opts).
 * - the literal `style.kind` value for `plot(x, { style: { kind: "<lit>" } })`
 *   when it is a string literal naming a `PlotKind` member.
 * - `undefined` when the kind is not statically determinable: a dynamic
 *   `style` (`{ style: someVar }`), a dynamic `kind` (`{ style: { kind:
 *   someVar } }`), or a string literal that is not a `PlotKind` member.
 *   The caller falls back to `"line"` (best-effort) so the slot is still
 *   listed.
 *
 * @since 0.8
 * @example
 *     // const kind = plotKindFromCallsite("plot", optsObjectLiteralNode);
 *     // kind === "histogram" | "line" | undefined | ...
 *     const fn: typeof plotKindFromCallsite = plotKindFromCallsite;
 *     void fn;
 */
export function plotKindFromCallsite(
    calleeName: string,
    optsArg: ts.Expression | undefined,
): PlotKind | undefined {
    if (calleeName === "hline") return "horizontal-line";
    if (calleeName !== "plot") return undefined;
    if (optsArg === undefined || !ts.isObjectLiteralExpression(optsArg)) return "line";
    const styleProp = findProperty(optsArg, "style");
    if (styleProp === undefined) return "line";
    const style = styleProp.initializer;
    if (!ts.isObjectLiteralExpression(style)) return undefined;
    const kindProp = findProperty(style, "kind");
    if (kindProp === undefined) return undefined;
    const kind = kindProp.initializer;
    if (!ts.isStringLiteral(kind)) return undefined;
    return isPlotKind(kind.text) ? kind.text : undefined;
}

/**
 * Read a string-literal `title` from a plotting callsite's opts object
 * literal. Returns `undefined` for a missing, dynamic, or non-string
 * `title` so the manifest omits the field rather than recording a
 * placeholder.
 *
 * @since 0.8
 * @example
 *     // const title = readLiteralTitle(optsObjectLiteralNode);
 *     // title === "Vol" | undefined
 *     const fn: typeof readLiteralTitle = readLiteralTitle;
 *     void fn;
 */
export function readLiteralTitle(optsArg: ts.Expression | undefined): string | undefined {
    if (optsArg === undefined || !ts.isObjectLiteralExpression(optsArg)) return undefined;
    const titleProp = findProperty(optsArg, "title");
    if (titleProp === undefined) return undefined;
    const title = titleProp.initializer;
    return ts.isStringLiteral(title) ? title.text : undefined;
}

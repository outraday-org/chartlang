// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ExpressionNode } from "../ast/index.js";
import type { Argument } from "../ast/script.js";
import type { DiagnosticCollector } from "./diagnosticCollector.js";
import type { MaxDrawingsIR, ScaffoldFormat, ScaffoldScale } from "./ir.js";

/**
 * The resolved chartlang options extracted from a Pine `indicator(...)` /
 * `strategy(...)` argument list. `null` fields fall back to chartlang's
 * defaults; the `maxDrawings` buckets carry Pine's `max_*_count` budgets.
 * `name` is `null` when no usable title was found (the caller supplies the
 * fallback).
 *
 * @since 0.1
 * @stable
 * @example
 *     const o: ScaffoldOptions = {
 *         name: "Hello",
 *         shortName: null,
 *         overlay: true,
 *         format: null,
 *         precision: null,
 *         scale: null,
 *         maxDrawings: { lines: 20 },
 *         maxBarsBack: null,
 *     };
 *     void o;
 */
export type ScaffoldOptions = Readonly<{
    name: string | null;
    shortName: string | null;
    overlay: boolean | null;
    format: ScaffoldFormat | null;
    precision: number | null;
    scale: ScaffoldScale | null;
    maxDrawings: MaxDrawingsIR;
    maxBarsBack: number | null;
}>;

/**
 * Fallback name used when the Pine title is missing or computed. Exposed so
 * the transform and its tests agree on the sentinel.
 *
 * @since 0.1
 * @stable
 * @example
 *     FALLBACK_INDICATOR_NAME; // "<unknown>"
 */
export const FALLBACK_INDICATOR_NAME = "<unknown>";

// Pine's default per-bucket cap when a `max_*_count` arg is omitted, copied
// through to preserve the GC behaviour.
const BUCKET_DEFAULT_CAP = 50;

// Per-bucket chartlang caps. A Pine value above the cap is clamped + warned.
const BUCKET_CAP: Readonly<Record<keyof MaxDrawingsIR, number>> = {
    lines: 500,
    labels: 500,
    boxes: 500,
    polylines: 100,
    other: 500,
};

// Pine `max_*_count` arg name → chartlang `maxDrawings` bucket.
const MAX_COUNT_ARGS: ReadonlyMap<string, keyof MaxDrawingsIR> = new Map([
    ["max_lines_count", "lines"],
    ["max_labels_count", "labels"],
    ["max_boxes_count", "boxes"],
    ["max_polylines_count", "polylines"],
]);

// Pine `format.*` member name → narrowed chartlang format (or `null` when the
// member maps to the chartlang default).
const FORMAT_MEMBERS: ReadonlyMap<string, ScaffoldFormat | null> = new Map([
    ["format.price", "price"],
    ["format.percent", "percent"],
    ["format.volume", "volume"],
    ["format.inherit", null],
]);

// Pine `scale.*` member name → narrowed chartlang scale (or `null`).
const SCALE_MEMBERS: ReadonlyMap<string, ScaffoldScale | null> = new Map([
    ["scale.left", "left"],
    ["scale.right", "right"],
    ["scale.none", null],
]);

// Args carried by `indicator(...)` that chartlang has no analogue for; each
// raises one `indicator-arg-not-mapped` warning.
const UNMAPPED_ARGS: ReadonlySet<string> = new Set([
    "timeframe",
    "timeframe_gaps",
    "dynamic_requests",
    "linktoseries",
    "process_orders_on_close",
    "behind_chart",
]);

// Args that chartlang already satisfies by default — recognized as a no-op
// rather than dropped with a warning. `explicit_plot_zorder` makes Pine's plot
// declaration order authoritative, which is chartlang's default (marks layer by
// declaration order within their group), so the flag needs no chartlang option;
// each member emits one `explicit-plot-zorder-default` info note. Keep this set
// disjoint from {@link UNMAPPED_ARGS}.
const RECOGNIZED_NOOP_ARGS: ReadonlySet<string> = new Set(["explicit_plot_zorder"]);

function stringLiteral(node: ExpressionNode): string | null {
    if (node.kind === "literal-expression" && node.literalKind === "string") {
        // Pine string literals carry their surrounding quotes in `value`.
        return node.value.slice(1, -1);
    }
    return null;
}

function boolLiteral(node: ExpressionNode): boolean | null {
    if (node.kind === "literal-expression" && node.literalKind === "bool") {
        return node.value === "true";
    }
    return null;
}

function intLiteral(node: ExpressionNode): number | null {
    if (node.kind === "literal-expression" && node.literalKind === "int") {
        return Number.parseInt(node.value, 10);
    }
    return null;
}

function memberName(node: ExpressionNode): string | null {
    if (node.kind === "member-access-expression" && node.head === null) {
        return node.chain.join(".");
    }
    return null;
}

// The positional title (first positional arg) or the named `title` arg.
function titleArg(args: readonly Argument[]): Argument | null {
    const named = args.find((arg) => arg.name === "title");
    if (named !== undefined) {
        return named;
    }
    return args.find((arg) => arg.name === null) ?? null;
}

type MutableOptions = {
    name: string | null;
    shortName: string | null;
    overlay: boolean | null;
    format: ScaffoldFormat | null;
    precision: number | null;
    scale: ScaffoldScale | null;
    maxDrawings: MaxDrawingsIR;
    maxBarsBack: number | null;
};

function resolveTitle(args: readonly Argument[], diagnostics: DiagnosticCollector): string | null {
    const arg = titleArg(args);
    if (arg === null) {
        return null;
    }
    const literal = stringLiteral(arg.value);
    if (literal === null) {
        diagnostics.pushCode("computed-indicator-title", arg.span);
        return null;
    }
    return literal;
}

function applyMaxCount(
    bucket: keyof MaxDrawingsIR,
    arg: Argument,
    out: MutableOptions,
    diagnostics: DiagnosticCollector,
): void {
    const value = intLiteral(arg.value);
    if (value === null) {
        return;
    }
    const cap = BUCKET_CAP[bucket];
    if (value > cap) {
        diagnostics.pushCode("max-count-out-of-range", arg.span);
        out.maxDrawings[bucket] = cap;
        return;
    }
    out.maxDrawings[bucket] = value;
}

function applyNamedArg(arg: Argument, out: MutableOptions, diagnostics: DiagnosticCollector): void {
    const name = arg.name;
    if (name === null || name === "title") {
        return;
    }

    const bucket = MAX_COUNT_ARGS.get(name);
    if (bucket !== undefined) {
        applyMaxCount(bucket, arg, out, diagnostics);
        return;
    }

    switch (name) {
        case "shorttitle":
            out.shortName = stringLiteral(arg.value);
            return;
        case "overlay":
            out.overlay = boolLiteral(arg.value);
            return;
        case "precision":
            out.precision = intLiteral(arg.value);
            return;
        case "max_bars_back":
            out.maxBarsBack = intLiteral(arg.value);
            return;
        case "format": {
            const member = memberName(arg.value);
            if (member !== null && FORMAT_MEMBERS.has(member)) {
                const mapped = FORMAT_MEMBERS.get(member) ?? null;
                out.format = mapped;
                if (mapped === null) {
                    diagnostics.pushCode("indicator-arg-not-mapped", arg.span);
                }
            }
            return;
        }
        case "scale": {
            const member = memberName(arg.value);
            if (member !== null && SCALE_MEMBERS.has(member)) {
                const mapped = SCALE_MEMBERS.get(member) ?? null;
                out.scale = mapped;
                if (mapped === null) {
                    diagnostics.pushCode("indicator-arg-not-mapped", arg.span);
                }
            }
            return;
        }
        default:
            if (RECOGNIZED_NOOP_ARGS.has(name)) {
                diagnostics.pushCode("explicit-plot-zorder-default", arg.span);
            } else if (UNMAPPED_ARGS.has(name)) {
                diagnostics.pushCode("indicator-arg-not-mapped", arg.span);
            }
            return;
    }
}

/**
 * Map a Pine `indicator(...)` / `strategy(...)` argument list onto the
 * chartlang {@link ScaffoldOptions}, raising the §2 warnings/errors into
 * `diagnostics`. Omitted `max_*_count` buckets default to Pine's per-bucket
 * cap (50) so the converted script preserves the GC behaviour. A computed
 * (non-literal) title yields `name === null`; the caller substitutes the
 * fallback name. Strategy-only args (`initial_capital`, etc.) fall through
 * the `default` arm and are silently dropped. `explicit_plot_zorder` is a
 * recognized no-op — chartlang already orders marks by declaration order, so
 * the flag is satisfied by default and emits one `explicit-plot-zorder-default`
 * info note rather than an `indicator-arg-not-mapped` warning.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { DiagnosticCollector } from "./diagnosticCollector.js";
 *     const diagnostics = new DiagnosticCollector();
 *     const span = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 };
 *     const opts = mapDeclarationArgs(
 *         [{ name: null, value: { kind: "literal-expression", literalKind: "string", value: '"X"', span }, span }],
 *         diagnostics,
 *     );
 *     opts.name; // "X"
 */
export function mapDeclarationArgs(
    args: readonly Argument[],
    diagnostics: DiagnosticCollector,
): ScaffoldOptions {
    const out: MutableOptions = {
        name: resolveTitle(args, diagnostics),
        shortName: null,
        overlay: null,
        format: null,
        precision: null,
        scale: null,
        maxDrawings: {
            lines: BUCKET_DEFAULT_CAP,
            labels: BUCKET_DEFAULT_CAP,
            boxes: BUCKET_DEFAULT_CAP,
            polylines: BUCKET_DEFAULT_CAP,
        },
        maxBarsBack: null,
    };

    for (const arg of args) {
        applyNamedArg(arg, out, diagnostics);
    }

    return out;
}

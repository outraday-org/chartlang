// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingCallSite } from "../semantic/index.js";

/**
 * The classification context a Camp C reject suggestion is templated over:
 * the offending `.new()` call-site, the Pine collection identifier the site
 * draws into (`null` when none was resolvable), and the capacity a heuristic
 * almost recovered (`null` when no cap could be inferred). Threaded into a
 * {@link SuggestionFn} so a reject message names the specific collection and
 * `K` instead of a generic placeholder.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const site: import("../semantic/index.js").DrawingCallSite;
 *     const ctx: CampCContext = { site, collectionName: "lvls", inferredCap: 30 };
 *     void ctx;
 */
export type CampCContext = Readonly<{
    site: DrawingCallSite;
    collectionName: string | null;
    inferredCap: number | null;
}>;

/**
 * The stable Camp C hard-reject codes. Each names one irreducible
 * dynamic-drawing obstacle the converter refuses rather than guessing at.
 * `unbounded-handle-collection` reuses the existing semantic-stage code (a
 * collection with no detectable cap); the rest are transform-stage codes.
 *
 * @since 0.1
 * @stable
 * @example
 *     const code: RejectCode = "cross-collection-linefill";
 *     void code;
 */
export type RejectCode =
    | "unbounded-handle-collection"
    | "dynamic-handle-index"
    | "cross-collection-linefill"
    | "polyline-dynamic-points"
    | "handle-copy"
    | "handle-store-in-udt"
    | "for-in-line-all";

/**
 * A suggestion template: a pure function from the {@link CampCContext} to the
 * concrete manual-rewrite string the user can paste back into Pine to make
 * the script convertible. Templates specialise on the inferred `K` and the
 * collection identifier so the advice is actionable, not generic.
 *
 * @since 0.1
 * @stable
 * @example
 *     const fn: SuggestionFn = (ctx) => `cap ${ctx.collectionName ?? "the collection"}`;
 *     void fn;
 */
export type SuggestionFn = (ctx: CampCContext) => string;

/**
 * One row of the Camp C reject registry: the stable {@link RejectCode}, its
 * fixed `error` severity, and the {@link SuggestionFn} that renders the
 * manual-rewrite advice for a given context.
 *
 * @since 0.1
 * @stable
 * @example
 *     const entry: RejectEntry = {
 *         code: "handle-copy",
 *         severity: "error",
 *         template: () => "Re-create the drawing instead of copying it.",
 *     };
 *     void entry;
 */
export type RejectEntry = Readonly<{
    code: RejectCode;
    severity: "error";
    template: SuggestionFn;
}>;

// The recovered cap, or a readable placeholder when none was inferred.
function capText(ctx: CampCContext): string {
    return ctx.inferredCap === null ? "N" : String(ctx.inferredCap);
}

// The resolved collection identifier, or a readable placeholder.
function collectionText(ctx: CampCContext): string {
    return ctx.collectionName ?? "your array";
}

/**
 * The Camp C reject registry: every hard-reject obstacle mapped to its
 * suggestion template. Camp C looks a code up here, renders its template over
 * the call-site context, and attaches the result as the diagnostic's
 * `suggestion`. Keep this in lockstep with the diagnostic-code registry —
 * each {@link RejectCode} (except `unbounded-handle-collection`, which reuses
 * the semantic code) has a matching `pine-converter/transform/...` entry.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { CAMP_C_REJECTS } from "./campCRejects.js";
 *     CAMP_C_REJECTS.get("handle-copy")?.severity; // "error"
 */
export const CAMP_C_REJECTS: ReadonlyMap<RejectCode, RejectEntry> = new Map<
    RejectCode,
    RejectEntry
>([
    [
        "unbounded-handle-collection",
        {
            code: "unbounded-handle-collection",
            severity: "error",
            template: (ctx) =>
                `Add \`max_lines_count=${capText(ctx)}\` (or labels/boxes/polylines) to your indicator() declaration, **and** a size-gate eviction (\`if array.size(${collectionText(ctx)}) > ${capText(ctx)} → line.delete(array.shift(${collectionText(ctx)}))\`).`,
        },
    ],
    [
        "dynamic-handle-index",
        {
            code: "dynamic-handle-index",
            severity: "error",
            template: (ctx) =>
                `Replace dynamic indexing with a \`for i = 0 to ${capText(ctx)} - 1\` loop where the bound is a literal.`,
        },
    ],
    [
        "cross-collection-linefill",
        {
            code: "cross-collection-linefill",
            severity: "error",
            template: () =>
                "linefill across two collections has no chartlang analogue. Consider a " +
                "single `draw.path(...)` over the pair of anchor points instead.",
        },
    ],
    [
        "polyline-dynamic-points",
        {
            code: "polyline-dynamic-points",
            severity: "error",
            template: (ctx) =>
                `chartlang \`draw.polyline\` requires a literal-bounded anchor array. Build the anchor list in a \`for (let i = 0; i < ${capText(ctx)}; i++)\` loop.`,
        },
    ],
    [
        "handle-copy",
        {
            code: "handle-copy",
            severity: "error",
            template: () =>
                "Drawing copy has no chartlang analogue (handles aren't first-class values). " +
                "Re-create the drawing at the new location instead.",
        },
    ],
    [
        "handle-store-in-udt",
        {
            code: "handle-store-in-udt",
            severity: "error",
            template: () =>
                "UDTs aren't supported in v1. Hoist the handle into a `var line/label/box` " +
                "declaration at the script top level.",
        },
    ],
    [
        "for-in-line-all",
        {
            code: "for-in-line-all",
            severity: "error",
            template: (ctx) =>
                `Bulk-iterate over all drawings isn't supported. Track handles explicitly in a \`var array<${ctx.site.handleType}>\` (Camp B).`,
        },
    ],
]);

/**
 * Render the manual-rewrite suggestion for a Camp C reject by looking the
 * code up in {@link CAMP_C_REJECTS} and applying its template to the
 * call-site context. Camp C attaches the result as the diagnostic's
 * `suggestion` so the user sees a concrete, collection-specific rewrite.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { rejectSuggestion } from "./campCRejects.js";
 *     declare const site: import("../semantic/index.js").DrawingCallSite;
 *     rejectSuggestion("cross-collection-linefill", {
 *         site,
 *         collectionName: null,
 *         inferredCap: null,
 *     });
 */
export function rejectSuggestion(code: RejectCode, ctx: CampCContext): string {
    const entry = CAMP_C_REJECTS.get(code);
    if (entry === undefined) {
        return "";
    }
    return entry.template(ctx);
}

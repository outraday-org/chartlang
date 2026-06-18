// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallArgument } from "../ast/index.js";
import { drawingLookup, enumLookup } from "../mapping/index.js";
import type { DrawingCallSite } from "../semantic/index.js";
import type { DiagnosticCollector } from "./diagnosticCollector.js";
import type { ChartlangDrawKind } from "./handleSlot.js";

// The chartlang `draw.*` kinds a `label.new(style=…)` enum can resolve to.
const LABEL_STYLE_KINDS: ReadonlySet<string> = new Set([
    "text",
    "marker",
    "frame",
    "rectangle",
    "arrow-mark-up",
    "arrow-mark-down",
]);

// The `style=` named-arg enum target for a `label.new` call, or `null` when
// absent / non-member / unmapped.
function labelStyleKind(args: readonly CallArgument[]): string | null {
    const styleArg = args.find((arg) => arg.name === "style");
    if (styleArg === undefined || styleArg.value.kind !== "member-access-expression") {
        return null;
    }
    const mapping = enumLookup(styleArg.value.chain.join("."));
    if (mapping === null || typeof mapping.chartlang !== "string") {
        return null;
    }
    return mapping.chartlang;
}

/**
 * Resolve the chartlang `draw.*` kind a Camp A drawing site lowers to.
 * `line.new` → `"line"`, `box.new` → `"rectangle"`; `label.new` defaults to
 * `"text"` but a `style=label.style_*` enum routes it to `marker` / `frame`
 * / `arrow-mark-up` / `arrow-mark-down` / `rectangle` per
 * `ENUM_VALUE_MAP`. A `label.new` whose `style` maps to a non-drawing
 * chartlang target raises `label-style-not-mapped` and falls back to
 * `"text"`. Returns `null` only for an unmapped constructor (defensive —
 * `linefill.new` never classifies Camp A).
 *
 * @since 0.1
 * @stable
 * @example
 *     import { resolveCampADrawKind } from "./drawKindResolve.js";
 *     import { DiagnosticCollector } from "./diagnosticCollector.js";
 *     declare const site: import("../semantic/index.js").DrawingCallSite;
 *     resolveCampADrawKind(site, new DiagnosticCollector());
 */
export function resolveCampADrawKind(
    site: DrawingCallSite,
    diagnostics: DiagnosticCollector,
): ChartlangDrawKind | null {
    const mapping = drawingLookup(site.constructor);
    if (mapping === null || mapping.chartlang === null) {
        return null;
    }
    if (site.constructor !== "label.new") {
        return mapping.chartlang as ChartlangDrawKind;
    }
    const styleKind = labelStyleKind(site.call.args);
    if (styleKind === null) {
        return "text";
    }
    if (!LABEL_STYLE_KINDS.has(styleKind)) {
        diagnostics.pushCode("label-style-not-mapped", site.span);
        return "text";
    }
    return styleKind as ChartlangDrawKind;
}

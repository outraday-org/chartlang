// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ScriptScaffold } from "../transform/ir.js";
import {
    type HelperNames,
    allocateHelperNames,
    emitBarIndexPreamble,
    emitHandleRingHelper,
    emitHandleSlotHelper,
    emitSlotAllocations,
    hasNonCompactHandleSlot,
    renameBarIndexSentinel,
} from "./emitHelpers.js";
import { scanUsage } from "./usage.js";

// The destructured `ComputeContext` fields, in a fixed order, gated on usage.
// `bar` is always present; `barstate` rides in whenever the body references
// it OR the `bar_index` bridge needs it.
function destructureFields(scaffold: ScriptScaffold): string[] {
    const usage = scanUsage(scaffold);
    const fields: string[] = ["bar"];
    if (usage.ta) fields.push("ta");
    if (usage.plot) fields.push("plot");
    if (usage.hline) fields.push("hline");
    if (usage.alert) fields.push("alert");
    if (usage.draw) fields.push("draw");
    if (usage.input) fields.push("inputs");
    if (usage.state) fields.push("state");
    if (usage.request) fields.push("request");
    if (usage.barstate || usage.barIndex) fields.push("barstate");
    return fields;
}

// The body lines preceding the converted statements: the bar-index bridge,
// the handle/ring helper definitions, and the state/handle/ring allocations —
// each gated on whether the scaffold needs it. The helper identifiers come
// from `names` (allocated once per scaffold so they never collide with a Pine
// identifier). Bar-offset anchors lower to `bar.point(...)` (runtime-resolved),
// so no bar-interval const is emitted.
function preambleLines(scaffold: ScriptScaffold, names: HelperNames): string[] {
    const usage = scanUsage(scaffold);
    const lines: string[] = [];
    if (usage.barIndex) lines.push(...emitBarIndexPreamble(names));
    if (hasNonCompactHandleSlot(scaffold)) lines.push(...emitHandleSlotHelper(names));
    if (scaffold.handleRings.length > 0) lines.push(...emitHandleRingHelper(names));
    lines.push(...emitSlotAllocations(scaffold, names));
    return lines;
}

/**
 * Emit the `compute({ … }) { … }` block for a converted scaffold: the
 * minimal destructured `ComputeContext` parameter, the codegen-owned preamble
 * (bar-index bridge, handle/ring helper definitions, and the state/handle/ring
 * allocations — all emitted INSIDE `compute` where `draw`/`state` are in
 * scope), then the converted compute statements. The synthesized helper
 * identifiers are allocated ONCE here (after every per-Pine-symbol name was
 * claimed by the transforms) so they read as `barIndex`/`HandleSlot`/… and
 * never collide; the `bar_index` bridge sentinel the static identifier map left
 * in the converted statements is renamed to the allocated `barIndex` in the
 * same pass. Returned as a flat, un-indented line array;
 * {@link import("./format.js").formatSource} owns the final indentation.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { emitCompute } from "./emitCompute.js";
 *     declare const scaffold: import("../transform/ir.js").ScriptScaffold;
 *     emitCompute(scaffold)[0]; // "compute({ bar }) {"
 */
export function emitCompute(scaffold: ScriptScaffold): string[] {
    const fields = destructureFields(scaffold).join(", ");
    const names = allocateHelperNames(scaffold);
    const body = [...preambleLines(scaffold, names), ...scaffold.computeBody.statements].map(
        (line) => renameBarIndexSentinel(line, names),
    );
    return [`compute({ ${fields} }) {`, ...body, "},"];
}

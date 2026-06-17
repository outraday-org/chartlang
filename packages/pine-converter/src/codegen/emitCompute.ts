// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ScriptScaffold } from "../transform/ir.js";
import {
    emitBarIndexPreamble,
    emitBarIntervalConst,
    emitHandleRingHelper,
    emitHandleSlotHelper,
    emitSlotAllocations,
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
// the bar-interval const, the handle/ring helper definitions, and the
// state/handle/ring allocations — each gated on whether the scaffold needs it.
function preambleLines(scaffold: ScriptScaffold): string[] {
    const usage = scanUsage(scaffold);
    const lines: string[] = [];
    if (usage.barIndex) lines.push(...emitBarIndexPreamble());
    if (usage.barInterval) lines.push(emitBarIntervalConst());
    if (scaffold.handleSlots.length > 0) lines.push(...emitHandleSlotHelper());
    if (scaffold.handleRings.length > 0) lines.push(...emitHandleRingHelper());
    lines.push(...emitSlotAllocations(scaffold));
    return lines;
}

/**
 * Emit the `compute({ … }) { … }` block for a converted scaffold: the
 * minimal destructured `ComputeContext` parameter, the codegen-owned preamble
 * (bar-index bridge, handle/ring helper definitions, and the state/handle/ring
 * allocations — all emitted INSIDE `compute` where `draw`/`state` are in
 * scope), then the converted compute statements verbatim. Returned as a flat,
 * un-indented line array; {@link import("./format.js").formatSource} owns the
 * final brace-depth indentation.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { emitCompute } from "./emitCompute.js";
 *     declare const scaffold: import("../transform/ir.js").ScriptScaffold;
 *     emitCompute(scaffold)[0]; // "compute({ bar }) {"
 */
export function emitCompute(scaffold: ScriptScaffold): string[] {
    const fields = destructureFields(scaffold).join(", ");
    const body = [...preambleLines(scaffold), ...scaffold.computeBody.statements];
    return [`compute({ ${fields} }) {`, ...body, "},"];
}

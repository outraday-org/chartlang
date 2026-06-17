// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    HandleRingIR,
    HandleSlotIR,
    InputDeclarationIR,
    ScriptScaffold,
    StateSlotIR,
} from "./ir.js";

/**
 * Append an input-schema entry to a {@link ScriptScaffold}. The single
 * mutation surface Task 9 uses to register a converted Pine `input.*` call.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import type { ScriptScaffold } from "./ir.js";
 *     declare const scaffold: ScriptScaffold;
 *     appendInput(scaffold, { name: "length", code: "input.int(14)" });
 */
export function appendInput(scaffold: ScriptScaffold, input: InputDeclarationIR): void {
    scaffold.inputs.push(input);
}

/**
 * Append a scalar `state.*` slot to a {@link ScriptScaffold}. Tasks 10/15
 * call this when folding a Pine `var`/`varip` scalar out of the body.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import type { ScriptScaffold } from "./ir.js";
 *     declare const scaffold: ScriptScaffold;
 *     appendStateSlot(scaffold, { name: "count", initExpr: "0" });
 */
export function appendStateSlot(scaffold: ScriptScaffold, slot: StateSlotIR): void {
    scaffold.stateSlots.push(slot);
}

/**
 * Append a single drawing-handle slot (Camp A) to a {@link ScriptScaffold}.
 * Task 10 calls this for a persistent `var`/`varip` handle.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import type { ScriptScaffold } from "./ir.js";
 *     declare const scaffold: ScriptScaffold;
 *     appendHandleSlot(scaffold, { name: "lvlLine", kind: "line" });
 */
export function appendHandleSlot(scaffold: ScriptScaffold, slot: HandleSlotIR): void {
    scaffold.handleSlots.push(slot);
}

/**
 * Append a bounded drawing-handle ring buffer (Camp B) to a
 * {@link ScriptScaffold}. Task 11 calls this for a capped collection.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import type { ScriptScaffold } from "./ir.js";
 *     declare const scaffold: ScriptScaffold;
 *     appendHandleRing(scaffold, { name: "pivots", kind: "label", cap: 20 });
 */
export function appendHandleRing(scaffold: ScriptScaffold, ring: HandleRingIR): void {
    scaffold.handleRings.push(ring);
}

/**
 * Append one chartlang source statement to the scaffold's `compute` body.
 * Tasks 10–15 call this in source order; Task 16 codegen joins and indents
 * the accumulated statements inside the emitted `compute({...}) { ... }`.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import type { ScriptScaffold } from "./ir.js";
 *     declare const scaffold: ScriptScaffold;
 *     appendComputeStatement(scaffold, "draw.line(a, b);");
 */
export function appendComputeStatement(scaffold: ScriptScaffold, statement: string): void {
    scaffold.computeBody.statements.push(statement);
}

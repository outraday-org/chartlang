// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ScriptScaffold } from "../transform/ir.js";

/**
 * Emit the `inputs: { … }` object-literal lines for a converted scaffold, or
 * `null` when the scaffold declares no inputs (the property is omitted
 * entirely so the emitted `defineIndicator` stays minimal). Each entry is
 * `<name>: <code>,` where `code` is the verbatim chartlang `input.*` source
 * the transform produced. Returned as a line array (no indentation) so the
 * formatter owns the final spacing; iteration follows scaffold insertion
 * order for determinism.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { emitInputs } from "./emitInputs.js";
 *     declare const scaffold: import("../transform/ir.js").ScriptScaffold;
 *     emitInputs(scaffold); // ["inputs: {", "len: input.int(14),", "},"] | null
 */
export function emitInputs(scaffold: ScriptScaffold): string[] | null {
    if (scaffold.inputs.length === 0) {
        return null;
    }
    const lines: string[] = ["inputs: {"];
    for (const entry of scaffold.inputs) {
        lines.push(`${entry.name}: ${entry.code},`);
    }
    lines.push("},");
    return lines;
}

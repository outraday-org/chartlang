// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ConvertManifest } from "../index.js";
import type { SemanticResult } from "../semantic/index.js";
import type { ScriptScaffold } from "../transform/ir.js";

/**
 * Build the public {@link ConvertManifest} from a converted scaffold + the
 * semantic analysis. `kind` follows the chosen constructor; `inputs` is the
 * declared input-name list; `drawingKindsUsed` is the sorted-unique set of
 * chartlang draw kinds across the handle slots + rings; `requiresBarInterval`
 * is true iff the script anchored any drawing at a future `bar_index + N`
 * coordinate (which needs the host's bar spacing to resolve).
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { scaffoldToManifest } from "./manifest.js";
 *     declare const scaffold: import("../transform/ir.js").ScriptScaffold;
 *     declare const analysis: import("../semantic/index.js").SemanticResult;
 *     scaffoldToManifest(scaffold, analysis).kind; // "indicator" | "drawing"
 */
export function scaffoldToManifest(
    scaffold: ScriptScaffold,
    analysis: SemanticResult,
): ConvertManifest {
    const kinds = new Set<string>();
    for (const slot of scaffold.handleSlots) kinds.add(slot.kind);
    for (const ring of scaffold.handleRings) kinds.add(ring.kind);
    return {
        kind: scaffold.constructor === "defineDrawing" ? "drawing" : "indicator",
        name: scaffold.name,
        inputs: scaffold.inputs.map((entry) => entry.name),
        drawingKindsUsed: [...kinds].sort(),
        requiresBarInterval: analysis.referencesFutureBarIndex,
    };
}

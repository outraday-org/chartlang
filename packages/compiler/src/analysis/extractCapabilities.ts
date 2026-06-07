// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";

import { resolveCalleeName } from "../transformers/resolveCallee";

type CapabilityId = "indicators" | "drawings" | "alerts";

/**
 * Derive the manifest `capabilities` array from a script's AST. The seed
 * capability is determined by the structural script `kind`:
 * `defineIndicator` → `"indicators"`, `defineDrawing` → `"drawings"`,
 * `defineAlert` → `"alerts"`. `"alerts"` is added in addition whenever the
 * script calls `alert(...)` from `@invinite-org/chartlang-core` —
 * user-shadowed identifiers named `alert` are filtered out via
 * `resolveCalleeName`. The result is deduplicated and sorted for
 * deterministic manifest output.
 *
 * @since 0.1
 * @example
 *     // const caps = extractCapabilities(sourceFile, checker, "indicator");
 *     // caps === ["alerts", "indicators"]
 *     const fn: typeof extractCapabilities = extractCapabilities;
 *     void fn;
 */
export function extractCapabilities(
    sourceFile: ts.SourceFile,
    checker: ts.TypeChecker,
    kind: "indicator" | "drawing" | "alert" = "indicator",
): ReadonlyArray<CapabilityId> {
    const SEED_BY_KIND: Readonly<Record<"indicator" | "drawing" | "alert", CapabilityId>> = {
        indicator: "indicators",
        drawing: "drawings",
        alert: "alerts",
    };
    const seed: CapabilityId = SEED_BY_KIND[kind];
    const found = new Set<CapabilityId>([seed]);

    const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) {
            const calleeName = resolveCalleeName(node, checker);
            if (calleeName === "alert") {
                found.add("alerts");
            }
        }
        ts.forEachChild(node, visit);
    };
    ts.forEachChild(sourceFile, visit);

    const ordered = Array.from(found).sort();
    return Object.freeze(ordered);
}

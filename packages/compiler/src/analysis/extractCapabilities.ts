// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CapabilityId } from "@invinite-org/chartlang-core";
import ts from "typescript";

import { resolveCalleeName } from "../transformers/resolveCallee.js";

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
 * `"orders"` is derived the same callsite way, and is the ONE capability id no
 * script kind seeds (RFC 0002 §6): only `order.buy` / `order.sell` /
 * `order.close` add it. `order.position()` is a pure read of the nominal
 * position, so a script that merely inspects its own position never asks the
 * adapter for a capability it does not use. Dotted callees resolve through the
 * same `resolveCalleeName`, so both the core-import form and the destructured
 * `compute({ order })` form are recognised while a user-shadowed `order` is
 * not.
 *
 * The optional `scope` parameter narrows the walk to a single AST subtree
 * (typically one binding's `defineCall`) so multi-export files can derive
 * per-binding capability sets. Defaults to the whole `sourceFile`.
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
    kind: "indicator" | "drawing" | "alert" | "alertCondition" = "indicator",
    scope: ts.Node = sourceFile,
): ReadonlyArray<CapabilityId> {
    const SEED_BY_KIND: Readonly<
        Record<"indicator" | "drawing" | "alert" | "alertCondition", CapabilityId>
    > = {
        indicator: "indicators",
        drawing: "drawings",
        alert: "alerts",
        alertCondition: "alertConditions",
    };
    const seed: CapabilityId = SEED_BY_KIND[kind];
    const found = new Set<CapabilityId>([seed]);

    const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) {
            const calleeName = resolveCalleeName(node, checker);
            if (calleeName === "alert") {
                found.add("alerts");
            }
            if (
                calleeName === "order.buy" ||
                calleeName === "order.sell" ||
                calleeName === "order.close"
            ) {
                found.add("orders");
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(scope);

    const ordered = Array.from(found).sort();
    return Object.freeze(ordered);
}

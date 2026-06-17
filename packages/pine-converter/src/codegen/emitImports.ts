// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ScriptScaffold } from "../transform/ir.js";
import { scanUsage } from "./usage.js";

/**
 * Emit the minimized `@invinite-org/chartlang-core` import line for a
 * converted scaffold. The `defineIndicator` / `defineDrawing` constructor is
 * always present; every other named import (`draw`, `state`, `ta`, `plot`,
 * `hline`, `alert`, `input`, `request`) is included only when the scaffold's
 * generated source references it, and `type DrawingHandle` is added only when
 * a handle slot or ring is emitted (the codegen helper signatures need it).
 * Determinism: the import list is emitted in a fixed order, never sorted by a
 * runtime set, so the same scaffold yields a byte-identical line.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { emitImports } from "./emitImports.js";
 *     declare const scaffold: import("../transform/ir.js").ScriptScaffold;
 *     emitImports(scaffold); // 'import { defineIndicator } from "@invinite-org/chartlang-core";'
 */
export function emitImports(scaffold: ScriptScaffold): string {
    const usage = scanUsage(scaffold);
    const specifiers: string[] = [scaffold.constructor];
    if (usage.ta) specifiers.push("ta");
    if (usage.plot) specifiers.push("plot");
    if (usage.hline) specifiers.push("hline");
    if (usage.alert) specifiers.push("alert");
    if (usage.draw) specifiers.push("draw");
    if (usage.input) specifiers.push("input");
    if (usage.state) specifiers.push("state");
    if (usage.request) specifiers.push("request");
    if (usage.drawingHandle) specifiers.push("type DrawingHandle");

    return `import { ${specifiers.join(", ")} } from "@invinite-org/chartlang-core";`;
}

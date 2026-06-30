// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ScriptScaffold } from "../transform/ir.js";
import { scanUsage } from "./usage.js";

/**
 * Emit the minimized `@invinite-org/chartlang-core` import line for a
 * converted scaffold. The `defineIndicator` / `defineDrawing` constructor is
 * always present; every other named import (`draw`, `state`, `ta`, `plot`,
 * `hline`, `alert`, `input`, `request`, `time`, `session`, `math`, `color`) is
 * included only when the scaffold's generated source references it, and
 * `type DrawingHandle` is added only when
 * a NON-compact handle slot or a ring is emitted (the codegen helper signatures
 * name it; a compact handle slot's bare `const` carries no type annotation).
 * Determinism: the import list is emitted in a fixed order, never sorted by a
 * runtime set, so the same scaffold yields a byte-identical line.
 *
 * @since 0.1
 * @stable
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
    if (usage.bgcolor) specifiers.push("bgcolor");
    if (usage.barcolor) specifiers.push("barcolor");
    if (usage.alert) specifiers.push("alert");
    if (usage.draw) specifiers.push("draw");
    if (usage.input) specifiers.push("input");
    if (usage.state) specifiers.push("state");
    if (usage.request) specifiers.push("request");
    if (usage.time) specifiers.push("time");
    if (usage.session) specifiers.push("session");
    // `math` and `color` are module-scope frozen namespaces (like `str`): a
    // top-level import only — neither is a `ComputeContext` field, so neither
    // joins the `compute` destructure. `color` rides in whenever a `color.*`
    // member survives color lowering (`color.withAlpha`, a dynamic 3-arg
    // `color.rgb` passthrough, or a bare palette member). `syminfo` is the
    // inverse (destructure only, see `emitCompute.ts`).
    if (usage.math) specifiers.push("math");
    if (usage.color) specifiers.push("color");
    if (usage.drawingHandle) specifiers.push("type DrawingHandle");
    if (usage.sourceField) specifiers.push("type SourceField");

    return `import { ${specifiers.join(", ")} } from "@invinite-org/chartlang-core";`;
}

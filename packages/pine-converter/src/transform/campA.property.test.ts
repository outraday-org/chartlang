// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "../semantic/index.js";
import { transformCampA } from "./campA.js";
import { transformDeclaration } from "./declaration.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import type { ScriptScaffold } from "./ir.js";

// A Pine Camp A fixture: one `var <kind> h = na`, a guarded create, and
// `setterCount` style setters in the same block.
function fixture(
    handle: "line" | "label" | "box",
    setterCount: number,
): { scaffold: ScriptScaffold; campASites: number } {
    const ctor =
        handle === "line"
            ? "line.new(bar_index, close, bar_index, close)"
            : handle === "box"
              ? "box.new(bar_index, high, bar_index, low)"
              : "label.new(bar_index, high)";
    const setterMember = handle === "label" ? "label.set_color" : `${handle}.set_color`;
    const setters = Array.from({ length: setterCount }, () => `    ${setterMember}(h, color.red)`);
    const src = [
        "//@version=6",
        'indicator("X", overlay=true)',
        `var ${handle} h = na`,
        "if barstate.islast",
        `    h := ${ctor}`,
        ...setters,
        "plot(close)",
        "",
    ].join("\n");
    const analysis = analyze(parseStatements(lex(src).tokens).script);
    const decl = analysis.script.declaration;
    if (
        decl === null ||
        decl.kind === "library-declaration" ||
        decl.kind === "import-declaration"
    ) {
        throw new Error("expected an indicator declaration");
    }
    const diagnostics = new DiagnosticCollector();
    const scaffold = transformDeclaration(decl, analysis, diagnostics);
    let campASites = 0;
    for (const site of analysis.drawingSites) {
        if (site.camp.kind === "camp-a") {
            campASites += 1;
            transformCampA(site, analysis, scaffold, diagnostics);
        }
    }
    return { scaffold, campASites };
}

describe("transformCampA properties", () => {
    it("produces exactly one handle slot + one create per Camp A site", () => {
        fc.assert(
            fc.property(
                fc.constantFrom("line", "label", "box") as fc.Arbitrary<"line" | "label" | "box">,
                fc.integer({ min: 0, max: 5 }),
                (handle, setterCount) => {
                    const { scaffold, campASites } = fixture(handle, setterCount);
                    expect(scaffold.handleSlots).toHaveLength(campASites);
                    // The fixture is the plain-`var`, no-delete idiom, so every
                    // slot lowers to the compact bare-`const` create form.
                    expect(scaffold.handleSlots.every((slot) => slot.compact)).toBe(true);
                    const creates = scaffold.computeBody.statements.filter((s) =>
                        /^const \w+ = draw\./.test(s),
                    );
                    expect(creates).toHaveLength(campASites);
                    // Readable allocation: no synthesized name keeps the `__` prefix.
                    expect(scaffold.handleSlots.every((slot) => !slot.name.startsWith("__"))).toBe(
                        true,
                    );
                },
            ),
        );
    });

    it("emits at most one update per observed mutation site", () => {
        fc.assert(
            fc.property(fc.integer({ min: 0, max: 5 }), (setterCount) => {
                const { scaffold } = fixture("line", setterCount);
                const updates = scaffold.computeBody.statements.filter((s) =>
                    s.includes(".update("),
                );
                // All setters share one block, so they fold into ≤ 1 update.
                expect(updates.length).toBeLessThanOrEqual(Math.min(setterCount, 1));
            }),
        );
    });
});

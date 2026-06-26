// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { ScriptScaffold } from "../transform/ir.js";
import { NameAllocator } from "../transform/nameAllocator.js";
import { emitImports } from "./emitImports.js";
import { scanUsage } from "./usage.js";

function scaffold(overrides: Partial<ScriptScaffold> = {}): ScriptScaffold {
    return {
        constructor: "defineIndicator",
        apiVersion: 1,
        name: "Imp",
        shortName: null,
        overlay: true,
        format: null,
        precision: null,
        scale: null,
        maxDrawings: {},
        maxBarsBack: null,
        inputs: [],
        stateSlots: [],
        handleSlots: [],
        handleRings: [],
        computeBody: { statements: [] },
        diagnostics: [],
        names: new NameAllocator(),
        ...overrides,
    };
}

describe("import minimization", () => {
    it("imports only the constructor for an empty scaffold", () => {
        expect(emitImports(scaffold())).toBe(
            'import { defineIndicator } from "@invinite-org/chartlang-core";',
        );
    });

    it("a draw-only scaffold omits plot, hline, and alert", () => {
        const line = emitImports(
            scaffold({
                handleSlots: [{ name: "__h", kind: "line", compact: false }],
                computeBody: { statements: ["__h.set(draw.line({}, {}));"] },
            }),
        );
        expect(line).toContain("draw");
        expect(line).toContain("type DrawingHandle");
        expect(line).not.toContain("plot");
        expect(line).not.toContain("hline");
        expect(line).not.toContain("alert");
    });

    it("includes each surface exactly when the body references it", () => {
        const line = emitImports(
            scaffold({
                inputs: [{ name: "len", code: "input.int(1)" }],
                stateSlots: [{ name: "__s", initExpr: "state.int(0)" }],
                computeBody: {
                    statements: [
                        "plot(ta.ema(bar.close, 5));",
                        "hline(0);",
                        'alert("x");',
                        'const r = request.security({ interval: "1h" });',
                        "void r;",
                    ],
                },
            }),
        );
        for (const name of ["ta", "plot", "hline", "alert", "input", "state", "request"]) {
            expect(line).toContain(name);
        }
    });

    it("includes time and session when the body references the accessor namespaces", () => {
        const line = emitImports(
            scaffold({
                computeBody: {
                    statements: [
                        "const d = time.dayofweek(bar.time);",
                        'const open = session.isOpen(bar.time, "0930-1600");',
                        "void d;",
                        "void open;",
                    ],
                },
            }),
        );
        expect(line).toContain("time");
        expect(line).toContain("session");
    });

    it("scanUsage flags time and session accessor references", () => {
        const flags = scanUsage(
            scaffold({
                computeBody: {
                    statements: [
                        "const d = time.timeClose(bar.time);",
                        'const open = session.isOpen(bar.time, "0930-1600");',
                        "void d;",
                        "void open;",
                    ],
                },
            }),
        );
        expect(flags.time).toBe(true);
        expect(flags.session).toBe(true);
    });

    it("imports color when a color.* member survives the lowering", () => {
        const line = emitImports(
            scaffold({
                computeBody: {
                    statements: [
                        "const trendCol = bar.close > bar.open ? color.green : color.red;",
                        "plot(bar.close, { color: color.withAlpha(trendCol, 0.5) });",
                        "plot(bar.open, { color: color.rgb(bar.close > bar.open ? 0 : 255, 153, 0) });",
                    ],
                },
            }),
        );
        expect(line).toContain("color");
    });

    it("does not import color when every color folded to a hex string", () => {
        const flags = scanUsage(
            scaffold({
                computeBody: {
                    statements: ['plot(bar.close, { color: "#FF993399" });'],
                },
            }),
        );
        expect(flags.color).toBe(false);
        expect(
            emitImports(
                scaffold({
                    computeBody: { statements: ['plot(bar.close, { color: "#FF993399" });'] },
                }),
            ),
        ).not.toContain("color");
    });

    it("scanUsage flags barstate and bar-index references", () => {
        const flags = scanUsage(
            scaffold({
                computeBody: {
                    statements: [
                        "if (barstate.islast) {}",
                        "const a = __barIndexBridge();",
                        "void a;",
                    ],
                },
            }),
        );
        expect(flags.barstate).toBe(true);
        expect(flags.barIndex).toBe(true);
    });
});

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { compile } from "@invinite-org/chartlang-compiler";
import { describe, expect, it } from "vitest";

import { convert } from "../index.js";
import type { ScriptScaffold } from "../transform/ir.js";
import { NameAllocator } from "../transform/nameAllocator.js";
import { emit } from "./emit.js";

function scaffold(overrides: Partial<ScriptScaffold> = {}): ScriptScaffold {
    return {
        constructor: "defineIndicator",
        apiVersion: 1,
        name: "Compile",
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

// A canonical Camp A scaffold: a persistent line handle created once and
// updated each bar — the §16 acceptance fixture, hand-built so the round-trip
// does not depend on the full front-end parsing a specific Pine source.
const CAMP_A = scaffold({
    handleSlots: [{ name: "__lvl_handle", kind: "line", compact: false }],
    computeBody: {
        statements: [
            "if (__lvl_handle.current() === null) { __lvl_handle.set(draw.line({ time: bar.time, price: bar.high }, { time: bar.time, price: bar.low })); }",
            "if (barstate.islast) { __lvl_handle.current()?.update({ anchors: [{ time: bar.time, price: bar.high }, { time: bar.time, price: bar.low }] }); }",
        ],
    },
});

describe("emit → compile round-trip", () => {
    it("compiles a hand-built Camp A scaffold's emitted source", async () => {
        const source = emit(CAMP_A);
        const result = await compile(source, { apiVersion: 1, sourcePath: "campA.chart.ts" });
        expect(result.moduleSource.length).toBeGreaterThan(0);
        expect(result.manifest.name).toBe("Compile");
    });

    it("compiles a ring-buffer scaffold with a literal-bound update loop", async () => {
        const source = emit(
            scaffold({
                name: "Ring",
                handleRings: [{ name: "__lvls_ring", kind: "line", cap: 50 }],
                maxDrawings: { lines: 50 },
                computeBody: {
                    statements: [
                        "if (bar.high > bar.low) { __lvls_ring.push(draw.line({ time: bar.time, price: bar.high }, { time: bar.time, price: bar.low })); }",
                        "for (let i = 0; i < 50; i++) { const __h = __lvls_ring.at(i); if (__h === null) continue; __h.update({}); }",
                    ],
                },
            }),
        );
        const result = await compile(source, { apiVersion: 1, sourcePath: "ring.chart.ts" });
        expect(result.manifest.name).toBe("Ring");
    });

    it("convert() produces a string that compiles through the chartlang compiler", async () => {
        const result = convert(
            ["//@version=6", 'indicator("Smoke", overlay = true)', "plot(close)"].join("\n"),
        );
        expect(result.output).not.toBeNull();
        const source = result.output ?? "";
        expect(source.startsWith("// Auto-generated")).toBe(true);
        const compiled = await compile(source, { apiVersion: 1, sourcePath: "smoke.chart.ts" });
        expect(compiled.manifest.name).toBe("Smoke");
    });

    it("rejects (throws CompileError) for intentionally-broken emitted source", async () => {
        const broken = scaffold({
            name: "Broken",
            computeBody: { statements: ["while (true) { plot(bar.close); }"] },
        });
        await expect(
            compile(emit(broken), { apiVersion: 1, sourcePath: "broken.chart.ts" }),
        ).rejects.toThrow();
    });
});

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { compile } from "@invinite-org/chartlang-compiler";
import { describe, expect, it } from "vitest";

import { moduleSourceToScript } from "./moduleSourceToScript.js";

const REAL_SCRIPT_SOURCE = `
import { defineIndicator, ta, plot, alert } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "EMA cross",
    apiVersion: 1,
    compute: ({ bar }) => {
        const fast = ta.ema(bar.close, 12);
        const cross = ta.crossover(fast, bar.close);
        plot(fast);
        if (cross.current) alert("EMA crossed");
    },
});
`;

describe("moduleSourceToScript", () => {
    it("rewrites the single export default into a global assignment", () => {
        const out = moduleSourceToScript("export default { manifest, compute };");
        expect(out).toBe("globalThis.__chartlang_compiled_default = { manifest, compute };");
    });

    it("rewrites export const __manifest into a global assignment", () => {
        const src = "export const __manifest = { name: 'x' };\nexport default { compute };";
        const out = moduleSourceToScript(src);
        expect(out).toContain("globalThis.__chartlang_compiled_manifest = { name: 'x' };");
        expect(out).toContain("globalThis.__chartlang_compiled_default = { compute };");
    });

    it("ignores `export default` inside a string literal", () => {
        const src = 'const banner = "export default fake";\nexport default { compute };';
        const out = moduleSourceToScript(src);
        expect(out).toBe(
            'const banner = "export default fake";\nglobalThis.__chartlang_compiled_default = { compute };',
        );
    });

    it("ignores `export default` inside a line comment", () => {
        const src = "// export default ignored\nexport default { compute };";
        const out = moduleSourceToScript(src);
        expect(out).toContain("// export default ignored");
        expect(out).toContain("globalThis.__chartlang_compiled_default = { compute };");
    });

    it("throws when there is no export default", () => {
        expect(() => moduleSourceToScript("const x = 1;")).toThrow(
            /did not declare an export default/,
        );
    });

    it("throws when there are multiple export default statements", () => {
        const src = "export default { a: 1 };\nexport default { b: 2 };";
        expect(() => moduleSourceToScript(src)).toThrow(/multiple export default statements/);
    });

    it("rewrites a single-line `export { foo as default };` form (esbuild bundle)", () => {
        const src = "var foo = { compute };\nexport { foo as default };";
        const out = moduleSourceToScript(src);
        expect(out).toBe("var foo = { compute };\nglobalThis.__chartlang_compiled_default = foo;");
    });

    it("rewrites the multi-line `export { foo as default };` form (esbuild bundle)", () => {
        const src =
            "var ema_chart_default = { compute };\nexport {\n  ema_chart_default as default\n};";
        const out = moduleSourceToScript(src);
        expect(out).toContain("globalThis.__chartlang_compiled_default = ema_chart_default;");
        expect(out).not.toContain("export {");
    });

    it("accepts a trailing comma in the renamed-default form", () => {
        const src = "var x = 1;\nexport { x as default, };";
        const out = moduleSourceToScript(src);
        expect(out).toContain("globalThis.__chartlang_compiled_default = x;");
    });

    it("throws when literal + renamed default forms coexist", () => {
        const src = "export default { a: 1 };\nvar x = 2;\nexport { x as default };";
        expect(() => moduleSourceToScript(src)).toThrow(/multiple export default statements/);
    });

    it("throws when two renamed-default forms appear", () => {
        const src = "var a = 1;\nvar b = 2;\nexport { a as default };\nexport { b as default };";
        expect(() => moduleSourceToScript(src)).toThrow(/multiple export default statements/);
    });

    it("rewrites the manifest assignment alongside the renamed default form", () => {
        const src = [
            "var ema_chart_default = { compute };",
            "export { ema_chart_default as default };",
            'export const __manifest = {"apiVersion":1};',
        ].join("\n");
        const out = moduleSourceToScript(src);
        expect(out).toContain("globalThis.__chartlang_compiled_default = ema_chart_default;");
        expect(out).toContain('globalThis.__chartlang_compiled_manifest = {"apiVersion":1};');
    });

    it("rewrites real `compile(...)` output (esbuild-bundled, renamed-default form)", async () => {
        // Acceptance criterion §3 of the bundle fix: the host-quickjs adapter
        // must absorb the actual shape produced by the compiler's bundler,
        // not just a hand-written fixture. A regression in either side
        // (compiler dropping renamed-default, or this regex narrowing) trips
        // here before the QuickJS integration test bites.
        const compiled = await compile(REAL_SCRIPT_SOURCE, {
            apiVersion: 1,
            sourcePath: "ema-cross.chart.ts",
        });
        // Sanity: real compiler output uses the renamed-default form.
        expect(compiled.moduleSource).toMatch(/export\s*\{\s*[A-Za-z_$][\w$]*\s+as\s+default\s*\}/);
        expect(compiled.moduleSource).toContain("export const __manifest = ");

        const out = moduleSourceToScript(compiled.moduleSource);
        expect(out).toContain("globalThis.__chartlang_compiled_default = ");
        expect(out).toContain("globalThis.__chartlang_compiled_manifest =");
        // No `export` statements survive — the dispatcher evaluates this as
        // a top-level script and ESM exports would be a SyntaxError.
        expect(out).not.toMatch(/^\s*export\b/m);
    });
});

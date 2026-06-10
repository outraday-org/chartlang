// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { EMA_CROSS, VALID_DEFINE } from "./__fixtures__/scripts.js";
import { CompileError, compile } from "./api.js";

const HOSTILE = `
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "bad",
    apiVersion: 1,
    compute: () => { Math.random(); },
});
`;

describe("compile", () => {
    it("returns a frozen CompiledScript for the EMA-cross fixture", async () => {
        const result = await compile(EMA_CROSS, {
            apiVersion: 1,
            sourcePath: "ema-cross.chart.ts",
        });
        expect(Object.isFrozen(result)).toBe(true);
        expect(result.moduleSource).toContain("export const __manifest = ");
        expect(result.types).toContain("export default script");
        expect(result.manifest.name).toBe("EMA cross");
        expect(result.manifest.capabilities).toEqual(["alerts", "indicators"]);
    });

    it("emits 4 callsite-id literals for the EMA-cross fixture", async () => {
        const result = await compile(EMA_CROSS, {
            apiVersion: 1,
            sourcePath: "ema-cross.chart.ts",
        });
        const matches = result.moduleSource.match(/"ema-cross\.chart\.ts:\d+:\d+#0"/g) ?? [];
        expect(matches).toHaveLength(4);
    });

    it("throws CompileError with a `type-error` diagnostic when a TS semantic error fires", async () => {
        // Regression for the gap reported in PLAN §5.2 step 1: semantic
        // type errors (`const x: number = "oops"`) previously slipped
        // through silently. The fix wires `program.getSemanticDiagnostics`
        // into the pipeline under the `type-error` code.
        const TYPE_ERR = `
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "T",
    apiVersion: 1,
    compute({ bar, plot }) {
        const x: number = "oops";
        plot(x);
        void bar;
    },
});
`;
        try {
            await compile(TYPE_ERR, { apiVersion: 1, sourcePath: "demo.chart.ts" });
            expect.unreachable("compile should have thrown a CompileError");
        } catch (err) {
            expect(err).toBeInstanceOf(CompileError);
            const compileError = err as CompileError;
            const first = compileError.diagnostics[0];
            expect(first?.code).toBe("type-error");
            expect(first?.severity).toBe("error");
            expect(first?.file).toBe("demo.chart.ts");
            expect(first?.line).toBe(7);
            expect(first?.message).toContain("TS2322");
        }
    });

    it("throws CompileError carrying the diagnostic array when Math.random is used", async () => {
        await expect(() =>
            compile(HOSTILE, { apiVersion: 1, sourcePath: "bad.chart.ts" }),
        ).rejects.toBeInstanceOf(CompileError);
        try {
            await compile(HOSTILE, { apiVersion: 1, sourcePath: "bad.chart.ts" });
        } catch (err) {
            expect(err).toBeInstanceOf(CompileError);
            const compileError = err as CompileError;
            expect(compileError.diagnostics[0]?.code).toBe("hostile-global");
            expect(compileError.name).toBe("CompileError");
            expect(compileError.message).toContain("hostile-global");
        }
    });

    it("throws CompileError for lower-tf-not-lower when declaredIntervals are supplied", async () => {
        const source = `
import { defineIndicator, request } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ltf too high",
    apiVersion: 1,
    compute: () => {
        request.lowerTf({ interval: "1D" });
    },
});
`;
        try {
            await compile(source, {
                apiVersion: 1,
                sourcePath: "ltf.chart.ts",
                declaredIntervals: [{ value: "1m", label: "1 minute", group: "minute" }],
            });
            expect.unreachable("compile should have thrown");
        } catch (err) {
            expect(err).toBeInstanceOf(CompileError);
            expect((err as CompileError).diagnostics[0]?.code).toBe("lower-tf-not-lower");
        }
    });

    it("throws CompileError for non-literal input defaults", async () => {
        const source = `
import { defineIndicator, input } from "@invinite-org/chartlang-core";
const len = 14;
export default defineIndicator({
    name: "bad inputs",
    apiVersion: 1,
    inputs: { len: input.int(len) },
    compute: () => {},
});
`;
        await expect(() =>
            compile(source, { apiVersion: 1, sourcePath: "bad-inputs.chart.ts" }),
        ).rejects.toBeInstanceOf(CompileError);
        try {
            await compile(source, { apiVersion: 1, sourcePath: "bad-inputs.chart.ts" });
        } catch (err) {
            expect(err).toBeInstanceOf(CompileError);
            const compileError = err as CompileError;
            expect(compileError.diagnostics[0]?.code).toBe("input-default-not-literal");
        }
    });

    it("produces byte-identical moduleSource on repeat compiles (determinism)", async () => {
        const a = await compile(EMA_CROSS, {
            apiVersion: 1,
            sourcePath: "ema-cross.chart.ts",
        });
        const b = await compile(EMA_CROSS, {
            apiVersion: 1,
            sourcePath: "ema-cross.chart.ts",
        });
        expect(a.moduleSource).toBe(b.moduleSource);
        expect(a.types).toBe(b.types);
    });

    it("defaults sourcePath to script.chart.ts when omitted", async () => {
        const result = await compile(VALID_DEFINE, { apiVersion: 1 });
        expect(result.manifest.name).toBe("demo");
    });

    it("supports inline sourcemaps", async () => {
        const result = await compile(EMA_CROSS, {
            apiVersion: 1,
            sourcePath: "ema-cross.chart.ts",
            sourcemap: "inline",
        });
        expect(result.moduleSource).toContain("sourceMappingURL=data:application/json;base64,");
        expect(result.sourcemap).toBeUndefined();
    });

    it("supports external sourcemaps", async () => {
        const result = await compile(EMA_CROSS, {
            apiVersion: 1,
            sourcePath: "ema-cross.chart.ts",
            sourcemap: "external",
        });
        expect(result.sourcemap).toBeTypeOf("string");
    });

    it("supports minification", async () => {
        const result = await compile(EMA_CROSS, {
            apiVersion: 1,
            sourcePath: "ema-cross.chart.ts",
            minify: true,
        });
        expect(result.moduleSource.length).toBeGreaterThan(0);
    });

    it("builds an empty CompileError message when given an empty diagnostic array", () => {
        const error = new CompileError([]);
        expect(error.message).toBe("Compilation failed");
        expect(error.diagnostics).toEqual([]);
    });

    it("produces a self-contained bundle with no `import` statements (data: URL ready)", async () => {
        // §5.2 contract: the compile output bundles `@invinite-org/chartlang-core`
        // and tree-shakes. Hosts load via `data:text/javascript` URLs which
        // cannot resolve bare specifiers — any surviving import line breaks
        // every browser worker + QuickJS load path.
        const result = await compile(EMA_CROSS, {
            apiVersion: 1,
            sourcePath: "ema-cross.chart.ts",
        });
        expect(result.moduleSource).not.toMatch(/^\s*import\b/m);
        expect(result.moduleSource).not.toContain("@invinite-org/chartlang-core");
        // The PLAN §5.2 budget for unminified output is ~5–50 KB; a leaked
        // `defineIndicator` body would not fit under the upper bound.
        expect(result.moduleSource.length).toBeGreaterThan(1_000);
        expect(result.moduleSource.length).toBeLessThan(60_000);
    });

    it("the real examples/scripts/ema-cross.chart.ts bundle is between 5KB and 50KB per PLAN §5.2", async () => {
        const realSrc = await readFile(
            new URL("../../../examples/scripts/ema-cross.chart.ts", import.meta.url),
            "utf8",
        );
        const result = await compile(realSrc, {
            apiVersion: 1,
            sourcePath: "examples/scripts/ema-cross.chart.ts",
        });
        // PLAN §5.2: compiled output is ~5-50 KB. Bundling pulls in core's
        // `defineIndicator` stub + supporting runtime shims; the bundled
        // size should land inside that envelope, while the previous
        // transform-only path produced ~1.3 KB (broken at runtime).
        expect(result.moduleSource.length).toBeGreaterThan(5_000);
        expect(result.moduleSource.length).toBeLessThan(50_000);
        expect(result.moduleSource).not.toMatch(/^\s*import\b/m);
    });

    it("the bundled output loads as an ES module via a data: URL and exposes a `default`", async () => {
        // This is the worker host (`createWorkerBoot.ts`'s `importCompiledModule`)
        // path simulated end-to-end: compile a real script, encode as a
        // `data:text/javascript;charset=utf-8,...` URL, dynamically `import` it,
        // and assert the default export is a callable `compute`.
        const result = await compile(EMA_CROSS, {
            apiVersion: 1,
            sourcePath: "ema-cross.chart.ts",
        });
        const dataUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(result.moduleSource)}`;
        const mod = (await import(/* @vite-ignore */ dataUrl)) as {
            readonly default: { readonly compute: (...args: unknown[]) => unknown };
            readonly __manifest: { readonly name: string };
        };
        expect(typeof mod.default).toBe("object");
        expect(typeof mod.default.compute).toBe("function");
        expect(mod.__manifest.name).toBe("EMA cross");
    });

    it("compiles a defineDrawing script with manifest.kind 'drawing' and capabilities ['drawings']", async () => {
        const DRAWING_SCRIPT = `
import { defineDrawing } from "@invinite-org/chartlang-core";
export default defineDrawing({
    name: "fib-tool",
    apiVersion: 1,
    compute: ({ draw }) => {
        draw.horizontalLine(100);
    },
});
`;
        const result = await compile(DRAWING_SCRIPT, {
            apiVersion: 1,
            sourcePath: "fib-tool.chart.ts",
        });
        expect(result.manifest.kind).toBe("drawing");
        expect(result.manifest.name).toBe("fib-tool");
        expect(result.manifest.capabilities).toEqual(["drawings"]);
    });
});

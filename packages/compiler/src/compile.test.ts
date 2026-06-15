// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { EMA_CROSS, MULTI_EXPORT_COMPOSITION, VALID_DEFINE } from "./__fixtures__/scripts.js";
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
    it("resolves core from `inMemoryModules` when provided", async () => {
        const result = await compile(VALID_DEFINE, {
            apiVersion: 1,
            sourcePath: "x.chart.ts",
            inMemoryModules: {
                "@invinite-org/chartlang-core": `
export function defineIndicator(o){ const __m = "IN_MEMORY_CORE_MARKER"; return { ...o, __m }; }
`,
            },
        });
        expect(result.moduleSource).toContain("IN_MEMORY_CORE_MARKER");
        expect(result.moduleSource).not.toMatch(/^\s*import\b/m);
    });

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

    it("emits 4 distinct callsite-id literals for the EMA-cross fixture", async () => {
        const result = await compile(EMA_CROSS, {
            apiVersion: 1,
            sourcePath: "ema-cross.chart.ts",
        });
        // 4 stateful callsites are rewritten with an injected id. The single
        // `plot` callsite's id also appears in the appended `__manifest`
        // `plots` array (the manifest echoes the injected id), so dedupe to
        // count distinct injected ids.
        const matches = result.moduleSource.match(/"ema-cross\.chart\.ts:\d+:\d+#0"/g) ?? [];
        expect(new Set(matches).size).toBe(4);
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

    it("emits a multi-export bundle with an indented manifest array tail", async () => {
        const result = await compile(MULTI_EXPORT_COMPOSITION, {
            apiVersion: 1,
            sourcePath: "multi.chart.ts",
        });
        // Default manifest carries the `siblings` field so the runtime
        // can mount the named exports alongside it.
        expect(result.manifest.exportName).toBe("default");
        expect(result.manifest.isDrawn).toBe(true);
        expect(result.manifest.siblings).toBeDefined();
        expect(result.manifest.siblings).toHaveLength(1);
        expect(result.moduleSource).toContain("__chartlang_depOutput");
        expect(result.moduleSource).toContain('"exportName": "default"');
        expect(result.moduleSource).toContain('"exportName": "sibling"');
    });

    it("emits a `__dependencies` export when the default manifest declares private deps", async () => {
        // Task 6 contract: hosts read `mod.__dependencies` to discover
        // every private dep and mount it as a `DepRunner`. The export
        // is prepended to the pre-bundle source (via
        // {@link formatDependenciesAssignment}) so esbuild keeps each
        // dep binding alive in the tree-shake — withInputs-derived
        // cross-file aliases reduce to bare references that the
        // tree-shaker would otherwise drop. After bundling esbuild
        // re-emits the export through the standard
        // `export { __dependencies, ... };` namespace block.
        const result = await compile(MULTI_EXPORT_COMPOSITION, {
            apiVersion: 1,
            sourcePath: "multi.chart.ts",
        });
        expect(result.moduleSource).toMatch(/var __dependencies = \[/);
        expect(result.moduleSource).toMatch(/export\s*\{[^}]*__dependencies/);
        expect(result.moduleSource).toContain('localId: "base"');
        expect(result.moduleSource).toContain("compiled: base");
    });

    it("omits `__dependencies` for single-script files (back-compat byte-identity)", async () => {
        const result = await compile(EMA_CROSS, {
            apiVersion: 1,
            sourcePath: "ema-cross.chart.ts",
        });
        expect(result.moduleSource).not.toContain("__dependencies");
    });

    it("bakes each producer's titled outputs onto its defineIndicator call so the runtime self-describes", async () => {
        // Phase-7 composition fix: every producer the runtime mounts
        // (private dep + named-export sibling) must carry
        // `outputs: [...]` on its define-call so `manifest.outputs` is
        // populated and the host allocates a dep-output ring buffer.
        const result = await compile(MULTI_EXPORT_COMPOSITION, {
            apiVersion: 1,
            sourcePath: "multi.chart.ts",
        });
        expect(result.moduleSource).toMatch(
            /name: "Base"[\s\S]*?outputs: \[\{ title: "line", kind: "series-number" \}\]/,
        );
        expect(result.moduleSource).toMatch(
            /name: "Sibling"[\s\S]*?outputs: \[\{ title: "echo", kind: "series-number" \}\]/,
        );
    });

    it("leaves a titled single-export script's outputs out of the bundle body when nothing consumes it untitled-only", async () => {
        // EMA_CROSS plots `fast` untitled, so the default has zero
        // titled outputs ⇒ no injection ⇒ no `outputs:` in the body.
        const result = await compile(EMA_CROSS, {
            apiVersion: 1,
            sourcePath: "ema-cross.chart.ts",
        });
        expect(result.moduleSource).not.toMatch(/outputs: \[\{ title:/);
    });

    it("compiles a cross-file consumer + producer via the default resolver and bakes the alias overrides into __dependencies", async () => {
        // Exercises `compile()`'s default cross-file resolver path —
        // no explicit `resolveProducer`, no `compileProject` driving
        // the recursion. The consumer's `baseTrend.withInputs({...})`
        // alias must reduce to a bare reference (so the runtime
        // sentinel never fires) and the merged effective inputs must
        // appear inside `__dependencies[i].inputOverrides`.
        const dir = await mkdtemp(join(tmpdir(), "chartlang-compile-xfile-"));
        try {
            const producerSource = `import { defineIndicator, input, plot, ta } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "cross-file producer",
    apiVersion: 1,
    overlay: true,
    inputs: { length: input.int(14, { min: 2, max: 250 }) },
    compute({ bar, ta, inputs, plot }) {
        plot(ta.ema(bar.close, inputs.length as number), { title: "line" });
    },
});`;
            const consumerSource = `import { defineIndicator, plot } from "@invinite-org/chartlang-core";
import baseTrend from "./base-trend.chart";
const trend = baseTrend.withInputs({ length: 30 });
export default defineIndicator({
    name: "cross-file consumer",
    apiVersion: 1,
    overlay: true,
    compute({ bar, plot }) {
        const value = trend.output("line").current;
        plot(value - bar.close, { title: "gap" });
    },
});`;
            await writeFile(join(dir, "base-trend.chart.ts"), producerSource, "utf8");
            const consumerPath = join(dir, "consumer.chart.ts");
            await writeFile(consumerPath, consumerSource, "utf8");
            const result = await compile(consumerSource, {
                apiVersion: 1,
                sourcePath: consumerPath,
            });
            // The producer is inlined as a self-contained IIFE.
            expect(result.moduleSource).toMatch(/__producer_[0-9a-f]+__default/);
            // The withInputs chain has been collapsed away.
            expect(result.moduleSource).not.toMatch(/baseTrend\.withInputs/);
            expect(result.moduleSource).toMatch(/var trend = baseTrend;/);
            // The merged effective inputs flow through __dependencies.
            expect(result.moduleSource).toMatch(/inputOverrides:\s*\{[^}]*"length":\s*30/);
            // The output accessor is rewritten to the runtime helper.
            expect(result.moduleSource).toContain("__chartlang_depOutput(");
            expect(result.moduleSource).toContain('"trend"');
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});

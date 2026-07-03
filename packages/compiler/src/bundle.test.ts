// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ScriptManifest } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import {
    bundleModule,
    formatCompiledDefaultRebind,
    formatDependenciesAssignment,
    formatManifestAssignment,
} from "./bundle.js";

const TS_SOURCE = `
const greeting: string = "hi";
export default greeting;
`;

describe("bundleModule", () => {
    it("returns ESM with no sourcemap field when sourcemap is false", async () => {
        const result = await bundleModule({
            transformedSource: TS_SOURCE,
            sourcePath: "demo.chart.ts",
            sourcemap: false,
            minify: false,
        });
        expect(result.moduleSource).toMatch(/export\s*\{/);
        expect("sourcemap" in result).toBe(false);
    });

    it("inlines `@invinite-org/chartlang-core` so no import statements remain", async () => {
        // §5.2: the bundle is self-contained ESM. With the previous
        // `esbuild.transform` codepath, the bare import line survived and the
        // worker / QuickJS hosts both failed to load the module.
        const src = `
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({ name: "x", apiVersion: 1, compute: () => {} });
`;
        const result = await bundleModule({
            transformedSource: src,
            sourcePath: "x.chart.ts",
            sourcemap: false,
            minify: false,
        });
        expect(result.moduleSource).not.toMatch(/^\s*import\b/m);
        expect(result.moduleSource).not.toContain("@invinite-org/chartlang-core");
    });

    it("resolves bare specifiers from `inMemoryModules` instead of disk", async () => {
        // Hosts that run the compiler where the workspace packages are not
        // resolvable on disk (e.g. a bundled serverless function) pass the
        // pre-bundled package source via `inMemoryModules`. The plugin's
        // resolve + load hooks short-circuit esbuild's filesystem walk.
        const src = `
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({ name: "x", apiVersion: 1, compute: () => {} });
`;
        const result = await bundleModule({
            transformedSource: src,
            sourcePath: "x.chart.ts",
            sourcemap: false,
            minify: false,
            inMemoryModules: {
                "@invinite-org/chartlang-core": `
export function defineIndicator(o){ const __m = "IN_MEMORY_MARKER"; return { ...o, __m }; }
`,
            },
        });
        expect(result.moduleSource).not.toMatch(/^\s*import\b/m);
        expect(result.moduleSource).toContain("IN_MEMORY_MARKER");
    });

    it("falls back to disk for specifiers absent from `inMemoryModules`", async () => {
        // The map is non-empty (so the plugin is installed) but does not
        // contain the imported specifier, so the resolve hook returns null
        // and esbuild resolves `@invinite-org/chartlang-core` from disk.
        const src = `
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({ name: "x", apiVersion: 1, compute: () => {} });
`;
        const result = await bundleModule({
            transformedSource: src,
            sourcePath: "x.chart.ts",
            sourcemap: false,
            minify: false,
            inMemoryModules: { "some-unused-package": "export const a = 1;" },
        });
        expect(result.moduleSource).not.toMatch(/^\s*import\b/m);
        expect(result.moduleSource).not.toContain("@invinite-org/chartlang-core");
    });

    it("returns external sourcemap JSON when sourcemap === 'external'", async () => {
        const result = await bundleModule({
            transformedSource: TS_SOURCE,
            sourcePath: "demo.chart.ts",
            sourcemap: "external",
            minify: false,
        });
        expect(result.sourcemap).toBeTypeOf("string");
        const parsed = JSON.parse(result.sourcemap ?? "{}");
        expect(parsed.version).toBe(3);
    });

    it("returns external sourcemap JSON when sourcemap === true", async () => {
        const result = await bundleModule({
            transformedSource: TS_SOURCE,
            sourcePath: "demo.chart.ts",
            sourcemap: true,
            minify: false,
        });
        expect(result.sourcemap).toBeTypeOf("string");
    });

    it("inlines the sourcemap into moduleSource when sourcemap === 'inline'", async () => {
        const result = await bundleModule({
            transformedSource: TS_SOURCE,
            sourcePath: "demo.chart.ts",
            sourcemap: "inline",
            minify: false,
        });
        expect("sourcemap" in result).toBe(false);
        expect(result.moduleSource).toContain("sourceMappingURL=data:application/json;base64,");
    });

    it("minifies the output when minify is true", async () => {
        const unmin = await bundleModule({
            transformedSource: TS_SOURCE,
            sourcePath: "demo.chart.ts",
            sourcemap: false,
            minify: false,
        });
        const min = await bundleModule({
            transformedSource: TS_SOURCE,
            sourcePath: "demo.chart.ts",
            sourcemap: false,
            minify: true,
        });
        expect(min.moduleSource.length).toBeLessThanOrEqual(unmin.moduleSource.length);
    });
});

describe("formatManifestAssignment", () => {
    it("emits an export const statement with parseable JSON", () => {
        const manifest: ScriptManifest = Object.freeze({
            apiVersion: 1,
            kind: "indicator",
            name: "demo",
            inputs: Object.freeze({}),
            capabilities: Object.freeze(["indicators"]),
            requestedIntervals: Object.freeze([]),
            userPickableInterval: false,
            seriesCapacities: Object.freeze({}),
            maxLookback: 0,
        });
        const line = formatManifestAssignment(manifest);
        expect(line.startsWith("export const __manifest = ")).toBe(true);
        expect(line.endsWith(";\n")).toBe(true);
        const jsonPart = line.replace(/^export const __manifest = /, "").replace(/;\n$/, "");
        expect(JSON.parse(jsonPart).name).toBe("demo");
    });

    it("is deterministic for identical manifests", () => {
        const manifest: ScriptManifest = Object.freeze({
            apiVersion: 1,
            kind: "indicator",
            name: "demo",
            inputs: Object.freeze({}),
            capabilities: Object.freeze(["indicators"]),
            requestedIntervals: Object.freeze([]),
            userPickableInterval: false,
            seriesCapacities: Object.freeze({}),
            maxLookback: 0,
        });
        expect(formatManifestAssignment(manifest)).toBe(formatManifestAssignment(manifest));
    });

    it("emits indented JSON array when given a ReadonlyArray of manifests", () => {
        const def: ScriptManifest = Object.freeze({
            apiVersion: 1,
            kind: "indicator",
            name: "Default",
            inputs: Object.freeze({}),
            capabilities: Object.freeze(["indicators"]),
            requestedIntervals: Object.freeze([]),
            userPickableInterval: false,
            seriesCapacities: Object.freeze({}),
            maxLookback: 0,
            exportName: "default",
            isDrawn: true,
        });
        const sibling: ScriptManifest = Object.freeze({
            apiVersion: 1,
            kind: "indicator",
            name: "Sibling",
            inputs: Object.freeze({}),
            capabilities: Object.freeze(["indicators"]),
            requestedIntervals: Object.freeze([]),
            userPickableInterval: false,
            seriesCapacities: Object.freeze({}),
            maxLookback: 0,
            exportName: "sibling",
            isDrawn: true,
        });
        const line = formatManifestAssignment(Object.freeze([def, sibling]));
        expect(line.startsWith("export const __manifest = [")).toBe(true);
        expect(line).toContain('"exportName": "default"');
        expect(line).toContain('"exportName": "sibling"');
        const json = line.replace(/^export const __manifest = /, "").replace(/;\n$/, "");
        const parsed = JSON.parse(json) as Array<{ exportName: string }>;
        expect(parsed).toHaveLength(2);
        expect(parsed[0]?.exportName).toBe("default");
        expect(parsed[1]?.exportName).toBe("sibling");
    });
});

describe("formatDependenciesAssignment", () => {
    it("returns the empty string when the deps list is empty", () => {
        expect(formatDependenciesAssignment([])).toBe("");
    });

    it("emits a single-entry export const __dependencies line", () => {
        const line = formatDependenciesAssignment([{ localId: "base", bindingExpression: "base" }]);
        expect(line).toBe(
            'export const __dependencies = [\n    { localId: "base", compiled: base },\n];\n',
        );
    });

    it("emits one entry per dep in declaration order", () => {
        const line = formatDependenciesAssignment([
            { localId: "fast", bindingExpression: "fast" },
            { localId: "slow", bindingExpression: "slow" },
        ]);
        expect(line).toContain('{ localId: "fast", compiled: fast },');
        expect(line).toContain('{ localId: "slow", compiled: slow },');
        // Declaration order is preserved.
        expect(line.indexOf("fast")).toBeLessThan(line.indexOf("slow"));
    });

    it("escapes special characters in the localId via JSON.stringify", () => {
        const line = formatDependenciesAssignment([
            { localId: 'has"quote', bindingExpression: "ok" },
        ]);
        expect(line).toContain('localId: "has\\"quote"');
    });
});

describe("bundleModule inlinedProducers", () => {
    it("synthesises the __chartlang_depOutput shim when producers are inlined", async () => {
        const result = await bundleModule({
            transformedSource: "export default 1;\n",
            sourcePath: "consumer.chart.ts",
            sourcemap: false,
            minify: false,
            inlinedProducers: [
                {
                    hash: "abc123",
                    rewrittenSource: "const __producer_abc123__default = 42;",
                },
            ],
        });
        expect(result.moduleSource).toContain("__chartlang_depOutput");
        expect(result.moduleSource).toContain("globalThis.__chartlang_depOutput");
    });

    it("tree-shakes unused inlined producers when not referenced from the consumer", async () => {
        // The shim is always emitted with producers, but esbuild's
        // tree-shaker removes the unused producer declaration when the
        // consumer never references the synthesised identifier.
        const result = await bundleModule({
            transformedSource: "export default 1;\n",
            sourcePath: "consumer.chart.ts",
            sourcemap: false,
            minify: false,
            inlinedProducers: [
                {
                    hash: "abc123",
                    rewrittenSource: "const __producer_abc123__default = 99;",
                },
            ],
        });
        expect(result.moduleSource).not.toContain("99");
    });
});

describe("formatCompiledDefaultRebind", () => {
    const manifest: ScriptManifest = Object.freeze({
        apiVersion: 1,
        kind: "indicator",
        name: "demo",
        inputs: Object.freeze({}),
        capabilities: Object.freeze(["indicators"]),
        requestedIntervals: Object.freeze([]),
        userPickableInterval: false,
        seriesCapacities: Object.freeze({ ohlcv: 6 }),
        maxLookback: 5,
    });

    it("reassigns the captured default binding to a frozen copy carrying the manifest", () => {
        const line = formatCompiledDefaultRebind(
            "var demo_chart_default = {};\nexport {\n  demo_chart_default as default\n};\n",
            manifest,
        );
        expect(line).toContain(
            "demo_chart_default = Object.freeze({ ...demo_chart_default, manifest: ",
        );
        expect(line).toContain(JSON.stringify(manifest));
        expect(line.endsWith(";\n")).toBe(true);
    });

    it("captures the default binding even amid co-exports", () => {
        const line = formatCompiledDefaultRebind(
            "export { a_chart_default as default, sib };\n",
            manifest,
        );
        expect(line.startsWith("a_chart_default = Object.freeze({ ...a_chart_default,")).toBe(true);
    });

    it("throws when the bundle has no `as default` export", () => {
        expect(() => formatCompiledDefaultRebind("export const x = 1;\n", manifest)).toThrow(
            /as default/,
        );
    });
});

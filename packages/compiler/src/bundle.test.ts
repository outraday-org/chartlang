// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ScriptManifest } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { bundleModule, formatManifestAssignment } from "./bundle.js";

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
});

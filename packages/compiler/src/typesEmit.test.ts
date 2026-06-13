// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ScriptManifest } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { emitTypes } from "./typesEmit.js";

const MANIFEST: ScriptManifest = Object.freeze({
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

describe("emitTypes", () => {
    it("emits a declarations file referencing CompiledScriptObject + __manifest", () => {
        const dts = emitTypes({ manifest: MANIFEST, sourcePath: "demo.chart.ts" });
        expect(dts).toContain(
            'import type { CompiledScriptObject, ScriptManifest } from "@invinite-org/chartlang-core"',
        );
        expect(dts).toContain("declare const script: CompiledScriptObject");
        expect(dts).toContain("export default script");
        expect(dts).toContain("export declare const __manifest: ScriptManifest");
    });

    it("is identical for identical manifests (deterministic)", () => {
        const a = emitTypes({ manifest: MANIFEST, sourcePath: "demo.chart.ts" });
        const b = emitTypes({ manifest: MANIFEST, sourcePath: "demo.chart.ts" });
        expect(a).toBe(b);
    });

    it("emits a typed output<K> overload when outputs are declared", () => {
        const m: ScriptManifest = Object.freeze({
            ...MANIFEST,
            outputs: Object.freeze([
                Object.freeze({ title: "line", kind: "series-number" as const }),
                Object.freeze({ title: "signal", kind: "series-number" as const }),
            ]),
        });
        const dts = emitTypes({ manifest: m, sourcePath: "demo.chart.ts" });
        expect(dts).toContain('output<K extends "line" | "signal">(name: K): Series<number>');
        expect(dts).toContain("declare const script: CompiledScriptObject &");
        expect(dts).toContain("export default script;");
        expect(dts).toContain("export declare const __manifest: ScriptManifest;");
    });

    it("emits per-export declarations when the manifest is an array", () => {
        const sibling: ScriptManifest = Object.freeze({
            ...MANIFEST,
            name: "Sibling",
            exportName: "sibling",
            isDrawn: true,
            outputs: Object.freeze([
                Object.freeze({ title: "line", kind: "series-number" as const }),
            ]),
        });
        const def: ScriptManifest = Object.freeze({
            ...MANIFEST,
            name: "Default",
            exportName: "default",
            isDrawn: true,
            outputs: Object.freeze([
                Object.freeze({ title: "cross", kind: "series-number" as const }),
            ]),
        });
        const dts = emitTypes({
            manifest: Object.freeze([def, sibling]),
            sourcePath: "demo.chart.ts",
        });
        expect(dts).toContain("declare const script: CompiledScriptObject &");
        expect(dts).toContain('output<K extends "cross">(name: K): Series<number>');
        expect(dts).toContain("declare const sibling: CompiledScriptObject &");
        expect(dts).toContain('output<K extends "line">(name: K): Series<number>');
        expect(dts).toContain("export { sibling };");
        expect(dts).toContain("export declare const __manifest: ReadonlyArray<ScriptManifest>;");
    });

    it("emits typed withInputs override using the inputs schema", () => {
        const m: ScriptManifest = Object.freeze({
            ...MANIFEST,
            inputs: Object.freeze({
                length: Object.freeze({ kind: "int", defaultValue: 14 }),
                src: Object.freeze({ kind: "source", defaultValue: "close" }),
                enabled: Object.freeze({ kind: "bool", defaultValue: true }),
            }),
            outputs: Object.freeze([
                Object.freeze({ title: "line", kind: "series-number" as const }),
            ]),
        });
        const dts = emitTypes({ manifest: m, sourcePath: "demo.chart.ts" });
        expect(dts).toContain(
            "withInputs(overrides: Readonly<{ length?: number; src?: string; enabled?: boolean }>):",
        );
    });

    it("emits the typed overload when a manifest carries dependencies but no outputs", () => {
        const m: ScriptManifest = Object.freeze({
            ...MANIFEST,
            dependencies: Object.freeze([
                Object.freeze({
                    localId: "base",
                    kind: "private" as const,
                    sourcePath: "demo.chart.ts",
                    producerExportName: "default",
                    inputs: Object.freeze({}),
                }),
            ]),
        });
        const dts = emitTypes({ manifest: m, sourcePath: "demo.chart.ts" });
        expect(dts).toContain("output<K extends never>(name: K)");
    });

    it("falls back to `unknown` for input descriptor kinds outside the type table", () => {
        const m: ScriptManifest = Object.freeze({
            ...MANIFEST,
            inputs: Object.freeze({
                weird: Object.freeze({ kind: "mystery", defaultValue: 0 }),
            }),
            outputs: Object.freeze([
                Object.freeze({ title: "line", kind: "series-number" as const }),
            ]),
        });
        const dts = emitTypes({ manifest: m, sourcePath: "demo.chart.ts" });
        expect(dts).toContain("weird?: unknown");
    });
});

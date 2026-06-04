// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ScriptManifest } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { emitTypes } from "./typesEmit";

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
});

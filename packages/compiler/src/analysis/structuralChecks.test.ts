// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { createProgramForSource } from "../program";
import { runStructuralChecks } from "./structuralChecks";

function run(source: string) {
    const { sourceFile, checker } = createProgramForSource(source, {
        sourcePath: "demo.chart.ts",
    });
    return runStructuralChecks(sourceFile, checker, "demo.chart.ts");
}

describe("runStructuralChecks", () => {
    it("accepts a defineIndicator default export with apiVersion 1 and captures name + kind", () => {
        const result = run(`
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({ name: "demo", apiVersion: 1, compute: () => {} });
`);
        expect(result.diagnostics).toHaveLength(0);
        expect(result.name).toBe("demo");
        expect(result.kind).toBe("indicator");
    });

    it("accepts a defineAlert default export and marks kind as alert", () => {
        const result = run(`
import { defineAlert } from "@invinite-org/chartlang-core";
export default defineAlert({ name: "rsi-overbought", apiVersion: 1, compute: () => {} });
`);
        expect(result.diagnostics).toHaveLength(0);
        expect(result.kind).toBe("alert");
    });

    it("accepts a defineDrawing default export and marks kind as drawing", () => {
        const result = run(`
import { defineDrawing } from "@invinite-org/chartlang-core";
export default defineDrawing({ name: "fib-tool", apiVersion: 1, compute: () => {} });
`);
        expect(result.diagnostics).toHaveLength(0);
        expect(result.name).toBe("fib-tool");
        expect(result.kind).toBe("drawing");
    });

    it("emits missing-default-export when the script has no default export", () => {
        const result = run(`
const x = 1;
export { x };
`);
        expect(result.diagnostics[0]?.code).toBe("missing-default-export");
    });

    it("emits missing-default-export when the default export is not a call", () => {
        const result = run(`
export default 42;
`);
        expect(result.diagnostics[0]?.code).toBe("missing-default-export");
    });

    it("emits missing-default-export when the default export is a non-core call", () => {
        const result = run(`
const f = () => ({});
export default f();
`);
        expect(result.diagnostics[0]?.code).toBe("missing-default-export");
    });

    it("emits api-version-mismatch when apiVersion is missing", () => {
        const result = run(`
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({ name: "demo", compute: () => {} });
`);
        expect(result.diagnostics[0]?.code).toBe("api-version-mismatch");
    });

    it("emits api-version-mismatch when apiVersion is not 1", () => {
        const result = run(`
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({ name: "demo", apiVersion: 2, compute: () => {} });
`);
        expect(result.diagnostics[0]?.code).toBe("api-version-mismatch");
    });

    it("emits api-version-mismatch when the argument is not an object literal", () => {
        const result = run(`
import { defineIndicator } from "@invinite-org/chartlang-core";
const opts = { name: "demo", apiVersion: 1, compute: () => {} };
export default defineIndicator(opts);
`);
        expect(result.diagnostics[0]?.code).toBe("api-version-mismatch");
    });

    it("ignores non-property-assignment members and string-keyed entries", () => {
        // The property loop must skip shorthand / spread / computed keys
        // without crashing. apiVersion is still required.
        const result = run(`
import { defineIndicator } from "@invinite-org/chartlang-core";
const name = "demo";
export default defineIndicator({ name, apiVersion: 1, compute: () => {}, "extra": 1 });
`);
        expect(result.diagnostics).toHaveLength(0);
        // shorthand `name` doesn't set the manifest name — falls back to "".
        expect(result.name).toBe("");
    });
});

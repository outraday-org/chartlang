// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { createProgramForSource } from "../program.js";
import { runStructuralChecks } from "./structuralChecks.js";

const API_VERSION_2_MESSAGE =
    "`apiVersion: 2` is not supported — this compiler implements the frozen `apiVersion: 1` contract. Future language versions require a compiler that declares support for them.";
const MISSING_API_VERSION_MESSAGE =
    "defineIndicator/defineDrawing/defineAlert/defineAlertCondition requires `apiVersion: 1` — the frozen language version this compiler implements.";

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

    it("accepts a defineAlertCondition default export and marks kind as alertCondition", () => {
        const result = run(`
import { defineAlertCondition } from "@invinite-org/chartlang-core";
export default defineAlertCondition({
    name: "cross",
    apiVersion: 1,
    conditions: {
        up: { title: "Up", description: "desc", defaultMessage: "msg" },
    },
    compute: () => {},
});
`);

        expect(result.diagnostics).toEqual([]);
        expect(result.kind).toBe("alertCondition");
        expect(result.name).toBe("cross");
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

    it("extracts defineIndicator script overrides from static literals", () => {
        const result = run(`
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "demo",
    apiVersion: 1,
    maxBarsBack: 100,
    format: "percent",
    precision: 4,
    scale: "right",
    requiresIntervals: ["1D", "1W"],
    shortName: "DEMO",
    compute: () => {},
});
`);
        expect(result.diagnostics).toHaveLength(0);
        expect(result.overrides).toEqual({
            maxBarsBack: 100,
            format: "percent",
            precision: 4,
            scale: "right",
            requiresIntervals: ["1D", "1W"],
            shortName: "DEMO",
        });
        expect(Object.isFrozen(result.overrides.requiresIntervals)).toBe(true);
    });

    it("keeps defineAlert and defineDrawing override subsets distinct", () => {
        const alertResult = run(`
import { defineAlert } from "@invinite-org/chartlang-core";
export default defineAlert({
    name: "alert",
    apiVersion: 1,
    maxBarsBack: 100,
    format: "percent",
    precision: 4,
    scale: "right",
    requiresIntervals: ["1D"],
    shortName: "AL",
    compute: () => {},
});
`);
        const drawingResult = run(`
import { defineDrawing } from "@invinite-org/chartlang-core";
export default defineDrawing({
    name: "drawing",
    apiVersion: 1,
    maxBarsBack: 100,
    format: "price",
    precision: 2,
    scale: "right",
    requiresIntervals: ["1H"],
    shortName: "DR",
    compute: () => {},
});
`);
        expect(alertResult.overrides).toEqual({
            maxBarsBack: 100,
            requiresIntervals: ["1D"],
            shortName: "AL",
        });
        expect(drawingResult.overrides).toEqual({
            format: "price",
            precision: 2,
            requiresIntervals: ["1H"],
            shortName: "DR",
        });
    });

    it("ignores unsupported and non-literal override values", () => {
        const result = run(`
import { defineIndicator } from "@invinite-org/chartlang-core";
const intervals = ["1D"];
export default defineIndicator({
    name: "demo",
    apiVersion: 1,
    maxBarsBack: "100",
    format: "inherit",
    precision: "4",
    scale: "none",
    requiresIntervals: intervals,
    shortName: 123,
    compute: () => {},
});
`);
        expect(result.diagnostics).toHaveLength(0);
        expect(result.overrides).toEqual({});
    });

    it("ignores non-string format, scale, and interval-list entries", () => {
        const result = run(`
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "demo",
    apiVersion: 1,
    format: 1,
    scale: 1,
    requiresIntervals: [1],
    compute: () => {},
});
`);
        expect(result.diagnostics).toHaveLength(0);
        expect(result.overrides).toEqual({});
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
        expect(result.diagnostics[0]?.message).toBe(MISSING_API_VERSION_MESSAGE);
    });

    it("emits api-version-mismatch when apiVersion is not 1", () => {
        const result = run(`
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({ name: "demo", apiVersion: 2, compute: () => {} });
`);
        expect(result.diagnostics[0]?.code).toBe("api-version-mismatch");
        expect(result.diagnostics[0]?.message).toBe(API_VERSION_2_MESSAGE);
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

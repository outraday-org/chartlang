// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { createProgramForSource } from "../program";
import { extractInputs } from "./extractInputs";

function run(defaultValue: number, min: number, max: number) {
    const source = `
import { defineIndicator, input } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    inputs: { len: input.int(${defaultValue}, { min: ${min}, max: ${max}, title: "Length" }) },
    compute: () => {},
});
`;
    const { sourceFile, checker } = createProgramForSource(source, {
        sourcePath: "property.chart.ts",
    });
    return extractInputs(sourceFile, checker, "property.chart.ts");
}

describe("extractInputs — properties", () => {
    it("round-trips literal int defaults and range opts", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: -1_000_000, max: 1_000_000 }),
                fc.integer({ min: -1_000_000, max: 1_000_000 }),
                fc.integer({ min: -1_000_000, max: 1_000_000 }),
                (defaultValue, a, b) => {
                    const min = Math.min(a, b);
                    const max = Math.max(a, b);
                    const result = run(defaultValue, min, max);
                    expect(result.diagnostics).toEqual([]);
                    expect(result.inputs.len).toEqual({
                        kind: "int",
                        defaultValue,
                        min,
                        max,
                        title: "Length",
                    });
                },
            ),
            { numRuns: 100 },
        );
    });
});

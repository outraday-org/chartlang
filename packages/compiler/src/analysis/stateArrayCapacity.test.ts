// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { createProgramForSource } from "../program.js";
import { MAX_STATE_ARRAY_CAPACITY, runStateArrayCapacity } from "./stateArrayCapacity.js";

function run(source: string) {
    const { sourceFile, checker } = createProgramForSource(source, {
        sourcePath: "demo.chart.ts",
    });
    return runStateArrayCapacity(sourceFile, checker, "demo.chart.ts");
}

const IMPORT = `import { state } from "@invinite-org/chartlang-core";\n`;

describe("runStateArrayCapacity", () => {
    it("accepts a bare numeric-literal capacity", () => {
        const result = run(`${IMPORT}const a = state.array<number>(20); void a;`);
        expect(result).toHaveLength(0);
    });

    it("accepts a parenthesised / unary-plus numeric literal", () => {
        const result = run(`${IMPORT}const a = state.array<number>(+(20)); void a;`);
        expect(result).toHaveLength(0);
    });

    it("accepts a `const` numeric-literal binding", () => {
        const result = run(`${IMPORT}const K = 20;\nconst a = state.array<number>(K); void a;`);
        expect(result).toHaveLength(0);
    });

    it("rejects a `let` binding capacity as not-literal", () => {
        const result = run(`${IMPORT}let len = 20;\nconst a = state.array<number>(len); void a;`);
        expect(result[0]?.code).toBe("state-array-capacity-not-literal");
        expect(result).toHaveLength(1);
    });

    it("rejects a runtime-expression capacity as not-literal", () => {
        const result = run(
            `${IMPORT}declare const n: number;\nconst a = state.array<number>(n * 2); void a;`,
        );
        expect(result[0]?.code).toBe("state-array-capacity-not-literal");
    });

    it("rejects a missing capacity argument as not-literal at the call node", () => {
        // `state.array()` is syntactically valid source; the analysis pass runs
        // pre-typecheck, so the no-argument arm is reachable from real source.
        const result = run(`${IMPORT}const a = state.array<number>(); void a;`);
        expect(result[0]?.code).toBe("state-array-capacity-not-literal");
    });

    it("reports the not-literal diagnostic at the argument span", () => {
        // The argument-span diagnostic points at `len`, not the whole call.
        const result = run(`${IMPORT}let len = 20;\nconst a = state.array<number>(len); void a;`);
        expect(result[0]?.line).toBe(3);
        expect(result[0]?.column).toBe(31);
    });

    it("rejects a zero capacity as exceeds-max", () => {
        const result = run(`${IMPORT}const a = state.array<number>(0); void a;`);
        expect(result[0]?.code).toBe("state-array-capacity-exceeds-max");
    });

    it("rejects a negative capacity as exceeds-max", () => {
        const result = run(`${IMPORT}const a = state.array<number>(-5); void a;`);
        expect(result[0]?.code).toBe("state-array-capacity-exceeds-max");
    });

    it("rejects a non-integer capacity as exceeds-max", () => {
        const result = run(`${IMPORT}const a = state.array<number>(2.5); void a;`);
        expect(result[0]?.code).toBe("state-array-capacity-exceeds-max");
    });

    it("rejects an over-cap capacity as exceeds-max", () => {
        const over = MAX_STATE_ARRAY_CAPACITY + 1;
        const result = run(`${IMPORT}const a = state.array<number>(${over}); void a;`);
        expect(result[0]?.code).toBe("state-array-capacity-exceeds-max");
        expect(result[0]?.message).toContain(String(over));
    });

    it("accepts the exact MAX_STATE_ARRAY_CAPACITY", () => {
        const result = run(
            `${IMPORT}const a = state.array<number>(${MAX_STATE_ARRAY_CAPACITY}); void a;`,
        );
        expect(result).toHaveLength(0);
    });

    it('does not match the element-access form (`state["array"]`)', () => {
        // `state["array"](20)` is rejected upstream as
        // `stateful-call-element-access`; it must NOT be double-reported here.
        const result = run(`${IMPORT}const a = state["array"](20); void a;`);
        expect(result).toHaveLength(0);
    });

    it("ignores unrelated calls", () => {
        const result = run(`${IMPORT}const a = state.float(0); void a;\nMath.floor(1.5);`);
        expect(result).toHaveLength(0);
    });
});

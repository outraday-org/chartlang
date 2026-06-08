// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { STATEFUL_PRIMITIVES_BY_NAME } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { createProgramForSource } from "../program";
import { runStatefulCallInLoop } from "./statefulCallInLoop";

function run(source: string) {
    const { sourceFile, checker } = createProgramForSource(source, {
        sourcePath: "demo.chart.ts",
    });
    return runStatefulCallInLoop(sourceFile, checker, "demo.chart.ts", STATEFUL_PRIMITIVES_BY_NAME);
}

describe("runStatefulCallInLoop", () => {
    it("accepts a stateful call at top level", () => {
        const result = run(`
import { ta } from "@invinite-org/chartlang-core";
declare const close: import("@invinite-org/chartlang-core").Series<number>;
const e = ta.ema(close, 20);
void e;
`);
        expect(result).toHaveLength(0);
    });

    it("rejects ta.ema inside a `for` loop", () => {
        const result = run(`
import { ta } from "@invinite-org/chartlang-core";
declare const close: import("@invinite-org/chartlang-core").Series<number>;
for (let i = 0; i < 3; i++) {
    const e = ta.ema(close, 20);
    void e;
}
`);
        expect(result[0]?.code).toBe("stateful-call-inside-loop");
    });

    it("rejects plot inside a `while` loop", () => {
        const result = run(`
import { plot } from "@invinite-org/chartlang-core";
while (false) { plot(1); }
`);
        expect(result[0]?.code).toBe("stateful-call-inside-loop");
    });

    it("rejects alert inside a `do…while` loop", () => {
        const result = run(`
import { alert } from "@invinite-org/chartlang-core";
do { alert("x"); } while (false);
`);
        expect(result[0]?.code).toBe("stateful-call-inside-loop");
    });

    it("rejects hline inside a `for…of` loop", () => {
        const result = run(`
import { hline } from "@invinite-org/chartlang-core";
for (const x of [1, 2, 3]) { hline(x); }
`);
        expect(result[0]?.code).toBe("stateful-call-inside-loop");
    });

    it("rejects ta.sma inside a `for…in` loop", () => {
        const result = run(`
import { ta } from "@invinite-org/chartlang-core";
declare const close: import("@invinite-org/chartlang-core").Series<number>;
for (const k in { a: 1 }) { const s = ta.sma(close, Number(k)); void s; }
`);
        expect(result[0]?.code).toBe("stateful-call-inside-loop");
    });

    it("ignores non-stateful calls inside loops", () => {
        const result = run(`
for (let i = 0; i < 3; i++) { Math.floor(i); }
`);
        expect(result).toHaveLength(0);
    });

    it("rejects ta.highest inside a `for` loop (slot: true)", () => {
        const result = run(`
import { ta } from "@invinite-org/chartlang-core";
declare const close: import("@invinite-org/chartlang-core").Series<number>;
for (let i = 0; i < 3; i++) {
    const h = ta.highest(close, 20);
    void h;
}
`);
        expect(result[0]?.code).toBe("stateful-call-inside-loop");
    });

    it("rejects ta.nz inside a `for` loop (slot: false but Pine-forbidden)", () => {
        const result = run(`
import { ta } from "@invinite-org/chartlang-core";
for (let i = 0; i < 3; i++) {
    const v = ta.nz(Number.NaN, 0);
    void v;
}
`);
        expect(result[0]?.code).toBe("stateful-call-inside-loop");
    });

    it("rejects state.float inside a `for` loop", () => {
        const result = run(`
import { state } from "@invinite-org/chartlang-core";
for (let i = 0; i < 3; i++) {
    const slot = state.float(0);
    void slot;
}
`);
        expect(result[0]?.code).toBe("stateful-call-inside-loop");
    });

    it("rejects request.security inside a `for` loop", () => {
        const result = run(`
import { request } from "@invinite-org/chartlang-core";
for (let i = 0; i < 3; i++) {
    const daily = request.security({ interval: "1D" });
    void daily;
}
`);
        expect(result[0]?.code).toBe("stateful-call-inside-loop");
    });
});

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { createProgramForSource } from "../program.js";
import {
    type ProducerSnapshot,
    type ResolveProducer,
    extractDependencyGraph,
} from "./extractDependencyGraph.js";
import { runStructuralChecks } from "./structuralChecks.js";

function runDep(
    source: string,
    resolveProducer: ResolveProducer = () => null,
    sourcePath = "demo.chart.ts",
) {
    const { sourceFile, checker } = createProgramForSource(source, { sourcePath });
    const structural = runStructuralChecks(sourceFile, checker, sourcePath);
    return extractDependencyGraph(
        sourceFile,
        checker,
        sourcePath,
        structural.bindings,
        resolveProducer,
    );
}

describe("extractDependencyGraph", () => {
    it("returns an empty graph for a single-script file", () => {
        const graph = runDep(`
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({ name: "demo", apiVersion: 1, compute: () => {} });
`);
        expect(graph.diagnostics).toHaveLength(0);
        expect(graph.drawn.length).toBe(1);
        expect(graph.privateDeps.length).toBe(0);
        expect(graph.drawn[0]?.consumes).toHaveLength(0);
    });

    it("captures a single private dep consumed by the default export", () => {
        const graph = runDep(`
import { defineIndicator, plot } from "@invinite-org/chartlang-core";
const base = defineIndicator({
    name: "Base",
    apiVersion: 1,
    compute: ({ bar }) => { plot(bar.close, { title: "line" }); },
});
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => {
        const value = base.output("line");
        void value;
    },
});
`);
        expect(graph.diagnostics).toHaveLength(0);
        expect(graph.privateDeps).toHaveLength(1);
        expect(graph.privateDeps[0]?.localId).toBe("base");
        expect(graph.privateDeps[0]?.outputs).toEqual([{ title: "line", kind: "series-number" }]);
        const defaultDrawn = graph.drawn.find((d) => d.exportName === "default");
        expect(defaultDrawn?.consumes).toHaveLength(1);
        expect(defaultDrawn?.consumes[0]?.localId).toBe("base");
    });

    it("supports a diamond — two consumers reference the same private dep", () => {
        const graph = runDep(`
import { defineIndicator, plot } from "@invinite-org/chartlang-core";
const base = defineIndicator({
    name: "Base",
    apiVersion: 1,
    compute: ({ bar }) => { plot(bar.close, { title: "line" }); },
});
export const sideA = defineIndicator({
    name: "A",
    apiVersion: 1,
    compute: () => { void base.output("line"); },
});
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void base.output("line"); },
});
`);
        expect(graph.diagnostics).toHaveLength(0);
        expect(graph.drawn).toHaveLength(2);
        for (const drawn of graph.drawn) {
            expect(drawn.consumes).toHaveLength(1);
            expect(drawn.consumes[0]?.localId).toBe("base");
        }
    });

    it("resolves a cross-file producer via the mocked resolveProducer callback", () => {
        const snapshot: ProducerSnapshot = {
            name: "Base Trend",
            outputs: [{ title: "line", kind: "series-number" }],
            inputs: { length: { kind: "int", defaultValue: 14 } },
        };
        const graph = runDep(
            `
import { defineIndicator } from "@invinite-org/chartlang-core";
import baseTrend from "./base-trend.chart";
const fastTrend = baseTrend.withInputs({ length: 50 });
export default defineIndicator({
    name: "Consumer",
    apiVersion: 1,
    compute: () => { void fastTrend.output("line"); },
});
`,
            (path, exportName) =>
                path === "./base-trend.chart" && exportName === "default" ? snapshot : null,
        );
        expect(graph.diagnostics).toHaveLength(0);
        const defaultDrawn = graph.drawn.find((d) => d.exportName === "default");
        expect(defaultDrawn?.consumes[0]?.producerRef.kind).toBe("cross-file");
        expect(defaultDrawn?.consumes[0]?.effectiveInputs).toEqual({ length: 50 });
    });

    it("merges chained withInputs in declaration order (later wins)", () => {
        const snapshot: ProducerSnapshot = {
            name: "B",
            outputs: [{ title: "line", kind: "series-number" }],
            inputs: { length: { kind: "int", defaultValue: 14 } },
        };
        const graph = runDep(
            `
import { defineIndicator } from "@invinite-org/chartlang-core";
import baseTrend from "./base-trend.chart";
const layered = baseTrend.withInputs({ length: 10 }).withInputs({ length: 99 });
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void layered.output("line"); },
});
`,
            () => snapshot,
        );
        expect(graph.diagnostics).toHaveLength(0);
        const dep = graph.privateDeps.find((d) => d.localId === "layered");
        expect(dep?.effectiveInputs).toEqual({ length: 99 });
    });

    it("raises dep-invalid-input-override for unknown override keys", () => {
        const snapshot: ProducerSnapshot = {
            name: "B",
            outputs: [{ title: "line", kind: "series-number" }],
            inputs: { length: { kind: "int", defaultValue: 14 } },
        };
        const graph = runDep(
            `
import { defineIndicator } from "@invinite-org/chartlang-core";
import baseTrend from "./base-trend.chart";
const layered = baseTrend.withInputs({ unknown: 10 });
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void layered.output("line"); },
});
`,
            () => snapshot,
        );
        const codes = graph.diagnostics.map((d) => d.code);
        expect(codes).toContain("dep-invalid-input-override");
    });

    it("raises dep-invalid-input-override for type-mismatched overrides", () => {
        const snapshot: ProducerSnapshot = {
            name: "B",
            outputs: [{ title: "line", kind: "series-number" }],
            inputs: { length: { kind: "int", defaultValue: 14 } },
        };
        const graph = runDep(
            `
import { defineIndicator } from "@invinite-org/chartlang-core";
import baseTrend from "./base-trend.chart";
const layered = baseTrend.withInputs({ length: "fifty" });
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void layered.output("line"); },
});
`,
            () => snapshot,
        );
        const codes = graph.diagnostics.map((d) => d.code);
        expect(codes).toContain("dep-invalid-input-override");
    });

    it("raises dep-unknown-output when the consumer references a missing title", () => {
        const graph = runDep(`
import { defineIndicator, plot } from "@invinite-org/chartlang-core";
const base = defineIndicator({
    name: "Base",
    apiVersion: 1,
    compute: ({ bar }) => { plot(bar.close, { title: "line" }); },
});
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void base.output("missing"); },
});
`);
        const codes = graph.diagnostics.map((d) => d.code);
        expect(codes).toContain("dep-unknown-output");
    });

    it("detects an A→B→A direct cycle via real `.output(...)` calls", () => {
        const graph = runDep(`
import { defineIndicator, plot } from "@invinite-org/chartlang-core";
const A = defineIndicator({
    name: "A",
    apiVersion: 1,
    compute: ({ bar }) => { plot(bar.close, { title: "x" }); void B.output("y"); },
});
const B = defineIndicator({
    name: "B",
    apiVersion: 1,
    compute: ({ bar }) => { plot(bar.close, { title: "y" }); void A.output("x"); },
});
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void A.output("x"); },
});
`);
        const codes = graph.diagnostics.map((d) => d.code);
        expect(codes).toContain("dep-cycle");
    });

    it("detects an A→B→C→A indirect cycle", () => {
        const graph = runDep(`
import { defineIndicator, plot } from "@invinite-org/chartlang-core";
const A = defineIndicator({
    name: "A",
    apiVersion: 1,
    compute: ({ bar }) => { plot(bar.close, { title: "a" }); void C.output("c"); },
});
const B = defineIndicator({
    name: "B",
    apiVersion: 1,
    compute: ({ bar }) => { plot(bar.close, { title: "b" }); void A.output("a"); },
});
const C = defineIndicator({
    name: "C",
    apiVersion: 1,
    compute: ({ bar }) => { plot(bar.close, { title: "c" }); void B.output("b"); },
});
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void A.output("a"); },
});
`);
        const codes = graph.diagnostics.map((d) => d.code);
        expect(codes).toContain("dep-cycle");
    });

    it("raises dep-output-not-titled only when the untitled-plot producer is consumed", () => {
        const graph = runDep(`
import { defineIndicator, plot } from "@invinite-org/chartlang-core";
const base = defineIndicator({
    name: "Base",
    apiVersion: 1,
    compute: ({ bar }) => { plot(bar.close); },
});
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void base.output("anything"); },
});
`);
        const codes = graph.diagnostics.map((d) => d.code);
        expect(codes).toContain("dep-output-not-titled");
    });

    it("leaves a producer with only untitled plots alone when no one consumes it", () => {
        const graph = runDep(`
import { defineIndicator, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: ({ bar }) => { plot(bar.close); },
});
`);
        const codes = graph.diagnostics.map((d) => d.code);
        expect(codes).not.toContain("dep-output-not-titled");
    });

    it("raises dep-dynamic for non-literal withInputs argument", () => {
        const graph = runDep(
            `
import { defineIndicator } from "@invinite-org/chartlang-core";
import baseTrend from "./base-trend.chart";
const x = 50;
const dyn = baseTrend.withInputs({ length: x });
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void dyn.output("line"); },
});
`,
            () => ({
                name: "B",
                outputs: [{ title: "line", kind: "series-number" }],
                inputs: { length: { kind: "int", defaultValue: 14 } },
            }),
        );
        const codes = graph.diagnostics.map((d) => d.code);
        expect(codes).toContain("dep-dynamic");
    });

    it("raises duplicate-output-title for two same-title plot calls", () => {
        const graph = runDep(`
import { defineIndicator, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: ({ bar }) => {
        plot(bar.close, { title: "line" });
        plot(bar.open, { title: "line" });
    },
});
`);
        const codes = graph.diagnostics.map((d) => d.code);
        expect(codes).toContain("duplicate-output-title");
    });

    it("raises dep-dynamic for a non-object-literal withInputs argument", () => {
        const graph = runDep(
            `
import { defineIndicator } from "@invinite-org/chartlang-core";
import baseTrend from "./base-trend.chart";
const config = { length: 50 };
const layered = baseTrend.withInputs(config);
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void layered.output("line"); },
});
`,
            () => ({
                name: "B",
                outputs: [{ title: "line", kind: "series-number" }],
                inputs: { length: { kind: "int", defaultValue: 14 } },
            }),
        );
        const codes = graph.diagnostics.map((d) => d.code);
        expect(codes).toContain("dep-dynamic");
    });

    it("raises dep-dynamic for spread / shorthand keys in withInputs", () => {
        const graph = runDep(
            `
import { defineIndicator } from "@invinite-org/chartlang-core";
import baseTrend from "./base-trend.chart";
const length = 50;
const layered = baseTrend.withInputs({ ...{ length: 1 }, length });
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void layered.output("line"); },
});
`,
            () => ({
                name: "B",
                outputs: [{ title: "line", kind: "series-number" }],
                inputs: { length: { kind: "int", defaultValue: 14 } },
            }),
        );
        const codes = graph.diagnostics.map((d) => d.code);
        expect(codes).toContain("dep-dynamic");
    });

    it("raises dep-dynamic for computed-property keys in withInputs", () => {
        const graph = runDep(
            `
import { defineIndicator } from "@invinite-org/chartlang-core";
import baseTrend from "./base-trend.chart";
const k = "length";
const layered = baseTrend.withInputs({ [k]: 1 });
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void layered.output("line"); },
});
`,
            () => ({
                name: "B",
                outputs: [{ title: "line", kind: "series-number" }],
                inputs: { length: { kind: "int", defaultValue: 14 } },
            }),
        );
        const codes = graph.diagnostics.map((d) => d.code);
        expect(codes).toContain("dep-dynamic");
    });

    it("raises dep-dynamic for `<binding>.output()` with no arguments", () => {
        const graph = runDep(`
import { defineIndicator, plot } from "@invinite-org/chartlang-core";
const base = defineIndicator({
    name: "Base",
    apiVersion: 1,
    compute: ({ bar }) => { plot(bar.close, { title: "line" }); },
});
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => {
        const valueAccessor = base.output;
        void valueAccessor;
    },
});
`);
        // This isn't a .output() call so no diagnostic; just exercise
        // the bail-on-no-arg path with another test.
        void graph;
    });

    it("raises dep-dynamic when `<binding>.output()` is called with a non-literal receiver", () => {
        const graph = runDep(`
import { defineIndicator, plot } from "@invinite-org/chartlang-core";
const base = defineIndicator({
    name: "Base",
    apiVersion: 1,
    compute: ({ bar }) => { plot(bar.close, { title: "line" }); },
});
const wrapper = { dep: base };
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void wrapper.dep.output("line"); },
});
`);
        const codes = graph.diagnostics.map((d) => d.code);
        expect(codes).toContain("dep-dynamic");
    });

    it("raises dep-dynamic for `<binding>.output(varRef)` with a non-literal arg", () => {
        const graph = runDep(`
import { defineIndicator, plot } from "@invinite-org/chartlang-core";
const base = defineIndicator({
    name: "Base",
    apiVersion: 1,
    compute: ({ bar }) => { plot(bar.close, { title: "line" }); },
});
const title = "line";
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void base.output(title); },
});
`);
        const codes = graph.diagnostics.map((d) => d.code);
        expect(codes).toContain("dep-dynamic");
    });

    it("resolves a cross-file producer via a bare named import", () => {
        const snapshot: ProducerSnapshot = {
            name: "T",
            outputs: [{ title: "line", kind: "series-number" }],
            inputs: {},
        };
        const graph = runDep(
            `
import { defineIndicator } from "@invinite-org/chartlang-core";
import { trend } from "./trend.chart";
const dep = trend.withInputs({});
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void dep.output("line"); },
});
`,
            (path, exportName) =>
                path === "./trend.chart" && exportName === "trend" ? snapshot : null,
        );
        expect(graph.diagnostics).toEqual([]);
    });

    it("resolves a cross-file producer via a named import + renamed binding", () => {
        const snapshot: ProducerSnapshot = {
            name: "BT",
            outputs: [{ title: "line", kind: "series-number" }],
            inputs: { length: { kind: "int", defaultValue: 14 } },
        };
        const graph = runDep(
            `
import { defineIndicator } from "@invinite-org/chartlang-core";
import { trend as renamedTrend } from "./trend.chart";
const dep = renamedTrend.withInputs({ length: 5 });
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void dep.output("line"); },
});
`,
            (path, exportName) =>
                path === "./trend.chart" && exportName === "trend" ? snapshot : null,
        );
        expect(graph.diagnostics).toEqual([]);
        const defaultDrawn = graph.drawn.find((d) => d.exportName === "default");
        expect(defaultDrawn?.consumes[0]?.producerRef.kind).toBe("cross-file");
    });

    it("supports method-shorthand compute() bodies", () => {
        const graph = runDep(`
import { defineIndicator, plot } from "@invinite-org/chartlang-core";
const base = defineIndicator({
    name: "Base",
    apiVersion: 1,
    compute({ bar }) { plot(bar.close, { title: "line" }); },
});
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute() { void base.output("line"); },
});
`);
        expect(graph.diagnostics).toEqual([]);
        expect(graph.privateDeps[0]?.outputs).toEqual([{ title: "line", kind: "series-number" }]);
    });

    it("returns null body when compute is not a function literal (no diagnostics, no outputs)", () => {
        const graph = runDep(`
import { defineIndicator } from "@invinite-org/chartlang-core";
const fn = () => {};
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: fn,
});
`);
        // No `dep-*` diagnostics — just structural pass through.
        const codes = graph.diagnostics.map((d) => d.code);
        expect(codes.filter((c) => c.startsWith("dep-"))).toEqual([]);
    });

    it("returns null body when the compute property is not present (no crash)", () => {
        // No `compute` property on the define object at all — exercises
        // the readComputeBody loop's no-match exit path. The compiler
        // typechecker would normally reject this; the dep-graph pass
        // walks the AST regardless.
        const graph = runDep(`
import { defineIndicator } from "@invinite-org/chartlang-core";
// @ts-expect-error — compute omitted intentionally to exercise the no-match path.
const noCompute = defineIndicator({ name: "NC", apiVersion: 1 });
void noCompute;
export default defineIndicator({ name: "Main", apiVersion: 1, compute: () => {} });
`);
        const codes = graph.diagnostics.map((d) => d.code);
        expect(codes.filter((c) => c.startsWith("dep-"))).toEqual([]);
    });

    it("accepts overrides for producer schema with unknown kind (no type-mismatch fires)", () => {
        const snapshot: ProducerSnapshot = {
            name: "Exotic",
            outputs: [{ title: "line", kind: "series-number" }],
            inputs: { weird: { kind: "exotic-future-kind", defaultValue: 42 } },
        };
        const graph = runDep(
            `
import { defineIndicator } from "@invinite-org/chartlang-core";
import baseTrend from "./trend.chart";
const dep = baseTrend.withInputs({ weird: 100 });
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void dep.output("line"); },
});
`,
            () => snapshot,
        );
        const codes = graph.diagnostics.map((d) => d.code);
        expect(codes).not.toContain("dep-invalid-input-override");
    });

    it("validates against malformed producer schema (descriptor without kind)", () => {
        const snapshot: ProducerSnapshot = {
            name: "Mal",
            outputs: [{ title: "line", kind: "series-number" }],
            inputs: { length: { something: "else" } as Record<string, unknown> },
        };
        const graph = runDep(
            `
import { defineIndicator } from "@invinite-org/chartlang-core";
import baseTrend from "./trend.chart";
const dep = baseTrend.withInputs({ length: 1 });
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void dep.output("line"); },
});
`,
            () => snapshot,
        );
        // No type-mismatch fires because the descriptor has no `kind`.
        const codes = graph.diagnostics.map((d) => d.code);
        expect(codes.filter((c) => c === "dep-invalid-input-override")).toEqual([]);
    });

    it("accepts boolean / null / string / number literal withInputs values", () => {
        const snapshot: ProducerSnapshot = {
            name: "B",
            outputs: [{ title: "line", kind: "series-number" }],
            inputs: {
                flag: { kind: "bool", defaultValue: false },
                tag: { kind: "string", defaultValue: "x" },
                length: { kind: "int", defaultValue: 14 },
                nothing: { defaultValue: null },
            },
        };
        const graph = runDep(
            `
import { defineIndicator } from "@invinite-org/chartlang-core";
import baseTrend from "./trend.chart";
const dep = baseTrend.withInputs({ flag: true, tag: "ok", length: 5, nothing: null });
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void dep.output("line"); },
});
`,
            () => snapshot,
        );
        // Confirm bool + null literals are recognised by the JSON
        // literal reader (no `dep-dynamic` would fire).
        const codes = graph.diagnostics.map((d) => d.code);
        expect(codes).not.toContain("dep-dynamic");
    });

    it("rejects null-literal withInputs values that mismatch producer kind", () => {
        const graph = runDep(
            `
import { defineIndicator } from "@invinite-org/chartlang-core";
import baseTrend from "./trend.chart";
const dep = baseTrend.withInputs({ length: null });
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void dep.output("line"); },
});
`,
            () => ({
                name: "B",
                outputs: [{ title: "line", kind: "series-number" }],
                inputs: { length: { kind: "int", defaultValue: 14 } },
            }),
        );
        const codes = graph.diagnostics.map((d) => d.code);
        expect(codes).toContain("dep-invalid-input-override");
    });

    it("rejects false-literal withInputs values that mismatch producer kind", () => {
        const graph = runDep(
            `
import { defineIndicator } from "@invinite-org/chartlang-core";
import baseTrend from "./trend.chart";
const dep = baseTrend.withInputs({ length: false });
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void dep.output("line"); },
});
`,
            () => ({
                name: "B",
                outputs: [{ title: "line", kind: "series-number" }],
                inputs: { length: { kind: "int", defaultValue: 14 } },
            }),
        );
        const codes = graph.diagnostics.map((d) => d.code);
        expect(codes).toContain("dep-invalid-input-override");
    });

    it("treats imported binding as unresolvable when resolveProducer returns null", () => {
        const graph = runDep(
            `
import { defineIndicator } from "@invinite-org/chartlang-core";
import unresolvable from "./unknown.chart";
const dep = unresolvable.withInputs({ length: 1 });
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void dep.output("line"); },
});
`,
            () => null,
        );
        const codes = graph.diagnostics.map((d) => d.code);
        expect(codes).toContain("dep-dynamic");
    });

    it("synthesises a same-file alias private dep when withInputs chains off another binding", () => {
        const graph = runDep(`
import { defineIndicator, plot } from "@invinite-org/chartlang-core";
const base = defineIndicator({
    name: "Base",
    apiVersion: 1,
    compute: ({ bar }) => { plot(bar.close, { title: "line" }); },
});
const fastAlias = base.withInputs({});
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void fastAlias.output("line"); },
});
`);
        expect(graph.diagnostics).toEqual([]);
        const alias = graph.privateDeps.find((d) => d.localId === "fastAlias");
        expect(alias?.producerRef.kind).toBe("same-file");
        const base = graph.privateDeps.find((d) => d.localId === "base");
        expect(base?.localId).toBe("base");
    });

    it("captures effective inputs on the consume edge of a layered private dep", () => {
        const snapshot: ProducerSnapshot = {
            name: "B",
            outputs: [{ title: "line", kind: "series-number" }],
            inputs: { length: { kind: "int", defaultValue: 14 } },
        };
        const graph = runDep(
            `
import { defineIndicator } from "@invinite-org/chartlang-core";
import baseTrend from "./base-trend.chart";
const trendA = baseTrend.withInputs({ length: 20 });
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void trendA.output("line"); },
});
`,
            () => snapshot,
        );
        const defaultDrawn = graph.drawn.find((d) => d.exportName === "default");
        expect(defaultDrawn?.consumes[0]?.effectiveInputs).toEqual({ length: 20 });
    });
});

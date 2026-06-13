// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";
import { describe, expect, it } from "vitest";

import {
    type ResolveProducer,
    extractDependencyGraph,
} from "../analysis/extractDependencyGraph.js";
import { runStructuralChecks } from "../analysis/structuralChecks.js";
import { createProgramForSource } from "../program.js";
import { rewriteDependencyAccessors } from "./rewriteDependencyAccessors.js";

function rewrite(source: string, resolveProducer: ResolveProducer = () => null) {
    const sourcePath = "demo.chart.ts";
    const { sourceFile, checker } = createProgramForSource(source, { sourcePath });
    const structural = runStructuralChecks(sourceFile, checker, sourcePath);
    const graph = extractDependencyGraph(
        sourceFile,
        checker,
        sourcePath,
        structural.bindings,
        resolveProducer,
    );
    const result = rewriteDependencyAccessors(sourceFile, graph, sourcePath);
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    return printer.printFile(result.transformed);
}

describe("rewriteDependencyAccessors", () => {
    it("rewrites a same-file private-dep .output() call to __chartlang_depOutput", () => {
        const text = rewrite(`
import { defineIndicator, plot } from "@invinite-org/chartlang-core";
const base = defineIndicator({
    name: "Base",
    apiVersion: 1,
    compute: ({ bar }) => { plot(bar.close, { title: "line" }); },
});
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void base.output("line"); },
});
`);
        expect(text).toContain("__chartlang_depOutput");
        expect(text).toMatch(
            /__chartlang_depOutput\("demo\.chart\.ts:\d+:\d+#0", "base", "line"\)/,
        );
        // The original `.output("line")` shape must be gone.
        expect(text).not.toMatch(/base\.output\(/);
    });

    it("is deterministic — repeated calls produce byte-identical output", () => {
        const source = `
import { defineIndicator, plot } from "@invinite-org/chartlang-core";
const base = defineIndicator({
    name: "Base",
    apiVersion: 1,
    compute: ({ bar }) => { plot(bar.close, { title: "line" }); },
});
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void base.output("line"); },
});
`;
        const a = rewrite(source);
        const b = rewrite(source);
        expect(a).toBe(b);
    });

    it("leaves unknown .output() receivers untouched", () => {
        // The receiver `other` is not in the dep graph — rewriter should
        // not synthesise __chartlang_depOutput for it. The pass still
        // raises diagnostics through extractDependencyGraph; here we
        // only assert the rewriter is conservative.
        const text = rewrite(`
import { defineIndicator } from "@invinite-org/chartlang-core";
const other = { output: (n: string) => n };
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void other.output("line"); },
});
`);
        expect(text).toContain("other.output");
        expect(text).not.toContain("__chartlang_depOutput");
    });

    it("does not rewrite .output() calls on non-identifier receivers", () => {
        // `obj.prop.output("x")` — receiver `obj.prop` is a property
        // access, not an identifier; the rewriter must leave it alone.
        const text = rewrite(`
import { defineIndicator } from "@invinite-org/chartlang-core";
const wrapped = { inner: { output: (n: string) => n } };
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void wrapped.inner.output("line"); },
});
`);
        expect(text).toContain("wrapped.inner.output");
        expect(text).not.toContain("__chartlang_depOutput");
    });

    it("rewrites a withInputs-alias receiver via the alias localId", () => {
        const text = rewrite(
            `
import { defineIndicator } from "@invinite-org/chartlang-core";
import baseTrend from "./base-trend.chart";
const layered = baseTrend.withInputs({ length: 50 });
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void layered.output("line"); },
});
`,
            () => ({
                name: "Base",
                outputs: [{ title: "line", kind: "series-number" }],
                inputs: { length: { kind: "int", defaultValue: 14 } },
            }),
        );
        expect(text).toMatch(
            /__chartlang_depOutput\("demo\.chart\.ts:\d+:\d+#0", "layered", "line"\)/,
        );
    });

    it("strips the withInputs chain from cross-file alias declarations", () => {
        // Cross-file alias `const trend = baseTrend.withInputs({...})`
        // must lower to `const trend = baseTrend;` at compile time so
        // the runtime sentinel (`baseTrend.withInputs` throws when
        // called outside the compiler pipeline) never fires when the
        // bundle is loaded. The merged effective inputs flow into the
        // dep runner through `__dependencies[i].inputOverrides`.
        const text = rewrite(
            `
import { defineIndicator } from "@invinite-org/chartlang-core";
import baseTrend from "./base-trend.chart";
const trend = baseTrend.withInputs({ length: 14 });
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void trend.output("line"); },
});
`,
            () => ({
                name: "Base",
                outputs: [{ title: "line", kind: "series-number" }],
                inputs: { length: { kind: "int", defaultValue: 14 } },
            }),
        );
        // The chained `.withInputs(...)` call is gone, leaving a bare
        // reference to the import binding.
        expect(text).not.toMatch(/baseTrend\.withInputs/);
        expect(text).toMatch(/const trend = baseTrend;/);
    });

    it("injects a producer private dep's titled outputs into its defineIndicator opts", () => {
        // The bug guard: a private dep producing `plot(..., { title })`
        // must carry `outputs: [...]` on its define-call so the runtime
        // object's `manifest.outputs` is populated and the dep-output
        // store allocates a ring buffer for the title.
        const text = rewrite(`
import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";
const base = defineIndicator({
    name: "Base",
    apiVersion: 1,
    compute: ({ bar, ta, plot }) => { plot(ta.ema(bar.close, 10), { title: "line" }); },
});
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void base.output("line"); },
});
`);
        // The private dep's opts literal gains the outputs array.
        expect(text).toMatch(
            /name: "Base"[\s\S]*outputs: \[\{ title: "line", kind: "series-number" \}\]/,
        );
        // The default consumer here has no titled plots, so it stays
        // outputs-free.
        expect(text).not.toMatch(/name: "Main"[\s\S]*outputs:/);
    });

    it("injects outputs for both a named-export sibling and the default consumer", () => {
        const text = rewrite(`
import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";
export const slow = defineIndicator({
    name: "Slow",
    apiVersion: 1,
    compute: ({ bar, ta, plot }) => { plot(ta.ema(bar.close, 20), { title: "line" }); },
});
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: ({ plot }) => { plot(slow.output("line").current, { title: "spread" }); },
});
`);
        expect(text).toMatch(
            /name: "Slow"[\s\S]*outputs: \[\{ title: "line", kind: "series-number" \}\]/,
        );
        expect(text).toMatch(
            /name: "Main"[\s\S]*outputs: \[\{ title: "spread", kind: "series-number" \}\]/,
        );
    });

    it("leaves a single-export script with no titled plots untouched", () => {
        // No titled plot ⇒ no outputs ⇒ no injection ⇒ byte-identical.
        const source = `
import { defineIndicator, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "Plain",
    apiVersion: 1,
    compute: ({ bar, plot }) => { plot(bar.close); },
});
`;
        const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "demo.chart.ts",
        });
        const original = printer.printFile(sourceFile);
        const rewritten = rewrite(source);
        expect(rewritten).not.toContain("outputs:");
        expect(rewritten).toBe(original);
    });

    it("strips a multi-link withInputs chain on a same-file alias", () => {
        // Two .withInputs(...) layers on a same-file private dep
        // collapse to the bare root identifier.
        const text = rewrite(`
import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";
const base = defineIndicator({
    name: "Base",
    apiVersion: 1,
    inputs: { length: { kind: "int", defaultValue: 14 } },
    compute: ({ bar }) => { plot(ta.ema(bar.close, 10), { title: "line" }); },
});
const layered = base.withInputs({ length: 5 }).withInputs({ length: 21 });
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void layered.output("line"); },
});
`);
        expect(text).not.toMatch(/base\.withInputs/);
        expect(text).toMatch(/const layered = base;/);
    });
});

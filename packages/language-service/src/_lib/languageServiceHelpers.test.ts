// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { collectCompletions } from "./collectCompletions.js";
import { isInsideIntervalLiteral } from "./isInsideIntervalLiteral.js";
import { isInsideOutputStringLiteral } from "./isInsideOutputStringLiteral.js";
import { isInsideWithInputsKey } from "./isInsideWithInputsKey.js";
import { makeDiagnostic, mapDiagnostic } from "./mapDiagnostic.js";
import {
    resolveDepAccessorDefinition,
    resolveDepAccessorHover,
    resolveDepInputsFor,
    resolveDepOutputsFor,
} from "./resolveDepAccessor.js";
import { findTokenAtOffset, resolveFqnAtOffset } from "./resolveFqnAtOffset.js";
import { toHoverDoc } from "./toHoverDoc.js";

const PRODUCER_SOURCE = `
import { defineIndicator, input, plot } from "@invinite-org/chartlang-core";

const baseTrend = defineIndicator({
    name: "Base",
    apiVersion: 1,
    inputs: {
        length: input.int(20),
        smoothing: input.float(2.5),
    },
    compute: ({ bar }) => {
        plot(bar.close, { title: "line" });
        plot(bar.close, { title: "signal" });
    },
});

const fast = baseTrend.withInputs({ length: 10 });
const a = baseTrend.output("line");
const b = fast.withInputs({ unknown: 1 });
void a; void b;
`;

describe("language-service helpers", () => {
    it("resolves FQNs and returns null for non-identifiers", () => {
        expect(resolveFqnAtOffset("ta.ema(bar.close, 20)", 4)).toBe("ta.ema");
        expect(resolveFqnAtOffset("plot(1)", 1)).toBe("plot");
        expect(resolveFqnAtOffset("42", 0)).toBeNull();
        expect(resolveFqnAtOffset("factory().ema()", 10)).toBeNull();
    });

    it("finds tokens by offset", () => {
        const sourceFile = ts.createSourceFile(
            "x.ts",
            "const alpha = 1;",
            ts.ScriptTarget.Latest,
            true,
        );
        expect(findTokenAtOffset(sourceFile, 7)?.getText(sourceFile)).toBe("alpha");
        expect(findTokenAtOffset(sourceFile, 200)).toBeNull();
    });

    it("detects only supported interval literals", () => {
        expect(isInsideIntervalLiteral('request.security({ interval: "1D" })', 31)).toBe(true);
        expect(isInsideIntervalLiteral('input.interval("1D")', 17)).toBe(true);
        expect(isInsideIntervalLiteral('input.string("1D")', 15)).toBe(false);
        expect(isInsideIntervalLiteral('request.security({ symbol: "AAPL" })', 29)).toBe(false);
        expect(isInsideIntervalLiteral('request.security(interval("1D"))', 27)).toBe(false);
        expect(isInsideIntervalLiteral('request.security({ ["interval"]: "1D" })', 35)).toBe(false);
        expect(isInsideIntervalLiteral('input["interval"]("1D")', 19)).toBe(false);
        expect(isInsideIntervalLiteral('const interval = "1D";', 18)).toBe(false);
        expect(isInsideIntervalLiteral('input.config.interval("1D")', 24)).toBe(false);
    });

    it("collects registry and local completions", () => {
        const completions = collectCompletions(
            "function helper(param: number) { const local = param; }",
            0,
            {
                "ta.ema": {
                    fqn: "ta.ema",
                    kind: "function",
                    title: "ta.ema(source, length)",
                    summary: "EMA.",
                    since: "0.1",
                    stability: "stable",
                },
            },
        );

        expect(completions.map((item) => item.label)).toEqual([
            "helper",
            "local",
            "param",
            "ta.ema",
        ]);
    });

    it("detects only `<binding>.output(\"|\")` string-literal positions", () => {
        const source = 'baseTrend.output("line")';
        const insideStringOffset = source.indexOf("line") + 1;
        const afterCallOffset = source.length;

        expect(isInsideOutputStringLiteral(source, insideStringOffset)).toBe(true);
        expect(isInsideOutputStringLiteral(source, afterCallOffset)).toBe(false);
        // `.plot("|")` — wrong method name.
        expect(isInsideOutputStringLiteral('baseTrend.plot("line")', 17)).toBe(false);
        // No arguments — the predicate must not match.
        expect(isInsideOutputStringLiteral('baseTrend.output()', 15)).toBe(false);
        // Non-property-access callee.
        expect(isInsideOutputStringLiteral('output("line")', 9)).toBe(false);
        // Second arg position is not the first.
        expect(isInsideOutputStringLiteral('baseTrend.output(x, "y")', 21)).toBe(false);
        // Unrelated string literal (not in a call argument position).
        expect(isInsideOutputStringLiteral('const x = "line";', 12)).toBe(false);
    });

    it("detects only `<binding>.withInputs({ |})` KEY positions", () => {
        const source = 'baseTrend.withInputs({ length: 20 })';
        const atKeyName = source.indexOf("length") + 1;
        const atValueLiteral = source.indexOf("20") + 1;
        const afterCloseBrace = source.length;

        expect(isInsideWithInputsKey(source, atKeyName)).toBe(true);
        expect(isInsideWithInputsKey(source, atValueLiteral)).toBe(false);
        expect(isInsideWithInputsKey(source, afterCloseBrace)).toBe(false);
        // Wrong method name.
        expect(
            isInsideWithInputsKey('baseTrend.somethingElse({ length: 20 })', 27),
        ).toBe(false);
        // Non-object argument.
        expect(isInsideWithInputsKey('baseTrend.withInputs(123)', 22)).toBe(false);
        // Argument not at index 0.
        expect(isInsideWithInputsKey('baseTrend.withInputs(1, { a: 1 })', 27)).toBe(false);
        // Non-property-access callee.
        expect(isInsideWithInputsKey('withInputs({ a: 1 })', 14)).toBe(false);
        // Object literal at non-call position (variable initialiser).
        expect(isInsideWithInputsKey('const x = { a: 1 };', 13)).toBe(false);
        // Shorthand-property assignment is not a value-position guard hit
        // — predicate stays true (key position).
        expect(isInsideWithInputsKey('baseTrend.withInputs({ length })', 23)).toBe(true);
    });

    it("resolves dep accessor hovers for output() and withInputs()", () => {
        const outputOffset = PRODUCER_SOURCE.indexOf('"line")') + 1;
        const hover = resolveDepAccessorHover(PRODUCER_SOURCE, outputOffset);
        expect(hover).toEqual({
            title: "baseTrend.output(name)",
            summary: expect.stringContaining('"line"'),
        });
        expect(hover?.summary).toContain('"signal"');

        const withInputsOffset = PRODUCER_SOURCE.indexOf("withInputs({ length: 10") + 13;
        const hoverInputs = resolveDepAccessorHover(PRODUCER_SOURCE, withInputsOffset);
        expect(hoverInputs).toEqual({
            title: "baseTrend.withInputs(overrides)",
            summary: expect.stringContaining("length: int (default: 20)"),
        });
        expect(hoverInputs?.summary).toContain("smoothing: float (default: 2.5)");
    });

    it("returns null when dep accessor cannot be resolved", () => {
        // Cursor not inside an accessor call.
        expect(resolveDepAccessorHover("const x = 1;", 4)).toBeNull();
        // Binding does not exist in this source.
        expect(resolveDepAccessorHover('ghost.output("line")', 8)).toBeNull();
        // Binding's RHS is not `defineIndicator`.
        const source = `
const ghost = somethingElse();
const x = ghost.output("line");
`;
        const offset = source.indexOf('"line")') + 1;
        expect(resolveDepAccessorHover(source, offset)).toBeNull();
        // Binding initialiser is not a call.
        const source2 = `
const ghost = 42;
const x = ghost.output("line");
`;
        const offset2 = source2.indexOf('"line")') + 1;
        expect(resolveDepAccessorHover(source2, offset2)).toBeNull();
        // Cursor lands on identifier, not inside an accessor call.
        expect(resolveDepAccessorHover("baseTrend", 2)).toBeNull();
    });

    it("falls back to defaults when producer has no plots / inputs", () => {
        const empty = `
import { defineIndicator } from "@invinite-org/chartlang-core";
const empty = defineIndicator({
    name: "Empty",
    apiVersion: 1,
    compute: () => undefined,
});
const x = empty.output("missing");
const y = empty.withInputs({ });
void x; void y;
`;
        const outOff = empty.indexOf('"missing"') + 1;
        expect(resolveDepAccessorHover(empty, outOff)).toEqual({
            title: "empty.output(...)",
            summary: expect.stringContaining("does not expose any titled outputs"),
        });
        const inOff = empty.indexOf("withInputs({") + 12;
        expect(resolveDepAccessorHover(empty, inOff)).toEqual({
            title: "empty.withInputs({})",
            summary: expect.stringContaining("does not declare any inputs"),
        });
    });

    it("collects output titles + input descriptors for completion", () => {
        const outOffset = PRODUCER_SOURCE.indexOf('output("line")') + "output(\"".length;
        expect(resolveDepOutputsFor(PRODUCER_SOURCE, outOffset)).toEqual(["line", "signal"]);
        expect(resolveDepOutputsFor("baseTrend.output(\"\")", 18)).toEqual([]);

        const inOffset = PRODUCER_SOURCE.indexOf("withInputs({ length: 10") + 13;
        const inputs = resolveDepInputsFor(PRODUCER_SOURCE, inOffset);
        expect(inputs).toEqual([
            { name: "length", kind: "int", defaultText: "20" },
            { name: "smoothing", kind: "float", defaultText: "2.5" },
        ]);

        // No-op when no producer binding.
        expect(resolveDepInputsFor("ghost.withInputs({ a: 1 })", 19)).toEqual([]);
        // No-op when cursor not on an accessor.
        expect(resolveDepOutputsFor("const x = 1;", 4)).toEqual([]);
        expect(resolveDepInputsFor("const x = 1;", 4)).toEqual([]);

        // Mismatched accessor kind: output offset queried as inputs and vice versa.
        expect(resolveDepInputsFor(PRODUCER_SOURCE, outOffset)).toEqual([]);
        expect(resolveDepOutputsFor(PRODUCER_SOURCE, inOffset)).toEqual([]);
    });

    it("resolves dep accessor go-to-definition to the matching plot title", () => {
        const offset = PRODUCER_SOURCE.indexOf('baseTrend.output("line")') + "baseTrend.output(\"".length;
        const def = resolveDepAccessorDefinition(PRODUCER_SOURCE, offset);
        expect(def).not.toBeNull();
        expect(def?.file).toBe("script.chart.ts");
        expect(def?.line).toBeGreaterThan(0);
        expect(def?.column).toBeGreaterThan(0);

        // No matching title.
        const missing = `
import { defineIndicator, plot } from "@invinite-org/chartlang-core";
const x = defineIndicator({
    name: "X",
    apiVersion: 1,
    compute: ({ bar }) => { plot(bar.close, { title: "other" }); },
});
const y = x.output("missing");
void y;
`;
        const missOff = missing.indexOf('"missing"') + 1;
        expect(resolveDepAccessorDefinition(missing, missOff)).toBeNull();

        // Dynamic title (non-string-literal argument).
        const dyn = `
import { defineIndicator, plot } from "@invinite-org/chartlang-core";
const x = defineIndicator({
    name: "X",
    apiVersion: 1,
    compute: ({ bar }) => { plot(bar.close, { title: "line" }); },
});
const name = "line";
const y = x.output(name);
void y;
`;
        const dynOff = dyn.indexOf("x.output(name)") + "x.output(".length;
        expect(resolveDepAccessorDefinition(dyn, dynOff)).toBeNull();

        // withInputs offset must not resolve to a definition.
        const winOff = PRODUCER_SOURCE.indexOf("withInputs({ length: 10") + 13;
        expect(resolveDepAccessorDefinition(PRODUCER_SOURCE, winOff)).toBeNull();

        // Cursor off any accessor.
        expect(resolveDepAccessorDefinition("const x = 1;", 4)).toBeNull();

        // Producer binding missing.
        expect(resolveDepAccessorDefinition('ghost.output("line")', 14)).toBeNull();

        // Producer initialiser is not defineIndicator.
        const notDefine = `
const ghost = somethingElse();
const x = ghost.output("line");
`;
        expect(
            resolveDepAccessorDefinition(notDefine, notDefine.indexOf('"line"') + 1),
        ).toBeNull();
    });

    it("returns empty completions when dep predicates match but resolver is empty", () => {
        const items = collectCompletions(
            'ghost.output("")',
            'ghost.output("'.length,
            {},
        );
        expect(items).toEqual([]);
    });

    it("returns producer output titles inside <binding>.output(\"|\")", () => {
        const offset = PRODUCER_SOURCE.indexOf('output("line")') + 'output("'.length;
        const completions = collectCompletions(PRODUCER_SOURCE, offset, {});
        expect(completions.map((c) => c.label)).toEqual(["line", "signal"]);
        expect(completions[0]?.detail).toBe("Series<number> output");
    });

    it("returns producer input keys inside <binding>.withInputs({ |})", () => {
        const offset = PRODUCER_SOURCE.indexOf("withInputs({ length: 10") + 13;
        const completions = collectCompletions(PRODUCER_SOURCE, offset, {});
        expect(completions.map((c) => c.label)).toEqual(["length", "smoothing"]);
        expect(completions[0]?.detail).toBe("int (default: 20)");
    });

    it("resolves accessor binding even when the binding is rebound via chain", () => {
        // The walker should descend the `.withInputs(...).withInputs(...)` chain
        // until it hits the root `defineIndicator(...)` call.
        const chained = `
import { defineIndicator, plot } from "@invinite-org/chartlang-core";
const root = defineIndicator({
    name: "R",
    apiVersion: 1,
    compute: ({ bar }) => { plot(bar.close, { title: "main" }); },
});
const chain = root.withInputs({}).withInputs({});
const v = chain.output("main");
void v;
`;
        const offset = chained.indexOf('"main")') + 1;
        const hover = resolveDepAccessorHover(chained, offset);
        expect(hover?.summary).toContain('"main"');
    });

    it("returns null when offset is past the source length", () => {
        expect(resolveDepAccessorHover("baseTrend", 1000)).toBeNull();
    });

    it("does not loop forever on circular binding chains", () => {
        // `a` resolves through `b`, `b` resolves through `a`. The seen-set
        // guards prevent the resolver from looping.
        const source = `
const a = b;
const b = a;
const x = a.output("nothing");
void x;
`;
        const offset = source.indexOf('"nothing"') + 1;
        expect(resolveDepAccessorHover(source, offset)).toBeNull();
    });

    it("survives bindings without an initialiser and with destructured names", () => {
        // No initialiser (`let foo;`) — must return null without crashing.
        const noInit = `
let foo;
const x = foo.output("nothing");
void x;
`;
        const offset = noInit.indexOf('"nothing"') + 1;
        expect(resolveDepAccessorHover(noInit, offset)).toBeNull();

        // Destructured binding pattern — walker must skip it.
        const destructured = `
const { foo } = produces();
const y = foo.output("nothing");
void y;
`;
        const offset2 = destructured.indexOf('"nothing"') + 1;
        expect(resolveDepAccessorHover(destructured, offset2)).toBeNull();
    });

    it("survives defineIndicator opts with shorthand / spread / missing compute", () => {
        const source = `
import { defineIndicator } from "@invinite-org/chartlang-core";
const helper = {};
const producer = defineIndicator({
    name: "P",
    apiVersion: 1,
    ...helper,
});
const x = producer.output("nope");
const y = producer.withInputs({ });
void x; void y;
`;
        const outOff = source.indexOf('"nope"') + 1;
        // No compute → no plot calls → empty-output hover branch.
        expect(resolveDepAccessorHover(source, outOff)?.summary).toContain(
            "does not expose any titled outputs",
        );
        const inOff = source.indexOf("withInputs({") + 12;
        // No inputs → empty-inputs hover branch.
        expect(resolveDepAccessorHover(source, inOff)?.summary).toContain(
            "does not declare any inputs",
        );
    });

    it("ignores non-input.* and malformed input descriptors", () => {
        const source = `
import { defineIndicator, input, plot } from "@invinite-org/chartlang-core";
const producer = defineIndicator({
    name: "P",
    apiVersion: 1,
    inputs: {
        rawValue: 20,
        called: builder(),
        bare: foo.bar(),
        notInputBuilder: nope.int(20),
        skipped: input.int(),
        kept: input.int(20),
        ...spread,
    },
    compute: ({ bar }) => {
        plot(bar.close, { ...rest });
        plot(bar.close, { title: "kept" });
    },
});
const x = producer.withInputs({ kept: 1 });
void x;
`;
        const winSlot = source.indexOf("withInputs({ kept: 1") + 13;
        const inputs = resolveDepInputsFor(source, winSlot);
        // Only `skipped` (input.int()) and `kept` (input.int(20)) qualify.
        expect(inputs.map((i) => i.name).sort()).toEqual(["kept", "skipped"]);
        const skipped = inputs.find((i) => i.name === "skipped");
        expect(skipped?.defaultText).toBe("—");
    });

    it("skips computed-key inputs / plot titles when collecting accessor info", () => {
        // Computed-key entries are not statically resolvable from the
        // hover walker. They must not crash the resolver and must not
        // appear in the surfaced descriptors.
        const source = `
import { defineIndicator, input, plot } from "@invinite-org/chartlang-core";
const KEY = "length";
const producer = defineIndicator({
    name: "P",
    apiVersion: 1,
    inputs: {
        [KEY]: input.int(20),
        length: input.int(20),
    },
    compute: ({ bar }) => {
        plot(bar.close, { ["title"]: "skipped" });
        plot(bar.close, { title: "kept" });
    },
});
const x = producer.output("kept");
void x;
`;
        const outOff = source.indexOf('"kept")') + 1;
        const hover = resolveDepAccessorHover(source, outOff);
        expect(hover?.summary).toContain('"kept"');
        expect(hover?.summary).not.toContain('"skipped"');

        const winOff = source.indexOf("producer.output");
        // Move into a withInputs slot for input coverage of the same producer.
        const winSource = `${source}\nconst y = producer.withInputs({ length: 5 });\nvoid y;`;
        const winSlot = winSource.indexOf("withInputs({ length: 5") + 13;
        const inputs = resolveDepInputsFor(winSource, winSlot);
        expect(inputs.map((i) => i.name)).toEqual(["length"]);
        void winOff;
    });

    it("returns null when binding chain does not bottom out in defineIndicator", () => {
        const bad = `
const root = somethingElse;
const chain = root.something();
const v = chain.output("main");
void v;
`;
        const offset = bad.indexOf('"main")') + 1;
        expect(resolveDepAccessorHover(bad, offset)).toBeNull();
    });

    it("maps diagnostics and hover entries with optional fields", () => {
        expect(
            mapDiagnostic({
                severity: "warning",
                code: "dynamic-series-index",
                message: "dynamic",
                file: "x.ts",
                line: 2,
                column: 3,
                nodeText: "series[i]",
            }),
        ).toMatchObject({
            code: "dynamic-series-index",
            relatedCallsite: "series[i]",
            range: { startLine: 2, startColumn: 3 },
        });
        expect(
            makeDiagnostic({
                line: 1,
                column: 1,
                severity: "hint",
                code: "hint",
                message: "message",
            }),
        ).not.toHaveProperty("relatedCallsite");
        expect(
            toHoverDoc({
                fqn: "x",
                kind: "property",
                title: "x",
                summary: "summary",
                examples: ["x"],
                since: "0.4",
                stability: "stable",
            }),
        ).toEqual({ title: "x", summary: "summary", examples: ["x"] });
    });
});

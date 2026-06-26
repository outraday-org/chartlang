// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { createProgramForSource } from "../program.js";
import { extractInputs } from "./extractInputs.js";

function sourceFor(inputs: string): string {
    return `
import { defineIndicator, input } from "@invinite-org/chartlang-core";
const schema = { kind: "external-series-schema" } as const;
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    inputs: { ${inputs} },
    compute: () => {},
});
`;
}

function run(inputs: string) {
    const { sourceFile, checker } = createProgramForSource(sourceFor(inputs), {
        sourcePath: "inputs.chart.ts",
    });
    return extractInputs(sourceFile, checker, "inputs.chart.ts");
}

describe("extractInputs", () => {
    it("serialises all supported builders", () => {
        const result = run(`
            len: input.int(14, { title: "Length", min: 1, max: 200, step: 1 }),
            mult: input.float(2.5, { title: "Multiplier", min: 0.5, max: 5, step: 0.25 }),
            enabled: input.bool(false, { title: "Enabled" }),
            note: input.string("hello", { title: "Note", multiline: true }),
            mode: input.enum("fast", ["fast", "slow"] as const, { title: "Mode" }),
            col: input.color("#26a69a", { title: "Color" }),
            src: input.source("close", { title: "Source" }),
            anchor: input.time(1700000000000, { title: "Anchor", pickFromChart: true }),
            level: input.price(101.25, { title: "Level" }),
            sym: input.symbol("AAPL", { title: "Symbol" }),
            tf: input.interval("chart", { title: "Timeframe" }),
            sess: input.session("0930-1600", { title: "Session" }),
            ext: input.externalSeries({ name: "earnings", schema, title: "Earnings" }),
        `);

        expect(result.diagnostics).toEqual([]);
        expect(result.userPickableInterval).toBe(true);
        expect(result.inputs.len).toEqual({
            kind: "int",
            defaultValue: 14,
            title: "Length",
            min: 1,
            max: 200,
            step: 1,
        });
        expect(result.inputs.mult).toEqual({
            kind: "float",
            defaultValue: 2.5,
            title: "Multiplier",
            min: 0.5,
            max: 5,
            step: 0.25,
        });
        expect(result.inputs.enabled).toEqual({
            kind: "bool",
            defaultValue: false,
            title: "Enabled",
        });
        expect(result.inputs.note).toEqual({
            kind: "string",
            defaultValue: "hello",
            title: "Note",
            multiline: true,
        });
        expect(result.inputs.mode).toEqual({
            kind: "enum",
            defaultValue: "fast",
            options: ["fast", "slow"],
            title: "Mode",
        });
        expect(result.inputs.col).toEqual({
            kind: "color",
            defaultValue: "#26a69a",
            title: "Color",
        });
        expect(result.inputs.src).toEqual({
            kind: "source",
            defaultValue: "close",
            title: "Source",
        });
        expect(result.inputs.anchor).toEqual({
            kind: "time",
            defaultValue: 1700000000000,
            title: "Anchor",
            pickFromChart: true,
        });
        expect(result.inputs.level).toEqual({
            kind: "price",
            defaultValue: 101.25,
            title: "Level",
        });
        expect(result.inputs.sym).toEqual({
            kind: "symbol",
            defaultValue: "AAPL",
            title: "Symbol",
        });
        expect(result.inputs.tf).toEqual({
            kind: "interval",
            defaultValue: "chart",
            title: "Timeframe",
        });
        expect(result.inputs.sess).toEqual({
            kind: "session",
            defaultValue: "0930-1600",
            title: "Session",
        });
        expect(result.inputs.ext).toEqual({
            kind: "external-series",
            name: "earnings",
            schema: { kind: "external-series-schema" },
            title: "Earnings",
        });
    });

    it("serialises a numeric input.enum with a numeric default and options", () => {
        const result = run('len: input.enum(21, [8, 21, 30, 50, 100] as const, { title: "Len" })');
        expect(result.diagnostics).toEqual([]);
        expect(result.inputs.len).toEqual({
            kind: "enum",
            defaultValue: 21,
            options: [8, 21, 30, 50, 100],
            title: "Len",
        });
    });

    it("returns frozen records and nested arrays", () => {
        const result = run('mode: input.enum("a", ["a", "b"] as const)');
        expect(Object.isFrozen(result)).toBe(true);
        expect(Object.isFrozen(result.inputs)).toBe(true);
        expect(Object.isFrozen(result.inputs.mode)).toBe(true);
        const options = result.inputs.mode?.options;
        expect(Array.isArray(options)).toBe(true);
        expect(Object.isFrozen(options)).toBe(true);
    });

    it("ignores input calls outside a define inputs object", () => {
        const source = `
import { defineIndicator, input } from "@invinite-org/chartlang-core";
const len = input.int(14);
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute: () => { input.interval("1D"); void len; },
});
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "outside.chart.ts",
        });
        const result = extractInputs(sourceFile, checker, "outside.chart.ts");
        expect(result.inputs).toEqual({});
        expect(result.userPickableInterval).toBe(false);
        expect(result.diagnostics).toEqual([]);
    });

    it("emits unknown-input-kind for unsupported input builders", () => {
        const result = run("bad: input.foo(1)");
        expect(result.diagnostics).toHaveLength(1);
        expect(result.diagnostics[0]?.code).toBe("unknown-input-kind");
        expect(result.inputs).toEqual({});
    });

    it("emits input-default-not-literal for dynamic defaults", () => {
        const source = `
import { defineIndicator, input } from "@invinite-org/chartlang-core";
const n = 14;
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    inputs: { len: input.int(n) },
    compute: () => {},
});
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "dynamic.chart.ts",
        });
        const result = extractInputs(sourceFile, checker, "dynamic.chart.ts");
        expect(result.diagnostics[0]?.code).toBe("input-default-not-literal");
        expect(result.inputs).toEqual({});
    });

    it("emits input-default-not-literal for dynamic enum options", () => {
        const source = `
import { defineIndicator, input } from "@invinite-org/chartlang-core";
const opts = ["a", "b"] as const;
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    inputs: { mode: input.enum("a", opts) },
    compute: () => {},
});
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "dynamic-enum.chart.ts",
        });
        const result = extractInputs(sourceFile, checker, "dynamic-enum.chart.ts");
        expect(result.diagnostics[0]?.code).toBe("input-default-not-literal");
        expect(result.inputs).toEqual({});
    });

    it("emits input-default-not-literal for a non-literal enum option element", () => {
        const source = `
import { defineIndicator, input } from "@invinite-org/chartlang-core";
const other = "b";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    inputs: { mode: input.enum("a", ["a", other] as const) },
    compute: () => {},
});
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "nonliteral-enum.chart.ts",
        });
        const result = extractInputs(sourceFile, checker, "nonliteral-enum.chart.ts");
        expect(result.diagnostics[0]?.code).toBe("input-default-not-literal");
        expect(result.inputs).toEqual({});
    });

    it("handles parenthesized literals and skips computed option keys", () => {
        const result = run(
            'len: input.int((+14), ({ ["title"]: "Length", min: -5, ...{} } as const))',
        );
        expect(result.diagnostics).toEqual([]);
        expect(result.inputs.len).toEqual({
            kind: "int",
            defaultValue: 14,
            min: -5,
        });
    });

    it("emits input-default-not-literal for missing defaults and malformed opts", () => {
        const source = `
import { defineIndicator, input } from "@invinite-org/chartlang-core";
const title = "Length";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    inputs: {
        missing: input.int(),
        badOpts: input.float(1, title),
        badOptValue: input.string("x", { title: title }),
        badEnum: input.enum("a"),
        badEnumEntry: input.enum("a", ["a", 1] as const),
    },
    compute: () => {},
});
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "malformed.chart.ts",
        });
        const result = extractInputs(sourceFile, checker, "malformed.chart.ts");
        expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
            "input-default-not-literal",
            "input-default-not-literal",
            "input-default-not-literal",
            "input-default-not-literal",
            "input-default-not-literal",
        ]);
        expect(result.inputs.missing).toBeUndefined();
        expect(result.inputs.badOpts).toEqual({ kind: "float", defaultValue: 1 });
        expect(result.inputs.badOptValue).toEqual({ kind: "string", defaultValue: "x" });
    });

    it("validates externalSeries literal object shape", () => {
        const source = `
import { defineIndicator, input } from "@invinite-org/chartlang-core";
const schema = { kind: "external-series-schema" } as const;
const name = "earnings";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    inputs: {
        noArg: input.externalSeries(),
        notObject: input.externalSeries(schema),
        dynamicName: input.externalSeries({ name: name, schema }),
        dynamicTitle: input.externalSeries({ name: "earnings", schema, title: name }),
        missingSchema: input.externalSeries({ name: "earnings" }),
        computedSchema: input.externalSeries({ name: "computed", ["schema"]: schema }),
        explicitSchema: input.externalSeries({ ...{}, name: "sales", schema: { kind: "external-series-schema" } as const }),
    },
    compute: () => {},
});
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "external.chart.ts",
        });
        const result = extractInputs(sourceFile, checker, "external.chart.ts");
        expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
            "input-default-not-literal",
            "input-default-not-literal",
            "input-default-not-literal",
            "input-default-not-literal",
            "input-default-not-literal",
            "input-default-not-literal",
        ]);
        expect(result.inputs.explicitSchema).toEqual({
            kind: "external-series",
            name: "sales",
            schema: { kind: "external-series-schema" },
        });
    });

    it("emits multiple-input-interval for the second interval input", () => {
        const result = run('tf: input.interval("chart"), htf: input.interval("1D")');
        expect(result.userPickableInterval).toBe(true);
        expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
            "multiple-input-interval",
        ]);
        expect(result.inputs.tf).toEqual({ kind: "interval", defaultValue: "chart" });
        expect(result.inputs.htf).toEqual({ kind: "interval", defaultValue: "1D" });
    });

    it("ignores non-manifest input members and non-core initializers", () => {
        const source = `
import { defineIndicator } from "@invinite-org/chartlang-core";
const local = { int: (n: number) => n };
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    inputs: {
        "stringKey": local.int(1),
        plain: 1,
        spread: local.int(2),
        ...{},
    },
    compute: () => {},
});
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "ignored.chart.ts",
        });
        const result = extractInputs(sourceFile, checker, "ignored.chart.ts");
        expect(result.inputs).toEqual({});
        expect(result.diagnostics).toEqual([]);
    });

    it("returns empty inputs when no define call wraps the input call", () => {
        const { sourceFile, checker } = createProgramForSource(
            `
import { input } from "@invinite-org/chartlang-core";
export const len = input.int(14);
`,
            { sourcePath: "module.chart.ts" },
        );
        const result = extractInputs(sourceFile, checker, "module.chart.ts");
        expect(result.inputs).toEqual({});
        expect(result.diagnostics).toEqual([]);
    });

    it("returns empty inputs when define call arguments are not object-literal inputs", () => {
        const source = `
import { defineIndicator } from "@invinite-org/chartlang-core";
const opts = { name: "x", apiVersion: 1, compute: () => {} };
export default defineIndicator(opts);
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "nonliteral-define.chart.ts",
        });
        const result = extractInputs(sourceFile, checker);
        expect(result.inputs).toEqual({});
        expect(result.diagnostics).toEqual([]);
    });

    it("skips non-property members before finding the define inputs object", () => {
        const source = `
import { defineIndicator, input } from "@invinite-org/chartlang-core";
const shorthand = 1;
export default defineIndicator({
    shorthand,
    ...{},
    name: "x",
    apiVersion: 1,
    inputs: { len: input.int(14) },
    compute: () => {},
});
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "skipped-members.chart.ts",
        });
        const result = extractInputs(sourceFile, checker);
        expect(result.inputs.len).toEqual({ kind: "int", defaultValue: 14 });
        expect(result.diagnostics).toEqual([]);
    });

    it("scopes the walk to a single binding when `scope` is provided", () => {
        const source = `
import { defineIndicator, input } from "@invinite-org/chartlang-core";

export const sibling = defineIndicator({
    name: "Sibling",
    apiVersion: 1,
    inputs: { siblingLen: input.int(7) },
    compute: () => {},
});

export default defineIndicator({
    name: "Default",
    apiVersion: 1,
    inputs: { defaultLen: input.int(33) },
    compute: () => {},
});
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "scoped.chart.ts",
        });
        const defineCalls: ts.CallExpression[] = [];
        const collect = (node: ts.Node): void => {
            if (
                ts.isCallExpression(node) &&
                ts.isIdentifier(node.expression) &&
                node.expression.text === "defineIndicator"
            ) {
                defineCalls.push(node);
            }
            ts.forEachChild(node, collect);
        };
        ts.forEachChild(sourceFile, collect);

        const siblingCall = defineCalls[0];
        const defaultCall = defineCalls[1];
        expect(siblingCall).toBeDefined();
        expect(defaultCall).toBeDefined();

        const sibling = extractInputs(
            sourceFile,
            checker,
            "scoped.chart.ts",
            siblingCall as ts.Node,
        );
        const def = extractInputs(sourceFile, checker, "scoped.chart.ts", defaultCall as ts.Node);

        expect(Object.keys(sibling.inputs)).toEqual(["siblingLen"]);
        expect(Object.keys(def.inputs)).toEqual(["defaultLen"]);
        expect(sibling.inputs.siblingLen).toEqual({ kind: "int", defaultValue: 7 });
        expect(def.inputs.defaultLen).toEqual({ kind: "int", defaultValue: 33 });
    });
});

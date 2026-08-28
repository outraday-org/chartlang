// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// Import the workspace source so this cross-package parity test sees concurrent
// compiler ambient-shim changes without requiring a forbidden package build.
import { compile } from "../../../compiler/src/api.js";
import { type ConvertOpts, type ConvertResult, convert } from "../index.js";

const MASM_SOURCE = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "..",
    "..",
    "MASM_Strat.md",
);
const MASM_OPTS: ConvertOpts = {
    barInterval: 60_000,
    barIndexOrigin: 1_700_000_000_000,
};
const MASM_EXTERNAL_OPTS: ConvertOpts = {
    ...MASM_OPTS,
    externalSeriesInputs: [
        {
            inputName: "lt_trend",
            feedName: "trendInput",
            title: "Trend Wizard v1.0: Tab Trend Long",
        },
    ],
};

function outputOf(result: ConvertResult): string {
    expect(result.output).not.toBeNull();
    if (result.output === null) {
        throw new Error("expected conversion output");
    }
    return result.output;
}

function codesOf(result: ConvertResult): readonly string[] {
    return result.diagnostics.map((diagnostic) => diagnostic.code);
}

describe("external-series source-input overrides", () => {
    const source = `//@version=6
indicator("External source")
trend = input(title="Pine title", inline="row", tooltip="help", defval=close)
positive(value) => value > 0
trendUp(source) => source > source[1]
smoothed = ta.ema(trend, 5)
copy = trend
isPositive = positive(trend)
isUp = trendUp(trend)
if trend > trend[1]
    alert("up")
plot(trend)
plot(smoothed)
`;

    it("leaves an ordinary source input byte-identical when metadata is absent", async () => {
        const first = convert(source);
        const second = convert(source, { externalSeriesInputs: [] });

        expect(second.output).toBe(first.output);
        expect(second.diagnostics).toEqual(first.diagnostics);
        expect(outputOf(first)).toContain(
            'trend: input.source("close", { title: "Pine title", inline: "row", tooltip: "help" })',
        );
        expect(outputOf(first)).toContain("bar[inputs.trend as SourceField]");
        const compiled = await compile(outputOf(first), {
            apiVersion: 1,
            sourcePath: "ordinary-source.chart.ts",
        });
        expect(compiled.moduleSource.length).toBeGreaterThan(0);
    });

    it("emits a stable descriptor and rewrites series, scalar, history, condition, and UDF uses", async () => {
        const result = convert(source, {
            externalSeriesInputs: [
                { inputName: "trend", feedName: "trendInput", title: "Bound trend" },
            ],
        });
        const output = outputOf(result);

        expect(codesOf(result)).not.toContain(
            "pine-converter/transform/external-series-input-override-invalid",
        );
        expect(output).toContain(
            'trend: input.externalSeries<number>({ name: "trendInput", schema: { kind: "external-series-schema" }, title: "Bound trend", inline: "row", tooltip: "help" })',
        );
        expect(output).toContain("type Series");
        expect(output).not.toContain("type SourceField");
        expect(output).toContain("ta.ema((inputs.trend as Series<number>), 5)");
        expect(output).toContain("let copy = (inputs.trend as Series<number>).current;");
        expect(output).toContain("positive((inputs.trend as Series<number>).current)");
        expect(output).toContain(
            "(inputs.trend as Series<number>).current > (inputs.trend as Series<number>)[1]",
        );
        expect(output).toContain("plot((inputs.trend as Series<number>));");

        const compiled = await compile(output, {
            apiVersion: 1,
            sourcePath: "external-source.chart.ts",
        });
        expect(compiled.moduleSource.length).toBeGreaterThan(0);
        expect(compiled.manifest.inputs.trend).toEqual({
            kind: "external-series",
            name: "trendInput",
            schema: { kind: "external-series-schema" },
            title: "Bound trend",
            inline: "row",
            tooltip: "help",
        });
    });

    it("propagates series identity through nested pure UDF forwarding", async () => {
        const nestedSource = `//@version=6
indicator("Nested external source")
trend = input.source(close)
delta(source) => source - source[1]
isRising(value) => delta(value) > 0
plot(isRising(trend) ? 1 : 0)
`;
        const result = convert(nestedSource, {
            externalSeriesInputs: [{ inputName: "trend", feedName: "trendInput" }],
        });
        const output = outputOf(result);

        expect(output).toContain(
            "const delta = (source: Series<number>) => source.current - source[1];",
        );
        expect(output).toContain("const isRising = (value: Series<number>) => delta(value) > 0;");
        expect(output).toContain("isRising((inputs.trend as Series<number>))");
        const compiled = await compile(output, {
            apiVersion: 1,
            sourcePath: "nested-external-source.chart.ts",
        });
        expect(compiled.moduleSource.length).toBeGreaterThan(0);
    });

    it("preserves a literal Pine title when the override omits title", () => {
        const output = outputOf(
            convert(source, {
                externalSeriesInputs: [{ inputName: "trend", feedName: "trendInput" }],
            }),
        );

        expect(output).toContain(
            'name: "trendInput", schema: { kind: "external-series-schema" }, title: "Pine title", inline: "row", tooltip: "help"',
        );
    });

    it("refuses missing, renamed, non-source, duplicate-target, duplicate-feed, and empty metadata", () => {
        const invalidCases: readonly Readonly<{
            opts: ConvertOpts;
            message: string;
        }>[] = [
            {
                opts: {
                    externalSeriesInputs: [{ inputName: "renamedTrend", feedName: "feed" }],
                },
                message: "was not found as a named Pine input",
            },
            {
                opts: { externalSeriesInputs: [{ inputName: "length", feedName: "feed" }] },
                message: "is not a Pine source input",
            },
            {
                opts: {
                    externalSeriesInputs: [
                        { inputName: "trend", feedName: "feedA" },
                        { inputName: "trend", feedName: "feedB" },
                    ],
                },
                message: "repeat Pine input `trend`",
            },
            {
                opts: {
                    externalSeriesInputs: [
                        { inputName: "trend", feedName: "sameFeed" },
                        { inputName: "otherTrend", feedName: "sameFeed" },
                    ],
                },
                message: "reuse feed name `sameFeed`",
            },
            {
                opts: { externalSeriesInputs: [{ inputName: "", feedName: "feed" }] },
                message: "must both be non-empty",
            },
        ];
        const invalidSource = `${source}\nlength = input.int(5)\notherTrend = input.source(open)\n`;
        const ordinary = outputOf(convert(invalidSource));

        for (const invalidCase of invalidCases) {
            const result = convert(invalidSource, invalidCase.opts);
            const invalidDiagnostics = result.diagnostics.filter(
                (diagnostic) =>
                    diagnostic.code ===
                    "pine-converter/transform/external-series-input-override-invalid",
            );
            expect(invalidDiagnostics).toHaveLength(1);
            expect(invalidDiagnostics[0]?.severity).toBe("error");
            expect(invalidDiagnostics[0]?.message).toContain(invalidCase.message);
            expect(outputOf(result)).toBe(ordinary);
        }
    });
});

describe("canonical MASM source override", () => {
    const source = readFileSync(MASM_SOURCE, "utf8");

    it("is deterministic, changes only the bound source path, and retains the earnings fallback", async () => {
        const disabled = convert(source, MASM_OPTS);
        const disabledAgain = convert(source, MASM_OPTS);
        const enabled = convert(source, MASM_EXTERNAL_OPTS);
        const enabledAgain = convert(source, MASM_EXTERNAL_OPTS);
        const disabledOutput = outputOf(disabled);
        const enabledOutput = outputOf(enabled);

        expect(disabledAgain).toEqual(disabled);
        expect(enabledAgain).toEqual(enabled);
        expect(enabled.diagnostics).toEqual(disabled.diagnostics);
        expect(disabledOutput).toContain(
            'lt_trend: input.source("close", { title: "Trend Wizard v1.0: Tab Trend Long ", inline: "4", tooltip: "" })',
        );
        expect(enabledOutput).toContain(
            'lt_trend: input.externalSeries<number>({ name: "trendInput", schema: { kind: "external-series-schema" }, title: "Trend Wizard v1.0: Tab Trend Long", inline: "4", tooltip: "" })',
        );
        expect(enabledOutput).not.toContain("bar[inputs.lt_trend as SourceField]");
        expect(enabledOutput).toContain("(inputs.lt_trend as Series<number>).current");
        expect(enabledOutput).toContain("(inputs.lt_trend as Series<number>)[1]");
        expect(enabledOutput).toContain(
            "earnings.value = 0 /* unsupported earnings feed disabled */;",
        );
        expect(enabledOutput).toContain(
            "earnings_due.value = ((0 as number) != 0) ? true : false;",
        );
        expect(codesOf(enabled)).toContain(
            "pine-converter/transform/request-security-earnings-feed-disabled",
        );

        const normalizedDisabled = disabledOutput
            .replace("type SourceField", "type Series")
            .replace(
                'lt_trend: input.source("close", { title: "Trend Wizard v1.0: Tab Trend Long ", inline: "4", tooltip: "" })',
                'lt_trend: input.externalSeries<number>({ name: "trendInput", schema: { kind: "external-series-schema" }, title: "Trend Wizard v1.0: Tab Trend Long", inline: "4", tooltip: "" })',
            )
            .replaceAll(
                "bar[inputs.lt_trend as SourceField][1]",
                "(inputs.lt_trend as Series<number>)[1]",
            )
            .replaceAll(
                "bar[inputs.lt_trend as SourceField]",
                "(inputs.lt_trend as Series<number>).current",
            );
        expect(enabledOutput).toBe(normalizedDisabled);

        const compiled = await compile(enabledOutput, {
            apiVersion: 1,
            sourcePath: "99-masm-strat-full.external-source.chart.ts",
        });
        expect(compiled.moduleSource.length).toBeGreaterThan(0);
    });

    it("keeps a disabled earnings local dynamic when Pine later reassigns it", () => {
        const reassignedSource = `//@version=6
indicator("Reassigned earnings")
earnings = request.security("ESD:NASDAQ;TQQQ;EARNINGS", "D", open)
earnings := close
plot(earnings[1])
`;
        const output = outputOf(convert(reassignedSource));

        expect(output).toContain("earnings.value = 0 /* unsupported earnings feed disabled */;");
        expect(output).toContain("earnings.value = bar.close.current;");
        expect(output).toContain("plot(earnings[1]);");
    });
});

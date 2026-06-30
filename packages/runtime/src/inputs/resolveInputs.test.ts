// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import { input, type ScriptManifest, type Series } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { RuntimeContext } from "../runtimeContext.js";
import { inMemoryStateStore } from "../stateStore.js";
import { createStreamState } from "../streamState.js";
import { createRuntimeViews } from "../views/index.js";
import {
    advanceExternalSeriesFeeds,
    createExternalSeriesSlots,
    isExternalSeriesFeed,
    isExternalSeriesFeedMap,
    replaceExternalSeriesFeedMap,
} from "./externalSeriesFeeds.js";
import { resolveInputs } from "./resolveInputs.js";

function manifest(inputs: ScriptManifest["inputs"]): ScriptManifest {
    return {
        apiVersion: 1,
        kind: "indicator",
        name: "demo",
        inputs,
        capabilities: ["indicators"],
        requestedIntervals: [],
        userPickableInterval: false,
        seriesCapacities: {},
        maxLookback: 0,
    };
}

function context(): RuntimeContext {
    const stream = createStreamState({ interval: "", capacity: 1, symbol: "" });
    const stateStore = inMemoryStateStore();
    return {
        stream,
        stateStore,
        capabilities: {
            plots: capabilities.allLines(),
            drawings: new Set(),
            alerts: new Set(),
            alertConditions: false,
            logs: false,
            inputs: new Set(),
            intervals: [],
            multiTimeframe: false,
            subPanes: 0,
            symInfoFields: new Set(),
            maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
            maxLookback: 5000,
            maxTickHz: 10,
        },
        emissions: {
            plots: [],
            drawings: [],
            alerts: [],
            diagnostics: [],
            fromBar: 0,
            toBar: 0,
        },
        barIndex: () => 0,
        isTick: false,
        drawingSlots: new Map(),
        drawingSubIdCounters: new Map(),
        drawingBucketCounters: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        scriptMaxDrawings: null,
        stateSlots: new Map(),
        seriesSlots: new Map(),
        arraySlots: new Map(),
        mapSlots: new Map(),
        objectSeriesSlots: new Map(),
        chartSymbol: "",
        secondaryStreams: new Map(),
        requestSecurityBars: new Map(),
        requestSecurityAlignments: new Map(),
        requestSecurityAscendingBars: new Map(),
        requestLowerTfViews: new Map(),
        diagnosedRequestKeys: new Set(),
        diagnosedTzKeys: new Set(),
        logBudget: 0,
        logBudgetExceededDiagnosed: false,
        resolvedInputs: Object.freeze({}),
        externalSeriesFeeds: Object.freeze({}),
        externalSeriesSlots: new Map(),
        defaultPane: "overlay",
        scriptPane: "script:demo",
        plotOverrides: Object.freeze({}),
        diagnosedInputKeys: new Set(),
        views: createRuntimeViews(),
    };
}

function expectSeries(value: unknown): Series<number> {
    expect(value).toBeDefined();
    return value as Series<number>;
}

describe("resolveInputs", () => {
    it("validates external series feed shapes", () => {
        expect(isExternalSeriesFeed({ values: [1, Number.NaN] })).toBe(true);
        expect(isExternalSeriesFeed(null)).toBe(false);
        expect(isExternalSeriesFeed([])).toBe(false);
        expect(isExternalSeriesFeed({})).toBe(false);
        expect(isExternalSeriesFeed({ values: "bad" })).toBe(false);
        expect(isExternalSeriesFeed({ values: [1, "bad"] })).toBe(false);

        expect(isExternalSeriesFeedMap({ feed: { values: [1] } })).toBe(true);
        expect(isExternalSeriesFeedMap(null)).toBe(false);
        expect(isExternalSeriesFeedMap([])).toBe(false);
        expect(isExternalSeriesFeedMap({ feed: { values: ["bad"] } })).toBe(false);
        expect(replaceExternalSeriesFeedMap(null)).toEqual({});
        expect(replaceExternalSeriesFeedMap({ feed: { values: [1] } })).toEqual({
            feed: { values: [1] },
        });
    });

    it("uses defaults when overrides are absent or explicitly undefined", () => {
        const ctx = context();
        const resolved = resolveInputs(
            manifest({
                length: input.int(14),
                flag: input.bool(true),
            }),
            { length: undefined },
            ctx,
        );

        expect(resolved).toEqual({ length: 14, flag: true });
        expect(Object.isFrozen(resolved)).toBe(true);
        expect(ctx.emissions.diagnostics).toEqual([]);
    });

    it.each([
        ["int", input.int(14), 20],
        ["float", input.float(1.5), 2.25],
        ["bool", input.bool(false), true],
        ["string", input.string("a"), "b"],
        ["enum", input.enum("fast", ["fast", "slow"]), "slow"],
        ["enum", input.enum(21, [8, 21, 30]), 30],
        ["color", input.color("#000000"), "#ffffff"],
        ["source", input.source("close"), "hlc3"],
        ["time", input.time(1), 2],
        ["price", input.price(1.25), 2.5],
        ["symbol", input.symbol("AAPL"), "MSFT"],
        ["interval", input.interval("1D"), "1m"],
        ["session", input.session("0930-1600"), "0800-1700"],
    ] as const)("accepts matching %s overrides", (_kind, descriptor, override) => {
        const ctx = context();
        const resolved = resolveInputs(manifest({ value: descriptor }), { value: override }, ctx);

        expect(resolved.value).toBe(override);
        expect(ctx.emissions.diagnostics).toEqual([]);
    });

    it.each([
        ["int", input.int(14), 20.5, 14],
        ["float", input.float(1.5), Number.NaN, 1.5],
        ["bool", input.bool(false), "true", false],
        ["string", input.string("a"), 123, "a"],
        ["enum", input.enum("fast", ["fast", "slow"]), "medium", "fast"],
        ["enum", input.enum(21, [8, 21, 30]), 99, 21],
        ["color", input.color("#000000"), false, "#000000"],
        ["source", input.source("close"), "typical", "close"],
        ["time", input.time(1), Number.POSITIVE_INFINITY, 1],
        ["price", input.price(1.25), Number.NaN, 1.25],
        ["symbol", input.symbol("AAPL"), 123, "AAPL"],
        ["interval", input.interval("1D"), 60, "1D"],
        ["session", input.session("0930-1600"), 930, "0930-1600"],
    ] as const)(
        "falls back and diagnoses mismatched %s overrides",
        (kind, descriptor, override, fallback) => {
            const ctx = context();
            const resolved = resolveInputs(
                manifest({ value: descriptor }),
                { value: override },
                ctx,
            );

            expect(resolved.value).toBe(fallback);
            expect(ctx.emissions.diagnostics).toEqual([
                {
                    kind: "diagnostic",
                    severity: "warning",
                    code: "input-coercion-failed",
                    message: expect.stringContaining(`expected ${kind}`),
                    slotId: "value",
                    bar: null,
                },
            ]);
        },
    );

    it("resolves external-series descriptors to stable numeric series views", () => {
        const ctx = context();
        ctx.externalSeriesFeeds = Object.freeze({ earnings: { values: [10, 20] } });
        ctx.externalSeriesSlots = createExternalSeriesSlots(
            [{ inputKey: "value", feedName: "earnings" }],
            2,
        );
        const descriptor = input.externalSeries({
            name: "earnings",
            schema: { kind: "external-series-schema" },
        });
        const resolved = resolveInputs(manifest({ value: descriptor }), {}, ctx);
        advanceExternalSeriesFeeds(ctx.externalSeriesSlots, ctx.externalSeriesFeeds, 0, false);
        advanceExternalSeriesFeeds(ctx.externalSeriesSlots, ctx.externalSeriesFeeds, 1, false);

        const series = expectSeries(resolved.value);
        expect(series.current).toBe(20);
        expect(series[0]).toBe(20);
        expect(series[1]).toBe(10);
        expect(resolveInputs(manifest({ value: descriptor }), {}, ctx).value).toBe(resolved.value);
        expect(ctx.emissions.diagnostics).toEqual([]);
    });

    it("uses NaN for missing feeds and ignores unknown feed keys", () => {
        const ctx = context();
        ctx.externalSeriesFeeds = Object.freeze({ other: { values: [99] } });
        ctx.externalSeriesSlots = createExternalSeriesSlots(
            [{ inputKey: "value", feedName: "earnings" }],
            1,
        );
        const resolved = resolveInputs(
            manifest({
                value: input.externalSeries({
                    name: "earnings",
                    schema: { kind: "external-series-schema" },
                }),
            }),
            {},
            ctx,
        );
        advanceExternalSeriesFeeds(ctx.externalSeriesSlots, ctx.externalSeriesFeeds, 0, false);

        expect(expectSeries(resolved.value).current).toBeNaN();
        expect(ctx.emissions.diagnostics).toEqual([]);
    });

    it("diagnoses invalid legacy external-series overrides once and keeps the series view", () => {
        const ctx = context();
        ctx.externalSeriesSlots = createExternalSeriesSlots(
            [{ inputKey: "value", feedName: "earnings" }],
            1,
        );
        const m = manifest({
            value: input.externalSeries({
                name: "earnings",
                schema: { kind: "external-series-schema" },
            }),
        });

        const resolved = resolveInputs(m, { value: null }, ctx);
        resolveInputs(m, { value: { values: ["bad"] } }, ctx);

        expect(resolved.value).toBe(ctx.externalSeriesSlots.get("value")?.view);
        expect(ctx.emissions.diagnostics).toEqual([
            {
                kind: "diagnostic",
                severity: "warning",
                code: "input-coercion-failed",
                message: expect.stringContaining("expected external-series"),
                slotId: "value",
                bar: null,
            },
        ]);
    });

    it("dedupes diagnostics per mount and key", () => {
        const ctx = context();
        const m = manifest({ length: input.int(14) });

        resolveInputs(m, { length: "bad" }, ctx);
        resolveInputs(m, { length: "still bad" }, ctx);

        expect(ctx.emissions.diagnostics).toHaveLength(1);
        expect(ctx.diagnosedInputKeys.has("length")).toBe(true);
    });

    it("ignores presentation metadata when resolving values", () => {
        const withoutMetadata = resolveInputs(manifest({ length: input.int(14) }), {}, context());
        const withMetadata = resolveInputs(
            manifest({
                length: input.int(14, {
                    group: "Trend",
                    tooltip: "Moving average length",
                    inline: "row-1",
                    display: "data-window",
                    confirm: true,
                }),
            }),
            {},
            context(),
        );

        expect(withMetadata).toEqual(withoutMetadata);
    });
});

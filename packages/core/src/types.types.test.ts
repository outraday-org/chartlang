// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import {
    type barcolor,
    type bgcolor,
    defineIndicator,
    type isCompiledScriptBundle,
    ta,
} from "./index.js";
import type {
    AlertConditionDefinition,
    Bar,
    BarSeries,
    BarStateView,
    BbResult,
    CompiledScriptBundle,
    CompiledScriptObject,
    ComputeContext,
    DependencyDeclaration,
    LineStyle,
    MacdResult,
    MutableSlot,
    NumberSeriesSlot,
    OutputDeclaration,
    PlotKind,
    PlotOverride,
    PlotSlotDescriptor,
    Price,
    PriceSeries,
    RequestedFeed,
    RequestNamespace,
    RequestSecurityOpts,
    ScaleAxis,
    ScriptManifest,
    ScriptOverrides,
    SecurityBar,
    SecurityExpr,
    SecurityExpressionDescriptor,
    Series,
    StateSnapshot,
    StateStoreKey,
    StreamSnapshot,
    SymInfoView,
    Time,
    TimeframeView,
    ValueFormat,
    Volume,
    VolumeSeries,
} from "./index.js";

describe("public type surface", () => {
    it("Series<number> numeric index resolves to number", () => {
        expectTypeOf<Series<number>[0]>().toEqualTypeOf<number>();
    });

    it("Series<number>.current is number", () => {
        expectTypeOf<Series<number>["current"]>().toEqualTypeOf<number>();
    });

    it("Bar (adapter/candle contract) keeps scalar Price/Volume fields", () => {
        expectTypeOf<Bar["time"]>().toEqualTypeOf<Time>();
        expectTypeOf<Bar["open"]>().toEqualTypeOf<Price>();
        expectTypeOf<Bar["close"]>().toEqualTypeOf<Price>();
        expectTypeOf<Bar["volume"]>().toEqualTypeOf<Volume>();
        expectTypeOf<Bar["hl2"]>().toEqualTypeOf<Price>();
    });

    it("BarSeries.time stays a scalar Time; price/volume fields are indexable series", () => {
        expectTypeOf<BarSeries["time"]>().toEqualTypeOf<Time>();
        expectTypeOf<BarSeries["open"]>().toEqualTypeOf<PriceSeries>();
        expectTypeOf<BarSeries["close"]>().toEqualTypeOf<PriceSeries>();
        expectTypeOf<BarSeries["volume"]>().toEqualTypeOf<VolumeSeries>();
    });

    it("BarSeries price fields are both a number and an indexable Series", () => {
        // scalar nature — assignable to a plain number and usable in arithmetic
        expectTypeOf<BarSeries["close"]>().toMatchTypeOf<number>();
        // series nature — a literal index and `.current` resolve to number
        expectTypeOf<BarSeries["close"][1]>().toEqualTypeOf<number>();
        expectTypeOf<BarSeries["close"]["current"]>().toEqualTypeOf<number>();
        expectTypeOf<BarSeries["close"]["length"]>().toEqualTypeOf<number>();
        // assignable to a Series<number> source argument (e.g. ta.* source)
        expectTypeOf<BarSeries["close"]>().toMatchTypeOf<Series<number>>();
    });

    it("BarSeries exposes the four Phase-2 derived sources as PriceSeries", () => {
        expectTypeOf<BarSeries["hl2"]>().toEqualTypeOf<PriceSeries>();
        expectTypeOf<BarSeries["hlc3"]>().toEqualTypeOf<PriceSeries>();
        expectTypeOf<BarSeries["ohlc4"]>().toEqualTypeOf<PriceSeries>();
        expectTypeOf<BarSeries["hlcc4"]>().toEqualTypeOf<PriceSeries>();
    });

    it("ComputeContext.bar is the indexable BarSeries", () => {
        expectTypeOf<ComputeContext["bar"]>().toEqualTypeOf<BarSeries>();
    });

    it("ComputeContext exposes the bgcolor/barcolor aliases by hole identity", () => {
        // The runtime binds these on the context; the type must match the
        // standalone core holes so a destructured `{ bgcolor }` call-shape
        // and the imported `bgcolor(...)` are interchangeable.
        expectTypeOf<ComputeContext["bgcolor"]>().toEqualTypeOf<typeof bgcolor>();
        expectTypeOf<ComputeContext["barcolor"]>().toEqualTypeOf<typeof barcolor>();
    });

    it("NumberSeriesSlot is both a writable scalar slot and an indexable series", () => {
        // resolves through the root export, and is assignable to BOTH halves
        // of the intersection (writable `.value` + indexable `Series<number>`)
        expectTypeOf<NumberSeriesSlot>().toMatchTypeOf<MutableSlot<number>>();
        expectTypeOf<NumberSeriesSlot>().toMatchTypeOf<Series<number>>();
        expectTypeOf<NumberSeriesSlot[1]>().toEqualTypeOf<number>();
        expectTypeOf<NumberSeriesSlot["current"]>().toEqualTypeOf<number>();
        expectTypeOf<NumberSeriesSlot["value"]>().toEqualTypeOf<number>();
    });

    it("ta.ema returns Series<number>", () => {
        expectTypeOf(ta.ema).returns.toEqualTypeOf<Series<number>>();
    });

    it("ta.bb returns BbResult", () => {
        expectTypeOf(ta.bb).returns.toEqualTypeOf<BbResult>();
    });

    it("ta.macd returns MacdResult", () => {
        expectTypeOf(ta.macd).returns.toEqualTypeOf<MacdResult>();
    });

    it("ta.crossover returns Series<boolean>", () => {
        expectTypeOf(ta.crossover).returns.toEqualTypeOf<Series<boolean>>();
    });

    it("ta.atr signature has no source argument", () => {
        expectTypeOf(ta.atr).parameter(0).toEqualTypeOf<number>();
    });

    it("defineIndicator returns CompiledScriptObject", () => {
        expectTypeOf(defineIndicator).returns.toEqualTypeOf<CompiledScriptObject>();
    });

    it("ComputeContext exposes Phase 4 core views", () => {
        expectTypeOf<ComputeContext["barstate"]>().toEqualTypeOf<BarStateView>();
        expectTypeOf<ComputeContext["syminfo"]>().toEqualTypeOf<SymInfoView>();
        expectTypeOf<ComputeContext["timeframe"]>().toEqualTypeOf<TimeframeView>();
        expectTypeOf<ComputeContext["request"]>().toEqualTypeOf<RequestNamespace>();
    });

    it("public request.security types resolve through the root export", () => {
        expectTypeOf<RequestNamespace["security"]>().returns.toEqualTypeOf<SecurityBar>();
        expectTypeOf<RequestNamespace["security"]>()
            .parameter(0)
            .toEqualTypeOf<RequestSecurityOpts>();
    });

    it("public request.security expression overload resolves through the root export", () => {
        const sec: RequestNamespace["security"] = (() => undefined) as never;
        const expr: SecurityExpr = (bar) => bar.close;
        expectTypeOf(sec({ interval: "1W" })).toEqualTypeOf<SecurityBar>();
        expectTypeOf(sec({ interval: "1W" }, expr)).toEqualTypeOf<Series<number>>();
    });

    it("public snapshot types resolve through the root export", () => {
        expectTypeOf<StateSnapshot["snapshotVersion"]>().toEqualTypeOf<1>();
        expectTypeOf<StateSnapshot["streams"]>().toEqualTypeOf<
            Readonly<Record<string, StreamSnapshot>>
        >();
        expectTypeOf<StateStoreKey["apiVersion"]>().toEqualTypeOf<1>();
    });

    it("ScriptManifest exposes Phase 4 script overrides", () => {
        expectTypeOf<ScriptManifest["maxBarsBack"]>().toEqualTypeOf<number | undefined>();
        expectTypeOf<ScriptManifest["format"]>().toEqualTypeOf<ValueFormat | undefined>();
        expectTypeOf<ScriptManifest["precision"]>().toEqualTypeOf<number | undefined>();
        expectTypeOf<ScriptManifest["scale"]>().toEqualTypeOf<ScaleAxis | undefined>();
        expectTypeOf<ScriptManifest["shortName"]>().toEqualTypeOf<string | undefined>();
        expectTypeOf<ScriptManifest["requiresIntervals"]>().toEqualTypeOf<
            ReadonlyArray<string> | undefined
        >();
        expectTypeOf<ScriptOverrides["format"]>().toEqualTypeOf<ValueFormat | undefined>();
    });

    it("ScriptManifest exposes the subpane-routing overlay flag", () => {
        expectTypeOf<ScriptManifest["overlay"]>().toEqualTypeOf<boolean | undefined>();
    });

    it("ScriptManifest exposes Phase 5 alert-condition metadata", () => {
        expectTypeOf<ScriptManifest["kind"]>().toEqualTypeOf<
            "indicator" | "drawing" | "alert" | "alertCondition"
        >();
        expectTypeOf<ScriptManifest["alertConditions"]>().toEqualTypeOf<
            ReadonlyArray<AlertConditionDefinition> | undefined
        >();
        expectTypeOf<ComputeContext["signal"]>().toEqualTypeOf<
            ((conditionId: string, fired: boolean) => void) | undefined
        >();
    });

    it("ScriptManifest exposes Phase 7 indicator-composition fields", () => {
        expectTypeOf<ScriptManifest["dependencies"]>().toEqualTypeOf<
            ReadonlyArray<DependencyDeclaration> | undefined
        >();
        expectTypeOf<ScriptManifest["outputs"]>().toEqualTypeOf<
            ReadonlyArray<OutputDeclaration> | undefined
        >();
        expectTypeOf<ScriptManifest["exportName"]>().toEqualTypeOf<string | undefined>();
        expectTypeOf<ScriptManifest["siblings"]>().toEqualTypeOf<
            ReadonlyArray<ScriptManifest> | undefined
        >();
        expectTypeOf<ScriptManifest["isDrawn"]>().toEqualTypeOf<boolean | undefined>();
    });

    it("CompiledScriptObject carries the Phase 7 dep accessors", () => {
        expectTypeOf<CompiledScriptObject["output"]>().toEqualTypeOf<
            (name: string) => Series<number>
        >();
        expectTypeOf<CompiledScriptObject["withInputs"]>().toEqualTypeOf<
            (overrides: Readonly<Record<string, unknown>>) => CompiledScriptObject
        >();
    });

    it("CompiledScriptBundle pins primary / siblings / dependencies", () => {
        expectTypeOf<CompiledScriptBundle["primary"]>().toEqualTypeOf<CompiledScriptObject>();
        expectTypeOf<CompiledScriptBundle["siblings"]>().toEqualTypeOf<
            ReadonlyArray<{
                readonly exportName: string;
                readonly compiled: CompiledScriptObject;
            }>
        >();
        expectTypeOf<CompiledScriptBundle["dependencies"]>().toEqualTypeOf<
            ReadonlyArray<{
                readonly localId: string;
                readonly compiled: CompiledScriptObject;
            }>
        >();
    });

    it("isCompiledScriptBundle narrows the union", () => {
        expectTypeOf<typeof isCompiledScriptBundle>().toEqualTypeOf<
            (v: CompiledScriptObject | CompiledScriptBundle) => v is CompiledScriptBundle
        >();
    });

    it("ScriptManifest exposes the plot-override static slot list", () => {
        expectTypeOf<ScriptManifest["plots"]>().toEqualTypeOf<
            ReadonlyArray<PlotSlotDescriptor> | undefined
        >();
    });

    it("PlotSlotDescriptor pins slotId / kind / optional title", () => {
        expectTypeOf<PlotSlotDescriptor["slotId"]>().toEqualTypeOf<string>();
        expectTypeOf<PlotSlotDescriptor["kind"]>().toEqualTypeOf<PlotKind>();
        expectTypeOf<PlotSlotDescriptor["title"]>().toEqualTypeOf<string | undefined>();
    });

    it("ScriptManifest exposes the optional HTF security-expression list", () => {
        expectTypeOf<ScriptManifest["securityExpressions"]>().toEqualTypeOf<
            ReadonlyArray<SecurityExpressionDescriptor> | undefined
        >();
    });

    it("SecurityExpressionDescriptor pins slotId / interval / paramName + optional symbol", () => {
        expectTypeOf<SecurityExpressionDescriptor["slotId"]>().toEqualTypeOf<string>();
        expectTypeOf<SecurityExpressionDescriptor["interval"]>().toEqualTypeOf<string>();
        expectTypeOf<SecurityExpressionDescriptor["paramName"]>().toEqualTypeOf<string>();
        expectTypeOf<SecurityExpressionDescriptor["symbol"]>().toEqualTypeOf<string | undefined>();
    });

    it("ScriptManifest exposes the optional requestedFeeds superset", () => {
        expectTypeOf<ScriptManifest["requestedFeeds"]>().toEqualTypeOf<
            ReadonlyArray<RequestedFeed> | undefined
        >();
        // requestedIntervals keeps its main-symbol HTF-projection shape
        expectTypeOf<ScriptManifest["requestedIntervals"]>().toEqualTypeOf<ReadonlyArray<string>>();
    });

    it("RequestedFeed pins optional symbol + required interval", () => {
        expectTypeOf<RequestedFeed["symbol"]>().toEqualTypeOf<string | undefined>();
        expectTypeOf<RequestedFeed["interval"]>().toEqualTypeOf<string>();
    });

    it("PlotOverride fields are all optional and JSON-clean", () => {
        expectTypeOf<PlotOverride["visible"]>().toEqualTypeOf<boolean | undefined>();
        expectTypeOf<PlotOverride["color"]>().toEqualTypeOf<string | undefined>();
        expectTypeOf<PlotOverride["lineWidth"]>().toEqualTypeOf<number | undefined>();
        expectTypeOf<PlotOverride["lineStyle"]>().toEqualTypeOf<LineStyle | undefined>();
    });
});

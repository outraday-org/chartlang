// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import { defineIndicator, ta } from "./index";
import type {
    Bar,
    BarStateView,
    AlertConditionDefinition,
    BbResult,
    CompiledScriptObject,
    ComputeContext,
    MacdResult,
    Price,
    RequestNamespace,
    RequestSecurityOpts,
    ScaleAxis,
    ScriptManifest,
    ScriptOverrides,
    SecurityBar,
    Series,
    StateSnapshot,
    StateStoreKey,
    StreamSnapshot,
    SymInfoView,
    Time,
    TimeframeView,
    ValueFormat,
    Volume,
} from "./index";

describe("public type surface", () => {
    it("Series<number> numeric index resolves to number", () => {
        expectTypeOf<Series<number>[0]>().toEqualTypeOf<number>();
    });

    it("Series<number>.current is number", () => {
        expectTypeOf<Series<number>["current"]>().toEqualTypeOf<number>();
    });

    it("Bar fields match the Time / Price / Volume aliases", () => {
        expectTypeOf<Bar["time"]>().toEqualTypeOf<Time>();
        expectTypeOf<Bar["open"]>().toEqualTypeOf<Price>();
        expectTypeOf<Bar["close"]>().toEqualTypeOf<Price>();
        expectTypeOf<Bar["volume"]>().toEqualTypeOf<Volume>();
    });

    it("Bar exposes the four Phase-2 derived sources as Price", () => {
        expectTypeOf<Bar["hl2"]>().toEqualTypeOf<Price>();
        expectTypeOf<Bar["hlc3"]>().toEqualTypeOf<Price>();
        expectTypeOf<Bar["ohlc4"]>().toEqualTypeOf<Price>();
        expectTypeOf<Bar["hlcc4"]>().toEqualTypeOf<Price>();
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
});

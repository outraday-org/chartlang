// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import { defineIndicator, ta } from "./index";
import type {
    Bar,
    BbResult,
    CompiledScriptObject,
    MacdResult,
    Price,
    Series,
    Time,
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
});

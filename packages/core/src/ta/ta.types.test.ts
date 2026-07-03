// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import type { Series } from "../types.js";
import { ta } from "./index.js";
import type { TaSource } from "./ta.js";

// A stand-in numeric series (e.g. `bar.close` / another `ta.*` output) and a
// boolean condition. The `ta.*` holes throw at runtime, so the call-site
// assertions live in `sourceCallSites`, which is NEVER invoked — `tsc`
// type-checks its body (that is the regression gate) while vitest only loads
// the module.
declare const close: Series<number>;
declare const cond: Series<boolean>;

function sourceCallSites(): void {
    // A real series source (the common case) stays type-clean.
    expectTypeOf(ta.ema(close, 20)).toEqualTypeOf<Series<number>>();
    expectTypeOf(ta.sma(close, 20)).toEqualTypeOf<Series<number>>();

    // A per-bar scalar source: was TS2345 before the widen; the runtime
    // already coerces it via `readSourceValue`.
    const slope = ((close.current - close[1]) / close[1]) * 100;
    expectTypeOf(ta.ema(slope, 5)).toEqualTypeOf<Series<number>>();
    expectTypeOf(ta.rsi((close.current - close[1]) * 10, 14)).toEqualTypeOf<Series<number>>();
    expectTypeOf(ta.change(close.current - close[1])).toEqualTypeOf<Series<number>>();

    // crossover / crossunder accept scalar operands, still return booleans.
    expectTypeOf(ta.crossover(close.current - close[1], 0)).toEqualTypeOf<Series<boolean>>();
    expectTypeOf(ta.crossunder(close, close.current)).toEqualTypeOf<Series<boolean>>();

    // valuewhen widens its numeric source but keeps a boolean condition.
    expectTypeOf(ta.valuewhen(cond, close.current - close[1])).toEqualTypeOf<Series<number>>();
}
void sourceCallSites;

describe("ta.* numeric source — TaSource widening", () => {
    it("TaSource is the number | Series<number> union", () => {
        expectTypeOf<TaSource>().toEqualTypeOf<number | Series<number>>();
    });

    it("numeric source params accept TaSource; boolean condition is untouched", () => {
        expectTypeOf(ta.ema).parameter(0).toEqualTypeOf<TaSource>();
        expectTypeOf(ta.sma).parameter(0).toEqualTypeOf<TaSource>();
        expectTypeOf(ta.crossover).parameter(0).toEqualTypeOf<TaSource>();
        expectTypeOf(ta.crossover).parameter(1).toEqualTypeOf<TaSource>();
        expectTypeOf(ta.valuewhen).parameter(0).toEqualTypeOf<Series<boolean>>();
        expectTypeOf(ta.valuewhen).parameter(1).toEqualTypeOf<TaSource>();
    });

    it("return types are unchanged by the widen", () => {
        expectTypeOf(ta.ema).returns.toEqualTypeOf<Series<number>>();
        expectTypeOf(ta.crossover).returns.toEqualTypeOf<Series<boolean>>();
    });
});

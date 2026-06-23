// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import { input } from "./input.js";
import type {
    BoolDescriptor,
    ColorDescriptor,
    EnumDescriptor,
    ExternalSeriesDescriptor,
    FloatDescriptor,
    InputDescriptor,
    IntDescriptor,
    IntervalDescriptorInput,
    PriceDescriptor,
    Schema,
    SessionDescriptor,
    SourceDescriptor,
    StringDescriptor,
    SymbolDescriptor,
    TimeDescriptor,
} from "./inputDescriptor.js";

describe("input builder type surface", () => {
    it("resolves scalar builder return types", () => {
        expectTypeOf(input.int(20)).toEqualTypeOf<IntDescriptor>();
        expectTypeOf(input.float(2.5)).toEqualTypeOf<FloatDescriptor>();
        expectTypeOf(input.bool(true)).toEqualTypeOf<BoolDescriptor>();
        expectTypeOf(input.string("AAPL")).toEqualTypeOf<StringDescriptor>();
        expectTypeOf(input.color("#26a69a")).toEqualTypeOf<ColorDescriptor>();
        expectTypeOf(input.source("close")).toEqualTypeOf<SourceDescriptor>();
        expectTypeOf(input.time(1_700_000_000_000)).toEqualTypeOf<TimeDescriptor>();
        expectTypeOf(input.price(101.25)).toEqualTypeOf<PriceDescriptor>();
        expectTypeOf(input.symbol("AAPL")).toEqualTypeOf<SymbolDescriptor>();
        expectTypeOf(input.interval("1D")).toEqualTypeOf<IntervalDescriptorInput>();
        expectTypeOf(input.session("0930-1600")).toEqualTypeOf<SessionDescriptor>();
    });

    it("preserves enum literal unions", () => {
        expectTypeOf(input.enum("a", ["a", "b"] as const)).toEqualTypeOf<
            EnumDescriptor<"a" | "b">
        >();
    });

    it("carries external series schema payload type", () => {
        const schema: Schema<number> = { kind: "external-series-schema" };
        expectTypeOf(input.externalSeries({ name: "feed", schema })).toEqualTypeOf<
            ExternalSeriesDescriptor<number>
        >();
    });

    it("assigns descriptors to the shared union", () => {
        expectTypeOf(input.bool(true)).toMatchTypeOf<InputDescriptor<unknown>>();
    });
});

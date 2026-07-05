// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import { input } from "../input/input.js";
import type { SourceField } from "../input/inputDescriptor.js";
import type { Series } from "../types.js";
import { defineIndicator } from "./defineIndicator.js";
import type { DefineIndicatorOpts } from "./defineIndicator.js";
import type { ScaleAxis, ValueFormat } from "./overrides.js";

const SCHEMA = { kind: "external-series-schema" as const };

describe("DefineIndicatorOpts", () => {
    it("accepts optional Phase 4 script overrides", () => {
        const opts: DefineIndicatorOpts = {
            name: "EMA",
            apiVersion: 1,
            maxBarsBack: 100,
            format: "price",
            precision: 4,
            scale: "right",
            requiresIntervals: ["1D"],
            shortName: "EMA",
            compute: () => {},
        };

        expectTypeOf(opts.maxBarsBack).toEqualTypeOf<number | undefined>();
        expectTypeOf(opts.format).toEqualTypeOf<ValueFormat | undefined>();
        expectTypeOf(opts.precision).toEqualTypeOf<number | undefined>();
        expectTypeOf(opts.scale).toEqualTypeOf<ScaleAxis | undefined>();
        expectTypeOf(opts.requiresIntervals).toEqualTypeOf<ReadonlyArray<string> | undefined>();
        expectTypeOf(opts.shortName).toEqualTypeOf<string | undefined>();
    });
});

describe("compute inputs bag typing", () => {
    it("types each input.<key> as its resolved runtime value type", () => {
        defineIndicator({
            name: "typed-inputs",
            apiVersion: 1,
            inputs: {
                bound: input.externalSeries<number>({ name: "bound", schema: SCHEMA }),
                boundDefault: input.externalSeries({ name: "bd", schema: SCHEMA }),
                len: input.int(20),
                flag: input.bool(true),
                mode: input.enum("a", ["a", "b"] as const),
                src: input.source("close"),
                label: input.string("x"),
            },
            compute({ inputs, ta }) {
                // External-series reads are `Series<number>` cast-free, both with
                // the explicit `<number>` generic and with it omitted (R4).
                expectTypeOf(inputs.bound).toEqualTypeOf<Series<number>>();
                expectTypeOf(inputs.boundDefault).toEqualTypeOf<Series<number>>();
                expectTypeOf(inputs.bound.current).toEqualTypeOf<number>();
                // One representative per other descriptor kind, anchored to the
                // types `resolveInputs` writes at runtime.
                expectTypeOf(inputs.len).toEqualTypeOf<number>();
                expectTypeOf(inputs.flag).toEqualTypeOf<boolean>();
                expectTypeOf(inputs.mode).toEqualTypeOf<"a" | "b">();
                expectTypeOf(inputs.src).toEqualTypeOf<SourceField>();
                expectTypeOf(inputs.label).toEqualTypeOf<string>();
                // The series view feeds a `ta.*` (`ScalarOrSeries`) with no cast.
                ta.sma(inputs.bound, inputs.len);
                // Negative: the view is NOT a plain number (a `typeof` guard would
                // still compile, so assign it to a `number` instead).
                // @ts-expect-error external-series input is Series<number>, not number
                const n: number = inputs.bound;
                void n;
            },
        });
    });

    it("keeps a no-inputs script's bag as Readonly<Record<string, unknown>>", () => {
        defineIndicator({
            name: "no-inputs",
            apiVersion: 1,
            compute({ inputs }) {
                expectTypeOf(inputs).toEqualTypeOf<Readonly<Record<string, unknown>>>();
            },
        });
    });
});

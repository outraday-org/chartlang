// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import type { DefineIndicatorOpts } from "./defineIndicator";
import type { ScaleAxis, ValueFormat } from "./overrides";

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

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import type { Price, Series, Time, Volume } from "../types.js";
import type { SecurityBar } from "./request.js";

describe("SecurityBar type surface", () => {
    it("exposes numeric OHLCV and derived fields as typed series", () => {
        expectTypeOf<SecurityBar["time"]>().toEqualTypeOf<Series<Time>>();
        expectTypeOf<SecurityBar["open"]>().toEqualTypeOf<Series<Price>>();
        expectTypeOf<SecurityBar["high"]>().toEqualTypeOf<Series<Price>>();
        expectTypeOf<SecurityBar["low"]>().toEqualTypeOf<Series<Price>>();
        expectTypeOf<SecurityBar["close"]>().toEqualTypeOf<Series<Price>>();
        expectTypeOf<SecurityBar["volume"]>().toEqualTypeOf<Series<Volume>>();
        expectTypeOf<SecurityBar["hl2"]>().toEqualTypeOf<Series<Price>>();
        expectTypeOf<SecurityBar["hlc3"]>().toEqualTypeOf<Series<Price>>();
        expectTypeOf<SecurityBar["ohlc4"]>().toEqualTypeOf<Series<Price>>();
        expectTypeOf<SecurityBar["hlcc4"]>().toEqualTypeOf<Series<Price>>();
    });

    it("exposes symbol metadata as string series", () => {
        expectTypeOf<SecurityBar["symbol"]>().toEqualTypeOf<Series<string>>();
        expectTypeOf<SecurityBar["interval"]>().toEqualTypeOf<Series<string>>();
    });
});

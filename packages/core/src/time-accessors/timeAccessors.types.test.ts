// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import type { Time } from "../types.js";
import type { TimeNamespace } from "./timeAccessors.js";

const runtimeTime: TimeNamespace = {
    year: () => 0,
    month: () => 0,
    dayofmonth: () => 0,
    dayofweek: () => 0,
    hour: () => 0,
    minute: () => 0,
    second: () => 0,
    timestamp: () => 0,
    timeClose: () => 0,
};

describe("time namespace type surface", () => {
    it("calendar accessors return number with an optional tz argument", () => {
        expectTypeOf(runtimeTime.year(0)).toEqualTypeOf<number>();
        expectTypeOf(runtimeTime.year(0, "UTC")).toEqualTypeOf<number>();
        expectTypeOf(runtimeTime.month(0)).toEqualTypeOf<number>();
        expectTypeOf(runtimeTime.dayofmonth(0)).toEqualTypeOf<number>();
        expectTypeOf(runtimeTime.dayofweek(0)).toEqualTypeOf<number>();
        expectTypeOf(runtimeTime.hour(0)).toEqualTypeOf<number>();
        expectTypeOf(runtimeTime.minute(0)).toEqualTypeOf<number>();
        expectTypeOf(runtimeTime.second(0)).toEqualTypeOf<number>();
    });

    it("timestamp returns a Time from calendar fields", () => {
        expectTypeOf(runtimeTime.timestamp(2024, 1, 2)).toEqualTypeOf<Time>();
        expectTypeOf(runtimeTime.timestamp(2024, 1, 2, 9, 30, 0, "UTC")).toEqualTypeOf<Time>();
    });

    it("timeClose returns a Time (bar close epoch)", () => {
        expectTypeOf(runtimeTime.timeClose(0)).toEqualTypeOf<Time>();
        expectTypeOf(runtimeTime.timeClose(0, "UTC")).toEqualTypeOf<Time>();
    });
});

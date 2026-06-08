// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { IntervalDescriptor } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { makeTimeframeView } from "./timeframeView";

function descriptor(value: string, group: string): IntervalDescriptor {
    return { value, label: value, group };
}

describe("makeTimeframeView", () => {
    it.each([
        ["15s", "second", 15, true, false, false, false],
        ["5m", "minute", 300, true, false, false, false],
        ["2h", "hour", 7_200, true, false, false, false],
        ["1D", "daily", 86_400, false, true, false, false],
        ["1W", "weekly", 604_800, false, false, true, false],
        ["1M", "monthly", 2_629_800, false, false, false, true],
        ["1Q", "quarterly", 7_889_400, false, false, false, true],
        ["1Y", "yearly", 31_557_600, false, false, false, true],
    ])("derives %s/%s", (value, group, seconds, isintraday, isdaily, isweekly, ismonthly) => {
        const view = makeTimeframeView(value, descriptor(value, group));

        expect(view).toEqual({
            period: value,
            isintraday,
            isdaily,
            isweekly,
            ismonthly,
            inSeconds: seconds,
        });
        expect(Object.isFrozen(view)).toBe(true);
    });

    it("falls back to NaN seconds for unknown groups or missing numeric prefixes", () => {
        const custom = makeTimeframeView("1X", descriptor("1X", "custom"));
        const noPrefix = makeTimeframeView("D", descriptor("D", "daily"));

        expect(custom.period).toBe("1X");
        expect(Number.isNaN(custom.inSeconds)).toBe(true);
        expect(Number.isNaN(noPrefix.inSeconds)).toBe(true);
    });
});

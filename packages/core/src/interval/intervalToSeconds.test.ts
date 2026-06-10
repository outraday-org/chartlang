// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { intervalToSeconds } from "./intervalToSeconds.js";

const d = (value: string, intervalSeconds?: number) => ({
    value,
    label: value,
    group: "test",
    ...(intervalSeconds === undefined ? {} : { intervalSeconds }),
});

describe("intervalToSeconds", () => {
    it.each([
        ["30s", 30],
        ["5", 300],
        ["5m", 300],
        ["4H", 14_400],
        ["1h", 3_600],
        ["1D", 86_400],
        ["1W", 604_800],
        ["1M", 2_592_000],
        ["1Y", 31_536_000],
    ])("parses %s", (value, expected) => {
        expect(intervalToSeconds(d(value))).toBe(expected);
    });

    it("prefers the intervalSeconds override", () => {
        expect(intervalToSeconds(d("bad", 7))).toBe(7);
    });

    it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
        "rejects invalid intervalSeconds %s",
        (intervalSeconds) => {
            expect(() => intervalToSeconds(d("1m", intervalSeconds))).toThrow(
                "intervalSeconds must be a positive finite number",
            );
        },
    );

    it.each(["", "abc", "0D", "-5m", "5x"])("rejects invalid value %s", (value) => {
        expect(() => intervalToSeconds(d(value))).toThrow();
    });
});

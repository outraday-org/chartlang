// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { time } from "./timeAccessors.js";

describe("time callable holes", () => {
    it("throws sentinels for time.* accessors outside an active script step", () => {
        expect(() => time.year(0)).toThrow("time.year called outside an active script step");
        expect(() => time.month(0)).toThrow("time.month called outside an active script step");
        expect(() => time.dayofmonth(0)).toThrow(
            "time.dayofmonth called outside an active script step",
        );
        expect(() => time.dayofweek(0)).toThrow(
            "time.dayofweek called outside an active script step",
        );
        expect(() => time.hour(0)).toThrow("time.hour called outside an active script step");
        expect(() => time.minute(0)).toThrow("time.minute called outside an active script step");
        expect(() => time.second(0)).toThrow("time.second called outside an active script step");
        expect(() => time.timestamp(2024, 1, 2)).toThrow(
            "time.timestamp called outside an active script step",
        );
        expect(() => time.now()).toThrow("time.now called outside an active script step");
        expect(() => time.timeClose(0)).toThrow(
            "time.timeClose called outside an active script step",
        );
    });

    it("freezes the namespace", () => {
        expect(Object.isFrozen(time)).toBe(true);
    });
});

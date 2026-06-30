// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { type TimeNamespace, time } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { BUILTIN_CALL_MAP, lowerBuiltinCall } from "./builtinCalls.js";

describe("BUILTIN_CALL_MAP", () => {
    it("lowers time() to the bare bar.time epoch", () => {
        expect(BUILTIN_CALL_MAP.get("time")?.([])).toBe("bar.time");
    });

    it("rejects the time(timeframe) resolution form", () => {
        expect(BUILTIN_CALL_MAP.get("time")?.(["tf"])).toBeNull();
    });

    it("lowers time_close() to time.timeClose(bar.time)", () => {
        expect(BUILTIN_CALL_MAP.get("time_close")?.([])).toBe("time.timeClose(bar.time)");
    });

    it("rejects time_close with an explicit timeframe arg", () => {
        expect(BUILTIN_CALL_MAP.get("time_close")?.(["tf"])).toBeNull();
    });

    it("lowers numeric-first timestamp arities to time.timestamp(...)", () => {
        expect(BUILTIN_CALL_MAP.get("timestamp")?.(["2019", "1", "1"])).toBe(
            "time.timestamp(2019, 1, 1)",
        );
        expect(BUILTIN_CALL_MAP.get("timestamp")?.(["2019", "1", "1", "0", "0"])).toBe(
            "time.timestamp(2019, 1, 1, 0, 0)",
        );
        expect(
            BUILTIN_CALL_MAP.get("timestamp")?.(["2019", "1", "1", "0", "0", "0", '"UTC"']),
        ).toBe('time.timestamp(2019, 1, 1, 0, 0, 0, "UTC")');
    });

    it("rejects timestamp arities outside the numeric-first supported shape", () => {
        expect(BUILTIN_CALL_MAP.get("timestamp")?.(["2019", "1"])).toBeNull();
        expect(
            BUILTIN_CALL_MAP.get("timestamp")?.([
                "2019",
                "1",
                "1",
                "0",
                "0",
                "0",
                '"UTC"',
                "extra",
            ]),
        ).toBeNull();
        expect(BUILTIN_CALL_MAP.get("timestamp")?.(['"UTC"', "2019", "1", "1"])).toBeNull();
    });

    it("targets the real core time.timestamp surface", () => {
        const timestamp3: (
            year: number,
            month: number,
            day: number,
        ) => ReturnType<TimeNamespace["timestamp"]> = time.timestamp;
        const timestamp7: (
            year: number,
            month: number,
            day: number,
            hour: number,
            minute: number,
            second: number,
            tz: string,
        ) => ReturnType<TimeNamespace["timestamp"]> = time.timestamp;

        expect(time).toHaveProperty("timestamp");
        expect(timestamp3).toBe(time.timestamp);
        expect(timestamp7).toBe(time.timestamp);
    });

    it("lowers dayofweek(t) / dayofweek(t, tz) preserving the args", () => {
        expect(BUILTIN_CALL_MAP.get("dayofweek")?.(["bar.time"])).toBe("time.dayofweek(bar.time)");
        expect(BUILTIN_CALL_MAP.get("dayofweek")?.(["bar.time", '"UTC"'])).toBe(
            'time.dayofweek(bar.time, "UTC")',
        );
    });

    it("falls back to the no-arg bar.time epoch for a bare dayofweek() call", () => {
        expect(BUILTIN_CALL_MAP.get("dayofweek")?.([])).toBe("time.dayofweek(bar.time)");
    });
});

describe("lowerBuiltinCall", () => {
    it("returns the mapped source for a known calendar built-in", () => {
        expect(lowerBuiltinCall("time_close", [])).toBe("time.timeClose(bar.time)");
        expect(lowerBuiltinCall("timestamp", ["2019", "1", "1", "0", "0"])).toBe(
            "time.timestamp(2019, 1, 1, 0, 0)",
        );
        expect(lowerBuiltinCall("dayofweek", ["t", "tz"])).toBe("time.dayofweek(t, tz)");
    });

    it("returns null for a non-calendar callee", () => {
        expect(lowerBuiltinCall("ta.sma", ["x"])).toBeNull();
        expect(lowerBuiltinCall("myFn", [])).toBeNull();
    });

    it("returns null for an unmapped argument shape of a known built-in", () => {
        expect(lowerBuiltinCall("time", ["tf"])).toBeNull();
        expect(lowerBuiltinCall("timestamp", ['"UTC"', "2019", "1", "1"])).toBeNull();
    });
});

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

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
        expect(lowerBuiltinCall("dayofweek", ["t", "tz"])).toBe("time.dayofweek(t, tz)");
    });

    it("returns null for a non-calendar callee", () => {
        expect(lowerBuiltinCall("ta.sma", ["x"])).toBeNull();
        expect(lowerBuiltinCall("myFn", [])).toBeNull();
    });

    it("returns null for an unmapped argument shape of a known built-in", () => {
        expect(lowerBuiltinCall("time", ["tf"])).toBeNull();
    });
});

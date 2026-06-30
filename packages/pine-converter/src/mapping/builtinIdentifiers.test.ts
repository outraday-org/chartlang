// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { BUILTIN_IDENTIFIER_MAP, remapIdentifier } from "./builtinIdentifiers.js";

describe("BUILTIN_IDENTIFIER_MAP", () => {
    it("maps OHLCV series to bar.* fields", () => {
        expect(BUILTIN_IDENTIFIER_MAP.get("open")).toBe("bar.open");
        expect(BUILTIN_IDENTIFIER_MAP.get("high")).toBe("bar.high");
        expect(BUILTIN_IDENTIFIER_MAP.get("low")).toBe("bar.low");
        expect(BUILTIN_IDENTIFIER_MAP.get("close")).toBe("bar.close");
        expect(BUILTIN_IDENTIFIER_MAP.get("volume")).toBe("bar.volume");
    });

    it("maps the synthetic-price aggregates and time", () => {
        expect(BUILTIN_IDENTIFIER_MAP.get("hl2")).toBe("bar.hl2");
        expect(BUILTIN_IDENTIFIER_MAP.get("hlc3")).toBe("bar.hlc3");
        expect(BUILTIN_IDENTIFIER_MAP.get("ohlc4")).toBe("bar.ohlc4");
        expect(BUILTIN_IDENTIFIER_MAP.get("time")).toBe("bar.time");
    });

    it("maps the bare calendar reads to their no-arg accessor calls", () => {
        expect(BUILTIN_IDENTIFIER_MAP.get("dayofweek")).toBe("time.dayofweek(bar.time)");
        expect(BUILTIN_IDENTIFIER_MAP.get("time_close")).toBe("time.timeClose(bar.time)");
        expect(BUILTIN_IDENTIFIER_MAP.get("timenow")).toBe("time.now()");
    });

    it("maps bar_index to the converter-emitted helper call", () => {
        expect(BUILTIN_IDENTIFIER_MAP.get("bar_index")).toBe("__barIndexBridge()");
    });

    it("carries the xloc string sentinels", () => {
        expect(BUILTIN_IDENTIFIER_MAP.get("xloc.bar_index")).toBe("bar-index");
        expect(BUILTIN_IDENTIFIER_MAP.get("xloc.bar_time")).toBe("bar-time");
    });

    it("does not map na (its emission is context-sensitive)", () => {
        expect(BUILTIN_IDENTIFIER_MAP.has("na")).toBe(false);
    });
});

describe("remapIdentifier", () => {
    it("returns the mapped chartlang form for a built-in", () => {
        expect(remapIdentifier("close")).toBe("bar.close");
        expect(remapIdentifier("bar_index")).toBe("__barIndexBridge()");
    });

    it("returns null for an unmapped name", () => {
        expect(remapIdentifier("myVar")).toBeNull();
        expect(remapIdentifier("na")).toBeNull();
    });
});

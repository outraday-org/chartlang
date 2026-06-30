// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it, vi } from "vitest";

import { harness } from "../ta/__fixtures__/runPrimitive.js";
import { makeSymInfoView, makeTimeframeView } from "../views/index.js";
import { buildTimeNamespace, createTimeNamespace } from "./timeAccessors.js";

// 2024-01-02T13:45:30Z — a Tuesday.
const FIXTURE = Date.UTC(2024, 0, 2, 13, 45, 30);

function utc() {
    return createTimeNamespace(
        () => "UTC",
        () => 0,
        () => 0,
        () => {},
    );
}

describe("createTimeNamespace — calendar fields (UTC)", () => {
    const time = utc();

    it("reads each field of the fixture", () => {
        expect(time.year(FIXTURE)).toBe(2024);
        expect(time.month(FIXTURE)).toBe(1);
        expect(time.dayofmonth(FIXTURE)).toBe(2);
        expect(time.hour(FIXTURE)).toBe(13);
        expect(time.minute(FIXTURE)).toBe(45);
        expect(time.second(FIXTURE)).toBe(30);
    });

    it("returns Pine dayofweek (1=Sun..7=Sat)", () => {
        expect(time.dayofweek(FIXTURE)).toBe(3); // Tuesday
        expect(time.dayofweek(Date.UTC(2024, 0, 7))).toBe(1); // Sunday
        expect(time.dayofweek(Date.UTC(2024, 0, 6))).toBe(7); // Saturday
    });

    it("returns NaN for non-finite inputs on every accessor", () => {
        for (const t of [Number.NaN, Number.POSITIVE_INFINITY]) {
            expect(time.year(t)).toBeNaN();
            expect(time.month(t)).toBeNaN();
            expect(time.dayofmonth(t)).toBeNaN();
            expect(time.dayofweek(t)).toBeNaN();
            expect(time.hour(t)).toBeNaN();
            expect(time.minute(t)).toBeNaN();
            expect(time.second(t)).toBeNaN();
            expect(time.timeClose(t)).toBeNaN();
        }
    });
});

describe("createTimeNamespace — tz resolution", () => {
    it("falls back to the mount default then UTC", () => {
        const fromDefault = createTimeNamespace(
            () => "+02:00",
            () => 0,
            () => 0,
            () => {},
        );
        expect(fromDefault.hour(FIXTURE)).toBe(15); // 13:45Z + 2h

        const emptyDefault = createTimeNamespace(
            () => "",
            () => 0,
            () => 0,
            () => {},
        );
        expect(emptyDefault.hour(FIXTURE)).toBe(13); // empty default → UTC
    });

    it("an explicit fixed offset shifts the date across midnight", () => {
        const time = utc();
        // 2024-01-02T23:30Z in +01:00 → 2024-01-03T00:30 local.
        const t = Date.UTC(2024, 0, 2, 23, 30);
        expect(time.dayofmonth(t, "+01:00")).toBe(3);
        expect(time.hour(t, "+01:00")).toBe(0);
        expect(time.dayofweek(t, "+01:00")).toBe(4); // Wednesday
    });

    it("a DST zone falls back to UTC and flags onDstUnsupported", () => {
        const onDst = vi.fn();
        const time = createTimeNamespace(
            () => "UTC",
            () => 0,
            () => 0,
            onDst,
        );
        expect(time.hour(FIXTURE, "America/New_York")).toBe(13); // UTC fallback
        expect(onDst).toHaveBeenCalledWith("America/New_York");
    });
});

describe("createTimeNamespace — timestamp", () => {
    const time = utc();

    it("round-trips against the accessors", () => {
        const t = time.timestamp(2024, 1, 2, 13, 45, 30);
        expect(t).toBe(FIXTURE);
        expect(time.year(t)).toBe(2024);
        expect(time.hour(t)).toBe(13);
    });

    it("defaults hour/minute/second to 0", () => {
        expect(time.timestamp(2024, 1, 2)).toBe(Date.UTC(2024, 0, 2));
    });

    it("applies the offset (fields are interpreted in tz)", () => {
        // 2024-01-02T00:00 local in +02:00 is 2023-01-01T22:00Z.
        expect(time.timestamp(2024, 1, 2, 0, 0, 0, "+02:00")).toBe(Date.UTC(2024, 0, 1, 22, 0, 0));
    });

    it("returns NaN for out-of-range or non-integer fields", () => {
        expect(time.timestamp(2024, 13, 1)).toBeNaN(); // month
        expect(time.timestamp(2024, 0, 1)).toBeNaN(); // month < 1
        expect(time.timestamp(2024, 1, 32)).toBeNaN(); // day
        expect(time.timestamp(2024, 1, 0)).toBeNaN(); // day < 1
        expect(time.timestamp(2024, 1, 1, 24)).toBeNaN(); // hour
        expect(time.timestamp(2024, 1, 1, -1)).toBeNaN(); // hour < 0
        expect(time.timestamp(2024, 1, 1, 0, 60)).toBeNaN(); // minute
        expect(time.timestamp(2024, 1, 1, 0, -1)).toBeNaN(); // minute < 0
        expect(time.timestamp(2024, 1, 1, 0, 0, 60)).toBeNaN(); // second
        expect(time.timestamp(2024, 1, 1, 0, 0, -1)).toBeNaN(); // second < 0
        expect(time.timestamp(2024.5, 1, 1)).toBeNaN(); // non-integer
    });
});

describe("createTimeNamespace — timeClose", () => {
    it("returns bar start + interval", () => {
        const time = createTimeNamespace(
            () => "UTC",
            () => 60_000, // 1-minute interval in ms
            () => 0,
            () => {},
        );
        expect(time.timeClose(FIXTURE)).toBe(FIXTURE + 60_000);
    });

    it("flags a DST tz even though the close instant is tz-invariant", () => {
        const onDst = vi.fn();
        const time = createTimeNamespace(
            () => "UTC",
            () => 60_000,
            () => 0,
            onDst,
        );
        expect(time.timeClose(FIXTURE, "Europe/London")).toBe(FIXTURE + 60_000);
        expect(onDst).toHaveBeenCalledWith("Europe/London");
    });
});

describe("createTimeNamespace — now", () => {
    it("reads the host clock getter at call time", () => {
        let current = 123_456;
        const time = createTimeNamespace(
            () => "UTC",
            () => 0,
            () => current,
            () => {},
        );
        expect(time.now()).toBe(123_456);
        current = 789_000;
        expect(time.now()).toBe(789_000);
    });
});

function oneBar(time: number): Bar {
    return {
        close: 100,
        high: 101,
        interval: "1m",
        low: 99,
        open: 100,
        symbol: "TEST",
        time,
        volume: 1,
    };
}

describe("buildTimeNamespace — install + diagnostic dedup", () => {
    it("defaults tz from syminfo.timezone and dedupes the DST diagnostic", () => {
        const diagnostics = harness([oneBar(FIXTURE)], 8, (_bar, ctx) => {
            ctx.views.syminfo = makeSymInfoView({ timezone: "+02:00" }, new Set(["timezone"]));
            const time = buildTimeNamespace(ctx, () => 0);
            // Default tz (+02:00) shifts the hour.
            expect(time.hour(FIXTURE)).toBe(15);
            // Two DST-zone reads → exactly one diagnostic for that tz.
            time.year(FIXTURE, "America/New_York");
            time.month(FIXTURE, "America/New_York");
            // A different DST tz warns again.
            time.year(FIXTURE, "Europe/London");
            return ctx.emissions.diagnostics;
        });
        const codes = diagnostics[0].filter((d) => d.code === "tz-dst-unsupported");
        expect(codes).toHaveLength(2);
        expect(codes[0].message).toContain("America/New_York");
        expect(codes[0].slotId).toBeNull();
        expect(codes.map((d) => d.message)).toContainEqual(
            expect.stringContaining("Europe/London"),
        );
    });

    it("reads timeClose's interval from the live timeframe view", () => {
        const out = harness([oneBar(FIXTURE)], 8, (_bar, ctx) => {
            // Install a concrete 5-minute timeframe so inSeconds is finite.
            ctx.views.timeframe = makeTimeframeView("5m", {
                value: "5m",
                label: "5 minutes",
                group: "minute",
            });
            const time = buildTimeNamespace(ctx, () => 0);
            return time.timeClose(FIXTURE);
        });
        expect(out[0]).toBe(FIXTURE + 5 * 60 * 1000);
    });

    it("reads now from the injected runner clock", () => {
        let current = 1_700_000_000_000;
        const out = harness([oneBar(FIXTURE), oneBar(FIXTURE + 60_000)], 8, (_bar, ctx) => {
            const time = buildTimeNamespace(ctx, () => current);
            const value = time.now();
            current += 1;
            return value;
        });
        expect(out).toEqual([1_700_000_000_000, 1_700_000_000_001]);
    });
});

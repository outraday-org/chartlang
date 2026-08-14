// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { createSessionCalendar } from "@invinite-org/chartlang-core";
import { describe, expect, it, vi } from "vitest";

import { harness } from "../ta/__fixtures__/runPrimitive.js";
import { makeSymInfoView } from "../views/index.js";
import { buildSessionNamespace, createSessionNamespace } from "./sessionAccessors.js";
import { buildTimeNamespace } from "./timeAccessors.js";

// A given hour:minute on 2024-01-02 (UTC). The date is irrelevant — `isOpen`
// only reads the local minute-of-day.
function at(hh: number, mm: number): number {
    return Date.UTC(2024, 0, 2, hh, mm, 0);
}

function utc() {
    return createSessionNamespace(
        () => "UTC",
        () => {},
    );
}

describe("createSessionNamespace — membership", () => {
    const session = utc();

    it("is true inside a normal window and false outside", () => {
        expect(session.isOpen(at(10, 0), "0930-1600")).toBe(true);
        expect(session.isOpen(at(8, 0), "0930-1600")).toBe(false);
        expect(session.isOpen(at(17, 0), "0930-1600")).toBe(false);
    });

    it("is half-open: start is inclusive, end is exclusive", () => {
        expect(session.isOpen(at(9, 30), "0930-1600")).toBe(true); // start inclusive
        expect(session.isOpen(at(15, 59), "0930-1600")).toBe(true); // last minute in
        expect(session.isOpen(at(16, 0), "0930-1600")).toBe(false); // end exclusive
    });

    it("handles a midnight-wrap window (both arms)", () => {
        const overnight = "2200-0400";
        expect(session.isOpen(at(23, 0), overnight)).toBe(true); // [start, 1440)
        expect(session.isOpen(at(22, 0), overnight)).toBe(true); // start inclusive
        expect(session.isOpen(at(2, 0), overnight)).toBe(true); // [0, end)
        expect(session.isOpen(at(4, 0), overnight)).toBe(false); // end exclusive
        expect(session.isOpen(at(12, 0), overnight)).toBe(false); // mid-day, outside
    });

    it("returns false for a malformed spec", () => {
        expect(session.isOpen(at(10, 0), "garbage")).toBe(false);
        expect(session.isOpen(at(10, 0), "2500-1600")).toBe(false);
    });

    it("returns false for a non-finite epoch", () => {
        expect(session.isOpen(Number.NaN, "0930-1600")).toBe(false);
        expect(session.isOpen(Number.POSITIVE_INFINITY, "0930-1600")).toBe(false);
    });
});

describe("createSessionNamespace — tz resolution", () => {
    it("a fixed offset shifts membership", () => {
        const session = utc();
        // 08:00Z is OUT of 0930-1600 UTC, but in +02:00 it is 10:00 local → IN.
        expect(session.isOpen(at(8, 0), "0930-1600", "+02:00")).toBe(true);
        // 09:00Z is 11:00 in +02:00 (in) but 06:00 in -03:00 (out).
        expect(session.isOpen(at(9, 0), "0930-1600", "-03:00")).toBe(false);
    });

    it("falls back to the mount default tz, then UTC", () => {
        const fromDefault = createSessionNamespace(
            () => "+02:00",
            () => {},
        );
        expect(fromDefault.isOpen(at(8, 0), "0930-1600")).toBe(true); // default +02:00

        const emptyDefault = createSessionNamespace(
            () => "",
            () => {},
        );
        expect(emptyDefault.isOpen(at(8, 0), "0930-1600")).toBe(false); // empty → UTC
    });

    it("a DST zone falls back to UTC and flags onDstUnsupported", () => {
        const onDst = vi.fn();
        const session = createSessionNamespace(() => "UTC", onDst);
        // America/New_York can't resolve → UTC fallback; 10:00Z is in window.
        expect(session.isOpen(at(10, 0), "0930-1600", "America/New_York")).toBe(true);
        expect(onDst).toHaveBeenCalledWith("America/New_York");
    });

    it("does not flag a DST zone when t is non-finite or the spec is malformed", () => {
        const onDst = vi.fn();
        const session = createSessionNamespace(() => "UTC", onDst);
        expect(session.isOpen(Number.NaN, "0930-1600", "America/New_York")).toBe(false);
        expect(session.isOpen(at(10, 0), "garbage", "America/New_York")).toBe(false);
        expect(onDst).not.toHaveBeenCalled();
    });
});

describe("createSessionNamespace — exchange calendar", () => {
    // Every `at(...)` epoch is on 2024-01-02.
    const calendar = createSessionCalendar([
        { dayKey: "2024-01-02", kind: "halfDay", closeMinutes: 13 * 60 },
        { dayKey: "2024-01-04", kind: "closed" },
    ]);
    const withCalendar = (tz = "UTC") =>
        createSessionNamespace(
            () => tz,
            () => {},
            calendar,
        );

    it("caps a normal window at the early close", () => {
        const session = withCalendar();
        expect(session.isOpen(at(12, 59), "0930-1600")).toBe(true);
        expect(session.isOpen(at(13, 0), "0930-1600")).toBe(false);
        expect(session.isOpen(at(15, 0), "0930-1600")).toBe(false);
        // Before the window opens the calendar changes nothing.
        expect(session.isOpen(at(8, 0), "0930-1600")).toBe(false);
    });

    it("leaves a window that already ends before the early close alone", () => {
        const session = createSessionNamespace(
            () => "UTC",
            () => {},
            createSessionCalendar([
                { dayKey: "2024-01-02", kind: "halfDay", closeMinutes: 23 * 60 },
            ]),
        );
        expect(session.isOpen(at(15, 0), "0930-1600")).toBe(true);
        expect(session.isOpen(at(16, 0), "0930-1600")).toBe(false);
    });

    it("is never open on a closed day", () => {
        const session = createSessionNamespace(
            () => "UTC",
            () => {},
            calendar,
        );
        const onClosedDay = (hh: number) => Date.UTC(2024, 0, 4, hh, 0, 0);
        expect(session.isOpen(onClosedDay(10), "0930-1600")).toBe(false);
        expect(session.isOpen(onClosedDay(23), "2200-0400")).toBe(false);
    });

    it("applies the early close to a midnight-wrap window's evening arm only", () => {
        const session = withCalendar();
        // 02:00 is inside [0, 04:00) and before the 13:00 close → still open.
        expect(session.isOpen(at(2, 0), "2200-0400")).toBe(true);
        // 23:00 is inside [22:00, 1440) but after the early close → shut.
        expect(session.isOpen(at(23, 0), "2200-0400")).toBe(false);
    });

    it("fails open on a day the calendar says nothing about", () => {
        const session = withCalendar();
        const otherDay = Date.UTC(2024, 0, 3, 15, 0, 0);
        expect(session.isOpen(otherDay, "0930-1600")).toBe(true);
    });

    it("keys the calendar off the LOCAL day, not the UTC one", () => {
        // 2024-01-02T23:00Z is 2024-01-03T01:00 at +02:00, so the 01-02 half-day
        // row must NOT apply and the 01-03 row must.
        const shifted = createSessionNamespace(
            () => "+02:00",
            () => {},
            createSessionCalendar([{ dayKey: "2024-01-03", kind: "closed" }]),
        );
        expect(shifted.isOpen(at(23, 0), "0000-0400")).toBe(false);
        expect(withCalendar("+02:00").isOpen(at(23, 0), "0000-0400")).toBe(true);
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

describe("buildSessionNamespace — install + shared dedup", () => {
    it("defaults tz from syminfo.timezone", () => {
        const out = harness([oneBar(at(8, 0))], 8, (_bar, ctx) => {
            ctx.views.syminfo = makeSymInfoView({ timezone: "+02:00" }, new Set(["timezone"]));
            const session = buildSessionNamespace(ctx);
            return session.isOpen(at(8, 0), "0930-1600"); // 10:00 local (+02:00) → in
        });
        expect(out[0]).toBe(true);
    });

    it("shares the tz-dst-unsupported dedup with time.* (once per tz total)", () => {
        const diagnostics = harness([oneBar(at(10, 0))], 8, (_bar, ctx) => {
            const time = buildTimeNamespace(ctx, () => 0);
            const session = buildSessionNamespace(ctx);
            // A DST read on the time path AND the session path for the SAME tz
            // must warn exactly once total (shared ctx.diagnosedTzKeys).
            time.year(at(10, 0), "America/New_York");
            session.isOpen(at(10, 0), "0930-1600", "America/New_York");
            return ctx.emissions.diagnostics;
        });
        const codes = diagnostics[0].filter((d) => d.code === "tz-dst-unsupported");
        expect(codes).toHaveLength(1);
        expect(codes[0].message).toContain("America/New_York");
    });
});

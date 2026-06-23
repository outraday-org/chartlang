// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
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
            const time = buildTimeNamespace(ctx);
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

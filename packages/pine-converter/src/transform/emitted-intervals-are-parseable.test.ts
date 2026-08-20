// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Every interval string the converter can emit must be one chartlang itself can
 * parse.
 *
 * Until 0.9.2 the timeframe table lowered Pine `"D"`/`"W"` to `"1d"`/`"1w"`,
 * which chartlang's own grammar (`^(\d+)([smHhDWMY]?)$`, `intervalToSeconds` in
 * `@invinite-org/chartlang-core`) has no suffix for, so `intervalToSeconds({
 * value: "1d" })` throws.
 *
 * Every in-tree caller CATCHES that throw, so the damage was silent rather than
 * loud: a feed refused by name on any roster that does not declare the literal
 * (every default one), and — where a host DOES declare it — a
 * `secondaryIsFinerThanMain` that answers "not finer" and quietly picks the
 * repainting alignment branch. Nothing was red here either: the converter's own
 * suites compared emitted text against goldens carrying the same wrong token,
 * and the compiler does not validate `request.security` interval literals.
 *
 * So the oracle here is deliberately NOT another table — it is core's real
 * parser, applied to the values the converter actually emits.
 */
import { intervalToSeconds } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { convert } from "../index.js";

import { pineTimeframeToInterval } from "./timeframeConvert.js";

/** Every Pine timeframe spelling the converter's table accepts. */
const PINE_TIMEFRAMES: ReadonlyArray<string> = [
    "1S",
    "15S",
    "1",
    "5",
    "60",
    "240",
    "D",
    "1D",
    "W",
    "1W",
    "M",
    "1M",
];

function parses(interval: string): boolean {
    try {
        intervalToSeconds({ group: "test", label: interval, value: interval });

        return true;
    } catch {
        return false;
    }
}

describe("every convertible Pine timeframe maps to a parseable chartlang interval", () => {
    it.each(PINE_TIMEFRAMES)("Pine %s", (pine) => {
        const interval = pineTimeframeToInterval(pine);

        expect(interval, `${pine} is in the table`).not.toBeNull();

        expect(parses(interval as string), `chartlang cannot parse ${interval}`).toBe(true);
    });

    it("agrees with core on the duration, not merely on parseability", () => {
        // A table that mapped `"D"` to a parseable-but-wrong token (`"1M"`)
        // would pass the sweep above. Pin the four tiers that carry a unit.
        expect(
            intervalToSeconds({
                group: "t",
                label: "d",
                value: pineTimeframeToInterval("D") as string,
            }),
        ).toBe(86_400);

        expect(
            intervalToSeconds({
                group: "t",
                label: "w",
                value: pineTimeframeToInterval("W") as string,
            }),
        ).toBe(604_800);

        expect(
            intervalToSeconds({
                group: "t",
                label: "h",
                value: pineTimeframeToInterval("60") as string,
            }),
        ).toBe(3_600);

        // Pine `"M"` is a MONTH. chartlang's `"1m"` would be one MINUTE, so a
        // case slip here is a 43 200× error rather than a refusal.
        expect(
            intervalToSeconds({
                group: "t",
                label: "M",
                value: pineTimeframeToInterval("M") as string,
            }),
        ).toBe(2_592_000);
    });
});

describe("the intervals a real conversion emits are parseable", () => {
    /** Pull every `interval: "…"` literal out of a converted script. */
    function emittedIntervals(source: string): ReadonlyArray<string> {
        return [...source.matchAll(/interval:\s*"([^"]*)"/g)].map((match) => match[1]);
    }

    it("through `request.security`, on both the same-symbol and cross-symbol axes", () => {
        const result = convert(`//@version=6
indicator("X")
d = request.security(syminfo.tickerid, "D", close)
w = request.security(syminfo.tickerid, "W", close)
h = request.security(syminfo.tickerid, "60", close)
q = request.security("NASDAQ:QQQ", "D", close)
plot(((d + w) + h) + q)
`);

        const intervals = emittedIntervals(result.output ?? "");

        expect(intervals).toEqual(["1D", "1W", "1h", "1D"]);

        for (const interval of intervals) {
            expect(parses(interval), `chartlang cannot parse ${interval}`).toBe(true);
        }
    });

    it("through an `input.timeframe` default", () => {
        const result = convert(`//@version=6
indicator("X")
tf = input.timeframe("D", "Timeframe")
plot(request.security(syminfo.tickerid, tf, close))
`);

        // The default is baked into the `input.interval` descriptor, so it has
        // to be parseable there too — the feed's `interval` is a reference.
        expect(result.output).toContain('input.interval("1D"');
    });

    it("leaves the empty chart-timeframe default alone", () => {
        // Pine's `""` means "the chart's own clock" and is NOT an interval to
        // parse. It must survive the case fix unchanged.
        const result = convert(`//@version=6
indicator("X")
tf = input.timeframe("", "Timeframe")
plot(request.security(syminfo.tickerid, tf, close))
`);

        expect(result.output).toContain('input.interval(""');
    });
});

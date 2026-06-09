// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { PlotEmission } from "@invinite-org/chartlang-adapter-kit";
import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { makeSymInfoView } from "../views";
import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { sessionVolumeProfile } from "./sessionVolumeProfile";
import { visibleRangeVolumeProfile } from "./visibleRangeVolumeProfile";

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

function bars(count: number, start = 1_700_000_000_000): Bar[] {
    const out: Bar[] = [];
    for (let i = 0; i < count; i += 1) {
        const close = 100 + i * 0.25;
        out.push({
            close,
            high: close + 0.5,
            interval: "1m",
            low: close - 0.5,
            open: close - 0.1,
            symbol: "T",
            time: start + i * MINUTE_MS,
            volume: 1_000 + i * 10,
        });
    }
    return out;
}

function sessionBars(days: number): Bar[] {
    const start = Math.floor(1_700_000_000_000 / DAY_MS) * DAY_MS;
    const out: Bar[] = [];
    for (let day = 0; day < days; day += 1) {
        const base = start + day * DAY_MS + 9.5 * 60 * MINUTE_MS;
        for (let i = 0; i < 4; i += 1) {
            const close = 100 + day * 20 + i;
            out.push({
                close,
                high: close + 0.5,
                interval: "1m",
                low: close - 0.5,
                open: close,
                symbol: "T",
                time: base + i * MINUTE_MS,
                volume: 1_000 + day * 100 + i,
            });
        }
    }
    return out;
}

function constantBars(count: number, start = 1_700_000_000_000): Bar[] {
    return bars(count, start).map((bar) => ({
        ...bar,
        close: 42,
        high: 42,
        low: 42,
        open: 42,
    }));
}

function enableSession(ctx: Parameters<Parameters<typeof harness>[2]>[1], session = "0930-1600") {
    ctx.capabilities.symInfoFields.add("session");
    ctx.views.syminfo = makeSymInfoView({ session }, new Set(["session"]));
}

function lastPlot(plots: ReadonlyArray<PlotEmission>): PlotEmission {
    const plot = plots[plots.length - 1];
    if (plot === undefined) throw new Error("missing plot emission");
    return plot;
}

describe("ta.sessionVolumeProfile", () => {
    it("single-session input matches visible-range profile windowed from session start", () => {
        const input = bars(60, 1_700_000_000_000 + 9.5 * 60 * MINUTE_MS);
        const sessionStart = input[0].time;
        const session = harness(
            input,
            128,
            () => sessionVolumeProfile("slot", { sessionStart, rowSize: 24 }).poc.current,
        );
        const visible = harness(
            input.slice(1),
            128,
            () => visibleRangeVolumeProfile("slot", { rowSize: 24 }).poc.current,
        );
        expect(session[0]).toBeNaN();
        expect(session[59]).toBeCloseTo(visible[58], 10);
    });

    it("resets at each parsed session descriptor boundary", () => {
        const input = sessionBars(3);
        const out = harness(input, 32, (_bar, ctx) => {
            enableSession(ctx);
            return sessionVolumeProfile("slot", { rowSize: 12 }).poc.current;
        });
        expect(out[0]).toBeNaN();
        expect(out[4]).toBeNaN();
        expect(out[8]).toBeNaN();
        const pocs = [out[3], out[7], out[11]];
        expect(new Set(pocs.map((value) => value.toFixed(8))).size).toBe(3);
    });

    it("parses hour-only session starts", () => {
        const input = bars(3, Math.floor(1_700_000_000_000 / DAY_MS) * DAY_MS + 10 * 60 * MINUTE_MS);
        const out = harness(input, 16, (_bar, ctx) => {
            enableSession(ctx, "9-1600");
            return sessionVolumeProfile("slot").poc.current;
        });
        expect(Number.isFinite(out[2])).toBe(true);
    });

    it("uses the previous day's session boundary before today's start", () => {
        const start = Math.floor(1_700_000_000_000 / DAY_MS) * DAY_MS + 8 * 60 * MINUTE_MS;
        const input = bars(3, start);
        const out = harness(input, 16, (_bar, ctx) => {
            enableSession(ctx, "0930-1600");
            return sessionVolumeProfile("slot").poc.current;
        });
        expect(Number.isFinite(out[2])).toBe(true);
    });

    it("falls back when parsed session fields are out of range", () => {
        const input = bars(2, Math.floor(1_700_000_000_000 / DAY_MS) * DAY_MS);
        const out = harness(input, 16, (_bar, ctx) => {
            enableSession(ctx, "2460-2500");
            sessionVolumeProfile("slot");
            return ctx.emissions.diagnostics.filter(
                (diagnostic) => diagnostic.code === "session-info-missing",
            ).length;
        });
        expect(out[1]).toBe(1);
    });

    it("falls back when only the session end hour is out of range", () => {
        const input = bars(2, Math.floor(1_700_000_000_000 / DAY_MS) * DAY_MS);
        const out = harness(input, 16, (_bar, ctx) => {
            enableSession(ctx, "0900-2500");
            sessionVolumeProfile("slot");
            return ctx.emissions.diagnostics.filter(
                (diagnostic) => diagnostic.code === "session-info-missing",
            ).length;
        });
        expect(out[1]).toBe(1);
    });

    it("parses a session descriptor whose end is hour-only", () => {
        const input = sessionBars(2);
        const out = harness(input, 16, (_bar, ctx) => {
            enableSession(ctx, "0930-16");
            return sessionVolumeProfile("slot").poc.current;
        });
        expect(out.some((value) => Number.isFinite(value))).toBe(true);
    });

    it("handles a session boundary on the current bar by resetting that bar", () => {
        const input = sessionBars(2);
        const out = harness(input, 16, (_bar, ctx) => {
            enableSession(ctx);
            return sessionVolumeProfile("slot").poc.current;
        });
        expect(Number.isFinite(out[3])).toBe(true);
        expect(out[4]).toBeNaN();
    });

    it("falls back to UTC-day boundaries and emits session-info-missing once", () => {
        const input = bars(4, Math.floor(1_700_000_000_000 / DAY_MS) * DAY_MS);
        const out = harness(input, 16, (_bar, ctx) => {
            const result = sessionVolumeProfile("slot");
            return {
                diagnosticCount: ctx.emissions.diagnostics.filter(
                    (diagnostic) => diagnostic.code === "session-info-missing",
                ).length,
                poc: result.poc.current,
            };
        });
        expect(out[0].poc).toBeNaN();
        expect(out[out.length - 1].diagnosticCount).toBe(1);
    });

    it("falls back to UTC-day boundaries when syminfo.session cannot be parsed", () => {
        const input = bars(4, Math.floor(1_700_000_000_000 / DAY_MS) * DAY_MS);
        const out = harness(input, 16, (_bar, ctx) => {
            enableSession(ctx, "bad-session");
            const result = sessionVolumeProfile("slot");
            return {
                diagnostics: ctx.emissions.diagnostics.filter(
                    (diagnostic) => diagnostic.code === "session-info-missing",
                ).length,
                poc: result.poc.current,
            };
        });
        expect(out[0].poc).toBeNaN();
        expect(out[out.length - 1].diagnostics).toBe(1);
    });

    it("opts.sessionStart takes precedence over syminfo.session", () => {
        const input = bars(6, 1_700_000_000_000 + 9.5 * 60 * MINUTE_MS);
        const out = harness(input, 16, (_bar, ctx) => {
            enableSession(ctx, "0000-2359");
            return sessionVolumeProfile("slot", { sessionStart: input[3].time }).poc.current;
        });
        expect(out[0]).toBeNaN();
        expect(out[3]).toBeNaN();
        expect(Number.isFinite(out[5])).toBe(true);
    });

    it("returns live buckets, plot buckets, stable identity, and offset views", () => {
        const input = bars(6, 1_700_000_000_000 + 9.5 * 60 * MINUTE_MS);
        const refs = new Set<unknown>();
        const unshifted = harness(input, 16, (_bar, ctx) => {
            const result = sessionVolumeProfile("slot", { sessionStart: input[0].time });
            refs.add(result);
            const plot = lastPlot(ctx.emissions.plots);
            return {
                buckets: result.buckets.length,
                plotBuckets:
                    plot.style.kind === "horizontal-histogram" ? plot.style.buckets.length : 0,
                poc: result.poc.current,
            };
        });
        const shifted = harness(
            input,
            16,
            () =>
                sessionVolumeProfile("slot", { sessionStart: input[0].time, offset: 1 }).poc
                    .current,
        );
        expect(refs.size).toBe(1);
        expect(unshifted[5].plotBuckets).toBe(unshifted[5].buckets);
        expect(shifted[5]).toBe(unshifted[4].poc);
    });

    it("applies bucket color and accepts value-area percentage inputs above one", () => {
        const input = bars(4, 1_700_000_000_000 + 9.5 * 60 * MINUTE_MS);
        const out = harness(input, 16, () => {
            const result = sessionVolumeProfile("slot", {
                sessionStart: input[0].time,
                bucketColor: "#90caf9",
                valueAreaPct: 70,
            });
            return result.buckets[0]?.color;
        });
        expect(out[3]).toBe("#90caf9");
    });

    it("collapses constant-price sessions to one colored bucket", () => {
        const input = constantBars(3, 1_700_000_000_000 + 9.5 * 60 * MINUTE_MS);
        const out = harness(input, 16, () => {
            const result = sessionVolumeProfile("slot", {
                sessionStart: input[0].time,
                bucketColor: "#90caf9",
            });
            return { color: result.buckets[0]?.color, poc: result.poc.current };
        });
        expect(out[2]).toEqual({ color: "#90caf9", poc: 42 });
    });

    it("collapses constant-price sessions to one uncolored bucket", () => {
        const input = constantBars(3, 1_700_000_000_000 + 9.5 * 60 * MINUTE_MS);
        const out = harness(input, 16, () =>
            sessionVolumeProfile("slot", { sessionStart: input[0].time }),
        );
        expect(out[2].buckets[0]).toEqual({ price: 42, volume: 2030 });
    });

    it("leaves degenerate sessions empty without finite positive volume", () => {
        const input = constantBars(2, 1_700_000_000_000 + 9.5 * 60 * MINUTE_MS).map((bar) => ({
            ...bar,
            close: Number.NaN,
            volume: 0,
        }));
        const out = harness(input, 16, () =>
            sessionVolumeProfile("slot", { sessionStart: input[0].time }),
        );
        expect(out[1].buckets).toEqual([]);
        expect(out[1].poc.current).toBeNaN();
    });

    it("exposes live buckets through shifted results", () => {
        const input = bars(4, 1_700_000_000_000 + 9.5 * 60 * MINUTE_MS);
        const out = harness(input, 16, () => {
            const result = sessionVolumeProfile("slot", {
                sessionStart: input[0].time,
                offset: 1,
            });
            return result.buckets.length;
        });
        expect(out[3]).toBeGreaterThan(0);
    });

    it("diagnoses when horizontal histogram plots are not supported", () => {
        const input = bars(3, 1_700_000_000_000 + 9.5 * 60 * MINUTE_MS);
        const out = harness(input, 8, (_bar, ctx) => {
            ctx.capabilities.plots.delete("horizontal-histogram");
            sessionVolumeProfile("slot", { sessionStart: input[0].time });
            return ctx.emissions.diagnostics.filter(
                (diagnostic) => diagnostic.code === "unsupported-plot-kind",
            ).length;
        });
        // Deduped per slot: one diagnostic across the run, not one per bar.
        expect(out[out.length - 1]).toBe(1);
    });

    it("throws outside an active script step", () => {
        expect(() => sessionVolumeProfile("oops")).toThrowError(
            /ta.sessionVolumeProfile called outside an active script step/,
        );
    });
});

describe("ta.sessionVolumeProfile tick-mode", () => {
    it("replaces the head without advancing the output buffers", () => {
        const input = bars(4, 1_700_000_000_000 + 9.5 * 60 * MINUTE_MS);
        const { ctxRef } = harnessWithCtx(input, 10, () =>
            sessionVolumeProfile("slot", { sessionStart: input[0].time }),
        );
        const tickBar = { ...input[3], close: 110, high: 110.5, low: 109.5, volume: 50 };
        const tickResult = tick(ctxRef, tickBar, () => {
            const result = sessionVolumeProfile("slot", { sessionStart: input[0].time });
            return { head: result.poc.current, length: result.poc.length };
        });
        expect(tickResult.length).toBe(input.length);
        expect(Number.isFinite(tickResult.head)).toBe(true);
    });
});

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars.js";
import { macd } from "./macd.js";

describe("ta.macd — golden", () => {
    it("matches the pinned hashes for 100 bars × default lengths", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(bars, bars.length + 1, (bar) => {
            const r = macd("slot", bar.close);
            return { m: r.macd.current, s: r.signal.current, h: r.hist.current };
        });
        expect(hashFloat64Array(out.map((o) => o.m))).toBe("705c42df");
        expect(hashFloat64Array(out.map((o) => o.s))).toBe("6748dba1");
        expect(hashFloat64Array(out.map((o) => o.h))).toBe("5808d612");
    });
});

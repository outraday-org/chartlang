// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { assertAlertBar, assertAscending, projectBar, toRuntimeBar } from "./bar.js";
import type { AlertBar } from "./types.js";

const BAR: AlertBar = { time: 1_000, open: 1, high: 4, low: 0, close: 3, volume: 9 };

describe("bar helpers", () => {
    it("builds the runtime bar with derived sources", () => {
        const bar = toRuntimeBar(BAR, "AAPL", "1h");
        expect(bar).toMatchObject({
            time: 1_000,
            symbol: "AAPL",
            interval: "1h",
            hl2: 2,
            hlc3: 7 / 3,
            ohlc4: 2,
            hlcc4: 2.5,
        });
        expect("closeTime" in bar).toBe(false);
        expect(bar.point(-3, 5)).toEqual({ time: 1_000, price: 5 });
        expect(toRuntimeBar({ ...BAR, closeTime: 2_000 }, "AAPL", "1h").closeTime).toBe(2_000);
    });

    it("projects only the OHLCV fields", () => {
        const wide = { ...BAR, symbol: "X", hl2: 2 } as AlertBar;
        expect(projectBar(wide)).toEqual(BAR);
        expect(projectBar({ ...BAR, closeTime: 5 })).toEqual({ ...BAR, closeTime: 5 });
    });

    it("validates fields and ordering", () => {
        expect(() => assertAlertBar(BAR, "x")).not.toThrow();
        expect(() => assertAlertBar({ ...BAR, volume: Number.NaN }, "x")).toThrow(/finite/);
        expect(() => assertAlertBar({ ...BAR, open: "1" as unknown as number }, "x")).toThrow(
            /finite/,
        );
        expect(() => assertAlertBar({ ...BAR, closeTime: Number.NaN }, "x")).toThrow(/closeTime/);
        expect(() => assertAscending([BAR, { ...BAR, time: 2_000 }], "x")).not.toThrow();
        expect(() => assertAscending([BAR, BAR], "x")).toThrow(/ascending/);
    });
});

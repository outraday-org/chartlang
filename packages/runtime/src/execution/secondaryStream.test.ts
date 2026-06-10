// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { createStreamState } from "../streamState.js";
import { replaceSecondaryHead } from "./secondaryStream.js";

describe("secondary stream helpers", () => {
    it("appends a bar when replacing the head of an empty stream", () => {
        const stream = createStreamState({ interval: "1D", capacity: 4, symbol: "AAPL" });

        replaceSecondaryHead(stream, {
            time: 1,
            open: 10,
            high: 12,
            low: 9,
            close: 11,
            volume: 100,
            symbol: "AAPL",
            interval: "1D",
        });

        expect(stream.ohlcv.close.length).toBe(1);
        expect(stream.seriesViews.close.current).toBe(11);
        expect(stream.bar.hl2).toBe(10.5);
    });
});

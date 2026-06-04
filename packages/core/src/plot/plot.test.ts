// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { hline, plot } from "./plot";

describe("plot callable hole", () => {
    it("plot throws outside-runtime sentinel for scalar input", () => {
        expect(() => plot(42)).toThrow("plot called outside compiled runtime");
    });

    it("plot throws outside-runtime sentinel for series input", () => {
        expect(() => plot({ current: 0, length: 0 }, { color: "#000" })).toThrow(
            "plot called outside compiled runtime",
        );
    });

    it("hline throws outside-runtime sentinel", () => {
        expect(() => hline(70, { color: "#ef4444", lineStyle: "dashed" })).toThrow(
            "hline called outside compiled runtime",
        );
    });
});

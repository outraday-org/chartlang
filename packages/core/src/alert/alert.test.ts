// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { alert } from "./alert.js";

describe("alert callable hole", () => {
    it("throws outside-runtime sentinel with default opts", () => {
        expect(() => alert("hello")).toThrow("alert called outside compiled runtime");
    });

    it("throws outside-runtime sentinel with explicit opts", () => {
        expect(() => alert("crossover", { severity: "warning", meta: { reason: "demo" } })).toThrow(
            "alert called outside compiled runtime",
        );
    });
});

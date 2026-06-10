// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { getFormatter } from "./dateTimeFormatCache";

describe("getFormatter", () => {
    it("caches by timezone and fields", () => {
        expect(getFormatter("UTC", { year: "numeric" })).toBe(
            getFormatter("UTC", { year: "numeric" }),
        );
        expect(getFormatter("UTC", { year: "numeric" })).not.toBe(
            getFormatter("America/New_York", { year: "numeric" }),
        );
        expect(getFormatter("UTC", { year: "numeric" })).not.toBe(
            getFormatter("UTC", { month: "2-digit" }),
        );
    });
});

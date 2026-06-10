// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { weekKey } from "./weekKey";

describe("weekKey", () => {
    it("handles ISO week-year edges", () => {
        expect(weekKey("UTC", Date.UTC(2021, 0, 1))).toBe("2020-W53");
        expect(weekKey("UTC", Date.UTC(2018, 11, 31))).toBe("2019-W01");
        expect(weekKey("UTC", Date.UTC(2024, 0, 4))).toBe("2024-W01");
    });

    it("maps Sunday into the preceding ISO week", () => {
        expect(weekKey("UTC", Date.UTC(2024, 0, 7))).toBe("2024-W01");
        expect(weekKey("UTC", Date.UTC(2024, 0, 8))).toBe("2024-W02");
    });
});

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { spanBetween } from "./spans.js";

describe("spanBetween", () => {
    it("composes the start of the first span with the end of the second", () => {
        const a = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 3 };
        const b = { startLine: 2, startColumn: 4, endLine: 2, endColumn: 9 };
        expect(spanBetween(a, b)).toEqual({
            startLine: 1,
            startColumn: 1,
            endLine: 2,
            endColumn: 9,
        });
    });

    it("is idempotent when start equals end", () => {
        const s = { startLine: 3, startColumn: 5, endLine: 3, endColumn: 6 };
        expect(spanBetween(s, s)).toEqual(s);
    });
});

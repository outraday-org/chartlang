// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { type TableOpts, table } from "./table.js";

describe("draw.table compile-time hole", () => {
    it("throws outside the compiled runtime", () => {
        const opts: TableOpts = {
            position: "top-right",
            cells: [[{ text: "P&L" }, { text: "+12.5%", textColor: "#16a34a" }]],
        };
        expect(() => table(opts)).toThrow("draw.table called outside compiled runtime");
    });
});

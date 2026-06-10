// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { syminfo } from "./syminfo.js";

describe("syminfo", () => {
    it("defaults every field to the empty sentinel", () => {
        expect(syminfo.ticker).toBe("");
        expect(syminfo.type).toBe("custom");
        expect(Number.isNaN(syminfo.mintick)).toBe(true);
        expect(syminfo.currency).toBe("");
        expect(syminfo.basecurrency).toBe("");
        expect(syminfo.exchange).toBe("");
        expect(syminfo.timezone).toBe("");
        expect(syminfo.session).toBe("");
        expect(syminfo.meta).toEqual({});
    });

    it("is frozen with a frozen meta bag", () => {
        expect(Object.isFrozen(syminfo)).toBe(true);
        expect(Object.isFrozen(syminfo.meta)).toBe(true);
        expect(() => Object.assign(syminfo, { ticker: "AAPL" })).toThrow(TypeError);
        expect(() => Object.assign(syminfo.meta, { vendor: "demo" })).toThrow(TypeError);
    });
});

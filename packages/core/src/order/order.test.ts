// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { order } from "./order.js";

describe("order callable holes", () => {
    it("order.buy throws the outside-runtime sentinel with default opts", () => {
        expect(() => order.buy()).toThrow("order.buy called outside compiled runtime");
    });

    it("order.buy throws the outside-runtime sentinel with explicit opts", () => {
        expect(() =>
            order.buy({ qty: 2, label: "Long", marker: false, meta: { reason: "demo" } }),
        ).toThrow("order.buy called outside compiled runtime");
    });

    it("order.sell throws the outside-runtime sentinel", () => {
        expect(() => order.sell({ qty: 1 })).toThrow("order.sell called outside compiled runtime");
    });

    it("order.close throws the outside-runtime sentinel", () => {
        expect(() => order.close({ label: "Exit" })).toThrow(
            "order.close called outside compiled runtime",
        );
    });

    it("order.position throws the outside-runtime sentinel", () => {
        expect(() => order.position()).toThrow("order.position called outside compiled runtime");
    });

    it("is frozen", () => {
        expect(Object.isFrozen(order)).toBe(true);
    });
});

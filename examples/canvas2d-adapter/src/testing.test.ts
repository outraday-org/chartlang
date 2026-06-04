// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { MockCanvas2DContext, hashCallLog } from "./testing";

describe("MockCanvas2DContext", () => {
    it("records every method with its arguments", () => {
        const ctx = new MockCanvas2DContext();
        ctx.clearRect(1, 2, 3, 4);
        ctx.beginPath();
        ctx.moveTo(5, 6);
        ctx.lineTo(7, 8);
        ctx.stroke();
        ctx.fillRect(9, 10, 11, 12);
        ctx.fill();
        ctx.arc(13, 14, 15, 16, 17);
        ctx.closePath();
        ctx.setLineDash([1, 2, 3]);
        expect(ctx.calls).toEqual([
            { kind: "clearRect", x: 1, y: 2, w: 3, h: 4 },
            { kind: "beginPath" },
            { kind: "moveTo", x: 5, y: 6 },
            { kind: "lineTo", x: 7, y: 8 },
            { kind: "stroke" },
            { kind: "fillRect", x: 9, y: 10, w: 11, h: 12 },
            { kind: "fill" },
            { kind: "arc", x: 13, y: 14, radius: 15, start: 16, end: 17 },
            { kind: "closePath" },
            { kind: "setLineDash", segments: [1, 2, 3] },
        ]);
    });

    it("records setters and survives a subsequent read", () => {
        const ctx = new MockCanvas2DContext();
        ctx.strokeStyle = "#abcdef";
        ctx.fillStyle = "#012345";
        ctx.lineWidth = 4;
        expect(ctx.strokeStyle).toBe("#abcdef");
        expect(ctx.fillStyle).toBe("#012345");
        expect(ctx.lineWidth).toBe(4);
        expect(ctx.calls).toEqual([
            { kind: "set", prop: "strokeStyle", value: "#abcdef" },
            { kind: "set", prop: "fillStyle", value: "#012345" },
            { kind: "set", prop: "lineWidth", value: 4 },
        ]);
    });

    it("copies the setLineDash segments so caller mutations don't leak", () => {
        const ctx = new MockCanvas2DContext();
        const segments = [6, 4];
        ctx.setLineDash(segments);
        segments[0] = 999;
        const call = ctx.calls[0];
        if (call.kind !== "setLineDash") throw new Error("expected setLineDash");
        expect(call.segments).toEqual([6, 4]);
    });
});

describe("hashCallLog", () => {
    it("is deterministic for the same input", () => {
        const ctxA = new MockCanvas2DContext();
        ctxA.clearRect(0, 0, 100, 100);
        ctxA.beginPath();
        ctxA.moveTo(10, 20);
        ctxA.lineTo(30, 40);
        ctxA.stroke();

        const ctxB = new MockCanvas2DContext();
        ctxB.clearRect(0, 0, 100, 100);
        ctxB.beginPath();
        ctxB.moveTo(10, 20);
        ctxB.lineTo(30, 40);
        ctxB.stroke();

        expect(hashCallLog(ctxA.calls)).toBe(hashCallLog(ctxB.calls));
    });

    it("differs for differing call logs", () => {
        const a = new MockCanvas2DContext();
        a.clearRect(0, 0, 100, 100);
        const b = new MockCanvas2DContext();
        b.clearRect(0, 0, 200, 200);
        expect(hashCallLog(a.calls)).not.toBe(hashCallLog(b.calls));
    });

    it("rounds floats to 4 decimal places so microscopic drift does not re-hash", () => {
        const a = new MockCanvas2DContext();
        a.moveTo(1.123456, 2.654321);
        const b = new MockCanvas2DContext();
        b.moveTo(1.1234564, 2.6543212);
        expect(hashCallLog(a.calls)).toBe(hashCallLog(b.calls));
    });

    it("serialises NaN / Infinity / -Infinity as canonical strings", () => {
        const ctx = new MockCanvas2DContext();
        ctx.arc(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, 0);
        // Should not throw and should produce a 64-char hex digest.
        const h = hashCallLog(ctx.calls);
        expect(h).toMatch(/^[0-9a-f]{64}$/);
    });

    it("hashes setter and setLineDash records by their canonicalised shape", () => {
        const ctx = new MockCanvas2DContext();
        ctx.strokeStyle = "#abcdef";
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.fill();
        ctx.closePath();
        const h = hashCallLog(ctx.calls);
        expect(h).toMatch(/^[0-9a-f]{64}$/);
    });
});

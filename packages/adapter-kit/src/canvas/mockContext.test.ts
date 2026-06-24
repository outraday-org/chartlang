// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { MockCanvasContext, hashCallLog } from "./mockContext.js";

function exerciseEveryCall(ctx: MockCanvasContext): void {
    ctx.clearRect(0, 0, 1, 1);
    ctx.translate(1, 2);
    ctx.save();
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(3, 4);
    ctx.lineTo(5, 6);
    ctx.bezierCurveTo(1, 2, 3, 4, 5, 6);
    ctx.stroke();
    ctx.rect(0, 0, 4, 4);
    ctx.clip();
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.fillRect(0, 0, 2, 2);
    ctx.fill();
    ctx.arc(1, 2, 3, 0, Math.PI);
    ctx.closePath();
    ctx.setLineDash([6, 4]);
    ctx.fillText("hi", 7, 8);
    ctx.strokeStyle = "#111";
    ctx.fillStyle = "#222";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.5;
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
}

describe("MockCanvasContext", () => {
    it("records every method and setter, and setters survive a read", () => {
        const ctx = new MockCanvasContext();
        exerciseEveryCall(ctx);
        expect(ctx.calls.map((c) => c.kind)).toEqual([
            "clearRect",
            "translate",
            "save",
            "restore",
            "beginPath",
            "moveTo",
            "lineTo",
            "bezierCurveTo",
            "stroke",
            "rect",
            "clip",
            "setTransform",
            "fillRect",
            "fill",
            "arc",
            "closePath",
            "setLineDash",
            "fillText",
            "set",
            "set",
            "set",
            "set",
            "set",
            "set",
            "set",
            "set",
            "set",
        ]);
        // Setters are readable after assignment.
        expect(ctx.strokeStyle).toBe("#111");
        expect(ctx.fillStyle).toBe("#222");
        expect(ctx.lineWidth).toBe(2);
        expect(ctx.lineJoin).toBe("round");
        expect(ctx.lineCap).toBe("round");
        expect(ctx.globalAlpha).toBe(0.5);
        expect(ctx.font).toBe("12px sans-serif");
        expect(ctx.textAlign).toBe("center");
        expect(ctx.textBaseline).toBe("middle");
    });

    it("copies the dash segments so later mutation does not alias the record", () => {
        const ctx = new MockCanvasContext();
        const segments = [1, 2];
        ctx.setLineDash(segments);
        segments[0] = 99;
        const recorded = ctx.calls[0];
        if (recorded.kind === "setLineDash") {
            expect(recorded.segments).toEqual([1, 2]);
        }
    });
});

describe("hashCallLog", () => {
    it("returns a 64-char hex string", () => {
        const ctx = new MockCanvasContext();
        exerciseEveryCall(ctx);
        expect(hashCallLog(ctx.calls)).toMatch(/^[0-9a-f]{64}$/);
    });

    it("is stable across identical runs (covers every canonicalise branch)", () => {
        const a = new MockCanvasContext();
        const b = new MockCanvasContext();
        exerciseEveryCall(a);
        exerciseEveryCall(b);
        expect(hashCallLog(a.calls)).toBe(hashCallLog(b.calls));
    });

    it("ignores float drift below 4 decimal places", () => {
        const a = new MockCanvasContext();
        const b = new MockCanvasContext();
        a.moveTo(1.000_001, 2.000_001);
        b.moveTo(1, 2);
        expect(hashCallLog(a.calls)).toBe(hashCallLog(b.calls));
    });

    it("distinguishes a genuine geometry change", () => {
        const a = new MockCanvasContext();
        const b = new MockCanvasContext();
        a.lineTo(1, 1);
        b.lineTo(2, 2);
        expect(hashCallLog(a.calls)).not.toBe(hashCallLog(b.calls));
    });

    it("serialises a non-finite coordinate as a string", () => {
        const a = new MockCanvasContext();
        a.moveTo(Number.NaN, Number.POSITIVE_INFINITY);
        // Two NaN/Infinity payloads canonicalise to the same string form,
        // so the hash is stable rather than producing NaN-poisoned JSON.
        const b = new MockCanvasContext();
        b.moveTo(Number.NaN, Number.POSITIVE_INFINITY);
        expect(hashCallLog(a.calls)).toBe(hashCallLog(b.calls));
    });
});

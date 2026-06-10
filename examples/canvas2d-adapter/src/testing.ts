// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { createHash } from "node:crypto";

/**
 * One recorded call against {@link MockCanvas2DContext}. Tests inspect
 * the array to assert the renderer's draw sequence. The union covers
 * every method and setter the renderer touches; adding a new draw call
 * means extending both the mock and this union together.
 *
 * @since 0.1
 * @stable
 * @example
 *     const call: RecordedCall = { kind: "clearRect", x: 0, y: 0, w: 100, h: 100 };
 *     void call;
 */
export type RecordedCall =
    | {
          readonly kind: "clearRect";
          readonly x: number;
          readonly y: number;
          readonly w: number;
          readonly h: number;
      }
    | { readonly kind: "save" }
    | { readonly kind: "restore" }
    | { readonly kind: "beginPath" }
    | { readonly kind: "moveTo"; readonly x: number; readonly y: number }
    | { readonly kind: "lineTo"; readonly x: number; readonly y: number }
    | { readonly kind: "stroke" }
    | {
          readonly kind: "fillRect";
          readonly x: number;
          readonly y: number;
          readonly w: number;
          readonly h: number;
      }
    | { readonly kind: "fill" }
    | {
          readonly kind: "arc";
          readonly x: number;
          readonly y: number;
          readonly radius: number;
          readonly start: number;
          readonly end: number;
      }
    | { readonly kind: "closePath" }
    | { readonly kind: "setLineDash"; readonly segments: ReadonlyArray<number> }
    | { readonly kind: "fillText"; readonly text: string; readonly x: number; readonly y: number }
    | { readonly kind: "set"; readonly prop: "strokeStyle"; readonly value: string }
    | { readonly kind: "set"; readonly prop: "fillStyle"; readonly value: string }
    | { readonly kind: "set"; readonly prop: "lineWidth"; readonly value: number }
    | { readonly kind: "set"; readonly prop: "globalAlpha"; readonly value: number }
    | { readonly kind: "set"; readonly prop: "font"; readonly value: string }
    | { readonly kind: "set"; readonly prop: "textAlign"; readonly value: string }
    | { readonly kind: "set"; readonly prop: "textBaseline"; readonly value: string };

/**
 * Hand-rolled Canvas 2D mock that satisfies the renderer's
 * {@link import("./render").RenderCtx} structural type. Every method
 * and setter appends a typed record to `calls` so tests can assert the
 * exact draw sequence without standing up `node-canvas` or a real
 * browser. Sibling packages (Task 12's conformance harness) import
 * this class via the `chartlang-example-canvas2d-adapter/testing`
 * sub-path entry.
 *
 * Property setters are tracked via accessor pairs — the mock stores
 * the most recent value in private fields so `ctx.strokeStyle = "#x"`
 * both records the call and survives a subsequent read.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { MockCanvas2DContext } from "chartlang-example-canvas2d-adapter/testing";
 *     const ctx = new MockCanvas2DContext();
 *     ctx.clearRect(0, 0, 100, 100);
 *     // ctx.calls[0] === { kind: "clearRect", x: 0, y: 0, w: 100, h: 100 };
 *     const log = ctx.calls;
 *     void log;
 */
export class MockCanvas2DContext {
    readonly calls: RecordedCall[] = [];
    private _strokeStyle = "#000000";
    private _fillStyle = "#000000";
    private _lineWidth = 1;
    private _globalAlpha = 1;
    private _font = "10px sans-serif";
    private _textAlign: "start" | "center" | "end" | "left" | "right" = "start";
    private _textBaseline: "top" | "middle" | "bottom" | "alphabetic" | "hanging" = "alphabetic";

    clearRect(x: number, y: number, w: number, h: number): void {
        this.calls.push({ kind: "clearRect", x, y, w, h });
    }

    save(): void {
        this.calls.push({ kind: "save" });
    }

    restore(): void {
        this.calls.push({ kind: "restore" });
    }

    beginPath(): void {
        this.calls.push({ kind: "beginPath" });
    }

    moveTo(x: number, y: number): void {
        this.calls.push({ kind: "moveTo", x, y });
    }

    lineTo(x: number, y: number): void {
        this.calls.push({ kind: "lineTo", x, y });
    }

    stroke(): void {
        this.calls.push({ kind: "stroke" });
    }

    fillRect(x: number, y: number, w: number, h: number): void {
        this.calls.push({ kind: "fillRect", x, y, w, h });
    }

    fill(): void {
        this.calls.push({ kind: "fill" });
    }

    arc(x: number, y: number, radius: number, start: number, end: number): void {
        this.calls.push({ kind: "arc", x, y, radius, start, end });
    }

    closePath(): void {
        this.calls.push({ kind: "closePath" });
    }

    setLineDash(segments: ReadonlyArray<number>): void {
        this.calls.push({ kind: "setLineDash", segments: segments.slice() });
    }

    fillText(text: string, x: number, y: number): void {
        this.calls.push({ kind: "fillText", text, x, y });
    }

    get strokeStyle(): string {
        return this._strokeStyle;
    }

    set strokeStyle(value: string) {
        this._strokeStyle = value;
        this.calls.push({ kind: "set", prop: "strokeStyle", value });
    }

    get fillStyle(): string {
        return this._fillStyle;
    }

    set fillStyle(value: string) {
        this._fillStyle = value;
        this.calls.push({ kind: "set", prop: "fillStyle", value });
    }

    get lineWidth(): number {
        return this._lineWidth;
    }

    set lineWidth(value: number) {
        this._lineWidth = value;
        this.calls.push({ kind: "set", prop: "lineWidth", value });
    }

    get globalAlpha(): number {
        return this._globalAlpha;
    }

    set globalAlpha(value: number) {
        this._globalAlpha = value;
        this.calls.push({ kind: "set", prop: "globalAlpha", value });
    }

    get font(): string {
        return this._font;
    }

    set font(value: string) {
        this._font = value;
        this.calls.push({ kind: "set", prop: "font", value });
    }

    get textAlign(): "start" | "center" | "end" | "left" | "right" {
        return this._textAlign;
    }

    set textAlign(value: "start" | "center" | "end" | "left" | "right") {
        this._textAlign = value;
        this.calls.push({ kind: "set", prop: "textAlign", value });
    }

    get textBaseline(): "top" | "middle" | "bottom" | "alphabetic" | "hanging" {
        return this._textBaseline;
    }

    set textBaseline(value: "top" | "middle" | "bottom" | "alphabetic" | "hanging") {
        this._textBaseline = value;
        this.calls.push({ kind: "set", prop: "textBaseline", value });
    }
}

const FLOAT_DECIMALS = 4;

function roundFloat(n: number): number | string {
    if (!Number.isFinite(n)) return String(n);
    return Number(n.toFixed(FLOAT_DECIMALS));
}

function canonicalise(call: RecordedCall): Record<string, unknown> {
    switch (call.kind) {
        case "clearRect":
        case "fillRect":
            return {
                kind: call.kind,
                x: roundFloat(call.x),
                y: roundFloat(call.y),
                w: roundFloat(call.w),
                h: roundFloat(call.h),
            };
        case "moveTo":
        case "lineTo":
            return { kind: call.kind, x: roundFloat(call.x), y: roundFloat(call.y) };
        case "arc":
            return {
                kind: call.kind,
                x: roundFloat(call.x),
                y: roundFloat(call.y),
                radius: roundFloat(call.radius),
                start: roundFloat(call.start),
                end: roundFloat(call.end),
            };
        case "setLineDash":
            return { kind: call.kind, segments: call.segments.map((s) => roundFloat(s)) };
        case "fillText":
            return {
                kind: call.kind,
                text: call.text,
                x: roundFloat(call.x),
                y: roundFloat(call.y),
            };
        case "set": {
            const value = typeof call.value === "number" ? roundFloat(call.value) : call.value;
            return { kind: call.kind, prop: call.prop, value };
        }
        case "beginPath":
        case "save":
        case "restore":
        case "stroke":
        case "fill":
        case "closePath":
            return { kind: call.kind };
    }
}

/**
 * Hash a recorded call log into a stable SHA-256 hex string. Floats
 * are rounded to four decimal places and re-serialised in
 * canonical-key JSON so a microscopic floating-point drift does not
 * re-hash the log. Used by the integration test to pin the
 * end-to-end render output against a single golden constant.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { MockCanvas2DContext, hashCallLog } from "chartlang-example-canvas2d-adapter/testing";
 *     const ctx = new MockCanvas2DContext();
 *     ctx.clearRect(0, 0, 100, 100);
 *     const h = hashCallLog(ctx.calls);
 *     // h is a 64-char hex string
 *     void h;
 */
export function hashCallLog(calls: ReadonlyArray<RecordedCall>): string {
    const payload = calls.map(canonicalise);
    const serialised = JSON.stringify(payload);
    return createHash("sha256").update(serialised).digest("hex");
}

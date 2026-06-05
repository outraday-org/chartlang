// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { validateEmission } from "./validateEmission";

const validPlot = {
    kind: "plot" as const,
    slotId: "ema.ts:1:1#0",
    title: "EMA",
    style: { kind: "line", lineWidth: 1, lineStyle: "solid" },
    bar: 10,
    time: 1_700_000_000_000,
    value: 42.31,
    color: "#3b82f6",
    meta: {},
    pane: "overlay",
};

const validAlert = {
    kind: "alert" as const,
    slotId: "rsi.ts:1:1#0",
    severity: "warning",
    message: "RSI divergence",
    bar: 200,
    time: 1_700_000_000_000,
    meta: {},
    channels: ["toast"],
    dedupeKey: "k",
};

const validDiagnostic = {
    kind: "diagnostic" as const,
    severity: "warning",
    code: "unsupported-plot-kind",
    message: "x",
    slotId: "ema.ts:1:1#0",
    bar: 10,
};

describe("validateEmission — top-level dispatch", () => {
    it("rejects non-object input", () => {
        expect(validateEmission(null)).toEqual({
            ok: false,
            code: "malformed-emission",
            message: expect.stringContaining("not a plain object"),
        });
        expect(validateEmission(42)).toMatchObject({ ok: false, code: "malformed-emission" });
        expect(validateEmission("oops")).toMatchObject({ ok: false, code: "malformed-emission" });
        expect(validateEmission(undefined)).toMatchObject({
            ok: false,
            code: "malformed-emission",
        });
    });

    it("rejects class instances (non-plain object)", () => {
        class C {}
        expect(validateEmission(new C())).toMatchObject({
            ok: false,
            code: "malformed-emission",
        });
    });

    it("rejects payloads missing the 'kind' field", () => {
        expect(validateEmission({})).toMatchObject({
            ok: false,
            code: "malformed-emission",
            message: expect.stringContaining("missing 'kind'"),
        });
    });

    it("rejects unknown 'kind' values", () => {
        expect(validateEmission({ kind: "log" })).toMatchObject({
            ok: false,
            code: "malformed-emission",
            message: expect.stringContaining("not a known emission kind"),
        });
    });

    it("accepts a null-prototype object literal", () => {
        const e = Object.assign(Object.create(null), validPlot);
        expect(validateEmission(e)).toEqual({ ok: true });
    });
});

describe("validateEmission — plot", () => {
    it("accepts a well-formed plot emission", () => {
        expect(validateEmission(validPlot)).toEqual({ ok: true });
    });

    it("accepts step-line + dashed", () => {
        expect(
            validateEmission({
                ...validPlot,
                style: { kind: "step-line", lineWidth: 2, lineStyle: "dashed" },
            }),
        ).toEqual({ ok: true });
    });

    it("accepts horizontal-line + dotted", () => {
        expect(
            validateEmission({
                ...validPlot,
                style: { kind: "horizontal-line", lineWidth: 2, lineStyle: "dotted" },
            }),
        ).toEqual({ ok: true });
    });

    it("accepts value: null and color: null", () => {
        expect(validateEmission({ ...validPlot, value: null, color: null })).toEqual({ ok: true });
    });

    it("accepts pane: 'new' and an arbitrary string pane id", () => {
        expect(validateEmission({ ...validPlot, pane: "new" })).toEqual({ ok: true });
        expect(validateEmission({ ...validPlot, pane: "rsi" })).toEqual({ ok: true });
    });

    it("rejects an empty slotId", () => {
        expect(validateEmission({ ...validPlot, slotId: "" })).toMatchObject({
            ok: false,
            message: expect.stringContaining("slotId"),
        });
    });

    it("rejects a non-string slotId", () => {
        expect(validateEmission({ ...validPlot, slotId: 42 })).toMatchObject({ ok: false });
    });

    it("rejects a non-string title", () => {
        expect(validateEmission({ ...validPlot, title: 42 })).toMatchObject({
            ok: false,
            message: expect.stringContaining("title"),
        });
    });

    it("rejects a non-object style", () => {
        expect(validateEmission({ ...validPlot, style: null })).toMatchObject({
            ok: false,
            message: expect.stringContaining("style"),
        });
    });

    it("rejects an unknown style.kind", () => {
        expect(
            validateEmission({
                ...validPlot,
                style: { kind: "vertical-line", lineWidth: 1, lineStyle: "solid" },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("style.kind") });
    });

    it("rejects a non-finite lineWidth", () => {
        expect(
            validateEmission({
                ...validPlot,
                style: { kind: "line", lineWidth: Number.NaN, lineStyle: "solid" },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("lineWidth") });
    });

    it("rejects a zero lineWidth", () => {
        expect(
            validateEmission({
                ...validPlot,
                style: { kind: "line", lineWidth: 0, lineStyle: "solid" },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("lineWidth") });
    });

    it("rejects an unknown lineStyle", () => {
        expect(
            validateEmission({
                ...validPlot,
                style: { kind: "line", lineWidth: 1, lineStyle: "wavy" },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("lineStyle") });
    });

    it("rejects a non-integer bar", () => {
        expect(validateEmission({ ...validPlot, bar: 1.5 })).toMatchObject({ ok: false });
    });

    it("rejects a negative bar", () => {
        expect(validateEmission({ ...validPlot, bar: -1 })).toMatchObject({ ok: false });
    });

    it("rejects a non-finite time", () => {
        expect(validateEmission({ ...validPlot, time: Number.POSITIVE_INFINITY })).toMatchObject({
            ok: false,
            message: expect.stringContaining("time"),
        });
    });

    it("rejects a NaN value", () => {
        expect(validateEmission({ ...validPlot, value: Number.NaN })).toMatchObject({
            ok: false,
            message: expect.stringContaining("value"),
        });
    });

    it("rejects a non-string non-null color", () => {
        expect(validateEmission({ ...validPlot, color: 42 })).toMatchObject({
            ok: false,
            message: expect.stringContaining("color"),
        });
    });

    it("rejects a non-object meta", () => {
        expect(validateEmission({ ...validPlot, meta: null })).toMatchObject({
            ok: false,
            message: expect.stringContaining("meta"),
        });
    });

    it("rejects a non-string pane", () => {
        expect(validateEmission({ ...validPlot, pane: 42 })).toMatchObject({
            ok: false,
            message: expect.stringContaining("pane"),
        });
    });
});

describe("validateEmission — Phase-2 plot kinds", () => {
    it("accepts histogram with a finite baseline", () => {
        expect(
            validateEmission({
                ...validPlot,
                style: { kind: "histogram", baseline: 0 },
            }),
        ).toEqual({ ok: true });
    });

    it("accepts bars with a finite baseline", () => {
        expect(
            validateEmission({
                ...validPlot,
                style: { kind: "bars", baseline: 50 },
            }),
        ).toEqual({ ok: true });
    });

    it("rejects histogram with a non-finite baseline", () => {
        expect(
            validateEmission({
                ...validPlot,
                style: { kind: "histogram", baseline: Number.NaN },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("baseline") });
    });

    it("rejects bars with a missing baseline", () => {
        expect(
            validateEmission({
                ...validPlot,
                style: { kind: "bars" },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("baseline") });
    });

    it("accepts area with the full lineWidth + lineStyle + fillAlpha triple", () => {
        expect(
            validateEmission({
                ...validPlot,
                style: { kind: "area", lineWidth: 1, lineStyle: "solid", fillAlpha: 0.25 },
            }),
        ).toEqual({ ok: true });
    });

    it("accepts area at fillAlpha boundaries (0 and 1)", () => {
        for (const fillAlpha of [0, 1]) {
            expect(
                validateEmission({
                    ...validPlot,
                    style: { kind: "area", lineWidth: 1, lineStyle: "solid", fillAlpha },
                }),
            ).toEqual({ ok: true });
        }
    });

    it("rejects area with a non-finite lineWidth", () => {
        expect(
            validateEmission({
                ...validPlot,
                style: {
                    kind: "area",
                    lineWidth: Number.NaN,
                    lineStyle: "solid",
                    fillAlpha: 0.5,
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("lineWidth") });
    });

    it("rejects area with an unknown lineStyle", () => {
        expect(
            validateEmission({
                ...validPlot,
                style: { kind: "area", lineWidth: 1, lineStyle: "wavy", fillAlpha: 0.5 },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("lineStyle") });
    });

    it("rejects area with a negative fillAlpha", () => {
        expect(
            validateEmission({
                ...validPlot,
                style: { kind: "area", lineWidth: 1, lineStyle: "solid", fillAlpha: -0.1 },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("fillAlpha") });
    });

    it("rejects area with fillAlpha > 1", () => {
        expect(
            validateEmission({
                ...validPlot,
                style: { kind: "area", lineWidth: 1, lineStyle: "solid", fillAlpha: 1.5 },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("fillAlpha") });
    });

    it("accepts filled-band with finite upper + lower + alpha", () => {
        expect(
            validateEmission({
                ...validPlot,
                style: { kind: "filled-band", upper: 1, lower: -1, alpha: 0.2 },
            }),
        ).toEqual({ ok: true });
    });

    it("accepts filled-band with one bound null", () => {
        expect(
            validateEmission({
                ...validPlot,
                style: { kind: "filled-band", upper: 1, lower: null, alpha: 0.2 },
            }),
        ).toEqual({ ok: true });
        expect(
            validateEmission({
                ...validPlot,
                style: { kind: "filled-band", upper: null, lower: -1, alpha: 0.2 },
            }),
        ).toEqual({ ok: true });
    });

    it("rejects filled-band with both bounds null", () => {
        expect(
            validateEmission({
                ...validPlot,
                style: { kind: "filled-band", upper: null, lower: null, alpha: 0.2 },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("non-null") });
    });

    it("rejects filled-band with a non-finite upper", () => {
        expect(
            validateEmission({
                ...validPlot,
                style: {
                    kind: "filled-band",
                    upper: Number.POSITIVE_INFINITY,
                    lower: -1,
                    alpha: 0.2,
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("upper") });
    });

    it("rejects filled-band with a non-finite lower", () => {
        expect(
            validateEmission({
                ...validPlot,
                style: {
                    kind: "filled-band",
                    upper: 1,
                    lower: Number.NaN,
                    alpha: 0.2,
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("lower") });
    });

    it("rejects filled-band with alpha > 1", () => {
        expect(
            validateEmission({
                ...validPlot,
                style: { kind: "filled-band", upper: 1, lower: -1, alpha: 2 },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("alpha") });
    });

    it("rejects filled-band with negative alpha", () => {
        expect(
            validateEmission({
                ...validPlot,
                style: { kind: "filled-band", upper: 1, lower: -1, alpha: -0.1 },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("alpha") });
    });

    it("accepts label with a non-empty text + valid position", () => {
        for (const position of ["above", "below", "anchor"] as const) {
            expect(
                validateEmission({
                    ...validPlot,
                    style: { kind: "label", text: "PEAK", position },
                }),
            ).toEqual({ ok: true });
        }
    });

    it("rejects label with empty text", () => {
        expect(
            validateEmission({
                ...validPlot,
                style: { kind: "label", text: "", position: "above" },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("text") });
    });

    it("rejects label with text over 128 characters", () => {
        expect(
            validateEmission({
                ...validPlot,
                style: { kind: "label", text: "x".repeat(129), position: "above" },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("128") });
    });

    it("rejects label with an unknown position", () => {
        expect(
            validateEmission({
                ...validPlot,
                style: { kind: "label", text: "PEAK", position: "left" },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("position") });
    });

    it("accepts marker for each shape", () => {
        for (const shape of [
            "circle",
            "triangle-up",
            "triangle-down",
            "square",
            "diamond",
        ] as const) {
            expect(
                validateEmission({
                    ...validPlot,
                    style: { kind: "marker", shape, size: 4 },
                }),
            ).toEqual({ ok: true });
        }
    });

    it("rejects marker with an unknown shape", () => {
        expect(
            validateEmission({
                ...validPlot,
                style: { kind: "marker", shape: "star", size: 4 },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("shape") });
    });

    it("rejects marker with zero size", () => {
        expect(
            validateEmission({
                ...validPlot,
                style: { kind: "marker", shape: "circle", size: 0 },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("size") });
    });

    it("rejects marker with non-finite size", () => {
        expect(
            validateEmission({
                ...validPlot,
                style: { kind: "marker", shape: "circle", size: Number.NaN },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("size") });
    });
});

describe("validateEmission — meta walker", () => {
    it("accepts plain JSON-friendly nesting", () => {
        expect(
            validateEmission({
                ...validPlot,
                meta: { a: 1, b: "x", c: null, d: [1, 2, { e: true }], f: {} },
            }),
        ).toEqual({ ok: true });
    });

    it("rejects Map in meta", () => {
        expect(validateEmission({ ...validPlot, meta: { m: new Map() } })).toMatchObject({
            ok: false,
            message: expect.stringContaining("plain object"),
        });
    });

    it("rejects Set in meta", () => {
        expect(validateEmission({ ...validPlot, meta: { s: new Set() } })).toMatchObject({
            ok: false,
        });
    });

    it("rejects Date in meta", () => {
        expect(validateEmission({ ...validPlot, meta: { d: new Date(0) } })).toMatchObject({
            ok: false,
        });
    });

    it("rejects RegExp in meta", () => {
        expect(validateEmission({ ...validPlot, meta: { r: /x/ } })).toMatchObject({ ok: false });
    });

    it("rejects bigint in meta", () => {
        expect(validateEmission({ ...validPlot, meta: { b: 1n } })).toMatchObject({
            ok: false,
            message: expect.stringContaining("bigint"),
        });
    });

    it("rejects function in meta", () => {
        expect(validateEmission({ ...validPlot, meta: { f: () => 0 } })).toMatchObject({
            ok: false,
            message: expect.stringContaining("function"),
        });
    });

    it("rejects symbol in meta", () => {
        expect(validateEmission({ ...validPlot, meta: { s: Symbol("x") } })).toMatchObject({
            ok: false,
            message: expect.stringContaining("symbol"),
        });
    });

    it("rejects undefined in meta", () => {
        expect(validateEmission({ ...validPlot, meta: { u: undefined } })).toMatchObject({
            ok: false,
            message: expect.stringContaining("undefined"),
        });
    });

    it("rejects NaN deep inside meta", () => {
        expect(validateEmission({ ...validPlot, meta: { a: [1, [Number.NaN]] } })).toMatchObject({
            ok: false,
            message: expect.stringContaining("non-finite"),
        });
    });

    it("rejects Infinity deep inside meta", () => {
        expect(
            validateEmission({
                ...validPlot,
                meta: { a: { b: Number.POSITIVE_INFINITY } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("non-finite") });
    });

    it("rejects a class instance deep inside meta", () => {
        class C {}
        expect(validateEmission({ ...validPlot, meta: { c: new C() } })).toMatchObject({
            ok: false,
            message: expect.stringContaining("plain object"),
        });
    });

    it("rejects a function inside a nested array", () => {
        expect(validateEmission({ ...validPlot, meta: { a: [() => 0] } })).toMatchObject({
            ok: false,
            message: expect.stringContaining("function"),
        });
    });

    it("converts a throwing getter inside meta into a malformed-emission failure", () => {
        const meta = Object.defineProperty({}, "boom", {
            enumerable: true,
            get() {
                throw new Error("getter threw");
            },
        });
        expect(validateEmission({ ...validPlot, meta })).toMatchObject({
            ok: false,
            code: "malformed-emission",
            message: expect.stringContaining("getter threw during traversal"),
        });
    });
});

describe("validateEmission — alert", () => {
    it("accepts a well-formed alert emission", () => {
        expect(validateEmission(validAlert)).toEqual({ ok: true });
    });

    it("rejects an empty slotId", () => {
        expect(validateEmission({ ...validAlert, slotId: "" })).toMatchObject({ ok: false });
    });

    it("rejects an unknown severity", () => {
        expect(validateEmission({ ...validAlert, severity: "panic" })).toMatchObject({
            ok: false,
            message: expect.stringContaining("severity"),
        });
    });

    it("rejects an empty message", () => {
        expect(validateEmission({ ...validAlert, message: "" })).toMatchObject({
            ok: false,
            message: expect.stringContaining("message"),
        });
    });

    it("rejects a non-integer bar", () => {
        expect(validateEmission({ ...validAlert, bar: -1 })).toMatchObject({ ok: false });
    });

    it("rejects a non-finite time", () => {
        expect(validateEmission({ ...validAlert, time: Number.NaN })).toMatchObject({
            ok: false,
        });
    });

    it("rejects a non-object meta", () => {
        expect(validateEmission({ ...validAlert, meta: [] })).toMatchObject({ ok: false });
    });

    it("rejects bad meta contents (walker path)", () => {
        expect(validateEmission({ ...validAlert, meta: { m: new Map() } })).toMatchObject({
            ok: false,
        });
    });

    it("rejects a non-array channels", () => {
        expect(validateEmission({ ...validAlert, channels: "toast" })).toMatchObject({
            ok: false,
            message: expect.stringContaining("channels"),
        });
    });

    it("rejects an unknown channel value", () => {
        expect(validateEmission({ ...validAlert, channels: ["pager"] })).toMatchObject({
            ok: false,
            message: expect.stringContaining("channels[0]"),
        });
    });

    it("rejects an empty dedupeKey", () => {
        expect(validateEmission({ ...validAlert, dedupeKey: "" })).toMatchObject({
            ok: false,
            message: expect.stringContaining("dedupeKey"),
        });
    });
});

describe("validateEmission — drawing", () => {
    it("unconditionally rejects drawing emissions with unsupported-drawing-kind", () => {
        const r = validateEmission({
            kind: "drawing",
            handleId: "x",
            drawingKind: "line",
            op: "create",
            state: null,
            bar: 0,
            time: 0,
        });
        expect(r).toMatchObject({ ok: false, code: "unsupported-drawing-kind" });
    });
});

describe("validateEmission — diagnostic", () => {
    it("accepts a well-formed diagnostic", () => {
        expect(validateEmission(validDiagnostic)).toEqual({ ok: true });
    });

    it("accepts null slotId and null bar", () => {
        expect(validateEmission({ ...validDiagnostic, slotId: null, bar: null })).toEqual({
            ok: true,
        });
    });

    it("rejects an unknown severity", () => {
        expect(validateEmission({ ...validDiagnostic, severity: "critical" })).toMatchObject({
            ok: false,
            message: expect.stringContaining("severity"),
        });
    });

    it("rejects an unknown code", () => {
        expect(validateEmission({ ...validDiagnostic, code: "not-a-code" })).toMatchObject({
            ok: false,
            message: expect.stringContaining("DiagnosticCode"),
        });
    });

    it("rejects a non-string message", () => {
        expect(validateEmission({ ...validDiagnostic, message: 42 })).toMatchObject({
            ok: false,
            message: expect.stringContaining("message"),
        });
    });

    it("rejects a non-string non-null slotId", () => {
        expect(validateEmission({ ...validDiagnostic, slotId: 42 })).toMatchObject({
            ok: false,
            message: expect.stringContaining("slotId"),
        });
    });

    it("rejects a negative bar", () => {
        expect(validateEmission({ ...validDiagnostic, bar: -1 })).toMatchObject({
            ok: false,
            message: expect.stringContaining("bar"),
        });
    });
});

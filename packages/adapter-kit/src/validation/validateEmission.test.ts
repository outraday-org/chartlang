// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { validateEmission } from "./validateEmission.js";

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

const validAlertCondition = {
    kind: "alert-condition" as const,
    conditionId: "up",
    title: "Up",
    description: "Close crossed up",
    defaultMessage: "{{ticker}} up",
    fired: true,
    bar: 42,
    time: 1_700_000_000_000,
};

const validLog = {
    kind: "log" as const,
    level: "info",
    message: "ready",
    meta: { close: 42 },
    bar: 42,
    time: 1_700_000_000_000,
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
        expect(validateEmission({ kind: "not-a-kind" })).toMatchObject({
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

    it("accepts visible: false (host-hidden slot)", () => {
        expect(validateEmission({ ...validPlot, visible: false })).toEqual({ ok: true });
    });

    it("accepts visible: true (explicit override)", () => {
        expect(validateEmission({ ...validPlot, visible: true })).toEqual({ ok: true });
    });

    it("rejects a non-boolean visible", () => {
        expect(validateEmission({ ...validPlot, visible: "no" })).toMatchObject({
            ok: false,
            code: "malformed-emission",
            message: expect.stringContaining("visible"),
        });
    });

    it("accepts an integer xShift (right, left, and zero)", () => {
        expect(validateEmission({ ...validPlot, xShift: 5 })).toEqual({ ok: true });
        expect(validateEmission({ ...validPlot, xShift: -5 })).toEqual({ ok: true });
        expect(validateEmission({ ...validPlot, xShift: 0 })).toEqual({ ok: true });
    });

    it("rejects a non-integer xShift", () => {
        expect(validateEmission({ ...validPlot, xShift: 1.5 })).toMatchObject({
            ok: false,
            code: "malformed-emission",
            message: expect.stringContaining("xShift"),
        });
    });
});

describe("validateEmission — alert condition", () => {
    it("accepts a well-formed alert-condition emission", () => {
        expect(validateEmission(validAlertCondition)).toEqual({ ok: true });
    });

    it("rejects an empty conditionId", () => {
        expect(validateEmission({ ...validAlertCondition, conditionId: "" })).toMatchObject({
            ok: false,
            message: expect.stringContaining("conditionId"),
        });
    });

    it("rejects non-string title and description fields", () => {
        expect(validateEmission({ ...validAlertCondition, title: 42 })).toMatchObject({
            ok: false,
            message: expect.stringContaining("title"),
        });
        expect(validateEmission({ ...validAlertCondition, description: 42 })).toMatchObject({
            ok: false,
            message: expect.stringContaining("description"),
        });
    });

    it("rejects a non-boolean fired field", () => {
        expect(validateEmission({ ...validAlertCondition, fired: "yes" })).toMatchObject({
            ok: false,
            message: expect.stringContaining("fired"),
        });
    });

    it("rejects a non-string defaultMessage", () => {
        expect(validateEmission({ ...validAlertCondition, defaultMessage: 42 })).toMatchObject({
            ok: false,
            message: expect.stringContaining("defaultMessage"),
        });
    });

    it("rejects a negative bar", () => {
        expect(validateEmission({ ...validAlertCondition, bar: -1 })).toMatchObject({
            ok: false,
            message: expect.stringContaining("bar"),
        });
    });

    it("rejects non-finite time", () => {
        expect(
            validateEmission({ ...validAlertCondition, time: Number.POSITIVE_INFINITY }),
        ).toMatchObject({
            ok: false,
            message: expect.stringContaining("time"),
        });
    });
});

describe("validateEmission — log", () => {
    it("accepts a well-formed log emission", () => {
        expect(validateEmission(validLog)).toEqual({ ok: true });
    });

    it("accepts omitted meta", () => {
        const { meta: _meta, ...withoutMeta } = validLog;
        expect(validateEmission(withoutMeta)).toEqual({ ok: true });
    });

    it("rejects an unknown log level", () => {
        expect(validateEmission({ ...validLog, level: "debug" })).toMatchObject({
            ok: false,
            message: expect.stringContaining("level"),
        });
    });

    it("rejects empty message", () => {
        expect(validateEmission({ ...validLog, message: "" })).toMatchObject({
            ok: false,
            message: expect.stringContaining("message"),
        });
    });

    it("rejects non-JSON meta", () => {
        expect(
            validateEmission({ ...validLog, meta: { bad: Number.POSITIVE_INFINITY } }),
        ).toMatchObject({
            ok: false,
            message: expect.stringContaining("non-finite"),
        });
    });

    it("rejects a non-object meta", () => {
        expect(validateEmission({ ...validLog, meta: null })).toMatchObject({
            ok: false,
            message: expect.stringContaining("meta"),
        });
    });

    it("rejects a negative bar", () => {
        expect(validateEmission({ ...validLog, bar: -1 })).toMatchObject({
            ok: false,
            message: expect.stringContaining("bar"),
        });
    });

    it("rejects a non-finite time", () => {
        expect(validateEmission({ ...validLog, time: Number.NaN })).toMatchObject({
            ok: false,
            message: expect.stringContaining("time"),
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

    it("rejects histogram with a non-finite baseline", () => {
        expect(
            validateEmission({
                ...validPlot,
                style: { kind: "histogram", baseline: Number.NaN },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("baseline") });
    });

    it("rejects histogram with a missing baseline", () => {
        expect(
            validateEmission({
                ...validPlot,
                style: { kind: "histogram" },
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

describe("validateEmission — Phase-5 plot kinds", () => {
    it("accepts each new plot style", () => {
        const styles = [
            { kind: "shape", shape: "flag", size: 8, location: "below" },
            { kind: "character", char: "A", size: 12, location: "above" },
            { kind: "arrow", direction: "down", size: 10 },
            { kind: "candle-override", bull: "#26a69a", bear: "#ef5350", doji: "#999999" },
            { kind: "bar-override", color: "#f59e0b" },
            { kind: "bg-color", color: "#1d4ed8", transp: 80 },
            { kind: "bar-color", color: "#a855f7" },
            {
                kind: "horizontal-histogram",
                buckets: [{ price: 100, volume: 20, color: "#90caf9" }],
            },
        ] as const;
        for (const style of styles) {
            expect(validateEmission({ ...validPlot, style })).toEqual({ ok: true });
        }
    });

    it("accepts candle-override without a doji color", () => {
        expect(
            validateEmission({
                ...validPlot,
                style: { kind: "candle-override", bull: "#26a69a", bear: "#ef5350" },
            }),
        ).toEqual({ ok: true });
    });

    it("rejects invalid Phase-5 ranges and structures", () => {
        const invalid = [
            { kind: "shape", shape: "star", size: 8 },
            { kind: "shape", shape: "circle", size: 0 },
            { kind: "shape", shape: "circle", size: 8, location: "left" },
            { kind: "character", char: "", size: 12 },
            { kind: "character", char: "A", size: Number.NaN },
            { kind: "arrow", direction: "left", size: 10 },
            { kind: "arrow", direction: "up", size: 0 },
            { kind: "candle-override", bull: "", bear: "#ef5350" },
            { kind: "candle-override", bull: "#26a69a", bear: "" },
            { kind: "bar-override", color: "" },
            { kind: "bg-color", color: "" },
            { kind: "bg-color", color: "#1d4ed8", transp: 101 },
            { kind: "bg-color", color: "#1d4ed8", transp: -1 },
            { kind: "bar-color", color: "" },
            { kind: "horizontal-histogram", buckets: "bad" },
            { kind: "horizontal-histogram", buckets: [null] },
            { kind: "horizontal-histogram", buckets: [{ price: Number.NaN, volume: 20 }] },
            { kind: "horizontal-histogram", buckets: [{ price: 100, volume: -1 }] },
            { kind: "horizontal-histogram", buckets: [{ price: 100, volume: 1, color: "" }] },
        ];
        for (const style of invalid) {
            expect(validateEmission({ ...validPlot, style })).toMatchObject({ ok: false });
        }
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

const validLineDrawing = {
    kind: "drawing" as const,
    handleId: "ph3.ts:1:1#0",
    drawingKind: "line" as const,
    op: "create" as const,
    state: {
        kind: "line" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
        ],
        style: {},
    },
    bar: 0,
    time: 0,
};

const validHorizontalLine = {
    ...validLineDrawing,
    drawingKind: "horizontal-line" as const,
    state: { kind: "horizontal-line" as const, price: 100, style: {} },
};

const validHorizontalRay = {
    ...validLineDrawing,
    drawingKind: "horizontal-ray" as const,
    state: {
        kind: "horizontal-ray" as const,
        anchor: { time: 0, price: 100 },
        style: {},
    },
};

const validVerticalLine = {
    ...validLineDrawing,
    drawingKind: "vertical-line" as const,
    state: { kind: "vertical-line" as const, time: 1_700_000_000_000, style: {} },
};

const validCrossLine = {
    ...validLineDrawing,
    drawingKind: "cross-line" as const,
    state: {
        kind: "cross-line" as const,
        anchor: { time: 1, price: 1 },
        style: {},
    },
};

const validTrendAngle = {
    ...validLineDrawing,
    drawingKind: "trend-angle" as const,
    state: {
        kind: "trend-angle" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
        ],
        style: {},
    },
};

const validRectangle = {
    ...validLineDrawing,
    drawingKind: "rectangle" as const,
    state: {
        kind: "rectangle" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
        ],
        style: {},
    },
};

const validRotatedRectangle = {
    ...validLineDrawing,
    drawingKind: "rotated-rectangle" as const,
    state: {
        kind: "rotated-rectangle" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 2, price: 0 },
            { time: 1, price: -1 },
        ],
        style: {},
    },
};

const validTriangle = {
    ...validLineDrawing,
    drawingKind: "triangle" as const,
    state: {
        kind: "triangle" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 2, price: 0 },
        ],
        style: {},
    },
};

const validPolyline = {
    ...validLineDrawing,
    drawingKind: "polyline" as const,
    state: {
        kind: "polyline" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 2, price: 0 },
        ],
        style: {},
    },
};

const validCircle = {
    ...validLineDrawing,
    drawingKind: "circle" as const,
    state: {
        kind: "circle" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 0 },
        ],
        style: {},
    },
};

const validEllipse = {
    ...validLineDrawing,
    drawingKind: "ellipse" as const,
    state: {
        kind: "ellipse" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 2, price: 1 },
        ],
        style: {},
    },
};

const validPath = {
    ...validLineDrawing,
    drawingKind: "path" as const,
    state: {
        kind: "path" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
        ],
        style: {},
    },
};

const validFillBetween = {
    ...validLineDrawing,
    drawingKind: "fill-between" as const,
    state: {
        kind: "fill-between" as const,
        edgeA: [
            { time: 0, price: 1 },
            { time: 1, price: 1 },
        ],
        edgeB: [
            { time: 0, price: 0 },
            { time: 1, price: 0 },
        ],
        style: { fill: "#3b82f6" },
    },
};

const validMarker = {
    ...validLineDrawing,
    drawingKind: "marker" as const,
    state: {
        kind: "marker" as const,
        anchor: { time: 1, price: 1 },
        style: {},
    },
};

const validArc = {
    ...validLineDrawing,
    drawingKind: "arc" as const,
    state: {
        kind: "arc" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 2 },
            { time: 2, price: 0 },
        ],
        style: {},
    },
};

const validCurve = {
    ...validLineDrawing,
    drawingKind: "curve" as const,
    state: {
        kind: "curve" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 2 },
            { time: 2, price: 0 },
        ],
        style: {},
    },
};

const validDoubleCurve = {
    ...validLineDrawing,
    drawingKind: "double-curve" as const,
    state: {
        kind: "double-curve" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 2, price: 0 },
            { time: 3, price: -1 },
            { time: 4, price: 0 },
        ],
        style: {},
    },
};

const validPen = {
    ...validLineDrawing,
    drawingKind: "pen" as const,
    state: {
        kind: "pen" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
        ],
        style: {},
    },
};

const validHighlighter = {
    ...validLineDrawing,
    drawingKind: "highlighter" as const,
    state: {
        kind: "highlighter" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
        ],
        style: { color: "#facc15", alpha: 0.3 },
    },
};

const validBrush = {
    ...validLineDrawing,
    drawingKind: "brush" as const,
    state: {
        kind: "brush" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
        ],
        style: { stroke: "#000000", fill: "#ffffff" },
    },
};

const validText = {
    ...validLineDrawing,
    drawingKind: "text" as const,
    state: {
        kind: "text" as const,
        anchor: { time: 1, price: 1 },
        body: "Note",
        style: {},
    },
};

const validArrow = {
    ...validLineDrawing,
    drawingKind: "arrow" as const,
    state: {
        kind: "arrow" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
        ],
        style: {},
    },
};

const validArrowMarker = {
    ...validLineDrawing,
    drawingKind: "arrow-marker" as const,
    state: {
        kind: "arrow-marker" as const,
        anchor: { time: 1, price: 1 },
        style: {},
    },
};

const validArrowMarkUp = {
    ...validLineDrawing,
    drawingKind: "arrow-mark-up" as const,
    state: {
        kind: "arrow-mark-up" as const,
        anchor: { time: 1, price: 1 },
        style: {},
    },
};

const validArrowMarkDown = {
    ...validLineDrawing,
    drawingKind: "arrow-mark-down" as const,
    state: {
        kind: "arrow-mark-down" as const,
        anchor: { time: 1, price: 1 },
        style: {},
    },
};

const validTrendChannel = {
    ...validLineDrawing,
    drawingKind: "trend-channel" as const,
    state: {
        kind: "trend-channel" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 0, price: 1 },
        ],
        style: {},
    },
};

const validFlatTopBottom = {
    ...validLineDrawing,
    drawingKind: "flat-top-bottom" as const,
    state: {
        kind: "flat-top-bottom" as const,
        anchors: [
            { time: 0, price: 1 },
            { time: 1, price: 1 },
            { time: 0, price: 0 },
        ],
        style: {},
    },
};

const validDisjointChannel = {
    ...validLineDrawing,
    drawingKind: "disjoint-channel" as const,
    state: {
        kind: "disjoint-channel" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 0, price: 2 },
            { time: 1, price: 3 },
        ],
        style: {},
    },
};

const validRegressionTrend = {
    ...validLineDrawing,
    drawingKind: "regression-trend" as const,
    state: {
        kind: "regression-trend" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 100, price: 1 },
        ],
        style: { source: "close" as const, stdevMultiplier: 2 },
    },
};

const validFibRetracement = {
    ...validLineDrawing,
    drawingKind: "fib-retracement" as const,
    state: {
        kind: "fib-retracement" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
        ],
        style: {},
    },
};

const validFibTrendExtension = {
    ...validLineDrawing,
    drawingKind: "fib-trend-extension" as const,
    state: {
        kind: "fib-trend-extension" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 2, price: 0.5 },
        ],
        style: {},
    },
};

const validFibChannel = {
    ...validLineDrawing,
    drawingKind: "fib-channel" as const,
    state: {
        kind: "fib-channel" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 0, price: 1 },
        ],
        style: {},
    },
};

const validFibTimeZone = {
    ...validLineDrawing,
    drawingKind: "fib-time-zone" as const,
    state: {
        kind: "fib-time-zone" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 100, price: 0 },
        ],
        style: {},
    },
};

const validFibWedge = {
    ...validLineDrawing,
    drawingKind: "fib-wedge" as const,
    state: {
        kind: "fib-wedge" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 1, price: -1 },
        ],
        style: {},
    },
};

const validFibSpeedFan = {
    ...validLineDrawing,
    drawingKind: "fib-speed-fan" as const,
    state: {
        kind: "fib-speed-fan" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
        ],
        style: {},
    },
};

const validFibSpeedArcs = {
    ...validLineDrawing,
    drawingKind: "fib-speed-arcs" as const,
    state: {
        kind: "fib-speed-arcs" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 0 },
        ],
        style: {},
    },
};

const validFibSpiral = {
    ...validLineDrawing,
    drawingKind: "fib-spiral" as const,
    state: {
        kind: "fib-spiral" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 0 },
        ],
        style: {},
    },
};

const validFibCircles = {
    ...validLineDrawing,
    drawingKind: "fib-circles" as const,
    state: {
        kind: "fib-circles" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 0 },
        ],
        style: {},
    },
};

const validFibTrendTime = {
    ...validLineDrawing,
    drawingKind: "fib-trend-time" as const,
    state: {
        kind: "fib-trend-time" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 2, price: 0.5 },
        ],
        style: {},
    },
};

const validGannBox = {
    ...validLineDrawing,
    drawingKind: "gann-box" as const,
    state: {
        kind: "gann-box" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
        ],
        style: {},
    },
};

const validGannSquareFixed = {
    ...validLineDrawing,
    drawingKind: "gann-square-fixed" as const,
    state: {
        kind: "gann-square-fixed" as const,
        anchor: { time: 0, price: 0 },
        style: {},
    },
};

const validGannSquare = {
    ...validLineDrawing,
    drawingKind: "gann-square" as const,
    state: {
        kind: "gann-square" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
        ],
        style: {},
    },
};

const validGannFan = {
    ...validLineDrawing,
    drawingKind: "gann-fan" as const,
    state: {
        kind: "gann-fan" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
        ],
        style: {},
    },
};

const validPitchfork = {
    ...validLineDrawing,
    drawingKind: "pitchfork" as const,
    state: {
        kind: "pitchfork" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 2, price: 0.5 },
        ],
        variant: "standard" as const,
        style: {},
    },
};

const validPitchfan = {
    ...validLineDrawing,
    drawingKind: "pitchfan" as const,
    state: {
        kind: "pitchfan" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 2, price: 0.5 },
        ],
        style: {},
    },
};

const validXabcdPattern = {
    ...validLineDrawing,
    drawingKind: "xabcd-pattern" as const,
    state: {
        kind: "xabcd-pattern" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 2, price: 0.5 },
            { time: 3, price: 1.5 },
            { time: 4, price: 1 },
        ],
        style: {},
    },
};

const validCypherPattern = {
    ...validLineDrawing,
    drawingKind: "cypher-pattern" as const,
    state: {
        kind: "cypher-pattern" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 2, price: 0.4 },
            { time: 3, price: 1.3 },
            { time: 4, price: 0.6 },
        ],
        style: {},
    },
};

const validHeadAndShoulders = {
    ...validLineDrawing,
    drawingKind: "head-and-shoulders" as const,
    state: {
        kind: "head-and-shoulders" as const,
        anchors: [
            { time: 0, price: 1 },
            { time: 1, price: 0 },
            { time: 2, price: 2 },
            { time: 3, price: 0 },
            { time: 4, price: 1 },
        ],
        style: {},
    },
};

const validAbcdPattern = {
    ...validLineDrawing,
    drawingKind: "abcd-pattern" as const,
    state: {
        kind: "abcd-pattern" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 2, price: 0.5 },
            { time: 3, price: 1.5 },
        ],
        style: {},
    },
};

const validTrianglePattern = {
    ...validLineDrawing,
    drawingKind: "triangle-pattern" as const,
    state: {
        kind: "triangle-pattern" as const,
        anchors: [
            { time: 2, price: 0.5 },
            { time: 0, price: 1 },
            { time: 0, price: 0 },
        ],
        style: {},
    },
};

const validThreeDrivesPattern = {
    ...validLineDrawing,
    drawingKind: "three-drives-pattern" as const,
    state: {
        kind: "three-drives-pattern" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 2, price: 0.5 },
            { time: 3, price: 1.5 },
            { time: 4, price: 1 },
            { time: 5, price: 2 },
            { time: 6, price: 1.5 },
        ],
        style: {},
    },
};

const validElliottImpulseWave = {
    ...validLineDrawing,
    drawingKind: "elliott-impulse-wave" as const,
    state: {
        kind: "elliott-impulse-wave" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 2, price: 0.5 },
            { time: 3, price: 1.5 },
            { time: 4, price: 1 },
        ],
        style: {},
    },
};

const validElliottCorrectionWave = {
    ...validLineDrawing,
    drawingKind: "elliott-correction-wave" as const,
    state: {
        kind: "elliott-correction-wave" as const,
        anchors: [
            { time: 0, price: 1 },
            { time: 1, price: 0 },
            { time: 2, price: 0.5 },
        ],
        style: {},
    },
};

const validElliottTriangleWave = {
    ...validLineDrawing,
    drawingKind: "elliott-triangle-wave" as const,
    state: {
        kind: "elliott-triangle-wave" as const,
        anchors: [
            { time: 0, price: 1 },
            { time: 1, price: 0 },
            { time: 2, price: 0.8 },
            { time: 3, price: 0.2 },
            { time: 4, price: 0.5 },
        ],
        style: {},
    },
};

const validElliottDoubleCombo = {
    ...validLineDrawing,
    drawingKind: "elliott-double-combo" as const,
    state: {
        kind: "elliott-double-combo" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 2, price: 0.5 },
            { time: 3, price: 1.5 },
            { time: 4, price: 1 },
            { time: 5, price: 2 },
            { time: 6, price: 1.5 },
        ],
        style: {},
    },
};

const validElliottTripleCombo = {
    ...validLineDrawing,
    drawingKind: "elliott-triple-combo" as const,
    state: {
        kind: "elliott-triple-combo" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
            { time: 2, price: 0.5 },
            { time: 3, price: 1.5 },
            { time: 4, price: 1 },
            { time: 5, price: 2 },
            { time: 6, price: 1.5 },
        ],
        style: {},
    },
};

describe("validateEmission — drawing dispatch", () => {
    it("rejects an empty handleId with malformed-emission", () => {
        expect(validateEmission({ ...validLineDrawing, handleId: "" })).toMatchObject({
            ok: false,
            code: "malformed-emission",
            message: expect.stringContaining("handleId"),
        });
    });

    it("rejects a non-string handleId", () => {
        expect(validateEmission({ ...validLineDrawing, handleId: 42 })).toMatchObject({
            ok: false,
            code: "malformed-emission",
        });
    });

    it("rejects an unknown drawingKind with unsupported-drawing-kind", () => {
        expect(validateEmission({ ...validLineDrawing, drawingKind: "not-a-kind" })).toMatchObject({
            ok: false,
            code: "unsupported-drawing-kind",
            message: expect.stringContaining("DrawingKind"),
        });
    });

    it("rejects a non-string drawingKind with unsupported-drawing-kind", () => {
        expect(validateEmission({ ...validLineDrawing, drawingKind: 42 })).toMatchObject({
            ok: false,
            code: "unsupported-drawing-kind",
        });
    });

    it("rejects an unknown op with malformed-emission", () => {
        expect(validateEmission({ ...validLineDrawing, op: "patch" })).toMatchObject({
            ok: false,
            code: "malformed-emission",
            message: expect.stringContaining("op"),
        });
    });

    it("accepts every op variant (create / update / remove)", () => {
        for (const op of ["create", "update", "remove"] as const) {
            expect(validateEmission({ ...validLineDrawing, op })).toEqual({ ok: true });
        }
    });

    it("rejects a non-integer bar", () => {
        expect(validateEmission({ ...validLineDrawing, bar: 1.5 })).toMatchObject({
            ok: false,
            message: expect.stringContaining("bar"),
        });
    });

    it("rejects a negative bar", () => {
        expect(validateEmission({ ...validLineDrawing, bar: -1 })).toMatchObject({ ok: false });
    });

    it("rejects a non-finite time", () => {
        expect(
            validateEmission({ ...validLineDrawing, time: Number.POSITIVE_INFINITY }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("time") });
    });

    it("rejects a non-plain-object state", () => {
        expect(validateEmission({ ...validLineDrawing, state: null })).toMatchObject({
            ok: false,
            message: expect.stringContaining("state"),
        });
    });

    it("rejects state.kind that does not equal drawingKind", () => {
        expect(
            validateEmission({
                ...validLineDrawing,
                state: { ...validLineDrawing.state, kind: "horizontal-line" },
            }),
        ).toMatchObject({
            ok: false,
            code: "malformed-emission",
            message: expect.stringContaining("must equal"),
        });
    });

    it("rejects state.name that is not a string", () => {
        expect(
            validateEmission({
                ...validLineDrawing,
                state: { ...validLineDrawing.state, name: 42 },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("name") });
    });

    it("rejects state.visible that is not a boolean", () => {
        expect(
            validateEmission({
                ...validLineDrawing,
                state: { ...validLineDrawing.state, visible: "yes" },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("visible") });
    });

    it("accepts state with optional name + visible meta", () => {
        expect(
            validateEmission({
                ...validLineDrawing,
                state: { ...validLineDrawing.state, name: "Support", visible: true },
            }),
        ).toEqual({ ok: true });
    });

    it("rejects unknown drawingKind values via VALID_DRAWING_KINDS gate (defence-in-depth)", () => {
        // After Task 18 every `DrawingKind` has a real validator arm
        // in `validateStateByKind`. Unknown wire payloads are caught
        // upstream by the `VALID_DRAWING_KINDS` gate inside
        // `validateDrawingEmission` with `unsupported-drawing-kind`
        // — they never reach `validateStateByKind`.
        const result = validateEmission({
            ...validLineDrawing,
            drawingKind: "future-unimplemented-kind",
            state: { kind: "future-unimplemented-kind" },
        });
        expect(result).toMatchObject({ ok: false, code: "unsupported-drawing-kind" });
    });

    it("rejects a malformed group (Task 18 ships the real validator)", () => {
        // Task 18 (Containers) lands the final 2 per-kind validators.
        // Before Task 18 this fixture passed the permissive-default
        // arm; after Task 18 it now rejects via the real
        // `validateGroupState` (non-array `childHandleIds`).
        expect(
            validateEmission({
                ...validLineDrawing,
                drawingKind: "group",
                state: {
                    kind: "group",
                    childHandleIds: "anything",
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("childHandleIds") });
    });
});

describe("validateEmission — drawing line kind", () => {
    it("accepts a well-formed line", () => {
        expect(validateEmission(validLineDrawing)).toEqual({ ok: true });
    });

    it("accepts a line with extendLeft + extendRight + colour + dashed", () => {
        expect(
            validateEmission({
                ...validLineDrawing,
                state: {
                    ...validLineDrawing.state,
                    style: {
                        color: "#3b82f6",
                        lineWidth: 2,
                        lineStyle: "dashed",
                        extendLeft: true,
                        extendRight: true,
                    },
                },
            }),
        ).toEqual({ ok: true });
    });

    it("rejects when anchors is not an array", () => {
        expect(
            validateEmission({
                ...validLineDrawing,
                state: { ...validLineDrawing.state, anchors: "not-an-array" },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("anchors") });
    });

    it("rejects when anchors has the wrong length", () => {
        expect(
            validateEmission({
                ...validLineDrawing,
                state: {
                    ...validLineDrawing.state,
                    anchors: [{ time: 0, price: 0 }],
                },
            }),
        ).toMatchObject({
            ok: false,
            message: expect.stringContaining("2-element"),
        });
    });

    it("rejects when an anchor has a non-finite time", () => {
        expect(
            validateEmission({
                ...validLineDrawing,
                state: {
                    ...validLineDrawing.state,
                    anchors: [
                        { time: Number.NaN, price: 0 },
                        { time: 1, price: 1 },
                    ],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("WorldPoint") });
    });

    it("rejects when style is not a plain object", () => {
        expect(
            validateEmission({
                ...validLineDrawing,
                state: { ...validLineDrawing.state, style: null },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("style") });
    });

    it("rejects when style.color is not a string", () => {
        expect(
            validateEmission({
                ...validLineDrawing,
                state: { ...validLineDrawing.state, style: { color: 42 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("color") });
    });

    it("rejects when style.lineWidth is zero or non-finite", () => {
        for (const lineWidth of [0, -1, Number.NaN] as const) {
            expect(
                validateEmission({
                    ...validLineDrawing,
                    state: { ...validLineDrawing.state, style: { lineWidth } },
                }),
            ).toMatchObject({ ok: false, message: expect.stringContaining("lineWidth") });
        }
    });

    it("rejects when style.lineStyle is unknown", () => {
        expect(
            validateEmission({
                ...validLineDrawing,
                state: { ...validLineDrawing.state, style: { lineStyle: "wavy" } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("lineStyle") });
    });

    it("rejects when style.extendLeft is not a boolean", () => {
        expect(
            validateEmission({
                ...validLineDrawing,
                state: { ...validLineDrawing.state, style: { extendLeft: "yes" } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("extendLeft") });
    });

    it("rejects when style.extendRight is not a boolean", () => {
        expect(
            validateEmission({
                ...validLineDrawing,
                state: { ...validLineDrawing.state, style: { extendRight: "yes" } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("extendRight") });
    });
});

describe("validateEmission — drawing horizontal-line kind", () => {
    it("accepts a well-formed horizontal-line", () => {
        expect(validateEmission(validHorizontalLine)).toEqual({ ok: true });
    });

    it("rejects when price is not a finite number", () => {
        expect(
            validateEmission({
                ...validHorizontalLine,
                state: { ...validHorizontalLine.state, price: Number.POSITIVE_INFINITY },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("price") });
    });

    it("rejects when price is missing", () => {
        expect(
            validateEmission({
                ...validHorizontalLine,
                state: { kind: "horizontal-line", style: {} },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("price") });
    });

    it("rejects when style is not a plain object", () => {
        expect(
            validateEmission({
                ...validHorizontalLine,
                state: { ...validHorizontalLine.state, style: 42 },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("style") });
    });
});

describe("validateEmission — drawing horizontal-ray kind", () => {
    it("accepts a well-formed horizontal-ray", () => {
        expect(validateEmission(validHorizontalRay)).toEqual({ ok: true });
    });

    it("rejects when anchor is not a WorldPoint", () => {
        expect(
            validateEmission({
                ...validHorizontalRay,
                state: { ...validHorizontalRay.state, anchor: { time: 0 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("anchor") });
    });

    it("rejects when anchor.price is non-finite", () => {
        expect(
            validateEmission({
                ...validHorizontalRay,
                state: {
                    ...validHorizontalRay.state,
                    anchor: { time: 0, price: Number.NaN },
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("anchor") });
    });

    it("rejects when style.lineWidth is invalid", () => {
        expect(
            validateEmission({
                ...validHorizontalRay,
                state: {
                    ...validHorizontalRay.state,
                    style: { lineWidth: -1 },
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("lineWidth") });
    });
});

describe("validateEmission — drawing vertical-line kind", () => {
    it("accepts a well-formed vertical-line", () => {
        expect(validateEmission(validVerticalLine)).toEqual({ ok: true });
    });

    it("rejects when time is not a finite number", () => {
        expect(
            validateEmission({
                ...validVerticalLine,
                state: { ...validVerticalLine.state, time: Number.NaN },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("time") });
    });

    it("rejects when time is missing", () => {
        expect(
            validateEmission({
                ...validVerticalLine,
                state: { kind: "vertical-line", style: {} },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("time") });
    });

    it("rejects when style.lineStyle is invalid", () => {
        expect(
            validateEmission({
                ...validVerticalLine,
                state: { ...validVerticalLine.state, style: { lineStyle: "rainbow" } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("lineStyle") });
    });
});

describe("validateEmission — drawing cross-line kind", () => {
    it("accepts a well-formed cross-line", () => {
        expect(validateEmission(validCrossLine)).toEqual({ ok: true });
    });

    it("rejects when anchor is not a plain object", () => {
        expect(
            validateEmission({
                ...validCrossLine,
                state: { ...validCrossLine.state, anchor: "not-a-point" },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("anchor") });
    });

    it("rejects when anchor.time is non-finite", () => {
        expect(
            validateEmission({
                ...validCrossLine,
                state: {
                    ...validCrossLine.state,
                    anchor: { time: Number.POSITIVE_INFINITY, price: 1 },
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("anchor") });
    });

    it("rejects when style.color is non-string", () => {
        expect(
            validateEmission({
                ...validCrossLine,
                state: { ...validCrossLine.state, style: { color: 42 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("color") });
    });
});

describe("validateEmission — drawing trend-angle kind", () => {
    it("accepts a well-formed trend-angle", () => {
        expect(validateEmission(validTrendAngle)).toEqual({ ok: true });
    });

    it("rejects when anchors length is not 2", () => {
        expect(
            validateEmission({
                ...validTrendAngle,
                state: {
                    ...validTrendAngle.state,
                    anchors: [
                        { time: 0, price: 0 },
                        { time: 1, price: 1 },
                        { time: 2, price: 2 },
                    ],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("2-element") });
    });

    it("rejects when an anchor.price is non-finite", () => {
        expect(
            validateEmission({
                ...validTrendAngle,
                state: {
                    ...validTrendAngle.state,
                    anchors: [
                        { time: 0, price: 0 },
                        { time: 1, price: Number.NaN },
                    ],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("WorldPoint") });
    });

    it("rejects when style.extendRight is not boolean", () => {
        expect(
            validateEmission({
                ...validTrendAngle,
                state: { ...validTrendAngle.state, style: { extendRight: 1 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("extendRight") });
    });
});

describe("validateEmission — drawing rectangle kind", () => {
    it("accepts a well-formed rectangle", () => {
        expect(validateEmission(validRectangle)).toEqual({ ok: true });
    });

    it("accepts a rectangle with stroke + fill + lineWidth + lineStyle + fillAlpha", () => {
        expect(
            validateEmission({
                ...validRectangle,
                state: {
                    ...validRectangle.state,
                    style: {
                        stroke: "#3b82f6",
                        fill: "#dbeafe",
                        lineWidth: 2,
                        lineStyle: "dashed",
                        fillAlpha: 0.4,
                    },
                },
            }),
        ).toEqual({ ok: true });
    });

    it("rejects when anchors has the wrong length", () => {
        expect(
            validateEmission({
                ...validRectangle,
                state: { ...validRectangle.state, anchors: [{ time: 0, price: 0 }] },
            }),
        ).toMatchObject({
            ok: false,
            message: expect.stringContaining("2-element"),
        });
    });

    it("rejects when an anchor has a non-finite price", () => {
        expect(
            validateEmission({
                ...validRectangle,
                state: {
                    ...validRectangle.state,
                    anchors: [
                        { time: 0, price: Number.NaN },
                        { time: 1, price: 1 },
                    ],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("WorldPoint") });
    });

    it("rejects when style.stroke is not a string", () => {
        expect(
            validateEmission({
                ...validRectangle,
                state: { ...validRectangle.state, style: { stroke: 42 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("stroke") });
    });

    it("rejects when style.fill is not a string", () => {
        expect(
            validateEmission({
                ...validRectangle,
                state: { ...validRectangle.state, style: { fill: 42 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("fill") });
    });

    it("rejects when style.lineWidth is zero or non-finite", () => {
        for (const lineWidth of [0, -1, Number.NaN] as const) {
            expect(
                validateEmission({
                    ...validRectangle,
                    state: { ...validRectangle.state, style: { lineWidth } },
                }),
            ).toMatchObject({ ok: false, message: expect.stringContaining("lineWidth") });
        }
    });

    it("rejects when style.lineStyle is unknown", () => {
        expect(
            validateEmission({
                ...validRectangle,
                state: { ...validRectangle.state, style: { lineStyle: "wavy" } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("lineStyle") });
    });

    it("rejects when style.fillAlpha is out of [0, 1]", () => {
        for (const fillAlpha of [-0.1, 1.1, Number.NaN] as const) {
            expect(
                validateEmission({
                    ...validRectangle,
                    state: { ...validRectangle.state, style: { fillAlpha } },
                }),
            ).toMatchObject({ ok: false, message: expect.stringContaining("fillAlpha") });
        }
    });

    it("accepts fillAlpha at the boundaries 0 and 1", () => {
        for (const fillAlpha of [0, 1] as const) {
            expect(
                validateEmission({
                    ...validRectangle,
                    state: { ...validRectangle.state, style: { fillAlpha } },
                }),
            ).toEqual({ ok: true });
        }
    });

    it("rejects when style is not a plain object", () => {
        expect(
            validateEmission({
                ...validRectangle,
                state: { ...validRectangle.state, style: null },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("style") });
    });
});

describe("validateEmission — drawing rotated-rectangle kind", () => {
    it("accepts a well-formed rotated-rectangle", () => {
        expect(validateEmission(validRotatedRectangle)).toEqual({ ok: true });
    });

    it("rejects when anchors has fewer than 4 elements", () => {
        expect(
            validateEmission({
                ...validRotatedRectangle,
                state: {
                    ...validRotatedRectangle.state,
                    anchors: [
                        { time: 0, price: 0 },
                        { time: 1, price: 1 },
                        { time: 2, price: 0 },
                    ],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("4-element") });
    });

    it("rejects when anchors has more than 4 elements", () => {
        expect(
            validateEmission({
                ...validRotatedRectangle,
                state: {
                    ...validRotatedRectangle.state,
                    anchors: [
                        { time: 0, price: 0 },
                        { time: 1, price: 1 },
                        { time: 2, price: 0 },
                        { time: 1, price: -1 },
                        { time: 0, price: 0 },
                    ],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("4-element") });
    });

    it("rejects when an anchor has a non-finite time", () => {
        expect(
            validateEmission({
                ...validRotatedRectangle,
                state: {
                    ...validRotatedRectangle.state,
                    anchors: [
                        { time: Number.POSITIVE_INFINITY, price: 0 },
                        { time: 1, price: 1 },
                        { time: 2, price: 0 },
                        { time: 1, price: -1 },
                    ],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("WorldPoint") });
    });

    it("rejects when style.fillAlpha is out of range", () => {
        expect(
            validateEmission({
                ...validRotatedRectangle,
                state: { ...validRotatedRectangle.state, style: { fillAlpha: 2 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("fillAlpha") });
    });
});

describe("validateEmission — drawing triangle kind", () => {
    it("accepts a well-formed triangle", () => {
        expect(validateEmission(validTriangle)).toEqual({ ok: true });
    });

    it("rejects when anchors has the wrong length", () => {
        expect(
            validateEmission({
                ...validTriangle,
                state: {
                    ...validTriangle.state,
                    anchors: [
                        { time: 0, price: 0 },
                        { time: 1, price: 1 },
                    ],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("3-element") });
    });

    it("rejects when an anchor is not a WorldPoint", () => {
        expect(
            validateEmission({
                ...validTriangle,
                state: {
                    ...validTriangle.state,
                    anchors: [{ time: 0, price: 0 }, { time: 1 }, { time: 2, price: 0 }],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("WorldPoint") });
    });

    it("rejects when style.stroke is not a string", () => {
        expect(
            validateEmission({
                ...validTriangle,
                state: { ...validTriangle.state, style: { stroke: 1 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("stroke") });
    });
});

describe("validateEmission — drawing polyline kind", () => {
    it("accepts a well-formed polyline at the minimum length (3)", () => {
        expect(validateEmission(validPolyline)).toEqual({ ok: true });
    });

    it("accepts a polyline at the maximum length (20)", () => {
        const anchors = Array.from({ length: 20 }, (_, i) => ({ time: i, price: i }));
        expect(
            validateEmission({
                ...validPolyline,
                state: { ...validPolyline.state, anchors },
            }),
        ).toEqual({ ok: true });
    });

    it("rejects fewer than 3 anchors", () => {
        expect(
            validateEmission({
                ...validPolyline,
                state: {
                    ...validPolyline.state,
                    anchors: [
                        { time: 0, price: 0 },
                        { time: 1, price: 1 },
                    ],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("3..20") });
    });

    it("rejects more than 20 anchors", () => {
        const anchors = Array.from({ length: 21 }, (_, i) => ({ time: i, price: i }));
        expect(
            validateEmission({
                ...validPolyline,
                state: { ...validPolyline.state, anchors },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("3..20") });
    });

    it("rejects when an interior anchor is not a WorldPoint", () => {
        expect(
            validateEmission({
                ...validPolyline,
                state: {
                    ...validPolyline.state,
                    anchors: [
                        { time: 0, price: 0 },
                        { time: 1, price: Number.NaN },
                        { time: 2, price: 0 },
                    ],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("WorldPoint") });
    });

    it("rejects when style.lineStyle is unknown", () => {
        expect(
            validateEmission({
                ...validPolyline,
                state: { ...validPolyline.state, style: { lineStyle: "rainbow" } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("lineStyle") });
    });
});

describe("validateEmission — drawing circle kind", () => {
    it("accepts a well-formed circle", () => {
        expect(validateEmission(validCircle)).toEqual({ ok: true });
    });

    it("accepts a circle with stroke + fill + fillAlpha", () => {
        expect(
            validateEmission({
                ...validCircle,
                state: {
                    ...validCircle.state,
                    style: { stroke: "#3b82f6", fill: "#dbeafe", fillAlpha: 0.4 },
                },
            }),
        ).toEqual({ ok: true });
    });

    it("rejects when anchors has the wrong length", () => {
        expect(
            validateEmission({
                ...validCircle,
                state: { ...validCircle.state, anchors: [{ time: 0, price: 0 }] },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("2-element") });
    });

    it("rejects when an anchor is not a WorldPoint", () => {
        expect(
            validateEmission({
                ...validCircle,
                state: {
                    ...validCircle.state,
                    anchors: [
                        { time: Number.NaN, price: 0 },
                        { time: 1, price: 0 },
                    ],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("WorldPoint") });
    });

    it("rejects when style.fillAlpha is out of [0, 1]", () => {
        expect(
            validateEmission({
                ...validCircle,
                state: { ...validCircle.state, style: { fillAlpha: 1.5 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("fillAlpha") });
    });
});

describe("validateEmission — drawing ellipse kind", () => {
    it("accepts a well-formed ellipse", () => {
        expect(validateEmission(validEllipse)).toEqual({ ok: true });
    });

    it("rejects when anchors has the wrong length", () => {
        expect(
            validateEmission({
                ...validEllipse,
                state: {
                    ...validEllipse.state,
                    anchors: [
                        { time: 0, price: 0 },
                        { time: 1, price: 1 },
                        { time: 2, price: 2 },
                    ],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("2-element") });
    });

    it("rejects when style.stroke is not a string", () => {
        expect(
            validateEmission({
                ...validEllipse,
                state: { ...validEllipse.state, style: { stroke: 42 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("stroke") });
    });

    it("rejects when style.lineStyle is unknown", () => {
        expect(
            validateEmission({
                ...validEllipse,
                state: { ...validEllipse.state, style: { lineStyle: "wavy" } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("lineStyle") });
    });
});

describe("validateEmission — drawing path kind", () => {
    it("accepts a well-formed path at the minimum length (2)", () => {
        expect(validateEmission(validPath)).toEqual({ ok: true });
    });

    it("accepts a path at the maximum length (20)", () => {
        const anchors = Array.from({ length: 20 }, (_, i) => ({ time: i, price: i }));
        expect(
            validateEmission({
                ...validPath,
                state: { ...validPath.state, anchors },
            }),
        ).toEqual({ ok: true });
    });

    it("accepts a path with style.closed = true", () => {
        expect(
            validateEmission({
                ...validPath,
                state: { ...validPath.state, style: { closed: true, color: "#3b82f6" } },
            }),
        ).toEqual({ ok: true });
    });

    it("rejects fewer than 2 anchors", () => {
        expect(
            validateEmission({
                ...validPath,
                state: { ...validPath.state, anchors: [{ time: 0, price: 0 }] },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("2..20") });
    });

    it("rejects more than 20 anchors", () => {
        const anchors = Array.from({ length: 21 }, (_, i) => ({ time: i, price: i }));
        expect(
            validateEmission({
                ...validPath,
                state: { ...validPath.state, anchors },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("2..20") });
    });

    it("rejects when style.closed is not a boolean", () => {
        expect(
            validateEmission({
                ...validPath,
                state: { ...validPath.state, style: { closed: "yes" } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("closed") });
    });

    it("rejects when style.lineWidth is invalid", () => {
        expect(
            validateEmission({
                ...validPath,
                state: { ...validPath.state, style: { lineWidth: 0 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("lineWidth") });
    });
});

describe("validateEmission — drawing fill-between kind", () => {
    it("accepts a well-formed fill-between band", () => {
        expect(validateEmission(validFillBetween)).toEqual({ ok: true });
    });

    it("accepts a fill-between with full stroke + fill style", () => {
        expect(
            validateEmission({
                ...validFillBetween,
                state: {
                    ...validFillBetween.state,
                    style: {
                        color: "#1e293b",
                        lineWidth: 2,
                        lineStyle: "dashed",
                        fill: "#3b82f6",
                        fillAlpha: 0.2,
                    },
                },
            }),
        ).toEqual({ ok: true });
    });

    it("accepts a long series-grown band (well past the discrete 20-point tool cap)", () => {
        // A fill-between band accumulates one vertex per bar, so its edges grow
        // far beyond the `path` / `polyline` 20-point cap. 50 points per edge
        // must validate (the cap is sized to a full chart history).
        const longEdge = Array.from({ length: 50 }, (_v, i) => ({ time: i, price: i % 2 }));
        expect(
            validateEmission({
                ...validFillBetween,
                state: { ...validFillBetween.state, edgeA: longEdge, edgeB: longEdge },
            }),
        ).toEqual({ ok: true });
    });

    it("rejects fewer than 2 anchors on edgeA", () => {
        expect(
            validateEmission({
                ...validFillBetween,
                state: { ...validFillBetween.state, edgeA: [{ time: 0, price: 1 }] },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("edgeA") });
    });

    it("rejects fewer than 2 anchors on edgeB", () => {
        expect(
            validateEmission({
                ...validFillBetween,
                state: { ...validFillBetween.state, edgeB: [{ time: 0, price: 0 }] },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("edgeB") });
    });

    it("rejects a non-object style", () => {
        expect(
            validateEmission({
                ...validFillBetween,
                state: { ...validFillBetween.state, style: null },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("style") });
    });

    it("rejects a non-string color", () => {
        expect(
            validateEmission({
                ...validFillBetween,
                state: { ...validFillBetween.state, style: { color: 42 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("color") });
    });

    it("rejects an invalid lineWidth", () => {
        expect(
            validateEmission({
                ...validFillBetween,
                state: { ...validFillBetween.state, style: { lineWidth: 0 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("lineWidth") });
    });

    it("rejects an invalid lineStyle", () => {
        expect(
            validateEmission({
                ...validFillBetween,
                state: { ...validFillBetween.state, style: { lineStyle: "wavy" } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("lineStyle") });
    });

    it("rejects a non-string fill", () => {
        expect(
            validateEmission({
                ...validFillBetween,
                state: { ...validFillBetween.state, style: { fill: 42 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("fill") });
    });

    it("rejects a fillAlpha outside [0, 1]", () => {
        expect(
            validateEmission({
                ...validFillBetween,
                state: { ...validFillBetween.state, style: { fillAlpha: 1.5 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("fillAlpha") });
    });
});

describe("validateEmission — drawing marker kind", () => {
    it("accepts a well-formed marker (no text / value)", () => {
        expect(validateEmission(validMarker)).toEqual({ ok: true });
    });

    it("accepts a marker with text + value + full TextOpts", () => {
        expect(
            validateEmission({
                ...validMarker,
                state: {
                    ...validMarker.state,
                    text: "B",
                    value: 1.5,
                    style: {
                        color: "#10b981",
                        size: "large",
                        halign: "center",
                        valign: "middle",
                        bgColor: "#f3f4f6",
                    },
                },
            }),
        ).toEqual({ ok: true });
    });

    it("rejects when anchor is not a WorldPoint", () => {
        expect(
            validateEmission({
                ...validMarker,
                state: { ...validMarker.state, anchor: { time: 0 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("anchor") });
    });

    it("rejects when text is not a string", () => {
        expect(
            validateEmission({
                ...validMarker,
                state: { ...validMarker.state, text: 42 },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("text") });
    });

    it("rejects when value is not finite", () => {
        expect(
            validateEmission({
                ...validMarker,
                state: { ...validMarker.state, value: Number.NaN },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("value") });
    });

    it("rejects when style.color is not a string", () => {
        expect(
            validateEmission({
                ...validMarker,
                state: { ...validMarker.state, style: { color: 42 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("color") });
    });

    it("rejects when style.size is unknown", () => {
        expect(
            validateEmission({
                ...validMarker,
                state: { ...validMarker.state, style: { size: "gigantic" } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("size") });
    });

    it("rejects when style.halign is unknown", () => {
        expect(
            validateEmission({
                ...validMarker,
                state: { ...validMarker.state, style: { halign: "middle" } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("halign") });
    });

    it("rejects when style.valign is unknown", () => {
        expect(
            validateEmission({
                ...validMarker,
                state: { ...validMarker.state, style: { valign: "center" } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("valign") });
    });

    it("rejects when style.bgColor is not a string", () => {
        expect(
            validateEmission({
                ...validMarker,
                state: { ...validMarker.state, style: { bgColor: 42 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("bgColor") });
    });

    it("rejects when style is not a plain object", () => {
        expect(
            validateEmission({
                ...validMarker,
                state: { ...validMarker.state, style: null },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("style") });
    });
});

describe("validateEmission — drawing arc kind", () => {
    it("accepts a well-formed arc", () => {
        expect(validateEmission(validArc)).toEqual({ ok: true });
    });

    it("rejects an arc with the wrong anchor count", () => {
        expect(
            validateEmission({
                ...validArc,
                state: {
                    ...validArc.state,
                    anchors: [
                        { time: 0, price: 0 },
                        { time: 1, price: 2 },
                    ],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("3-element") });
    });

    it("rejects an arc whose middle anchor is not a WorldPoint", () => {
        expect(
            validateEmission({
                ...validArc,
                state: {
                    ...validArc.state,
                    anchors: [{ time: 0, price: 0 }, { time: 1 }, { time: 2, price: 0 }],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("anchors[1]") });
    });

    it("rejects an arc with an invalid style.lineWidth", () => {
        expect(
            validateEmission({
                ...validArc,
                state: { ...validArc.state, style: { lineWidth: 0 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("lineWidth") });
    });
});

describe("validateEmission — drawing curve kind", () => {
    it("accepts a well-formed curve", () => {
        expect(validateEmission(validCurve)).toEqual({ ok: true });
    });

    it("accepts a curve with extendLeft + extendRight + colour", () => {
        expect(
            validateEmission({
                ...validCurve,
                state: {
                    ...validCurve.state,
                    style: {
                        color: "#3b82f6",
                        lineWidth: 2,
                        lineStyle: "dashed",
                        extendLeft: true,
                        extendRight: true,
                    },
                },
            }),
        ).toEqual({ ok: true });
    });

    it("rejects a curve with too few anchors", () => {
        expect(
            validateEmission({
                ...validCurve,
                state: { ...validCurve.state, anchors: [{ time: 0, price: 0 }] },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("3-element") });
    });

    it("rejects a curve with a non-string color", () => {
        expect(
            validateEmission({
                ...validCurve,
                state: { ...validCurve.state, style: { color: 42 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("color") });
    });
});

describe("validateEmission — drawing double-curve kind", () => {
    it("accepts a well-formed double-curve", () => {
        expect(validateEmission(validDoubleCurve)).toEqual({ ok: true });
    });

    it("rejects a double-curve with 4 anchors instead of 5", () => {
        expect(
            validateEmission({
                ...validDoubleCurve,
                state: {
                    ...validDoubleCurve.state,
                    anchors: [
                        { time: 0, price: 0 },
                        { time: 1, price: 1 },
                        { time: 2, price: 0 },
                        { time: 3, price: -1 },
                    ],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("5-element") });
    });

    it("rejects a double-curve whose 4th anchor is not a WorldPoint", () => {
        expect(
            validateEmission({
                ...validDoubleCurve,
                state: {
                    ...validDoubleCurve.state,
                    anchors: [
                        { time: 0, price: 0 },
                        { time: 1, price: 1 },
                        { time: 2, price: 0 },
                        { price: -1 },
                        { time: 4, price: 0 },
                    ],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("anchors[3]") });
    });

    it("rejects a double-curve with an invalid style.lineStyle", () => {
        expect(
            validateEmission({
                ...validDoubleCurve,
                state: { ...validDoubleCurve.state, style: { lineStyle: "wobbly" } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("lineStyle") });
    });
});

describe("validateEmission — drawing pen kind", () => {
    it("accepts a well-formed pen at the minimum length (2)", () => {
        expect(validateEmission(validPen)).toEqual({ ok: true });
    });

    it("accepts a pen at the maximum length (500)", () => {
        const anchors = Array.from({ length: 500 }, (_, i) => ({ time: i, price: i }));
        expect(
            validateEmission({
                ...validPen,
                state: { ...validPen.state, anchors },
            }),
        ).toEqual({ ok: true });
    });

    it("rejects a pen with fewer than 2 anchors", () => {
        expect(
            validateEmission({
                ...validPen,
                state: { ...validPen.state, anchors: [{ time: 0, price: 0 }] },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("2..500") });
    });

    it("rejects a pen with more than 500 anchors", () => {
        const anchors = Array.from({ length: 501 }, (_, i) => ({ time: i, price: i }));
        expect(
            validateEmission({
                ...validPen,
                state: { ...validPen.state, anchors },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("2..500") });
    });

    it("rejects a pen with a non-string color in style", () => {
        expect(
            validateEmission({
                ...validPen,
                state: { ...validPen.state, style: { color: 42 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("color") });
    });
});

describe("validateEmission — drawing highlighter kind", () => {
    it("accepts a well-formed highlighter", () => {
        expect(validateEmission(validHighlighter)).toEqual({ ok: true });
    });

    it("accepts alpha at the lower / upper boundary", () => {
        for (const alpha of [0, 1]) {
            expect(
                validateEmission({
                    ...validHighlighter,
                    state: {
                        ...validHighlighter.state,
                        style: { color: "#facc15", alpha },
                    },
                }),
            ).toEqual({ ok: true });
        }
    });

    it("rejects a highlighter without color", () => {
        expect(
            validateEmission({
                ...validHighlighter,
                state: {
                    ...validHighlighter.state,
                    style: { alpha: 0.3 },
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("color") });
    });

    it("rejects alpha outside [0, 1]", () => {
        expect(
            validateEmission({
                ...validHighlighter,
                state: {
                    ...validHighlighter.state,
                    style: { color: "#facc15", alpha: 1.5 },
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("alpha") });
    });

    it("rejects a non-finite alpha", () => {
        expect(
            validateEmission({
                ...validHighlighter,
                state: {
                    ...validHighlighter.state,
                    style: { color: "#facc15", alpha: Number.NaN },
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("alpha") });
    });

    it("rejects highlighter style that is not a plain object", () => {
        expect(
            validateEmission({
                ...validHighlighter,
                state: { ...validHighlighter.state, style: null },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("style") });
    });

    it("rejects fewer than 2 anchors", () => {
        expect(
            validateEmission({
                ...validHighlighter,
                state: { ...validHighlighter.state, anchors: [{ time: 0, price: 0 }] },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("2..500") });
    });
});

describe("validateEmission — drawing brush kind", () => {
    it("accepts a well-formed brush", () => {
        expect(validateEmission(validBrush)).toEqual({ ok: true });
    });

    it("rejects a brush without stroke", () => {
        expect(
            validateEmission({
                ...validBrush,
                state: { ...validBrush.state, style: { fill: "#ffffff" } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("stroke") });
    });

    it("rejects a brush without fill", () => {
        expect(
            validateEmission({
                ...validBrush,
                state: { ...validBrush.state, style: { stroke: "#000000" } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("fill") });
    });

    it("rejects a brush whose stroke is not a string", () => {
        expect(
            validateEmission({
                ...validBrush,
                state: { ...validBrush.state, style: { stroke: 42, fill: "#ffffff" } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("stroke") });
    });

    it("rejects a brush whose fill is not a string", () => {
        expect(
            validateEmission({
                ...validBrush,
                state: { ...validBrush.state, style: { stroke: "#000000", fill: 42 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("fill") });
    });

    it("rejects brush style that is not a plain object", () => {
        expect(
            validateEmission({
                ...validBrush,
                state: { ...validBrush.state, style: null },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("style") });
    });

    it("rejects more than 500 anchors", () => {
        const anchors = Array.from({ length: 501 }, (_, i) => ({ time: i, price: i }));
        expect(
            validateEmission({
                ...validBrush,
                state: { ...validBrush.state, anchors },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("2..500") });
    });
});

describe("validateEmission — drawing text kind", () => {
    it("accepts a well-formed text drawing", () => {
        expect(validateEmission(validText)).toEqual({ ok: true });
    });

    it("accepts a text body at the 256-char cap", () => {
        const body = "x".repeat(256);
        expect(
            validateEmission({
                ...validText,
                state: { ...validText.state, body },
            }),
        ).toEqual({ ok: true });
    });

    it("rejects a text body longer than 256 characters", () => {
        const body = "x".repeat(257);
        expect(
            validateEmission({
                ...validText,
                state: { ...validText.state, body },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("256") });
    });

    it("rejects an empty text body", () => {
        expect(
            validateEmission({
                ...validText,
                state: { ...validText.state, body: "" },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("non-empty") });
    });

    it("rejects a non-string text body", () => {
        expect(
            validateEmission({
                ...validText,
                state: { ...validText.state, body: 42 },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("body") });
    });

    it("rejects a non-WorldPoint anchor", () => {
        expect(
            validateEmission({
                ...validText,
                state: { ...validText.state, anchor: { time: Number.NaN, price: 0 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("WorldPoint") });
    });

    it("rejects a body that carries a non-JsonValue payload via walkMeta", () => {
        expect(
            validateEmission({
                ...validText,
                state: { ...validText.state, body: 1n as unknown as string },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("bigint") });
    });

    it("accepts an optional bgColor", () => {
        expect(
            validateEmission({
                ...validText,
                state: { ...validText.state, style: { bgColor: "#fef3c7" } },
            }),
        ).toEqual({ ok: true });
    });

    it("rejects a non-string bgColor", () => {
        expect(
            validateEmission({
                ...validText,
                state: { ...validText.state, style: { bgColor: 42 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("bgColor") });
    });
});

describe("validateEmission — drawing arrow kind", () => {
    it("accepts a well-formed arrow", () => {
        expect(validateEmission(validArrow)).toEqual({ ok: true });
    });

    it("accepts an arrow with an optional label", () => {
        expect(
            validateEmission({
                ...validArrow,
                state: { ...validArrow.state, style: { label: "Sell" } },
            }),
        ).toEqual({ ok: true });
    });

    it("accepts an arrow that combines LineDrawStyle + label", () => {
        expect(
            validateEmission({
                ...validArrow,
                state: {
                    ...validArrow.state,
                    style: {
                        color: "#dc2626",
                        lineWidth: 2,
                        lineStyle: "dashed",
                        label: "Sell",
                    },
                },
            }),
        ).toEqual({ ok: true });
    });

    it("rejects a non-string label", () => {
        expect(
            validateEmission({
                ...validArrow,
                state: { ...validArrow.state, style: { label: 42 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("label") });
    });

    it("rejects when anchors has the wrong length", () => {
        expect(
            validateEmission({
                ...validArrow,
                state: {
                    ...validArrow.state,
                    anchors: [{ time: 0, price: 0 }],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("2-element") });
    });

    it("rejects when style is not a plain object", () => {
        expect(
            validateEmission({
                ...validArrow,
                state: { ...validArrow.state, style: null },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("style") });
    });

    it("rejects when style.lineWidth is non-finite", () => {
        expect(
            validateEmission({
                ...validArrow,
                state: { ...validArrow.state, style: { lineWidth: Number.NaN } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("lineWidth") });
    });
});

describe("validateEmission — drawing arrow-marker kind", () => {
    it("accepts a well-formed arrow-marker", () => {
        expect(validateEmission(validArrowMarker)).toEqual({ ok: true });
    });

    it("accepts optional color + text", () => {
        expect(
            validateEmission({
                ...validArrowMarker,
                state: {
                    ...validArrowMarker.state,
                    style: { color: "#10b981", text: "Long" },
                },
            }),
        ).toEqual({ ok: true });
    });

    it("rejects a non-WorldPoint anchor", () => {
        expect(
            validateEmission({
                ...validArrowMarker,
                state: { ...validArrowMarker.state, anchor: { time: 0 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("WorldPoint") });
    });

    it("rejects a non-string color", () => {
        expect(
            validateEmission({
                ...validArrowMarker,
                state: { ...validArrowMarker.state, style: { color: 42 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("color") });
    });

    it("rejects a non-string text", () => {
        expect(
            validateEmission({
                ...validArrowMarker,
                state: { ...validArrowMarker.state, style: { text: 42 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("text") });
    });

    it("rejects a non-plain-object style", () => {
        expect(
            validateEmission({
                ...validArrowMarker,
                state: { ...validArrowMarker.state, style: null },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("style") });
    });
});

describe("validateEmission — drawing arrow-mark-up kind", () => {
    it("accepts a well-formed arrow-mark-up", () => {
        expect(validateEmission(validArrowMarkUp)).toEqual({ ok: true });
    });

    it("accepts an explicit color override", () => {
        expect(
            validateEmission({
                ...validArrowMarkUp,
                state: { ...validArrowMarkUp.state, style: { color: "#1e40af" } },
            }),
        ).toEqual({ ok: true });
    });

    it("rejects a non-WorldPoint anchor", () => {
        expect(
            validateEmission({
                ...validArrowMarkUp,
                state: { ...validArrowMarkUp.state, anchor: "not-a-point" },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("WorldPoint") });
    });

    it("rejects a non-string color", () => {
        expect(
            validateEmission({
                ...validArrowMarkUp,
                state: { ...validArrowMarkUp.state, style: { color: 42 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("color") });
    });
});

describe("validateEmission — drawing arrow-mark-down kind", () => {
    it("accepts a well-formed arrow-mark-down", () => {
        expect(validateEmission(validArrowMarkDown)).toEqual({ ok: true });
    });

    it("accepts an explicit color override", () => {
        expect(
            validateEmission({
                ...validArrowMarkDown,
                state: { ...validArrowMarkDown.state, style: { color: "#7c2d12" } },
            }),
        ).toEqual({ ok: true });
    });

    it("rejects a non-WorldPoint anchor", () => {
        expect(
            validateEmission({
                ...validArrowMarkDown,
                state: { ...validArrowMarkDown.state, anchor: 42 },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("WorldPoint") });
    });

    it("rejects a non-plain-object style", () => {
        expect(
            validateEmission({
                ...validArrowMarkDown,
                state: { ...validArrowMarkDown.state, style: null },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("style") });
    });
});

describe("validateEmission — drawing trend-channel kind", () => {
    it("accepts a well-formed trend-channel", () => {
        expect(validateEmission(validTrendChannel)).toEqual({ ok: true });
    });

    it("accepts a trend-channel with a full LineDrawStyle", () => {
        expect(
            validateEmission({
                ...validTrendChannel,
                state: {
                    ...validTrendChannel.state,
                    style: {
                        color: "#3b82f6",
                        lineWidth: 2,
                        lineStyle: "dashed",
                        extendRight: true,
                    },
                },
            }),
        ).toEqual({ ok: true });
    });

    it("rejects a trend-channel with the wrong anchor count", () => {
        expect(
            validateEmission({
                ...validTrendChannel,
                state: {
                    ...validTrendChannel.state,
                    anchors: [
                        { time: 0, price: 0 },
                        { time: 1, price: 1 },
                    ],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("3-element") });
    });

    it("rejects a trend-channel whose third anchor is not a WorldPoint", () => {
        expect(
            validateEmission({
                ...validTrendChannel,
                state: {
                    ...validTrendChannel.state,
                    anchors: [{ time: 0, price: 0 }, { time: 1, price: 1 }, { time: 0 }],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("anchors[2]") });
    });

    it("rejects a non-boolean extendLeft", () => {
        expect(
            validateEmission({
                ...validTrendChannel,
                state: { ...validTrendChannel.state, style: { extendLeft: "yes" } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("extendLeft") });
    });
});

describe("validateEmission — drawing flat-top-bottom kind", () => {
    it("accepts a well-formed flat-top-bottom", () => {
        expect(validateEmission(validFlatTopBottom)).toEqual({ ok: true });
    });

    it("rejects a flat-top-bottom with 4 anchors (3 expected)", () => {
        expect(
            validateEmission({
                ...validFlatTopBottom,
                state: {
                    ...validFlatTopBottom.state,
                    anchors: [
                        { time: 0, price: 1 },
                        { time: 1, price: 1 },
                        { time: 0, price: 0 },
                        { time: 1, price: 0 },
                    ],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("3-element") });
    });

    it("rejects a flat-top-bottom with a non-finite anchor price", () => {
        expect(
            validateEmission({
                ...validFlatTopBottom,
                state: {
                    ...validFlatTopBottom.state,
                    anchors: [
                        { time: 0, price: Number.NaN },
                        { time: 1, price: 1 },
                        { time: 0, price: 0 },
                    ],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("anchors[0]") });
    });

    it("rejects an invalid lineStyle", () => {
        expect(
            validateEmission({
                ...validFlatTopBottom,
                state: { ...validFlatTopBottom.state, style: { lineStyle: "wavy" } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("lineStyle") });
    });
});

describe("validateEmission — drawing disjoint-channel kind", () => {
    it("accepts a well-formed disjoint-channel", () => {
        expect(validateEmission(validDisjointChannel)).toEqual({ ok: true });
    });

    it("rejects a disjoint-channel with 3 anchors (4 expected)", () => {
        expect(
            validateEmission({
                ...validDisjointChannel,
                state: {
                    ...validDisjointChannel.state,
                    anchors: [
                        { time: 0, price: 0 },
                        { time: 1, price: 1 },
                        { time: 0, price: 2 },
                    ],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("4-element") });
    });

    it("rejects a disjoint-channel whose fourth anchor is not a WorldPoint", () => {
        expect(
            validateEmission({
                ...validDisjointChannel,
                state: {
                    ...validDisjointChannel.state,
                    anchors: [
                        { time: 0, price: 0 },
                        { time: 1, price: 1 },
                        { time: 0, price: 2 },
                        { price: 3 },
                    ],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("anchors[3]") });
    });

    it("rejects a non-finite lineWidth", () => {
        expect(
            validateEmission({
                ...validDisjointChannel,
                state: {
                    ...validDisjointChannel.state,
                    style: { lineWidth: Number.NaN },
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("lineWidth") });
    });
});

describe("validateEmission — drawing regression-trend kind", () => {
    it("accepts a well-formed regression-trend", () => {
        expect(validateEmission(validRegressionTrend)).toEqual({ ok: true });
    });

    it("accepts the full RegressionTrendOpts payload", () => {
        expect(
            validateEmission({
                ...validRegressionTrend,
                state: {
                    ...validRegressionTrend.state,
                    style: {
                        source: "hlc3",
                        stdevMultiplier: 1.5,
                        showUpperBand: true,
                        showLowerBand: false,
                        color: "#3b82f6",
                    },
                },
            }),
        ).toEqual({ ok: true });
    });

    it("accepts every valid source value", () => {
        for (const source of [
            "close",
            "open",
            "high",
            "low",
            "hl2",
            "hlc3",
            "ohlc4",
            "hlcc4",
        ] as const) {
            expect(
                validateEmission({
                    ...validRegressionTrend,
                    state: { ...validRegressionTrend.state, style: { source } },
                }),
            ).toEqual({ ok: true });
        }
    });

    it("rejects anchors with start.time === end.time", () => {
        expect(
            validateEmission({
                ...validRegressionTrend,
                state: {
                    ...validRegressionTrend.state,
                    anchors: [
                        { time: 5, price: 0 },
                        { time: 5, price: 1 },
                    ],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("anchors[0].time") });
    });

    it("rejects anchors with start.time > end.time", () => {
        expect(
            validateEmission({
                ...validRegressionTrend,
                state: {
                    ...validRegressionTrend.state,
                    anchors: [
                        { time: 100, price: 0 },
                        { time: 0, price: 1 },
                    ],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("anchors[0].time") });
    });

    it("rejects an unknown source", () => {
        expect(
            validateEmission({
                ...validRegressionTrend,
                state: {
                    ...validRegressionTrend.state,
                    style: { source: "tick" },
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("source") });
    });

    it("rejects a negative stdevMultiplier", () => {
        expect(
            validateEmission({
                ...validRegressionTrend,
                state: {
                    ...validRegressionTrend.state,
                    style: { stdevMultiplier: -0.5 },
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("stdevMultiplier") });
    });

    it("rejects a non-finite stdevMultiplier", () => {
        expect(
            validateEmission({
                ...validRegressionTrend,
                state: {
                    ...validRegressionTrend.state,
                    style: { stdevMultiplier: Number.NaN },
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("stdevMultiplier") });
    });

    it("rejects a non-boolean showUpperBand", () => {
        expect(
            validateEmission({
                ...validRegressionTrend,
                state: {
                    ...validRegressionTrend.state,
                    style: { showUpperBand: "yes" },
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("showUpperBand") });
    });

    it("rejects a non-boolean showLowerBand", () => {
        expect(
            validateEmission({
                ...validRegressionTrend,
                state: {
                    ...validRegressionTrend.state,
                    style: { showLowerBand: "no" },
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("showLowerBand") });
    });

    it("rejects a non-string color", () => {
        expect(
            validateEmission({
                ...validRegressionTrend,
                state: {
                    ...validRegressionTrend.state,
                    style: { color: 42 },
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("color") });
    });

    it("rejects a non-plain-object style", () => {
        expect(
            validateEmission({
                ...validRegressionTrend,
                state: { ...validRegressionTrend.state, style: null },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("style") });
    });

    it("rejects a non-WorldPoint anchor", () => {
        expect(
            validateEmission({
                ...validRegressionTrend,
                state: {
                    ...validRegressionTrend.state,
                    anchors: [{ time: 0 }, { time: 100, price: 1 }],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("anchors[0]") });
    });
});

describe("validateEmission — drawing fib-retracement kind", () => {
    it("accepts a well-formed fib-retracement", () => {
        expect(validateEmission(validFibRetracement)).toEqual({ ok: true });
    });

    it("accepts a full FibOpts payload", () => {
        expect(
            validateEmission({
                ...validFibRetracement,
                state: {
                    ...validFibRetracement.state,
                    style: {
                        levels: [0.382, 0.5, 0.618],
                        showLabels: true,
                        color: "#facc15",
                        extendLeft: false,
                        extendRight: true,
                    },
                },
            }),
        ).toEqual({ ok: true });
    });

    it("rejects a fib-retracement with the wrong anchor count", () => {
        expect(
            validateEmission({
                ...validFibRetracement,
                state: {
                    ...validFibRetracement.state,
                    anchors: [{ time: 0, price: 0 }],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("2-element") });
    });

    it("rejects levels that is not an array", () => {
        expect(
            validateEmission({
                ...validFibRetracement,
                state: { ...validFibRetracement.state, style: { levels: "0.5" } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("levels") });
    });

    it("rejects an empty levels array", () => {
        expect(
            validateEmission({
                ...validFibRetracement,
                state: { ...validFibRetracement.state, style: { levels: [] } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("at least one") });
    });

    it("rejects a non-finite level entry", () => {
        expect(
            validateEmission({
                ...validFibRetracement,
                state: { ...validFibRetracement.state, style: { levels: [0.5, Number.NaN] } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("levels[1]") });
    });

    it("rejects a non-boolean showLabels", () => {
        expect(
            validateEmission({
                ...validFibRetracement,
                state: { ...validFibRetracement.state, style: { showLabels: "yes" } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("showLabels") });
    });

    it("rejects a non-boolean extendLeft", () => {
        expect(
            validateEmission({
                ...validFibRetracement,
                state: { ...validFibRetracement.state, style: { extendLeft: 1 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("extendLeft") });
    });
});

describe("validateEmission — drawing fib-trend-extension kind", () => {
    it("accepts a well-formed fib-trend-extension", () => {
        expect(validateEmission(validFibTrendExtension)).toEqual({ ok: true });
    });

    it("rejects a fib-trend-extension with 2 anchors (3 expected)", () => {
        expect(
            validateEmission({
                ...validFibTrendExtension,
                state: {
                    ...validFibTrendExtension.state,
                    anchors: [
                        { time: 0, price: 0 },
                        { time: 1, price: 1 },
                    ],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("3-element") });
    });

    it("rejects a non-string color in FibOpts", () => {
        expect(
            validateEmission({
                ...validFibTrendExtension,
                state: { ...validFibTrendExtension.state, style: { color: 42 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("color") });
    });
});

describe("validateEmission — drawing fib-channel kind", () => {
    it("accepts a well-formed fib-channel", () => {
        expect(validateEmission(validFibChannel)).toEqual({ ok: true });
    });

    it("rejects a fib-channel with 4 anchors (3 expected)", () => {
        expect(
            validateEmission({
                ...validFibChannel,
                state: {
                    ...validFibChannel.state,
                    anchors: [
                        { time: 0, price: 0 },
                        { time: 1, price: 1 },
                        { time: 0, price: 1 },
                        { time: 1, price: 2 },
                    ],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("3-element") });
    });

    it("rejects a non-boolean extendRight in FibOpts", () => {
        expect(
            validateEmission({
                ...validFibChannel,
                state: { ...validFibChannel.state, style: { extendRight: 1 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("extendRight") });
    });
});

describe("validateEmission — drawing fib-time-zone kind", () => {
    it("accepts a well-formed fib-time-zone", () => {
        expect(validateEmission(validFibTimeZone)).toEqual({ ok: true });
    });

    it("rejects a fib-time-zone with the wrong anchor count", () => {
        expect(
            validateEmission({
                ...validFibTimeZone,
                state: {
                    ...validFibTimeZone.state,
                    anchors: [
                        { time: 0, price: 0 },
                        { time: 50, price: 0 },
                        { time: 100, price: 0 },
                    ],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("2-element") });
    });

    it("rejects a non-plain-object style", () => {
        expect(
            validateEmission({
                ...validFibTimeZone,
                state: { ...validFibTimeZone.state, style: null },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("style") });
    });
});

describe("validateEmission — drawing fib-wedge kind", () => {
    it("accepts a well-formed fib-wedge", () => {
        expect(validateEmission(validFibWedge)).toEqual({ ok: true });
    });

    it("rejects a fib-wedge with 2 anchors (3 expected)", () => {
        expect(
            validateEmission({
                ...validFibWedge,
                state: {
                    ...validFibWedge.state,
                    anchors: [
                        { time: 0, price: 0 },
                        { time: 1, price: 1 },
                    ],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("3-element") });
    });

    it("rejects a non-WorldPoint third anchor", () => {
        expect(
            validateEmission({
                ...validFibWedge,
                state: {
                    ...validFibWedge.state,
                    anchors: [{ time: 0, price: 0 }, { time: 1, price: 1 }, { time: 1 }],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("anchors[2]") });
    });
});

describe("validateEmission — drawing fib-speed-fan kind", () => {
    it("accepts a well-formed fib-speed-fan", () => {
        expect(validateEmission(validFibSpeedFan)).toEqual({ ok: true });
    });

    it("rejects a fib-speed-fan with 3 anchors (2 expected)", () => {
        expect(
            validateEmission({
                ...validFibSpeedFan,
                state: {
                    ...validFibSpeedFan.state,
                    anchors: [
                        { time: 0, price: 0 },
                        { time: 1, price: 1 },
                        { time: 2, price: 0.5 },
                    ],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("2-element") });
    });

    it("rejects a non-finite level entry", () => {
        expect(
            validateEmission({
                ...validFibSpeedFan,
                state: {
                    ...validFibSpeedFan.state,
                    style: { levels: [0.5, Number.NaN] },
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("levels[1]") });
    });
});

describe("validateEmission — drawing fib-speed-arcs kind", () => {
    it("accepts a well-formed fib-speed-arcs", () => {
        expect(validateEmission(validFibSpeedArcs)).toEqual({ ok: true });
    });

    it("rejects a non-WorldPoint second anchor", () => {
        expect(
            validateEmission({
                ...validFibSpeedArcs,
                state: {
                    ...validFibSpeedArcs.state,
                    anchors: [{ time: 0, price: 0 }, { time: 1 }],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("anchors[1]") });
    });

    it("rejects a non-string color in FibOpts", () => {
        expect(
            validateEmission({
                ...validFibSpeedArcs,
                state: { ...validFibSpeedArcs.state, style: { color: 42 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("color") });
    });
});

describe("validateEmission — drawing fib-spiral kind", () => {
    it("accepts a well-formed fib-spiral", () => {
        expect(validateEmission(validFibSpiral)).toEqual({ ok: true });
    });

    it("accepts a full FibOpts payload", () => {
        expect(
            validateEmission({
                ...validFibSpiral,
                state: {
                    ...validFibSpiral.state,
                    style: {
                        levels: [0.382, 0.618, 1.618],
                        showLabels: true,
                        color: "#facc15",
                    },
                },
            }),
        ).toEqual({ ok: true });
    });

    it("rejects a fib-spiral with the wrong anchor count", () => {
        expect(
            validateEmission({
                ...validFibSpiral,
                state: {
                    ...validFibSpiral.state,
                    anchors: [{ time: 0, price: 0 }],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("2-element") });
    });
});

describe("validateEmission — drawing fib-circles kind", () => {
    it("accepts a well-formed fib-circles", () => {
        expect(validateEmission(validFibCircles)).toEqual({ ok: true });
    });

    it("rejects a fib-circles with the wrong anchor count", () => {
        expect(
            validateEmission({
                ...validFibCircles,
                state: {
                    ...validFibCircles.state,
                    anchors: [{ time: 0, price: 0 }],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("2-element") });
    });

    it("rejects an empty levels array", () => {
        expect(
            validateEmission({
                ...validFibCircles,
                state: { ...validFibCircles.state, style: { levels: [] } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("at least one") });
    });

    it("rejects a non-boolean showLabels", () => {
        expect(
            validateEmission({
                ...validFibCircles,
                state: { ...validFibCircles.state, style: { showLabels: "yes" } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("showLabels") });
    });
});

describe("validateEmission — drawing fib-trend-time kind", () => {
    it("accepts a well-formed fib-trend-time", () => {
        expect(validateEmission(validFibTrendTime)).toEqual({ ok: true });
    });

    it("rejects a fib-trend-time with 2 anchors (3 expected)", () => {
        expect(
            validateEmission({
                ...validFibTrendTime,
                state: {
                    ...validFibTrendTime.state,
                    anchors: [
                        { time: 0, price: 0 },
                        { time: 1, price: 1 },
                    ],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("3-element") });
    });

    it("rejects a non-plain-object style", () => {
        expect(
            validateEmission({
                ...validFibTrendTime,
                state: { ...validFibTrendTime.state, style: null },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("style") });
    });
});

describe("validateEmission — drawing gann-box kind", () => {
    it("accepts a well-formed gann-box", () => {
        expect(validateEmission(validGannBox)).toEqual({ ok: true });
    });

    it("rejects a gann-box with 3 anchors (2 expected)", () => {
        expect(
            validateEmission({
                ...validGannBox,
                state: {
                    ...validGannBox.state,
                    anchors: [
                        { time: 0, price: 0 },
                        { time: 1, price: 1 },
                        { time: 2, price: 0.5 },
                    ],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("2-element") });
    });

    it("rejects a non-positive lineWidth in LineDrawStyle", () => {
        expect(
            validateEmission({
                ...validGannBox,
                state: { ...validGannBox.state, style: { lineWidth: 0 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("lineWidth") });
    });
});

describe("validateEmission — drawing gann-square-fixed kind", () => {
    it("accepts a well-formed gann-square-fixed", () => {
        expect(validateEmission(validGannSquareFixed)).toEqual({ ok: true });
    });

    it("rejects a non-WorldPoint anchor", () => {
        expect(
            validateEmission({
                ...validGannSquareFixed,
                state: { ...validGannSquareFixed.state, anchor: { time: 0 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("anchor") });
    });

    it("rejects a non-string color in LineDrawStyle", () => {
        expect(
            validateEmission({
                ...validGannSquareFixed,
                state: { ...validGannSquareFixed.state, style: { color: 42 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("color") });
    });
});

describe("validateEmission — drawing gann-square kind", () => {
    it("accepts a well-formed gann-square", () => {
        expect(validateEmission(validGannSquare)).toEqual({ ok: true });
    });

    it("rejects a gann-square with 1 anchor (2 expected)", () => {
        expect(
            validateEmission({
                ...validGannSquare,
                state: {
                    ...validGannSquare.state,
                    anchors: [{ time: 0, price: 0 }],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("2-element") });
    });

    it("rejects an invalid lineStyle", () => {
        expect(
            validateEmission({
                ...validGannSquare,
                state: { ...validGannSquare.state, style: { lineStyle: "wavy" } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("lineStyle") });
    });
});

describe("validateEmission — drawing gann-fan kind", () => {
    it("accepts a well-formed gann-fan", () => {
        expect(validateEmission(validGannFan)).toEqual({ ok: true });
    });

    it("rejects a gann-fan with a non-WorldPoint second anchor", () => {
        expect(
            validateEmission({
                ...validGannFan,
                state: {
                    ...validGannFan.state,
                    anchors: [{ time: 0, price: 0 }, { time: 1 }],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("anchors[1]") });
    });

    it("rejects a non-plain-object style", () => {
        expect(
            validateEmission({
                ...validGannFan,
                state: { ...validGannFan.state, style: null },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("style") });
    });
});

describe("validateEmission — drawing pitchfork kind", () => {
    it("accepts a well-formed pitchfork (standard variant)", () => {
        expect(validateEmission(validPitchfork)).toEqual({ ok: true });
    });

    it("accepts each of the 4 variants", () => {
        for (const variant of ["standard", "schiff", "modifiedSchiff", "inside"] as const) {
            expect(
                validateEmission({
                    ...validPitchfork,
                    state: { ...validPitchfork.state, variant },
                }),
            ).toEqual({ ok: true });
        }
    });

    it("rejects a pitchfork with 2 anchors (3 expected)", () => {
        expect(
            validateEmission({
                ...validPitchfork,
                state: {
                    ...validPitchfork.state,
                    anchors: [
                        { time: 0, price: 0 },
                        { time: 1, price: 1 },
                    ],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("3-element") });
    });

    it("rejects an unknown variant", () => {
        expect(
            validateEmission({
                ...validPitchfork,
                state: { ...validPitchfork.state, variant: "andrews" },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("variant") });
    });

    it("rejects a missing variant", () => {
        const { variant: _variant, ...stateNoVariant } = validPitchfork.state;
        expect(
            validateEmission({
                ...validPitchfork,
                state: stateNoVariant,
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("variant") });
    });

    it("rejects an invalid lineWidth", () => {
        expect(
            validateEmission({
                ...validPitchfork,
                state: { ...validPitchfork.state, style: { lineWidth: -1 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("lineWidth") });
    });
});

describe("validateEmission — drawing pitchfan kind", () => {
    it("accepts a well-formed pitchfan", () => {
        expect(validateEmission(validPitchfan)).toEqual({ ok: true });
    });

    it("rejects a pitchfan with 4 anchors (3 expected)", () => {
        expect(
            validateEmission({
                ...validPitchfan,
                state: {
                    ...validPitchfan.state,
                    anchors: [
                        { time: 0, price: 0 },
                        { time: 1, price: 1 },
                        { time: 2, price: 0.5 },
                        { time: 3, price: 0.25 },
                    ],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("3-element") });
    });

    it("rejects an invalid lineStyle", () => {
        expect(
            validateEmission({
                ...validPitchfan,
                state: { ...validPitchfan.state, style: { lineStyle: "wavy" } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("lineStyle") });
    });
});

describe("validateEmission — drawing xabcd-pattern kind", () => {
    it("accepts a well-formed xabcd-pattern", () => {
        expect(validateEmission(validXabcdPattern)).toEqual({ ok: true });
    });

    it("rejects an xabcd-pattern with 4 anchors (5 expected)", () => {
        expect(
            validateEmission({
                ...validXabcdPattern,
                state: {
                    ...validXabcdPattern.state,
                    anchors: validXabcdPattern.state.anchors.slice(0, 4),
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("5-element") });
    });

    it("rejects an xabcd-pattern with an invalid lineStyle", () => {
        expect(
            validateEmission({
                ...validXabcdPattern,
                state: { ...validXabcdPattern.state, style: { lineStyle: "wavy" } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("lineStyle") });
    });
});

describe("validateEmission — drawing cypher-pattern kind", () => {
    it("accepts a well-formed cypher-pattern", () => {
        expect(validateEmission(validCypherPattern)).toEqual({ ok: true });
    });

    it("rejects a cypher-pattern with 6 anchors (5 expected)", () => {
        expect(
            validateEmission({
                ...validCypherPattern,
                state: {
                    ...validCypherPattern.state,
                    anchors: [...validCypherPattern.state.anchors, { time: 5, price: 1.2 }],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("5-element") });
    });

    it("rejects a cypher-pattern with non-finite anchor price", () => {
        expect(
            validateEmission({
                ...validCypherPattern,
                state: {
                    ...validCypherPattern.state,
                    anchors: [
                        { time: 0, price: Number.NaN },
                        ...validCypherPattern.state.anchors.slice(1),
                    ],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("WorldPoint") });
    });
});

describe("validateEmission — drawing head-and-shoulders kind", () => {
    it("accepts a well-formed head-and-shoulders", () => {
        expect(validateEmission(validHeadAndShoulders)).toEqual({ ok: true });
    });

    it("rejects a head-and-shoulders with 3 anchors (5 expected)", () => {
        expect(
            validateEmission({
                ...validHeadAndShoulders,
                state: {
                    ...validHeadAndShoulders.state,
                    anchors: validHeadAndShoulders.state.anchors.slice(0, 3),
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("5-element") });
    });

    it("rejects a head-and-shoulders with a non-string colour", () => {
        expect(
            validateEmission({
                ...validHeadAndShoulders,
                state: { ...validHeadAndShoulders.state, style: { color: 42 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("color") });
    });
});

describe("validateEmission — drawing abcd-pattern kind", () => {
    it("accepts a well-formed abcd-pattern", () => {
        expect(validateEmission(validAbcdPattern)).toEqual({ ok: true });
    });

    it("rejects an abcd-pattern with 5 anchors (4 expected)", () => {
        expect(
            validateEmission({
                ...validAbcdPattern,
                state: {
                    ...validAbcdPattern.state,
                    anchors: [...validAbcdPattern.state.anchors, { time: 4, price: 2 }],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("4-element") });
    });

    it("rejects an abcd-pattern with an invalid lineWidth", () => {
        expect(
            validateEmission({
                ...validAbcdPattern,
                state: { ...validAbcdPattern.state, style: { lineWidth: -2 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("lineWidth") });
    });
});

describe("validateEmission — drawing triangle-pattern kind", () => {
    it("accepts a well-formed triangle-pattern", () => {
        expect(validateEmission(validTrianglePattern)).toEqual({ ok: true });
    });

    it("rejects a triangle-pattern with 4 anchors (3 expected)", () => {
        expect(
            validateEmission({
                ...validTrianglePattern,
                state: {
                    ...validTrianglePattern.state,
                    anchors: [...validTrianglePattern.state.anchors, { time: 3, price: 0.5 }],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("3-element") });
    });

    it("rejects a triangle-pattern with a non-plain-object style", () => {
        expect(
            validateEmission({
                ...validTrianglePattern,
                state: { ...validTrianglePattern.state, style: null },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("style") });
    });
});

describe("validateEmission — drawing three-drives-pattern kind", () => {
    it("accepts a well-formed three-drives-pattern", () => {
        expect(validateEmission(validThreeDrivesPattern)).toEqual({ ok: true });
    });

    it("rejects a three-drives-pattern with 6 anchors (7 expected)", () => {
        expect(
            validateEmission({
                ...validThreeDrivesPattern,
                state: {
                    ...validThreeDrivesPattern.state,
                    anchors: validThreeDrivesPattern.state.anchors.slice(0, 6),
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("7-element") });
    });

    it("rejects a three-drives-pattern with a non-array anchors", () => {
        expect(
            validateEmission({
                ...validThreeDrivesPattern,
                state: { ...validThreeDrivesPattern.state, anchors: "not-an-array" },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("7-element") });
    });

    it("rejects a three-drives-pattern with a non-WorldPoint at index 4", () => {
        const anchors = [...validThreeDrivesPattern.state.anchors];
        anchors[4] = { time: 4, price: "bad" } as unknown as { time: number; price: number };
        expect(
            validateEmission({
                ...validThreeDrivesPattern,
                state: { ...validThreeDrivesPattern.state, anchors },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("WorldPoint") });
    });

    it("rejects a three-drives-pattern with an invalid lineStyle", () => {
        expect(
            validateEmission({
                ...validThreeDrivesPattern,
                state: {
                    ...validThreeDrivesPattern.state,
                    style: { lineStyle: "rainbow" },
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("lineStyle") });
    });
});

describe("validateEmission — drawing elliott-impulse-wave kind", () => {
    it("accepts a well-formed elliott-impulse-wave", () => {
        expect(validateEmission(validElliottImpulseWave)).toEqual({ ok: true });
    });

    it("accepts an elliott-impulse-wave with a well-formed labels override", () => {
        expect(
            validateEmission({
                ...validElliottImpulseWave,
                state: {
                    ...validElliottImpulseWave.state,
                    labels: ["1", "2", "3", "4", "5"],
                },
            }),
        ).toEqual({ ok: true });
    });

    it("rejects an elliott-impulse-wave with 4 anchors (5 expected)", () => {
        expect(
            validateEmission({
                ...validElliottImpulseWave,
                state: {
                    ...validElliottImpulseWave.state,
                    anchors: validElliottImpulseWave.state.anchors.slice(0, 4),
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("5-element") });
    });

    it("rejects an elliott-impulse-wave with a labels array of the wrong length", () => {
        expect(
            validateEmission({
                ...validElliottImpulseWave,
                state: { ...validElliottImpulseWave.state, labels: ["1", "2"] },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("labels") });
    });

    it("rejects an elliott-impulse-wave with a non-string label element", () => {
        expect(
            validateEmission({
                ...validElliottImpulseWave,
                state: {
                    ...validElliottImpulseWave.state,
                    labels: ["1", "2", 3 as unknown as string, "4", "5"],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("labels[2]") });
    });

    it("rejects an elliott-impulse-wave with an invalid lineStyle", () => {
        expect(
            validateEmission({
                ...validElliottImpulseWave,
                state: { ...validElliottImpulseWave.state, style: { lineWidth: -1 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("lineWidth") });
    });
});

describe("validateEmission — drawing elliott-correction-wave kind", () => {
    it("accepts a well-formed elliott-correction-wave", () => {
        expect(validateEmission(validElliottCorrectionWave)).toEqual({ ok: true });
    });

    it("rejects an elliott-correction-wave with 2 anchors (3 expected)", () => {
        expect(
            validateEmission({
                ...validElliottCorrectionWave,
                state: {
                    ...validElliottCorrectionWave.state,
                    anchors: validElliottCorrectionWave.state.anchors.slice(0, 2),
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("3-element") });
    });

    it("rejects an elliott-correction-wave with a wrong-length labels override", () => {
        expect(
            validateEmission({
                ...validElliottCorrectionWave,
                state: { ...validElliottCorrectionWave.state, labels: ["A", "B"] },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("3 strings") });
    });

    it("rejects an elliott-correction-wave with an invalid lineStyle", () => {
        expect(
            validateEmission({
                ...validElliottCorrectionWave,
                state: {
                    ...validElliottCorrectionWave.state,
                    style: { lineStyle: "rainbow" },
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("lineStyle") });
    });
});

describe("validateEmission — drawing elliott-triangle-wave kind", () => {
    it("accepts a well-formed elliott-triangle-wave", () => {
        expect(validateEmission(validElliottTriangleWave)).toEqual({ ok: true });
    });

    it("rejects an elliott-triangle-wave with 4 anchors (5 expected)", () => {
        expect(
            validateEmission({
                ...validElliottTriangleWave,
                state: {
                    ...validElliottTriangleWave.state,
                    anchors: validElliottTriangleWave.state.anchors.slice(0, 4),
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("5-element") });
    });

    it("rejects an elliott-triangle-wave with non-array labels", () => {
        expect(
            validateEmission({
                ...validElliottTriangleWave,
                state: {
                    ...validElliottTriangleWave.state,
                    labels: "abcde" as unknown as ReadonlyArray<string>,
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("labels") });
    });

    it("rejects an elliott-triangle-wave with an invalid lineStyle", () => {
        expect(
            validateEmission({
                ...validElliottTriangleWave,
                state: { ...validElliottTriangleWave.state, style: { color: 42 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("color") });
    });
});

describe("validateEmission — drawing elliott-double-combo kind", () => {
    it("accepts a well-formed elliott-double-combo", () => {
        expect(validateEmission(validElliottDoubleCombo)).toEqual({ ok: true });
    });

    it("rejects an elliott-double-combo with 6 anchors (7 expected)", () => {
        expect(
            validateEmission({
                ...validElliottDoubleCombo,
                state: {
                    ...validElliottDoubleCombo.state,
                    anchors: validElliottDoubleCombo.state.anchors.slice(0, 6),
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("7-element") });
    });

    it("rejects an elliott-double-combo with a wrong-length labels override", () => {
        expect(
            validateEmission({
                ...validElliottDoubleCombo,
                state: {
                    ...validElliottDoubleCombo.state,
                    labels: ["S", "W", "X", "Y"],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("7 strings") });
    });

    it("rejects an elliott-double-combo with an invalid lineStyle", () => {
        expect(
            validateEmission({
                ...validElliottDoubleCombo,
                state: { ...validElliottDoubleCombo.state, style: { lineWidth: -2 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("lineWidth") });
    });
});

describe("validateEmission — drawing elliott-triple-combo kind", () => {
    it("accepts a well-formed elliott-triple-combo", () => {
        expect(validateEmission(validElliottTripleCombo)).toEqual({ ok: true });
    });

    it("rejects an elliott-triple-combo with 8 anchors (7 expected)", () => {
        const tooMany = [...validElliottTripleCombo.state.anchors, { time: 7, price: 2.5 }];
        expect(
            validateEmission({
                ...validElliottTripleCombo,
                state: { ...validElliottTripleCombo.state, anchors: tooMany },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("7-element") });
    });

    it("rejects an elliott-triple-combo with a non-WorldPoint at index 3", () => {
        const anchors = [...validElliottTripleCombo.state.anchors];
        anchors[3] = { time: 3, price: "bad" } as unknown as { time: number; price: number };
        expect(
            validateEmission({
                ...validElliottTripleCombo,
                state: { ...validElliottTripleCombo.state, anchors },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("WorldPoint") });
    });

    it("rejects an elliott-triple-combo with a wrong-length labels override", () => {
        expect(
            validateEmission({
                ...validElliottTripleCombo,
                state: {
                    ...validElliottTripleCombo.state,
                    labels: ["S", "W", "X"],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("7 strings") });
    });

    it("rejects an elliott-triple-combo with an invalid lineStyle", () => {
        expect(
            validateEmission({
                ...validElliottTripleCombo,
                state: { ...validElliottTripleCombo.state, style: null },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("style") });
    });
});

const validCyclicLines = {
    ...validLineDrawing,
    drawingKind: "cyclic-lines" as const,
    state: {
        kind: "cyclic-lines" as const,
        anchors: [
            { time: 0, price: 50 },
            { time: 100, price: 50 },
        ],
        style: {},
    },
};

const validTimeCycles = {
    ...validLineDrawing,
    drawingKind: "time-cycles" as const,
    state: {
        kind: "time-cycles" as const,
        anchors: [
            { time: 0, price: 50 },
            { time: 100, price: 50 },
        ],
        style: {},
    },
};

const validSineLine = {
    ...validLineDrawing,
    drawingKind: "sine-line" as const,
    state: {
        kind: "sine-line" as const,
        anchors: [
            { time: 0, price: 40 },
            { time: 100, price: 60 },
        ],
        style: {},
    },
};

describe("validateEmission — drawing cyclic-lines kind", () => {
    it("accepts a well-formed cyclic-lines", () => {
        expect(validateEmission(validCyclicLines)).toEqual({ ok: true });
    });

    it("rejects cyclic-lines with a single-element anchors tuple", () => {
        expect(
            validateEmission({
                ...validCyclicLines,
                state: {
                    ...validCyclicLines.state,
                    anchors: validCyclicLines.state.anchors.slice(0, 1),
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("2-element") });
    });

    it("rejects cyclic-lines with a non-WorldPoint anchor", () => {
        expect(
            validateEmission({
                ...validCyclicLines,
                state: {
                    ...validCyclicLines.state,
                    anchors: [
                        { time: 0, price: 0 },
                        { time: "bad", price: 0 },
                    ],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("WorldPoint") });
    });

    it("rejects cyclic-lines with an invalid lineStyle", () => {
        expect(
            validateEmission({
                ...validCyclicLines,
                state: { ...validCyclicLines.state, style: { lineStyle: "rainbow" } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("lineStyle") });
    });
});

describe("validateEmission — drawing time-cycles kind", () => {
    it("accepts a well-formed time-cycles", () => {
        expect(validateEmission(validTimeCycles)).toEqual({ ok: true });
    });

    it("rejects time-cycles with three anchors (2 expected)", () => {
        expect(
            validateEmission({
                ...validTimeCycles,
                state: {
                    ...validTimeCycles.state,
                    anchors: [...validTimeCycles.state.anchors, { time: 200, price: 50 }],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("2-element") });
    });

    it("rejects time-cycles with a non-numeric color", () => {
        expect(
            validateEmission({
                ...validTimeCycles,
                state: { ...validTimeCycles.state, style: { color: 0xff0000 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("color") });
    });
});

describe("validateEmission — drawing sine-line kind", () => {
    it("accepts a well-formed sine-line", () => {
        expect(validateEmission(validSineLine)).toEqual({ ok: true });
    });

    it("rejects sine-line with a non-array anchors field", () => {
        expect(
            validateEmission({
                ...validSineLine,
                state: { ...validSineLine.state, anchors: "not-an-array" },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("2-element") });
    });

    it("rejects sine-line with a negative lineWidth", () => {
        expect(
            validateEmission({
                ...validSineLine,
                state: { ...validSineLine.state, style: { lineWidth: -1 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("lineWidth") });
    });
});

const validGroup = {
    ...validLineDrawing,
    drawingKind: "group" as const,
    state: {
        kind: "group" as const,
        childHandleIds: ["a.chart.ts:1:1#0#0", "a.chart.ts:1:1#1#0"],
    },
};

const validFrame = {
    ...validLineDrawing,
    drawingKind: "frame" as const,
    state: {
        kind: "frame" as const,
        anchors: [
            { time: 0, price: 0 },
            { time: 100, price: 100 },
        ],
        childHandleIds: [],
        style: { label: "Idea", bgColor: "#f1f5f9" },
    },
};

const validTable = {
    ...validLineDrawing,
    drawingKind: "table" as const,
    state: {
        kind: "table" as const,
        position: "top-right",
        cells: [
            [
                { text: "Metric", bgColor: "#0f172a", textColor: "#f8fafc" },
                {
                    text: "+12.5%",
                    textColor: "#16a34a",
                    textHalign: "right",
                    textValign: "middle",
                    textSize: "large",
                },
            ],
        ],
        borderColor: "#94a3b8",
        borderWidth: 1,
        frame: { color: "#475569", width: 2 },
    },
};

describe("validateEmission — drawing group kind", () => {
    it("accepts a well-formed group", () => {
        expect(validateEmission(validGroup)).toEqual({ ok: true });
    });

    it("accepts an empty group", () => {
        expect(
            validateEmission({
                ...validGroup,
                state: { ...validGroup.state, childHandleIds: [] },
            }),
        ).toEqual({ ok: true });
    });

    it("rejects a group with a non-string entry in childHandleIds", () => {
        expect(
            validateEmission({
                ...validGroup,
                state: {
                    ...validGroup.state,
                    childHandleIds: ["ok", 42],
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("childHandleIds[1]") });
    });

    it("rejects a group with more than 100 childHandleIds", () => {
        const tooMany: ReadonlyArray<string> = Array.from({ length: 101 }, (_, i) => `h#${i}`);
        expect(
            validateEmission({
                ...validGroup,
                state: { ...validGroup.state, childHandleIds: tooMany },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("at most 100") });
    });

    it("rejects a group with a non-array childHandleIds", () => {
        expect(
            validateEmission({
                ...validGroup,
                state: { ...validGroup.state, childHandleIds: "not-an-array" },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("childHandleIds") });
    });
});

describe("validateEmission — drawing frame kind", () => {
    it("accepts a well-formed frame", () => {
        expect(validateEmission(validFrame)).toEqual({ ok: true });
    });

    it("accepts a frame with empty opts", () => {
        expect(
            validateEmission({
                ...validFrame,
                state: { ...validFrame.state, style: {} },
            }),
        ).toEqual({ ok: true });
    });

    it("rejects a frame with a 1-element anchors tuple", () => {
        expect(
            validateEmission({
                ...validFrame,
                state: {
                    ...validFrame.state,
                    anchors: validFrame.state.anchors.slice(0, 1),
                },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("2-element") });
    });

    it("rejects a frame with a non-string label", () => {
        expect(
            validateEmission({
                ...validFrame,
                state: { ...validFrame.state, style: { label: 42 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("label") });
    });

    it("rejects a frame with a non-string bgColor", () => {
        expect(
            validateEmission({
                ...validFrame,
                state: { ...validFrame.state, style: { bgColor: 0x123456 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("bgColor") });
    });

    it("rejects a frame with a non-object style", () => {
        expect(
            validateEmission({
                ...validFrame,
                state: { ...validFrame.state, style: "not-an-object" },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("plain object") });
    });

    it("rejects a frame with non-string childHandleIds entries", () => {
        expect(
            validateEmission({
                ...validFrame,
                state: { ...validFrame.state, childHandleIds: [42] },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("childHandleIds") });
    });
});

describe("validateEmission — drawing table kind", () => {
    it("accepts a well-formed table", () => {
        expect(validateEmission(validTable)).toEqual({ ok: true });
    });

    it("accepts a table without optional border and frame styles", () => {
        const {
            borderColor: _borderColor,
            borderWidth: _borderWidth,
            frame: _frame,
            ...state
        } = validTable.state;
        expect(validateEmission({ ...validTable, state })).toEqual({ ok: true });
    });

    it("rejects an invalid table position", () => {
        expect(
            validateEmission({
                ...validTable,
                state: { ...validTable.state, position: "top-middle" },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("position") });
    });

    it("rejects an empty cells array", () => {
        expect(
            validateEmission({
                ...validTable,
                state: { ...validTable.state, cells: [] },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("non-empty 2D array") });
    });

    it("rejects an empty row", () => {
        expect(
            validateEmission({
                ...validTable,
                state: { ...validTable.state, cells: [[]] },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("cells[0]") });
    });

    it("rejects a non-object cell", () => {
        expect(
            validateEmission({
                ...validTable,
                state: { ...validTable.state, cells: [[null]] },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("cells[0][0]") });
    });

    it("rejects a cell with non-string text", () => {
        expect(
            validateEmission({
                ...validTable,
                state: { ...validTable.state, cells: [[{ text: 42 }]] },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("text") });
    });

    it("rejects invalid cell alignment and size fields", () => {
        expect(
            validateEmission({
                ...validTable,
                state: { ...validTable.state, cells: [[{ text: "x", textHalign: "middle" }]] },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("textHalign") });
        expect(
            validateEmission({
                ...validTable,
                state: { ...validTable.state, cells: [[{ text: "x", textSize: "massive" }]] },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("textSize") });
    });

    it("rejects invalid cell color and vertical alignment fields", () => {
        expect(
            validateEmission({
                ...validTable,
                state: { ...validTable.state, cells: [[{ text: "x", textColor: 42 }]] },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("textColor") });
        expect(
            validateEmission({
                ...validTable,
                state: { ...validTable.state, cells: [[{ text: "x", textValign: "center" }]] },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("textValign") });
    });

    it("rejects invalid cell background colors", () => {
        expect(
            validateEmission({
                ...validTable,
                state: { ...validTable.state, cells: [[{ text: "x", bgColor: 42 }]] },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("bgColor") });
    });

    it("requires borderColor and borderWidth together", () => {
        expect(
            validateEmission({
                ...validTable,
                state: { ...validTable.state, borderWidth: undefined },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("borderColor/borderWidth") });
    });

    it("rejects non-positive border and frame widths", () => {
        expect(
            validateEmission({
                ...validTable,
                state: { ...validTable.state, borderWidth: 0 },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("borderWidth") });
        expect(
            validateEmission({
                ...validTable,
                state: { ...validTable.state, frame: { color: "#475569", width: 0 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("frame.width") });
    });

    it("rejects invalid border and frame color fields", () => {
        expect(
            validateEmission({
                ...validTable,
                state: { ...validTable.state, borderColor: "" },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("borderColor") });
        expect(
            validateEmission({
                ...validTable,
                state: { ...validTable.state, frame: null },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("frame") });
        expect(
            validateEmission({
                ...validTable,
                state: { ...validTable.state, frame: { color: "", width: 1 } },
            }),
        ).toMatchObject({ ok: false, message: expect.stringContaining("frame.color") });
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

    it("accepts every Phase-7 dep-* diagnostic code", () => {
        const depCodes = [
            "dep-error",
            "dep-cycle",
            "dep-unknown-output",
            "dep-invalid-input-override",
            "dep-dynamic",
            "dep-output-not-titled",
        ] as const;
        for (const code of depCodes) {
            expect(validateEmission({ ...validDiagnostic, code })).toEqual({ ok: true });
        }
    });
});

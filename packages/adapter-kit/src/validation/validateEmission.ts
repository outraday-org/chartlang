// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DiagnosticCode } from "../types";

/**
 * Successful validation. `e` was a well-formed Phase-1 emission and is
 * safe to forward across the structured-clone boundary.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const r: ValidationOk = { ok: true };
 */
export type ValidationOk = { readonly ok: true };

/**
 * Failed validation. `code` is `"malformed-emission"` for shape errors
 * and `"unsupported-drawing-kind"` for the Phase-1 drawing stub.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const r: ValidationFail = {
 *         ok: false,
 *         code: "malformed-emission",
 *         message: "not an object",
 *     };
 */
export type ValidationFail = {
    readonly ok: false;
    readonly code: DiagnosticCode;
    readonly message: string;
};

/**
 * Discriminated union returned by {@link validateEmission}.
 *
 * @since 0.1
 * @experimental
 * @example
 *     declare const r: ValidationResult;
 *     if (r.ok) {
 *         // pass through
 *     } else {
 *         console.error(r.code, r.message);
 *     }
 */
export type ValidationResult = ValidationOk | ValidationFail;

const VALID_PLOT_STYLE_KINDS: ReadonlySet<string> = new Set([
    "line",
    "step-line",
    "horizontal-line",
]);

const VALID_LINE_STYLES: ReadonlySet<string> = new Set(["solid", "dashed", "dotted"]);

const VALID_ALERT_SEVERITIES: ReadonlySet<string> = new Set(["info", "warning", "critical"]);

const VALID_ALERT_CHANNELS: ReadonlySet<string> = new Set([
    "log",
    "toast",
    "webhook",
    "email",
    "sms",
    "push",
]);

const VALID_DIAGNOSTIC_SEVERITIES: ReadonlySet<string> = new Set(["info", "warning", "error"]);

const VALID_DIAGNOSTIC_CODES: ReadonlySet<string> = new Set<DiagnosticCode>([
    "unsupported-plot-kind",
    "unsupported-drawing-kind",
    "unsupported-alert-channel",
    "unsupported-pane",
    "unsupported-interval",
    "multi-timeframe-not-supported",
    "lookback-exceeded",
    "drawing-budget-exceeded",
    "dropped-by-policy",
    "input-coercion-failed",
    "alert-rate-limited",
    "runtime-cpu-budget-exceeded",
    "runtime-memory-budget-exceeded",
    "malformed-emission",
]);

function bad(message: string, code: DiagnosticCode = "malformed-emission"): ValidationFail {
    return { ok: false, code, message };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    if (typeof v !== "object" || v === null) return false;
    const proto = Object.getPrototypeOf(v);
    return proto === Object.prototype || proto === null;
}

function isFiniteNumber(v: unknown): v is number {
    return typeof v === "number" && Number.isFinite(v);
}

function isNonNegativeInteger(v: unknown): v is number {
    return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

function isNonEmptyString(v: unknown): v is string {
    return typeof v === "string" && v.length > 0;
}

/**
 * Walk a `meta` payload and reject any non-JSON-friendly element. Per
 * PLAN §7.3 universal payload rules: forbid `Map`, `Set`, `Date`,
 * `RegExp`, `bigint`, `Function`, `Symbol`, `undefined`, class
 * instances, and non-finite numbers anywhere in the tree.
 */
function walkMeta(v: unknown, path: string): ValidationResult {
    if (v === null) return { ok: true };
    const t = typeof v;
    if (t === "boolean" || t === "string") return { ok: true };
    if (t === "number") {
        if (!Number.isFinite(v as number)) {
            return bad(`${path}: non-finite number`);
        }
        return { ok: true };
    }
    if (t === "undefined") return bad(`${path}: undefined values are forbidden`);
    if (t === "bigint") return bad(`${path}: bigint is forbidden`);
    if (t === "function") return bad(`${path}: function is forbidden`);
    if (t === "symbol") return bad(`${path}: symbol is forbidden`);
    // typeof === "object" from here.
    if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i++) {
            const r = walkMeta(v[i], `${path}[${i}]`);
            if (!r.ok) return r;
        }
        return { ok: true };
    }
    if (!isPlainObject(v)) {
        return bad(`${path}: only plain objects are allowed`);
    }
    for (const key of Object.keys(v)) {
        // Use `Reflect.get` and a try/catch so a throwing-getter on the
        // meta payload (constructed via `Object.defineProperty(..., {
        // get() { throw … }})` either deliberately or by accident at a
        // serialisation boundary) converts to a `malformed-emission`
        // diagnostic instead of crashing the host.
        let child: unknown;
        try {
            child = Reflect.get(v, key);
        } catch {
            return bad(`${path}.${key}: getter threw during traversal`);
        }
        const r = walkMeta(child, `${path}.${key}`);
        if (!r.ok) return r;
    }
    return { ok: true };
}

function validatePlotStyle(style: unknown): ValidationResult {
    if (!isPlainObject(style)) return bad("style: not an object");
    const kind = style.kind;
    if (typeof kind !== "string" || !VALID_PLOT_STYLE_KINDS.has(kind)) {
        return bad(`style.kind: '${String(kind)}' is not a Phase-1 plot kind`);
    }
    const lineWidth = style.lineWidth;
    if (!isFiniteNumber(lineWidth) || lineWidth <= 0) {
        return bad("style.lineWidth: must be a finite positive number");
    }
    const lineStyle = style.lineStyle;
    if (typeof lineStyle !== "string" || !VALID_LINE_STYLES.has(lineStyle)) {
        return bad(`style.lineStyle: '${String(lineStyle)}' is not a valid line style`);
    }
    return { ok: true };
}

function validatePlotEmission(e: Record<string, unknown>): ValidationResult {
    if (!isNonEmptyString(e.slotId)) return bad("plot.slotId: must be a non-empty string");
    if (typeof e.title !== "string") return bad("plot.title: must be a string");
    const styleResult = validatePlotStyle(e.style);
    if (!styleResult.ok) return styleResult;
    if (!isNonNegativeInteger(e.bar)) {
        return bad("plot.bar: must be a non-negative integer");
    }
    if (!isFiniteNumber(e.time)) return bad("plot.time: must be a finite number");
    const value = e.value;
    if (value !== null && !isFiniteNumber(value)) {
        return bad("plot.value: must be a finite number or null");
    }
    const color = e.color;
    if (color !== null && typeof color !== "string") {
        return bad("plot.color: must be a string or null");
    }
    if (!isPlainObject(e.meta)) return bad("plot.meta: must be a plain object");
    const metaResult = walkMeta(e.meta, "plot.meta");
    if (!metaResult.ok) return metaResult;
    if (typeof e.pane !== "string") return bad("plot.pane: must be a string");
    return { ok: true };
}

function validateAlertEmission(e: Record<string, unknown>): ValidationResult {
    if (!isNonEmptyString(e.slotId)) return bad("alert.slotId: must be a non-empty string");
    const severity = e.severity;
    if (typeof severity !== "string" || !VALID_ALERT_SEVERITIES.has(severity)) {
        return bad(`alert.severity: '${String(severity)}' is not a valid severity`);
    }
    if (!isNonEmptyString(e.message)) {
        return bad("alert.message: must be a non-empty string");
    }
    if (!isNonNegativeInteger(e.bar)) {
        return bad("alert.bar: must be a non-negative integer");
    }
    if (!isFiniteNumber(e.time)) return bad("alert.time: must be a finite number");
    if (!isPlainObject(e.meta)) return bad("alert.meta: must be a plain object");
    const metaResult = walkMeta(e.meta, "alert.meta");
    if (!metaResult.ok) return metaResult;
    const channels = e.channels;
    if (!Array.isArray(channels)) return bad("alert.channels: must be an array");
    for (let i = 0; i < channels.length; i++) {
        const c = channels[i];
        if (typeof c !== "string" || !VALID_ALERT_CHANNELS.has(c)) {
            return bad(`alert.channels[${i}]: '${String(c)}' is not a valid alert channel`);
        }
    }
    if (!isNonEmptyString(e.dedupeKey)) {
        return bad("alert.dedupeKey: must be a non-empty string");
    }
    return { ok: true };
}

function validateDrawingEmission(_e: Record<string, unknown>): ValidationResult {
    return {
        ok: false,
        code: "unsupported-drawing-kind",
        message: "drawing emissions are not supported in Phase 1",
    };
}

function validateDiagnostic(e: Record<string, unknown>): ValidationResult {
    const severity = e.severity;
    if (typeof severity !== "string" || !VALID_DIAGNOSTIC_SEVERITIES.has(severity)) {
        return bad(`diagnostic.severity: '${String(severity)}' is not a valid severity`);
    }
    const code = e.code;
    if (typeof code !== "string" || !VALID_DIAGNOSTIC_CODES.has(code)) {
        return bad(`diagnostic.code: '${String(code)}' is not a known DiagnosticCode`);
    }
    if (typeof e.message !== "string") return bad("diagnostic.message: must be a string");
    const slotId = e.slotId;
    if (slotId !== null && typeof slotId !== "string") {
        return bad("diagnostic.slotId: must be a string or null");
    }
    const bar = e.bar;
    if (bar !== null && !isNonNegativeInteger(bar)) {
        return bad("diagnostic.bar: must be a non-negative integer or null");
    }
    return { ok: true };
}

/**
 * Hand-rolled validator covering every Phase-1 emission shape. Returns
 * `{ ok: true }` for well-formed payloads and
 * `{ ok: false, code, message }` otherwise. Hosts and adapters call
 * this at every structured-clone boundary (Worker `postMessage`,
 * QuickJS membrane) per PLAN §7.3.
 *
 * Drawing emissions unconditionally fail with
 * `unsupported-drawing-kind` until Phase 3 ships `draw.*`.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { validateEmission } from "@invinite-org/chartlang-adapter-kit";
 *
 *     const r = validateEmission({ kind: "plot" });
 *     if (!r.ok) {
 *         console.error(r.code, r.message);
 *     }
 */
export function validateEmission(e: unknown): ValidationResult {
    if (!isPlainObject(e)) {
        return bad("emission: not a plain object");
    }
    if (!("kind" in e)) {
        return bad("emission: missing 'kind' discriminant");
    }
    const kind = e.kind;
    switch (kind) {
        case "plot":
            return validatePlotEmission(e);
        case "alert":
            return validateAlertEmission(e);
        case "drawing":
            return validateDrawingEmission(e);
        case "diagnostic":
            return validateDiagnostic(e);
        default:
            return bad(`emission.kind: '${String(kind)}' is not a known emission kind`);
    }
}

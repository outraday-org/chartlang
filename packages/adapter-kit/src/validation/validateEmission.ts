// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { DRAWING_KINDS, type DrawingKind } from "@invinite-org/chartlang-core";

import type { DiagnosticCode } from "../types.js";

/**
 * Successful validation. `e` was a well-formed Phase-1 emission and is
 * safe to forward across the structured-clone boundary.
 *
 * @since 0.1
 * @stable
 * @example
 *     const r: ValidationOk = { ok: true };
 */
export type ValidationOk = { readonly ok: true };

/**
 * Failed validation. `code` is `"malformed-emission"` for shape errors
 * and `"unsupported-drawing-kind"` for the Phase-1 drawing stub.
 *
 * @since 0.1
 * @stable
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
 * @stable
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
    "histogram",
    "bars",
    "area",
    "filled-band",
    "label",
    "marker",
    "shape",
    "character",
    "arrow",
    "candle-override",
    "bar-override",
    "bg-color",
    "bar-color",
    "horizontal-histogram",
]);

const VALID_LINE_STYLES: ReadonlySet<string> = new Set(["solid", "dashed", "dotted"]);

const VALID_MARKER_SHAPES: ReadonlySet<string> = new Set([
    "circle",
    "triangle-up",
    "triangle-down",
    "square",
    "diamond",
]);

const VALID_SHAPE_GLYPHS: ReadonlySet<string> = new Set([
    "circle",
    "triangle-up",
    "triangle-down",
    "square",
    "diamond",
    "cross",
    "xcross",
    "flag",
]);

const VALID_PLOT_LOCATIONS: ReadonlySet<string> = new Set(["above", "below", "absolute"]);

const VALID_ARROW_DIRECTIONS: ReadonlySet<string> = new Set(["up", "down"]);

const VALID_LABEL_POSITIONS: ReadonlySet<string> = new Set(["above", "below", "anchor"]);

const MAX_LABEL_LENGTH = 128;

const VALID_ALERT_SEVERITIES: ReadonlySet<string> = new Set(["info", "warning", "critical"]);

const VALID_LOG_LEVELS: ReadonlySet<string> = new Set(["info", "warn", "error"]);

const VALID_ALERT_CHANNELS: ReadonlySet<string> = new Set([
    "log",
    "toast",
    "webhook",
    "email",
    "sms",
    "push",
]);

const VALID_DIAGNOSTIC_SEVERITIES: ReadonlySet<string> = new Set(["info", "warning", "error"]);

const VALID_DRAWING_KINDS: ReadonlySet<string> = new Set<string>(DRAWING_KINDS);

const VALID_DRAWING_OPS: ReadonlySet<string> = new Set(["create", "update", "remove"]);

const VALID_DIAGNOSTIC_CODES: ReadonlySet<string> = new Set<DiagnosticCode>([
    "unsupported-plot-kind",
    "unsupported-drawing-kind",
    "unsupported-alert-channel",
    "unsupported-pane",
    "unsupported-interval",
    "multi-timeframe-not-supported",
    "unknown-secondary-stream",
    "lookback-exceeded",
    "drawing-budget-exceeded",
    "dropped-by-policy",
    "input-coercion-failed",
    "alert-conditions-not-supported",
    "unknown-alert-condition",
    "alert-rate-limited",
    "runtime-cpu-budget-exceeded",
    "runtime-memory-budget-exceeded",
    "runtime-log-budget-exceeded",
    "malformed-log-meta",
    "runtime-error-thrown",
    "session-info-missing",
    "fixed-range-inverted",
    "state-snapshot-restored",
    "state-snapshot-future-dated",
    "state-snapshot-malformed",
    "state-snapshot-save-failed",
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

function validateLineLikeStyle(style: Record<string, unknown>): ValidationResult {
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

function validateAreaStyle(style: Record<string, unknown>): ValidationResult {
    const lineCheck = validateLineLikeStyle(style);
    if (!lineCheck.ok) return lineCheck;
    const fillAlpha = style.fillAlpha;
    if (!isFiniteNumber(fillAlpha) || fillAlpha < 0 || fillAlpha > 1) {
        return bad("style.fillAlpha: must be a finite number in [0, 1]");
    }
    return { ok: true };
}

function validateHistogramOrBarsStyle(style: Record<string, unknown>): ValidationResult {
    const baseline = style.baseline;
    if (!isFiniteNumber(baseline)) {
        return bad("style.baseline: must be a finite number");
    }
    return { ok: true };
}

function validateFilledBandStyle(style: Record<string, unknown>): ValidationResult {
    const upper = style.upper;
    if (upper !== null && !isFiniteNumber(upper)) {
        return bad("style.upper: must be a finite number or null");
    }
    const lower = style.lower;
    if (lower !== null && !isFiniteNumber(lower)) {
        return bad("style.lower: must be a finite number or null");
    }
    if (upper === null && lower === null) {
        return bad("style.upper / style.lower: at least one bound must be non-null");
    }
    const alpha = style.alpha;
    if (!isFiniteNumber(alpha) || alpha < 0 || alpha > 1) {
        return bad("style.alpha: must be a finite number in [0, 1]");
    }
    return { ok: true };
}

function validateLabelStyle(style: Record<string, unknown>): ValidationResult {
    const text = style.text;
    if (typeof text !== "string" || text.length === 0) {
        return bad("style.text: must be a non-empty string");
    }
    if (text.length > MAX_LABEL_LENGTH) {
        return bad(`style.text: must be at most ${MAX_LABEL_LENGTH} characters`);
    }
    const position = style.position;
    if (typeof position !== "string" || !VALID_LABEL_POSITIONS.has(position)) {
        return bad(`style.position: '${String(position)}' is not a valid label position`);
    }
    return { ok: true };
}

function validateMarkerStyle(style: Record<string, unknown>): ValidationResult {
    const shape = style.shape;
    if (typeof shape !== "string" || !VALID_MARKER_SHAPES.has(shape)) {
        return bad(`style.shape: '${String(shape)}' is not a valid marker shape`);
    }
    const size = style.size;
    if (!isFiniteNumber(size) || size <= 0) {
        return bad("style.size: must be a finite positive number");
    }
    return { ok: true };
}

function validateOptionalLocation(style: Record<string, unknown>): ValidationResult {
    const location = style.location;
    if (
        location !== undefined &&
        (typeof location !== "string" || !VALID_PLOT_LOCATIONS.has(location))
    ) {
        return bad(`style.location: '${String(location)}' is not a valid plot location`);
    }
    return { ok: true };
}

function validatePlotShapeStyle(style: Record<string, unknown>): ValidationResult {
    const shape = style.shape;
    if (typeof shape !== "string" || !VALID_SHAPE_GLYPHS.has(shape)) {
        return bad(`style.shape: '${String(shape)}' is not a valid shape glyph`);
    }
    const size = style.size;
    if (!isFiniteNumber(size) || size <= 0) {
        return bad("style.size: must be a finite positive number");
    }
    return validateOptionalLocation(style);
}

function validateCharacterStyle(style: Record<string, unknown>): ValidationResult {
    const char = style.char;
    if (typeof char !== "string" || char.length === 0) {
        return bad("style.char: must be a non-empty string");
    }
    const size = style.size;
    if (!isFiniteNumber(size) || size <= 0) {
        return bad("style.size: must be a finite positive number");
    }
    return validateOptionalLocation(style);
}

function validateArrowStyle(style: Record<string, unknown>): ValidationResult {
    const direction = style.direction;
    if (typeof direction !== "string" || !VALID_ARROW_DIRECTIONS.has(direction)) {
        return bad(`style.direction: '${String(direction)}' is not a valid arrow direction`);
    }
    const size = style.size;
    if (!isFiniteNumber(size) || size <= 0) {
        return bad("style.size: must be a finite positive number");
    }
    return { ok: true };
}

function validateColor(value: unknown, path: string): ValidationResult {
    if (typeof value !== "string" || value.length === 0) {
        return bad(`${path}: must be a non-empty string`);
    }
    return { ok: true };
}

function validateCandleOverrideStyle(style: Record<string, unknown>): ValidationResult {
    const bull = validateColor(style.bull, "style.bull");
    if (!bull.ok) return bull;
    const bear = validateColor(style.bear, "style.bear");
    if (!bear.ok) return bear;
    if (style.doji !== undefined) {
        return validateColor(style.doji, "style.doji");
    }
    return { ok: true };
}

function validateSingleColorStyle(style: Record<string, unknown>, path: string): ValidationResult {
    return validateColor(style.color, path);
}

function validateBgColorStyle(style: Record<string, unknown>): ValidationResult {
    const color = validateSingleColorStyle(style, "style.color");
    if (!color.ok) return color;
    const transp = style.transp;
    if (transp !== undefined && (!isFiniteNumber(transp) || transp < 0 || transp > 100)) {
        return bad("style.transp: must be a finite number in [0, 100]");
    }
    return { ok: true };
}

function validateHorizontalHistogramStyle(style: Record<string, unknown>): ValidationResult {
    const buckets = style.buckets;
    if (!Array.isArray(buckets)) {
        return bad("style.buckets: must be an array");
    }
    for (let i = 0; i < buckets.length; i++) {
        const bucket = buckets[i];
        if (!isPlainObject(bucket)) {
            return bad(`style.buckets[${i}]: must be an object`);
        }
        if (!isFiniteNumber(bucket.price)) {
            return bad(`style.buckets[${i}].price: must be a finite number`);
        }
        if (!isFiniteNumber(bucket.volume) || bucket.volume < 0) {
            return bad(`style.buckets[${i}].volume: must be a finite non-negative number`);
        }
        if (bucket.color !== undefined) {
            const color = validateColor(bucket.color, `style.buckets[${i}].color`);
            if (!color.ok) return color;
        }
    }
    return { ok: true };
}

function validatePlotStyle(style: unknown): ValidationResult {
    if (!isPlainObject(style)) return bad("style: not an object");
    const kind = style.kind;
    if (typeof kind !== "string" || !VALID_PLOT_STYLE_KINDS.has(kind)) {
        return bad(`style.kind: '${String(kind)}' is not a known plot kind`);
    }
    switch (kind) {
        case "line":
        case "step-line":
        case "horizontal-line":
            return validateLineLikeStyle(style);
        case "histogram":
        case "bars":
            return validateHistogramOrBarsStyle(style);
        case "area":
            return validateAreaStyle(style);
        case "filled-band":
            return validateFilledBandStyle(style);
        case "label":
            return validateLabelStyle(style);
        case "marker":
            return validateMarkerStyle(style);
        case "shape":
            return validatePlotShapeStyle(style);
        case "character":
            return validateCharacterStyle(style);
        case "arrow":
            return validateArrowStyle(style);
        case "candle-override":
            return validateCandleOverrideStyle(style);
        case "bar-override":
        case "bar-color":
            return validateSingleColorStyle(style, "style.color");
        case "bg-color":
            return validateBgColorStyle(style);
        case "horizontal-histogram":
            return validateHorizontalHistogramStyle(style);
        /* v8 ignore next 2 -- kind is already gated by VALID_PLOT_STYLE_KINDS */
        default:
            return bad(`style.kind: '${kind}' has no validator`);
    }
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

function validateAlertConditionEmission(e: Record<string, unknown>): ValidationResult {
    if (!isNonEmptyString(e.conditionId)) {
        return bad("alert-condition.conditionId: must be a non-empty string");
    }
    if (typeof e.title !== "string") {
        return bad("alert-condition.title: must be a string");
    }
    if (typeof e.description !== "string") {
        return bad("alert-condition.description: must be a string");
    }
    if (typeof e.defaultMessage !== "string") {
        return bad("alert-condition.defaultMessage: must be a string");
    }
    if (typeof e.fired !== "boolean") {
        return bad("alert-condition.fired: must be a boolean");
    }
    if (!isNonNegativeInteger(e.bar)) {
        return bad("alert-condition.bar: must be a non-negative integer");
    }
    if (!isFiniteNumber(e.time)) {
        return bad("alert-condition.time: must be a finite number");
    }
    return { ok: true };
}

function validateLogEmission(e: Record<string, unknown>): ValidationResult {
    const level = e.level;
    if (typeof level !== "string" || !VALID_LOG_LEVELS.has(level)) {
        return bad(`log.level: '${String(level)}' is not a valid log level`);
    }
    if (!isNonEmptyString(e.message)) {
        return bad("log.message: must be a non-empty string");
    }
    const meta = e.meta;
    if (meta !== undefined) {
        if (!isPlainObject(meta)) return bad("log.meta: must be a plain object");
        const metaResult = walkMeta(meta, "log.meta");
        if (!metaResult.ok) return metaResult;
    }
    if (!isNonNegativeInteger(e.bar)) {
        return bad("log.bar: must be a non-negative integer");
    }
    if (!isFiniteNumber(e.time)) {
        return bad("log.time: must be a finite number");
    }
    return { ok: true };
}

function isWorldPoint(v: unknown): v is { time: number; price: number } {
    if (!isPlainObject(v)) return false;
    return isFiniteNumber(v.time) && isFiniteNumber(v.price);
}

function validateAnchorFixed(v: unknown, path: string, count: number): ValidationResult {
    if (!Array.isArray(v) || v.length !== count) {
        return bad(`${path}: must be a ${count}-element WorldPoint tuple`);
    }
    for (let i = 0; i < count; i++) {
        if (!isWorldPoint(v[i])) {
            return bad(`${path}[${i}]: not a WorldPoint (need finite time + price)`);
        }
    }
    return { ok: true };
}

function validateAnchorPair(v: unknown, path: string): ValidationResult {
    return validateAnchorFixed(v, path, 2);
}

function validateAnchorTriple(v: unknown, path: string): ValidationResult {
    return validateAnchorFixed(v, path, 3);
}

function validateAnchorQuad(v: unknown, path: string): ValidationResult {
    return validateAnchorFixed(v, path, 4);
}

function validateAnchorQuint(v: unknown, path: string): ValidationResult {
    return validateAnchorFixed(v, path, 5);
}

function validateAnchorHept(v: unknown, path: string): ValidationResult {
    return validateAnchorFixed(v, path, 7);
}

function validateOptionalLabels(v: unknown, path: string, expectedCount: number): ValidationResult {
    if (v === undefined) return { ok: true };
    if (!Array.isArray(v) || v.length !== expectedCount) {
        return bad(`${path}: must be an array of ${expectedCount} strings`);
    }
    for (let i = 0; i < expectedCount; i++) {
        if (typeof v[i] !== "string") {
            return bad(`${path}[${i}]: must be a string`);
        }
    }
    return { ok: true };
}

function validateAnchorVariable(
    v: unknown,
    path: string,
    min: number,
    max: number,
): ValidationResult {
    if (!Array.isArray(v) || v.length < min || v.length > max) {
        return bad(`${path}: must be an array of ${min}..${max} WorldPoints`);
    }
    for (let i = 0; i < v.length; i++) {
        if (!isWorldPoint(v[i])) {
            return bad(`${path}[${i}]: not a WorldPoint (need finite time + price)`);
        }
    }
    return { ok: true };
}

function validateLineDrawStyle(s: unknown, path: string): ValidationResult {
    if (!isPlainObject(s)) return bad(`${path}: must be a plain object`);
    if (s.color !== undefined && typeof s.color !== "string") {
        return bad(`${path}.color: must be a string`);
    }
    if (s.lineWidth !== undefined && (!isFiniteNumber(s.lineWidth) || s.lineWidth <= 0)) {
        return bad(`${path}.lineWidth: must be a finite positive number`);
    }
    if (s.lineStyle !== undefined && !VALID_LINE_STYLES.has(String(s.lineStyle))) {
        return bad(`${path}.lineStyle: '${String(s.lineStyle)}' is not a valid line style`);
    }
    if (s.extendLeft !== undefined && typeof s.extendLeft !== "boolean") {
        return bad(`${path}.extendLeft: must be a boolean`);
    }
    if (s.extendRight !== undefined && typeof s.extendRight !== "boolean") {
        return bad(`${path}.extendRight: must be a boolean`);
    }
    return { ok: true };
}

function validateShapeStyle(s: unknown, path: string): ValidationResult {
    if (!isPlainObject(s)) return bad(`${path}: must be a plain object`);
    if (s.stroke !== undefined && typeof s.stroke !== "string") {
        return bad(`${path}.stroke: must be a string`);
    }
    if (s.fill !== undefined && typeof s.fill !== "string") {
        return bad(`${path}.fill: must be a string`);
    }
    if (s.lineWidth !== undefined && (!isFiniteNumber(s.lineWidth) || s.lineWidth <= 0)) {
        return bad(`${path}.lineWidth: must be a finite positive number`);
    }
    if (s.lineStyle !== undefined && !VALID_LINE_STYLES.has(String(s.lineStyle))) {
        return bad(`${path}.lineStyle: '${String(s.lineStyle)}' is not a valid line style`);
    }
    if (
        s.fillAlpha !== undefined &&
        (!isFiniteNumber(s.fillAlpha) || s.fillAlpha < 0 || s.fillAlpha > 1)
    ) {
        return bad(`${path}.fillAlpha: must be a finite number in [0, 1]`);
    }
    return { ok: true };
}

function validateDrawingMeta(state: Record<string, unknown>): ValidationResult {
    if (state.name !== undefined && typeof state.name !== "string") {
        return bad("drawing.state.name: must be a string");
    }
    if (state.visible !== undefined && typeof state.visible !== "boolean") {
        return bad("drawing.state.visible: must be a boolean");
    }
    return { ok: true };
}

function validateLineState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorPair(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

function validateHorizontalLineState(state: Record<string, unknown>): ValidationResult {
    if (!isFiniteNumber(state.price)) return bad("drawing.state.price: must be a finite number");
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

function validateHorizontalRayState(state: Record<string, unknown>): ValidationResult {
    if (!isWorldPoint(state.anchor)) return bad("drawing.state.anchor: not a WorldPoint");
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

function validateVerticalLineState(state: Record<string, unknown>): ValidationResult {
    if (!isFiniteNumber(state.time)) return bad("drawing.state.time: must be a finite number");
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

function validateCrossLineState(state: Record<string, unknown>): ValidationResult {
    if (!isWorldPoint(state.anchor)) return bad("drawing.state.anchor: not a WorldPoint");
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

function validateTrendAngleState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorPair(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

function validateRectangleState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorPair(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateShapeStyle(state.style, "drawing.state.style");
}

function validateRotatedRectangleState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorQuad(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateShapeStyle(state.style, "drawing.state.style");
}

function validateTriangleState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorTriple(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateShapeStyle(state.style, "drawing.state.style");
}

const POLYLINE_MIN_ANCHORS = 3;
const POLYLINE_MAX_ANCHORS = 20;

function validatePolylineState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorVariable(
        state.anchors,
        "drawing.state.anchors",
        POLYLINE_MIN_ANCHORS,
        POLYLINE_MAX_ANCHORS,
    );
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

function validateCircleState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorPair(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateShapeStyle(state.style, "drawing.state.style");
}

function validateEllipseState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorPair(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateShapeStyle(state.style, "drawing.state.style");
}

function validatePathOpts(s: unknown, path: string): ValidationResult {
    const lineCheck = validateLineDrawStyle(s, path);
    if (!lineCheck.ok) return lineCheck;
    // validateLineDrawStyle proved `s` is a plain object.
    const obj = s as Record<string, unknown>;
    if (obj.closed !== undefined && typeof obj.closed !== "boolean") {
        return bad(`${path}.closed: must be a boolean`);
    }
    return { ok: true };
}

const PATH_MIN_ANCHORS = 2;
const PATH_MAX_ANCHORS = 20;

function validatePathState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorVariable(
        state.anchors,
        "drawing.state.anchors",
        PATH_MIN_ANCHORS,
        PATH_MAX_ANCHORS,
    );
    if (!anchorsCheck.ok) return anchorsCheck;
    return validatePathOpts(state.style, "drawing.state.style");
}

const VALID_TEXT_SIZES: ReadonlySet<string> = new Set(["tiny", "small", "normal", "large", "huge"]);

const VALID_TEXT_HALIGN: ReadonlySet<string> = new Set(["left", "center", "right"]);

const VALID_TEXT_VALIGN: ReadonlySet<string> = new Set(["top", "middle", "bottom"]);

const VALID_TABLE_POSITIONS: ReadonlySet<string> = new Set([
    "top-left",
    "top-center",
    "top-right",
    "middle-left",
    "middle-center",
    "middle-right",
    "bottom-left",
    "bottom-center",
    "bottom-right",
]);

function validateTextOpts(s: unknown, path: string): ValidationResult {
    if (!isPlainObject(s)) return bad(`${path}: must be a plain object`);
    if (s.color !== undefined && typeof s.color !== "string") {
        return bad(`${path}.color: must be a string`);
    }
    if (s.size !== undefined && !VALID_TEXT_SIZES.has(String(s.size))) {
        return bad(`${path}.size: '${String(s.size)}' is not a valid text size`);
    }
    if (s.halign !== undefined && !VALID_TEXT_HALIGN.has(String(s.halign))) {
        return bad(`${path}.halign: '${String(s.halign)}' is not a valid halign`);
    }
    if (s.valign !== undefined && !VALID_TEXT_VALIGN.has(String(s.valign))) {
        return bad(`${path}.valign: '${String(s.valign)}' is not a valid valign`);
    }
    if (s.bgColor !== undefined && typeof s.bgColor !== "string") {
        return bad(`${path}.bgColor: must be a string`);
    }
    return { ok: true };
}

function validateMarkerState(state: Record<string, unknown>): ValidationResult {
    if (!isWorldPoint(state.anchor)) return bad("drawing.state.anchor: not a WorldPoint");
    if (state.text !== undefined && typeof state.text !== "string") {
        return bad("drawing.state.text: must be a string");
    }
    if (state.value !== undefined && !isFiniteNumber(state.value)) {
        return bad("drawing.state.value: must be a finite number");
    }
    return validateTextOpts(state.style, "drawing.state.style");
}

const FREEHAND_MIN_ANCHORS = 2;
const FREEHAND_MAX_ANCHORS = 500;

function validateHighlighterStyle(s: unknown, path: string): ValidationResult {
    if (!isPlainObject(s)) return bad(`${path}: must be a plain object`);
    if (typeof s.color !== "string") return bad(`${path}.color: must be a string`);
    if (!isFiniteNumber(s.alpha) || s.alpha < 0 || s.alpha > 1) {
        return bad(`${path}.alpha: must be a finite number in [0, 1]`);
    }
    return { ok: true };
}

function validateBrushStyle(s: unknown, path: string): ValidationResult {
    if (!isPlainObject(s)) return bad(`${path}: must be a plain object`);
    if (typeof s.stroke !== "string") return bad(`${path}.stroke: must be a string`);
    if (typeof s.fill !== "string") return bad(`${path}.fill: must be a string`);
    return { ok: true };
}

function validateArcState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorTriple(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

function validateCurveState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorTriple(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

function validateDoubleCurveState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorQuint(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

function validatePenState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorVariable(
        state.anchors,
        "drawing.state.anchors",
        FREEHAND_MIN_ANCHORS,
        FREEHAND_MAX_ANCHORS,
    );
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

function validateHighlighterState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorVariable(
        state.anchors,
        "drawing.state.anchors",
        FREEHAND_MIN_ANCHORS,
        FREEHAND_MAX_ANCHORS,
    );
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateHighlighterStyle(state.style, "drawing.state.style");
}

function validateBrushState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorVariable(
        state.anchors,
        "drawing.state.anchors",
        FREEHAND_MIN_ANCHORS,
        FREEHAND_MAX_ANCHORS,
    );
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateBrushStyle(state.style, "drawing.state.style");
}

const TEXT_BODY_MAX_LENGTH = 256;

function validateArrowOpts(s: unknown, path: string): ValidationResult {
    const lineCheck = validateLineDrawStyle(s, path);
    if (!lineCheck.ok) return lineCheck;
    // validateLineDrawStyle proved `s` is a plain object.
    const obj = s as Record<string, unknown>;
    if (obj.label !== undefined && typeof obj.label !== "string") {
        return bad(`${path}.label: must be a string`);
    }
    return { ok: true };
}

function validateArrowMarkerOpts(s: unknown, path: string): ValidationResult {
    if (!isPlainObject(s)) return bad(`${path}: must be a plain object`);
    if (s.color !== undefined && typeof s.color !== "string") {
        return bad(`${path}.color: must be a string`);
    }
    if (s.text !== undefined && typeof s.text !== "string") {
        return bad(`${path}.text: must be a string`);
    }
    return { ok: true };
}

function validateTextState(state: Record<string, unknown>): ValidationResult {
    if (!isWorldPoint(state.anchor)) return bad("drawing.state.anchor: not a WorldPoint");
    // walkMeta catches non-JsonValue payloads (bigint / function / symbol /
    // undefined / non-finite number) anywhere on `body`; a bare string is
    // a valid JsonValue and passes through. The kind-specific
    // non-empty / length cap follows so the wire-shape error message stays
    // specific.
    const bodyMetaCheck = walkMeta(state.body, "drawing.state.body");
    if (!bodyMetaCheck.ok) return bodyMetaCheck;
    if (typeof state.body !== "string") {
        return bad("drawing.state.body: must be a string");
    }
    if (state.body.length === 0) {
        return bad("drawing.state.body: must be a non-empty string");
    }
    if (state.body.length > TEXT_BODY_MAX_LENGTH) {
        return bad(`drawing.state.body: must be at most ${TEXT_BODY_MAX_LENGTH} characters`);
    }
    return validateTextOpts(state.style, "drawing.state.style");
}

function validateArrowState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorPair(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateArrowOpts(state.style, "drawing.state.style");
}

function validateArrowMarkerState(state: Record<string, unknown>): ValidationResult {
    if (!isWorldPoint(state.anchor)) return bad("drawing.state.anchor: not a WorldPoint");
    return validateArrowMarkerOpts(state.style, "drawing.state.style");
}

function validateArrowMarkUpState(state: Record<string, unknown>): ValidationResult {
    if (!isWorldPoint(state.anchor)) return bad("drawing.state.anchor: not a WorldPoint");
    return validateArrowMarkerOpts(state.style, "drawing.state.style");
}

function validateArrowMarkDownState(state: Record<string, unknown>): ValidationResult {
    if (!isWorldPoint(state.anchor)) return bad("drawing.state.anchor: not a WorldPoint");
    return validateArrowMarkerOpts(state.style, "drawing.state.style");
}

const VALID_REGRESSION_SOURCES: ReadonlySet<string> = new Set([
    "close",
    "open",
    "high",
    "low",
    "hl2",
    "hlc3",
    "ohlc4",
    "hlcc4",
]);

function validateRegressionTrendOpts(s: unknown, path: string): ValidationResult {
    if (!isPlainObject(s)) return bad(`${path}: must be a plain object`);
    if (s.source !== undefined && !VALID_REGRESSION_SOURCES.has(String(s.source))) {
        return bad(`${path}.source: '${String(s.source)}' is not a valid source`);
    }
    if (s.stdevMultiplier !== undefined) {
        if (!isFiniteNumber(s.stdevMultiplier) || s.stdevMultiplier < 0) {
            return bad(`${path}.stdevMultiplier: must be a non-negative finite number`);
        }
    }
    if (s.showUpperBand !== undefined && typeof s.showUpperBand !== "boolean") {
        return bad(`${path}.showUpperBand: must be a boolean`);
    }
    if (s.showLowerBand !== undefined && typeof s.showLowerBand !== "boolean") {
        return bad(`${path}.showLowerBand: must be a boolean`);
    }
    if (s.color !== undefined && typeof s.color !== "string") {
        return bad(`${path}.color: must be a string`);
    }
    return { ok: true };
}

function validateTrendChannelState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorTriple(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

function validateFlatTopBottomState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorTriple(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

function validateDisjointChannelState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorQuad(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

function validateRegressionTrendState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorPair(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    const anchors = state.anchors as ReadonlyArray<{ time: number; price: number }>;
    if (!(anchors[0].time < anchors[1].time)) {
        return bad("drawing.state.anchors: anchors[0].time must be < anchors[1].time");
    }
    return validateRegressionTrendOpts(state.style, "drawing.state.style");
}

function validateFibOpts(s: unknown, path: string): ValidationResult {
    if (!isPlainObject(s)) return bad(`${path}: must be a plain object`);
    if (s.levels !== undefined) {
        if (!Array.isArray(s.levels)) {
            return bad(`${path}.levels: must be an array of finite numbers`);
        }
        if (s.levels.length === 0) {
            return bad(`${path}.levels: must contain at least one level`);
        }
        for (let i = 0; i < s.levels.length; i++) {
            if (!isFiniteNumber(s.levels[i])) {
                return bad(`${path}.levels[${i}]: must be a finite number`);
            }
        }
    }
    if (s.showLabels !== undefined && typeof s.showLabels !== "boolean") {
        return bad(`${path}.showLabels: must be a boolean`);
    }
    if (s.color !== undefined && typeof s.color !== "string") {
        return bad(`${path}.color: must be a string`);
    }
    if (s.extendLeft !== undefined && typeof s.extendLeft !== "boolean") {
        return bad(`${path}.extendLeft: must be a boolean`);
    }
    if (s.extendRight !== undefined && typeof s.extendRight !== "boolean") {
        return bad(`${path}.extendRight: must be a boolean`);
    }
    return { ok: true };
}

function validateFibRetracementState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorPair(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateFibOpts(state.style, "drawing.state.style");
}

function validateFibTrendExtensionState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorTriple(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateFibOpts(state.style, "drawing.state.style");
}

function validateFibChannelState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorTriple(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateFibOpts(state.style, "drawing.state.style");
}

function validateFibTimeZoneState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorPair(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateFibOpts(state.style, "drawing.state.style");
}

function validateFibWedgeState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorTriple(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateFibOpts(state.style, "drawing.state.style");
}

function validateFibSpeedFanState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorPair(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateFibOpts(state.style, "drawing.state.style");
}

function validateFibSpeedArcsState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorPair(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateFibOpts(state.style, "drawing.state.style");
}

function validateFibSpiralState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorPair(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateFibOpts(state.style, "drawing.state.style");
}

function validateFibCirclesState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorPair(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateFibOpts(state.style, "drawing.state.style");
}

function validateFibTrendTimeState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorTriple(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateFibOpts(state.style, "drawing.state.style");
}

function validateGannBoxState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorPair(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

function validateGannSquareFixedState(state: Record<string, unknown>): ValidationResult {
    if (!isWorldPoint(state.anchor)) return bad("drawing.state.anchor: not a WorldPoint");
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

function validateGannSquareState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorPair(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

function validateGannFanState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorPair(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

const PITCHFORK_VARIANTS: ReadonlySet<string> = new Set([
    "standard",
    "schiff",
    "modifiedSchiff",
    "inside",
]);

function validatePitchforkState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorTriple(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    if (typeof state.variant !== "string" || !PITCHFORK_VARIANTS.has(state.variant)) {
        return bad(
            `drawing.state.variant: '${String(state.variant)}' must be 'standard' | 'schiff' | 'modifiedSchiff' | 'inside'`,
        );
    }
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

function validatePitchfanState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorTriple(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

function validateXabcdPatternState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorQuint(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

function validateCypherPatternState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorQuint(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

function validateHeadAndShouldersState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorQuint(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

function validateAbcdPatternState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorQuad(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

function validateTrianglePatternState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorTriple(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

function validateThreeDrivesPatternState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorHept(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

function validateElliottImpulseWaveState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorQuint(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    const labelsCheck = validateOptionalLabels(state.labels, "drawing.state.labels", 5);
    if (!labelsCheck.ok) return labelsCheck;
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

function validateElliottCorrectionWaveState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorTriple(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    const labelsCheck = validateOptionalLabels(state.labels, "drawing.state.labels", 3);
    if (!labelsCheck.ok) return labelsCheck;
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

function validateElliottTriangleWaveState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorQuint(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    const labelsCheck = validateOptionalLabels(state.labels, "drawing.state.labels", 5);
    if (!labelsCheck.ok) return labelsCheck;
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

function validateElliottDoubleComboState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorHept(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    const labelsCheck = validateOptionalLabels(state.labels, "drawing.state.labels", 7);
    if (!labelsCheck.ok) return labelsCheck;
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

function validateElliottTripleComboState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorHept(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    const labelsCheck = validateOptionalLabels(state.labels, "drawing.state.labels", 7);
    if (!labelsCheck.ok) return labelsCheck;
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

function validateCyclicLinesState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorPair(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

function validateTimeCyclesState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorPair(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

function validateSineLineState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorPair(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    return validateLineDrawStyle(state.style, "drawing.state.style");
}

const MAX_CHILD_HANDLE_IDS = 100;

function validateChildHandleIds(v: unknown, path: string): ValidationResult {
    if (!Array.isArray(v)) {
        return bad(`${path}: must be an array of handle id strings`);
    }
    if (v.length > MAX_CHILD_HANDLE_IDS) {
        return bad(`${path}: must be at most ${MAX_CHILD_HANDLE_IDS} entries`);
    }
    for (let i = 0; i < v.length; i++) {
        if (typeof v[i] !== "string") {
            return bad(`${path}[${i}]: must be a string`);
        }
    }
    return { ok: true };
}

function validateFrameOpts(s: unknown, path: string): ValidationResult {
    if (!isPlainObject(s)) return bad(`${path}: must be a plain object`);
    if (s.label !== undefined && typeof s.label !== "string") {
        return bad(`${path}.label: must be a string`);
    }
    if (s.bgColor !== undefined && typeof s.bgColor !== "string") {
        return bad(`${path}.bgColor: must be a string`);
    }
    return { ok: true };
}

function validateGroupState(state: Record<string, unknown>): ValidationResult {
    return validateChildHandleIds(state.childHandleIds, "drawing.state.childHandleIds");
}

function validateFrameState(state: Record<string, unknown>): ValidationResult {
    const anchorsCheck = validateAnchorPair(state.anchors, "drawing.state.anchors");
    if (!anchorsCheck.ok) return anchorsCheck;
    const childCheck = validateChildHandleIds(state.childHandleIds, "drawing.state.childHandleIds");
    if (!childCheck.ok) return childCheck;
    return validateFrameOpts(state.style, "drawing.state.style");
}

function validateTableCell(cell: unknown, path: string): ValidationResult {
    if (!isPlainObject(cell)) return bad(`${path}: must be a plain object`);
    if (typeof cell.text !== "string") return bad(`${path}.text: must be a string`);
    if (cell.bgColor !== undefined && typeof cell.bgColor !== "string") {
        return bad(`${path}.bgColor: must be a string`);
    }
    if (cell.textColor !== undefined && typeof cell.textColor !== "string") {
        return bad(`${path}.textColor: must be a string`);
    }
    if (cell.textHalign !== undefined && !VALID_TEXT_HALIGN.has(String(cell.textHalign))) {
        return bad(`${path}.textHalign: '${String(cell.textHalign)}' is not a valid halign`);
    }
    if (cell.textValign !== undefined && !VALID_TEXT_VALIGN.has(String(cell.textValign))) {
        return bad(`${path}.textValign: '${String(cell.textValign)}' is not a valid valign`);
    }
    if (cell.textSize !== undefined && !VALID_TEXT_SIZES.has(String(cell.textSize))) {
        return bad(`${path}.textSize: '${String(cell.textSize)}' is not a valid text size`);
    }
    return { ok: true };
}

function validateTableState(state: Record<string, unknown>): ValidationResult {
    const position = state.position;
    if (typeof position !== "string" || !VALID_TABLE_POSITIONS.has(position)) {
        return bad(`drawing.state.position: '${String(position)}' is not a valid table position`);
    }
    const cells = state.cells;
    if (!Array.isArray(cells) || cells.length === 0) {
        return bad("drawing.state.cells: must be a non-empty 2D array");
    }
    for (let rowIndex = 0; rowIndex < cells.length; rowIndex++) {
        const row = cells[rowIndex];
        if (!Array.isArray(row) || row.length === 0) {
            return bad(`drawing.state.cells[${rowIndex}]: must be a non-empty array`);
        }
        for (let columnIndex = 0; columnIndex < row.length; columnIndex++) {
            const cellCheck = validateTableCell(
                row[columnIndex],
                `drawing.state.cells[${rowIndex}][${columnIndex}]`,
            );
            if (!cellCheck.ok) return cellCheck;
        }
    }
    const hasBorderColor = state.borderColor !== undefined;
    const hasBorderWidth = state.borderWidth !== undefined;
    if (hasBorderColor !== hasBorderWidth) {
        return bad("drawing.state.borderColor/borderWidth: must be provided together");
    }
    if (hasBorderColor) {
        const colorCheck = validateColor(state.borderColor, "drawing.state.borderColor");
        if (!colorCheck.ok) return colorCheck;
        if (!isFiniteNumber(state.borderWidth) || state.borderWidth <= 0) {
            return bad("drawing.state.borderWidth: must be a finite positive number");
        }
    }
    if (state.frame !== undefined) {
        if (!isPlainObject(state.frame)) return bad("drawing.state.frame: must be a plain object");
        const colorCheck = validateColor(state.frame.color, "drawing.state.frame.color");
        if (!colorCheck.ok) return colorCheck;
        if (!isFiniteNumber(state.frame.width) || state.frame.width <= 0) {
            return bad("drawing.state.frame.width: must be a finite positive number");
        }
    }
    return { ok: true };
}

/**
 * Per-kind state dispatch. Exhaustive over the `DrawingKind` union: the
 * switch has no `default` arm, so adding a kind to `DrawingKind`
 * produces a compile error here and forces a matching validator arm.
 * Wire-shape checks (`handleId` / `op` / `bar` / `time` /
 * `state.kind === drawingKind`) run for every kind via
 * {@link validateDrawingEmission} before this dispatch is reached.
 */
function validateStateByKind(kind: DrawingKind, state: Record<string, unknown>): ValidationResult {
    switch (kind) {
        case "line":
            return validateLineState(state);
        case "horizontal-line":
            return validateHorizontalLineState(state);
        case "horizontal-ray":
            return validateHorizontalRayState(state);
        case "vertical-line":
            return validateVerticalLineState(state);
        case "cross-line":
            return validateCrossLineState(state);
        case "trend-angle":
            return validateTrendAngleState(state);
        case "rectangle":
            return validateRectangleState(state);
        case "rotated-rectangle":
            return validateRotatedRectangleState(state);
        case "triangle":
            return validateTriangleState(state);
        case "polyline":
            return validatePolylineState(state);
        case "circle":
            return validateCircleState(state);
        case "ellipse":
            return validateEllipseState(state);
        case "path":
            return validatePathState(state);
        case "marker":
            return validateMarkerState(state);
        case "arc":
            return validateArcState(state);
        case "curve":
            return validateCurveState(state);
        case "double-curve":
            return validateDoubleCurveState(state);
        case "pen":
            return validatePenState(state);
        case "highlighter":
            return validateHighlighterState(state);
        case "brush":
            return validateBrushState(state);
        case "text":
            return validateTextState(state);
        case "arrow":
            return validateArrowState(state);
        case "arrow-marker":
            return validateArrowMarkerState(state);
        case "arrow-mark-up":
            return validateArrowMarkUpState(state);
        case "arrow-mark-down":
            return validateArrowMarkDownState(state);
        case "trend-channel":
            return validateTrendChannelState(state);
        case "flat-top-bottom":
            return validateFlatTopBottomState(state);
        case "disjoint-channel":
            return validateDisjointChannelState(state);
        case "regression-trend":
            return validateRegressionTrendState(state);
        case "fib-retracement":
            return validateFibRetracementState(state);
        case "fib-trend-extension":
            return validateFibTrendExtensionState(state);
        case "fib-channel":
            return validateFibChannelState(state);
        case "fib-time-zone":
            return validateFibTimeZoneState(state);
        case "fib-wedge":
            return validateFibWedgeState(state);
        case "fib-speed-fan":
            return validateFibSpeedFanState(state);
        case "fib-speed-arcs":
            return validateFibSpeedArcsState(state);
        case "fib-spiral":
            return validateFibSpiralState(state);
        case "fib-circles":
            return validateFibCirclesState(state);
        case "fib-trend-time":
            return validateFibTrendTimeState(state);
        case "gann-box":
            return validateGannBoxState(state);
        case "gann-square-fixed":
            return validateGannSquareFixedState(state);
        case "gann-square":
            return validateGannSquareState(state);
        case "gann-fan":
            return validateGannFanState(state);
        case "pitchfork":
            return validatePitchforkState(state);
        case "pitchfan":
            return validatePitchfanState(state);
        case "xabcd-pattern":
            return validateXabcdPatternState(state);
        case "cypher-pattern":
            return validateCypherPatternState(state);
        case "head-and-shoulders":
            return validateHeadAndShouldersState(state);
        case "abcd-pattern":
            return validateAbcdPatternState(state);
        case "triangle-pattern":
            return validateTrianglePatternState(state);
        case "three-drives-pattern":
            return validateThreeDrivesPatternState(state);
        case "elliott-impulse-wave":
            return validateElliottImpulseWaveState(state);
        case "elliott-correction-wave":
            return validateElliottCorrectionWaveState(state);
        case "elliott-triangle-wave":
            return validateElliottTriangleWaveState(state);
        case "elliott-double-combo":
            return validateElliottDoubleComboState(state);
        case "elliott-triple-combo":
            return validateElliottTripleComboState(state);
        case "cyclic-lines":
            return validateCyclicLinesState(state);
        case "time-cycles":
            return validateTimeCyclesState(state);
        case "sine-line":
            return validateSineLineState(state);
        case "group":
            return validateGroupState(state);
        case "frame":
            return validateFrameState(state);
        case "table":
            return validateTableState(state);
    }
}

function validateDrawingEmission(e: Record<string, unknown>): ValidationResult {
    if (!isNonEmptyString(e.handleId)) {
        return bad("drawing.handleId: must be a non-empty string");
    }
    const drawingKind = e.drawingKind;
    if (typeof drawingKind !== "string" || !VALID_DRAWING_KINDS.has(drawingKind)) {
        return {
            ok: false,
            code: "unsupported-drawing-kind",
            message: `drawing.drawingKind: '${String(drawingKind)}' is not a known DrawingKind`,
        };
    }
    if (typeof e.op !== "string" || !VALID_DRAWING_OPS.has(e.op)) {
        return bad(`drawing.op: '${String(e.op)}' must be 'create' | 'update' | 'remove'`);
    }
    if (!isNonNegativeInteger(e.bar)) {
        return bad("drawing.bar: must be a non-negative integer");
    }
    if (!isFiniteNumber(e.time)) {
        return bad("drawing.time: must be a finite number");
    }
    const state = e.state;
    if (!isPlainObject(state)) {
        return bad("drawing.state: must be a plain object");
    }
    if (state.kind !== drawingKind) {
        return bad(
            `drawing.state.kind: '${String(state.kind)}' must equal drawing.drawingKind '${drawingKind}'`,
        );
    }
    const metaCheck = validateDrawingMeta(state);
    if (!metaCheck.ok) return metaCheck;
    return validateStateByKind(drawingKind as DrawingKind, state);
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
 * Hand-rolled validator covering every Phase-1 / Phase-2 / Phase-3
 * emission shape. Returns `{ ok: true }` for well-formed payloads and
 * `{ ok: false, code, message }` otherwise. Hosts and adapters call
 * this at every structured-clone boundary (Worker `postMessage`,
 * QuickJS membrane) per PLAN §7.3.
 *
 * Phase 3 widens the drawing dispatch from an unconditional Phase-1
 * stub to a per-kind validator: unknown `drawingKind` returns
 * `unsupported-drawing-kind`; malformed payloads of a known kind
 * return `malformed-emission`. Tasks 6–18 each ADD their kind
 * validators to the dispatch as ports land.
 *
 * @since 0.1
 * @stable
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
        case "alert-condition":
            return validateAlertConditionEmission(e);
        case "log":
            return validateLogEmission(e);
        case "drawing":
            return validateDrawingEmission(e);
        case "diagnostic":
            return validateDiagnostic(e);
        default:
            return bad(`emission.kind: '${String(kind)}' is not a known emission kind`);
    }
}

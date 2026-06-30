// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Color } from "../types.js";

/**
 * Wire-tagged discriminator for every `input.*` descriptor. Mirrors the
 * adapter-kit `InputKind` alias; the two live in lockstep.
 *
 * @since 0.4
 * @stable
 * @example
 *     const k: InputKind = "int";
 *     void k;
 */
export type InputKind =
    | "int"
    | "float"
    | "bool"
    | "string"
    | "enum"
    | "color"
    | "source"
    | "time"
    | "price"
    | "symbol"
    | "interval"
    | "session"
    | "external-series";

/**
 * Source-field literal for the pre-computed bar sources the runtime
 * populates per close.
 *
 * @since 0.4
 * @stable
 * @example
 *     const f: SourceField = "hlc3";
 *     void f;
 */
export type SourceField = "open" | "high" | "low" | "close" | "hl2" | "hlc3" | "ohlc4" | "hlcc4";

/**
 * Opaque v1 schema marker for `input.externalSeries`. Numeric external
 * series feeds are resolved by the runtime; richer schemas remain a
 * forward-compatible marker carried in descriptors.
 *
 * @since 0.4
 * @stable
 * @example
 *     const s: Schema<number> = { kind: "external-series-schema" };
 *     void s;
 */
export type Schema<T> = Readonly<{ kind: "external-series-schema"; __brand?: T }>;

/**
 * Host-supplied numeric values for one `input.externalSeries(...)` descriptor.
 * Values are aligned by index to the primary chart bar stream; missing, short,
 * or non-finite runtime values read as `NaN`.
 *
 * @since 1.9
 * @stable
 * @example
 *     const feed: ExternalSeriesFeed = { values: [1, 2, 3] };
 *     void feed;
 */
export type ExternalSeriesFeed = Readonly<{
    values: ReadonlyArray<number>;
}>;

/**
 * Complete external-series feed map keyed by descriptor `name`.
 * `runner.setExternalSeries(...)` replaces this whole map rather than merging
 * partial keys.
 *
 * @since 1.9
 * @stable
 * @example
 *     const feeds: ExternalSeriesFeedMap = {
 *         earnings: { values: [Number.NaN, 1, 2] },
 *     };
 *     void feeds;
 */
export type ExternalSeriesFeedMap = Readonly<Record<string, ExternalSeriesFeed>>;

type NumericInputOpts = Readonly<{ min?: number; max?: number; step?: number }>;

/**
 * Where an input's value is surfaced outside the settings panel. Mirrors
 * Pine's `display.*`; omitted means `"all"`. Presentation-only: the runtime
 * ignores it.
 *
 * @since 1.8
 * @stable
 * @example
 *     const d: InputDisplay = "data-window";
 *     void d;
 */
export type InputDisplay = "all" | "status-line" | "data-window" | "none";

/**
 * Presentation/help metadata shared by every `input.*` descriptor. All fields
 * are optional and ignored by value resolution; adapters read them to lay out
 * a settings panel.
 *
 * @since 1.8
 * @stable
 * @example
 *     const m: CommonInputOpts = { group: "Trend", inline: "row1", tooltip: "Help" };
 *     void m;
 */
export type CommonInputOpts = Readonly<{
    group?: string;
    inline?: string;
    tooltip?: string;
    display?: InputDisplay;
    confirm?: boolean;
}>;

/**
 * Typed input descriptor returned by every `input.*` builder. The `kind`
 * discriminator matches {@link InputKind}; remaining fields carry defaults
 * and UI hints.
 *
 * @since 0.4
 * @stable
 * @example
 *     const d: InputDescriptor<number> = {
 *         kind: "int",
 *         defaultValue: 14,
 *         title: "Length",
 *     };
 *     void d;
 */
export type InputDescriptor<T> =
    | IntDescriptor
    | FloatDescriptor
    | BoolDescriptor
    | StringDescriptor
    | EnumDescriptor<string | number>
    | ColorDescriptor
    | SourceDescriptor
    | TimeDescriptor
    | PriceDescriptor
    | SymbolDescriptor
    | IntervalDescriptorInput
    | SessionDescriptor
    | ExternalSeriesDescriptor<T>;

type Common<K extends InputKind, T> = Readonly<{
    kind: K;
    defaultValue: T;
    title?: string;
}> &
    CommonInputOpts;

/**
 * Descriptor for `input.int(...)`.
 *
 * @since 0.4
 * @stable
 * @example
 *     const d: IntDescriptor = { kind: "int", defaultValue: 20, min: 1 };
 *     void d;
 */
export type IntDescriptor = Common<"int", number> & NumericInputOpts;

/**
 * Descriptor for `input.float(...)`.
 *
 * @since 0.4
 * @stable
 * @example
 *     const d: FloatDescriptor = { kind: "float", defaultValue: 2.5, step: 0.5 };
 *     void d;
 */
export type FloatDescriptor = Common<"float", number> & NumericInputOpts;

/**
 * Descriptor for `input.bool(...)`.
 *
 * @since 0.4
 * @stable
 * @example
 *     const d: BoolDescriptor = { kind: "bool", defaultValue: true };
 *     void d;
 */
export type BoolDescriptor = Common<"bool", boolean>;

/**
 * Descriptor for `input.string(...)`.
 *
 * @since 0.4
 * @stable
 * @example
 *     const d: StringDescriptor = { kind: "string", defaultValue: "AAPL" };
 *     void d;
 */
export type StringDescriptor = Common<"string", string> & Readonly<{ multiline?: boolean }>;

/**
 * Descriptor for `input.enum(...)`. The member type is `string | number`:
 * a string enum models a labelled dropdown, a numeric enum a fixed set of
 * lengths/levels.
 *
 * @since 0.4 — numeric (`number`) members added in 1.6
 * @stable
 * @example
 *     const d: EnumDescriptor<"a" | "b"> = {
 *         kind: "enum",
 *         defaultValue: "a",
 *         options: ["a", "b"],
 *     };
 *     const n: EnumDescriptor<8 | 21 | 30> = {
 *         kind: "enum",
 *         defaultValue: 21,
 *         options: [8, 21, 30],
 *     };
 *     void d;
 *     void n;
 */
export type EnumDescriptor<T extends string | number> = Common<"enum", T> &
    Readonly<{ options: ReadonlyArray<T> }>;

/**
 * Descriptor for `input.color(...)`.
 *
 * @since 0.4
 * @stable
 * @example
 *     const d: ColorDescriptor = { kind: "color", defaultValue: "#26a69a" };
 *     void d;
 */
export type ColorDescriptor = Common<"color", Color>;

/**
 * Descriptor for `input.source(...)`.
 *
 * @since 0.4
 * @stable
 * @example
 *     const d: SourceDescriptor = { kind: "source", defaultValue: "close" };
 *     void d;
 */
export type SourceDescriptor = Common<"source", SourceField>;

/**
 * Descriptor for `input.time(...)`.
 *
 * @since 0.4
 * @stable
 * @example
 *     const d: TimeDescriptor = { kind: "time", defaultValue: 1_700_000_000_000 };
 *     void d;
 */
export type TimeDescriptor = Common<"time", number> & Readonly<{ pickFromChart?: boolean }>;

/**
 * Descriptor for `input.price(...)`.
 *
 * @since 0.4
 * @stable
 * @example
 *     const d: PriceDescriptor = { kind: "price", defaultValue: 101.25 };
 *     void d;
 */
export type PriceDescriptor = Common<"price", number>;

/**
 * Descriptor for `input.symbol(...)`.
 *
 * @since 0.4
 * @stable
 * @example
 *     const d: SymbolDescriptor = { kind: "symbol", defaultValue: "AAPL" };
 *     void d;
 */
export type SymbolDescriptor = Common<"symbol", string>;

/**
 * Descriptor for `input.interval(...)`.
 *
 * @since 0.4
 * @stable
 * @example
 *     const d: IntervalDescriptorInput = { kind: "interval", defaultValue: "1D" };
 *     void d;
 */
export type IntervalDescriptorInput = Common<"interval", string>;

/**
 * Descriptor for `input.session(...)`. The value is an `"HH:MM-HH:MM"`
 * (or `"HHMM-HHMM"`) session-window spec consumed by `session.isOpen`.
 * Structurally a constrained string; v1 does not validate the grammar at
 * compile time.
 *
 * @since 1.5
 * @stable
 * @example
 *     const d: SessionDescriptor = { kind: "session", defaultValue: "0930-1600" };
 *     void d;
 */
export type SessionDescriptor = Common<"session", string>;

/**
 * Descriptor for `input.externalSeries(...)`.
 *
 * @since 0.4
 * @stable
 * @example
 *     const d: ExternalSeriesDescriptor<number> = {
 *         kind: "external-series",
 *         name: "earnings",
 *         schema: { kind: "external-series-schema" },
 *     };
 *     void d;
 */
export type ExternalSeriesDescriptor<T> = Readonly<{
    kind: "external-series";
    name: string;
    schema: Schema<T>;
    title?: string;
}> &
    CommonInputOpts;

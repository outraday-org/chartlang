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
 * Opaque schema wrapper for `input.externalSeries`. Phase 4 ships the type
 * only; runtime validation lands in Phase 5.
 *
 * @since 0.4
 * @stable
 * @example
 *     const s: Schema<number> = { kind: "external-series-schema" };
 *     void s;
 */
export type Schema<T> = Readonly<{ kind: "external-series-schema"; __brand?: T }>;

type NumericInputOpts = Readonly<{ min?: number; max?: number; step?: number }>;

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
    | EnumDescriptor<string>
    | ColorDescriptor
    | SourceDescriptor
    | TimeDescriptor
    | PriceDescriptor
    | SymbolDescriptor
    | IntervalDescriptorInput
    | ExternalSeriesDescriptor<T>;

type Common<K extends InputKind, T> = Readonly<{
    kind: K;
    defaultValue: T;
    title?: string;
}>;

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
 * Descriptor for `input.enum(...)`.
 *
 * @since 0.4
 * @stable
 * @example
 *     const d: EnumDescriptor<"a" | "b"> = {
 *         kind: "enum",
 *         defaultValue: "a",
 *         options: ["a", "b"],
 *     };
 *     void d;
 */
export type EnumDescriptor<T extends string> = Common<"enum", T> &
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
}>;

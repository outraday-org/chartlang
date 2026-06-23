// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Color, Price, Time } from "../types.js";
import type {
    BoolDescriptor,
    ColorDescriptor,
    EnumDescriptor,
    ExternalSeriesDescriptor,
    FloatDescriptor,
    IntDescriptor,
    IntervalDescriptorInput,
    PriceDescriptor,
    Schema,
    SessionDescriptor,
    SourceDescriptor,
    SourceField,
    StringDescriptor,
    SymbolDescriptor,
    TimeDescriptor,
} from "./inputDescriptor.js";

/**
 * The `input.*` namespace. Every builder is a compile-time literal: the
 * compiler reads the call expression and serialises the descriptor into
 * `manifest.inputs`.
 *
 * @since 0.4
 * @stable
 * @example
 *     import { input } from "@invinite-org/chartlang-core";
 *     const length = input.int(20, { min: 1, max: 200, title: "Length" });
 *     void length;
 */
export const input = Object.freeze({
    /**
     * Build an integer input descriptor.
     *
     * @since 0.4
     * @stable
     * @example
     *     const length = input.int(20, { min: 1, max: 200 });
     *     void length;
     */
    int(
        defaultValue: number,
        opts?: {
            readonly min?: number;
            readonly max?: number;
            readonly step?: number;
            readonly title?: string;
        },
    ): IntDescriptor {
        return Object.freeze({ kind: "int" as const, defaultValue, ...opts });
    },

    /**
     * Build a floating-point input descriptor.
     *
     * @since 0.4
     * @stable
     * @example
     *     const multiplier = input.float(2.5, { step: 0.5 });
     *     void multiplier;
     */
    float(
        defaultValue: number,
        opts?: {
            readonly min?: number;
            readonly max?: number;
            readonly step?: number;
            readonly title?: string;
        },
    ): FloatDescriptor {
        return Object.freeze({ kind: "float" as const, defaultValue, ...opts });
    },

    /**
     * Build a boolean input descriptor.
     *
     * @since 0.4
     * @stable
     * @example
     *     const enabled = input.bool(true);
     *     void enabled;
     */
    bool(defaultValue: boolean, opts?: { readonly title?: string }): BoolDescriptor {
        return Object.freeze({ kind: "bool" as const, defaultValue, ...opts });
    },

    /**
     * Build a string input descriptor.
     *
     * @since 0.4
     * @stable
     * @example
     *     const symbol = input.string("AAPL");
     *     void symbol;
     */
    string(
        defaultValue: string,
        opts?: { readonly title?: string; readonly multiline?: boolean },
    ): StringDescriptor {
        return Object.freeze({ kind: "string" as const, defaultValue, ...opts });
    },

    /**
     * Build a string enum input descriptor.
     *
     * @since 0.4
     * @stable
     * @example
     *     const mode = input.enum("fast", ["fast", "slow"]);
     *     void mode;
     */
    enum<T extends string>(
        defaultValue: T,
        options: ReadonlyArray<T>,
        opts?: { readonly title?: string },
    ): EnumDescriptor<T> {
        return Object.freeze({
            kind: "enum" as const,
            defaultValue,
            options: Object.freeze(options.slice()),
            ...opts,
        });
    },

    /**
     * Build a color input descriptor.
     *
     * @since 0.4
     * @stable
     * @example
     *     const c = input.color("#26a69a");
     *     void c;
     */
    color(defaultValue: Color, opts?: { readonly title?: string }): ColorDescriptor {
        return Object.freeze({ kind: "color" as const, defaultValue, ...opts });
    },

    /**
     * Build a source-field input descriptor.
     *
     * @since 0.4
     * @stable
     * @example
     *     const source = input.source("close");
     *     void source;
     */
    source(defaultValue: SourceField, opts?: { readonly title?: string }): SourceDescriptor {
        return Object.freeze({ kind: "source" as const, defaultValue, ...opts });
    },

    /**
     * Build a time input descriptor.
     *
     * @since 0.4
     * @stable
     * @example
     *     const anchor = input.time(1_700_000_000_000, { pickFromChart: true });
     *     void anchor;
     */
    time(
        defaultValue: Time,
        opts?: { readonly title?: string; readonly pickFromChart?: boolean },
    ): TimeDescriptor {
        return Object.freeze({ kind: "time" as const, defaultValue, ...opts });
    },

    /**
     * Build a price input descriptor.
     *
     * @since 0.4
     * @stable
     * @example
     *     const level = input.price(101.25);
     *     void level;
     */
    price(defaultValue: Price, opts?: { readonly title?: string }): PriceDescriptor {
        return Object.freeze({ kind: "price" as const, defaultValue, ...opts });
    },

    /**
     * Build a symbol input descriptor.
     *
     * @since 0.4
     * @stable
     * @example
     *     const ticker = input.symbol("AAPL");
     *     void ticker;
     */
    symbol(defaultValue: string, opts?: { readonly title?: string }): SymbolDescriptor {
        return Object.freeze({ kind: "symbol" as const, defaultValue, ...opts });
    },

    /**
     * Build a main-interval input descriptor.
     *
     * @since 0.4
     * @stable
     * @example
     *     const interval = input.interval("1D");
     *     void interval;
     */
    interval(defaultValue: string, opts?: { readonly title?: string }): IntervalDescriptorInput {
        return Object.freeze({ kind: "interval" as const, defaultValue, ...opts });
    },

    /**
     * Build a session-window input descriptor (`"HH:MM-HH:MM"`). The value is
     * a free string in v1 (the grammar is parsed at runtime by
     * `session.isOpen`), mirroring `input.string`.
     *
     * @since 1.5
     * @stable
     * @example
     *     const sess = input.session("0930-1600", { title: "Session" });
     *     void sess;
     */
    session(defaultValue: string, opts?: { readonly title?: string }): SessionDescriptor {
        return Object.freeze({ kind: "session" as const, defaultValue, ...opts });
    },

    /**
     * Build an adapter-supplied external series input descriptor.
     *
     * @since 0.4
     * @stable
     * @example
     *     const earnings = input.externalSeries({
     *         name: "earnings",
     *         schema: { kind: "external-series-schema" },
     *     });
     *     void earnings;
     */
    externalSeries<T>(args: {
        readonly name: string;
        readonly schema: Schema<T>;
        readonly title?: string;
    }): ExternalSeriesDescriptor<T> {
        return Object.freeze({
            kind: "external-series" as const,
            name: args.name,
            schema: args.schema,
            ...(args.title === undefined ? {} : { title: args.title }),
        });
    },
});

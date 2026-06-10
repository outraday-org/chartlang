// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { JsonValue } from "../types.js";

/**
 * Symbol-type union. Adapters that cannot map a symbol to a canonical type
 * return `"custom"`.
 *
 * @since 0.4
 * @stable
 * @example
 *     const t: SymbolType = "equity";
 *     void t;
 */
export type SymbolType =
    | "equity"
    | "futures"
    | "forex"
    | "crypto"
    | "index"
    | "fund"
    | "bond"
    | "commodity"
    | "custom";

/**
 * Symbol-metadata view. Fields not populated by the adapter evaluate to
 * their empty sentinel: `""`, `NaN`, or `{}`.
 *
 * @since 0.4
 * @stable
 * @example
 *     const view: SymInfoView = syminfo;
 *     void view;
 */
export type SymInfoView = {
    readonly ticker: string;
    readonly type: SymbolType;
    readonly mintick: number;
    readonly currency: string;
    readonly basecurrency: string;
    readonly exchange: string;
    readonly timezone: string;
    readonly session: string;
    readonly meta: Readonly<Record<string, JsonValue>>;
};

/**
 * Module-scope `syminfo` fallback. Outside a script step, every field
 * evaluates to its empty sentinel; the runtime supplies the active per-mount
 * snapshot on `ComputeContext.syminfo`.
 *
 * @since 0.4
 * @stable
 * @example
 *     import { syminfo } from "@invinite-org/chartlang-core";
 *     void syminfo;
 */
export const syminfo: SymInfoView = Object.freeze({
    ticker: "",
    type: "custom",
    mintick: Number.NaN,
    currency: "",
    basecurrency: "",
    exchange: "",
    timezone: "",
    session: "",
    meta: Object.freeze({}),
});

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { JsonValue, SymInfoView, SymbolType } from "@invinite-org/chartlang-core";

/**
 * Adapter-supplied per-mount symbol metadata payload.
 *
 * @since 0.4
 * @stable
 * @example
 *     const info: AdapterSymInfo = {
 *         ticker: "DEMO",
 *         type: "equity",
 *         mintick: 0.01,
 *     };
 *     void info;
 */
export type AdapterSymInfo = Readonly<{
    ticker?: string;
    type?: SymbolType;
    mintick?: number;
    currency?: string;
    basecurrency?: string;
    exchange?: string;
    timezone?: string;
    session?: string;
    meta?: Readonly<Record<string, JsonValue>>;
}>;

const EMPTY_META: Readonly<Record<string, JsonValue>> = Object.freeze({});

/**
 * Build a frozen `syminfo.*` view from adapter metadata and enabled fields.
 *
 * Fields not present in `enabled` evaluate to their empty sentinel:
 * `""`, `Number.NaN`, `"custom"`, or `{}`.
 *
 * @since 0.4
 * @stable
 * @example
 *     const view = makeSymInfoView(
 *         { ticker: "DEMO", mintick: 0.01 },
 *         new Set(["ticker", "mintick"]),
 *     );
 *     void view.ticker;
 */
export function makeSymInfoView(
    payload: AdapterSymInfo,
    enabled: ReadonlySet<string>,
): SymInfoView {
    return Object.freeze({
        ticker: enabled.has("ticker") ? (payload.ticker ?? "") : "",
        type: enabled.has("type") ? (payload.type ?? "custom") : "custom",
        mintick: enabled.has("mintick") ? (payload.mintick ?? Number.NaN) : Number.NaN,
        currency: enabled.has("currency") ? (payload.currency ?? "") : "",
        basecurrency: enabled.has("basecurrency") ? (payload.basecurrency ?? "") : "",
        exchange: enabled.has("exchange") ? (payload.exchange ?? "") : "",
        timezone: enabled.has("timezone") ? (payload.timezone ?? "") : "",
        session: enabled.has("session") ? (payload.session ?? "") : "",
        meta: enabled.has("meta") ? Object.freeze({ ...(payload.meta ?? {}) }) : EMPTY_META,
    });
}

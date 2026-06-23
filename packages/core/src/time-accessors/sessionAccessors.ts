// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Time } from "../types.js";

const sentinel = (name: string): never => {
    throw new Error(`${name} called outside an active script step`);
};

/**
 * Session-window membership helpers over a `Time` epoch.
 *
 * The runtime replaces this compile-time callable hole with a real namespace
 * through `ComputeContext.session`.
 *
 * @since 1.5
 * @stable
 * @example
 *     const ns: typeof session = session;
 *     void ns;
 */
export const session = Object.freeze({
    /**
     * `true` when `t` falls inside the daily session window `spec`. `spec` is
     * an `"HH:MM-HH:MM"` (or `"HHMM-HHMM"`) intraday window, e.g.
     * `"0930-1600"`. The window is interpreted in `tz` (default
     * `syminfo.timezone`, fallback `"UTC"`).
     *
     * v1 resolves UTC and fixed-offset zones only; a DST zone resolves to UTC
     * plus a one-time diagnostic (see the determinism note in the docs).
     *
     * @since 1.5
     * @stable
     * @example
     *     const fn: typeof session.isOpen = session.isOpen;
     *     void fn;
     */
    isOpen(_t: Time, _spec: string, _tz?: string): boolean {
        return sentinel("session.isOpen");
    },
});

/**
 * Static type of the `session` namespace. Runtime implementations satisfy this
 * shape structurally when installed on `ComputeContext.session`.
 *
 * @since 1.5
 * @stable
 * @example
 *     const ns: SessionNamespace = session;
 *     void ns;
 */
export type SessionNamespace = typeof session;

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { AlertSeverity, JsonValue } from "../types.js";

/**
 * Styling and metadata options accepted by `alert(...)`. `severity` defaults
 * to `"info"`; `meta` is round-tripped to the host as a JSON-serialisable
 * payload.
 *
 * @since 0.1
 * @example
 *     const opts: AlertOpts = {
 *         severity: "warning",
 *         meta: { reason: "crossover", strength: 0.42 },
 *     };
 */
export type AlertOpts = Readonly<{
    severity?: AlertSeverity;
    meta?: Readonly<Record<string, JsonValue>>;
}>;

/**
 * Compile-time callable hole for `alert(message, opts?)`. The compiler
 * rewrites every callsite to dispatch to the runtime; calling this
 * outside the runtime throws the sentinel.
 *
 * @since 0.1
 * @stable
 * @example
 *     // Inside a compiled `compute`:
 *     //   alert("EMA crossed", { severity: "info" });
 *     import { alert } from "@invinite-org/chartlang-core";
 *     try { alert("noop"); } catch {}
 */
export function alert(_message: string, _opts?: AlertOpts): void {
    throw new Error("alert called outside compiled runtime");
}

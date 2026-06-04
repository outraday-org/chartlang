// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Series } from "@invinite-org/chartlang-core";

import type { RingBufferLike } from "./ringBuffer";

/**
 * Wrap a `RingBufferLike<T>` in the user-facing `Series<T>` Proxy shape
 * from PLAN.md §6.6. The Proxy is created **once per backing buffer**
 * at stream/slot construction time and re-used across every bar — its
 * identity is stable so script authors can keep `const ema = ta.ema(...)`
 * at the top of `compute` and reference `ema` the same way every bar.
 *
 * Property reads dispatch as follows:
 * - `series.current` → `buf.at(0)`
 * - `series.length` → `buf.length`
 * - `series[n]` (string coerces to a non-negative integer) → `buf.at(n)`
 * - any other key → `undefined`
 *
 * For numeric buffers (`Float64RingBuffer`) out-of-range reads return
 * `NaN`; for object buffers they return `undefined`. The Proxy passes
 * the underlying sentinel through verbatim.
 *
 * @since 0.1
 * @example
 *     // import { Float64RingBuffer, makeSeriesView }
 *     //     from "@invinite-org/chartlang-runtime";
 *     // const buf = new Float64RingBuffer(8);
 *     // const view = makeSeriesView<number>(buf);
 *     // buf.append(42);
 *     // view.current; // 42
 *     // view[0];      // 42
 *     // view.length;  // 1
 */
export function makeSeriesView<T>(buf: RingBufferLike<T>): Series<T> {
    return new Proxy({} as Series<T>, {
        get(_target, prop) {
            if (prop === "current") return buf.at(0);
            if (prop === "length") return buf.length;
            if (typeof prop === "string") {
                const n = Number(prop);
                if (Number.isInteger(n) && n >= 0) return buf.at(n);
            }
            return undefined;
        },
        has(_target, prop) {
            if (prop === "current" || prop === "length") return true;
            if (typeof prop === "string") {
                const n = Number(prop);
                return Number.isInteger(n) && n >= 0;
            }
            return false;
        },
    });
}

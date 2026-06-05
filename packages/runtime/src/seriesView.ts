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

/**
 * Offset-shifted variant of {@link makeSeriesView}. `offset === 0`
 * returns the same Proxy shape (and is the identity-preserving fast
 * path callers should special-case at the call site). For
 * `offset === k > 0`, `view.current === buf.at(k)` — i.e. the value
 * `k` bars ago, matching `lib/applyOffset`'s
 * `out[i] = values[i − offset]` semantics. For `offset === -k`,
 * `view.current === buf.at(-k)` — an OOR read returning the underlying
 * sentinel (NaN for `Float64RingBuffer`, `undefined` for object
 * `RingBuffer`).
 *
 * The shift is applied on every read — no allocation, no per-bar
 * work. Callers cache the returned Proxy per `(slot, offset)` pair so
 * the view's identity stays stable across bars.
 *
 * @since 0.2
 * @example
 *     // import { Float64RingBuffer, makeShiftedSeriesView }
 *     //     from "@invinite-org/chartlang-runtime";
 *     // const buf = new Float64RingBuffer(8);
 *     // buf.append(10); buf.append(20); buf.append(30);
 *     // const view = makeShiftedSeriesView<number>(buf, 1);
 *     // view.current; // 20 (one bar ago)
 *     // view[0];      // 20
 *     // view[1];      // 10
 */
export function makeShiftedSeriesView<T>(buf: RingBufferLike<T>, offset: number): Series<T> {
    if (offset === 0) return makeSeriesView<T>(buf);
    return new Proxy({} as Series<T>, {
        get(_target, prop) {
            if (prop === "current") return buf.at(offset);
            if (prop === "length") return buf.length;
            if (typeof prop === "string") {
                const n = Number(prop);
                if (Number.isInteger(n) && n >= 0) return buf.at(n + offset);
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

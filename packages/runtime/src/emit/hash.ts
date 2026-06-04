// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

const FNV_OFFSET_BASIS_32 = 0x811c9dc5;
const FNV_PRIME_32 = 0x01000193;

/**
 * Stable, deterministic FNV-1a 32-bit hash of a UTF-16 code-unit string.
 * Returns the hash as a lowercase 8-character hex string. Same input
 * yields the same output across machines, runs, and Node versions — the
 * property `alert.dedupeKey` relies on for cross-host idempotency.
 *
 * @since 0.1
 * @example
 *     // import { hashStringStable } from "@invinite-org/chartlang-runtime/emit";
 *     // hashStringStable("hello"); // "4f9f2cab"
 */
export function hashStringStable(s: string): string {
    let h = FNV_OFFSET_BASIS_32;
    for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, FNV_PRIME_32);
    }
    return (h >>> 0).toString(16).padStart(8, "0");
}

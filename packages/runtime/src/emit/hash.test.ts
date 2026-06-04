// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { hashStringStable } from "./hash";

describe("hashStringStable", () => {
    it("returns an 8-character lowercase hex string", () => {
        const h = hashStringStable("hello");
        expect(h).toMatch(/^[0-9a-f]{8}$/);
    });

    it("hashes the empty string to the FNV-1a 32-bit offset basis", () => {
        // FNV-1a 32-bit offset basis = 0x811c9dc5
        expect(hashStringStable("")).toBe("811c9dc5");
    });

    it("hashes a known reference vector", () => {
        // Reference: FNV-1a 32-bit hash of "foobar" = 0xbf9cf968
        // Computed via the canonical FNV-1a iteration over UTF-16 code units
        // (which match ASCII for "foobar").
        expect(hashStringStable("foobar")).toBe("bf9cf968");
    });

    it("differs across distinct inputs", () => {
        expect(hashStringStable("a")).not.toBe(hashStringStable("b"));
        expect(hashStringStable("ab")).not.toBe(hashStringStable("ba"));
    });

    it("handles supplementary plane code units via charCodeAt iteration", () => {
        // The emoji "🙂" decodes into a surrogate pair — two charCodeAt
        // reads. The hash must still be deterministic.
        const h1 = hashStringStable("🙂");
        const h2 = hashStringStable("🙂");
        expect(h1).toBe(h2);
        expect(h1).toMatch(/^[0-9a-f]{8}$/);
    });
});

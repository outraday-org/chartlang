// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import {
    CATEGORY_LABELS,
    CATEGORY_ORDER,
    EXAMPLE_CATALOGUE,
    type ExampleCategory,
    type ExampleMeta,
} from "./catalogue";

const HERE = dirname(fileURLToPath(import.meta.url));
const FRAGMENT_DIR = join(HERE, "catalogue");
const ID_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const KNOWN_CATEGORIES = new Set<ExampleCategory>(CATEGORY_ORDER);

describe("example catalogue", () => {
    it("has unique ids that are valid filename slugs", () => {
        const ids = EXAMPLE_CATALOGUE.map((e) => e.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of ids) {
            expect(id, `${id} is a kebab-case slug`).toMatch(ID_SLUG);
        }
    });

    it("classifies every entry under a known category", () => {
        for (const entry of EXAMPLE_CATALOGUE) {
            expect(KNOWN_CATEGORIES.has(entry.category), `${entry.id}: ${entry.category}`).toBe(
                true,
            );
        }
    });

    it("credits ≥1 primitive on every non-complex (default) entry", () => {
        // `complex` composites may credit nothing (the `(omit)` rows of the
        // Task 1 §6b fold rule — the single-primitive default owns the
        // coverage); `language` idiom entries credit `idioms`, not
        // `primitives` (the `examples:idioms` gate owns them). Every other
        // entry is a per-primitive default and must credit its headline
        // primitive.
        for (const entry of EXAMPLE_CATALOGUE) {
            if (entry.category === "complex" || entry.category === "language") continue;
            expect(entry.primitives.length, `${entry.id} credits ≥1 primitive`).toBeGreaterThan(0);
        }
    });

    it("sets a non-empty `idioms` array on every `language` entry, and on no other", () => {
        // The `idioms` field is the idiom-gate signal cross-checked by
        // `pnpm examples:idioms`; it belongs ONLY to the `language` category.
        // A `language` entry must ALSO credit no primitive (`primitives: []`):
        // it is covered by the orthogonal `examples:idioms` axis, and crediting
        // a primitive here would silently satisfy the per-primitive
        // `examples:coverage` gate for an id whose dedicated default could then
        // be removed undetected.
        for (const entry of EXAMPLE_CATALOGUE) {
            if (entry.category === "language") {
                expect(entry.idioms ?? [], `${entry.id} credits ≥1 idiom`).not.toHaveLength(0);
                expect(entry.primitives.length, `${entry.id} (language) credits no primitive`).toBe(
                    0,
                );
            } else {
                expect(entry.idioms, `${entry.id} (non-language) sets no idioms`).toBeUndefined();
            }
        }
    });

    it("keeps CATEGORY_ORDER and CATEGORY_LABELS in lockstep", () => {
        expect([...CATEGORY_ORDER].sort()).toEqual(Object.keys(CATEGORY_LABELS).sort());
        expect(new Set(CATEGORY_ORDER).size).toBe(CATEGORY_ORDER.length);
    });

    it("spreads every fragment file into the barrel (no orphan, no missing spread)", async () => {
        const fragmentFiles = (await readdir(FRAGMENT_DIR)).filter(
            (name) => name.endsWith(".ts") && !name.endsWith(".test.ts"),
        );
        expect(fragmentFiles.length).toBeGreaterThan(0);

        const barrelIds = new Set(EXAMPLE_CATALOGUE.map((e) => e.id));
        let fragmentTotal = 0;
        for (const file of fragmentFiles) {
            const mod = (await import(pathToFileURL(join(FRAGMENT_DIR, file)).href)) as {
                default: ReadonlyArray<ExampleMeta>;
            };
            const entries = mod.default;
            expect(Array.isArray(entries), `${file} default-exports an array`).toBe(true);
            for (const entry of entries) {
                expect(
                    barrelIds.has(entry.id),
                    `${file}: ${entry.id} is spread into the barrel`,
                ).toBe(true);
            }
            fragmentTotal += entries.length;
        }
        // Every barrel entry comes from exactly one fragment (counts match).
        expect(EXAMPLE_CATALOGUE.length).toBe(fragmentTotal);
    });
});

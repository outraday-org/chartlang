// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
    CATEGORY_LABELS,
    CATEGORY_ORDER,
    EXAMPLE_CATALOGUE,
    type ExampleCategory,
} from "./index.js";

// The committed `examples/catalogue.json` the package data module mirrors —
// the gate-of-record for the entry count (repo-root, three levels up from
// `packages/examples/src/`).
const CATALOGUE_JSON_PATH = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../examples/catalogue.json",
);
const catalogueJson = JSON.parse(readFileSync(CATALOGUE_JSON_PATH, "utf8")) as ReadonlyArray<{
    id: string;
}>;

// Every catalogue source is a default-exported `define*` script — usually
// `defineIndicator`, but the `language` idiom examples may also be
// `defineDrawing` / `defineAlert` / `defineAlertCondition` (see
// `examples/CLAUDE.md`), so the assertion accepts the whole family.
const DEFINE_DEFAULT_EXPORT = /export default define(Indicator|Drawing|Alert|AlertCondition)\(/;

describe("EXAMPLE_CATALOGUE", () => {
    it("is non-empty", () => {
        expect(EXAMPLE_CATALOGUE.length).toBeGreaterThan(0);
    });

    it("has the same entry count as examples/catalogue.json", () => {
        expect(EXAMPLE_CATALOGUE.length).toBe(catalogueJson.length);
    });

    it("has unique ids", () => {
        const ids = EXAMPLE_CATALOGUE.map((entry) => entry.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("inlines a define* default-export source for every entry", () => {
        for (const entry of EXAMPLE_CATALOGUE) {
            expect(entry.source, `${entry.id} source`).toMatch(DEFINE_DEFAULT_EXPORT);
        }
    });

    it("uses only known categories", () => {
        const known = new Set<ExampleCategory>(CATEGORY_ORDER);
        for (const entry of EXAMPLE_CATALOGUE) {
            expect(known.has(entry.category), `${entry.id} category`).toBe(true);
        }
    });

    it("sets `idioms` only on `language` entries", () => {
        for (const entry of EXAMPLE_CATALOGUE) {
            if (entry.category === "language") {
                expect(entry.idioms?.length ?? 0, `${entry.id} idioms`).toBeGreaterThan(0);
            } else {
                expect(entry.idioms, `${entry.id} idioms`).toBeUndefined();
            }
        }
    });
});

describe("taxonomy", () => {
    it("labels every category in CATEGORY_ORDER", () => {
        for (const category of CATEGORY_ORDER) {
            expect(CATEGORY_LABELS[category]).toBeTruthy();
        }
    });

    it("has no duplicate categories in CATEGORY_ORDER", () => {
        expect(new Set(CATEGORY_ORDER).size).toBe(CATEGORY_ORDER.length);
    });
});

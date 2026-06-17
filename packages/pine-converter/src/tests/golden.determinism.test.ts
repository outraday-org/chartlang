// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { type ConvertOpts, convert } from "../index.js";

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "fixtures");
const OPTS: ConvertOpts = { barInterval: 60_000, barIndexOrigin: 1_700_000_000_000 };

const pineFixtures = readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".pine"))
    .sort();

describe("converter determinism", () => {
    for (const fix of pineFixtures) {
        it(`${fix} is byte-stable across two invocations`, () => {
            const source = readFileSync(join(FIXTURES_DIR, fix), "utf-8");
            const r1 = convert(source, OPTS);
            const r2 = convert(source, OPTS);
            expect(r1.output).toBe(r2.output);
            expect(r1.diagnostics).toEqual(r2.diagnostics);
        });
    }
});

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { type ConvertOpts, convert } from "../index.js";

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "fixtures");
const OPTS: ConvertOpts = { barInterval: 60_000, barIndexOrigin: 1_700_000_000_000 };

// Each Camp-C reject fixture + the stable error code it MUST raise. The reject
// is already error-severity in default mode; strict mode (warning→error upgrade)
// leaves it error-severity. Per the diagnostics-framework contract, strict mode
// does NOT null `output` — callers detect failure by scanning for any error
// severity, which these fixtures exercise.
const REJECT_FIXTURES: ReadonlyArray<{ readonly file: string; readonly code: string }> = [
    {
        file: "09-camp-c-reject-unbounded.pine",
        code: "pine-converter/semantic/unbounded-handle-collection",
    },
    {
        file: "10-camp-c-reject-linefill.pine",
        code: "pine-converter/transform/cross-collection-linefill",
    },
];

describe("converter strict mode — Camp C rejects", () => {
    for (const { file, code } of REJECT_FIXTURES) {
        const source = readFileSync(join(FIXTURES_DIR, file), "utf-8");

        it(`${file}: default mode keeps output + flags the reject code as error`, () => {
            const result = convert(source, OPTS);
            expect(result.output).not.toBeNull();
            const reject = result.diagnostics.find((d) => d.code === code);
            expect(reject).toBeDefined();
            expect(reject?.severity).toBe("error");
        });

        it(`${file}: strict mode reports at least one error (failure is detectable)`, () => {
            const strict = convert(source, { ...OPTS, strictMode: true });
            const errors = strict.diagnostics.filter((d) => d.severity === "error");
            expect(errors.length).toBeGreaterThan(0);
            expect(strict.diagnostics.some((d) => d.code === code && d.severity === "error")).toBe(
                true,
            );
        });
    }
});

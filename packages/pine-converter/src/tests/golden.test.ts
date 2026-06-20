// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { type ConvertOpts, type Diagnostic, convert } from "../index.js";

// The fixtures corpus is a sibling of `src/` (it must live OUTSIDE `src/` so the
// 100%-coverage gate doesn't treat the `.expected.chart.ts` data files as code).
const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "fixtures");

// Deterministic across runs/machines: a fixed bar interval + index origin pin
// future-bar anchor synthesis and historical-bar resolution.
const OPTS: ConvertOpts = { barInterval: 60_000, barIndexOrigin: 1_700_000_000_000 };

const UPDATE = process.env.UPDATE_FIXTURES === "1";

const pineFixtures = readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".pine"))
    .sort();

type DiagnosticSnapshot = {
    code: string;
    severity: string;
    message: string;
    span: { startLine: number; startColumn: number; endLine: number; endColumn: number };
    suggestion?: string;
};

// Spans are already line/column only (no character offsets), so the whole span
// is stable; `suggestion` is dropped when absent for compact, ordered JSON.
function diagnosticsForSnapshot(diagnostics: readonly Diagnostic[]): DiagnosticSnapshot[] {
    return diagnostics.map((d) => {
        const base: DiagnosticSnapshot = {
            code: d.code,
            severity: d.severity,
            message: d.message,
            span: {
                startLine: d.span.startLine,
                startColumn: d.span.startColumn,
                endLine: d.span.endLine,
                endColumn: d.span.endColumn,
            },
        };
        return d.suggestion === undefined ? base : { ...base, suggestion: d.suggestion };
    });
}

describe("converter goldens", () => {
    it("covers the full documented fixture corpus", () => {
        expect(pineFixtures.length).toBe(30);
    });

    for (const fix of pineFixtures) {
        it(fix, () => {
            const source = readFileSync(join(FIXTURES_DIR, fix), "utf-8");
            const result = convert(source, OPTS);
            // Every fixture must produce SOME output — `convert` only nulls
            // output on a fatal lex/parse error, which the corpus never hits.
            expect(result.output).not.toBeNull();
            const chartPath = join(FIXTURES_DIR, fix.replace(/\.pine$/, ".expected.chart.ts"));
            const diagPath = join(
                FIXTURES_DIR,
                fix.replace(/\.pine$/, ".expected.diagnostics.json"),
            );
            const snapshot = diagnosticsForSnapshot(result.diagnostics);
            if (UPDATE) {
                writeFileSync(chartPath, result.output ?? "", "utf-8");
                writeFileSync(diagPath, `${JSON.stringify(snapshot, null, 4)}\n`, "utf-8");
                return;
            }
            expect(result.output).toBe(readFileSync(chartPath, "utf-8"));
            expect(snapshot).toEqual(
                JSON.parse(readFileSync(diagPath, "utf-8")) as DiagnosticSnapshot[],
            );
        });
    }
});

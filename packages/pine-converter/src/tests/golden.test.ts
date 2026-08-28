// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { type ConvertOpts, type Diagnostic, convert } from "../index.js";

// The fixtures corpus is a sibling of `src/` (it must live OUTSIDE `src/` so the
// 100%-coverage gate doesn't treat the `.expected.chart.ts` data files as code).
const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "fixtures");
const REPO_ROOT = join(FIXTURES_DIR, "..", "..", "..");

// Deterministic across runs/machines: a fixed bar interval + index origin pin
// future-bar anchor synthesis and historical-bar resolution.
const OPTS: ConvertOpts = { barInterval: 60_000, barIndexOrigin: 1_700_000_000_000 };

const UPDATE = process.env.UPDATE_FIXTURES === "1";

function sourceSha256(source: string): string {
    return createHash("sha256").update(source).digest("hex");
}

const pineFixtures = readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".pine"))
    .sort();

type FullSourceFixture = {
    readonly sourcePath: string;
    readonly sourceSha256: string;
    readonly provenance: string;
};

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return Object.prototype.toString.call(value) === "[object Object]";
}

function parseFullSourceFixture(source: string): FullSourceFixture {
    const value: unknown = JSON.parse(source);
    if (
        !isRecord(value) ||
        typeof value.sourcePath !== "string" ||
        typeof value.sourceSha256 !== "string" ||
        typeof value.provenance !== "string"
    ) {
        throw new Error("Full-source fixture descriptor is malformed");
    }
    return {
        sourcePath: value.sourcePath,
        sourceSha256: value.sourceSha256,
        provenance: value.provenance,
    };
}

const fullSourceFixtures = readdirSync(FIXTURES_DIR)
    .filter((fixtureName) => fixtureName.endsWith(".full-source.json"))
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
        expect(pineFixtures.length).toBe(98);
        expect(fullSourceFixtures.length).toBe(2);
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

    for (const fixtureName of fullSourceFixtures) {
        it(fixtureName, () => {
            const descriptor = parseFullSourceFixture(
                readFileSync(join(FIXTURES_DIR, fixtureName), "utf-8"),
            );
            expect(descriptor.provenance).not.toBe("");
            const source = readFileSync(join(REPO_ROOT, descriptor.sourcePath), "utf-8");
            expect(sourceSha256(source)).toBe(descriptor.sourceSha256);
            const result = convert(source, OPTS);
            expect(result.output).not.toBeNull();
            const chartPath = join(
                FIXTURES_DIR,
                fixtureName.replace(/\.full-source\.json$/, ".expected.chart.ts"),
            );
            const diagPath = join(
                FIXTURES_DIR,
                fixtureName.replace(/\.full-source\.json$/, ".expected.diagnostics.json"),
            );
            const snapshot = diagnosticsForSnapshot(result.diagnostics);
            if (UPDATE) {
                writeFileSync(chartPath, result.output ?? "", "utf-8");
                writeFileSync(diagPath, `${JSON.stringify(snapshot, null, 4)}\n`, "utf-8");
                return;
            }
            expect(result.output).toBe(readFileSync(chartPath, "utf-8"));
            const expectedDiagnostics: unknown = JSON.parse(readFileSync(diagPath, "utf-8"));
            expect(snapshot).toEqual(expectedDiagnostics);
        });
    }
});

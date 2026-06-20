// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { DIAGNOSTIC_CODE_ENTRIES } from "../packages/pine-converter/src/diagnostics/codes";
import {
    generateConverterDocs,
    renderDiagnosticsPage,
    renderEntry,
    shortCode,
} from "./gen-converter-docs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = join(REPO_ROOT, "docs/converter/diagnostics.md");

const ALL_ENTRIES = Object.values(DIAGNOSTIC_CODE_ENTRIES);

describe("gen-converter-docs", () => {
    it("derives the docs anchor as the trailing path segment", () => {
        expect(shortCode("pine-converter/transform/cap-mismatch")).toBe("cap-mismatch");
        expect(shortCode("no-slash")).toBe("no-slash");
    });

    it("renders an anchored section with the full code, severity, and message", () => {
        const block = renderEntry({
            code: "pine-converter/transform/cap-mismatch",
            severity: "info",
            defaultMessage: "The cap was clamped.",
            defaultSuggestion: "Lower the cap.",
        });
        expect(block).toContain("### cap-mismatch");
        expect(block).toContain("`pine-converter/transform/cap-mismatch`");
        expect(block).toContain("**Severity:** info");
        expect(block).toContain("**Message:** The cap was clamped.");
        expect(block).toContain("**Suggested fix:** Lower the cap.");
    });

    it("omits the suggested-fix line when an entry has no default suggestion", () => {
        const block = renderEntry({
            code: "pine-converter/parse/expected-token",
            severity: "error",
            defaultMessage: "Expected a different token here.",
        });
        expect(block).not.toContain("Suggested fix");
    });

    it("opens with the intro heading and a section for every registry code", () => {
        const page = renderDiagnosticsPage(ALL_ENTRIES);
        expect(page.startsWith("# Converter diagnostics")).toBe(true);
        expect(page).not.toContain("AUTO-GENERATED");
        for (const entry of ALL_ENTRIES) {
            expect(page).toContain(`### ${shortCode(entry.code)}`);
        }
    });

    it("is deterministic regardless of input order", () => {
        const forward = renderDiagnosticsPage(ALL_ENTRIES);
        const reversed = renderDiagnosticsPage(ALL_ENTRIES.slice().reverse());
        expect(reversed).toBe(forward);
    });

    it("committed docs/converter/diagnostics.md is up to date", async () => {
        const committed = await readFile(PAGE, "utf8");
        expect(committed).toBe(renderDiagnosticsPage(ALL_ENTRIES));
    });

    it("generateConverterDocs --check passes against the committed page", async () => {
        await expect(generateConverterDocs({ check: true })).resolves.toBeUndefined();
    });
});

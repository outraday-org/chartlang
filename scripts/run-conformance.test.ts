// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { ConformanceReport } from "../packages/conformance/src/runConformanceSuite";

import {
    canvas2dReportPaths,
    checkReportFiles,
    parseConformanceArgs,
    renderReportFiles,
    writeReportFiles,
} from "./run-conformance";

const REPORT: ConformanceReport = Object.freeze({
    passed: 1,
    failed: 0,
    failures: Object.freeze([]),
    scenarios: Object.freeze([
        Object.freeze({
            id: "ema-cross",
            title: "EMA cross",
            status: "pass",
            failures: Object.freeze([]),
        }),
    ]),
});

describe("parseConformanceArgs", () => {
    it("parses report and check flags", () => {
        expect(parseConformanceArgs([])).toEqual({ report: false, check: false });
        expect(parseConformanceArgs(["--report"])).toEqual({ report: true, check: false });
        expect(parseConformanceArgs(["--report", "--check"])).toEqual({
            report: true,
            check: true,
        });
    });

    it("rejects check mode without report mode", () => {
        expect(() => parseConformanceArgs(["--check"])).toThrow("--check requires --report");
    });

    it("rejects unknown arguments", () => {
        expect(() => parseConformanceArgs(["--wat"])).toThrow();
    });
});

describe("canvas2dReportPaths", () => {
    it("points at the reference adapter root", () => {
        expect(canvas2dReportPaths("/repo")).toEqual({
            markdown: join("/repo", "examples/canvas2d-adapter/CONFORMANCE.md"),
            json: join("/repo", "examples/canvas2d-adapter/conformance-report.json"),
        });
    });
});

describe("report file helpers", () => {
    it("writes generated files and reports no drift", async () => {
        const root = await mkdtemp(join(tmpdir(), "chartlang-conformance-report-"));
        try {
            const paths = canvas2dReportPaths(root);
            const files = renderReportFiles(REPORT, {
                adapterName: "Adapter",
                generatedBy: "suite@1.0.0",
            });
            await writeReportFiles(paths, files);

            await expect(readFile(paths.markdown, "utf8")).resolves.toBe(files.markdown);
            await expect(readFile(paths.json, "utf8")).resolves.toBe(files.json);
            await expect(checkReportFiles(paths, files)).resolves.toEqual([]);
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });

    it("treats missing committed files as drift", async () => {
        const root = await mkdtemp(join(tmpdir(), "chartlang-conformance-report-"));
        try {
            const paths = canvas2dReportPaths(root);
            const files = renderReportFiles(REPORT, {
                adapterName: "Adapter",
                generatedBy: "suite@1.0.0",
            });
            await expect(checkReportFiles(paths, files)).resolves.toEqual([
                { kind: "missing-committed", path: paths.markdown },
                { kind: "missing-committed", path: paths.json },
            ]);
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });

    it("detects byte drift in committed files", async () => {
        const root = await mkdtemp(join(tmpdir(), "chartlang-conformance-report-"));
        try {
            const paths = canvas2dReportPaths(root);
            const files = renderReportFiles(REPORT, {
                adapterName: "Adapter",
                generatedBy: "suite@1.0.0",
            });
            await writeReportFiles(paths, files);
            await writeFile(paths.json, "{}\n", "utf8");
            await expect(checkReportFiles(paths, files)).resolves.toEqual([
                { kind: "out-of-date", path: paths.json },
            ]);
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });
});

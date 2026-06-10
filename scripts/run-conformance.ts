#!/usr/bin/env tsx
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
/**
 * Wraps the `packages/conformance` runner per section 16.5 / 15.3.
 *
 * Exits 0 on a missing runner OR every scenario passing; 1 on any
 * scenario failure or checked-in report drift.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import {
    renderConformanceJson,
    renderConformanceMarkdown,
    type ConformanceReportMeta,
} from "../packages/conformance/src/report/renderReport";
import type { ConformanceReport } from "../packages/conformance/src/runConformanceSuite";

const ROOT = process.cwd();

type AdapterModule = { default?: unknown };
type ConformanceModule = {
    runConformanceSuite?: (adapter: unknown) => Promise<ConformanceReport> | ConformanceReport;
};

/**
 * Parsed CLI options for `scripts/run-conformance.ts`.
 *
 * @since 1.0
 * @stable
 * @example
 *     const opts: RunConformanceArgs = { report: true, check: false };
 *     void opts;
 */
export type RunConformanceArgs = {
    readonly report: boolean;
    readonly check: boolean;
};

/**
 * Output paths for a generated adapter report pair.
 *
 * @since 1.0
 * @stable
 * @example
 *     const paths: ConformanceReportPaths = {
 *         markdown: "examples/canvas2d-adapter/CONFORMANCE.md",
 *         json: "examples/canvas2d-adapter/conformance-report.json",
 *     };
 *     void paths;
 */
export type ConformanceReportPaths = {
    readonly markdown: string;
    readonly json: string;
};

/**
 * Rendered report contents ready for writing or drift comparison.
 *
 * @since 1.0
 * @stable
 * @example
 *     const files: ConformanceReportFiles = { markdown: "# Report\n", json: "{}\n" };
 *     void files;
 */
export type ConformanceReportFiles = {
    readonly markdown: string;
    readonly json: string;
};

/**
 * One checked-in report drift entry.
 *
 * @since 1.0
 * @stable
 * @example
 *     const drift: ConformanceReportDrift = {
 *         kind: "missing-committed",
 *         path: "CONFORMANCE.md",
 *     };
 *     void drift;
 */
export type ConformanceReportDrift =
    | { readonly kind: "missing-committed"; readonly path: string }
    | { readonly kind: "out-of-date"; readonly path: string };

function noRunner(): void {
    console.log("conformance: no runner exported yet (Phase 1+ wires runConformanceSuite).");
    console.log("conformance: 0 scenarios, 0 failures.");
    process.exitCode = 0;
}

async function tryImport<T>(absPath: string): Promise<T | null> {
    if (!existsSync(absPath)) return null;
    try {
        return (await import(pathToFileURL(absPath).href)) as T;
    } catch (err) {
        console.error(`conformance: failed to import ${absPath}: ${(err as Error).message}`);
        return null;
    }
}

/**
 * Parse conformance runner CLI flags.
 *
 * @since 1.0
 * @stable
 * @example
 *     const opts = parseConformanceArgs(["--report", "--check"]);
 *     // opts.check === true
 *     void opts;
 */
export function parseConformanceArgs(argv: ReadonlyArray<string>): RunConformanceArgs {
    const parsed = parseArgs({
        args: [...argv],
        allowPositionals: false,
        options: {
            report: { type: "boolean", default: false },
            check: { type: "boolean", default: false },
        },
        strict: true,
    });
    const report = parsed.values.report === true;
    const check = parsed.values.check === true;
    if (check && !report) {
        throw new Error("--check requires --report");
    }
    return { report, check };
}

/**
 * Return the canvas2d adapter report file paths for a repo root.
 *
 * @since 1.0
 * @stable
 * @example
 *     const paths = canvas2dReportPaths(process.cwd());
 *     void paths;
 */
export function canvas2dReportPaths(root: string): ConformanceReportPaths {
    const adapterRoot = join(root, "examples/canvas2d-adapter");
    return {
        markdown: join(adapterRoot, "CONFORMANCE.md"),
        json: join(adapterRoot, "conformance-report.json"),
    };
}

/**
 * Render both public report files from one conformance report.
 *
 * @since 1.0
 * @stable
 * @example
 *     const files = renderReportFiles(
 *         { passed: 0, failed: 0, failures: [], scenarios: [] },
 *         { adapterName: "Demo", generatedBy: "suite@1.0.0" },
 *     );
 *     void files;
 */
export function renderReportFiles(
    report: ConformanceReport,
    meta: ConformanceReportMeta,
): ConformanceReportFiles {
    return {
        markdown: renderConformanceMarkdown(report, meta),
        json: renderConformanceJson(report, meta),
    };
}

/**
 * Write a report pair to disk, creating parent directories if needed.
 *
 * @since 1.0
 * @stable
 * @example
 *     await writeReportFiles(
 *         { markdown: "CONFORMANCE.md", json: "conformance-report.json" },
 *         { markdown: "# Report\n", json: "{}\n" },
 *     );
 */
export async function writeReportFiles(
    paths: ConformanceReportPaths,
    files: ConformanceReportFiles,
): Promise<void> {
    await Promise.all([
        mkdir(dirname(paths.markdown), { recursive: true }),
        mkdir(dirname(paths.json), { recursive: true }),
    ]);
    await Promise.all([
        writeFile(paths.markdown, files.markdown, "utf8"),
        writeFile(paths.json, files.json, "utf8"),
    ]);
}

async function compareOne(path: string, expected: string): Promise<ConformanceReportDrift | null> {
    let committed = "";
    try {
        committed = await readFile(path, "utf8");
    } catch {
        return { kind: "missing-committed", path };
    }
    return committed === expected ? null : { kind: "out-of-date", path };
}

/**
 * Byte-compare committed report files against freshly rendered content.
 *
 * @since 1.0
 * @stable
 * @example
 *     const drift = await checkReportFiles(
 *         { markdown: "CONFORMANCE.md", json: "conformance-report.json" },
 *         { markdown: "# Report\n", json: "{}\n" },
 *     );
 *     void drift;
 */
export async function checkReportFiles(
    paths: ConformanceReportPaths,
    files: ConformanceReportFiles,
): Promise<ReadonlyArray<ConformanceReportDrift>> {
    const [markdown, json] = await Promise.all([
        compareOne(paths.markdown, files.markdown),
        compareOne(paths.json, files.json),
    ]);
    return Object.freeze([markdown, json].filter((drift) => drift !== null));
}

function adapterName(adapter: unknown): string {
    if (typeof adapter !== "object" || adapter === null || !("name" in adapter)) {
        return "Canvas2D reference adapter";
    }
    const name = (adapter as { readonly name?: unknown }).name;
    return typeof name === "string" && name.length > 0 ? name : "Canvas2D reference adapter";
}

async function generatedBy(root: string): Promise<string> {
    const packageJson = JSON.parse(
        await readFile(join(root, "packages/conformance/package.json"), "utf8"),
    ) as { readonly name?: unknown; readonly version?: unknown };
    const name =
        typeof packageJson.name === "string"
            ? packageJson.name
            : "@invinite-org/chartlang-conformance";
    const version = typeof packageJson.version === "string" ? packageJson.version : "0.0.0";
    return `${name}@${version}`;
}

function printDrift(drift: ReadonlyArray<ConformanceReportDrift>): void {
    for (const d of drift) {
        if (d.kind === "missing-committed") {
            console.error(
                `${d.path}: missing committed report (run \`pnpm conformance:report\` and commit)`,
            );
        } else {
            console.error(`${d.path}: out of date (run \`pnpm conformance:report\` and commit)`);
        }
    }
}

async function main(argv: ReadonlyArray<string> = process.argv.slice(2)): Promise<void> {
    const args = parseConformanceArgs(argv);
    const conformanceDist = join(ROOT, "packages/conformance/dist/index.js");
    const conformanceSrc = join(ROOT, "packages/conformance/src/index.ts");
    const conformanceMod =
        (await tryImport<ConformanceModule>(conformanceSrc)) ??
        (await tryImport<ConformanceModule>(conformanceDist));

    if (!conformanceMod || typeof conformanceMod.runConformanceSuite !== "function") {
        noRunner();
        return;
    }

    const adapterDist = join(ROOT, "examples/canvas2d-adapter/dist/index.js");
    const adapterSrc = join(ROOT, "examples/canvas2d-adapter/src/index.ts");
    const adapterMod =
        (await tryImport<AdapterModule>(adapterSrc)) ??
        (await tryImport<AdapterModule>(adapterDist));

    if (!adapterMod || adapterMod.default === undefined) {
        noRunner();
        return;
    }

    const report = await conformanceMod.runConformanceSuite(adapterMod.default);
    const failures = report.failures;
    for (const f of failures) {
        console.error(`conformance: ${f.scenarioId} failed: ${f.message}`);
    }
    console.log(`conformance: ${report.passed} scenarios passed, ${failures.length} failures.`);

    let driftCount = 0;
    if (args.report) {
        const files = renderReportFiles(report, {
            adapterName: adapterName(adapterMod.default),
            generatedBy: await generatedBy(ROOT),
        });
        const paths = canvas2dReportPaths(ROOT);
        if (args.check) {
            const drift = await checkReportFiles(paths, files);
            printDrift(drift);
            driftCount = drift.length;
            if (drift.length === 0) {
                console.log("conformance:report — committed reports match generated output.");
            }
        } else {
            await writeReportFiles(paths, files);
        }
    }

    process.exitCode = failures.length > 0 || driftCount > 0 ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`conformance: ${message}`);
        process.exitCode = 1;
    });
}

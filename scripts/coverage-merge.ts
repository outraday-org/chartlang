#!/usr/bin/env tsx
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
/**
 * Merges per-package coverage into root `./coverage/lcov.info` and
 * `./coverage/coverage-summary.json` per §16.5. Concatenation is the
 * canonical LCOV merge — Codecov accepts multiple `TN:` / `SF:` blocks.
 * Summary metrics are recomputed from per-package totals so small
 * packages don't bias the average.
 *
 * Exits 0 except on filesystem write errors. Numeric gating already
 * happened per-package via vitest's `thresholds` block — this script
 * is reporting, not gating.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, "coverage");

type Metric = { total: number; covered: number; skipped?: number; pct: number };
type Summary = {
    total?: { lines?: Metric; statements?: Metric; branches?: Metric; functions?: Metric };
} & Record<string, unknown>;

const METRICS = ["lines", "statements", "branches", "functions"] as const;
type MetricName = (typeof METRICS)[number];

async function listPackageDirs(): Promise<string[]> {
    const dirs: string[] = [];
    const packagesDir = join(ROOT, "packages");
    if (existsSync(packagesDir)) {
        const entries = await readdir(packagesDir);
        for (const entry of entries) {
            const full = join(packagesDir, entry);
            const s = await stat(full);
            if (s.isDirectory()) dirs.push(full);
        }
    }
    const adapter = join(ROOT, "examples/canvas2d-adapter");
    if (existsSync(adapter)) dirs.push(adapter);
    return dirs;
}

function pct(covered: number, total: number): number {
    if (total === 0) return 100;
    return (covered / total) * 100;
}

async function main(): Promise<void> {
    await mkdir(OUT_DIR, { recursive: true });

    const pkgDirs = await listPackageDirs();
    const lcovParts: string[] = [];
    const totals: Record<MetricName, { total: number; covered: number }> = {
        lines: { total: 0, covered: 0 },
        statements: { total: 0, covered: 0 },
        branches: { total: 0, covered: 0 },
        functions: { total: 0, covered: 0 },
    };

    for (const pkgDir of pkgDirs) {
        const rel = relative(ROOT, pkgDir);
        const lcovPath = join(pkgDir, "coverage/lcov.info");
        if (existsSync(lcovPath)) {
            const content = await readFile(lcovPath, "utf8");
            lcovParts.push(content);
        } else {
            console.warn(`[warn] ${rel}/coverage/lcov.info missing — skipping.`);
        }

        const summaryPath = join(pkgDir, "coverage/coverage-summary.json");
        if (existsSync(summaryPath)) {
            const raw = await readFile(summaryPath, "utf8");
            try {
                const parsed = JSON.parse(raw) as Summary;
                const t = parsed.total ?? {};
                for (const name of METRICS) {
                    const m = t[name];
                    if (m && typeof m.total === "number" && typeof m.covered === "number") {
                        totals[name].total += m.total;
                        totals[name].covered += m.covered;
                    }
                }
            } catch (err) {
                console.warn(`[warn] ${rel}/coverage/coverage-summary.json invalid JSON: ${(err as Error).message}`);
            }
        } else {
            console.warn(`[warn] ${rel}/coverage/coverage-summary.json missing — skipping.`);
        }
    }

    await writeFile(join(OUT_DIR, "lcov.info"), lcovParts.join(""), "utf8");

    const mergedSummary: Summary = { total: {} };
    for (const name of METRICS) {
        const { total, covered } = totals[name];
        (mergedSummary.total as Record<MetricName, Metric>)[name] = {
            total,
            covered,
            skipped: 0,
            pct: Number(pct(covered, total).toFixed(2)),
        };
    }
    await writeFile(
        join(OUT_DIR, "coverage-summary.json"),
        `${JSON.stringify(mergedSummary, null, 2)}\n`,
        "utf8",
    );

    const fmt = (name: MetricName): string =>
        `${name} ${pct(totals[name].covered, totals[name].total).toFixed(2)}%`;
    console.log(
        `coverage: ${fmt("lines")} / ${fmt("statements")} / ${fmt("branches")} / ${fmt("functions")}`,
    );
}

await main();

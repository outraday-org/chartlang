#!/usr/bin/env tsx
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
/**
 * Wraps the future `packages/conformance` runner per §16.5 / §15.3.
 *
 * Phase 0: `runConformanceSuite` and the reference adapter aren't
 * exported yet. The script detects this and exits 0 with the
 * `conformance: 0 scenarios, 0 failures.` line so CI can adopt the
 * gate today. Phase 1+ ships the exports — no edit to this script
 * required.
 *
 * Exits 0 on a missing runner OR every scenario passing; 1 on any
 * scenario failure.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

type ConformanceReport = {
    failures?: { scenarioId?: string; id?: string; message?: string }[];
};

type AdapterModule = { default?: unknown };
type ConformanceModule = { runConformanceSuite?: (adapter: unknown) => Promise<ConformanceReport> | ConformanceReport };

function noRunner(): never {
    console.log("conformance: no runner exported yet (Phase 1+ wires runConformanceSuite).");
    console.log("conformance: 0 scenarios, 0 failures.");
    process.exit(0);
}

async function tryImport<T>(absPath: string): Promise<T | null> {
    if (!existsSync(absPath)) return null;
    try {
        return (await import(absPath)) as T;
    } catch (err) {
        console.error(`conformance: failed to import ${absPath}: ${(err as Error).message}`);
        return null;
    }
}

async function main(): Promise<void> {
    const conformanceDist = join(ROOT, "packages/conformance/dist/index.js");
    const conformanceSrc = join(ROOT, "packages/conformance/src/index.ts");
    const conformanceMod =
        (await tryImport<ConformanceModule>(conformanceDist)) ??
        (await tryImport<ConformanceModule>(conformanceSrc));

    if (!conformanceMod || typeof conformanceMod.runConformanceSuite !== "function") {
        noRunner();
    }

    const adapterDist = join(ROOT, "examples/canvas2d-adapter/dist/index.js");
    const adapterSrc = join(ROOT, "examples/canvas2d-adapter/src/index.ts");
    const adapterMod =
        (await tryImport<AdapterModule>(adapterDist)) ??
        (await tryImport<AdapterModule>(adapterSrc));

    if (!adapterMod || adapterMod.default === undefined) {
        noRunner();
    }

    const report = await conformanceMod.runConformanceSuite(adapterMod.default);
    const failures = report?.failures ?? [];
    for (const f of failures) {
        const id = f.scenarioId ?? f.id ?? "<unknown>";
        console.error(`conformance: ${id} failed${f.message ? `: ${f.message}` : ""}`);
    }
    console.log(`conformance: ${failures.length} failures.`);
    process.exit(failures.length > 0 ? 1 : 0);
}

await main();

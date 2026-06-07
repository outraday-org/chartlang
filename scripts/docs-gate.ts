#!/usr/bin/env tsx
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
/**
 * `pnpm docs:gate` — regenerates every `docs/primitives/ta/<id>.md`
 * and `docs/primitives/draw/<kebab-kind>.md` page into a tmp
 * directory, then byte-compares each tmp file against the committed
 * sibling. Exits 0 on a clean tree, 1 on any drift.
 *
 * The companion to `pnpm docs:check` (Phase 1 — executes `@example`
 * blocks through the compiler). This gate enforces that the
 * `docs/primitives/{ta,draw}/*.md` files are in sync with the
 * runtime's JSDoc. Phase-2 §22.10 requires every port to commit the
 * regenerated page in the same PR; this gate is the guardrail.
 *
 * Drift cases handled:
 *
 * - tmp file exists, committed file missing → "missing committed page"
 * - committed file exists, tmp file missing → "stale committed page"
 *   (the primitive was removed but the page wasn't)
 * - both exist but bytes differ → "out-of-date page"
 *
 * Index pages (anything not named `<id>.md` in the per-port set —
 * today only `index.md`) are ignored: those are hand-written.
 */
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

import { runGenDrawingDocs } from "../packages/cli/src/commands/extractDrawingPages";
import { runGenDocs } from "../packages/cli/src/commands/genDocs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolvePath(HERE, "..");
const TA_SOURCE_DIR = resolvePath(REPO_ROOT, "packages/runtime/src/ta");
const TA_COMMITTED_DIR = resolvePath(REPO_ROOT, "docs/primitives/ta");
const DRAW_SOURCE_DIR = resolvePath(REPO_ROOT, "packages/runtime/src/emit/draw");
const DRAW_COMMITTED_DIR = resolvePath(REPO_ROOT, "docs/primitives/draw");
const HAND_WRITTEN = new Set(["index.md"]);

type Drift =
    | { readonly kind: "missing-committed"; readonly path: string }
    | { readonly kind: "stale-committed"; readonly path: string }
    | { readonly kind: "out-of-date"; readonly path: string };

async function listGeneratedNames(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
        .filter((e) => e.isFile() && e.name.endsWith(".md") && !HAND_WRITTEN.has(e.name))
        .map((e) => e.name)
        .sort();
}

async function diffTree(tmpDir: string, committedDir: string): Promise<Drift[]> {
    const tmpNames = await listGeneratedNames(tmpDir);
    const committedNames = await listGeneratedNames(committedDir);
    const drift: Drift[] = [];

    const allNames = new Set<string>([...tmpNames, ...committedNames]);
    for (const name of Array.from(allNames).sort()) {
        const tmpPath = join(tmpDir, name);
        const committedPath = join(committedDir, name);
        const inTmp = tmpNames.includes(name);
        const inCommitted = committedNames.includes(name);
        if (inTmp && !inCommitted) {
            drift.push({ kind: "missing-committed", path: committedPath });
            continue;
        }
        if (!inTmp && inCommitted) {
            drift.push({ kind: "stale-committed", path: committedPath });
            continue;
        }
        const [tmpContent, committedContent] = await Promise.all([
            readFile(tmpPath, "utf8"),
            readFile(committedPath, "utf8"),
        ]);
        if (tmpContent !== committedContent) {
            drift.push({ kind: "out-of-date", path: committedPath });
        }
    }
    return drift;
}

async function runGate(): Promise<{ readonly drift: ReadonlyArray<Drift> }> {
    const taTmpDir = await mkdtemp(join(tmpdir(), "chartlang-docs-gate-ta-"));
    const drawTmpDir = await mkdtemp(join(tmpdir(), "chartlang-docs-gate-draw-"));
    try {
        await runGenDocs({
            sourceDir: TA_SOURCE_DIR,
            outDir: taTmpDir,
            repoRoot: REPO_ROOT,
        });
        await runGenDrawingDocs({
            sourceDir: DRAW_SOURCE_DIR,
            outDir: drawTmpDir,
            repoRoot: REPO_ROOT,
        });

        const [taDrift, drawDrift] = await Promise.all([
            diffTree(taTmpDir, TA_COMMITTED_DIR),
            diffTree(drawTmpDir, DRAW_COMMITTED_DIR),
        ]);
        return { drift: [...taDrift, ...drawDrift] };
    } finally {
        await rm(taTmpDir, { recursive: true, force: true });
        await rm(drawTmpDir, { recursive: true, force: true });
    }
}

async function main(): Promise<void> {
    const { drift } = await runGate();
    for (const d of drift) {
        if (d.kind === "missing-committed") {
            console.error(
                `${d.path}: missing committed page (run \`pnpm docs:generate\` and commit)`,
            );
        } else if (d.kind === "stale-committed") {
            console.error(
                `${d.path}: primitive removed but page still committed (delete the page)`,
            );
        } else {
            console.error(`${d.path}: out of date (run \`pnpm docs:generate\` and commit)`);
        }
    }
    if (drift.length === 0) {
        console.log("docs:gate — every primitive page matches its generator output.");
    }
    process.exit(drift.length > 0 ? 1 : 0);
}

await main();

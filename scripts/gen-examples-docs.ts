#!/usr/bin/env tsx
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
/**
 * `pnpm examples:generate` — the example artifact pipeline. From
 * `examples/catalogue.ts` (metadata) + each `examples/scripts/<id>.chart.ts`
 * source it regenerates, in order:
 *
 * 1. `apps/site/src/components/demo/scripts.ts` (`DEMO_SCRIPTS`) and
 *    `examples/catalogue.json` (via `gen-demo-scripts.ts`), and
 * 2. `docs/examples/index.md` + one `docs/examples/<id>.md` per example,
 *    rendered from the SAME in-memory catalogue data so the docs and the
 *    live demo never show different code.
 *
 * `--check` (`pnpm examples:gate`) regenerates everything in memory and
 * byte-diffs each output against the committed tree — failing on drift,
 * on a missing page, and on a stale page the catalogue no longer
 * produces. Mirrors the `docs-gate.ts` gate convention.
 *
 * Never hand-edit `docs/examples/*.md`, `scripts.ts`, or `catalogue.json`
 * — re-run `pnpm examples:generate`.
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
    CATALOGUE_JSON_PATH,
    EXAMPLES_PKG_OUT_PATH,
    type ExampleData,
    SCRIPTS_OUT_PATH,
    collectExampleData,
    renderCatalogueJson,
    renderExamplesPackageModule,
    renderScriptsModule,
} from "./gen-demo-scripts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(REPO_ROOT, "docs/examples");
// The demo lives on the landing page anchored at `#demo`; `?script=<id>`
// preselects the catalogue entry (see DemoBody.tsx).
const DEMO_BASE_URL = "https://chartlang.invinite.com";

export const OUT_OF_DATE_MESSAGE =
    "Example artifacts are out of date. Run pnpm examples:generate and commit (scripts.ts, examples/catalogue.json, packages/examples/src/catalogue.generated.ts, docs/examples).";

function liveUrl(id: string): string {
    return `${DEMO_BASE_URL}/?script=${id}#demo`;
}

function renderExample(script: ExampleData): string {
    const head = [
        `# ${script.label}`,
        "",
        script.description,
        "",
        `[Try it live](${liveUrl(script.id)})`,
        "",
        "```ts",
    ].join("\n");
    // `source` already ends with a trailing newline, so the closing
    // fence lands on its own line without an extra separator.
    return `${head}\n${script.source}\`\`\`\n`;
}

function renderIndex(scripts: ReadonlyArray<ExampleData>): string {
    const lines = [
        "# Examples",
        "",
        "A catalogue of chartlang scripts — the same set you can edit live in the",
        `[demo](${DEMO_BASE_URL}/#demo). Each page shows the full source and links`,
        "back to run it in your browser.",
        "",
    ];
    for (const script of scripts) {
        lines.push(`- [${script.label}](/examples/${script.id}) — ${script.description}`);
    }
    lines.push("");
    return lines.join("\n");
}

/**
 * Pure renderer — maps the catalogue to a `<relative path> → contents`
 * set. No IO, so the writer and the `--check` gate share one source of
 * truth for what the tree should contain.
 */
export function renderExampleDocs(
    scripts: ReadonlyArray<ExampleData>,
): ReadonlyMap<string, string> {
    const files = new Map<string, string>();
    files.set("index.md", renderIndex(scripts));
    for (const script of scripts) {
        files.set(`${script.id}.md`, renderExample(script));
    }
    return files;
}

async function listCommittedPages(): Promise<ReadonlyArray<string>> {
    let entries: Awaited<ReturnType<typeof readdir>>;
    try {
        entries = await readdir(OUT_DIR);
    } catch {
        return [];
    }
    return entries.filter((name) => name.endsWith(".md")).sort();
}

async function checkFile(path: string, expected: string, failures: string[]): Promise<void> {
    let existing: string | null = null;
    try {
        existing = await readFile(path, "utf8");
    } catch {
        failures.push(`${relative(REPO_ROOT, path)}: missing committed file`);
        return;
    }
    if (existing !== expected) {
        failures.push(`${relative(REPO_ROOT, path)}: out of date`);
    }
}

/**
 * Regenerate every example artifact. `check: true` byte-diffs each
 * regenerated output against the committed file (failing on drift /
 * missing / stale, like `docs-gate.ts`); otherwise writes them.
 */
export async function generateExampleArtifacts(
    opts: Readonly<{ check?: boolean }> = {},
): Promise<void> {
    const data = await collectExampleData();
    const scriptsModule = renderScriptsModule(data);
    const catalogueJson = renderCatalogueJson(data);
    const packageModule = renderExamplesPackageModule(data);
    const docs = renderExampleDocs(data);

    if (opts.check === true) {
        const failures: string[] = [];
        await checkFile(SCRIPTS_OUT_PATH, scriptsModule, failures);
        await checkFile(CATALOGUE_JSON_PATH, catalogueJson, failures);
        await checkFile(EXAMPLES_PKG_OUT_PATH, packageModule, failures);
        for (const [name, contents] of docs) {
            await checkFile(join(OUT_DIR, name), contents, failures);
        }
        for (const name of await listCommittedPages()) {
            if (!docs.has(name)) {
                failures.push(
                    `${relative(REPO_ROOT, join(OUT_DIR, name))}: stale page (no matching example)`,
                );
            }
        }
        if (failures.length > 0) {
            for (const failure of failures) console.error(failure);
            throw new Error(OUT_OF_DATE_MESSAGE);
        }
        return;
    }

    await writeFile(SCRIPTS_OUT_PATH, scriptsModule, "utf8");
    await writeFile(CATALOGUE_JSON_PATH, catalogueJson, "utf8");
    await writeFile(EXAMPLES_PKG_OUT_PATH, packageModule, "utf8");
    await mkdir(OUT_DIR, { recursive: true });
    for (const [name, contents] of docs) {
        await writeFile(join(OUT_DIR, name), contents, "utf8");
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const check = process.argv.includes("--check");
    generateExampleArtifacts({ check }).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error(message);
        process.exitCode = 1;
    });
}

#!/usr/bin/env tsx
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
/**
 * `pnpm examples:generate` — renders the docs Examples section from the
 * demo catalogue. `apps/site/src/components/demo/scripts.ts`'s
 * `DEMO_SCRIPTS` is the single source of truth; this script emits
 * `docs/examples/index.md` plus one `docs/examples/<id>.md` per example
 * so the docs and the live demo never show different code.
 *
 * `--check` (`pnpm examples:gate`) regenerates in memory and byte-diffs
 * against the committed tree — failing on drift, on a missing page, and
 * on a stale page the catalogue no longer produces. Mirrors the
 * `docs-gate.ts` / `generate-skills-reference.ts` gate convention.
 *
 * Never hand-edit `docs/examples/*.md` — re-run `pnpm examples:generate`.
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { DEMO_SCRIPTS } from "../apps/site/src/components/demo/scripts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(REPO_ROOT, "docs/examples");
// The demo lives on the landing page anchored at `#demo`; `?script=<id>`
// preselects the catalogue entry (see DemoBody.tsx).
const DEMO_BASE_URL = "https://chartlang.invinite.com";

export const OUT_OF_DATE_MESSAGE =
    "docs/examples is out of date. Run pnpm examples:generate and commit.";

function liveUrl(id: string): string {
    return `${DEMO_BASE_URL}/?script=${id}#demo`;
}

function renderExample(script: (typeof DEMO_SCRIPTS)[number]): string {
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

function renderIndex(scripts: ReadonlyArray<(typeof DEMO_SCRIPTS)[number]>): string {
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
    scripts: ReadonlyArray<(typeof DEMO_SCRIPTS)[number]>,
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

/**
 * Generate the Examples docs. `check: true` byte-diffs the regenerated
 * tree against the committed pages (failing on drift / missing / stale,
 * like `docs-gate.ts`); otherwise writes the files.
 */
export async function generateExampleDocs(opts: Readonly<{ check?: boolean }> = {}): Promise<void> {
    const files = renderExampleDocs(DEMO_SCRIPTS);

    if (opts.check === true) {
        const failures: string[] = [];
        for (const [name, contents] of files) {
            const path = join(OUT_DIR, name);
            let existing: string | null = null;
            try {
                existing = await readFile(path, "utf8");
            } catch {
                failures.push(`${relative(REPO_ROOT, path)}: missing committed page`);
                continue;
            }
            if (existing !== contents) {
                failures.push(`${relative(REPO_ROOT, path)}: out of date`);
            }
        }
        for (const name of await listCommittedPages()) {
            if (!files.has(name)) {
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

    await mkdir(OUT_DIR, { recursive: true });
    for (const [name, contents] of files) {
        await writeFile(join(OUT_DIR, name), contents, "utf8");
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const check = process.argv.includes("--check");
    generateExampleDocs({ check }).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error(message);
        process.exitCode = 1;
    });
}

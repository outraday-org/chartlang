#!/usr/bin/env tsx
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
/**
 * `pnpm docs:snippets` — compile every chart-script fenced TypeScript
 * block inside the user-facing entry docs through the real chartlang
 * compiler. Stops the docs hero-example / quickstart / walkthrough from
 * silently rotting against the live API.
 *
 * Files scanned:
 *
 *   - `README.md` (root)
 *   - `docs/index.md`
 *   - `docs/getting-started/*.md`
 *
 * Block classification (see `docs-snippets.parse.ts`):
 *
 *   - ```ts``` or ```typescript``` blocks containing BOTH a chartlang
 *     import (`from "@invinite-org/chartlang-`) AND a `defineX(` call
 *     are compiled via `@invinite-org/chartlang-compiler`. Any
 *     diagnostic fails the gate.
 *   - ```ts no-gate``` / ```typescript no-gate``` blocks are explicit
 *     opt-outs — used for consumer-side code that imports things the
 *     gate can't resolve (e.g. an in-flight adapter, a Vite plugin).
 *   - Every other ts block is "consumer" and passes through unchecked.
 *     Full typechecking of arbitrary consumer code is more pain than
 *     payoff at gate time; the chart-script blocks are the load-bearing
 *     hero examples and they are gated by default.
 *
 * Exits 0 on a clean tree, 1 on any failed compilation.
 */
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

import { CompileError, compile } from "@invinite-org/chartlang-compiler";

import { extractSnippets } from "./docs-snippets.parse.js";
import type { Snippet } from "./docs-snippets.parse.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolvePath(HERE, "..");

type Failure = { file: string; line: number; reason: string };

async function listGettingStarted(): Promise<string[]> {
    const dir = join(REPO_ROOT, "docs/getting-started");
    if (!existsSync(dir)) return [];
    const entries = await readdir(dir);
    return entries
        .filter((name) => name.endsWith(".md") && name !== "CLAUDE.md")
        .map((name) => join(dir, name))
        .sort();
}

async function listTargetFiles(): Promise<string[]> {
    const base = [join(REPO_ROOT, "README.md"), join(REPO_ROOT, "docs/index.md")];
    const gs = await listGettingStarted();
    return [...base, ...gs].filter((p) => existsSync(p));
}

async function compileSnippet(snippet: Snippet): Promise<Failure | null> {
    try {
        await compile(snippet.body, {
            apiVersion: 1,
            sourcePath: `__docs_snippet__/${snippet.file}:${snippet.line}.chart.ts`,
        });
        return null;
    } catch (err) {
        if (err instanceof CompileError) {
            const first = err.diagnostics[0];
            const reason =
                first === undefined
                    ? "compile failed with no diagnostics"
                    : `${first.code}: ${first.message}`;
            return { file: snippet.file, line: snippet.line, reason };
        }
        const message = err instanceof Error ? err.message : String(err);
        return { file: snippet.file, line: snippet.line, reason: `threw: ${message}` };
    }
}

/**
 * Internal entry-point exposed for `docs-snippets-check.test.ts`. Walks
 * every target file, parses ts blocks, compiles every `chart-script`
 * block, and returns the per-snippet failures plus a summary count.
 *
 * @since 0.8
 * @stable
 * @example
 *     const { failures, totalSnippets, compiledSnippets } = await runDocsSnippets();
 *     void failures;
 *     void totalSnippets;
 *     void compiledSnippets;
 */
export async function runDocsSnippets(): Promise<{
    readonly failures: ReadonlyArray<Failure>;
    readonly totalSnippets: number;
    readonly compiledSnippets: number;
}> {
    const files = await listTargetFiles();
    const snippets: Snippet[] = [];
    for (const file of files) {
        const rel = relative(REPO_ROOT, file);
        const md = await readFile(file, "utf8");
        snippets.push(...extractSnippets(rel, md));
    }
    const toCompile = snippets.filter((s) => s.kind === "chart-script");
    const results = await Promise.all(toCompile.map(compileSnippet));
    const failures = results.filter((r): r is Failure => r !== null);
    return Object.freeze({
        failures: Object.freeze(failures),
        totalSnippets: snippets.length,
        compiledSnippets: toCompile.length,
    });
}

async function main(): Promise<void> {
    const { failures, totalSnippets, compiledSnippets } = await runDocsSnippets();
    for (const f of failures) {
        console.error(`${f.file}:${f.line}: ${f.reason}`);
    }
    console.log(
        `\ndocs:snippets — ${totalSnippets} ts blocks scanned, ` +
            `${compiledSnippets} compiled, ${failures.length} failed.`,
    );
    process.exit(failures.length > 0 ? 1 : 0);
}

// Run only when invoked as the entry script, not when imported by tests.
const ENTRY = fileURLToPath(import.meta.url);
if (process.argv[1] === ENTRY) {
    await main();
}

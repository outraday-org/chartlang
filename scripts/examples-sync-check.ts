#!/usr/bin/env tsx
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
/**
 * `pnpm examples:sync` — guards the ONE duplication the docs pipeline
 * cannot: every `examples/scripts/<id>.chart.ts` file is hand-mirrored
 * by a `DEMO_SCRIPTS` entry of the same `id` in
 * `apps/site/src/components/demo/scripts.ts` (the example files are real
 * on-disk sources driven by the CLI e2e + conformance suites; the demo
 * copies are inlined string literals the browser bundle compiles in
 * place, so they cannot share a single file). `docs/examples/*.md` is
 * already generated from `DEMO_SCRIPTS` (`pnpm examples:gate`), so those
 * never drift — but nothing tied the two hand-maintained *code* copies
 * together until this gate.
 *
 * The two copies legitimately differ in COMMENTS (the demo strings drop
 * backticks for markdown safety and re-wrap prose) and in WHITESPACE
 * (Biome ignores `apps/**`). So the gate compares the two with comments
 * and whitespace normalized away — only the executable code must match.
 *
 * Mapping is by `id`: a `DEMO_SCRIPTS` entry is checked against
 * `examples/scripts/<id>.chart.ts` when that file exists; demo-only
 * entries (no matching file) are skipped and reported for visibility.
 *
 * This is a pure check (nothing to generate). Exits non-zero on any
 * mismatch, printing the full punch-list per the gate-script convention.
 */
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

import { DEMO_SCRIPTS } from "../apps/site/src/components/demo/scripts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXAMPLES_DIR = join(REPO_ROOT, "examples/scripts");

const CLOSERS = new Set<ts.SyntaxKind>([
    ts.SyntaxKind.CloseParenToken,
    ts.SyntaxKind.CloseBracketToken,
    ts.SyntaxKind.CloseBraceToken,
]);

/**
 * Reduce a source to its token stream so two copies that differ only in
 * comments, whitespace, line wrapping, or trailing commas compare equal —
 * the legitimate differences between a Biome-formatted example file and a
 * hand-formatted `apps/**` demo string (Biome ignores `apps/**`). We scan
 * with the TypeScript scanner (trivia — whitespace AND comments — skipped),
 * then drop trailing commas (a comma immediately before `)`/`]`/`}`), which
 * are syntactic no-ops the two formatters place differently. Only a real
 * code change (a reordered/added/removed token) survives normalization.
 */
export function normalizeSource(src: string): string {
    const scanner = ts.createScanner(
        ts.ScriptTarget.Latest,
        /* skipTrivia */ true,
        ts.LanguageVariant.Standard,
        src,
    );
    const kinds: ts.SyntaxKind[] = [];
    const texts: string[] = [];
    for (let k = scanner.scan(); k !== ts.SyntaxKind.EndOfFileToken; k = scanner.scan()) {
        kinds.push(k);
        texts.push(scanner.getTokenText());
    }
    const out: string[] = [];
    for (let i = 0; i < kinds.length; i++) {
        if (
            kinds[i] === ts.SyntaxKind.CommaToken &&
            i + 1 < kinds.length &&
            CLOSERS.has(kinds[i + 1])
        ) {
            continue; // trailing comma — formatter noise, not code
        }
        out.push(texts[i]);
    }
    return out.join(" ");
}

async function main(): Promise<void> {
    const files = (await readdir(EXAMPLES_DIR)).filter((f) => f.endsWith(".chart.ts"));
    const fileIds = new Set(files.map((f) => f.replace(/\.chart\.ts$/, "")));

    const mismatches: string[] = [];
    const demoOnly: string[] = [];
    const checked: string[] = [];

    for (const entry of DEMO_SCRIPTS) {
        if (!fileIds.has(entry.id)) {
            demoOnly.push(entry.id);
            continue;
        }
        const filePath = join(EXAMPLES_DIR, `${entry.id}.chart.ts`);
        const fileSource = await readFile(filePath, "utf8");
        if (normalizeSource(fileSource) !== normalizeSource(entry.source)) {
            mismatches.push(entry.id);
        } else {
            checked.push(entry.id);
        }
    }

    const exampleOnly = [...fileIds].filter((id) => !DEMO_SCRIPTS.some((e) => e.id === id));

    console.log(
        `examples:sync — ${checked.length} mirrored pair(s) in sync; ` +
            `${demoOnly.length} demo-only; ${exampleOnly.length} example-only.`,
    );
    if (demoOnly.length > 0) {
        console.log(`  demo-only (no examples/scripts file): ${demoOnly.join(", ")}`);
    }
    if (exampleOnly.length > 0) {
        console.log(`  example-only (no DEMO_SCRIPTS entry): ${exampleOnly.join(", ")}`);
    }

    if (mismatches.length > 0) {
        console.error(
            "\nThe following examples/scripts files drifted from their " +
                "DEMO_SCRIPTS mirror (code differs, ignoring comments + " +
                "whitespace):",
        );
        for (const id of mismatches) {
            console.error(
                `  - ${id}: examples/scripts/${id}.chart.ts ≠ DEMO_SCRIPTS["${id}"].source`,
            );
        }
        console.error(
            "\nUpdate BOTH copies. The demo string lives in " +
                "apps/site/src/components/demo/scripts.ts; after editing it " +
                "re-run pnpm examples:generate to refresh docs/examples/*.md.",
        );
        process.exit(1);
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}

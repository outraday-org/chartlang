#!/usr/bin/env tsx
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
/**
 * `pnpm examples:idioms` — the language-IDIOM coverage gate. It is the
 * orthogonal sibling of `examples:coverage`: where that gate keys off the
 * `docs/primitives/**` page tree, this one keys off a committed
 * `examples/idiom-manifest.json` (the canonical idiom list — language pages
 * are narrative, not 1:1 with idioms), then asserts every manifest id appears
 * in ≥1 `EXAMPLE_CATALOGUE` entry's `idioms` array.
 *
 * Fails (structured stderr + exit 1, mirroring `examples-coverage.ts` /
 * `docs-gate.ts`) when:
 *  - MISSING — a manifest idiom id has no covering catalogue example;
 *  - UNKNOWN — a catalogue `idioms` id is absent from the manifest;
 *  - UNREPRESENTED_PAGE — a `docs/language/*.md` page is neither paired with a
 *    manifest idiom nor in the manifest's `unrepresentedPages` allow-list (see
 *    the forbidden-constructs note in the manifest).
 */
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { EXAMPLE_CATALOGUE, type ExampleMeta } from "../examples/catalogue";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LANGUAGE_DIR = join(REPO_ROOT, "docs/language");
const MANIFEST_PATH = join(REPO_ROOT, "examples/idiom-manifest.json");

/** Prefix that marks a manifest `page` as a `docs/language/<name>.md` page. */
const LANGUAGE_PAGE_PREFIX = "language/";

/** One idiom target: a `lang.*` id paired with its narrative doc page. */
export type IdiomEntry = Readonly<{ id: string; page: string }>;

/** A `docs/language/*.md` page intentionally excluded from the idiom set. */
export type UnrepresentedPage = Readonly<{ page: string; reason: string }>;

/** The parsed `examples/idiom-manifest.json` shape. */
export type IdiomManifest = Readonly<{
    idioms: ReadonlyArray<IdiomEntry>;
    unrepresentedPages: ReadonlyArray<UnrepresentedPage>;
}>;

/**
 * Parse + validate the idiom manifest JSON. Throws on a malformed shape so a
 * hand-edit that drops a field fails loudly instead of silently passing.
 */
export function parseManifest(raw: string): IdiomManifest {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
        throw new Error(`${MANIFEST_PATH}: expected a JSON object`);
    }
    const record = parsed as Record<string, unknown>;
    const idioms = record.idioms;
    const unrepresentedPages = record.unrepresentedPages;
    if (
        !Array.isArray(idioms) ||
        !idioms.every(
            (x): x is IdiomEntry =>
                typeof x === "object" &&
                x !== null &&
                typeof (x as IdiomEntry).id === "string" &&
                typeof (x as IdiomEntry).page === "string",
        )
    ) {
        throw new Error(`${MANIFEST_PATH}: \`idioms\` must be a [{ id, page }] array`);
    }
    if (
        !Array.isArray(unrepresentedPages) ||
        !unrepresentedPages.every(
            (x): x is UnrepresentedPage =>
                typeof x === "object" &&
                x !== null &&
                typeof (x as UnrepresentedPage).page === "string" &&
                typeof (x as UnrepresentedPage).reason === "string",
        )
    ) {
        throw new Error(
            `${MANIFEST_PATH}: \`unrepresentedPages\` must be a [{ page, reason }] array`,
        );
    }
    return { idioms, unrepresentedPages };
}

/** The canonical idiom id set the manifest declares. */
export function collectTargetIds(manifest: IdiomManifest): ReadonlySet<string> {
    return new Set(manifest.idioms.map((entry) => entry.id));
}

/** Union of every `idioms` credit across the catalogue. */
export function collectCoveredIds(catalogue: ReadonlyArray<ExampleMeta>): ReadonlySet<string> {
    const covered = new Set<string>();
    for (const entry of catalogue) {
        for (const id of entry.idioms ?? []) covered.add(id);
    }
    return covered;
}

/** The set of `docs/language/<name>` page ids (without `.md`, excluding `index.md`). */
export async function collectLanguagePages(dir: string): Promise<ReadonlySet<string>> {
    const entries = await readdir(dir);
    const pages = new Set<string>();
    for (const name of entries) {
        if (name.endsWith(".md") && name !== "index.md") {
            pages.add(name.slice(0, -".md".length));
        }
    }
    return pages;
}

/**
 * The `docs/language/<name>` page ids paired with a manifest idiom — derived
 * from idiom `page` fields that begin with `language/`.
 */
export function collectRepresentedPages(manifest: IdiomManifest): ReadonlySet<string> {
    const pages = new Set<string>();
    for (const entry of manifest.idioms) {
        if (entry.page.startsWith(LANGUAGE_PAGE_PREFIX)) {
            pages.add(entry.page.slice(LANGUAGE_PAGE_PREFIX.length));
        }
    }
    return pages;
}

/** Structured idiom-gate result. */
export type IdiomReport = Readonly<{
    missing: ReadonlyArray<string>;
    unknown: ReadonlyArray<string>;
    unrepresentedPages: ReadonlyArray<string>;
}>;

/** Pure gate logic — no IO, so the unit test drives every branch directly. */
export function analyze(args: {
    readonly targetIds: ReadonlySet<string>;
    readonly coveredIds: ReadonlySet<string>;
    readonly languagePages: ReadonlySet<string>;
    readonly representedPages: ReadonlySet<string>;
    readonly allowlistPages: ReadonlyArray<string>;
}): IdiomReport {
    const allow = new Set(args.allowlistPages);
    const missing: string[] = [];
    for (const id of args.targetIds) {
        if (!args.coveredIds.has(id)) missing.push(id);
    }
    const unknown: string[] = [];
    for (const id of args.coveredIds) {
        if (!args.targetIds.has(id)) unknown.push(id);
    }
    const unrepresentedPages: string[] = [];
    for (const page of args.languagePages) {
        if (!args.representedPages.has(page) && !allow.has(page)) unrepresentedPages.push(page);
    }
    return {
        missing: missing.sort(),
        unknown: unknown.sort(),
        unrepresentedPages: unrepresentedPages.sort(),
    };
}

async function main(): Promise<void> {
    const [rawManifest, languagePages] = await Promise.all([
        readFile(MANIFEST_PATH, "utf8"),
        collectLanguagePages(LANGUAGE_DIR),
    ]);
    const manifest = parseManifest(rawManifest);
    const report = analyze({
        targetIds: collectTargetIds(manifest),
        coveredIds: collectCoveredIds(EXAMPLE_CATALOGUE),
        languagePages,
        representedPages: collectRepresentedPages(manifest),
        allowlistPages: manifest.unrepresentedPages.map((p) => p.page),
    });

    for (const id of report.missing) {
        console.error(
            `MISSING ${id}: manifest idiom has no example crediting it in EXAMPLE_CATALOGUE.idioms`,
        );
    }
    for (const id of report.unknown) {
        console.error(
            `UNKNOWN ${id}: a catalogue \`idioms\` credit is absent from examples/idiom-manifest.json`,
        );
    }
    for (const page of report.unrepresentedPages) {
        console.error(
            `UNREPRESENTED_PAGE docs/language/${page}.md: no idiom is paired with this page and it is not in the manifest \`unrepresentedPages\` allow-list`,
        );
    }

    const total = report.missing.length + report.unknown.length + report.unrepresentedPages.length;
    if (total === 0) {
        console.log(
            `examples:idioms — every manifest idiom has an example and every language page is represented or allow-listed (${manifest.idioms.length} idioms, ${languagePages.size} language pages).`,
        );
    }
    process.exit(total > 0 ? 1 : 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch((err: unknown) => {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
    });
}

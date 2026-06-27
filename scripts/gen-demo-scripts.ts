#!/usr/bin/env tsx
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
/**
 * Generator for the two machine-derived example artifacts:
 *
 * - `apps/site/src/components/demo/scripts.ts` — the `DEMO_SCRIPTS` the
 *   live demo + the docs Examples section consume, with each `source`
 *   inlined verbatim from its `examples/scripts/<id>.chart.ts` file.
 * - `examples/catalogue.json` — the machine-readable
 *   `{ id, label, description, category, primitives, source }[]` the
 *   published `@invinite-org/chartlang-examples` package (Task 23) wraps.
 * - `packages/examples/src/catalogue.generated.ts` — the **published**
 *   package's data module: a self-contained TS source that inlines the
 *   taxonomy (`ExampleCategory` / `CATEGORY_LABELS` / `CATEGORY_ORDER`),
 *   the `ExampleMeta` / `ExampleMetaWithSource` types, and
 *   `EXAMPLE_CATALOGUE` (the same payload as `examples/catalogue.json`).
 *   It is self-contained — never importing repo-root `examples/` — so it
 *   compiles under the package's `rootDir: ./src` and ships in `dist`.
 *
 * All are derived from `examples/catalogue.ts` (metadata) + the on-disk
 * `.chart.ts` sources. This module exports the pure renderers + the IO
 * collector so `gen-examples-docs.ts` can fold them into
 * `pnpm examples:generate` / `pnpm examples:gate` and byte-diff them.
 *
 * A catalogue id with no `.chart.ts`, or a stray `.chart.ts` with no
 * catalogue entry, is a hard error — the homes stay in sync by
 * construction.
 *
 * Never hand-edit `apps/site/src/components/demo/scripts.ts`,
 * `examples/catalogue.json`, or
 * `packages/examples/src/catalogue.generated.ts` — re-run
 * `pnpm examples:generate`.
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
    CATEGORY_LABELS,
    CATEGORY_ORDER,
    EXAMPLE_CATALOGUE,
    type ExampleMeta,
} from "../examples/catalogue";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS_SOURCE_DIR = join(REPO_ROOT, "examples/scripts");
const CHART_SUFFIX = ".chart.ts";

/** The committed generated outputs (also the `--check` byte-diff targets). */
export const SCRIPTS_OUT_PATH = join(REPO_ROOT, "apps/site/src/components/demo/scripts.ts");
export const CATALOGUE_JSON_PATH = join(REPO_ROOT, "examples/catalogue.json");
export const EXAMPLES_PKG_OUT_PATH = join(
    REPO_ROOT,
    "packages/examples/src/catalogue.generated.ts",
);

// Relative import the generated `scripts.ts` uses to re-export the shared
// taxonomy: `apps/site/src/components/demo/` → repo-root `examples/`.
const CATALOGUE_IMPORT = "../../../../../examples/catalogue";

/** One catalogue entry with its inlined `.chart.ts` source. */
export type ExampleData = ExampleMeta & Readonly<{ source: string }>;

/** Screaming-snake const identifier for an example id (`ema-cross` → `EMA_CROSS`). */
function constName(id: string): string {
    return id.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

/**
 * Escape a `.chart.ts` source for embedding in a backtick template
 * literal: backslashes, backticks, and `${` interpolation openers.
 */
export function toTemplateLiteral(source: string): string {
    return source.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

/**
 * Read every catalogue entry's `.chart.ts` source. Throws if a catalogue
 * id has no source file or an on-disk `.chart.ts` has no catalogue entry.
 */
export async function collectExampleData(): Promise<ReadonlyArray<ExampleData>> {
    const failures: string[] = [];
    const data: ExampleData[] = [];

    for (const meta of EXAMPLE_CATALOGUE) {
        const file = join(SCRIPTS_SOURCE_DIR, `${meta.id}${CHART_SUFFIX}`);
        try {
            const source = await readFile(file, "utf8");
            data.push({ ...meta, source });
        } catch {
            failures.push(
                `examples/scripts/${meta.id}${CHART_SUFFIX}: catalogue entry has no source file`,
            );
        }
    }

    const catalogued = new Set(EXAMPLE_CATALOGUE.map((m) => m.id));
    const entries = await readdir(SCRIPTS_SOURCE_DIR);
    for (const name of entries) {
        if (!name.endsWith(CHART_SUFFIX)) continue;
        const id = name.slice(0, -CHART_SUFFIX.length);
        if (!catalogued.has(id)) {
            failures.push(`examples/scripts/${name}: source file has no catalogue entry`);
        }
    }

    if (failures.length > 0) {
        for (const failure of failures.sort()) console.error(failure);
        throw new Error(
            "examples catalogue ↔ examples/scripts mismatch. Add the missing catalogue entry or .chart.ts file.",
        );
    }
    return data;
}

/** Render the generated `apps/site/src/components/demo/scripts.ts` module. */
export function renderScriptsModule(data: ReadonlyArray<ExampleData>): string {
    const head = [
        "// Copyright (c) 2026 Invinite. Licensed under the MIT License.",
        "// See the LICENSE file in the repo root for full license text.",
        "//",
        "// AUTO-GENERATED by `pnpm examples:generate` — DO NOT EDIT.",
        "// Source of truth: `examples/catalogue.ts` (metadata) + each",
        "// `examples/scripts/<id>.chart.ts` (the inlined `source`). Re-run",
        "// `pnpm examples:generate` and commit after changing either.",
        "",
        "export { type ExampleCategory, CATEGORY_LABELS, CATEGORY_ORDER } from",
        `    "${CATALOGUE_IMPORT}";`,
        `import type { ExampleCategory } from "${CATALOGUE_IMPORT}";`,
        "",
        "export type DemoScript = Readonly<{",
        "    id: string;",
        "    label: string;",
        "    description: string;",
        "    category: ExampleCategory;",
        "    idioms?: ReadonlyArray<string>;",
        "    source: string;",
        "}>;",
        "",
    ];

    const consts = data.map(
        (entry) => `const ${constName(entry.id)} = \`${toTemplateLiteral(entry.source)}\`;\n`,
    );

    const table = ["export const DEMO_SCRIPTS: ReadonlyArray<DemoScript> = ["];
    for (const entry of data) {
        table.push(
            "    {",
            `        id: ${JSON.stringify(entry.id)},`,
            `        label: ${JSON.stringify(entry.label)},`,
            `        description: ${JSON.stringify(entry.description)},`,
            `        category: ${JSON.stringify(entry.category)},`,
        );
        // `idioms` is set only on `language`-category entries (the idiom-gate
        // signal); omitted everywhere else so primitive entries stay unchanged.
        if (entry.idioms !== undefined && entry.idioms.length > 0) {
            table.push(`        idioms: ${JSON.stringify(entry.idioms)},`);
        }
        table.push(`        source: ${constName(entry.id)},`, "    },");
    }
    table.push("];", "");

    return `${head.join("\n")}\n${consts.join("\n")}\n${table.join("\n")}`;
}

/** Render the generated `examples/catalogue.json` artifact (sources inlined). */
export function renderCatalogueJson(data: ReadonlyArray<ExampleData>): string {
    const entries = data.map((entry) => ({
        id: entry.id,
        label: entry.label,
        description: entry.description,
        category: entry.category,
        primitives: entry.primitives,
        // `idioms` (the idiom-gate signal) is carried only when present so
        // primitive entries stay byte-identical; the published package
        // (Task 23) exposes it for the invinite taxonomy sync (Task 24).
        ...(entry.idioms !== undefined && entry.idioms.length > 0 ? { idioms: entry.idioms } : {}),
        source: entry.source,
    }));
    return `${JSON.stringify(entries, null, 4)}\n`;
}

/**
 * Render the published `@invinite-org/chartlang-examples` data module
 * (`packages/examples/src/catalogue.generated.ts`).
 *
 * The module is **self-contained** — it inlines the taxonomy + types +
 * data rather than importing repo-root `examples/catalogue.ts`, because a
 * published package built with `rootDir: ./src` cannot reach outside its
 * own `src/`. The byte-diff gate (`pnpm examples:gate`) keeps it in
 * lockstep with `examples/catalogue.ts`, so it is generated, never
 * hand-duplicated. JSDoc lives at each declaration so `pnpm docs:check`
 * passes on this `*.generated.ts` (mirrors the host-quickjs precedent).
 */
export function renderExamplesPackageModule(data: ReadonlyArray<ExampleData>): string {
    const head = [
        "// Copyright (c) 2026 Invinite. Licensed under the MIT License.",
        "// See the LICENSE file in the repo root for full license text.",
        "//",
        "// AUTO-GENERATED by `pnpm examples:generate` — DO NOT EDIT.",
        "// Source of truth: `examples/catalogue.ts` (taxonomy + metadata) +",
        "// each `examples/scripts/<id>.chart.ts` (the inlined `source`). The",
        "// `pnpm examples:gate` byte-diff fails if this drifts. Self-contained",
        "// (no repo-root imports) so it ships in the published package's dist.",
        "",
    ];

    const categoryUnion = CATEGORY_ORDER.map((c) => `    | ${JSON.stringify(c)}`).join("\n");
    const labelLines = CATEGORY_ORDER.map(
        (c) => `    ${JSON.stringify(c)}: ${JSON.stringify(CATEGORY_LABELS[c])},`,
    ).join("\n");
    const orderLines = CATEGORY_ORDER.map((c) => `    ${JSON.stringify(c)},`).join("\n");

    const taxonomy = [
        "/**",
        " * Fixed taxonomy shared by the chartlang demo dialog AND downstream",
        " * consumers (the invinite template dialog). Mirrors",
        " * `examples/catalogue.ts`'s `ExampleCategory`.",
        " *",
        " * @since 0.1.0",
        " * @stable",
        " * @example",
        ' *     import type { ExampleCategory } from "@invinite-org/chartlang-examples";',
        ' *     const c: ExampleCategory = "ta-moving-averages";',
        " */",
        "export type ExampleCategory =",
        `${categoryUnion};`,
        "",
        "/**",
        " * Human-readable label for each {@link ExampleCategory}.",
        " *",
        " * @since 0.1.0",
        " * @stable",
        " * @example",
        ' *     import { CATEGORY_LABELS } from "@invinite-org/chartlang-examples";',
        ' *     CATEGORY_LABELS["ta-moving-averages"]; // "TA · Moving Averages"',
        " */",
        "export const CATEGORY_LABELS: Readonly<Record<ExampleCategory, string>> = {",
        labelLines,
        "};",
        "",
        "/**",
        " * Display order of the categories (sidebar / docs grouping).",
        " *",
        " * @since 0.1.0",
        " * @stable",
        " * @example",
        ' *     import { CATEGORY_ORDER } from "@invinite-org/chartlang-examples";',
        " *     for (const category of CATEGORY_ORDER) console.log(category);",
        " */",
        "export const CATEGORY_ORDER: ReadonlyArray<ExampleCategory> = [",
        orderLines,
        "];",
        "",
        "/**",
        " * Metadata for one catalogue example (without its source). `id`",
        " * matches the `examples/scripts/<id>.chart.ts` basename.",
        " *",
        " * @since 0.1.0",
        " * @stable",
        " * @example",
        ' *     import type { ExampleMeta } from "@invinite-org/chartlang-examples";',
        " *     function label(meta: ExampleMeta): string {",
        " *         return `${meta.category}: ${meta.label}`;",
        " *     }",
        " */",
        "export type ExampleMeta = Readonly<{",
        "    id: string;",
        "    label: string;",
        "    description: string;",
        "    category: ExampleCategory;",
        "    primitives: ReadonlyArray<string>;",
        "    idioms?: ReadonlyArray<string>;",
        "}>;",
        "",
        "/**",
        " * An {@link ExampleMeta} with its full `.chart.ts` `source` inlined —",
        " * the shape every {@link EXAMPLE_CATALOGUE} entry takes.",
        " *",
        " * @since 0.1.0",
        " * @stable",
        " * @example",
        ' *     import type { ExampleMetaWithSource } from "@invinite-org/chartlang-examples";',
        " *     function lineCount(meta: ExampleMetaWithSource): number {",
        " *         return meta.source.split(`\\n`).length;",
        " *     }",
        " */",
        "export type ExampleMetaWithSource = ExampleMeta & Readonly<{ source: string }>;",
        "",
    ];

    const consts = data.map(
        (entry) => `const ${constName(entry.id)} = \`${toTemplateLiteral(entry.source)}\`;\n`,
    );

    const table = [
        "/**",
        " * The full example catalogue — every entry's metadata plus its inlined",
        " * `.chart.ts` `source`. Identical payload to `examples/catalogue.json`.",
        " *",
        " * @since 0.1.0",
        " * @stable",
        " * @example",
        ' *     import { EXAMPLE_CATALOGUE } from "@invinite-org/chartlang-examples";',
        " *     const first = EXAMPLE_CATALOGUE[0];",
        " *     console.log(first.id, first.category, first.source.length);",
        " */",
        "export const EXAMPLE_CATALOGUE: ReadonlyArray<ExampleMetaWithSource> = [",
    ];
    for (const entry of data) {
        table.push(
            "    {",
            `        id: ${JSON.stringify(entry.id)},`,
            `        label: ${JSON.stringify(entry.label)},`,
            `        description: ${JSON.stringify(entry.description)},`,
            `        category: ${JSON.stringify(entry.category)},`,
            `        primitives: ${JSON.stringify(entry.primitives)},`,
        );
        if (entry.idioms !== undefined && entry.idioms.length > 0) {
            table.push(`        idioms: ${JSON.stringify(entry.idioms)},`);
        }
        table.push(`        source: ${constName(entry.id)},`, "    },");
    }
    table.push("];", "");

    return `${head.join("\n")}\n${taxonomy.join("\n")}\n${consts.join("\n")}\n${table.join("\n")}`;
}

/** Write every generated artifact to disk. */
export async function writeGeneratedArtifacts(data: ReadonlyArray<ExampleData>): Promise<void> {
    await writeFile(SCRIPTS_OUT_PATH, renderScriptsModule(data), "utf8");
    await writeFile(CATALOGUE_JSON_PATH, renderCatalogueJson(data), "utf8");
    await writeFile(EXAMPLES_PKG_OUT_PATH, renderExamplesPackageModule(data), "utf8");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    collectExampleData()
        .then(writeGeneratedArtifacts)
        .catch((err: unknown) => {
            console.error(err instanceof Error ? err.message : String(err));
            process.exitCode = 1;
        });
}

#!/usr/bin/env tsx
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
/**
 * `pnpm examples:coverage` — the per-primitive coverage gate. It walks
 * the generated `docs/primitives/**` page tree (the canonical primitive
 * id set — no hardcoded list, so the gate self-updates when a primitive
 * lands), then asserts every id appears in ≥1 `EXAMPLE_CATALOGUE` entry's
 * `primitives` array. The gate is **fully enforcing** — `target ⊆ covered`
 * exactly, with no allowlist: every primitive doc page must have an
 * example. (The shrinking `coverage-allowlist.json` was drained to empty
 * and deleted by Task 22 once the catalogue reached full coverage.)
 *
 * Fails (structured stderr + exit 1, mirroring `docs-gate.ts`) when:
 *  - MISSING — a primitive page is not covered by any example;
 *  - UNKNOWN — a catalogue `primitives` id is not a real primitive page.
 */
import { readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { EXAMPLE_CATALOGUE, type ExampleMeta } from "../examples/catalogue";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PRIMITIVES_DIR = join(REPO_ROOT, "docs/primitives");

/** `fib-retracement` → `fibRetracement` (kebab → camelCase). */
function kebabToCamel(name: string): string {
    return name
        .split("-")
        .map((seg, i) => (i === 0 ? seg : seg.charAt(0).toUpperCase() + seg.slice(1)))
        .join("");
}

/**
 * Map a `docs/primitives/**` page path (relative, forward-slashed, never
 * an `index.md`) to its canonical primitive id. Throws on an unrecognised
 * top-level directory so a brand-new primitive namespace forces an
 * explicit mapping decision instead of silently mis-mapping.
 */
export function mapPageToId(relPath: string): string {
    const noExt = relPath.replace(/\.md$/, "");
    const parts = noExt.split("/");
    if (parts.length === 1) {
        // Top-level single-page namespace: `math`, `str`, `session`,
        // `time`, `barstate`, `syminfo`, `timeframe`.
        return parts[0] ?? "";
    }
    const dir = parts[0] ?? "";
    const base = parts[parts.length - 1] ?? "";
    switch (dir) {
        case "ta":
            return `ta.${base}`;
        case "draw":
            return `draw.${kebabToCamel(base)}`;
        case "input":
            return `input.${base}`;
        case "state":
            return base.startsWith("tick-")
                ? `state.tick.${base.slice("tick-".length)}`
                : `state.${base}`;
        case "request":
            return `request.${base}`;
        case "define":
            return `define.${base}`;
        case "plot":
            // `plot/plot.md` → `plot`, `plot/hline.md` → `hline`.
            return base;
        case "alert":
            // `alert/alert.md` → `alert`.
            return base;
        default:
            throw new Error(
                `examples-coverage: unmapped primitive page directory "${dir}" (${relPath})`,
            );
    }
}

/** Recursively collect the canonical id of every `docs/primitives/**` page (excluding `index.md`). */
export async function collectTargetIds(primitivesDir: string): Promise<ReadonlySet<string>> {
    const ids = new Set<string>();
    async function walk(dir: string, prefix: string): Promise<void> {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
            if (entry.isDirectory()) {
                await walk(join(dir, entry.name), rel);
            } else if (entry.name.endsWith(".md") && entry.name !== "index.md") {
                ids.add(mapPageToId(rel));
            }
        }
    }
    await walk(primitivesDir, "");
    return ids;
}

/** Union of every `primitives` credit across the catalogue. */
export function collectCoveredIds(catalogue: ReadonlyArray<ExampleMeta>): ReadonlySet<string> {
    const covered = new Set<string>();
    for (const entry of catalogue) {
        for (const id of entry.primitives) covered.add(id);
    }
    return covered;
}

/** Structured coverage-gate result. */
export type CoverageReport = Readonly<{
    missing: ReadonlyArray<string>;
    unknown: ReadonlyArray<string>;
}>;

/** Pure gate logic — no IO, so the unit test drives every branch directly. */
export function analyze(args: {
    readonly targetIds: ReadonlySet<string>;
    readonly coveredIds: ReadonlySet<string>;
}): CoverageReport {
    const missing: string[] = [];
    for (const id of args.targetIds) {
        if (!args.coveredIds.has(id)) missing.push(id);
    }
    const unknown: string[] = [];
    for (const id of args.coveredIds) {
        if (!args.targetIds.has(id)) unknown.push(id);
    }
    return {
        missing: missing.sort(),
        unknown: unknown.sort(),
    };
}

async function main(): Promise<void> {
    const targetIds = await collectTargetIds(PRIMITIVES_DIR);
    const coveredIds = collectCoveredIds(EXAMPLE_CATALOGUE);
    const report = analyze({ targetIds, coveredIds });

    for (const id of report.missing) {
        console.error(`MISSING ${id}: no example credits this primitive`);
    }
    for (const id of report.unknown) {
        console.error(
            `UNKNOWN ${id}: a catalogue \`primitives\` credit has no docs/primitives page`,
        );
    }

    const total = report.missing.length + report.unknown.length;
    if (total === 0) {
        console.log(
            `examples:coverage — every primitive page has an example (${targetIds.size} pages, ${coveredIds.size} covered, fully enforcing).`,
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

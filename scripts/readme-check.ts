#!/usr/bin/env tsx
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
/**
 * Enforces §17.6 + §17.1: every workspace README has the required
 * structure, the root README has the elevator pitch / install / why /
 * quickstart / architecture-diagram / links sections in order, and
 * length caps are respected (root ≤ 300, packages ≤ 100).
 *
 * Exits 0 on a clean tree, 1 on any violation. Prints every failure so
 * a contributor sees the full punch-list per run.
 */
import { existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();

type Failure = { path: string; reason: string };

const failures: Failure[] = [];
const passes: string[] = [];

function fail(path: string, reason: string): void {
    failures.push({ path, reason });
}

function trimmedLineCount(content: string): number {
    const lines = content.split("\n");
    let end = lines.length;
    while (end > 0 && lines[end - 1]?.trim() === "") end--;
    return end;
}

function stripMarkdown(text: string): string {
    return text
        .replace(/`[^`]*`/g, "")
        .replace(/\*\*/g, "")
        .replace(/(?<!\*)\*(?!\*)/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/<[^>]+>/g, "")
        .trim();
}

function firstParagraph(content: string): string {
    const lines = content.split("\n");
    const start = lines.findIndex((line) => line.trim() !== "" && !line.startsWith("#"));
    if (start === -1) return "";
    const para: string[] = [];
    for (let i = start; i < lines.length; i++) {
        const line = lines[i] ?? "";
        if (line.trim() === "") break;
        if (line.startsWith("#")) break;
        para.push(line);
    }
    return para.join(" ");
}

function wordCount(text: string): number {
    const stripped = stripMarkdown(text);
    if (stripped === "") return 0;
    return stripped.split(/\s+/).length;
}

async function listWorkspacePackages(): Promise<string[]> {
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

async function checkPackageReadme(pkgDir: string): Promise<void> {
    const readmePath = join(pkgDir, "README.md");
    const rel = readmePath.replace(`${ROOT}/`, "");
    if (!existsSync(readmePath)) {
        fail(rel, "README.md missing");
        return;
    }
    const content = await readFile(readmePath, "utf8");

    const lineCount = trimmedLineCount(content);
    if (lineCount > 100) {
        fail(rel, `README is ${lineCount} lines (cap: 100)`);
    }

    const labels = ["experimental", "stable", "frozen"];
    const found = labels.filter((label) => new RegExp(`\\b${label}\\b`, "i").test(content));
    if (found.length === 0) {
        fail(rel, "missing stability label (one of: experimental, stable, frozen)");
    } else if (found.length > 1) {
        fail(rel, `multiple stability labels found: ${found.join(", ")}`);
    }

    const isExampleAdapter = pkgDir.endsWith("examples/canvas2d-adapter");
    const hasInstall =
        /pnpm add\b/.test(content) || (isExampleAdapter && /Not published/i.test(content));
    if (!hasInstall) {
        fail(
            rel,
            "missing install line (`pnpm add ...` or, for the example adapter, 'Not published')",
        );
    }

    const hasSurface = /^#+ .*(public surface|planned)/im.test(content);
    if (!hasSurface) {
        fail(rel, "missing 'Public surface' or 'Planned' section heading");
    }

    const hasTsBlock = /```ts\b/.test(content);
    if (!hasTsBlock) {
        fail(rel, "missing fenced ```ts code block (minimum-viable API example)");
    }

    const hasMit = /\bMIT\b/.test(content);
    if (!hasMit) {
        fail(rel, "missing MIT license line");
    }

    if (failures.filter((f) => f.path === rel).length === 0 && existsSync(readmePath)) {
        passes.push(rel);
    }
}

type RootPattern = { name: string; test: (content: string, fromIndex: number) => number };

function indexOfRegex(content: string, re: RegExp, fromIndex: number): number {
    re.lastIndex = fromIndex;
    const match = re.exec(content);
    return match ? match.index : -1;
}

async function checkRootReadme(): Promise<void> {
    const readmePath = join(ROOT, "README.md");
    const rel = "README.md";
    if (!existsSync(readmePath)) {
        fail(rel, "root README.md missing");
        return;
    }
    const content = await readFile(readmePath, "utf8");

    const lineCount = trimmedLineCount(content);
    if (lineCount > 300) {
        fail(rel, `root README is ${lineCount} lines (cap: 300)`);
    }

    const pitch = firstParagraph(content);
    const words = wordCount(pitch);
    if (words === 0) {
        fail(rel, "missing elevator pitch (no first paragraph found)");
    } else if (words > 100) {
        fail(rel, `elevator pitch is ${words} words (cap: 80, hard fail at 101+)`);
    } else if (words > 80) {
        // Warn but don't fail at 81–100. Print as a warning line; do NOT
        // add to failures.
        console.warn(`[warn] ${rel}: elevator pitch is ${words} words (soft cap: 80)`);
    }

    const ordered: RootPattern[] = [
        {
            name: "fenced ```typescript code block",
            test: (c, from) => indexOfRegex(c, /```typescript\b/gm, from),
        },
        {
            name: "'Install' heading",
            test: (c, from) => indexOfRegex(c, /^#+\s+Install\b/gim, from),
        },
        { name: "'Why' heading", test: (c, from) => indexOfRegex(c, /^#+\s+Why\b/gim, from) },
        {
            name: "'Quickstart' heading",
            test: (c, from) => indexOfRegex(c, /^#+\s+Quickstart\b/gim, from),
        },
        {
            name: "architecture diagram (```mermaid / ```ascii / ```text)",
            test: (c, from) => indexOfRegex(c, /```(mermaid|ascii|text)\b/gm, from),
        },
    ];

    let cursor = 0;
    for (const pattern of ordered) {
        const idx = pattern.test(content, cursor);
        if (idx === -1) {
            fail(rel, `missing or out-of-order: ${pattern.name}`);
        } else {
            cursor = idx + 1;
        }
    }

    const linkAnchors = [
        { name: "docs site link", re: /\bdocs?\b.*\]\([^)]+\)/i },
        { name: "CONTRIBUTING.md link", re: /\]\([^)]*CONTRIBUTING\.md[^)]*\)/i },
        { name: "CODE_OF_CONDUCT.md link", re: /\]\([^)]*CODE_OF_CONDUCT\.md[^)]*\)/i },
        { name: "LICENSE link", re: /\]\([^)]*LICENSE[^)]*\)/i },
    ];
    for (const anchor of linkAnchors) {
        if (!anchor.re.test(content)) {
            fail(rel, `missing link anchor: ${anchor.name}`);
        }
    }
}

async function main(): Promise<void> {
    const packages = await listWorkspacePackages();
    for (const pkg of packages) {
        await checkPackageReadme(pkg);
    }
    await checkRootReadme();

    for (const p of passes) console.log(`[pass] ${p}`);
    for (const f of failures) console.error(`[fail] ${f.path}: ${f.reason}`);

    const failedPaths = new Set(failures.map((f) => f.path));
    console.log(
        `\n${packages.length + 1} READMEs checked (${packages.length} packages + root), ${failedPaths.size} failed.`,
    );

    process.exit(failures.length > 0 ? 1 : 0);
}

await main();

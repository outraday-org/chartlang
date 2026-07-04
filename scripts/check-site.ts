#!/usr/bin/env tsx
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
/**
 * Conditional site e2e gate (`pnpm check:site`).
 *
 * Runs the Playwright suite (`site:e2e:install` + `site:e2e`) ONLY when
 * `apps/site/` is touched relative to the upstream branch — the union of
 * working-tree changes (staged + unstaged), untracked files, and commits
 * ahead of `@{upstream}` (falling back to `origin/main`, then `main`).
 * When `apps/site/` is untouched it prints a skip notice and exits 0, so
 * it is always cheap to call after `check:content`.
 *
 * The e2e suite is excluded from `check:content` because it rebuilds the
 * site and needs a Chromium install (~minutes); this gate closes the gap
 * where a site UI change passes every content gate but breaks the CI
 * `E2E (apps/site/)` job.
 */
import { spawnSync } from "node:child_process";

const SITE_PREFIX = "apps/site/";

function git(args: string[]): string | null {
    const result = spawnSync("git", args, { encoding: "utf8" });
    if (result.status !== 0) return null;
    return result.stdout;
}

function collectChangedPaths(): string[] {
    const paths = new Set<string>();
    const sources = [
        // Staged + unstaged changes vs HEAD.
        git(["diff", "--name-only", "HEAD"]),
        // Untracked files.
        git(["ls-files", "--others", "--exclude-standard"]),
        // Commits not yet on the upstream branch.
        git(["diff", "--name-only", "@{upstream}...HEAD"]) ??
            git(["diff", "--name-only", "origin/main...HEAD"]) ??
            git(["diff", "--name-only", "main...HEAD"]),
    ];
    for (const output of sources) {
        if (output === null) continue;
        for (const line of output.split("\n")) {
            const path = line.trim();
            if (path !== "") paths.add(path);
        }
    }
    return [...paths];
}

function run(script: string): void {
    console.log(`check:site: running pnpm ${script}`);
    const result = spawnSync("pnpm", [script], { stdio: "inherit" });
    if (result.status !== 0) {
        console.error(`check:site: pnpm ${script} failed`);
        process.exit(result.status ?? 1);
    }
}

const changed = collectChangedPaths();
const siteTouched = changed.filter((path) => path.startsWith(SITE_PREFIX));

if (siteTouched.length === 0) {
    console.log("check:site: apps/site/ untouched — skipping the Playwright e2e suite.");
    process.exit(0);
}

console.log(`check:site: apps/site/ touched (${siteTouched.length} path(s)):`);
for (const path of siteTouched) console.log(`  ${path}`);

run("site:e2e:install");
run("site:e2e");
console.log("check:site: Playwright e2e suite passed.");

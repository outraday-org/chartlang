#!/usr/bin/env tsx
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
/**
 * `pnpm docs:committed:check` — the git-aware companion to
 * `pnpm docs:gate`.
 *
 * `docs:gate` regenerates every primitive page into a tmp dir and
 * byte-compares against the **working-tree** sibling. That is the right
 * check in CI, where the checkout is clean, but it has a blind spot
 * locally: if the working tree holds a regenerated-but-uncommitted page,
 * the gate (and `pnpm test`'s `docs-gate.test.ts`, which runs the same
 * gate) compare generator output against that uncommitted file and pass —
 * while CI, which runs against the committed checkout, fails. A stale
 * `@since` / JSDoc edit that was committed without its regenerated doc
 * page slips through `pnpm run check` exactly this way.
 *
 * This check removes the blind spot: it regenerates the pages into the
 * working tree (`pnpm docs:generate`) and then asks git whether anything
 * under `docs/primitives/` now differs from `HEAD`. Because it compares
 * against the committed tree (not the working tree), it behaves
 * identically locally and in CI — a stale committed page fails here even
 * when the developer's working tree happened to be up to date.
 *
 * Side effect: it leaves the regenerated pages in the working tree, so a
 * failure also fixes the drift — you only need to `git add` + commit.
 */
import { execFileSync } from "node:child_process";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolvePath(HERE, "..");
const GENERATED_DOCS = "docs/primitives";

// 1. Regenerate every primitive page into the working tree.
execFileSync("pnpm", ["docs:generate"], { cwd: REPO_ROOT, stdio: "inherit" });

// 2. Ask git which generated pages now differ from what is committed
//    (HEAD, so staged-but-stale pages are caught too).
const changed = execFileSync(
    "git",
    ["diff", "HEAD", "--name-only", "--", GENERATED_DOCS],
    { cwd: REPO_ROOT, encoding: "utf8" },
)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

if (changed.length > 0) {
    console.error(
        "docs:committed:check — committed primitive pages are out of date:\n" +
            changed.map((p) => `  ${p}`).join("\n") +
            "\n\nThe pages have been regenerated in your working tree — `git add` and commit them.",
    );
    process.exit(1);
}

console.log("docs:committed:check — committed primitive pages match the generator.");

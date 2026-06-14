// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Copies the single-source brand mark into the VitePress served root.
//
// `apps/site/` imports brand assets straight through Vite (`?url`), but
// VitePress's `themeConfig.logo` + favicon `<link>` need files served at
// the site root. Rather than check duplicates into `docs/public/`, this
// script copies `brand/chartlang_logo.{svg,ico}` there on every
// `docs:dev` / `docs:build`. The generated copies are git-ignored —
// `brand/` is the only place you edit to switch the logo.

import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = resolve(root, "docs/public");

// brand/ source file -> served filename under docs/public/. The served
// names stay stable (logo.svg / logo.ico) so docs config never churns;
// only brand/ is the single source you edit to switch the logo.
const assets: ReadonlyArray<readonly [string, string]> = [
    ["brand/chartlang_logo.svg", "logo.svg"],
    ["brand/chartlang_logo.ico", "logo.ico"],
];

mkdirSync(publicDir, { recursive: true });
for (const [from, to] of assets) {
    const src = resolve(root, from);
    const dest = resolve(publicDir, to);
    copyFileSync(src, dest);
    console.log(`sync-brand-assets: ${src} -> ${dest}`);
}

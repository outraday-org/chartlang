// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Refresh the git-ignored `local-starters/` preview apps from the LOCAL
// `apps/react-starter` tree, using create-chartlang's REAL transform logic
// (strip artefacts, vendor the chosen adapter, rewrite the seam +
// package.json, write the standalone tsconfig + .npmrc + .env). This lets you
// preview uncommitted react-starter / seamTemplates changes across every chart
// library WITHOUT publishing create-chartlang or pushing to GitHub — the
// installer normally clones the starter from GitHub `main`; here we clone it
// from disk instead.
//
// Each starter's `node_modules` + SQLite `data/` are preserved, so re-runs only
// re-install what the new source actually changed (fast). Env handling: set
// your secrets ONCE in the git-ignored `local-starters/.env.shared`, and every
// refresh applies its non-empty keys (e.g. `EODDATA_API_KEY=...`) to all five
// starters' `.env` — so you never re-enter the key per folder or after a
// recreate. Any per-folder `.env` edits are preserved too; the shared file
// wins for the keys it defines. On first run the shared file is created and
// seeded from any key already present in an existing starter (no re-entry).
//
// Run via `pnpm starters:local` (which rebuilds the installer first so
// seamTemplates edits are picked up). Pass a single library id to refresh just
// one: `pnpm starters:local uplot`.

import { spawn } from "node:child_process";
import { cp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
    type CloneRequest,
    type CreateChartlangDeps,
    defaultDeps,
    runCreateChartlang,
} from "../packages/create-chartlang/dist/createApp.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const starterSrc = join(repoRoot, "apps", "react-starter");
const outRoot = join(repoRoot, "local-starters");
const sharedEnvPath = join(outRoot, ".env.shared");

// Mirrors create-chartlang's bundled library ids (the seam variants).
const LIBS = ["echarts", "canvas2d", "konva", "lightweight-charts", "uplot"] as const;
type Lib = (typeof LIBS)[number];

// Kept across a refresh so a re-run is fast and never loses local state. The
// installer rewrites everything else from the fresh source + transforms; `.env`
// is reconciled explicitly (see refresh()).
const PRESERVE = new Set(["node_modules", ".env", "data"]);
// Never copied from the source tree — build/install artefacts + local state
// the transforms (or PRESERVE) own.
const SKIP_COPY = new Set(["node_modules", "dist", "data", ".vite", "vendor"]);

const SHARED_ENV_TEMPLATE = (apiKey: string): string =>
    [
        "# Shared env for local-starters — set your secrets ONCE here and every",
        "# `pnpm starters:local` refresh applies the non-empty keys to ALL five",
        "# starters' .env. This file is git-ignored (local-starters/ is ignored).",
        "",
        "# EODData API key (free tier). Register at https://eoddata.com/myaccount/api.aspx",
        `EODDATA_API_KEY=${apiKey}`,
        "",
        "# Optional global overrides (uncomment to apply to every starter):",
        "# EODDATA_DAILY_LIMIT=100",
        "",
    ].join("\n");

async function exists(path: string): Promise<boolean> {
    try {
        await stat(path);
        return true;
    } catch {
        return false;
    }
}

/** Parse `KEY=value` lines (skipping comments / blanks) into a map. */
function parseEnv(text: string): Map<string, string> {
    const out = new Map<string, string>();
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (line === "" || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq <= 0) continue;
        out.set(line.slice(0, eq).trim(), line.slice(eq + 1).trim());
    }
    return out;
}

/** Override (or append) each `key=value` in `envText`. */
function applyOverrides(envText: string, overrides: ReadonlyMap<string, string>): string {
    let out = envText;
    for (const [key, value] of overrides) {
        const line = `${key}=${value}`;
        const re = new RegExp(`^${key}=.*$`, "m");
        out = re.test(out) ? out.replace(re, line) : `${out.replace(/\n*$/, "")}\n${line}\n`;
    }
    return out;
}

/** Copy the local starter tree into `dir`, keeping the PRESERVE entries. */
async function cloneFromLocal({ dir }: CloneRequest): Promise<void> {
    if (await exists(dir)) {
        for (const entry of await readdir(dir)) {
            if (!PRESERVE.has(entry)) {
                await rm(join(dir, entry), { recursive: true, force: true });
            }
        }
    }
    await cp(starterSrc, dir, {
        recursive: true,
        filter: (src) => {
            const rel = src.slice(starterSrc.length + 1);
            if (rel === "") return true;
            const top = rel.split(/[\\/]/)[0] ?? "";
            if (SKIP_COPY.has(top)) return false;
            if (rel === ".env" || rel.endsWith(".tsbuildinfo")) return false;
            return true;
        },
    });
}

function runInstall(pm: string, dir: string): Promise<void> {
    return new Promise((resolvePromise, reject) => {
        const child = spawn(pm, ["install"], { cwd: dir, stdio: "inherit", shell: true });
        child.on("error", reject);
        child.on("exit", (code) =>
            code === 0 ? resolvePromise() : reject(new Error(`${pm} install exited ${code}`)),
        );
    });
}

function deps(): CreateChartlangDeps {
    return defaultDeps({ cloneStarter: cloneFromLocal, runInstall });
}

/**
 * Ensure `local-starters/.env.shared` exists, seeding `EODDATA_API_KEY` from a
 * key already present in any starter so the user never re-enters it. Returns
 * the shared overrides (non-empty keys only — an empty key never clobbers a
 * preserved per-folder value).
 */
async function loadSharedOverrides(): Promise<Map<string, string>> {
    if (!(await exists(sharedEnvPath))) {
        let migrated = "";
        for (const lib of LIBS) {
            const envPath = join(outRoot, lib, ".env");
            if (!(await exists(envPath))) continue;
            const key = parseEnv(await readFile(envPath, "utf8")).get("EODDATA_API_KEY");
            if (key !== undefined && key !== "") {
                migrated = key;
                break;
            }
        }
        await writeFile(sharedEnvPath, SHARED_ENV_TEMPLATE(migrated), "utf8");
        process.stdout.write(
            migrated === ""
                ? `\nℹ created ${sharedEnvPath} — set EODDATA_API_KEY there once; it applies to all starters.\n`
                : `\nℹ created ${sharedEnvPath} and migrated your existing EODDATA_API_KEY into it.\n`,
        );
    }
    const overrides = new Map<string, string>();
    for (const [key, value] of parseEnv(await readFile(sharedEnvPath, "utf8"))) {
        if (value !== "") overrides.set(key, value);
    }
    return overrides;
}

async function refresh(lib: Lib, overrides: ReadonlyMap<string, string>): Promise<void> {
    const target = join(outRoot, lib);
    process.stdout.write(`\n▸ refreshing local-starters/${lib} from local apps/react-starter\n`);
    // Base the final .env on any preserved per-folder edits (else the template
    // the installer writes), then overlay the shared secrets on top.
    const envPath = join(target, ".env");
    const prevEnv = (await exists(envPath)) ? await readFile(envPath, "utf8") : null;
    await runCreateChartlang([target, "--library", lib, "--yes"], deps());
    const base = prevEnv ?? (await readFile(envPath, "utf8"));
    await writeFile(envPath, applyOverrides(base, overrides), "utf8");
}

async function main(): Promise<void> {
    const only = process.argv[2];
    if (only !== undefined && !LIBS.includes(only as Lib)) {
        process.stderr.write(`error: unknown library "${only}" — valid: ${LIBS.join(", ")}\n`);
        process.exitCode = 1;
        return;
    }
    const overrides = await loadSharedOverrides();
    const libs = only !== undefined ? [only as Lib] : [...LIBS];
    for (const lib of libs) {
        await refresh(lib, overrides);
    }
    process.stdout.write(`\n✓ refreshed ${libs.length} starter(s) in local-starters/\n`);
}

await main();

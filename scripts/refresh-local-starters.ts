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
// TWO dependency modes:
//   • published (default, `pnpm starters:local`) — the clones install the
//     PUBLISHED `@invinite-org/chartlang-*` packages. This tests the real
//     `npm create` release path, but breaks when the repo has UNRELEASED API
//     changes the example adapters/starter already use (e.g. a new adapter-kit
//     capability) — the published packages don't have them yet.
//   • linked (`pnpm starters:local:linked`, this script's `--local` flag) —
//     each workspace `@invinite-org/chartlang-*` package is `pnpm pack`ed (which
//     resolves `workspace:*` → real versions so the tarballs install under npm)
//     and forced into every clone via npm `overrides`. The clones then run on
//     the CURRENT repo code, so you can preview unreleased work across all five
//     adapters before publishing.
//
// Each starter's `node_modules` + SQLite `data/` are preserved across a refresh
// (published mode) for fast re-runs; shared env overrides live ONCE in the
// git-ignored `local-starters/.env.shared` and are overlaid onto each `.env`
// every refresh (market data needs no key, so there's nothing to share today —
// the mechanism is kept for any future shared var).
// Pass a single library id to refresh just one: `pnpm starters:local uplot`.

import { spawn } from "node:child_process";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
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
const packagesDir = join(repoRoot, "packages");
const outRoot = join(repoRoot, "local-starters");
const sharedEnvPath = join(outRoot, ".env.shared");
const localPkgsDir = join(outRoot, ".local-pkgs");

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

const SHARED_ENV_TEMPLATE = (): string =>
    [
        "# Shared env for local-starters — set a value ONCE here and every",
        "# `pnpm starters:local` refresh applies the non-empty keys to ALL five",
        "# starters' .env. This file is git-ignored (local-starters/ is ignored).",
        "#",
        "# Market data needs no API key (loaded from Yahoo Finance), so there is",
        "# nothing to set here today. Add a `KEY=value` line for any future shared",
        "# var and it will be overlaid onto every starter's .env on the next refresh.",
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

/** Spawn a command, inheriting stdio, rejecting on non-zero exit. */
function run(cmd: string, args: string[], cwd: string = repoRoot): Promise<void> {
    return new Promise((resolvePromise, reject) => {
        const child = spawn(cmd, args, { cwd, stdio: "inherit", shell: true });
        child.on("error", reject);
        child.on("exit", (code) =>
            code === 0
                ? resolvePromise()
                : reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`)),
        );
    });
}

function runInstall(pm: string, dir: string): Promise<void> {
    return run(pm, ["install"], dir);
}

function deps(): CreateChartlangDeps {
    return defaultDeps({ cloneStarter: cloneFromLocal, runInstall });
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

/**
 * `pnpm pack` every workspace `@invinite-org/chartlang-*` package into
 * `.local-pkgs/` and return a `{ name → file:<tarball> }` map for npm
 * `overrides`. `pnpm pack` rewrites `workspace:*` deps to concrete versions, so
 * the tarballs install cleanly under npm. Assumes the packages are already
 * built (the `starters:local:linked` script runs the workspace build first).
 */
async function packWorkspacePackages(): Promise<Map<string, string>> {
    await rm(localPkgsDir, { recursive: true, force: true });
    await mkdir(localPkgsDir, { recursive: true });
    const overrides = new Map<string, string>();
    for (const entry of await readdir(packagesDir)) {
        const pkgJsonPath = join(packagesDir, entry, "package.json");
        let pkg: { name?: string; version?: string };
        try {
            pkg = JSON.parse(await readFile(pkgJsonPath, "utf8"));
        } catch {
            continue;
        }
        const name = pkg.name;
        const version = pkg.version;
        if (typeof name !== "string" || !name.startsWith("@invinite-org/chartlang-")) continue;
        // `pnpm pack` must run IN the package dir — `pnpm --filter X pack` is
        // rejected (it implies recursive, which pack does not support).
        await run("pnpm", ["pack", "--pack-destination", localPkgsDir], join(packagesDir, entry));
        // npm/pnpm pack name a scoped tarball `<scope>-<name>-<version>.tgz`.
        const tarball = join(localPkgsDir, `${name.slice(1).replace(/\//g, "-")}-${version}.tgz`);
        if (!(await exists(tarball))) {
            throw new Error(`pnpm pack did not produce expected tarball: ${tarball}`);
        }
        overrides.set(name, `file:${tarball}`);
    }
    return overrides;
}

/**
 * Ensure `local-starters/.env.shared` exists. Returns the shared overrides
 * (non-empty keys only — an empty key never clobbers a preserved per-folder
 * value). Market data needs no key today, so the template seeds nothing; the
 * generic overlay mechanism is kept for any future shared var.
 */
async function loadSharedOverrides(): Promise<Map<string, string>> {
    if (!(await exists(sharedEnvPath))) {
        await mkdir(outRoot, { recursive: true });
        await writeFile(sharedEnvPath, SHARED_ENV_TEMPLATE(), "utf8");
    }
    const overrides = new Map<string, string>();
    for (const [key, value] of parseEnv(await readFile(sharedEnvPath, "utf8"))) {
        if (value !== "") overrides.set(key, value);
    }
    return overrides;
}

async function refresh(
    lib: Lib,
    envOverrides: ReadonlyMap<string, string>,
    pkgOverrides: ReadonlyMap<string, string> | null,
): Promise<void> {
    const target = join(outRoot, lib);
    const mode = pkgOverrides ? "linked → local packages" : "published packages";
    process.stdout.write(`\n▸ refreshing local-starters/${lib} (${mode})\n`);

    // Scaffold everything EXCEPT install (we install after wiring env + any
    // local-package overrides).
    const envPath = join(target, ".env");
    const prevEnv = (await exists(envPath)) ? await readFile(envPath, "utf8") : null;
    await runCreateChartlang([target, "--library", lib, "--yes", "--no-install"], deps());

    // Base the final .env on any preserved per-folder edits (else the template
    // the installer wrote), then overlay the shared env overrides on top.
    const base = prevEnv ?? (await readFile(envPath, "utf8"));
    await writeFile(envPath, applyOverrides(base, envOverrides), "utf8");

    // Linked mode: point every chartlang dep at the local tarball. A DIRECT
    // dep is rewritten in place (npm rejects an `overrides` entry that differs
    // from a direct dependency's spec — EOVERRIDE); transitive-only chartlang
    // deps (pulled by the vendored adapter / other packages, e.g. runtime,
    // conformance) go through `overrides`. Then drop the lockfile + installed
    // chartlang/vendored trees so npm re-resolves from the fresh tarballs.
    if (pkgOverrides) {
        const pkgPath = join(target, "package.json");
        const pkg = JSON.parse(await readFile(pkgPath, "utf8")) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
            overrides?: Record<string, string>;
        };
        const overrides: Record<string, string> = { ...(pkg.overrides ?? {}) };
        for (const [name, spec] of pkgOverrides) {
            if (pkg.dependencies?.[name] !== undefined) pkg.dependencies[name] = spec;
            else if (pkg.devDependencies?.[name] !== undefined) pkg.devDependencies[name] = spec;
            else overrides[name] = spec;
        }
        pkg.overrides = overrides;
        await writeFile(pkgPath, `${JSON.stringify(pkg, null, 4)}\n`, "utf8");
        await rm(join(target, "package-lock.json"), { force: true });
        await rm(join(target, "node_modules", "@invinite-org"), { recursive: true, force: true });
        await rm(join(target, "node_modules", "@local"), { recursive: true, force: true });
    }

    await runInstall("npm", target);
}

async function main(): Promise<void> {
    const argv = process.argv.slice(2);
    const localMode = argv.includes("--local");
    const only = argv.find((a) => !a.startsWith("--"));
    if (only !== undefined && !LIBS.includes(only as Lib)) {
        process.stderr.write(`error: unknown library "${only}" — valid: ${LIBS.join(", ")}\n`);
        process.exitCode = 1;
        return;
    }

    const envOverrides = await loadSharedOverrides();
    let pkgOverrides: Map<string, string> | null = null;
    if (localMode) {
        process.stdout.write(
            "\n▸ packing workspace @invinite-org/chartlang-* packages (linked mode)\n",
        );
        pkgOverrides = await packWorkspacePackages();
        process.stdout.write(`  linked ${pkgOverrides.size} packages from the workspace\n`);
    }

    const libs = only !== undefined ? [only as Lib] : [...LIBS];
    for (const lib of libs) {
        await refresh(lib, envOverrides, pkgOverrides);
    }
    process.stdout.write(
        `\n✓ refreshed ${libs.length} starter(s) in local-starters/${localMode ? " (linked to local packages)" : ""}\n`,
    );
}

await main();

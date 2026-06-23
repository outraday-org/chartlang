// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve as resolvePath } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";

import {
    ADAPTER_REGISTRY,
    BUNDLED_ADAPTERS,
    type GeneratedAdapterBundle,
    type GeneratedAdapterMeta,
} from "@invinite-org/chartlang-cli";

import { STARTER_CLONE_REF } from "./chartlangVersions.js";
import { rewriteStarterPackageJson } from "./rewritePackageJson.js";
import { type SeamId, isSeamId, seamTemplateFor } from "./seamTemplates.js";
import { writeStandaloneTsconfig } from "./starterTsconfig.js";

const PKG_NAME_PLACEHOLDER = "__PKG_NAME__";
const CHARTLANG_SCOPE = "@invinite-org/chartlang-";
const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"] as const;
type PackageManager = (typeof PACKAGE_MANAGERS)[number];

const NPMRC_FILE = ".npmrc";
// Published `@invinite-org/chartlang-compiler` depends on `esbuild@^0.24`, but
// `vite@8`'s optional peer wants `esbuild@^0.27 || ^0.28`. The app builds + runs
// fine on esbuild 0.24 — npm's strict optional-peer check is the only blocker —
// so the clone opts into `legacy-peer-deps` instead of bumping any esbuild.
const NPMRC_CONTENTS =
    "# vite@8's optional esbuild peer (^0.27||^0.28) conflicts with the\n# chartlang-compiler esbuild dep (^0.24); the app runs fine on 0.24.\nlegacy-peer-deps=true\n";

const DEFAULT_TARGET = "./chartlang-starter";
const DEFAULT_LIBRARY: SeamId = "canvas2d";
const SEAM_PATH = ["src", "lib", "chart", "activeAdapter.ts"];
const ENV_EXAMPLE = ".env.example";
const ENV_FILE = ".env";

// Repo-internal artefacts that must not ship to the user's clone. The e2e
// suite lives under `tests/`; `playwright.config.ts` references it (a mock
// server + global setup), so it is stripped too — otherwise the cloned
// project ships a `playwright.config.ts` pointing at deleted files.
const STRIP_ENTRIES = ["CLAUDE.md", "tests", ".changeset", ".github", "playwright.config.ts"];

/**
 * The starter source giget clones, minus the ref suffix. The installer
 * appends {@link STARTER_CLONE_REF} to pin the matching tagged tree.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { STARTER_SOURCE_BASE } from "@invinite-org/create-chartlang";
 *     void STARTER_SOURCE_BASE;
 */
export const STARTER_SOURCE_BASE = "github:outraday-org/chartlang/apps/react-starter";

/**
 * A minimal `node:readline/promises`-like surface — the subset the
 * interactive library prompt needs. Lets a test inject a fixed answer
 * instead of driving the real TTY. Mirrors the CLI's `Prompter`.
 *
 * @since 0.1
 * @stable
 * @example
 *     import type { Prompter } from "@invinite-org/create-chartlang";
 *     const p: Prompter = { question: async () => "echarts", close: () => {} };
 *     void p;
 */
export type Prompter = {
    question(query: string): Promise<string>;
    close(): void;
};

/**
 * Where + how to clone the starter. Passed to a {@link CloneStarter} so the
 * caller (or a test) decides the implementation — production wires giget's
 * `downloadTemplate`; tests write a fixture tree.
 *
 * @since 0.1
 * @stable
 * @example
 *     import type { CloneRequest } from "@invinite-org/create-chartlang";
 *     declare const req: CloneRequest;
 *     void req.dir;
 */
export type CloneRequest = Readonly<{
    /** The giget source (`STARTER_SOURCE_BASE` + `STARTER_CLONE_REF`). */
    source: string;
    /** The absolute target directory to clone into. */
    dir: string;
}>;

/**
 * Clone the starter tree into `req.dir`. Injected so the network clone stays
 * out of the unit tests (the only networked step in the flow).
 *
 * @since 0.1
 * @stable
 * @example
 *     import type { CloneStarter } from "@invinite-org/create-chartlang";
 *     const clone: CloneStarter = async () => {};
 *     void clone;
 */
export type CloneStarter = (req: CloneRequest) => Promise<void>;

/**
 * The injectable IO seam for {@link runCreateChartlang} — output streams,
 * whether stdin is a TTY (gates the interactive prompt), a prompter factory,
 * the clone implementation, and the install runner. Tests override every
 * field so the flow runs offline with no real stdin/network.
 *
 * @since 0.1
 * @stable
 * @example
 *     import type { CreateChartlangDeps } from "@invinite-org/create-chartlang";
 *     declare const deps: CreateChartlangDeps;
 *     void deps.isTTY;
 */
export type CreateChartlangDeps = Readonly<{
    stdout: NodeJS.WritableStream;
    stderr: NodeJS.WritableStream;
    isTTY: boolean;
    createPrompter: () => Prompter;
    cloneStarter: CloneStarter;
    runInstall: (pm: PackageManager, dir: string) => Promise<void>;
}>;

function isPackageManager(value: string): value is PackageManager {
    return (PACKAGE_MANAGERS as ReadonlyArray<string>).includes(value);
}

/**
 * A resolved adapter: its offline bundle + its registry metadata, the pair
 * {@link resolveAdapter} returns for a bundled id.
 *
 * @since 0.1
 * @stable
 * @example
 *     import type { ResolvedAdapter } from "@invinite-org/create-chartlang";
 *     declare const r: ResolvedAdapter;
 *     void r.bundle.id;
 */
export type ResolvedAdapter = Readonly<{
    bundle: GeneratedAdapterBundle;
    meta: GeneratedAdapterMeta;
}>;

/**
 * Look up an adapter's bundle + registry metadata by id, throwing if either is
 * missing. The `runCreateChartlang` flow only calls this with an `isSeamId`-
 * validated id (so it never throws in production), but the guard fails loudly
 * if `SEAM_IDS` ever drifts from the generated bundle/registry set.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { resolveAdapter } from "@invinite-org/create-chartlang";
 *     const { bundle, meta } = resolveAdapter("echarts");
 *     void bundle.id;
 *     void meta.library;
 */
export function resolveAdapter(id: string): ResolvedAdapter {
    const bundle = BUNDLED_ADAPTERS.find((b) => b.id === id);
    const meta = ADAPTER_REGISTRY.find((m) => m.id === id);
    if (bundle === undefined || meta === undefined) {
        throw new Error(`no bundle/registry entry for adapter "${id}"`);
    }
    return { bundle, meta };
}

async function isNonEmptyDir(path: string): Promise<boolean> {
    try {
        return (await readdir(path)).length > 0;
    } catch {
        return false;
    }
}

/**
 * Render the library-choice prompt list from the registry, canvas2d first
 * (the default) then the rest in registry order. Pure: no IO.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { renderLibraryChoices } from "@invinite-org/create-chartlang";
 *     const text = renderLibraryChoices([]);
 *     void text;
 */
export function renderLibraryChoices(registry: ReadonlyArray<GeneratedAdapterMeta>): string {
    const ordered = orderedRegistry(registry);
    const lines = ["Choose a chart library:", ""];
    for (const meta of ordered) {
        const suffix = meta.id === DEFAULT_LIBRARY ? "  (default)" : "";
        const lib = meta.library === "(none)" ? "no runtime dep" : meta.library;
        lines.push(`  ${meta.id} — ${meta.displayName} (${lib})${suffix}`);
    }
    lines.push("");
    return lines.join("\n");
}

function orderedRegistry(
    registry: ReadonlyArray<GeneratedAdapterMeta>,
): ReadonlyArray<GeneratedAdapterMeta> {
    const def = registry.filter((m) => m.id === DEFAULT_LIBRARY);
    const rest = registry.filter((m) => m.id !== DEFAULT_LIBRARY);
    return [...def, ...rest];
}

/**
 * Harvest the published `@invinite-org/chartlang-*` `^`-ranges from a bundle's
 * own (generator-pinned) `package.json` deps + devDeps. These take precedence
 * over the baked manifest when rewriting the starter's workspace deps.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { bundleChartlangVersions } from "@invinite-org/create-chartlang";
 *     const map = bundleChartlangVersions({ id: "x", files: {} });
 *     void map;
 */
export function bundleChartlangVersions(
    bundle: GeneratedAdapterBundle,
): Readonly<Record<string, string>> {
    // Every generated bundle carries a `package.json` (the generator always
    // emits one), so `?? "{}"` is only a parse-safety floor, never the path.
    const parsed = JSON.parse(bundle.files["package.json"] ?? "{}") as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
    };
    const out: Record<string, string> = {};
    for (const block of [parsed.dependencies, parsed.devDependencies]) {
        for (const [name, range] of Object.entries(block ?? {})) {
            if (name.startsWith(CHARTLANG_SCOPE)) {
                out[name] = range;
            }
        }
    }
    return out;
}

/**
 * Repoint a single `main`/`types`/`exports` entry string from the bundle's
 * unbuilt `./dist/*.{js,d.ts}` to the vendored TypeScript source `./src/*.ts`.
 * The vendored bundle ships only `src/` (create-chartlang never builds it), so
 * Vite + tsc resolve the adapter directly from source with NO build step. A
 * non-`./dist/` value is returned unchanged.
 */
function repointDistToSrc(value: string): string {
    if (!value.startsWith("./dist/")) {
        return value;
    }
    return value
        .replace(/^\.\/dist\//, "./src/")
        .replace(/\.d\.ts$/, ".ts")
        .replace(/\.js$/, ".ts");
}

type VendoredExportEntry = { types?: string; import?: string };
type VendoredAdapterPkg = {
    main?: string;
    types?: string;
    exports?: Record<string, VendoredExportEntry>;
    [key: string]: unknown;
};

/**
 * Rewrite the vendored adapter `package.json`: substitute the `__PKG_NAME__`
 * placeholder, then repoint `main`/`types` and every `exports` entry's
 * `types`/`import` from `./dist/*` to the vendored `./src/*.ts` source. This is
 * an intentional DIVERGENCE from `cli add-adapter`, which keeps the
 * dist-pointing bundle (it expects a build); create-chartlang vendors source
 * only and never builds, so the manifest must resolve straight from `src/`.
 * Absent fields are left untouched.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { repointVendoredPackageJson } from "@invinite-org/create-chartlang";
 *     const next = repointVendoredPackageJson('{"main":"./dist/index.js"}', "@local/x-adapter");
 *     void next;
 */
export function repointVendoredPackageJson(contents: string, localName: string): string {
    const named = contents.split(PKG_NAME_PLACEHOLDER).join(localName);
    const pkg = JSON.parse(named) as VendoredAdapterPkg;
    if (pkg.main !== undefined) {
        pkg.main = repointDistToSrc(pkg.main);
    }
    if (pkg.types !== undefined) {
        pkg.types = repointDistToSrc(pkg.types);
    }
    if (pkg.exports !== undefined) {
        for (const entry of Object.values(pkg.exports)) {
            if (entry.types !== undefined) {
                entry.types = repointDistToSrc(entry.types);
            }
            if (entry.import !== undefined) {
                entry.import = repointDistToSrc(entry.import);
            }
        }
    }
    return `${JSON.stringify(pkg, null, 4)}\n`;
}

/** Write a vendored adapter bundle, substituting the local name (Windows-safe paths). */
async function writeVendoredAdapter(
    bundle: GeneratedAdapterBundle,
    dir: string,
    localName: string,
): Promise<void> {
    for (const [relPath, contents] of Object.entries(bundle.files)) {
        const dest = join(dir, ...relPath.split("/"));
        await mkdir(dirname(dest), { recursive: true });
        const out =
            relPath === "package.json" ? repointVendoredPackageJson(contents, localName) : contents;
        await writeFile(dest, out, "utf8");
    }
}

async function stripRepoArtefacts(dir: string): Promise<void> {
    for (const entry of STRIP_ENTRIES) {
        await rm(join(dir, entry), { recursive: true, force: true });
    }
}

function defaultEnv(): string {
    return [
        "# Copy to `.env` and fill in. `.env` is git-ignored; this sample is committed.",
        "",
        "# Local SQLite file (saved scripts + cached daily bars). The DB auto-creates,",
        "# migrates, and seeds on first boot — no manual step.",
        "DATABASE_URL=file:./data/starter.db",
        "",
        "# Market data needs NO API key: the starter loads daily US bars from Yahoo",
        "# Finance (free, unmetered) and caches each symbol in SQLite, so a re-open /",
        "# re-compile costs zero network calls.",
        "",
    ].join("\n");
}

async function writeNpmrc(dir: string): Promise<void> {
    await writeFile(join(dir, NPMRC_FILE), NPMRC_CONTENTS, "utf8");
}

async function writeEnv(dir: string): Promise<void> {
    const examplePath = join(dir, ENV_EXAMPLE);
    let contents = defaultEnv();
    try {
        contents = await readFile(examplePath, "utf8");
    } catch {
        // No committed `.env.example` in the clone — fall back to the baked default.
    }
    await writeFile(join(dir, ENV_FILE), contents, "utf8");
}

function renderNextSteps(dir: string, pm: PackageManager, installed: boolean): string {
    const lines = [`Created chartlang starter in ${dir}`, "", "Next steps:", `  cd ${dir}`];
    if (!installed) {
        lines.push(`  ${pm} install`);
    }
    lines.push(
        "  # market data comes from Yahoo Finance — no API key needed",
        `  ${pm} run dev`,
        "",
        "Switch chart libraries later:",
        "  npx @invinite-org/chartlang-cli add-adapter <id>",
        "  # then edit src/lib/chart/activeAdapter.ts",
        "",
    );
    return lines.join("\n");
}

type ParsedArgs = Readonly<{
    dir: string;
    library: string | undefined;
    pm: string;
    install: boolean;
    yes: boolean;
}>;

function parse(argv: ReadonlyArray<string>): ParsedArgs {
    // `node:util.parseArgs` has no native `--no-<flag>` negation, so model the
    // documented `--no-install` opt-out as a `--no-install` boolean flag and
    // invert it (parity with the CLI's `--force`-style boolean opts).
    const parsed = parseArgs({
        args: argv.slice(),
        options: {
            library: { type: "string" },
            pm: { type: "string" },
            "no-install": { type: "boolean", default: false },
            yes: { type: "boolean", default: false },
            force: { type: "boolean", default: false },
        },
        allowPositionals: true,
        strict: true,
    });
    return {
        dir: parsed.positionals[0] ?? DEFAULT_TARGET,
        library: parsed.values.library,
        pm: parsed.values.pm ?? "npm",
        install: !parsed.values["no-install"],
        yes: parsed.values.yes || parsed.values.force,
    };
}

/**
 * Resolve the chosen library id: an explicit `--library` (validated), else the
 * default on `--yes` / non-TTY, else an interactive prompt (default echarts on
 * an empty answer). Returns `undefined` (after writing an error) on an unknown
 * `--library`.
 */
async function resolveLibrary(
    explicit: string | undefined,
    yes: boolean,
    deps: CreateChartlangDeps,
): Promise<SeamId | undefined> {
    if (explicit !== undefined) {
        if (!isSeamId(explicit)) {
            deps.stderr.write(
                `error: unknown --library "${explicit}" — valid ids: ${ADAPTER_REGISTRY.map((m) => m.id).join(", ")}\n`,
            );
            return undefined;
        }
        return explicit;
    }
    if (yes || !deps.isTTY) {
        return DEFAULT_LIBRARY;
    }
    const prompter = deps.createPrompter();
    try {
        deps.stdout.write(renderLibraryChoices(ADAPTER_REGISTRY));
        const answer = (await prompter.question(`Library [${DEFAULT_LIBRARY}]: `)).trim();
        if (answer === "") {
            return DEFAULT_LIBRARY;
        }
        if (!isSeamId(answer)) {
            deps.stderr.write(
                `error: unknown library "${answer}" — valid ids: ${ADAPTER_REGISTRY.map((m) => m.id).join(", ")}\n`,
            );
            return undefined;
        }
        return answer;
    } finally {
        prompter.close();
    }
}

/**
 * The production IO seam — real process streams, a `node:readline/promises`
 * prompter, a giget-backed clone, and a child-process install. The
 * `cloneStarter` argument is injected (giget lives in `index.ts`) so this
 * module carries no network dependency.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { defaultDeps } from "@invinite-org/create-chartlang";
 *     const deps = defaultDeps({
 *         cloneStarter: async () => {},
 *         runInstall: async () => {},
 *     });
 *     deps.createPrompter().close();
 */
export function defaultDeps(
    io: Readonly<{ cloneStarter: CloneStarter; runInstall: CreateChartlangDeps["runInstall"] }>,
): CreateChartlangDeps {
    return {
        stdout: process.stdout,
        stderr: process.stderr,
        isTTY: process.stdin.isTTY === true,
        createPrompter: () => createInterface({ input: process.stdin, output: process.stdout }),
        cloneStarter: io.cloneStarter,
        runInstall: io.runInstall,
    };
}

/**
 * Scaffold a runnable chartlang starter: clone `apps/react-starter` from
 * GitHub (the one networked step), prompt for a chart library (default
 * echarts), vendor the chosen adapter from the CLI's offline bundle, rewrite
 * the single `activeAdapter.ts` seam + the `package.json` workspace deps, strip
 * repo-internal artefacts, write `.env`, optionally install, and print next
 * steps. Sets `process.exitCode = 1` on an unknown library or a non-empty
 * target dir without `--yes`.
 *
 * Flags: `[dir]` (default `./chartlang-starter`), `--library <id>`,
 * `--pm <npm|pnpm|yarn|bun>`, `--no-install`, `--yes` (accept defaults +
 * overwrite a non-empty dir).
 *
 * @since 0.1
 * @stable
 * @example
 *     import { runCreateChartlang, defaultDeps } from "@invinite-org/create-chartlang";
 *     await runCreateChartlang(["my-app", "--library", "echarts"], defaultDeps({
 *         cloneStarter: async () => {},
 *         runInstall: async () => {},
 *     }));
 */
export async function runCreateChartlang(
    argv: ReadonlyArray<string>,
    deps: CreateChartlangDeps,
): Promise<void> {
    const args = parse(argv);

    if (!isPackageManager(args.pm)) {
        deps.stderr.write(
            `error: invalid --pm "${args.pm}" — expected one of ${PACKAGE_MANAGERS.join(", ")}\n`,
        );
        process.exitCode = 1;
        return;
    }
    const pm: PackageManager = args.pm;

    const targetDir = isAbsolute(args.dir) ? args.dir : resolvePath(process.cwd(), args.dir);
    if (!args.yes && (await isNonEmptyDir(targetDir))) {
        deps.stderr.write(
            `error: target directory not empty: ${targetDir} (use --yes to overwrite)\n`,
        );
        process.exitCode = 1;
        return;
    }

    const library = await resolveLibrary(args.library, args.yes, deps);
    if (library === undefined) {
        process.exitCode = 1;
        return;
    }

    // `library` is `isSeamId`-validated, so this resolves (the parity test
    // asserts every SeamId has a bundle + registry entry).
    const { bundle, meta } = resolveAdapter(library);

    await deps.cloneStarter({
        source: `${STARTER_SOURCE_BASE}${STARTER_CLONE_REF}`,
        dir: targetDir,
    });
    await stripRepoArtefacts(targetDir);

    // Make the clone standalone: bake the monorepo tsconfig base + repoint
    // `extends`, and opt into legacy-peer-deps so `npm install` resolves the
    // vite8/esbuild optional-peer conflict.
    await writeStandaloneTsconfig(targetDir);
    await writeNpmrc(targetDir);

    const vendorRel = `vendor/${library}-adapter`;
    const vendoredAdapterName = `@local/${library}-adapter`;
    await writeVendoredAdapter(
        bundle,
        join(targetDir, ...vendorRel.split("/")),
        vendoredAdapterName,
    );

    const seamBody = seamTemplateFor(library, vendoredAdapterName);
    const seamDest = join(targetDir, ...SEAM_PATH);
    await mkdir(dirname(seamDest), { recursive: true });
    await writeFile(seamDest, seamBody, "utf8");

    const pkgPath = join(targetDir, "package.json");
    const pkgSource = await readFile(pkgPath, "utf8");
    const rewritten = rewriteStarterPackageJson({
        source: pkgSource,
        projectName: basename(targetDir),
        libraryId: library,
        chartLibrary: meta.library === "(none)" ? "" : meta.library,
        chartLibraryRange: meta.libraryRange,
        vendoredAdapterName,
        vendoredAdapterSpec: `file:./${vendorRel}`,
        bundleVersions: bundleChartlangVersions(bundle),
    });
    await writeFile(pkgPath, rewritten, "utf8");

    await writeEnv(targetDir);

    if (args.install) {
        await deps.runInstall(pm, targetDir);
    }

    deps.stdout.write(renderNextSteps(targetDir, pm, args.install));
}

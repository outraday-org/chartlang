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

const PKG_NAME_PLACEHOLDER = "__PKG_NAME__";
const CHARTLANG_SCOPE = "@invinite-org/chartlang-";
const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"] as const;
type PackageManager = (typeof PACKAGE_MANAGERS)[number];

const DEFAULT_TARGET = "./chartlang-starter";
const DEFAULT_LIBRARY: SeamId = "echarts";
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
 *     import { STARTER_SOURCE_BASE } from "create-chartlang";
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
 *     import type { Prompter } from "create-chartlang";
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
 *     import type { CloneRequest } from "create-chartlang";
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
 *     import type { CloneStarter } from "create-chartlang";
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
 *     import type { CreateChartlangDeps } from "create-chartlang";
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
 *     import type { ResolvedAdapter } from "create-chartlang";
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
 *     import { resolveAdapter } from "create-chartlang";
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
 * Render the library-choice prompt list from the registry, echarts first
 * (the default) then the rest in registry order. Pure: no IO.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { renderLibraryChoices } from "create-chartlang";
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
 *     import { bundleChartlangVersions } from "create-chartlang";
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
            relPath === "package.json"
                ? contents.split(PKG_NAME_PLACEHOLDER).join(localName)
                : contents;
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
        "# chartlang starter environment. `.env` is git-ignored.",
        "DATABASE_URL=file:./data/starter.db",
        "",
        "# EODData API key — free tier: 100 calls/day, daily EOD, US symbols.",
        "# Register at https://eoddata.com/myaccount/api.aspx",
        "EODDATA_API_KEY=",
        "",
    ].join("\n");
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
        "  # add your free EODData key to .env (EODDATA_API_KEY=)",
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
 *     import { defaultDeps } from "create-chartlang";
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
 *     import { runCreateChartlang, defaultDeps } from "create-chartlang";
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

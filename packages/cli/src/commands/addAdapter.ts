// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { mkdir, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve as resolvePath } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";

import {
    ADAPTER_REGISTRY,
    BUNDLED_ADAPTERS,
    type GeneratedAdapterBundle,
    type GeneratedAdapterMeta,
} from "../generated/adapters/index.js";

const PKG_NAME_PLACEHOLDER = "__PKG_NAME__";
const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"] as const;
type PackageManager = (typeof PACKAGE_MANAGERS)[number];

/**
 * A minimal `node:readline/promises`-like surface — the subset
 * `add-adapter`'s interactive selection needs. Lets a test inject a fixed
 * answer instead of driving the real TTY.
 *
 * @since 1.3
 * @stable
 * @example
 *     import type { Prompter } from "@invinite-org/chartlang-cli";
 *     const p: Prompter = { question: async () => "konva", close: () => {} };
 *     void p;
 */
export type Prompter = {
    question(query: string): Promise<string>;
    close(): void;
};

/**
 * The injectable IO seam for {@link runAddAdapter} — the output streams,
 * whether stdin is a TTY (gates the interactive prompt), and a prompter
 * factory. Defaults to the real process streams; tests override it to
 * capture output and supply the selection without real stdin.
 *
 * @since 1.3
 * @stable
 * @example
 *     import type { AddAdapterDeps } from "@invinite-org/chartlang-cli";
 *     declare const deps: AddAdapterDeps;
 *     void deps.isTTY;
 */
export type AddAdapterDeps = {
    readonly stdout: NodeJS.WritableStream;
    readonly stderr: NodeJS.WritableStream;
    readonly isTTY: boolean;
    readonly createPrompter: () => Prompter;
};

/**
 * The production IO seam — wired to the real process streams + a
 * `node:readline/promises` prompter. Exported so a unit test can exercise
 * the real-prompter construction without driving the interactive path
 * through stdin.
 *
 * @since 1.3
 * @stable
 * @example
 *     import { defaultAddAdapterDeps } from "@invinite-org/chartlang-cli";
 *     const deps = defaultAddAdapterDeps();
 *     deps.createPrompter().close();
 */
export function defaultAddAdapterDeps(): AddAdapterDeps {
    return {
        stdout: process.stdout,
        stderr: process.stderr,
        isTTY: process.stdin.isTTY === true,
        createPrompter: () => createInterface({ input: process.stdin, output: process.stdout }),
    };
}

function isPackageManager(value: string): value is PackageManager {
    return (PACKAGE_MANAGERS as ReadonlyArray<string>).includes(value);
}

function installCommand(pm: PackageManager): string {
    return pm === "npm" ? "npm install" : `${pm} install`;
}

/**
 * Render the `add-adapter --list` comparison matrix from the generated
 * registry metadata — one block per adapter (display name, library +
 * range, license, render tech, bundle size, best-for) plus the exact
 * `chartlang add-adapter <id>` command. Pure: no IO.
 *
 * @since 1.3
 * @stable
 * @example
 *     import { renderList } from "@invinite-org/chartlang-cli";
 *     const matrix = renderList([]);
 *     void matrix;
 */
export function renderList(registry: ReadonlyArray<GeneratedAdapterMeta>): string {
    const lines = ["Available chartlang adapters (chartlang add-adapter <id>):", ""];
    for (const meta of registry) {
        const lib =
            meta.library === "(none)" ? "no runtime dep" : `${meta.library} ${meta.libraryRange}`;
        lines.push(`  ${meta.id}`);
        lines.push(`      ${meta.displayName} — ${lib} (${meta.license})`);
        lines.push(`      ${meta.renderTech} · ~${meta.approxBundleKb} KB`);
        lines.push(`      ${meta.bestFor}`);
        lines.push(`      chartlang add-adapter ${meta.id}`);
        lines.push("");
    }
    return lines.join("\n");
}

async function isNonEmptyDir(path: string): Promise<boolean> {
    try {
        return (await readdir(path)).length > 0;
    } catch {
        return false;
    }
}

function findBundle(id: string): GeneratedAdapterBundle | undefined {
    return BUNDLED_ADAPTERS.find((b) => b.id === id);
}

async function writeBundle(
    bundle: GeneratedAdapterBundle,
    targetDir: string,
    pkgName: string,
): Promise<void> {
    for (const [relPath, contents] of Object.entries(bundle.files)) {
        const segments = relPath.split("/");
        const dest = join(targetDir, ...segments);
        await mkdir(dirname(dest), { recursive: true });
        const substituted =
            relPath === "package.json"
                ? contents.split(PKG_NAME_PLACEHOLDER).join(pkgName)
                : contents;
        await writeFile(dest, substituted, "utf8");
    }
}

function renderNextSteps(
    meta: GeneratedAdapterMeta | undefined,
    targetDir: string,
    pkg: PackageManager,
): string {
    const lines = [
        `Adapter written to ${targetDir}`,
        "",
        "Next steps:",
        `  cd ${targetDir}`,
        `  ${installCommand(pkg)}`,
        `  ${pkg} run build`,
        `  ${pkg} test            # runs unit + conformance tests`,
    ];
    if (meta !== undefined) {
        lines.push("", `Source + docs: ${meta.githubFolder}`);
    }
    return `${lines.join("\n")}\n`;
}

/**
 * Execute the `chartlang add-adapter [id] [dir]` subcommand — drop a
 * complete, runnable library adapter (canvas2d / echarts / konva /
 * lightweight-charts / uplot) into the user's repo from the offline,
 * version-pinned bundle baked into the CLI. Unlike `scaffold-adapter`
 * (which emits a blank starter), this writes a full conformance-green
 * adapter you can build and run immediately.
 *
 * Flags: `--list` (print the matrix), `--name <pkg>` (package.json name,
 * defaults to the dir basename), `--pm <npm|pnpm|yarn|bun>` (install
 * command in the next-steps printout), `--force` (overwrite a non-empty
 * target). With no id on a TTY, prompts for a selection.
 *
 * @since 1.3
 * @stable
 * @example
 *     import { runAddAdapter } from "@invinite-org/chartlang-cli";
 *     await runAddAdapter(["konva", "./my-chart", "--pm", "pnpm"]);
 *     await runAddAdapter(["--list"]);
 */
export async function runAddAdapter(
    args: ReadonlyArray<string>,
    deps: AddAdapterDeps = defaultAddAdapterDeps(),
): Promise<void> {
    const parsed = parseArgs({
        args: args.slice(),
        options: {
            list: { type: "boolean", default: false },
            name: { type: "string" },
            pm: { type: "string" },
            force: { type: "boolean", default: false },
        },
        allowPositionals: true,
        strict: true,
    });

    const pmRaw = parsed.values.pm ?? "npm";
    if (!isPackageManager(pmRaw)) {
        deps.stderr.write(
            `error: invalid --pm "${pmRaw}" — expected one of ${PACKAGE_MANAGERS.join(", ")}\n`,
        );
        process.exitCode = 1;
        return;
    }
    const pm: PackageManager = pmRaw;

    let id = parsed.positionals[0];

    if (parsed.values.list || (id === undefined && !deps.isTTY)) {
        deps.stdout.write(renderList(ADAPTER_REGISTRY));
        return;
    }

    if (id === undefined) {
        const prompter = deps.createPrompter();
        try {
            deps.stdout.write(renderList(ADAPTER_REGISTRY));
            id = (await prompter.question("Adapter id: ")).trim();
        } finally {
            prompter.close();
        }
    }

    const bundle = findBundle(id);
    if (bundle === undefined) {
        deps.stderr.write(
            `error: unknown adapter "${id}" — valid ids: ${BUNDLED_ADAPTERS.map((b) => b.id).join(", ")}\n`,
        );
        process.exitCode = 1;
        return;
    }

    const targetRaw = parsed.positionals[1] ?? `./${id}-adapter`;
    const targetDir = isAbsolute(targetRaw) ? targetRaw : resolvePath(process.cwd(), targetRaw);

    if (!parsed.values.force && (await isNonEmptyDir(targetDir))) {
        deps.stderr.write(
            `error: target directory not empty: ${targetDir} (use --force to overwrite)\n`,
        );
        process.exitCode = 1;
        return;
    }

    const pkgName = parsed.values.name ?? basename(targetDir);
    await mkdir(targetDir, { recursive: true });
    await writeBundle(bundle, targetDir, pkgName);

    const meta = ADAPTER_REGISTRY.find((m) => m.id === id);
    deps.stdout.write(renderNextSteps(meta, targetDir, pm));
}

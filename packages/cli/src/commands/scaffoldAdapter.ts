// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { mkdir, readdir, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve as resolvePath } from "node:path";
import { parseArgs } from "node:util";

import {
    CONFORMANCE_REPORT_TS,
    CONFORMANCE_TEST_TS,
    GITIGNORE,
    INDEX_TEST_TS,
    INDEX_TS,
    PACKAGE_JSON,
    README_MD,
    TSCONFIG,
} from "../adapterTemplate/templates.js";
import { printHelp } from "./help.js";

const KEBAB_NAME = /^[a-z][a-z0-9-]*$/;

async function isNonEmptyDir(path: string): Promise<boolean> {
    try {
        const entries = await readdir(path);
        return entries.length > 0;
    } catch {
        return false;
    }
}

function todayUtcIso(): string {
    return new Date().toISOString().slice(0, 10);
}

/**
 * Execute the `chartlang scaffold-adapter <name> [--target <dir>]`
 * subcommand. Validates the name against `/^[a-z][a-z0-9-]*$/`,
 * creates the target directory (defaulting to `./<name>`), refuses to
 * overwrite a non-empty target, and writes the eight starter files:
 * `package.json`, `tsconfig.json`, `src/index.ts`, `src/index.test.ts`,
 * `src/conformance.test.ts`, `scripts/conformance-report.ts`,
 * `README.md`, `.gitignore`.
 *
 * Generated package is unscoped (`chartlang-adapter-<name>`) and
 * marked `"private": true` so consumers opt in to publishing
 * explicitly. The `INDEX_TS` template imports `defineAdapter` /
 * `capabilities` / `mockCandleSource` from adapter-kit and emits a
 * starter adapter with a headless conformance capability bag.
 *
 * @since 0.1
 * @example
 *     import { runScaffoldAdapter } from "@invinite-org/chartlang-cli";
 *     await runScaffoldAdapter(["my-tradingview-adapter", "--target", "./out"]);
 */
export async function runScaffoldAdapter(args: ReadonlyArray<string>): Promise<void> {
    const parsed = parseArgs({
        args: args.slice(),
        options: {
            target: { type: "string" },
            help: { type: "boolean", short: "h", default: false },
        },
        allowPositionals: true,
        strict: true,
    });

    if (parsed.values.help) {
        printHelp();
        return;
    }

    const name = parsed.positionals[0];
    if (name === undefined) {
        process.stderr.write("error: chartlang scaffold-adapter requires a name positional\n");
        process.exitCode = 1;
        printHelp(process.stderr);
        return;
    }

    if (!KEBAB_NAME.test(name)) {
        process.stderr.write(
            `error: invalid adapter name "${name}" — expected kebab-case (^[a-z][a-z0-9-]*$)\n`,
        );
        process.exitCode = 1;
        return;
    }

    const targetRaw = parsed.values.target ?? `./${name}`;
    const target = isAbsolute(targetRaw) ? targetRaw : resolvePath(process.cwd(), targetRaw);

    if (await isNonEmptyDir(target)) {
        process.stderr.write(`error: target directory not empty: ${target}\n`);
        process.exitCode = 1;
        return;
    }

    const date = todayUtcIso();
    await mkdir(target, { recursive: true });
    await mkdir(join(target, "src"), { recursive: true });
    await mkdir(join(target, "scripts"), { recursive: true });

    await writeFile(join(target, "package.json"), PACKAGE_JSON(name, date), "utf8");
    await writeFile(join(target, "tsconfig.json"), TSCONFIG, "utf8");
    await writeFile(join(target, "src", "index.ts"), INDEX_TS(name), "utf8");
    await writeFile(join(target, "src", "index.test.ts"), INDEX_TEST_TS(name), "utf8");
    await writeFile(join(target, "src", "conformance.test.ts"), CONFORMANCE_TEST_TS, "utf8");
    await writeFile(
        join(target, "scripts", "conformance-report.ts"),
        CONFORMANCE_REPORT_TS,
        "utf8",
    );
    await writeFile(join(target, "README.md"), README_MD(name, date), "utf8");
    await writeFile(join(target, ".gitignore"), GITIGNORE, "utf8");

    process.stdout.write(`scaffolded chartlang-adapter-${name} at ${target}\n`);
}

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BUNDLED_ADAPTERS } from "../generated/adapters/index.js";
import {
    type AddAdapterDeps,
    type Prompter,
    defaultAddAdapterDeps,
    renderList,
    runAddAdapter,
} from "./addAdapter.js";

const ALL_IDS = BUNDLED_ADAPTERS.map((b) => b.id);

type Capture = {
    deps: AddAdapterDeps;
    stdout: () => string;
    stderr: () => string;
};

function makeDeps(opts: { isTTY?: boolean; answer?: string } = {}): Capture {
    const out: string[] = [];
    const err: string[] = [];
    const prompter: Prompter = {
        question: async () => opts.answer ?? "",
        close: () => {},
    };
    const deps: AddAdapterDeps = {
        stdout: {
            write: (c: string) => {
                out.push(c);
                return true;
            },
        } as NodeJS.WritableStream,
        stderr: {
            write: (c: string) => {
                err.push(c);
                return true;
            },
        } as NodeJS.WritableStream,
        isTTY: opts.isTTY ?? false,
        createPrompter: () => prompter,
    };
    return { deps, stdout: () => out.join(""), stderr: () => err.join("") };
}

describe("runAddAdapter", () => {
    let workspace: string;
    let priorExitCode: number | undefined;
    let priorCwd: string;

    beforeEach(async () => {
        workspace = await mkdtemp(join(tmpdir(), "chartlang-add-adapter-"));
        priorExitCode = process.exitCode;
        process.exitCode = undefined;
        priorCwd = process.cwd();
    });

    afterEach(async () => {
        process.chdir(priorCwd);
        process.exitCode = priorExitCode;
        await rm(workspace, { recursive: true, force: true });
    });

    it.each(ALL_IDS)("writes a complete, install-ready bundle for %s", async (id) => {
        const target = join(workspace, `${id}-out`);
        const cap = makeDeps();
        await runAddAdapter([id, target], cap.deps);

        await expect(stat(join(target, "package.json"))).resolves.toBeTruthy();
        await expect(stat(join(target, "src", "index.ts"))).resolves.toBeTruthy();
        await expect(stat(join(target, ".gitignore"))).resolves.toBeTruthy();

        const pkg = JSON.parse(await readFile(join(target, "package.json"), "utf8"));
        expect(pkg.name).toBe(`${id}-out`);
        expect(pkg.private).toBe(true);
        expect(JSON.stringify(pkg)).not.toContain("workspace:");
        expect(JSON.stringify(pkg)).not.toContain("__PKG_NAME__");

        expect(cap.stdout()).toContain(`Adapter written to ${target}`);
        expect(cap.stdout()).toContain("Next steps:");
        expect(process.exitCode).toBeUndefined();
    });

    it("creates nested subdirectories for src/ files", async () => {
        const target = join(workspace, "nested");
        await runAddAdapter(["konva", target], makeDeps().deps);
        await expect(stat(join(target, "src", "primitiveToNode.ts"))).resolves.toBeTruthy();
    });

    it("substitutes --name into the package.json name", async () => {
        const target = join(workspace, "konva-out");
        await runAddAdapter(["konva", target, "--name", "my-chart-pkg"], makeDeps().deps);
        const pkg = JSON.parse(await readFile(join(target, "package.json"), "utf8"));
        expect(pkg.name).toBe("my-chart-pkg");
    });

    it("defaults the target dir to ./<id>-adapter resolved against cwd", async () => {
        process.chdir(workspace);
        await runAddAdapter(["uplot"], makeDeps().deps);
        const dir = join(workspace, "uplot-adapter");
        await expect(stat(join(dir, "package.json"))).resolves.toBeTruthy();
        const pkg = JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
        expect(pkg.name).toBe(basename(dir));
    });

    it("--list prints the matrix without writing anything", async () => {
        const cap = makeDeps();
        await runAddAdapter(["--list"], cap.deps);
        for (const id of ALL_IDS) expect(cap.stdout()).toContain(`add-adapter ${id}`);
        expect(cap.stderr()).toBe("");
    });

    it("with no id on a non-TTY prints the matrix", async () => {
        const cap = makeDeps({ isTTY: false });
        await runAddAdapter([], cap.deps);
        expect(cap.stdout()).toContain("Available chartlang adapters");
    });

    it("with no id on a TTY prompts and installs the chosen adapter", async () => {
        process.chdir(workspace);
        const cap = makeDeps({ isTTY: true, answer: " konva " });
        await runAddAdapter([], cap.deps);
        await expect(stat(join(workspace, "konva-adapter", "package.json"))).resolves.toBeTruthy();
    });

    it("errors on an unknown id and lists the valid ids", async () => {
        const cap = makeDeps();
        await runAddAdapter(["nope", join(workspace, "x")], cap.deps);
        expect(process.exitCode).toBe(1);
        expect(cap.stderr()).toContain('unknown adapter "nope"');
        for (const id of ALL_IDS) expect(cap.stderr()).toContain(id);
    });

    it("refuses a non-empty target without --force", async () => {
        const target = join(workspace, "occupied");
        await mkdir(target, { recursive: true });
        await writeFile(join(target, "marker"), "x", "utf8");
        const cap = makeDeps();
        await runAddAdapter(["konva", target], cap.deps);
        expect(process.exitCode).toBe(1);
        expect(cap.stderr()).toContain("target directory not empty");
    });

    it("overwrites a non-empty target with --force", async () => {
        const target = join(workspace, "occupied");
        await mkdir(target, { recursive: true });
        await writeFile(join(target, "marker"), "x", "utf8");
        await runAddAdapter(["konva", target, "--force"], makeDeps().deps);
        await expect(stat(join(target, "package.json"))).resolves.toBeTruthy();
    });

    it.each(["npm", "pnpm", "yarn", "bun"] as const)(
        "prints %s install commands in the next steps",
        async (pm) => {
            const target = join(workspace, `pm-${pm}`);
            const cap = makeDeps();
            await runAddAdapter(["uplot", target, "--pm", pm], cap.deps);
            expect(cap.stdout()).toContain(`cd ${target}`);
            expect(cap.stdout()).toContain(pm === "npm" ? "npm install" : `${pm} install`);
            expect(cap.stdout()).toContain(`${pm} run build`);
        },
    );

    it("errors on an invalid --pm value", async () => {
        const cap = makeDeps();
        await runAddAdapter(["konva", join(workspace, "x"), "--pm", "rush"], cap.deps);
        expect(process.exitCode).toBe(1);
        expect(cap.stderr()).toContain('invalid --pm "rush"');
    });
});

describe("defaultAddAdapterDeps", () => {
    it("wires the real process streams + a working readline prompter", () => {
        const deps = defaultAddAdapterDeps();
        expect(deps.stdout).toBe(process.stdout);
        expect(deps.stderr).toBe(process.stderr);
        expect(typeof deps.isTTY).toBe("boolean");
        const prompter = deps.createPrompter();
        expect(typeof prompter.question).toBe("function");
        prompter.close();
    });
});

describe("renderList", () => {
    it("shows 'no runtime dep' for the dependency-free canvas2d entry", () => {
        const out = renderList([
            {
                id: "canvas2d",
                displayName: "Canvas 2D",
                library: "(none)",
                libraryRange: "(built-in)",
                license: "MIT",
                renderTech: "HTML Canvas 2D context",
                strategy: "ctx",
                approxBundleKb: 130,
                bestFor: "Zero-dep reference.",
                githubFolder: "https://example.invalid",
            },
        ]);
        expect(out).toContain("no runtime dep");
        expect(out).not.toContain("(none)");
    });

    it("shows the library + range for a library-backed entry", () => {
        const out = renderList([
            {
                id: "konva",
                displayName: "Konva",
                library: "konva",
                libraryRange: "^9",
                license: "MIT",
                renderTech: "Scene-graph",
                strategy: "nodes",
                approxBundleKb: 92,
                bestFor: "Nodes.",
                githubFolder: "https://example.invalid",
            },
        ]);
        expect(out).toContain("konva ^9");
    });
});
